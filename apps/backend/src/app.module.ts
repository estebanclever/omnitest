import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ReschedulingModule } from '@app/rescheduling';
import { ProductionOrdersController } from './production-orders.controller';

@Module({
  imports: [ReschedulingModule],
  controllers: [AppController, ProductionOrdersController],
  providers: [AppService],
})
export class AppModule {}
