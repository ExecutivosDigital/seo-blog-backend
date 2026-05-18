import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsAdmin } from '@/shared/decorators/IsAdmin.decorator';
import { ContentTypesService } from './content-types.service';
import { CreateContentTypeDto } from './dto/create-content-type.dto';
import { UpdateContentTypeDto } from './dto/update-content-type.dto';

@ApiTags('content-types')
@ApiBearerAuth()
@Controller('content-types')
export class ContentTypesController {
  constructor(private service: ContentTypesService) {}

  @Get()
  list(@Query('siteId') siteId?: string) {
    return this.service.list(siteId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  @IsAdmin()
  create(@Body() dto: CreateContentTypeDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @IsAdmin()
  update(@Param('id') id: string, @Body() dto: UpdateContentTypeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @IsAdmin()
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
