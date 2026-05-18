import { Injectable, NotFoundException } from '@nestjs/common';
import { PromptField } from '@prisma/client';
import { PrismaService } from '@/shared/database/prisma/prisma.service';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';

@Injectable()
export class PromptsService {
  constructor(private prisma: PrismaService) {}

  list(filters: { siteId?: string; field?: PromptField; contentTypeId?: string }) {
    return this.prisma.promptTemplate.findMany({
      where: {
        ...(filters.siteId ? { siteId: filters.siteId } : {}),
        ...(filters.field ? { field: filters.field } : {}),
        ...(filters.contentTypeId !== undefined
          ? { contentTypeId: filters.contentTypeId === 'null' ? null : filters.contentTypeId }
          : {}),
      },
      orderBy: [{ field: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async get(id: string) {
    const p = await this.prisma.promptTemplate.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Prompt template not found');
    return p;
  }

  create(dto: CreatePromptDto) {
    return this.prisma.promptTemplate.create({
      data: {
        siteId: dto.siteId,
        contentTypeId: dto.contentTypeId ?? null,
        field: dto.field,
        locale: dto.locale ?? 'pt-BR',
        model: dto.model,
        systemPrompt: dto.systemPrompt ?? '',
        userPrompt: dto.userPrompt,
        temperature: dto.temperature ?? 0.7,
        maxTokens: dto.maxTokens ?? null,
        active: dto.active ?? true,
      },
    });
  }

  update(id: string, dto: UpdatePromptDto) {
    return this.prisma.promptTemplate.update({
      where: { id },
      data: { ...dto, contentTypeId: dto.contentTypeId ?? undefined },
    });
  }

  remove(id: string) {
    return this.prisma.promptTemplate.delete({ where: { id } });
  }
}
