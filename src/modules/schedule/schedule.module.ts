import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ScheduleController } from './schedule.controller';
import { ScheduleService, PUBLISH_QUEUE } from './schedule.service';

@Module({
  imports: [BullModule.registerQueue({ name: PUBLISH_QUEUE })],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService, BullModule],
})
export class ScheduleModule {}
