import { Controller, Post, HttpCode } from '@nestjs/common';
import { ReschedulingService } from '@app/rescheduling';

@Controller('production-orders')
export class ProductionOrdersController {
  constructor(private readonly reschedulingService: ReschedulingService) {}

  @Post('reschedule')
  @HttpCode(200)
  async reschedule() {
    const updatedOrders = await this.reschedulingService.reschedulePlannedOrders();
    return {
      message: 'Rescheduling completed successfully',
      updatedCount: updatedOrders.length,
      data: updatedOrders,
    };
  }
}
