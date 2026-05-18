import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { PrismaService } from '@/shared/database/prisma/prisma.service';

const TAG_WEIGHT = 1;
const CATEGORY_WEIGHT = 2;

export interface RelatedItem {
  id: string;
  title: string;
  slug: string;
  locale: string;
  excerpt: string;
  publishedAt: Date | null;
  ogImage: { url: string; alt: string } | null;
  contentType: { slug: string; name: string; routePrefix: string };
  score: number;
  sharedTags: string[];
  sharedCategories: string[];
}

@Injectable()
export class RelatedService {
  constructor(private prisma: PrismaService) {}

  async forContent(
    contentId: string,
    opts: { limit?: number; publishedOnly?: boolean } = {},
  ): Promise<RelatedItem[]> {
    const limit = opts.limit ?? 5;
    const publishedOnly = opts.publishedOnly ?? false;

    const me = await this.prisma.content.findUnique({
      where: { id: contentId },
      include: {
        tags: { select: { tagId: true, tag: { select: { name: true, slug: true } } } },
        categories: {
          select: {
            categoryId: true,
            category: { select: { name: true, slug: true } },
          },
        },
      },
    });
    if (!me) throw new NotFoundException('Content not found');

    const myTagIds = me.tags.map((t) => t.tagId);
    const myCatIds = me.categories.map((c) => c.categoryId);
    if (myTagIds.length === 0 && myCatIds.length === 0) return [];

    // Buscar candidates: mesmos site/locale, share pelo menos 1 tag OU categoria
    const candidates = await this.prisma.content.findMany({
      where: {
        id: { not: contentId },
        siteId: me.siteId,
        locale: me.locale,
        ...(publishedOnly ? { status: ContentStatus.PUBLISHED } : {}),
        OR: [
          ...(myTagIds.length > 0 ? [{ tags: { some: { tagId: { in: myTagIds } } } }] : []),
          ...(myCatIds.length > 0
            ? [{ categories: { some: { categoryId: { in: myCatIds } } } }]
            : []),
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        locale: true,
        excerpt: true,
        publishedAt: true,
        ogImage: { select: { url: true, alt: true } },
        contentType: { select: { slug: true, name: true, routePrefix: true } },
        tags: {
          where: { tagId: { in: myTagIds } },
          select: { tag: { select: { name: true, slug: true } } },
        },
        categories: {
          where: { categoryId: { in: myCatIds } },
          select: { category: { select: { name: true, slug: true } } },
        },
      },
      take: 50,
    });

    const scored: RelatedItem[] = candidates.map((c) => {
      const sharedTags = c.tags.map((t) => t.tag.name);
      const sharedCategories = c.categories.map((ca) => ca.category.name);
      const score = sharedTags.length * TAG_WEIGHT + sharedCategories.length * CATEGORY_WEIGHT;
      return {
        id: c.id,
        title: c.title,
        slug: c.slug,
        locale: c.locale,
        excerpt: c.excerpt,
        publishedAt: c.publishedAt,
        ogImage: c.ogImage,
        contentType: c.contentType,
        score,
        sharedTags,
        sharedCategories,
      };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
      .slice(0, limit);
  }

  async forPublicSlug(siteSlug: string, contentSlug: string, locale?: string, limit?: number) {
    const site = await this.prisma.site.findUnique({ where: { slug: siteSlug } });
    if (!site || !site.active) throw new NotFoundException('Site not found');
    const me = await this.prisma.content.findFirst({
      where: {
        siteId: site.id,
        slug: contentSlug,
        status: ContentStatus.PUBLISHED,
        ...(locale ? { locale } : {}),
      },
      select: { id: true },
    });
    if (!me) throw new NotFoundException('Content not found');
    return this.forContent(me.id, { limit: limit ?? 5, publishedOnly: true });
  }
}
