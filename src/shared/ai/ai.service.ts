import { Injectable, Logger } from '@nestjs/common';
import { AiUsageKind } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../database/prisma/prisma.service';
import { OpenRouterClient } from './openrouter.client';
import { PromptEngineService } from './prompt-engine.service';
import { estimateCostCents } from './model-pricing';

export interface RunChatParams {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  variables?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  siteId?: string;
  promptTemplateId?: string;
  contentId?: string;
  useCache?: boolean;
}

export interface RunChatResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  cached: boolean;
  durationMs: number;
  model: string;
  resolvedSystemPrompt: string;
  resolvedUserPrompt: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  // cache in-memory simples (Redis fica para v1.1)
  private cache = new Map<string, { result: RunChatResult; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000;

  constructor(
    private readonly client: OpenRouterClient,
    private readonly engine: PromptEngineService,
    private readonly prisma: PrismaService,
  ) {}

  async runChat(params: RunChatParams): Promise<RunChatResult> {
    const resolvedSystemPrompt = this.engine.interpolate(params.systemPrompt, params.variables ?? {});
    const resolvedUserPrompt = this.engine.interpolate(params.userPrompt, params.variables ?? {});

    const cacheKey = this.cacheKey({
      model: params.model,
      systemPrompt: resolvedSystemPrompt,
      userPrompt: resolvedUserPrompt,
      temperature: params.temperature ?? 0.7,
    });

    if (params.useCache !== false) {
      const hit = this.cache.get(cacheKey);
      if (hit && hit.expiresAt > Date.now()) {
        const result: RunChatResult = { ...hit.result, cached: true };
        await this.logUsage(result, params);
        return result;
      }
    }

    const t0 = Date.now();
    const res = await this.client.chat({
      model: params.model,
      messages: [
        ...(resolvedSystemPrompt ? [{ role: 'system' as const, content: resolvedSystemPrompt }] : []),
        { role: 'user' as const, content: resolvedUserPrompt },
      ],
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });
    const durationMs = Date.now() - t0;

    const costCents =
      typeof res.totalCostUsd === 'number'
        ? Math.round(res.totalCostUsd * 100)
        : estimateCostCents(params.model, res.inputTokens, res.outputTokens);

    const result: RunChatResult = {
      text: res.text,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      costCents,
      cached: false,
      durationMs,
      model: params.model,
      resolvedSystemPrompt,
      resolvedUserPrompt,
    };

    this.cache.set(cacheKey, { result, expiresAt: Date.now() + this.CACHE_TTL_MS });
    await this.logUsage(result, params);
    return result;
  }

  private async logUsage(result: RunChatResult, params: RunChatParams) {
    try {
      await this.prisma.aiUsageLog.create({
        data: {
          siteId: params.siteId ?? null,
          promptTemplateId: params.promptTemplateId ?? null,
          contentId: params.contentId ?? null,
          kind: AiUsageKind.TEXT,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costCents: result.cached ? 0 : result.costCents,
          cached: result.cached,
          durationMs: result.durationMs,
          meta: {},
        },
      });
    } catch (e) {
      this.logger.warn(`failed to log ai usage: ${e instanceof Error ? e.message : e}`);
    }
  }

  private cacheKey(parts: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    temperature: number;
  }): string {
    const h = createHash('sha256');
    h.update(parts.model);
    h.update('|');
    h.update(parts.systemPrompt);
    h.update('|');
    h.update(parts.userPrompt);
    h.update('|');
    h.update(String(parts.temperature));
    return h.digest('hex');
  }
}
