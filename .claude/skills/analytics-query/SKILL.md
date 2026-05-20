---
name: analytics-query
description: >-
  Cria uma agregação/consulta de analytics e expõe via endpoint privado /admin/analytics
  no seo-blog-backend, para o dashboard consumir. Use quando o usuário pedir um "endpoint de
  analytics", "agregação de tracking", "dados para o dashboard", métricas de funil/atribuição/
  conversão/série temporal, ou export CSV de leads/eventos. Garante agregação no banco e multi-tenant.
---

# Criar agregação de analytics (endpoint privado)

O dashboard só funciona se o backend entrega dado **já agregado**. As LPs antigas falharam por mandar log cru pro browser agregar (anti-padrão AP4). Esta skill faz a agregação no lugar certo: o Postgres.

## Leia primeiro

- `docs/tracking/ARQUITETURA-TRACKING.md` §3.2 (endpoints privados), §7 (princípios de visualização).
- `docs/tracking/LICOES-LPS-EXISTENTES.md` — AP3, AP4, AP8.
- `seo-blog-backend/src/modules/metrics/metrics.service.ts` — **referência de estilo**: agrega com Prisma `aggregate`/`groupBy` e `$queryRaw` para `date_trunc`. Siga esse padrão.

## Princípios

1. **Agregue no banco.** `GROUP BY`, `date_trunc`, `COUNT(*) FILTER (WHERE ...)`, `aggregate`. O endpoint devolve o resultado pronto pra plotar — não devolve linhas cruas para o front somar.
2. **Multi-tenant.** Todo endpoint aceita `siteId` (ou `all` para admin). Filtro de `siteId` entra em todo `WHERE`. Respeite o `siteAccess`/role do usuário.
3. **Comparação.** Quando a métrica é "número do período", calcule também o período anterior — o dashboard precisa do ▲▼ %.
4. **Janela default 30 dias**, parametrizável (`days`).
5. **Performance.** Toda query depende de índice (ver skill `tracking-schema-migration`). Query de agregação 30d deve responder <500ms; acima disso, considere cache Redis de 1 min (D5) ou rollup.

## Padrões do módulo

- Endpoint privado: controller sob `/admin/analytics`, protegido pelo `AuthGuard`/JWT global (não é `@IsPublic`).
- `AnalyticsService` (separado do `tracking.service.ts` de ingestão — leitura e escrita não se misturam).
- Tipo de retorno compartilhável com o front (considere um pacote de tipos ou espelhar a interface).

## Passos

1. Defina a pergunta de negócio e o shape do retorno.
2. Escreva o método no `AnalyticsService`: Prisma `groupBy`/`aggregate` quando der; `$queryRaw` tipado para `date_trunc`/séries temporais (como em `metrics.service.ts`).
3. Exponha no controller `/admin/analytics/<nome>` com query params (`siteId`, `days`, paginação).
4. Para export: endpoint `.csv` que faz `findMany` com `take` limitado e monta o CSV (ver `metrics.service.ts:aiCostCsv` como referência).
5. Tabelas cruas (drill-down): **pagine server-side** (`skip`/`take`) — nunca devolva tudo.
6. Teste: retorno correto com `siteId` específico e com `all`; janela de datas; vazio (site sem dados).
7. Entrada em `docs/tracking/CHANGELOG-TRACKING.md`.

## Endpoints previstos (Fase 4) — não duplicar

`overview`, `funnel`, `attribution`, `leads`, `timeseries`, `leads.csv`. Cheque se o pedido já é um desses antes de criar.

## Edge cases

- **`bigint` do Postgres** em `$queryRaw`: converta para `Number()` antes de retornar (JSON não serializa `bigint`) — ver `metrics.service.ts`.
- **Bots** (DP6): exclua sessões marcadas como bot por default nas agregações.
- **Fuso horário:** `date_trunc('day', ...)` usa o TZ do banco — alinhe com o esperado pelo dashboard (pt-BR) ou normalize.
- **Site sem dados:** retorne estrutura vazia coerente (zeros), não erro — o front tem empty state.

## NÃO faça

- ❌ Endpoint que devolve `findMany` de todos os eventos para o front agregar (AP4).
- ❌ Esquecer o filtro de `siteId` (vaza dado entre tenants).
- ❌ Tabela crua sem paginação (AP3/AP4).
- ❌ Número sem o período anterior quando o dashboard precisa de comparação.
