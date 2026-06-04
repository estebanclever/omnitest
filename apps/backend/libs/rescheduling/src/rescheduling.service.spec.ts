import { Test, TestingModule } from '@nestjs/testing';
import { ReschedulingService } from './rescheduling.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Helper to create a production order mock
function createOrder(
  id: string,
  reference: string,
  createdAt: string,
  startDate: string,
  endDate: string,
): any {
  return {
    id,
    reference,
    product: 'Product A',
    quantity: 10,
    startDate,
    endDate,
    status: 'planned',
    createdAt,
  };
}

describe('ReschedulingService', () => {
  let service: ReschedulingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReschedulingService],
    }).compile();

    service = module.get<ReschedulingService>(ReschedulingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should do nothing if less than 2 planned orders found', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { data: [createOrder('1', 'REF01', '2026-06-01T00:00:00Z', '2026-06-04T08:00:00Z', '2026-06-04T12:00:00Z')] } });
    
    const result = await service.reschedulePlannedOrders();
    expect(result).toEqual([]);
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  it('should not reschedule if no overlaps exist (exclusive boundary check)', async () => {
    // Order 1: June 4, 08:00 - 12:00
    // Order 2: June 4, 12:00 - 16:00 (Starts exactly when Order 1 ends - no overlap because of exclusive boundary)
    const o1 = createOrder('1', 'REF01', '2026-06-01T00:00:00Z', '2026-06-04T08:00:00Z', '2026-06-04T12:00:00Z');
    const o2 = createOrder('2', 'REF02', '2026-06-02T00:00:00Z', '2026-06-04T12:00:00Z', '2026-06-04T16:00:00Z');

    mockedAxios.get.mockResolvedValueOnce({ data: { data: [o1, o2] } });

    const result = await service.reschedulePlannedOrders();
    expect(result).toEqual([]);
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  it('should reschedule simple overlap of 2 orders', async () => {
    // Order 1: June 4, 08:00 - 12:00 (created Jun 2) -> Duration 4 hours
    // Order 2: June 4, 10:00 - 14:00 (created Jun 1) -> Duration 4 hours
    // They overlap. Order 2 was created first, so it should be scheduled first.
    // Earliest start time: June 4, 08:00
    // Order 2 (first): June 4, 08:00 - 12:00
    // Order 1 (second): June 4, 12:00 - 16:00
    const o1 = createOrder('1', 'REF01', '2026-06-02T00:00:00Z', '2026-06-04T08:00:00Z', '2026-06-04T12:00:00Z');
    const o2 = createOrder('2', 'REF02', '2026-06-01T00:00:00Z', '2026-06-04T10:00:00Z', '2026-06-04T14:00:00Z');

    mockedAxios.get.mockResolvedValueOnce({ data: { data: [o1, o2] } });
    mockedAxios.patch.mockResolvedValueOnce({ data: {} });

    const result = await service.reschedulePlannedOrders();

    // Verify updates saved to Directus
    expect(mockedAxios.patch).toHaveBeenCalledWith(expect.any(String), [
      { id: '2', startDate: '2026-06-04T08:00:00.000Z', endDate: '2026-06-04T12:00:00.000Z' },
      { id: '1', startDate: '2026-06-04T12:00:00.000Z', endDate: '2026-06-04T16:00:00.000Z' },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('2'); // Order 2 scheduled first
    expect(result[0].startDate).toBe('2026-06-04T08:00:00.000Z');
    expect(result[1].id).toBe('1'); // Order 1 scheduled second
    expect(result[1].startDate).toBe('2026-06-04T12:00:00.000Z');
  });

  it('should reschedule chained overlaps (A overlaps B, B overlaps C)', async () => {
    // A: 08:00 - 11:00 (created Jun 3) -> dur 3h
    // B: 10:00 - 13:00 (created Jun 2) -> dur 3h
    // C: 12:00 - 15:00 (created Jun 1) -> dur 3h
    // Chained: A overlaps B, B overlaps C. All 3 are in the same component.
    // Priority: C (Jun 1) -> B (Jun 2) -> A (Jun 3)
    // Earliest start: 08:00
    // C starts 08:00 - 11:00
    // B starts 11:00 - 14:00
    // A starts 14:00 - 17:00
    const A = createOrder('A', 'REF-A', '2026-06-03T00:00:00Z', '2026-06-04T08:00:00Z', '2026-06-04T11:00:00Z');
    const B = createOrder('B', 'REF-B', '2026-06-02T00:00:00Z', '2026-06-04T10:00:00Z', '2026-06-04T13:00:00Z');
    const C = createOrder('C', 'REF-C', '2026-06-01T00:00:00Z', '2026-06-04T12:00:00Z', '2026-06-04T15:00:00Z');

    mockedAxios.get.mockResolvedValueOnce({ data: { data: [A, B, C] } });
    mockedAxios.patch.mockResolvedValueOnce({ data: {} });

    const result = await service.reschedulePlannedOrders();

    expect(mockedAxios.patch).toHaveBeenCalledWith(expect.any(String), [
      { id: 'C', startDate: '2026-06-04T08:00:00.000Z', endDate: '2026-06-04T11:00:00.000Z' },
      { id: 'B', startDate: '2026-06-04T11:00:00.000Z', endDate: '2026-06-04T14:00:00.000Z' },
      { id: 'A', startDate: '2026-06-04T14:00:00.000Z', endDate: '2026-06-04T17:00:00.000Z' },
    ]);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('C');
    expect(result[1].id).toBe('B');
    expect(result[2].id).toBe('A');
  });

  it('should handle multiple independent overlapping components', async () => {
    // Component 1 (overlap):
    // o1: Jun 4, 08:00 - 10:00 (created Jun 2) -> dur 2h
    // o2: Jun 4, 09:00 - 11:00 (created Jun 1) -> dur 2h
    // Priority: o2 (Jun 1) -> o1 (Jun 2)
    // Earliest start: 08:00. o2: 08:00-10:00, o1: 10:00-12:00
    //
    // Component 2 (overlap):
    // o3: Jun 4, 15:00 - 17:00 (created Jun 4) -> dur 2h
    // o4: Jun 4, 16:00 - 18:00 (created Jun 3) -> dur 2h
    // Priority: o4 (Jun 3) -> o3 (Jun 4)
    // Earliest start: 15:00. o4: 15:00-17:00, o3: 17:00-19:00
    const o1 = createOrder('1', 'REF01', '2026-06-02T00:00:00Z', '2026-06-04T08:00:00Z', '2026-06-04T10:00:00Z');
    const o2 = createOrder('2', 'REF02', '2026-06-01T00:00:00Z', '2026-06-04T09:00:00Z', '2026-06-04T11:00:00Z');
    const o3 = createOrder('3', 'REF03', '2026-06-04T00:00:00Z', '2026-06-04T15:00:00Z', '2026-06-04T17:00:00Z');
    const o4 = createOrder('4', 'REF04', '2026-06-03T00:00:00Z', '2026-06-04T16:00:00Z', '2026-06-04T18:00:00Z');

    mockedAxios.get.mockResolvedValueOnce({ data: { data: [o1, o2, o3, o4] } });
    mockedAxios.patch.mockResolvedValueOnce({ data: {} });

    await service.reschedulePlannedOrders();

    expect(mockedAxios.patch).toHaveBeenCalledWith(expect.any(String), [
      { id: '2', startDate: '2026-06-04T08:00:00.000Z', endDate: '2026-06-04T10:00:00.000Z' },
      { id: '1', startDate: '2026-06-04T10:00:00.000Z', endDate: '2026-06-04T12:00:00.000Z' },
      { id: '4', startDate: '2026-06-04T15:00:00.000Z', endDate: '2026-06-04T17:00:00.000Z' },
      { id: '3', startDate: '2026-06-04T17:00:00.000Z', endDate: '2026-06-04T19:00:00.000Z' },
    ]);
  });

  it('should break ties deterministically by reference if createdAt is identical', async () => {
    // o1: Jun 4, 08:00 - 10:00, REF-B (created Jun 1) -> dur 2h
    // o2: Jun 4, 09:00 - 11:00, REF-A (created Jun 1) -> dur 2h
    // CreatedAt identical. REF-A should go first.
    // Earliest start: 08:00.
    // REF-A (o2): 08:00-10:00
    // REF-B (o1): 10:00-12:00
    const o1 = createOrder('1', 'REF-B', '2026-06-01T00:00:00Z', '2026-06-04T08:00:00Z', '2026-06-04T10:00:00Z');
    const o2 = createOrder('2', 'REF-A', '2026-06-01T00:00:00Z', '2026-06-04T09:00:00Z', '2026-06-04T11:00:00Z');

    mockedAxios.get.mockResolvedValueOnce({ data: { data: [o1, o2] } });
    mockedAxios.patch.mockResolvedValueOnce({ data: {} });

    await service.reschedulePlannedOrders();

    expect(mockedAxios.patch).toHaveBeenCalledWith(expect.any(String), [
      { id: '2', startDate: '2026-06-04T08:00:00.000Z', endDate: '2026-06-04T10:00:00.000Z' },
      { id: '1', startDate: '2026-06-04T10:00:00.000Z', endDate: '2026-06-04T12:00:00.000Z' },
    ]);
  });
});
