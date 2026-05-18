import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '@/shared/decorators/CurrentUser.decorator';
import { CreateMediaDto, GenerateMediaDto, UploadMediaDto } from './dto/create-media.dto';
import { MediaService } from './media.service';

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private service: MediaService) {}

  @Get()
  list(@Query('siteId') siteId?: string, @Query('page') page?: string) {
    return this.service.list({ siteId, page: page ? Number(page) : undefined });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  create(@Body() dto: CreateMediaDto, @CurrentUserId() userId: string) {
    return this.service.create(dto, userId);
  }

  @Post('upload')
  @HttpCode(201)
  upload(@Body() dto: UploadMediaDto, @CurrentUserId() userId: string) {
    return this.service.uploadBase64(dto, userId);
  }

  @Post('generate')
  @HttpCode(201)
  generate(@Body() dto: GenerateMediaDto) {
    return this.service.generate(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
