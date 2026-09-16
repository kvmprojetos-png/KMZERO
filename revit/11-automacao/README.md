# 11 — Automação (pyRevit / Dynamo)

Documento: KMZ-ARQ-BIM-001 · Módulo 11 · **Rev.00** · `EM DESENVOLVIMENTO`

---

## ⚠️ Leia antes de rodar qualquer coisa daqui

> **Nada neste módulo foi executado dentro do Revit.** Não há Revit neste ambiente.
> O código foi escrito contra a API pública, mas **não é código testado** — é código
> revisável. Trate como rascunho a depurar, não como ferramenta pronta.

Dois pontos que provavelmente vão exigir ajuste na primeira execução:

1. **Leitura do nome do elemento.** `Element.Name` conflita com atributos do Python em
   algumas versões do IronPython/CPython do pyRevit. O script usa `BuiltInParameter`
   em vez disso, que é o caminho robusto — mas confirme.
2. **Versão da API.** Nomes e assinaturas mudam entre versões do Revit. Ver pendência
   bloqueante **P-05** (versão-alvo não definida).

---

## Por que só há script de leitura

O único script entregue nesta revisão **não escreve nada no modelo**. Isso é decisão
deliberada, não limitação:

> Script não testado que **lê** e reporta, no pior caso, dá um relatório errado.
> Script não testado que **escreve** — renomeia, reclassifica, apaga — pode corromper um
> modelo de projeto real, e nem sempre o estrago aparece na hora.

Scripts de escrita (renomear em lote, gerar folhas, exportar quantitativo) entram depois
que a versão do Revit estiver definida e o primeiro script tiver rodado.

---

## Entregue nesta revisão

### `KMZERO — Auditar Famílias` (pyRevit, somente leitura)

[`pyrevit/KMZERO.extension/`](./pyrevit/KMZERO.extension/)

Percorre os tipos de família carregados e confere contra o padrão KMZERO:

| Verificação | Referência |
|---|---|
| `KMZ_Codigo` existe e está preenchido | [`../09-parametros/`](../09-parametros/) |
| `KMZ_Codigo` bate com `KMZ-<AMB>-<NNN>` | [`../08-nomenclatura-bim.md`](../08-nomenclatura-bim.md) §8.3 |
| `<AMB>` é um código de ambiente válido | §8.2 |
| `KMZ_Familia_Nivel` é `L1`, `L2` ou `L3` | [`../05-biblioteca-L1-L2-L3.md`](../05-biblioteca-L1-L2-L3.md) |
| `KMZ_Quantificar` está definido | §09 |
| Nome da família não tem acento nem espaço | §8.1 |
| Famílias *in-place* no modelo | §5.5 regra 3 |

Saída: relatório na janela do pyRevit, com contagem e lista por tipo de problema.

### Instalação

1. Instale o pyRevit (fora do escopo deste documento).
2. Copie a pasta `KMZERO.extension` para a pasta de extensões do pyRevit,
   ou registre o caminho em *pyRevit → Settings → Custom Extension Directories*.
3. Recarregue o pyRevit. A aba **KMZERO** aparece na faixa de opções.

---

## Sobre o Dynamo

**Não há arquivo `.dyn` nesta revisão, por decisão consciente.**

Um `.dyn` é JSON, e eu conseguiria escrever um. O problema: um grafo Dynamo válido
depende de GUIDs de nó, versões de pacote e assinaturas de porta que variam com a versão
do Dynamo instalada. Escrever isso às cegas produz, com alta probabilidade, **um arquivo
que não abre** — e um arquivo que não abre é pior do que arquivo nenhum, porque custa
tempo de diagnóstico.

O caminho honesto: [`dynamo/README.md`](./dynamo/) traz a **lógica em Python pronta para
colar num nó Python do Dynamo**. Você monta o grafo mínimo em volta (entrada → nó Python
→ saída), que leva menos tempo do que depurar um `.dyn` quebrado.

---

## Backlog de automação

| Script | O que faria | Escreve no modelo? |
|---|---|---|
| Auditar Famílias | Conferência contra o padrão | ❌ Não — **entregue** |
| Auditar Vistas | Vista sem View Template; `COORD_` em folha | ❌ Não |
| Auditar Materiais | Material fora da nomenclatura `KMZ_*`; sem identidade | ❌ Não |
| Exportar Quantitativo | Tabela filtrada → CSV para o app KMZERO | ❌ Não (só lê) |
| Renomear Vistas em Lote | Aplicar §8.7 | ⚠️ Sim |
| Gerar Folhas em Lote | Criar folhas a partir de lista | ⚠️ Sim |
| Aplicar View Templates | Em lote por tipo de vista | ⚠️ Sim |

Os três primeiros são os próximos — continuam sendo somente leitura, logo continuam
seguros de rodar sem ambiente de teste.

---

## Pendências deste módulo

| # | Pendência |
|---|---|
| P-05 | **Definir a versão-alvo do Revit** — bloqueia toda a automação |
| P-06 | Rodar o auditor num modelo real e corrigir o que quebrar |
| P-45 | Confirmar a leitura de nome via `BuiltInParameter` |
| P-46 | Definir o formato CSV de exportação para o app KMZERO |
