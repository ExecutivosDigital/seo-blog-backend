/**
 * Tabela estática de preço por modelo OpenRouter (USD por 1M tokens).
 * Usada quando a resposta não traz `usage.total_cost`.
 * Atualizar conforme a OpenRouter mudar preços.
 */
export interface ModelPrice {
  inputPerMTokens: number;  // USD por 1M tokens de input
  outputPerMTokens: number; // USD por 1M tokens de output
}

export const MODEL_PRICING: Record<string, ModelPrice> = {
  // Anthropic
  'anthropic/claude-sonnet-4': { inputPerMTokens: 3, outputPerMTokens: 15 },
  'anthropic/claude-sonnet-4.5': { inputPerMTokens: 3, outputPerMTokens: 15 },
  'anthropic/claude-haiku-4.5': { inputPerMTokens: 1, outputPerMTokens: 5 },
  'anthropic/claude-opus-4': { inputPerMTokens: 15, outputPerMTokens: 75 },

  // Google
  'google/gemini-2.5-flash': { inputPerMTokens: 0.3, outputPerMTokens: 2.5 },
  'google/gemini-2.5-pro': { inputPerMTokens: 1.25, outputPerMTokens: 10 },
  'google/gemini-3.1-flash-image-preview': { inputPerMTokens: 0.5, outputPerMTokens: 3 },

  // OpenAI
  'openai/gpt-5': { inputPerMTokens: 10, outputPerMTokens: 10 },
  'openai/gpt-5-mini': { inputPerMTokens: 0.25, outputPerMTokens: 2 },
  'openai/gpt-4o': { inputPerMTokens: 2.5, outputPerMTokens: 10 },
  'openai/gpt-4o-mini': { inputPerMTokens: 0.15, outputPerMTokens: 0.6 },

  // Imagem (cost flat por imagem, modelado aparte na Fase 4)
  'black-forest-labs/flux-2-klein-4b': { inputPerMTokens: 0, outputPerMTokens: 0 },
};

export const DEFAULT_TEXT_MODEL = 'anthropic/claude-sonnet-4.5';
export const FALLBACK_PRICING: ModelPrice = { inputPerMTokens: 1, outputPerMTokens: 4 };

export function estimateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICING[model] ?? FALLBACK_PRICING;
  const usd =
    (inputTokens / 1_000_000) * p.inputPerMTokens +
    (outputTokens / 1_000_000) * p.outputPerMTokens;
  return Math.round(usd * 100);
}

export const TEXT_MODEL_OPTIONS = [
  'anthropic/claude-sonnet-4.5',
  'anthropic/claude-haiku-4.5',
  'google/gemini-2.5-pro',
  'google/gemini-2.5-flash',
  'openai/gpt-5-mini',
  'openai/gpt-4o',
] as const;
