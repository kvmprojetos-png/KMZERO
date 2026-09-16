# 10 — Especificação do Template KMZERO (`.RTE`)

Documento: KMZ-ARQ-BIM-001 · Módulo 10 · **Rev.00** · `EM DESENVOLVIMENTO`

---

## ⚠️ O que este documento é e o que não é

**É:** a especificação do que montar dentro do Revit para produzir
`KMZERO_ARQ_Rev00.rte` — uma lista de trabalho executável por quem tem o Revit aberto.

**Não é:** o arquivo `.rte`. O formato é binário e proprietário da Autodesk, gerado
exclusivamente pelo próprio Revit. Nenhuma ferramenta externa escreve um `.rte`.

**Onde o `.rte` vai morar:** **não neste repositório.** Binário no Git não tem *diff*
nem *merge*, e cada revisão duplica o arquivo inteiro no histórico. O template vive no
servidor de arquivos da KMZERO ou no BIM 360/ACC, com versionamento nativo. Aqui fica a
especificação e o histórico de decisões — que é o que realmente precisa ser versionado.

**Pendência bloqueante P-05:** a versão-alvo do Revit não está definida. Isso importa —
`.rte` não abre em versão anterior à que o criou, e a decisão trava a compatibilidade da
biblioteca inteira. **Defina antes de começar a montar.**

---

## Roteiro de montagem

Ordem recomendada. Cada bloco depende do anterior.

### Etapa 1 — Unidades e configuração base

| Item | Valor | Status |
|---|---|---|
| Comprimento | Milímetros, 0 casas decimais | `A VALIDAR` |
| Área | m², 2 casas | `A VALIDAR` |
| Volume | m³, 2 casas | `A VALIDAR` |
| Ângulo | Graus decimais, 2 casas | `A VALIDAR` |
| Moeda | BRL, 2 casas | `A VALIDAR` |
| Deslocamento de elevação | 0,00 | — |

Recomendação: **milímetro como unidade de modelo, metro apenas em cota de nível e
tabela de área.** Marcenaria em metro gera arredondamento que aparece na obra.

### Etapa 2 — Níveis e eixos

Níveis genéricos: `NIVEL 00 - TERREO` (±0,00) e `NIVEL 01` (a definir).
Não crie níveis de projeto específico no template.

### Etapa 3 — Parâmetros compartilhados

Aplicar conforme [`../09-parametros/README.md`](../09-parametros/README.md) §Como aplicar.
**Faça isto antes de criar tabelas e carimbo** — tabela criada antes do parâmetro
existir precisa ser refeita.

### Etapa 4 — Materiais

Criar a biblioteca `KMZ_*` com as **quatro definições completas** por material
(aparência, gráficos, corte, identidade). Ver
[`../04-representacao-arquitetonica.md`](../04-representacao-arquitetonica.md) §4.5 e a
nomenclatura em [`../08-nomenclatura-bim.md`](../08-nomenclatura-bim.md) §8.6.

### Etapa 5 — Padrões de linha e preenchimento

Espessuras conforme [`../03-anotacoes-revit.md`](../03-anotacoes-revit.md) §3.2
(todas `A VALIDAR` — **plote antes de aprovar**). Padrões de preenchimento conforme §3.5,
atentando para a distinção *drafting* × *model*.

### Etapa 6 — Tipos de texto e cotas

Alturas conforme §3.4. Fonte: **Arial** recomendada — ver o conflito tipográfico em
[`../01-identidade.md`](../01-identidade.md) §1.3. Fonte não instalada quebra a anotação
de quem abrir o arquivo.

### Etapa 7 — Famílias de anotação

Nenhuma existe. Criar conforme §3.3: tag de ambiente, porta, janela, marcenaria,
acabamento; símbolo de nível, corte, elevação interna, chamada de detalhe, norte.

### Etapa 8 — Carimbo (*title block*)

Um `.rfa` de bloco de título por formato (A0, A1, A2, A3), com os 16 campos de
[`../02-documentacao-e-folhas.md`](../02-documentacao-e-folhas.md) §2.3, em **modo marca**
e **modo órgão**.

**Todos os campos são rótulo vinculado a parâmetro.** Texto digitado no carimbo é erro
esperando data para acontecer.

### Etapa 9 — View Templates

