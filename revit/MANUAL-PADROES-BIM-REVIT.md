# KMZERO ARQUITETURA — MANUAL DE PADRÕES BIM/REVIT

**Código do documento:** KMZ-ARQ-BIM-001
**Revisão:** **Rev.00 — WORKING STANDARD (EM DESENVOLVIMENTO)**
**Data de emissão:** Setembro 2026
**Status:** Versão de trabalho oficial — não é versão final
**Responsável técnico:** Eng. Kleber Vieira Martins — CREA-ES
**Escopo:** Arquitetura, interiores e documentação BIM da KMZERO

---

## ⚠️ INSTRUÇÃO OPERACIONAL — LEIA ANTES DE EDITAR

> **Este manual está EM DESENVOLVIMENTO. Não tratar Rev.00 como versão final.**
>
> Preservar os padrões classificados como **APROVADOS**. Desenvolver os itens
> **EM DESENVOLVIMENTO** sem substituir silenciosamente decisões existentes.
> Registrar toda evolução proposta e manter histórico de revisões.
>
> O objetivo é transformar progressivamente este padrão conceitual em elementos
> reais do Revit: famílias, tipos, materiais, parâmetros compartilhados,
> View Templates, filtros, tabelas, tags, anotações, carimbos e templates `.RTE`.

### Regras de edição (valem para qualquer pessoa ou agente que mexer aqui)

1. **Nunca rebaixe um item `APROVADO` sem uma revisão numerada.** Mudou algo aprovado?
   Abre `Rev.NN` em [`CONTROLE-DE-REVISOES.md`](./CONTROLE-DE-REVISOES.md) e justifica.
2. **Nunca promova a `APROVADO` um dado extraído de imagem.** Ver seção de referências visuais.
3. **Módulo novo não reescreve o manual.** Entra como revisão incremental
   (ex.: `Rev.01 — Novo módulo Forros`), com arquivo próprio e entrada no controle de revisões.
4. **Todo número tem procedência.** Ou cita norma, ou cita medição, ou é marcado `A VALIDAR`.
5. **Conflito entre fontes é registrado, não resolvido em silêncio.** Ver §1.3.

### Legenda de status (usada em todo o manual)

| Marcador | Significado |
|---|---|
| `APROVADO` | Decisão firmada. Só muda por revisão numerada. |
| `EM DESENVOLVIMENTO` | Direção definida, detalhamento pendente. Pode evoluir livremente. |
| `A VALIDAR` | Valor provisório, sem procedência confirmada. **Não usar em projeto executivo.** |
| `CONFLITO` | Fontes divergem. Bloqueado até decisão do responsável técnico. |

---

## 0. Como este padrão se organiza

| # | Módulo | Arquivo | Status |
|---|---|---|---|
| 01 | Identidade KMZERO | [`01-identidade.md`](./01-identidade.md) | `EM DESENVOLVIMENTO` |
| 02 | Documentação, folhas e carimbos | [`02-documentacao-e-folhas.md`](./02-documentacao-e-folhas.md) | `EM DESENVOLVIMENTO` |
| 03 | Anotações Revit | [`03-anotacoes-revit.md`](./03-anotacoes-revit.md) | `EM DESENVOLVIMENTO` |
| 04 | Representação arquitetônica | [`04-representacao-arquitetonica.md`](./04-representacao-arquitetonica.md) | `EM DESENVOLVIMENTO` |
| 05 | Biblioteca L1 / L2 / L3 | [`05-biblioteca-L1-L2-L3.md`](./05-biblioteca-L1-L2-L3.md) | `APROVADO` (conceito) |
| 06 | Componentes arquitetônicos | [`06-componentes-arquitetonicos.md`](./06-componentes-arquitetonicos.md) | `EM DESENVOLVIMENTO` |
| 07 | KMZERO Ambientes | [`07-ambientes/`](./07-ambientes/) | 5 de ~16 iniciados |
| 08 | Nomenclatura BIM | [`08-nomenclatura-bim.md`](./08-nomenclatura-bim.md) | `EM DESENVOLVIMENTO` |
| 09 | Parâmetros compartilhados | [`09-parametros/`](./09-parametros/) | `EM DESENVOLVIMENTO` — arquivo `.txt` já utilizável |
| 10 | Especificação do template `.RTE` | [`10-template-rte/`](./10-template-rte/) | `EM DESENVOLVIMENTO` |
| 11 | Automação (Dynamo / pyRevit) | [`11-automacao/`](./11-automacao/) | `EM DESENVOLVIMENTO` — **não testado** |

---

## 1. Fundamentos

### 1.1 O que a KMZERO está construindo

