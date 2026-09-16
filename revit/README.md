# KMZERO ARQUITETURA — Padrões BIM / Revit

**Working Standard `Rev.00`** · Documento `KMZ-ARQ-BIM-001`

> ⚠️ **Este manual está EM DESENVOLVIMENTO. Rev.00 não é versão final.**
> Preservar o que está `APROVADO`. Desenvolver o que está `EM DESENVOLVIMENTO` sem
> substituir silenciosamente decisões existentes. Registrar toda evolução e manter
> histórico de revisões.

**Comece por:** **[`MANUAL-PADROES-BIM-REVIT.md`](./MANUAL-PADROES-BIM-REVIT.md)**

---

## Objetivo

Transformar progressivamente o padrão conceitual KMZERO em elementos reais do Revit:
famílias, tipos, materiais, parâmetros compartilhados, View Templates, filtros, tabelas,
tags, anotações, carimbos e template `.RTE`.

## Estrutura

```
revit/
├── MANUAL-PADROES-BIM-REVIT.md      ← documento mestre, comece aqui
├── CONTROLE-DE-REVISOES.md          ← histórico + pendências abertas
│
├── 01-identidade.md                  Paleta, wordmark, tipografia, grid de prancha
├── 02-documentacao-e-folhas.md       Formatos, margens, dobra, carimbo
├── 03-anotacoes-revit.md             Tags, cotas, espessuras, texto, hachuras
├── 04-representacao-arquitetonica.md Plantas, cortes, elevações, materiais
├── 05-biblioteca-L1-L2-L3.md         Níveis Técnico / Projeto / Premium
├── 06-componentes-arquitetonicos.md  Esquadrias, telhado, escada, marcenaria, luz
├── 07-ambientes/                     Matriz oficial + 5 ambientes + backlog
├── 08-nomenclatura-bim.md            Arquivos, famílias, tipos, materiais, vistas
├── 09-parametros/                    ★ arquivo .txt utilizável no Revit hoje
├── 10-template-rte/                  Roteiro de montagem do .RTE
├── 11-automacao/                     pyRevit + Dynamo (não testado)
└── assets/referencias/               Referências visuais aprovadas
```

## Legenda de status

| Marcador | Significado |
|---|---|
| `APROVADO` | Decisão firmada. Só muda por revisão numerada. |
| `EM DESENVOLVIMENTO` | Direção definida, detalhamento pendente. |
| `A VALIDAR` | Valor provisório sem procedência. **Não usar em executivo.** |
| `CONFLITO` | Fontes divergem. Bloqueado até decisão do responsável técnico. |

## O que está pronto para uso hoje

| Item | Estado |
|---|---|
| [`09-parametros/KMZERO_SharedParameters.txt`](./09-parametros/KMZERO_SharedParameters.txt) | 32 parâmetros, 6 grupos, GUIDs definitivos — **carregável no Revit**, a conferir |
| [`08-nomenclatura-bim.md`](./08-nomenclatura-bim.md) | Convenção completa, aplicável já |
| [`10-template-rte/`](./10-template-rte/) | Roteiro de 14 etapas para montar o `.RTE` |
| [`07-ambientes/_MATRIZ-OFICIAL.md`](./07-ambientes/_MATRIZ-OFICIAL.md) | Matriz de 13 etapas — `APROVADO` |

## O que NÃO existe nesta revisão

Dito de forma direta, para não gerar expectativa errada:

- ❌ **Nenhum arquivo `.rte`, `.rfa` ou `.rvt`.** Formatos binários da Autodesk, gerados
  só pelo Revit. Este repositório guarda a **especificação**, não os binários —
  e o `.gitignore` bloqueia esses formatos de propósito.
- ❌ **Nenhuma família modelada.**
- ❌ **Nenhuma cota validada.** Todas as dimensões vieram de referência visual e estão
  `A VALIDAR`.
- ❌ **Nenhum script testado no Revit.**
- ❌ **Nenhuma norma verificada contra a fonte primária.**

## Bloqueantes

| # | Pendência | Bloqueia |
|---|---|---|
| **P-01** | Decidir os hex oficiais de marca (conflito em 3 fontes) | Carimbo, template, render |
| **P-05** | Definir a versão-alvo do Revit | `.RTE` e toda a automação |

Lista completa em [`CONTROLE-DE-REVISOES.md`](./CONTROLE-DE-REVISOES.md).

## Próximo passo recomendado

Fechar **um ambiente inteiro** nas 13 etapas da matriz antes de abrir o sexto — e antes
disso, **modelar a marcenaria transversal** ([`06-componentes-arquitetonicos.md`](./06-componentes-arquitetonicos.md) §6.5),
que é reaproveitada por Cozinha, Closet, Banheiro, Home Office e Gourmet de uma vez.

Ambiente sugerido para fechar primeiro: **Banheiro** — menor, mais repetitivo, melhor
laboratório para calibrar o método. Justificativa em
[`07-ambientes/_BACKLOG.md`](./07-ambientes/_BACKLOG.md).

---

*KMZERO Arquitetura — Do zero ao extraordinário.*
