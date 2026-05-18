# Checklist de Validação — v1

> Roteiro manual para validar o sistema ponta-a-ponta. Marque `[x]` conforme valida.
> Tempo estimado: **45–60 minutos**. Custo de IA estimado: **~US$ 0,15**.

---

## 0. Pré-requisitos `[ ]`

- [x] Docker Desktop rodando.
- [x] Portas livres: **3000** (admin), **3001** (LP), **3333** (API), **5432** (Postgres), **6379** (Redis).
- [x] Você tem a chave do OpenRouter em `seo-blog-backend/.env` (`OPEN_ROUTER_KEY=sk-or-v1-...`).

### 0.1 Subir tudo

```bash
# Em 3 terminais separados:

# Terminal 1 — Postgres + Redis
cd seo-blog-backend
docker compose up -d
# verificar: docker ps deve mostrar 2 containers "healthy"

# Terminal 2 — Backend
cd seo-blog-backend
npm install      # se ainda não instalou
npx prisma migrate dev   # aplica migrations
npm run db:seed          # cria admin@seoblog.local / 123456 + Health Voice
npm run start:dev
# esperar log "running on http://localhost:3333"

# Terminal 3 — Frontend admin
cd seo-blog-frontend
npm install
npm run dev
# esperar "Ready in ..."

# Terminal 4 (opcional, para testar a LP)
cd health-voice/health-voice-institutional-v2
git checkout feat/seo-blog-integration
cp .env.local.example .env.local   # se ainda não tem
npm install
npm run dev
# vai pegar a porta 3001
```

**Validar:**
- [x] `curl http://localhost:3333/health` retorna `{"status":"ok","services":{"db":"up"}}`.
- [x] http://localhost:3000 carrega.
- [x] http://localhost:3001 carrega (LP, opcional).

---

## 1. Auth + Navegação `[ ]`

- [x] Acessar http://localhost:3000 → redireciona para `/login`.
- [x] Login com `admin@seoblog.local` / `123456` → redireciona para `/dashboard`.
- [x] **Dashboard** mostra cards zerados/baixos (nenhum conteúdo ainda).
- [x] Sidebar tem 11 itens: Dashboard, Ideias, Conteúdos, Revisão, Calendário, Publicações, Prompts, Custos IA, Sites, Tipos de Conteúdo, Usuários.
- [?] **SiteSwitcher** no topbar mostra "Health Voice".
- [x] Logout → volta pra `/login`.
- [x] Login com senha errada → mensagem de erro, **não** muda página.

*Anotações:* Eu realizei o primeiro login e estava tudo zerado, e também sem o site switcher no header; ao atualizar a página, o seletor apareceu com Health Voice selecionado e alguns dados preenchidos dos testes automatizados realizados acredito.

### 1.1 Rate limit no login

- [x] Tente fazer login com senha errada **6 vezes seguidas** rapidamente.
- [x] **6ª tentativa retorna erro 429 (Too Many Requests)**. Esperar 1min libera.

---

## 2. Sites & Configurações `[ ]`

### 2.1 Listar
- [x] `/sites` mostra "Health Voice" com 2 content types.
- [x] `/content-types` mostra `Blog` (/blog) e `Notícia` (/noticias) ativos.

### 2.2 Criar
- [x] `/sites` → "Novo site" → preencher um teste (slug `teste-cms`, nome qualquer) → criar.
- [x] Aparece na lista. **SiteSwitcher** mostra opção do novo site.
- [x] Trocar para o site teste no switcher → `/content-types` fica vazio.
- [x] Voltar para Health Voice e **deletar** o site teste.

### 2.3 Usuários
- [x] `/users` lista 1 admin.
- [x] Criar um usuário EDITOR (email qualquer, senha 6 chars).
- [x] Logout, login como o novo EDITOR. `/users` **não aparece** na sidebar.
- [x] Voltar a logar como admin e deletar o EDITOR.

---

## 3. Ideias — Importação `[ ]`

Navegar para `/ideias` (Health Voice no SiteSwitcher).

