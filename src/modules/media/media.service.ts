import { BadRequestException, Inject, Injectable, NotFoundException, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma/prisma.service';
import { ImageGenerationService } from '@/shared/ai/image-generation.service';
import { IStorage, STORAGE_TOKEN } from '@/shared/storage/storage.interface';
import { CreateMediaDto, GenerateMediaDto, UploadMediaDto } from './dto/create-media.dto';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

@Injectable()
export class MediaService {
  constructor(
    private prisma: PrismaService,
    private imageGen: ImageGenerationService,
    @Inject(STORAGE_TOKEN) private storage: IStorage,
  ) {}

  list(params: { siteId?: string; page?: number; pageSize?: number }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 60;
    return this.prisma.mediaAsset.findMany({
      where: params.siteId ? { siteId: params.siteId } : {},
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async get(id: string) {
    const m = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Media not found');
    return m;
  }

  create(dto: CreateMediaDto, userId?: string) {
    return this.prisma.mediaAsset.create({
      data: {
        siteId: dto.siteId,
        url: dto.url,
        alt: dto.alt ?? '',
        source: 'EXTERNAL',
        createdBy: userId ?? null,
      },
    });
  }

  async uploadBase64(dto: UploadMediaDto, userId?: string) {
    const dataIdx = dto.base64.indexOf(',');
    const b64 = dataIdx > 0 ? dto.base64.slice(dataIdx + 1) : dto.base64;
    if (!/^[A-Za-z0-9+/=]+$/.test(b64.slice(0, 100))) {
      throw new BadRequestException('invalid base64 payload');
    }
    const body = Buffer.from(b64, 'base64');

    if (body.length === 0) {
      throw new BadRequestException('empty upload');
    }
    if (body.length > MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException(
        `upload too large (${(body.length / 1024 / 1024).toFixed(1)}MB > 5MB)`,
      );
    }

    const mime =
      dto.mimeType ??
      (dto.base64.startsWith('data:') ? dto.base64.slice(5, dto.base64.indexOf(';')) : 'image/png');

    if (!ALLOWED_MIME.has(mime.toLowerCase())) {
      throw new UnsupportedMediaTypeException(`mime not allowed: ${mime}`);
    }

    const upload = await this.storage.upload({
      fileName: dto.fileName,
      fileType: mime,
      body,
    });

    return this.prisma.mediaAsset.create({
      data: {
        siteId: dto.siteId,
        url: upload.url,
        storageKey: upload.key,
        alt: dto.alt ?? '',
        mimeType: mime,
        sizeBytes: body.length,
        source: 'UPLOAD',
        createdBy: userId ?? null,
      },
    });
  }

  async generate(dto: GenerateMediaDto) {
    const { asset } = await this.imageGen.generateAndStore({
      prompt: dto.prompt,
      siteId: dto.siteId,
      contentId: dto.contentId,
      model: dto.model,
      alt: dto.alt,
    });
    return asset;
  }

  remove(id: string) {
    return this.prisma.mediaAsset.delete({ where: { id } });
  }
}
