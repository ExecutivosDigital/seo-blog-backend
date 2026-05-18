import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { EnvService } from '../env/env.service';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd?: number;
  raw: unknown;
}

@Injectable()
export class OpenRouterClient {
  private http: AxiosInstance;

  constructor(private envService: EnvService) {
    this.http = axios.create({
      baseURL: this.envService.get('OPEN_ROUTER_BASE_URL'),
      timeout: 120_000,
      headers: {
        Authorization: `Bearer ${this.envService.get('OPEN_ROUTER_KEY')}`,
        'HTTP-Referer': 'https://seoblog.local',
        'X-Title': 'SEO Blog Admin',
        'Content-Type': 'application/json',
      },
    });
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const body: Record<string, unknown> = {
      model: req.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
    };
    if (req.maxTokens) body.max_tokens = req.maxTokens;

    try {
      const res = await this.http.post('/chat/completions', body);
      const data = res.data;
      const choice = data?.choices?.[0];
      const content: string = choice?.message?.content ?? '';
      const usage = data?.usage ?? {};
      return {
        text: content,
        inputTokens: usage.prompt_tokens ?? 0,
        outputTokens: usage.completion_tokens ?? 0,
        totalCostUsd: typeof usage.cost === 'number' ? usage.cost : undefined,
        raw: data,
      };
    } catch (err: any) {
      const detail = err?.response?.data ?? err?.message ?? String(err);
      throw new InternalServerErrorException(
        `OpenRouter error: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`,
      );
    }
  }
}
