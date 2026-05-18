import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { IsPublic } from '@/shared/decorators/IsPublic.decorator';
import { PublicService } from './public.service';
import { RelatedService } from '../contents/related.service';

@ApiTags('public')
@Controller('public/:siteSlug')
export class PublicController {
  constructor(
    private service: PublicService,
    private related: RelatedService,
  ) {}

  @Get('contents/:slug/related')
  @IsPublic()
  @Header('Cache-Control', 'public, max-age=300, s-maxage=600')
  async getRelated(
    @Param('siteSlug') siteSlug: string,
    @Param('slug') slug: string,
    @Query('locale') locale?: string,
    @Query('limit') limit?: string,
  ) {
    return this.related.forPublicSlug(
      siteSlug,
      slug,
      locale,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('contents')
  @IsPublic()
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300')
  list(
    @Param('siteSlug') siteSlug: string,
    @Query('type') type?: string,
    @Query('locale') locale?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listContents(siteSlug, {
      type,
      locale,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('contents/:slug')
  @IsPublic()
  @Header('Cache-Control', 'public, max-age=120, s-maxage=600')
  detail(
    @Param('siteSlug') siteSlug: string,
    @Param('slug') slug: string,
    @Query('locale') locale?: string,
  ) {
    return this.service.getContent(siteSlug, slug, locale);
  }

  @Get('sitemap.xml')
  @IsPublic()
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  async sitemap(@Param('siteSlug') siteSlug: string, @Res() res: Response) {
    const xml = await this.service.buildSitemap(siteSlug);
    res.send(xml);
  }

  @Get('rss.xml')
  @IsPublic()
  @Header('Content-Type', 'application/rss+xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=600, s-maxage=600')
  async rss(
    @Param('siteSlug') siteSlug: string,
    @Query('type') type: string | undefined,
    @Query('locale') locale: string | undefined,
    @Res() res: Response,
  ) {
    const xml = await this.service.buildRss(siteSlug, type, locale);
    res.send(xml);
  }

  @Get('robots.txt')
  @IsPublic()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=86400, s-maxage=86400')
  async robots(@Param('siteSlug') siteSlug: string, @Res() res: Response) {
    const txt = await this.service.buildRobots(siteSlug);
    res.send(txt);
  }
}
