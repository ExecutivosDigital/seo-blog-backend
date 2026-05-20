---
name: tracking-endpoint
description: >-
  Cria ou altera um endpoint público de ingestão de tracking no módulo tracking do
  seo-blog-backend (NestJS). Use quando o usuário pedir um endpoint para "receber eventos",
  "ingestão de tracking", "POST de sessão/evento/lead/consent", ou alterar a validação/
  idempotência/rate-limit da ingestão. Garante idempotência, dedup, rate-limit e multi-tenant.
---

# Criar/alterar endpoint de ingestão de tracking

Endpoints públicos do módulo `tracking` recebem dados de qualquer LP. São a porta de entrada do hub — precisam ser idempotentes, multi-tenant e resistentes a abuso.

## Leia primeiro

- `docs/tracking/ARQUITETURA-TRACKING.md` §3.1 (endpoints públicos), §2 (schema), §5 (decisões D1–D11).
- `docs/tracking/LICOES-LPS-EXISTENTES.md` — anti-padrões AP1, AP6, AP9, AP11.
- `docs/tracking/CATALOGO-EVENTOS.md` — eventos válidos para a validação.

## Padrões do módulo `tracking` (NestJS)

Estrutura existente: `src/modules/tracking/` com `tracking.module.ts`, `tracking.controller.ts` (público), `tracking.service.ts`, DTOs por recurso (`dto/ingest-session.dto.ts`, `ingest-event.dto.ts`, `ingest-lead.dto.ts`, `ingest-consent.dto.ts`), `guards/site-key.guard.ts`, `decorators/current-tracking-site.decorator.ts` e `tracking.util.ts`.

Convenções do projeto a seguir:
- Controller público marcado com `@IsPublic()` (`@/shared/decorators/IsPublic.decorator`) — o `AuthGuard` JWT global libera; a autorização real é o `SiteKeyGuard`.
- Prisma via `PrismaService` de `@/shared/database/prisma/prisma.service` (módulo `@Global`).
- **Validação de DTO com `class-validator`** + `@nestjs/swagger` — padrão do projeto (o `ValidationPipe` global aplica `whitelist`/`transform`). Zod no projeto é só para env.
- Rate-limit com `@nestjs/throttler` (`@Throttle` no controller; throttlers nomeados `short`/`medium`/`long`).
- `siteId` vem do `SiteKeyGuard` via `@CurrentTrackingSite()`.

## Requisitos obrigatórios de todo endpoint de ingestão

1. **`SiteKeyGuard`**: valida o header `X-Site-Key` contra `Site.publicKey`, popula `req.site`. Sem key válida → 401. Site com `trackingEnabled = false` → 403.
2. **CORS dinâmico**: a origin tem que bater com o `Site.domain` (allowlist). Ver DP3 em PONTOS-ATENCAO-TRACKING.md.
3. **Idempotência**:
   - Evento: upsert por `eventId` (uuid do client). Replay → 200, não insere de novo.
   - Lead: dedup por hash(`email+phone+siteId`) numa janela de ~5 min.
   - Sessão: upsert por `sessionId`.
4. **Rate-limit**: por `sessionId` e por `siteId` (`@Throttle`). Burst → 429.
5. **`Content-Type: text/plain`** deve ser aceito (necessário para `navigator.sendBeacon` sem preflight CORS — ver R3).
6. **IP**: nunca persista IP cru. Só `sha256(ip + TRACKING_IP_SALT)`.
7. **`siteId` em tudo** que for persistido (multi-tenant — D9/AP1).
8. **Validação de `properties`** por nome de evento (refinamento previsto — feito no `TrackingService`, modo `warn` por default, `strict` via env — R7). Na v1 o `properties` é objeto genérico.
9. **Sem PII em `properties`** — validador que rejeita strings tipo email/telefone fora dos campos esperados (R6/AP11).

## Passos

1. Defina o recurso (session/event/lead/consent) e cheque se já existe rota — não duplique.
2. DTO com class-validator, no shape de `ARQUITETURA-TRACKING.md §2` (espelhe os DTOs `ingest-*.dto.ts` existentes).
3. Método no `tracking.service.ts` com a lógica de upsert/dedup.
4. Rota no controller, pública, com `SiteKeyGuard` + `@Throttle`.
5. Testes e2e: caminho feliz; replay do mesmo `eventId` → 1 registro; rate-limit → 429; key inválida → 401; payload inválido → 400; CORS de origin não cadastrada → bloqueado.
6. Entrada em `docs/tracking/CHANGELOG-TRACKING.md`.

## Edge cases

- **Batch de eventos:** o endpoint `/tracking/event` aceita um array. Cada item dedup por seu `eventId`. Um item inválido não derruba o batch inteiro — responda com o status por item ou rejeite só o inválido (decida e documente).
- **Evento chega antes da sessão** (R10): o service faz upsert da sessão por valor de `sessionId` em ambos os endpoints; nunca dependa de ordem.
- **`sendBeacon` manda `text/plain`:** faça `JSON.parse` defensivo do body.

## NÃO faça

- ❌ Endpoint ou tabela por LP (AP1) — `siteId` diferencia.
- ❌ Aceitar evento sem `eventId` (quebra idempotência — D2).
- ❌ Persistir IP cru ou PII em evento (AP11).
- ❌ Endpoint público sem rate-limit (era a falha do Inova).