### 3.1 Bulk import (4 formatos)

Clicar **"Importar em lote"**.

**Aba "Colar (1/linha)"** — colar:
```
Sintomas iniciais de diabetes tipo 2
Prevenção de AVC após os 50
Hipertensão arterial em idosos
```
- [x] Selecionar Content Type = Blog.
- [x] Pré-visualizar → tabela com 3 linhas editáveis.
- [x] Importar → alerta "3 ideias importadas".
- [x] Lista atualiza, todas com status **PENDING**.

**Aba CSV** — colar:
```
title,briefing,keywords
"Glicemia em jejum","O que é e como medir","glicemia;jejum;diabetes"
"Colesterol LDL alto","Quando tratar","ldl;colesterol;cardiologia"
```
- [x] Pré-visualizar → 2 linhas com keywords parseadas.
- [x] Importar → 2 ideias novas.

**Aba JSON** — colar:
```json
[
  { "titleSeed": "Insônia em pacientes idosos", "briefing": "Causas e tratamento", "keywords": ["sono","idosos"] }
]
```
- [x] Importar → 1 ideia nova.

**Aba Markdown** — colar:
```
- Saúde mental no consultório
* Burnout em médicos
1. Telemedicina pós-pandemia
```
- [x] Importar → 3 ideias.

*Anotações:* A tabela de pré-visualização está muito pequena, os inputs de título só mostram 2 caracteres.

**Total esperado: 9 ideias PENDING.**

### 3.2 Bulk actions
- [x] Selecionar 2 ideias via checkbox → ações em massa aparecem.
- [x] "Mudar status" → DISCARDED → 2 ideias agora DISCARDED. Filtrar por status confirma.
- [x] Apagar bulk de 1 ideia funciona.

### 3.3 Filtros e busca
- [x] Filtro status = PENDING mostra só pendentes.
- [x] Buscar "diabetes" filtra por título/briefing/keyword.

---

## 4. Prompts & Playground `[ ]` ⚠️ ESSE COBRA

### 4.1 Listar
- [?] `/prompts` → vazia (Health Voice ainda sem prompts customizados — a IA usa defaults da casa).

*Anotações:* Já possui um prompt para o campo "Título" com `google/gemini-2.5-flash`.

### 4.2 Criar um prompt
- [x] Clicar "Novo prompt":
  - Tipo: qualquer / Campo: TITLE / Modelo: `google/gemini-2.5-flash` / temp 0.5
  - System: "Você gera títulos curtos em pt-BR. SEM aspas."
  - User: `Tema: {{title}}\nKeywords: {{keywords}}\nGere 1 título de até 60 caracteres.`
- [x] Salva. Aparece na tabela.

### 4.3 Playground (⚠️ **1 chamada paga — ~US$ 0,0001**)
- [x] Clicar ▶ no prompt.
- [x] Dialog detecta variáveis `title` e `keywords`, gera campos.
- [x] Preencher: title = "Pressão alta em idosos", keywords = "hipertensão, idosos".
- [x] Aviso amarelo de custo aparece.
- [x] Clicar **Rodar** → resposta em <5s.
- [x] Aparece: texto gerado, tokens in/out, custo, tempo.
- [x] Clicar **Rodar de novo** → aparece "HIT" no badge de cache, custo 0.

### 4.4 Custos
- [?] `/custos` mostra 1 chamada registrada.
- [x] Gráfico por dia mostra uma barra.
- [x] Botão **Download CSV** baixa `ai-cost-30d.csv` com 1+ linhas.

*Anotações:* Várias chamadas dos testes automatizados imagino.

---

## 5. Expansão (Pipeline IA) `[ ]` ⚠️ **CUSTA ~US$ 0,10**

Na página `/ideias`:

- [x] Escolher uma ideia PENDING (ex.: "Hipertensão arterial em idosos").
- [x] Clicar ⚡ (Sparkles). Aparece alerta de confirmação com **estimativa de custo**.
- [x] Confirmar. Espera ~60–90s.
- [x] Redireciona automaticamente para `/conteudos/<id>` (editor).

