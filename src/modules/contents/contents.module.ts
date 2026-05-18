import { Module } from '@nestjs/common';
import { ContentsController } from './contents.controller';
import { ContentsService } from './contents.service';
import { ExpansionService } from './expansion.service';
import { RelatedService } from './related.service';

@Module({
  controllers: [ContentsController],
  providers: [ContentsService, ExpansionService, RelatedService],
  exports: [ContentsService, ExpansionService, RelatedService],
})
export class ContentsModule {}
