import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@Injectable()
export class SitesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.site.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { contentTypes: true } } },
    });
  }

  async get(id: string) {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: { contentTypes: true },
    });
    if (!site) throw new NotFoundException('Site not found');
    return site;
  }

  create(dto: CreateSiteDto) {
    return this.prisma.site.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        domain: dto.domain,
        authorName: dto.authorName,
        toneOfVoice: dto.toneOfVoice ?? '',
        defaultLocale: dto.defaultLocale ?? 'pt-BR',
        supportedLocales: dto.supportedLocales ?? ['pt-BR'],
        ogDefaults: (dto.ogDefaults ?? {}) as object,
        indexnowKey: dto.indexnowKey,
        revalidateUrl: dto.revalidateUrl,
        revalidateSecret: dto.revalidateSecret,
        active: dto.active ?? true,
        trackingEnabled: dto.trackingEnabled ?? false,
      },
    });
  }

  update(id: string, dto: UpdateSiteDto) {
    return this.prisma.site.update({
      where: { id },
      data: {
        ...dto,
        ogDefaults: dto.ogDefaults as object | undefined,
      },
    });
  }

  remove(id: string) {
    return this.prisma.site.delete({ where: { id } });
  }
}