**Validar no editor:**
- [ ] **Aba Conteúdo:** título reescrito, slug em kebab-case sem stopwords, corpo Markdown com >800 palavras (contador embaixo do textarea), botões "Regerar" por campo.
- [ ] **Aba SEO + Preview:** meta description, excerpt, JSON-LD válido. Cards de preview Google/OG/Twitter renderizam.
- [ ] **Aba Mídia:** capa PNG gerada (1MP, ~$0.04). Botão "Gerar via IA" pode regenerar.
- [ ] **Aba Links Internos:** vazio agora (precisa de outros posts pra calcular).
- [ ] **Aba Histórico:** 1 versão (v1) registrada. Mudou: `title, slug, bodyMd, …`.
- [ ] Status do conteúdo = **EXPANDED**.

*Anotações:* Vou parar aqui, pois criou-se um conteúdo com o título "Tema: Como criar um siteKeywords: site, criar, fazer, web, internet, onlineCrie seu site: Guia completo para iniciantes".

### 5.1 Regerar campo individual
- [ ] Clicar "Regerar" no campo Meta Description.
- [ ] Aparece nova meta. Versão incrementa para v2 no Histórico.
- [ ] **VersionDiff:** ir na aba Histórico, selecionar v1 → v2 — só mostra mudança em `metaDescription`.

**Voltar para `/ideias`** — a ideia agora aparece como EXPANDED.

---

## 6. Workflow de Revisão `[ ]`

### 6.1 Fila de revisão
- [ ] `/revisao` mostra o conteúdo expandido com badge EXPANDED.
- [ ] Clicar **Aprovar**. Status muda para APPROVED. Card desaparece.

### 6.2 Transições inválidas (testar via UI)
- [ ] Abrir `/conteudos/<id>`.
- [ ] No dropdown "Mover status" tentar voltar para EXPANDED → erro 400 ("Invalid transition").
- [ ] Tentar ir direto para PUBLISHED → funciona (ADMIN tem permissão).

### 6.3 Despublicar
- [ ] Mover status para UNPUBLISHED.
- [ ] Acessar `http://localhost:3333/public/health-voice/contents/<slug>` → **410 Gone**.
- [ ] Voltar para PUBLISHED via dropdown (UNPUBLISHED → PUBLISHED é permitido só para ADMIN).
- [ ] Endpoint volta a retornar 200.

---

## 7. Agendamento `[ ]`

Pré-requisito: ter ≥1 conteúdo em status **APPROVED** (volte um pra APPROVED se todos estão PUBLISHED).

