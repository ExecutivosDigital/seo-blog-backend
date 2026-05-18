import { Injectable } from '@nestjs/common';

/**
 * Interpola variáveis no padrão {{nome}} a partir de um objeto.
 * Não executa código; apenas substitui strings simples.
 */
@Injectable()
export class PromptEngineService {
  interpolate(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
      const value = this.resolvePath(variables, key);
      if (value === undefined || value === null) return '';
      if (Array.isArray(value)) return value.join(', ');
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    });
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
