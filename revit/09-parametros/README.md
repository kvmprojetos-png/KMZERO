# 09 — Parâmetros Compartilhados KMZERO

Documento: KMZ-ARQ-BIM-001 · Módulo 09 · **Rev.00** · `EM DESENVOLVIMENTO`

Arquivo: **[`KMZERO_SharedParameters.txt`](./KMZERO_SharedParameters.txt)**
32 parâmetros · 6 grupos · GUIDs gerados (UUID v4, únicos e definitivos)

---

## ⚠️ Estado real deste arquivo

| O que é verdade | O que não é verdade |
|---|---|
| Está no formato nativo de *shared parameter file* do Revit (tabulado, com blocos `*META`, `*GROUP`, `*PARAM`) | **Não foi aberto no Revit.** Não há Revit neste ambiente. |
| Os GUIDs são UUID v4 reais e únicos | Não há garantia de que todos os `DATATYPE` sejam aceitos sem ajuste |
| A estrutura segue a especificação do formato | `CURRENCY` e `MULTILINETEXT` **precisam de confirmação** na sua versão do Revit |

**Primeira coisa a fazer:** abrir no Revit (*Gerenciar → Parâmetros compartilhados →
Procurar*) e confirmar que os 6 grupos e os 32 parâmetros aparecem corretamente.
Se algum `DATATYPE` for rejeitado, corrija a linha e **mantenha o GUID** — trocar o
GUID de um parâmetro já usado quebra o vínculo em todas as famílias.

---

## 🔒 Regra inviolável dos GUIDs

> **Um GUID, uma vez publicado, nunca muda.**

O GUID é a identidade real do parâmetro no Revit — o nome é só rótulo. Se você trocar o
GUID de `KMZ_Codigo`, todas as famílias que já usam esse parâmetro passam a enxergar um
parâmetro **diferente** com o mesmo nome, e o vínculo se rompe silenciosamente. O erro
só aparece meses depois, quando uma tabela vem vazia.

- Parâmetro errado? **Corrija nome, descrição ou tipo — nunca o GUID.**
- Parâmetro obsoleto? **Não apague.** Renomeie para `KMZ_ZZ_Obsoleto_<nome>` e pare de usar.
- Parâmetro novo? Acrescente uma linha nova, com GUID novo.
- **Nunca regenere este arquivo do zero.** O script que o criou gera GUIDs novos a cada
  execução — rodar de novo destrói o vínculo de tudo.

---

## Grupos

| ID | Grupo | Para quê |
|---|---|---|
| 1 | `KMZ_01_Identificacao` | Quem é a peça: código, ambiente, nível, kit, revisão |
| 2 | `KMZ_02_Dimensional` | Dimensões nominais e altura de instalação |
| 3 | `KMZ_03_Materiais` | Material, acabamento, cor, aptidão a uso externo |
| 4 | `KMZ_04_Orcamento` | **A ponte com o sistema KMZERO** — ver abaixo |
| 5 | `KMZ_05_Documentacao` | O que aparece na prancha e em que detalhe |
| 6 | `KMZ_06_Projeto` | Carimbo, folha, responsável técnico, cliente, obra |

---

## O grupo 04 é o que diferencia esta biblioteca

A promessa comercial da KMZERO é **"menos imprevisto, mais controle, mais lucro"**.
Isso só se sustenta se o modelo conversar com o orçamento. Os quatro parâmetros abaixo
são essa conversa:

| Parâmetro | Liga em |
|---|---|
| `KMZ_Codigo_Servico` | Código do serviço na base de preços |
| `KMZ_Base_Preco` | `SINAPI` · `SICRO` · `DER` · `COTACAO` · `COMPOSICAO` |
| `KMZ_Etapa_Obra` | **Etapa do cronograma no app KMZERO** |
| `KMZ_Quantificar` | Separa projeto de decoração no quantitativo |

`KMZ_Obra` (grupo 6) deve carregar **o mesmo identificador de obra usado no cadastro do
app KMZERO**. Sem essa coincidência, modelo e obra ficam sendo duas realidades
paralelas — e a integração vira trabalho manual, que é exatamente o que o produto
promete eliminar.

**Pendência P-27:** confirmar o formato do identificador de obra no app antes de fixar.

---

## `KMZ_Quantificar` — o parâmetro que salva o quantitativo

`Sim` para item de projeto. `Não` para decoração, objeto de cena, vegetação, quadro,
tapete, louça de mesa.

Sem ele, o quantitativo de um Home Office inclui os vasos de planta, e o cliente recebe
um orçamento com item que ninguém vai comprar. Use como **filtro em toda tabela de
quantitativo** — não como informação decorativa.

---

## Como aplicar

### 1. Apontar o arquivo
*Gerenciar → Parâmetros compartilhados → Procurar* → selecionar
`KMZERO_SharedParameters.txt`.

**Guarde o arquivo em local de rede compartilhado por toda a equipe**, não na máquina de
cada um. Duas cópias divergentes do mesmo arquivo é o começo de um problema difícil de
diagnosticar.

### 2. Parâmetros de projeto (grupo 6)
*Gerenciar → Parâmetros de projeto → Adicionar* → escolher do arquivo compartilhado.
Aplicar a **Folhas** (`KMZ_Numero_Prancha`, `KMZ_Revisao_Prancha`,
`KMZ_Status_Documento`, `KMZ_Disciplina`) e a **Informações do projeto**
(`KMZ_Cliente`, `KMZ_Obra`, `KMZ_Responsavel_Tecnico`, `KMZ_CREA_CAU`).

Todos como **Instância**.

### 3. Parâmetros de família (grupos 1–5)
No editor de família: *Tipos de família → Novo parâmetro → Parâmetro compartilhado*.

| Grupo | Tipo | Por quê |
|---|---|---|
| 01 Identificação | **Tipo** | Código e nível são da linha, não da peça colocada |
| 02 Dimensional | **Tipo** | Dimensão define o tipo |
| 03 Materiais | **Tipo** (ou Instância se o projeto exigir troca peça a peça) | Decidir por linha de família |
| 04 Orçamento | **Tipo** | Vem da linha |
| 05 Documentação | **Instância** | `KMZ_Observacao` é da peça colocada |

### 4. `KMZ_Status_Documento` com lista fechada
Texto livre em campo de status vira lixo em três projetos. Implemente como
**Key Schedule** (*Tabela → Tabela de chaves*) com as seis opções do padrão, ou o campo
será preenchido com "aprovado", "APROVADO", "Aprov." e "ok" no mesmo projeto.

---

## Pendências deste módulo

| # | Pendência |
|---|---|
| P-28 | Abrir o arquivo no Revit e confirmar os 32 parâmetros |
| P-29 | Confirmar aceitação de `CURRENCY` e `MULTILINETEXT` |
| P-30 | Decidir Tipo × Instância para o grupo 03 por linha de família |
| P-31 | Montar a Key Schedule de `KMZ_Status_Documento` |
| P-27 | Confirmar o formato do identificador de obra do app KMZERO |
| P-32 | Definir o mapeamento IFC (*property set*) — hoje **não existe** |