### 7.1 Single schedule
- [ ] No editor de um APPROVED, mover status → "Mover para SCHEDULED" não é manual; use o calendário.
- [ ] Atalho: usar `POST /schedule` via Scalar (http://localhost:3333/reference) ou esperar o teste 7.2.

### 7.2 Bulk schedule
- [ ] `/calendario` → botão **"Agendar em lote"**.
- [ ] Painel: selecionar o conteúdo APPROVED disponível, data inicial = hoje, hora 09:00, modo DAILY, skip weekends.
- [ ] Pré-visualização mostra a(s) data(s).
- [ ] Confirmar → "1 agendado".
- [ ] No calendário, ponto amarelo aparece na data marcada (status PENDING).
- [ ] Lista embaixo mostra o job com status **PENDING**.

### 7.3 Reagendar e cancelar
- [ ] Clicar no ícone de reagendar (ExternalLink) → prompt aceita data ISO; mudar para amanhã.
- [ ] Confirmar → data atualiza no calendário.
- [ ] Clicar 🗑 → cancelar. Status muda para **CANCELLED**.
- [ ] O conteúdo correspondente voltou para APPROVED (verificar em `/conteudos`).

---

## 8. Worker de Publicação `[ ]`

### 8.1 Publish-now (manual, instantâneo)
- [ ] No editor de um conteúdo APPROVED, clicar **"Publicar agora"**.
- [ ] Alert "Publicação enfileirada".
- [ ] Aguardar ~3s. Recarregar o editor → status = **PUBLISHED**, `publishedAt` preenchido.
- [ ] `/publicacoes` mostra job SUCCEEDED com attempts=1.

### 8.2 Schedule com delay curto (worker BullMQ)
Pré-requisito: ter outro conteúdo APPROVED.
- [ ] `/calendario` → agendar em lote, data = hoje, hora = **3 minutos no futuro** (formato HH:MM).
- [ ] Aguardar 3 minutos. Atualizar `/conteudos` → status mudou para PUBLISHED automaticamente.
- [ ] `/publicacoes` mostra novo job SUCCEEDED.

### 8.3 Retry
- [ ] (Difícil simular falha real) Se houver job FAILED na lista, botão **Retry** aparece e reenfileira.

---

## 9. API Pública (consumida pelas LPs) `[ ]`

Sem token (rotas `@IsPublic`):

- [ ] `curl http://localhost:3333/public/health-voice/contents` → JSON com array de posts PUBLISHED.
- [ ] `curl http://localhost:3333/public/health-voice/contents/<slug>` → detalhe do post.
- [ ] `curl http://localhost:3333/public/health-voice/contents/abc-nao-existe` → **404**.
- [ ] `curl http://localhost:3333/public/abc-xyz/contents` (site inexistente) → **404**.
- [ ] `curl http://localhost:3333/public/health-voice/sitemap.xml` → XML válido com `<urlset>` e `<xhtml:link hreflang>`.
- [ ] `curl http://localhost:3333/public/health-voice/rss.xml` → RSS 2.0 com items e pubDate.
- [ ] `curl http://localhost:3333/public/health-voice/robots.txt` → texto plano com `Sitemap:`.
- [ ] Despublicar um post (`UNPUBLISHED`) → o `GET /contents/:slug` agora retorna **410 Gone**.

---

## 10. LP Integrada — health-voice-institutional-v2 `[ ]`

**Pré-requisito:** LP rodando em http://localhost:3001 (terminal 4 do setup).

### 10.1 Blog na LP
- [ ] `http://localhost:3001/blog` → grade com os posts publicados.
- [ ] Cards mostram capa, categoria, título, meta, data.
- [ ] Paginação aparece se >12 posts.
- [ ] Clicar num card → `/blog/<slug>` carrega:
  - [ ] Hero com título grande
  - [ ] Capa
  - [ ] Corpo markdown renderizado (H2/H3, listas, parágrafos, código)
  - [ ] Tags + categoria no fim
  - [ ] Seção "Posts relacionados" (se houver)
- [ ] Ver source da página (Ctrl+U):
  - [ ] `<title>` correto
  - [ ] `<meta name="description">` correto
  - [ ] `<meta property="og:title">`, `og:image` etc.
  - [ ] `<script type="application/ld+json">` com BlogPosting

### 10.2 Sitemap + RSS na LP
- [ ] `http://localhost:3001/sitemap.xml` → inclui URLs estáticas + entradas `/blog/*`.
- [ ] `http://localhost:3001/rss.xml` → RSS proxy do backend (200).

### 10.3 Webhook de revalidate (ponta-a-ponta)
- [ ] No painel admin, abrir `/sites` → editar Health Voice → setar:
  - **Revalidate URL** = `http://localhost:3001/api/revalidate`
  - **Revalidate Secret** = `change-me-must-match-cms`
- [ ] Em qualquer conteúdo APPROVED, clicar "Publicar agora".
- [ ] No terminal da LP, ver log de `POST /api/revalidate 200`.
- [ ] Recarregar `http://localhost:3001/blog/<novo-slug>` → aparece sem ter que esperar 1h de ISR.

### 10.4 Webhook secret errado
- [ ] No site, mudar o secret para algo diferente. Publicar de novo.
- [ ] Backend tenta chamar a LP → recebe 401, log de warning. **Publicação no DB acontece mesmo assim**.
- [ ] Voltar o secret correto.

---

## 11. Dashboard & Métricas `[ ]`

Voltar para `/dashboard`:

- [ ] **Cards principais** atualizados:
  - Ideias pendentes (depende do que sobrou)
  - Aguardando revisão (deve ser 0 se você aprovou tudo)
  - Agendados próximos 7 dias
  - Publicados últimos 30 dias = pelo menos 1
- [ ] **Custo IA hoje** > 0 (você gastou na expansão).
- [ ] **Success rate** = 100% (todos os jobs OK).
- [ ] **Pipeline:** DRAFT 0 / EXPANDED 0 / APPROVED 0 / PUBLISHED ≥1.
- [ ] **Gráfico publicações por dia** mostra barra verde de hoje.
- [ ] Refetch a cada 30s.

### 11.1 CSV
- [ ] `/custos` → botão **CSV**.
- [ ] Baixa `ai-cost-30d.csv`. Abrir: header + linhas com timestamp, modelo, tokens, custo.

---

## 12. Linkagem Interna (Related Posts) `[ ]`

Pré-requisito: ter ≥2 posts PUBLISHED com tags compartilhadas.

- [ ] Abrir um post no editor → aba **Links Internos**.
- [ ] Mostra cards de relacionados com score, tags compartilhadas em badge.
- [ ] `curl http://localhost:3333/public/health-voice/contents/<slug>/related` retorna array com os mesmos.
- [ ] LP em `/blog/<slug>` mostra a seção "Posts relacionados" no fim.

---

## 13. Hardening — Limites `[ ]`

### 13.1 Rate limit /ai/preview
- [ ] No playground, clicar **Rodar** **31× em 1 minuto**.
- [ ] **32ª request retorna 429.** (Difícil exercitar manualmente; alternativa é o teste 1.1 que já cobre o padrão.)

### 13.2 Upload de imagem grande
- [ ] No backend `/media/upload` (via Scalar), tentar mandar uma imagem **>5MB** em base64.
- [ ] Resposta: **413 Payload Too Large**.

### 13.3 Upload com MIME proibido
- [ ] Mandar payload com `mimeType: "application/pdf"`.
- [ ] Resposta: **415 Unsupported Media Type**.

---

## 14. Smoke final — fluxo completo realista `[ ]`

Esse é o "happy path" como o operador faria diariamente:

1. [ ] Importar 5 ideias via Paste.
2. [ ] Expandir 1 delas (~US$ 0,10).
3. [ ] Editor: ajustar título manualmente, salvar (versão incrementa).
4. [ ] Ir em `/revisao` → Aprovar.
5. [ ] `/calendario` → agendar essa para 5 minutos no futuro.
6. [ ] Aguardar publicação automática (~5min).
7. [ ] Conferir em `/conteudos` que está PUBLISHED.
8. [ ] Acessar `http://localhost:3001/blog/<slug>` — post renderizado com SEO.
9. [ ] `/dashboard` mostra +1 publicado e custo refletido.

---

## Resumo de custos do checklist completo

| Onde gasta | Aprox |
|---|---|
| Playground (1 chamada) | ~$0,0001 |
| Expansão completa (Fase 5) | ~$0,10 |
| Regerar Meta Description | ~$0,005 |
| Regerar TAGS | ~$0,0001 |
| Tudo somado | **~US$ 0,15** |

---

## Se algo falhar

Consultar [`RUNBOOK.md`](./RUNBOOK.md) seção "Quando uma publicação falha" + grep nos logs:
```bash
# Backend
docker logs seoblog-postgres --tail 50
docker logs seoblog-redis --tail 50

# E os logs do `npm run start:dev` no terminal
```

Erros comuns:
- **EADDRINUSE** → outra coisa usando 3000/3001/3333. Matar processo (`PowerShell: (Get-NetTCPConnection -LocalPort 3333).OwningProcess`).
- **EPERM Prisma** → backend rodando segurando `query_engine.dll`. Stop → regenerate → start.
- **Supabase URL required na LP** → faltam dummies de Supabase no `.env.local` da LP.
- **`change-me-must-match-cms`** no secret → ajuste no painel **e** na `.env.local` da LP.
