import { createHash } from 'crypto';
import { Request } from 'express';

/**
 * Utilitários do hub de tracking. Regras de privacidade: IP cru nunca é
 * persistido — só `sha256(ip + salt)`. Ver docs/tracking/ARQUITETURA-TRACKING.md.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Extrai o IP do cliente, respeitando proxies (X-Forwarded-For). */
export function extractIp(req: Request): string | undefined {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? undefined;
}

/** Hash pseudonimizado do IP. Retorna undefined se não há IP. */
export function hashIp(ip: string | undefined, salt: string): string | undefined {
  if (!ip) return undefined;
  return createHash('sha256').update(`${ip}|${salt}`).digest('hex');
}

/** Hash de deduplicação de lead — janela curta evita lead duplicado por replay. */
export function leadDedupeHash(
  siteId: string,
  email: string | undefined,
  phone: string | undefined,
): string {
  return createHash('sha256')
    .update(`${siteId}|${(email ?? '').toLowerCase().trim()}|${(phone ?? '').trim()}`)
    .digest('hex');
}

/** Classifica o dispositivo a partir do User-Agent. Heurística simples. */
export function detectDeviceType(
  ua: string | undefined,
): 'mobile' | 'tablet' | 'desktop' | undefined {
  if (!ua) return undefined;
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(s)) return 'tablet';
  if (/mobile|iphone|ipod|android.*mobile|windows phone/.test(s)) return 'mobile';
  return 'desktop';
}

/** Heurística de bot — não é à prova de tudo, exclui o ruído óbvio. */
export function detectBot(ua: string | undefined): boolean {
  if (!ua) return true; // sem UA é quase sempre bot/script
  return /bot|crawler|spider|crawling|headless|lighthouse|pagespeed|gtmetrix|preview|monitor|curl|wget|python-requests|axios\//i.test(
    ua,
  );
}

/** Contexto da requisição usado pelo TrackingService. */
export interface RequestContext {
  ip: string | undefined;
  userAgent: string | undefined;
}

export function requestContext(req: Request): RequestContext {
  return {
    ip: extractIp(req),
    userAgent: req.headers['user-agent'],
  };
}
