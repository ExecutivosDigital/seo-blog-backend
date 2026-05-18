import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PUBLISH_QUEUE } from '../schedule/schedule.service';
import { PublishController } from './publish.controller';
import { PublishProcessor } from './publish.processor';
import { PublishService } from './publish.service';

@Module({
  imports: [BullModule.registerQueue({ name: PUBLISH_QUEUE })],
  controllers: [PublishController],
  providers: [PublishProcessor, PublishService],
})
export class PublishModule {}
