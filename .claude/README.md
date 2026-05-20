# `.claude/` — seo-blog-backend

Skills e agents que dão suporte à **iniciativa de Hub de Tracking de LPs**. A documentação viva da iniciativa fica em `../docs/tracking/` (raiz do monorepo `seo-blog`).

## Skills (`skills/`)

Invocadas automaticamente quando a tarefa do usuário casa com a `description`, ou explicitamente via `/<nome>`.

| Skill | Para quê |
|---|---|
| `tracking-endpoint` | Criar/alterar endpoint público de ingestão de tracking (idempotência, rate-limit, multi-tenant) |
| `tracking-schema-migration` | Criar/alterar tabelas `tracking_*` no Prisma + migration segura |
| `analytics-query` | Criar agregação de analytics e expor via endpoint privado `/admin/analytics` |

## Agents (`agents/`)

Subagentes especializados, invocados via Task.

| Agent | Para quê |
|---|---|
| `tracking-pipeline-reviewer` | Revisa mudanças no módulo `tracking` (ingestão/schema/agregação) — read-only |

## Princípio

Estas skills/agents **não substituem** os documentos vivos de `docs/tracking/` — elas apontam para eles. Se a arquitetura mudar, o doc muda primeiro; a skill só descreve o procedimento. Veja `docs/tracking/README.md`.

> O módulo `metrics` existente (`src/modules/metrics/`) mede a **operação do CMS** (ideias, conteúdos, custo de IA, publish jobs). O módulo `tracking` a ser criado mede o **comportamento de usuários nas LPs**. São coisas distintas — não os confunda.
