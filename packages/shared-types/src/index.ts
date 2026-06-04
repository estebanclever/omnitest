export type OrderStatus = 'planned' | 'scheduled' | 'in_progress' | 'completed';

export interface ProductionOrder {
  id: string;
  reference: string;
  product: string;
  quantity: number;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  status: OrderStatus;
  createdAt: string; // ISO date string
}

export interface CreateProductionOrderDto {
  reference: string;
  product: string;
  quantity: number;
  startDate: string;
  endDate: string;
  status?: OrderStatus;
}

export interface UpdateProductionOrderDto extends Partial<CreateProductionOrderDto> {}
