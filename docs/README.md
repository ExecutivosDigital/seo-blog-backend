# Documentação — Sistema de Publicação SEO Multi-Site

Esta pasta contém os **documentos vivos** do projeto. Toda decisão, mudança de rumo ou bloqueio deve ser refletido aqui.

## Documentos

| Arquivo | Função | Quando atualizar |
|---|---|---|
| [`PLANO.md`](./PLANO.md) | Plano geral, arquitetura, fases fragmentadas, componentes back/front | Ao concluir um item (marcar `[x]`); ao desviar do plano |
| [`CHANGELOG.md`](./CHANGELOG.md) | Histórico cronológico de entregas, decisões e mudanças de rumo | A cada entrega/decisão significativa |
| [`PONTOS-ATENCAO.md`](./PONTOS-ATENCAO.md) | Riscos, bloqueadores, dúvidas em aberto | A cada nova dúvida; ao resolver, mover para "Resolvidos" |

## Regra de ouro

> Se você (ou a IA assistente) tomou uma decisão técnica, fez um trade-off, descobriu um risco, ou concluiu uma etapa: **atualize o documento correspondente antes de seguir**.
> O código é a verdade do "o quê"; estes documentos são a verdade do "por quê" e do "para onde".

## Estrutura do workspace

```
seo-blog/
├── docs/                       ← você está aqui
├── seo-blog-backend/           ← NestJS + Prisma + BullMQ
├── seo-blog-frontend/          ← Next.js (admin) + shadcn/ui
├── health-voice/               ← LPs existentes (consumidoras da API)
└── sistema-publicacao-blog-seo.md  ← briefing original do chefe
```
