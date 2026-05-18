import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IdeaStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/database/prisma/prisma.service';
import { BulkCreateIdeasDto } from './dto/bulk-create.dto';
import { CreateIdeaDto } from './dto/create-idea.dto';
import { ListIdeasDto } from './dto/list-ideas.dto';
import { UpdateIdeaDto } from './dto/update-idea.dto';

@Injectable()
export class IdeasService {
  constructor(private prisma: PrismaService) {}

  async list(params: ListIdeasDto, fallbackSiteId?: string) {
    const siteId = params.siteId ?? fallbackSiteId;
    const where: Prisma.IdeaWhereInput = {
      ...(siteId ? { siteId } : {}),
      ...(params.contentTypeId ? { contentTypeId: params.contentTypeId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { titleSeed: { contains: params.search, mode: 'insensitive' } },
              { briefing: { contains: params.search, mode: 'insensitive' } },
              { keywords: { has: params.search } },
            ],
          }
        : {}),
    };

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.idea.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { contentType: { select: { id: true, slug: true, name: true } } },
      }),
      this.prisma.idea.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async get(id: string) {
    const idea = await this.prisma.idea.findUnique({
      where: { id },
      include: { contentType: true },
    });
    if (!idea) throw new NotFoundException('Idea not found');
    return idea;
  }

  async create(dto: CreateIdeaDto, userId?: string) {
    await this.assertSiteContentTypeMatch(dto.siteId, dto.contentTypeId);
    return this.prisma.idea.create({
      data: {
        siteId: dto.siteId,
        contentTypeId: dto.contentTypeId,
        titleSeed: dto.titleSeed,
        briefing: dto.briefing ?? '',
        keywords: dto.keywords ?? [],
        locale: dto.locale ?? 'pt-BR',
        notes: dto.notes ?? '',
        status: dto.status ?? IdeaStatus.PENDING,
        createdBy: userId ?? null,
      },
    });
  }

  async bulkCreate(dto: BulkCreateIdeasDto, userId?: string) {
    // validar todos os pares (siteId, contentTypeId)
    const pairs = new Set(dto.items.map((i) => `${i.siteId}|${i.contentTypeId}`));
    for (const pair of pairs) {
      const [siteId, ctId] = pair.split('|');
      await this.assertSiteContentTypeMatch(siteId, ctId);
    }
    const data: Prisma.IdeaCreateManyInput[] = dto.items.map((i) => ({
      siteId: i.siteId,
      contentTypeId: i.contentTypeId,
      titleSeed: i.titleSeed,
      briefing: i.briefing ?? '',
      keywords: i.keywords ?? [],
      locale: i.locale ?? 'pt-BR',
      notes: i.notes ?? '',
      status: i.status ?? IdeaStatus.PENDING,
      createdBy: userId ?? null,
    }));
    const result = await this.prisma.idea.createMany({ data });
    return { count: result.count };
  }

  async update(id: string, dto: UpdateIdeaDto) {
    if (dto.contentTypeId) {
      const idea = await this.get(id);
      await this.assertSiteContentTypeMatch(idea.siteId, dto.contentTypeId);
    }
    return this.prisma.idea.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.idea.delete({ where: { id } });
  }

  async bulkRemove(ids: string[]) {
    const result = await this.prisma.idea.deleteMany({ where: { id: { in: ids } } });
    return { count: result.count };
  }

  async bulkMoveType(ids: string[], contentTypeId: string) {
    const ideas = await this.prisma.idea.findMany({
      where: { id: { in: ids } },
      select: { siteId: true },
    });
    const siteIds = new Set(ideas.map((i) => i.siteId));
    if (siteIds.size > 1) {
      throw new BadRequestException('Cannot move ideas across multiple sites');
    }
    const siteId = siteIds.values().next().value;
    if (siteId) await this.assertSiteContentTypeMatch(siteId, contentTypeId);
    const result = await this.prisma.idea.updateMany({
      where: { id: { in: ids } },
      data: { contentTypeId },
    });
    return { count: result.count };
  }

  async bulkUpdateStatus(ids: string[], status: IdeaStatus) {
    const result = await this.prisma.idea.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });
    return { count: result.count };
  }

  private async assertSiteContentTypeMatch(siteId: string, contentTypeId: string) {
    const ct = await this.prisma.contentType.findUnique({ where: { id: contentTypeId } });
    if (!ct) throw new BadRequestException('contentTypeId not found');
    if (ct.siteId !== siteId) {
      throw new BadRequestException('contentTypeId does not belong to siteId');
    }
  }
}
