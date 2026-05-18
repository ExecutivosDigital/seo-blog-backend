import { Module } from '@nestjs/common';
import { ContentTypesController } from './content-types.controller';
import { ContentTypesService } from './content-types.service';

@Module({
  controllers: [ContentTypesController],
  providers: [ContentTypesService],
  exports: [ContentTypesService],
})
export class ContentTypesModule {}
