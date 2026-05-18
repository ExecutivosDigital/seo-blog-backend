import { Module } from '@nestjs/common';
import { ContentsModule } from '../contents/contents.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [ContentsModule],
  controllers: [PublicController],
  providers: [PublicService],
  exports: [PublicService],
})
export class PublicModule {}
