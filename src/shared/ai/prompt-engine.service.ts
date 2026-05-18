import { Injectable, Logger } from '@nestjs/common';

/**
 * Aliases PT → canonical EN. Quem escrever prompts em português e usar
 * `{{titulo}}` por engano não fica com variável não resolvida (que vira
 * string vazia e descarta o contexto).
 */
const VARIABLE_ALIASES: Record<string, string> = {
  titulo: 'title',
  'título': 'title',
  tema: 'title',
  resumo: 'briefing',
  descricao: 'briefing',
  'descrição': 'briefing',
  'palavras-chave': 'keywords',
  palavraschave: 'keywords',
  palavraChave: 'keywords',
  idioma: 'locale',
  corpo: 'body',
};

/**
 * Interpola variáveis no padrão {{nome}} a partir de um objeto.
 * Não executa código; apenas substitui strings simples.
 */
@Injectable()
export class PromptEngineService {
  private readonly logger = new Logger(PromptEngineService.name);

  interpolate(template: string, variables: Record<string, unknown>): string {
    const unresolved: string[] = [];
    const result = template.replace(/\{\{\s*([\w.\-]+)\s*\}\}/g, (_, key: string) => {
      const value = this.resolveWithAliases(variables, key);
      if (value === undefined || value === null) {
        unresolved.push(key);
        return '';
      }
      if (Array.isArray(value)) return value.join(', ');
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    });
    if (unresolved.length > 0) {
      this.logger.warn(
        `Unresolved variables in prompt template: ${[...new Set(unresolved)].join(', ')}. Available: ${Object.keys(variables).join(', ')}.`,
      );
    }
    return result;
  }

  private resolveWithAliases(obj: Record<string, unknown>, path: string): unknown {
    const direct = this.resolvePath(obj, path);
    if (direct !== undefined) return direct;
    // tenta alias em path simples (sem ponto)
    if (!path.includes('.')) {
      const alias = VARIABLE_ALIASES[path] ?? VARIABLE_ALIASES[path.toLowerCase()];
      if (alias) return this.resolvePath(obj, alias);
    }
    return undefined;
  }

  /** Extrai todas as variáveis usadas em um template. */
  extractVariables(template: string): string[] {
    const set = new Set<string>();
    const re = /\{\{\s*([\w.]+)\s*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(template))) set.add(m[1]);
    return [...set];
  }

  private resolvePath(obj: Record<string, unknown>, path: string): unknown {
    return path
      .split('.')
      .reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), obj);
  }
}
