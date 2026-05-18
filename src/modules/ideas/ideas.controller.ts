import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IdeaStatus } from '@prisma/client';
import { CurrentUserId } from '@/shared/decorators/CurrentUser.decorator';
import { CurrentSiteIdOptional } from '@/shared/tenant/current-site.decorator';
import { BulkIdsDto, BulkMoveTypeDto, BulkUpdateStatusDto } from './dto/bulk-action.dto';
import { BulkCreateIdeasDto } from './dto/bulk-create.dto';
import { CreateIdeaDto } from './dto/create-idea.dto';
import { ListIdeasDto } from './dto/list-ideas.dto';
import { UpdateIdeaDto } from './dto/update-idea.dto';
import { IdeasService } from './ideas.service';

@ApiTags('ideas')
@ApiBearerAuth()
@Controller('ideas')
export class IdeasController {
  constructor(private service: IdeasService) {}

  @Get()
  list(@Query() query: ListIdeasDto, @CurrentSiteIdOptional() siteId?: string) {
    return this.service.list(query, siteId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  create(@Body() dto: CreateIdeaDto, @CurrentUserId() userId: string) {
    return this.service.create(dto, userId);
  }

  @Post('bulk')
  @HttpCode(201)
  bulkCreate(@Body() dto: BulkCreateIdeasDto, @CurrentUserId() userId: string) {
    return this.service.bulkCreate(dto, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateIdeaDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('bulk-delete')
  @HttpCode(200)
  bulkDelete(@Body() dto: BulkIdsDto) {
    return this.service.bulkRemove(dto.ids);
  }

  @Post('bulk-move-type')
  @HttpCode(200)
  bulkMoveType(@Body() dto: BulkMoveTypeDto) {
    return this.service.bulkMoveType(dto.ids, dto.contentTypeId);
  }

  @Post('bulk-status')
  @HttpCode(200)
  bulkStatus(@Body() dto: BulkUpdateStatusDto) {
    return this.service.bulkUpdateStatus(dto.ids, dto.status as IdeaStatus);
  }
}
