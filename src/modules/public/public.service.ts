import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { PrismaService } from '@/shared/database/prisma/prisma.service';

const PUBLIC_CONTENT_SELECT = {
  id: true,
  title: true,
  slug: true,
  locale: true,
  bodyMd: true,
  excerpt: true,
  metaDescription: true,
  jsonLd: true,
  publishedAt: true,
  updatedAt: true,
  ogImage: { select: { url: true, alt: true, width: true, height: true } },
  contentType: { select: { slug: true, routePrefix: true } },
  tags: { include: { tag: { select: { slug: true, name: true } } } },
  categories: { include: { category: { select: { slug: true, name: true } } } },
} as const;

@Injectable()
export class PublicService {
  constructor(private prisma: PrismaService) {}

  private async findSite(siteSlug: string) {
    const site = await this.prisma.site.findUnique({ where: { slug: siteSlug } });
    if (!site || !site.active) throw new NotFoundException('Site not found');
    return site;
  }

  async listContents(
    siteSlug: string,
    params: { type?: string; locale?: string; page?: number; pageSize?: number },
  ) {
    const site = await this.findSite(siteSlug);
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

    const where = {
      siteId: site.id,
      status: ContentStatus.PUBLISHED,
      ...(params.locale ? { locale: params.locale } : {}),
      ...(params.type ? { contentType: { slug: params.type } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.content.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: PUBLIC_CONTENT_SELECT,
      }),
      this.prisma.content.count({ where }),
    ]);

    return {
      site: { slug: site.slug, name: site.name, domain: site.domain, authorName: site.authorName },
      items: items.map(serializeContent),
      total,
      page,
      pageSize,
    };
  }

  async getContent(siteSlug: string, contentSlug: string, locale?: string) {
    const site = await this.findSite(siteSlug);
    const content = await this.prisma.content.findFirst({
      where: {
        siteId: site.id,
        slug: contentSlug,
        ...(locale ? { locale } : {}),
      },
      select: { ...PUBLIC_CONTENT_SELECT, status: true, siteId: true },
    });
    if (!content) throw new NotFoundException('Content not found');
    if (content.status === ContentStatus.UNPUBLISHED || content.status === ContentStatus.ARCHIVED) {
      throw new GoneException('Content unpublished');
    }
    if (content.status !== ContentStatus.PUBLISHED) {
      throw new NotFoundException('Content not yet published');
    }
    const { status: _s, siteId: _si, ...rest } = content;
    return {
      site: { slug: site.slug, name: site.name, domain: site.domain, authorName: site.authorName },
      content: serializeContent(rest),
    };
  }

  async buildSitemap(siteSlug: string): Promise<string> {
    const site = await this.findSite(siteSlug);
    const contents = await this.prisma.content.findMany({
      where: { siteId: site.id, status: ContentStatus.PUBLISHED },
      orderBy: { publishedAt: 'desc' },
      select: {
        slug: true,
        locale: true,
        updatedAt: true,
        contentType: { select: { routePrefix: true } },
      },
    });

    const base = site.domain ? `https://${site.domain}` : `https://${site.slug}.example`;
    const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

    // group por slug pra hreflang cross-locale
    const groups = new Map<string, Array<typeof contents[number]>>();
    for (const c of contents) {
      const key = `${c.contentType.routePrefix}/${c.slug}`;
      groups.get(key)?.push(c) ?? groups.set(key, [c]);
    }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
    for (const [key, group] of groups) {
      for (const c of group) {
        const isDefault = c.locale === site.defaultLocale;
        const localePath = isDefault ? '' : `/${c.locale}`;
        xml += `  <url>\n`;
        xml += `    <loc>${escape(base + localePath + key)}</loc>\n`;
        xml += `    <lastmod>${c.updatedAt.toISOString().slice(0, 10)}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        // hreflang alternates
        for (const alt of group) {
          const altPath = alt.locale === site.defaultLocale ? '' : `/${alt.locale}`;
          xml += `    <xhtml:link rel="alternate" hreflang="${alt.locale}" href="${escape(base + altPath + key)}"/>\n`;
        }
        xml += `  </url>\n`;
      }
    }
    xml += '</urlset>\n';
    return xml;
  }

  async buildRss(siteSlug: string, type?: string, locale?: string): Promise<string> {
    const site = await this.findSite(siteSlug);
    const where = {
      siteId: site.id,
      status: ContentStatus.PUBLISHED,
      ...(locale ? { locale } : { locale: site.defaultLocale }),
      ...(type ? { contentType: { slug: type } } : {}),
    };
    const items = await this.prisma.content.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: 50,
      select: {
        title: true,
        slug: true,
        excerpt: true,
        metaDescription: true,
        publishedAt: true,
        contentType: { select: { routePrefix: true, name: true } },
      },
    });

    const base = site.domain ? `https://${site.domain}` : `https://${site.slug}.example`;
    const escape = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const rfc822 = (d: Date) => d.toUTCString();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<rss version="2.0">\n';
    xml += '  <channel>\n';
    xml += `    <title>${escape(site.name)}${type ? ` — ${type}` : ''}</title>\n`;
    xml += `    <link>${escape(base)}</link>\n`;
    xml += `    <description>${escape('Publicações de ' + site.name)}</description>\n`;
    xml += `    <language>${locale ?? site.defaultLocale}</language>\n`;
    if (items[0]?.publishedAt) {
      xml += `    <pubDate>${rfc822(items[0].publishedAt)}</pubDate>\n`;
    }
    for (const c of items) {
      const url = `${base}${c.contentType.routePrefix}/${c.slug}`;
      xml += '    <item>\n';
      xml += `      <title>${escape(c.title)}</title>\n`;
      xml += `      <link>${escape(url)}</link>\n`;
      xml += `      <guid>${escape(url)}</guid>\n`;
      xml += `      <description>${escape(c.metaDescription || c.excerpt)}</description>\n`;
      if (c.publishedAt) xml += `      <pubDate>${rfc822(c.publishedAt)}</pubDate>\n`;
      xml += `      <category>${escape(c.contentType.name)}</category>\n`;
      xml += '    </item>\n';
    }
    xml += '  </channel>\n</rss>\n';
    return xml;
  }

  async buildRobots(siteSlug: string): Promise<string> {
    const site = await this.findSite(siteSlug);
    const base = site.domain ? `https://${site.domain}` : `https://${site.slug}.example`;
    return [
      'User-agent: *',
      'Allow: /',
      `Sitemap: ${base}/sitemap.xml`,
      '',
    ].join('\n');
  }
}

function serializeContent(c: any) {
  return {
    id: c.id,
    title: c.title,
    slug: c.slug,
    locale: c.locale,
    bodyMd: c.bodyMd,
    excerpt: c.excerpt,
    metaDescription: c.metaDescription,
    jsonLd: c.jsonLd,
    publishedAt: c.publishedAt,
    updatedAt: c.updatedAt,
    ogImage: c.ogImage,
    contentType: c.contentType,
    tags: c.tags?.map((t: any) => t.tag) ?? [],
    categories: c.categories?.map((cat: any) => cat.category) ?? [],
  };
}
