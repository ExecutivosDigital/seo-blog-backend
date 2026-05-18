import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/database/prisma/prisma.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { slugify } from './slug.util';
import { canTransition, rolesForTransition } from './state-machine';

const FULL_INCLUDE = {
  ogImage: true,
  contentType: { select: { id: true, slug: true, name: true, routePrefix: true } },
  tags: { include: { tag: true } },
  categories: { include: { category: true } },
} as const;

@Injectable()
export class ContentsService {
  constructor(private prisma: PrismaService) {}

  async list(params: {
    siteId?: string;
    contentTypeId?: string;
    status?: ContentStatus;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const where: Prisma.ContentWhereInput = {
      ...(params.siteId ? { siteId: params.siteId } : {}),
      ...(params.contentTypeId ? { contentTypeId: params.contentTypeId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { title: { contains: params.search, mode: 'insensitive' } },
              { slug: { contains: params.search, mode: 'insensitive' } },
              { metaDescription: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.content.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          ogImage: { select: { id: true, url: true, alt: true } },
          contentType: { select: { slug: true, name: true } },
        },
      }),
      this.prisma.content.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async get(id: string) {
    const c = await this.prisma.content.findUnique({
      where: { id },
      include: FULL_INCLUDE,
    });
    if (!c) throw new NotFoundException('Content not found');
    return c;
  }

  async create(dto: CreateContentDto, userId?: string) {
    const slug = dto.slug ?? slugify(dto.title ?? 'novo-post');
    return this.prisma.content.create({
      data: {
        ideaId: dto.ideaId ?? null,
        siteId: dto.siteId,
        contentTypeId: dto.contentTypeId,
        locale: dto.locale ?? 'pt-BR',
        title: dto.title ?? '',
        slug,
        bodyMd: dto.bodyMd ?? '',
        excerpt: dto.excerpt ?? '',
        metaDescription: dto.metaDescription ?? '',
        ogImageId: dto.ogImageId ?? null,
        jsonLd: (dto.jsonLd ?? {}) as object,
        status: dto.status ?? ContentStatus.DRAFT,
        createdBy: userId ?? null,
      },
      include: FULL_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateContentDto, userId?: string) {
    const current = await this.prisma.content.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Content not found');

    const slug = dto.slug ?? (dto.title ? slugify(dto.title) : current.slug);
    const updated = await this.prisma.content.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(slug !== current.slug ? { slug } : {}),
        ...(dto.bodyMd !== undefined ? { bodyMd: dto.bodyMd } : {}),
        ...(dto.excerpt !== undefined ? { excerpt: dto.excerpt } : {}),
        ...(dto.metaDescription !== undefined ? { metaDescription: dto.metaDescription } : {}),
        ...(dto.ogImageId !== undefined ? { ogImageId: dto.ogImageId } : {}),
        ...(dto.jsonLd !== undefined ? { jsonLd: dto.jsonLd as object } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.contentTypeId !== undefined ? { contentTypeId: dto.contentTypeId } : {}),
        ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
        version: { increment: 1 },
      },
      include: FULL_INCLUDE,
    });

    // snapshot
    await this.prisma.contentVersion
      .create({
        data: {
          contentId: id,
          version: updated.version,
          createdBy: userId ?? null,
          snapshot: {
            title: updated.title,
            slug: updated.slug,
            bodyMd: updated.bodyMd,
            excerpt: updated.excerpt,
            metaDescription: updated.metaDescription,
            ogImageId: updated.ogImageId,
            jsonLd: updated.jsonLd,
            status: updated.status,
          } as object,
        },
      })
      .catch(() => undefined);

    return updated;
  }

  remove(id: string) {
    return this.prisma.content.delete({ where: { id } });
  }

  async versions(id: string) {
    const c = await this.prisma.content.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Content not found');
    return this.prisma.contentVersion.findMany({
      where: { contentId: id },
      orderBy: { version: 'desc' },
    });
  }

  async diffVersions(contentId: string, fromV: number, toV: number) {
    const [a, b] = await Promise.all([
      this.prisma.contentVersion.findUnique({
        where: { contentId_version: { contentId, version: fromV } },
      }),
      this.prisma.contentVersion.findUnique({
        where: { contentId_version: { contentId, version: toV } },
      }),
    ]);
    if (!a || !b) throw new NotFoundException('Version not found');
    const aSnap = (a.snapshot as Record<string, unknown>) ?? {};
    const bSnap = (b.snapshot as Record<string, unknown>) ?? {};
    const keys = new Set([...Object.keys(aSnap), ...Object.keys(bSnap)]);
    const fields: Record<string, { from: unknown; to: unknown; changed: boolean }> = {};
    for (const k of keys) {
      const from = aSnap[k];
      const to = bSnap[k];
      const changed = JSON.stringify(from) !== JSON.stringify(to);
      fields[k] = { from, to, changed };
    }
    return { fromVersion: fromV, toVersion: toV, fields };
  }

  async transition(
    id: string,
    to: ContentStatus,
    userRole?: 'ADMIN' | 'EDITOR' | 'REVISOR',
    userId?: string,
  ) {
    const current = await this.prisma.content.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Content not found');

    if (!canTransition(current.status, to)) {
      throw new BadRequestException(
        `Invalid transition: ${current.status} → ${to}`,
      );
    }
    const allowed = rolesForTransition(current.status, to);
    if (allowed && userRole && !allowed.includes(userRole)) {
      throw new ForbiddenException(
        `Role ${userRole} cannot perform ${current.status} → ${to}. Required: ${allowed.join(', ')}.`,
      );
    }

    const updated = await this.prisma.content.update({
      where: { id },
      data: {
        status: to,
        ...(to === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
      },
      include: FULL_INCLUDE,
    });
    await this.prisma.contentVersion
      .create({
        data: {
          contentId: id,
          version: updated.version,
          createdBy: userId ?? null,
          snapshot: { transitionTo: to } as object,
        },
      })
      .catch(() => undefined);
    return updated;
  }
}
