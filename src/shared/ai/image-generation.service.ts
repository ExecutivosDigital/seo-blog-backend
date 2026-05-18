import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import { AiUsageKind } from '@prisma/client';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { EnvService } from '../env/env.service';
import { STORAGE_TOKEN, IStorage } from '../storage/storage.interface';

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
  model: string;
  costCents: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  raw: unknown;
}

@Injectable()
export class ImageGenerationService {
  constructor(
    private readonly env: EnvService,
    private readonly prisma: PrismaService,
    @Inject(STORAGE_TOKEN) private readonly storage: IStorage,
  ) {}

  /**
   * Gera uma imagem via OpenRouter (chat/completions com modalidade image).
   * Para FLUX/Seedream/etc usamos a mesma rota; cada modelo retorna a imagem
   * embutida no `message.content` como image_url (data URI) ou base64.
   */
  async generate(params: {
    prompt: string;
    model?: string;
    siteId?: string;
    contentId?: string;
  }): Promise<GeneratedImage> {
    const model = params.model ?? this.env.get('DEFAULT_IMAGE_MODEL');
    const t0 = Date.now();
    let res: any;
    try {
      res = await axios.post(
        `${this.env.get('OPEN_ROUTER_BASE_URL')}/chat/completions`,
        {
          model,
          messages: [{ role: 'user', content: params.prompt }],
          modalities: ['image', 'text'],
        },
        {
          headers: {
            Authorization: `Bearer ${this.env.get('OPEN_ROUTER_KEY')}`,
            'HTTP-Referer': 'https://seoblog.local',
            'X-Title': 'SEO Blog Admin',
            'Content-Type': 'application/json',
          },
          timeout: 180_000,
        },
      );
    } catch (err: any) {
      const detail = err?.response?.data ?? err?.message ?? String(err);
      throw new InternalServerErrorException(
        `OpenRouter image error: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`,
      );
    }

    const durationMs = Date.now() - t0;
    const data = res.data;
    const msg = data?.choices?.[0]?.message;
    const usage = data?.usage ?? {};

    // Procura uma imagem (data URI ou URL) nas várias formas que OpenRouter retorna
    const image = this.extractImage(msg);
    if (!image) {
      throw new InternalServerErrorException(
        `Model ${model} did not return an image. Response: ${JSON.stringify(data).slice(0, 300)}`,
      );
    }

    const buffer = await this.fetchOrDecode(image.urlOrData);
    const mimeType = image.mimeType ?? 'image/png';
    const costCents = typeof usage.cost === 'number' ? Math.round(usage.cost * 100) : 0;

    return {
      buffer,
      mimeType,
      model,
      costCents,
      durationMs,
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
      raw: data,
    };
  }

  private extractImage(message: any): { urlOrData: string; mimeType?: string } | null {
    if (!message) return null;
    // formato 1: message.images = [{ type: 'image_url', image_url: { url: 'data:...' } }]
    if (Array.isArray(message.images) && message.images.length > 0) {
      const first = message.images[0];
      const url = first?.image_url?.url ?? first?.url;
      if (typeof url === 'string') return { urlOrData: url, mimeType: this.mimeFromDataUri(url) };
    }
    // formato 2: message.content = array com items image_url
    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === 'image_url' && part.image_url?.url) {
          return { urlOrData: part.image_url.url, mimeType: this.mimeFromDataUri(part.image_url.url) };
        }
        if (part.type === 'output_image' && part.image) {
          return { urlOrData: `data:${part.mime_type ?? 'image/png'};base64,${part.image}` };
        }
      }
    }
    // formato 3: message.content string com data URI dentro de markdown
    if (typeof message.content === 'string') {
      const m = message.content.match(/data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=]+/);
      if (m) return { urlOrData: m[0], mimeType: this.mimeFromDataUri(m[0]) };
    }
    return null;
  }

  private mimeFromDataUri(s: string): string | undefined {
    const m = s.match(/^data:([\w.+/-]+);/);
    return m ? m[1] : undefined;
  }

  private async fetchOrDecode(urlOrData: string): Promise<Buffer> {
    if (urlOrData.startsWith('data:')) {
      const idx = urlOrData.indexOf(',');
      const b64 = urlOrData.slice(idx + 1);
      return Buffer.from(b64, 'base64');
    }
    const r = await axios.get(urlOrData, { responseType: 'arraybuffer', timeout: 60_000 });
    return Buffer.from(r.data);
  }

  async generateAndStore(params: {
    prompt: string;
    siteId: string;
    contentId?: string;
    model?: string;
    alt?: string;
  }) {
    const t0 = Date.now();
    const img = await this.generate({
      prompt: params.prompt,
      model: params.model,
      siteId: params.siteId,
      contentId: params.contentId,
    });
    const ext = img.mimeType.split('/')[1] ?? 'png';
    const upload = await this.storage.upload({
      fileName: `cover-${Date.now()}.${ext}`,
      fileType: img.mimeType,
      body: img.buffer,
    });

    const asset = await this.prisma.mediaAsset.create({
      data: {
        siteId: params.siteId,
        url: upload.url,
        storageKey: upload.key,
        alt: params.alt ?? '',
        mimeType: img.mimeType,
        sizeBytes: img.buffer.length,
        source: 'AI',
        generationPrompt: params.prompt,
        model: img.model,
        costCents: img.costCents,
      },
    });

    await this.prisma.aiUsageLog.create({
      data: {
        siteId: params.siteId,
        contentId: params.contentId ?? null,
        kind: AiUsageKind.IMAGE,
        model: img.model,
        inputTokens: img.inputTokens,
        outputTokens: img.outputTokens,
        costCents: img.costCents,
        cached: false,
        durationMs: Date.now() - t0,
        meta: {},
      },
    });

    return { asset, image: img };
  }
}
