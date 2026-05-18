import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ContentStatus, Idea, IdeaStatus, PromptField, Site } from '@prisma/client';
import { PrismaService } from '@/shared/database/prisma/prisma.service';
import { AiService } from '@/shared/ai/ai.service';
import { ImageGenerationService } from '@/shared/ai/image-generation.service';
import { DEFAULT_TEXT_MODEL } from '@/shared/ai/model-pricing';
import { slugify } from './slug.util';

const DEFAULT_FIELD_PROMPTS: Record<
  PromptField,
  { system: string; user: string; temperature: number } | null
> = {
  TITLE: {
    system:
      'Você é um editor SEO sênior. Gere títulos curtos, objetivos, em pt-BR. NUNCA use aspas. Máx 60 caracteres.',
    user:
      'Tema: {{title}}\nBriefing: {{briefing}}\nKeywords: {{keywords}}\nTom: {{site.toneOfVoice}}\n\nResponda APENAS com o título final, sem prefixos, sem aspas.',
    temperature: 0.5,
  },
  SLUG: null, // gerado por slugify() do título
  META_DESCRIPTION: {
    system:
      'Você gera meta descriptions SEO em pt-BR, sempre entre 150 e 160 caracteres, sem aspas e sem caracteres especiais.',
    user:
      'Título: {{title}}\nBriefing: {{briefing}}\nResponda APENAS com a meta description, sem prefixos.',
    temperature: 0.5,
  },
  EXCERPT: {
    system:
      'Gere um resumo curto (2 frases, ~280 caracteres) que sirva como excerpt de cartão de blog.',
    user: 'Título: {{title}}\nCorpo (resumido): {{body}}\nResponda apenas o excerpt.',
    temperature: 0.6,
  },
  BODY: {
    system:
      'Você é um redator profissional. Tom: {{site.toneOfVoice}}. Escreva conteúdo em pt-BR, Markdown válido, com H2/H3, listas e parágrafos curtos. Mínimo 800 palavras para blog post. Inclua disclaimer ao final se o tema for saúde/jurídico. NÃO inclua o H1 — ele virá do título.',
    user:
      'Título: {{title}}\nBriefing: {{briefing}}\nKeywords (use naturalmente): {{keywords}}\n\nEscreva o artigo completo em Markdown.',
    temperature: 0.7,
  },
  TAGS: {
    system:
      'Você sugere tags de blog. Retorne 4 a 7 tags em pt-BR, separadas por vírgula, em minúsculas, sem hashtags, sem aspas.',
    user: 'Título: {{title}}\nKeywords: {{keywords}}',
    temperature: 0.4,
  },
  CATEGORY: {
    system:
      'Você categoriza posts. Retorne APENAS UMA categoria em pt-BR (1-2 palavras), sem prefixos.',
    user: 'Título: {{title}}\nKeywords: {{keywords}}',
    temperature: 0.3,
  },
  IMAGE_PROMPT: {
    system:
      'Você cria prompts em inglês para geração de imagens de capa de blog. Estilo: editorial photography, clean, professional, no text overlay. Foco no tema. Máx 80 palavras.',
    user:
      'Topic (em inglês ou pt): {{title}}\nKeywords: {{keywords}}\nReturn ONLY the English prompt for the image generator.',
    temperature: 0.7,
  },
  JSON_LD: null, // gerado deterministicamente
  TRANSLATION: null,
};

