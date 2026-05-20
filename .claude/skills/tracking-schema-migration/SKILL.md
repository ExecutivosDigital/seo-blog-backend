---
name: tracking-schema-migration
description: >-
  Cria ou altera tabelas tracking_* no schema Prisma do seo-blog-backend e gera a migration.
  Use quando o usuário pedir para "adicionar coluna/tabela de tracking", "migration de tracking",
  alterar os modelos tracking_sessions/tracking_events/tracking_attribution/tracking_leads/
  tracking_consent_log, ou adicionar campos de tracking ao modelo Site. Garante multi-tenant,
  índices e rollback seguro.
---

# Migration do schema de tracking

Tabelas `tracking_*` são consumidas por LPs já deployadas. Mudança de schema mal feita quebra ingestão em produção. Esta skill garante migration segura.

## Leia primeiro

- `docs/tracking/ARQUITETURA-TRACKING.md` §2 — o schema Prisma proposto (modelos, colunas, índices, `@map`).
- `docs/tracking/LICOES-LPS-EXISTENTES.md` — AP1 (tabela por LP), AP6 (sem siteId/anonymousId), AP8 (sem índice/agregação).
- `docs/tracking/PONTOS-ATENCAO-TRACKING.md` — R1 (volume), R9 (mexer no `Site`).

## Convenções do schema (obrigatórias)

- `snake_case` no banco via `@map`; camelCase no TS. Tabela via `@@map`.
- PK `String @id @default(uuid()) @db.Uuid`.
- **`siteId` em toda tabela `tracking_*`** com FK para `Site` e `onDelete: Cascade` (D9/AP1).
- Timestamps `createdAt`/`updatedAt` com `@map`.
- Índices: toda coluna usada em `WHERE`/`GROUP BY` do dashboard precisa de índice. Mínimo: `(siteId, <campo>, occurredAt)`.

## Regras de mudança segura

1. **Aditivo > destrutivo.** Adicionar coluna nullable ou com default é seguro. Remover/renomear coluna quebra LPs antigas que ainda enviam o campo — evite; se inevitável, faça em 2 etapas (deprecate → remover depois).
2. **Coluna nova obrigatória:** dê `@default(...)` para não quebrar linhas existentes.
3. **Mexeu no `Site`** (ex.: `publicKey`, `trackingEnabled`): `publicKey` com default `gen_random_uuid()`; `trackingEnabled` default `false` (opt-in explícito — R9).
4. **Índice em tabela grande:** considere `CREATE INDEX CONCURRENTLY` se a tabela já tem volume (Prisma não gera isso por padrão — pode precisar editar o SQL da migration à mão).
5. **Nunca** crie tabela com sufixo de LP/página (`tracking_events_health`, etc.) — isso é o AP1 que estamos corrigindo.

## Passos

1. Edite `prisma/schema.prisma` seguindo `ARQUITETURA-TRACKING.md §2`.
2. Gere a migration: `npx prisma migrate dev --name <descritivo>` (dev) — revise o SQL gerado.
3. **Revise o SQL** antes de aplicar em prod: a operação trava tabela? precisa de `CONCURRENTLY`? há backfill?
4. Escreva o **plano de rollback** (qual migration reverter, há perda de dado?).
5. Atualize os DTOs (class-validator) afetados (use a skill `tracking-endpoint`).
6. Entrada em `docs/tracking/CHANGELOG-TRACKING.md` (`Changed`, com o plano de rollback resumido).

## Edge cases

- **Particionamento** (R1): quando `tracking_events` crescer, particionar por mês. Prisma não gerencia partição nativamente — vai exigir SQL manual na migration. Planeje antes do volume doer.
- **Rollups mensais** (`tracking_events_monthly`, Fase 6): tabela de agregação, alimentada por job — não é `tracking_*` de ingestão, regras diferentes.
- **Dado de teste/seed:** atualize `prisma/seed.ts` se a mudança afeta o seed.

## NÃO faça

- ❌ Tabela por LP (AP1).
- ❌ Tabela `tracking_*` sem `siteId` (AP6).
- ❌ Coluna nova obrigatória sem default em tabela com dados.
- ❌ Aplicar migration em prod sem revisar o SQL e ter rollback.