Uma **biblioteca inteligente para projetos reais**: ambientes completos, modulares e
parametrizados, entregues como famílias Revit com dados de projeto, orçamento e
documentação embutidos — não como blocos decorativos soltos.

A promessa comercial da marca é: **menos imprevisto, mais controle, mais lucro.**
Isso tem consequência técnica direta: **toda família KMZERO precisa carregar dado
quantificável**, senão a promessa não se sustenta. Ver §09 (parâmetros).

### 1.2 Os três níveis de entrega visual — `APROVADO`

| Nível | Nome | O que é | Onde aparece |
|---|---|---|---|
| 1 | **CATÁLOGO** | Objeto isolado, fundo neutro, alta qualidade | Bloco 01 das pranchas de ambiente |
| 2 | **CONTEXTO** | Aplicado no ambiente, uso real, escala correta | Bloco 02 |
| 3 | **PREMIUM** | Ambiente completo, iluminação real, materiais nobres, atmosfera realista | Imagem-herói da prancha |

### 1.3 Identidade cromática — `CONFLITO` ⛔

Três fontes internas divergem sobre a cor da marca. **Bloqueado até decisão do
responsável técnico.** Enquanto não houver decisão, use a coluna "Adotado Rev.00".

| Fonte | Escuro | Dourado | Procedência |
|---|---|---|---|
| Referências visuais aprovadas (5 pranchas) | `#00101A` | `#EF9D1C` | **Medido** — média ponderada de pixels das faixas gráficas superior/inferior das 5 imagens |
| App KMZERO — `src/theme.js` | `#052F3D` | `#FFB830` | Código em produção |
| Skill `kmzero-documentos` | `#14253F` | `#C9A227` | **Declarado no próprio arquivo como placeholder "A CONFIRMAR"** |

**Leitura técnica:** imagens e app concordam na *família* de cor — azul-petróleo (teal,
com componente verde) + âmbar quente. A skill `kmzero-documentos` usa azul-marinho puro
+ dourado-oliva: **outra família**. A skill é a fonte errada e precisa ser corrigida.

**Adotado Rev.00** (provisório, ver `01-identidade.md`): escala de petróleo com
`#00101A` para grandes áreas e `#052F3D` para blocos, dourado `#EF9D1C`.

**Pendência aberta:** corrigir os hex da skill `kmzero-documentos` após a decisão.

---

## 2. REFERÊNCIAS VISUAIS — regra de uso

Todas as imagens em [`assets/referencias/`](./assets/referencias/) carregam esta
identificação, **sem exceção**:

> **REFERÊNCIA VISUAL APROVADA — CONCEITO**
>
> A linguagem gráfica, composição e direção estética são referências KMZERO.
> Textos, números, CNPJ, registros, dimensões ou outros dados ilustrativos
> eventualmente gerados na imagem **não constituem dados técnicos aprovados**.

### O que é aprovado e o que não é

| ✅ Aprovado na imagem | ❌ Não aprovado na imagem |
|---|---|
| Paleta e hierarquia cromática | Qualquer cota (0,90 / 1,20 / 2,10 …) |
| Composição da prancha e grid de 12 blocos | Áreas de layout (2–4 m², 6–10 m² …) |
| Direção estética e nível de acabamento | Códigos de família (KMZ-BAN-001 …) |
| Tipo de conteúdo de cada bloco | Espessuras (vidro 8 mm …) |
| Ordem de leitura | Nomes de material e fabricante |

Toda cota transcrita de imagem entra no manual marcada `A VALIDAR` e **não pode ir para
projeto executivo** sem checagem contra norma ou medição real. Ver
[`assets/referencias/LEGENDA.md`](./assets/referencias/LEGENDA.md).

---

## 3. Matriz oficial de ambiente — `APROVADO`

Todo ambiente KMZERO é desenvolvido na mesma sequência de 13 etapas:

```
Famílias → L1/L2/L3 → Dimensões → Posicionamento → Ergonomia → Materiais →
Marcenaria → Iluminação → Decoração → Kits → BIM/Revit → Documentação → Renderização
```

Detalhamento e template em [`07-ambientes/_MATRIZ-OFICIAL.md`](./07-ambientes/_MATRIZ-OFICIAL.md).

---

## 4. Rastreabilidade

- Histórico completo: [`CONTROLE-DE-REVISOES.md`](./CONTROLE-DE-REVISOES.md)
- Toda revisão registra: número, data, módulo afetado, o que mudou, quem decidiu.
- Módulos previstos para próximas revisões: Forros, Fachadas, Paisagismo,
  Áreas comuns, Instalações aparentes.

---

*KMZERO Arquitetura — Do zero ao extraordinário.*