@Injectable()
export class ExpansionService {
  private readonly logger = new Logger(ExpansionService.name);

  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    private imageGen: ImageGenerationService,
  ) {}

  async expandIdea(params: {
    ideaId: string;
    userId?: string;
    generateImage?: boolean;
    onlyFields?: PromptField[];
  }) {
    const idea = await this.prisma.idea.findUnique({
      where: { id: params.ideaId },
      include: { contentType: true },
    });
    if (!idea) throw new NotFoundException('Idea not found');
    const site = await this.prisma.site.findUnique({ where: { id: idea.siteId } });
    if (!site) throw new NotFoundException('Site not found');

    const fields =
      params.onlyFields ??
      ([
        PromptField.TITLE,
        PromptField.BODY,
        PromptField.EXCERPT,
        PromptField.META_DESCRIPTION,
        PromptField.TAGS,
        PromptField.CATEGORY,
      ] as PromptField[]);

    let title = '';
    let body = '';
    let excerpt = '';
    let metaDescription = '';
    const tagNames: string[] = [];
    let categoryName = '';
    let imagePrompt = '';

    const vars = (extra: Record<string, unknown> = {}) => ({
      title: idea.titleSeed,
      briefing: idea.briefing,
      keywords: idea.keywords,
      locale: idea.locale,
      site: {
        name: site.name,
        toneOfVoice: site.toneOfVoice,
        authorName: site.authorName,
      },
      ...extra,
    });

    for (const f of fields) {
      if (f === PromptField.TITLE) {
        title = (await this.runField(f, site, idea, vars())).trim().replace(/^["'](.*)["']$/, '$1');
      } else if (f === PromptField.BODY) {
        body = await this.runField(f, site, idea, vars({ title: title || idea.titleSeed }));
      } else if (f === PromptField.EXCERPT) {
        const summary = body.slice(0, 1500);
        excerpt = (await this.runField(f, site, idea, vars({ title, body: summary }))).trim();
      } else if (f === PromptField.META_DESCRIPTION) {
        metaDescription = (await this.runField(f, site, idea, vars({ title }))).trim();
      } else if (f === PromptField.TAGS) {
        const raw = await this.runField(f, site, idea, vars({ title }));
        for (const t of raw.split(/[,;]/).map((x) => x.trim()).filter(Boolean)) tagNames.push(t.toLowerCase());
      } else if (f === PromptField.CATEGORY) {
        categoryName = (await this.runField(f, site, idea, vars({ title }))).trim();
      }
    }

    // Gera prompt da imagem (texto) — sempre se generateImage=true
    let imageAssetId: string | null = null;
    if (params.generateImage !== false) {
      imagePrompt = await this.runField(PromptField.IMAGE_PROMPT, site, idea, vars({ title }));
      try {
        const gen = await this.imageGen.generateAndStore({
          prompt: imagePrompt.trim(),
          siteId: site.id,
          alt: title,
        });
        imageAssetId = gen.asset.id;
      } catch (e) {
        this.logger.warn(`image generation failed: ${e instanceof Error ? e.message : e}`);
      }
    }

    const slug = slugify(title || idea.titleSeed);

    // Persistir Content
    const jsonLd = this.buildJsonLd({
      title: title || idea.titleSeed,
      excerpt,
      authorName: site.authorName,
      siteName: site.name,
      contentTypeSlug: idea.contentType.slug,
    });

    const content = await this.prisma.content.create({
      data: {
        ideaId: idea.id,
        siteId: idea.siteId,
        contentTypeId: idea.contentTypeId,
        locale: idea.locale,
        title: title || idea.titleSeed,
        slug,
        bodyMd: body,
        excerpt,
        metaDescription,
        ogImageId: imageAssetId,
        jsonLd: jsonLd as object,
        status: ContentStatus.EXPANDED,
        version: 1,
        createdBy: params.userId ?? null,
      },
    });

    // Associar tags e categoria
    for (const name of [...new Set(tagNames)]) {
      const tagSlug = slugify(name);
      const tag = await this.prisma.tag.upsert({
        where: { siteId_slug: { siteId: site.id, slug: tagSlug } },
        update: {},
        create: { siteId: site.id, slug: tagSlug, name },
      });
      await this.prisma.contentTag
        .create({ data: { contentId: content.id, tagId: tag.id } })
        .catch(() => {});
    }
    if (categoryName) {
      const catSlug = slugify(categoryName);
      const cat = await this.prisma.category.upsert({
        where: { siteId_slug: { siteId: site.id, slug: catSlug } },
        update: {},
        create: { siteId: site.id, slug: catSlug, name: categoryName },
      });
      await this.prisma.contentCategory
        .create({ data: { contentId: content.id, categoryId: cat.id } })
        .catch(() => {});
    }

    // Snapshot inicial
    await this.snapshot(content.id, 1, params.userId);

    // Atualizar status da idéia
    await this.prisma.idea.update({
      where: { id: idea.id },
      data: { status: IdeaStatus.EXPANDED },
    });

    return this.prisma.content.findUniqueOrThrow({
      where: { id: content.id },
      include: {
        ogImage: true,
        contentType: { select: { slug: true, name: true } },
        tags: { include: { tag: true } },
        categories: { include: { category: true } },
      },
    });
  }

  async regenerateField(
    contentId: string,
    field: PromptField,
    opts?: { variables?: Record<string, unknown>; preview?: boolean; userId?: string },
  ): Promise<{ field: PromptField; value: string }> {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      include: { contentType: true },
    });
    if (!content) throw new NotFoundException('Content not found');
    const site = await this.prisma.site.findUnique({ where: { id: content.siteId } });
    if (!site) throw new NotFoundException('Site not found');

    const fakeIdea = {
      id: content.ideaId ?? '',
      siteId: content.siteId,
      contentTypeId: content.contentTypeId,
      titleSeed: content.title || '',
      briefing: '',
      keywords: [],
      locale: content.locale,
    } as unknown as Idea;

    const vars = {
      title: content.title,
      briefing: '',
      keywords: [] as string[],
      body: content.bodyMd.slice(0, 1500),
      locale: content.locale,
      site: { name: site.name, toneOfVoice: site.toneOfVoice, authorName: site.authorName },
      ...(opts?.variables ?? {}),
    };

    const value = await this.runField(field, site, fakeIdea, vars);
    if (opts?.preview) return { field, value: value.trim() };

    // persistir
    const data: Record<string, unknown> = {};
    if (field === PromptField.TITLE) {
      data.title = value.trim();
      data.slug = slugify(value);
    } else if (field === PromptField.BODY) data.bodyMd = value;
    else if (field === PromptField.EXCERPT) data.excerpt = value.trim();
    else if (field === PromptField.META_DESCRIPTION) data.metaDescription = value.trim();
    else if (field === PromptField.TAGS) {
      // substitui tags
      await this.prisma.contentTag.deleteMany({ where: { contentId } });
      const names = value
        .split(/[,;]/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean);
      for (const name of names) {
        const tagSlug = slugify(name);
        const tag = await this.prisma.tag.upsert({
          where: { siteId_slug: { siteId: site.id, slug: tagSlug } },
          update: {},
          create: { siteId: site.id, slug: tagSlug, name },
        });
        await this.prisma.contentTag
          .create({ data: { contentId, tagId: tag.id } })
          .catch(() => {});
      }
    }

    if (Object.keys(data).length > 0) {
      data.version = { increment: 1 };
      await this.prisma.content.update({ where: { id: contentId }, data });
      const updated = await this.prisma.content.findUniqueOrThrow({ where: { id: contentId } });
      await this.snapshot(contentId, updated.version, opts?.userId);
    }
    return { field, value: value.trim() };
  }

  async generateCover(contentId: string, opts?: { prompt?: string; model?: string; userId?: string }) {
    const content = await this.prisma.content.findUnique({ where: { id: contentId } });
    if (!content) throw new NotFoundException('Content not found');
    const site = await this.prisma.site.findUnique({ where: { id: content.siteId } });
    if (!site) throw new NotFoundException('Site not found');

    let prompt = opts?.prompt;
    if (!prompt) {
      prompt = (
        await this.runField(PromptField.IMAGE_PROMPT, site, null, {
          title: content.title,
          keywords: [],
        })
      ).trim();
    }

    const { asset } = await this.imageGen.generateAndStore({
      prompt,
      siteId: site.id,
      contentId,
      model: opts?.model,
      alt: content.title,
    });

    await this.prisma.content.update({
      where: { id: contentId },
      data: { ogImageId: asset.id, version: { increment: 1 } },
    });
    const updated = await this.prisma.content.findUniqueOrThrow({ where: { id: contentId } });
    await this.snapshot(contentId, updated.version, opts?.userId);
    return asset;
  }

  // ----- helpers -----

  private async runField(
    field: PromptField,
    site: Site,
    _idea: Idea | null,
    variables: Record<string, unknown>,
  ): Promise<string> {
    // 1) buscar template salvo
    const tpl = await this.prisma.promptTemplate.findFirst({
      where: {
        siteId: site.id,
        field,
        active: true,
      },
      orderBy: [{ contentTypeId: 'desc' }],
    });
    const fallback = DEFAULT_FIELD_PROMPTS[field];
    if (!tpl && !fallback) throw new Error(`No prompt for field ${field}`);

    const cfg = tpl
      ? { system: tpl.systemPrompt, user: tpl.userPrompt, temperature: tpl.temperature, model: tpl.model, maxTokens: tpl.maxTokens }
      : { system: fallback!.system, user: fallback!.user, temperature: fallback!.temperature, model: DEFAULT_TEXT_MODEL, maxTokens: undefined };

    const result = await this.ai.runChat({
      model: cfg.model,
      systemPrompt: cfg.system,
      userPrompt: cfg.user,
      variables,
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens ?? undefined,
      siteId: site.id,
      promptTemplateId: tpl?.id,
    });
    return result.text;
  }

  private buildJsonLd(p: {
    title: string;
    excerpt: string;
    authorName: string;
    siteName: string;
    contentTypeSlug: string;
  }) {
    const type = p.contentTypeSlug === 'noticia' ? 'NewsArticle' : 'BlogPosting';
    return {
      '@context': 'https://schema.org',
      '@type': type,
      headline: p.title,
      description: p.excerpt,
      author: { '@type': 'Organization', name: p.authorName },
      publisher: { '@type': 'Organization', name: p.siteName },
      datePublished: new Date().toISOString(),
    };
  }

  private async snapshot(contentId: string, version: number, userId?: string) {
    const c = await this.prisma.content.findUnique({
      where: { id: contentId },
      include: { tags: { include: { tag: true } }, categories: { include: { category: true } } },
    });
    if (!c) return;
    await this.prisma.contentVersion
      .create({
        data: {
          contentId,
          version,
          createdBy: userId ?? null,
          snapshot: {
            title: c.title,
            slug: c.slug,
            bodyMd: c.bodyMd,
            excerpt: c.excerpt,
            metaDescription: c.metaDescription,
            ogImageId: c.ogImageId,
            jsonLd: c.jsonLd,
            status: c.status,
            tags: c.tags.map((t) => t.tag.name),
            categories: c.categories.map((ca) => ca.category.name),
          } as object,
        },
      })
      .catch(() => undefined);
  }
}