| View Template | Aplica a | Detail Level | Disciplina |
|---|---|---|---|
| `KMZ_PLANTA_Arquitetura` | Planta baixa 1:50 | Medium | Arquitetura |
| `KMZ_PLANTA_Layout` | Planta de layout 1:50 | Medium | Arquitetura |
| `KMZ_PLANTA_Piso` | Paginação 1:50 | Fine | Arquitetura |
| `KMZ_PLANTA_Forro` | Forro 1:50 | Medium | Arquitetura |
| `KMZ_CORTE_Arquitetura` | Cortes 1:50 | Medium | Arquitetura |
| `KMZ_ELEV_Interna` | Elevações internas 1:25 | Fine | Arquitetura |
| `KMZ_AMPLIACAO` | Ampliações 1:25 | Fine | Arquitetura |
| `KMZ_DETALHE` | Detalhes 1:10 / 1:5 | Fine | Arquitetura |
| `KMZ_3D_Apresentacao` | Vistas 3D | Fine | Coordenação |
| `KMZ_COORD_Trabalho` | Vistas de trabalho | Coarse | Coordenação |

Todos `A VALIDAR`.

**Regra:** toda vista de entrega tem View Template aplicado **e travado**. Vista sem
template é vista que vai divergir — e a divergência só aparece na prancha impressa.

### Etapa 10 — Organização do navegador

Agrupar por **Disciplina → Tipo de vista → Ambiente**, usando o prefixo de nome de vista
de [`../08-nomenclatura-bim.md`](../08-nomenclatura-bim.md) §8.7.

Isso faz `COORD_` cair num galho próprio automaticamente — que é o objetivo: separar
trabalho de entrega sem depender de disciplina de ninguém.

### Etapa 11 — Filtros

| Filtro | Critério | Uso |
|---|---|---|
| `KMZ_Decoracao` | `KMZ_Quantificar = Não` | Ocultar decoração em vista técnica |
| `KMZ_Nivel_L3` | `KMZ_Familia_Nivel = L3` | Isolar famílias pesadas |
| `KMZ_Demolir` | Fase | Representação de demolição |
| `KMZ_Executar` | Fase | Representação de construção nova |

### Etapa 12 — Tabelas

| Tabela | Filtro obrigatório |
|---|---|
| Lista de materiais | `KMZ_Incluir_Lista_Materiais = Sim` |
| Quantitativo de marcenaria | `KMZ_Quantificar = Sim` |
| Esquadrias (portas) | — |
| Esquadrias (janelas) | — |
| Áreas por ambiente | — |
| Índice de pranchas | — |
| Key Schedule de `KMZ_Status_Documento` | — |

**Todo quantitativo filtra por `KMZ_Quantificar = Sim`.** Sem exceção.

### Etapa 13 — Folhas-modelo

Uma folha vazia por formato, com carimbo já inserido e os campos de projeto
preenchidos com valores-modelo.

### Etapa 14 — Limpeza antes de salvar

1. *Gerenciar → Limpar não utilizados*, repetidas vezes até estabilizar.
2. Remover níveis, vistas e famílias de teste.
3. Conferir que nenhuma vista de trabalho ficou em folha.
4. Salvar como `.rte`.
5. Registrar o tamanho final do arquivo — **template inchado é lentidão em todo projeto
   que nascer dele.**

---

## Nomenclatura e distribuição

```
KMZERO_ARQ_Rev<NN>.rte
```

Uma cópia canônica, em local de rede, somente leitura para a equipe. Alteração de
template é **evento de revisão**, registrado em
[`../CONTROLE-DE-REVISOES.md`](../CONTROLE-DE-REVISOES.md) — nunca edição silenciosa.

---

## Pendências deste módulo

| # | Pendência | Criticidade |
|---|---|---|
| P-05 | **Definir a versão-alvo do Revit** | **Bloqueante** |
| P-39 | Validar unidades e casas decimais |  |
| P-40 | Plotar para validar espessuras de linha |  |
| P-41 | Criar as famílias de anotação (nenhuma existe) |  |
| P-42 | Criar os carimbos por formato, modo marca e modo órgão | Depende de P-01 (cor) |
| P-43 | Validar a lista de View Templates |  |
| P-44 | Definir o tamanho-alvo máximo do `.rte` |  |
