import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma/prisma.service';
import { CreateContentTypeDto } from './dto/create-content-type.dto';
import { UpdateContentTypeDto } from './dto/update-content-type.dto';

@Injectable()
export class ContentTypesService {
  constructor(private prisma: PrismaService) {}

  list(siteId?: string) {
    return this.prisma.contentType.findMany({
      where: siteId ? { siteId } : {},
      orderBy: { createdAt: 'asc' },
    });
  }

  async get(id: string) {
    const ct = await this.prisma.contentType.findUnique({ where: { id } });
    if (!ct) throw new NotFoundException('Content type not found');
    return ct;
  }

  create(dto: CreateContentTypeDto) {
    return this.prisma.contentType.create({
      data: {
        siteId: dto.siteId,
        slug: dto.slug,
        name: dto.name,
        routePrefix: dto.routePrefix,
        schemaExtra: (dto.schemaExtra ?? {}) as object,
        active: dto.active ?? true,
      },
    });
  }

  update(id: string, dto: UpdateContentTypeDto) {
    return this.prisma.contentType.update({
      where: { id },
      data: {
        ...dto,
        schemaExtra: dto.schemaExtra as object | undefined,
      },
    });
  }

  remove(id: string) {
    return this.prisma.contentType.delete({ where: { id } });
  }
}
