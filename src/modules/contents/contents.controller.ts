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
import { ContentStatus } from '@prisma/client';
import { CurrentUser, CurrentUserId, type CurrentUserPayload } from '@/shared/decorators/CurrentUser.decorator';
import { ContentsService } from './contents.service';
import { CreateContentDto } from './dto/create-content.dto';
import { ExpandIdeaDto, GenerateCoverDto, RegenerateFieldDto, TransitionDto } from './dto/expand.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { ExpansionService } from './expansion.service';
import { RelatedService } from './related.service';

@ApiTags('contents')
@ApiBearerAuth()
@Controller('contents')
export class ContentsController {
  constructor(
    private service: ContentsService,
    private expansion: ExpansionService,
    private related: RelatedService,
  ) {}

  @Get(':id/related')
  getRelated(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.related.forContent(id, { limit: limit ? Number(limit) : undefined });
  }

  @Get()
  list(
    @Query('siteId') siteId?: string,
    @Query('contentTypeId') contentTypeId?: string,
    @Query('status') status?: ContentStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({
      siteId,
      contentTypeId,
      status,
      search,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Get(':id/versions')
  versions(@Param('id') id: string) {
    return this.service.versions(id);
  }

  @Get(':id/diff')
  diff(@Param('id') id: string, @Query('from') from: string, @Query('to') to: string) {
    return this.service.diffVersions(id, Number(from), Number(to));
  }

  @Post()
  create(@Body() dto: CreateContentDto, @CurrentUserId() userId: string) {
    return this.service.create(dto, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContentDto, @CurrentUserId() userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/transition')
  @HttpCode(200)
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.transition(
      id,
      dto.to as ContentStatus,
      user.role as 'ADMIN' | 'EDITOR' | 'REVISOR',
      user.sub,
    );
  }

  // ---- expansion / regeneration ----

  @Post('expand')
  @HttpCode(201)
  expand(@Body() dto: ExpandIdeaDto, @CurrentUserId() userId: string) {
    return this.expansion.expandIdea({
      ideaId: dto.ideaId,
      userId,
      generateImage: dto.generateImage,
      onlyFields: dto.fields,
    });
  }

  @Post(':id/regenerate')
  @HttpCode(200)
  regenerate(
    @Param('id') id: string,
    @Body() dto: RegenerateFieldDto,
    @CurrentUserId() userId: string,
  ) {
    return this.expansion.regenerateField(id, dto.field, {
      variables: dto.variables,
      preview: dto.preview,
      userId,
    });
  }

  @Post(':id/cover')
  @HttpCode(200)
  cover(@Param('id') id: string, @Body() dto: GenerateCoverDto, @CurrentUserId() userId: string) {
    return this.expansion.generateCover(id, { ...dto, userId });
  }
}
