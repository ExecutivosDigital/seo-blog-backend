# seo-blog-backend

API NestJS do sistema de publicação SEO multi-site. Padrão `health-voice-api`.

> Documentos vivos: [`docs/PLANO.md`](./docs/PLANO.md), [`docs/CHANGELOG.md`](./docs/CHANGELOG.md), [`docs/PONTOS-ATENCAO.md`](./docs/PONTOS-ATENCAO.md), [`docs/RUNBOOK.md`](./docs/RUNBOOK.md), [`docs/TESTE-VALIDACAO.md`](./docs/TESTE-VALIDACAO.md).

## Stack

- **NestJS 10** modular — `src/modules/<dominio>/` + `src/shared/<infra>/`
- **Prisma 6** + **Postgres 16** (self-hosted: Docker em dev, VPS em prod)
- **BullMQ + Redis 7** — agendamento delayed + worker de publicação
- **OpenRouter** — text via `chat/completions` + imagem (Gemini 2.5 Flash Image default; FLUX/Seedream configurável)
- **Cloudflare R2** via `@aws-sdk/client-s3` (`STORAGE_DRIVER=r2`) ou `LocalDisk` em dev
- **JWT custom** (`@nestjs/jwt` + `bcryptjs`) + roles ADMIN/EDITOR/REVISOR + `@nestjs/throttler` em `/auth` e `/ai`

## Setup local

```bash
docker compose up -d                # Postgres + Redis
npm install
cp .env.example .env                # ajustar OPEN_ROUTER_KEY
npx prisma migrate dev
npm run db:seed                     # admin@seoblog.local / 123456
npm run start:dev                   # localhost:3333
```

| URL | Função |
|---|---|
| http://localhost:3333 | API |
| http://localhost:3333/health | Healthcheck (público) |
| http://localhost:3333/reference | Docs Scalar (todas as rotas) |
| http://localhost:3333/api | Swagger UI |
| http://localhost:3333/public/:siteSlug/contents | Endpoint para as LPs |

## Estrutura

```
src/
├── modules/                # domínios
│   ├── admin-users/        # CRUD operadores (Fase 1)
│   ├── content-types/      # tipos por site (Fase 1)
│   ├── contents/           # CRUD + state machine + expansion pipeline (Fase 4-5-9)
│   ├── health/             # /health
│   ├── ideas/              # importação em lote (Fase 2)
│   ├── media/              # upload/IA + hardening mime+size (Fase 4)
│   ├── metrics/            # /metrics/overview, /ai-cost, /publish-stats, CSV (Fase 11)
│   ├── prompts/            # PromptTemplate CRUD (Fase 3)
│   ├── public/             # rotas públicas consumidas pelas LPs (Fase 8)
│   ├── publish/            # worker BullMQ + retry + IndexNow (Fase 7)
│   ├── schedule/           # agendamento + bulk + reschedule (Fase 6)
│   └── sites/              # tenant CRUD (Fase 1)
├── shared/                 # infra transversal (padrão health-voice-api)
│   ├── ai/                 # OpenRouterClient + AiService + ImageGenerationService + cache + pricing
│   ├── auth/               # JwtModule + AuthGuard + AdminGuard + state-machine roles
│   ├── database/prisma/    # PrismaService
│   ├── decorators/         # @IsPublic, @RequiresSecurityToken, @IsAdmin, @CurrentUser, @CurrentUserId
│   ├── env/                # EnvService tipado com zod
│   ├── filters/            # AllExceptionsFilter
│   ├── queue/              # BullMQ root
│   ├── storage/            # R2 + LocalDisk (STORAGE_DRIVER switcher)
│   ├── tenant/             # @CurrentSiteId (X-Site-Id header)
│   └── throttler/          # rate limit global
└── main.ts
```

## Variáveis principais

Ver `.env.example` para a lista completa. Críticas:
- `DATABASE_URL` — Postgres
- `REDIS_HOST` / `REDIS_PORT` — BullMQ
- `JWT_SECRET` — min 16 chars
- `OPEN_ROUTER_KEY` — `sk-or-v1-...`
- `DEFAULT_IMAGE_MODEL` — `google/gemini-2.5-flash-image`
- `STORAGE_DRIVER=r2|local` + credenciais Cloudflare se R2
- `SECURITY_TOKEN` — opcional, para rotas server-to-server (`@RequiresSecurityToken`)

## Migrations

```bash
npx prisma migrate dev --name <descrição>
npm run db:seed
```

Histórico: 4 migrations (Fases 1, 2, 3, 4, 6). Schema final em `prisma/schema.prisma`.

## Testes

E2E pendente para v1.1. Smoke tests manuais (curl/node) em `C:/Users/Victor/AppData/Local/Temp/smoke-*.mjs` cobriram cada fase ponta-a-ponta.

## Status

✅ Fases 0–12 concluídas. Pronto para deploy em VPS (Fase 12 deixou docs/runbook).
