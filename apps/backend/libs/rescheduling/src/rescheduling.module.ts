import { Module } from '@nestjs/common';
import { ReschedulingService } from './rescheduling.service';

@Module({
  providers: [ReschedulingService],
  exports: [ReschedulingService],
})
export class ReschedulingModule {}
