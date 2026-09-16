# 08 — Nomenclatura BIM

Documento: KMZ-ARQ-BIM-001 · Módulo 08 · **Rev.00** · `EM DESENVOLVIMENTO`

---

## 8.1 Princípio — `APROVADO`

Nome é chave de busca, não legenda. Regras que valem para tudo:

- **Maiúsculas e minúsculas fixas**, sem variação.
- **Sem acento e sem cedilha** em nome de arquivo, família, tipo e parâmetro.
  (Acento quebra em API, em exportação IFC e em servidor de arquivos antigo.)
- **Sem espaço em nome de arquivo** — use hífen ou underscore.
- **Do geral para o específico**, sempre. Isso faz a ordenação alfabética virar
  agrupamento útil de graça.
- **Largura fixa nos códigos numéricos** (`001`, não `1`) — senão a ordenação embaralha
  na décima peça.

---

## 8.2 Código de ambiente — `APROVADO`

Três letras, maiúsculas:

| Ambiente | Código | Ambiente | Código |
|---|---|---|---|
| Sala | `SAL` | Lavanderia | `LAV` |
| Cozinha | `COZ` | Gourmet | `GOU` |
| Suíte | `SUI` | Home Office | `HOF` |
| Quarto | `QRT` | Varanda | `VAR` |
| Banheiro | `BAN` | Corredor | `COR` |
| Lavabo | `LVB` | Garagem | `GAR` |
| Closet | `CLS` | Depósito | `DEP` |
| Terraço | `TER` | Jardim | `JAR` |
| Área comum | `ACM` | Circulação | `CIR` |

**Nota de divergência:** a referência visual do Home Office usa `KMZ-HO-001` (duas
letras), enquanto as outras quatro usam três (`BAN`, `COZ`, `CLS`, `GOU`). Adotado
**três letras para todos** — `HOF` — pela consistência. Registrado aqui porque contraria
o que aparece na imagem; a imagem é referência estética, não fonte de código.

---

## 8.3 Código de família — `EM DESENVOLVIMENTO`

```
KMZ-<AMB>-<NNN>
```

| Parte | Regra | Exemplo |
|---|---|---|
| `KMZ` | Fixo | `KMZ` |
| `<AMB>` | Código de ambiente (§8.2) ou `GER` para transversal | `BAN` |
| `<NNN>` | Sequencial de 3 dígitos dentro do ambiente | `001` |

Exemplo: `KMZ-BAN-001`, `KMZ-COZ-001`, `KMZ-GER-014`.

**Ponto em aberto:** o código identifica a **peça** (este gabinete) ou a **linha** (todos
os gabinetes de banheiro)? As referências sugerem a linha — `KMZ-BAN-001` aparece como
"GABINETE … Diversos tamanhos e acabamentos", com variação resolvida em tipos. Adotado
provisoriamente: **código = linha; variação = tipo.** `A VALIDAR`.

---

## 8.4 Nome de arquivo de família — `EM DESENVOLVIMENTO`

```
KMZ-<AMB>-<NNN>_<Descricao>_<Nivel>.rfa
```

Exemplos:
- `KMZ-BAN-001_Gabinete-Suspenso_L2.rfa`
- `KMZ-COZ-001_Ilha_L3.rfa`
- `KMZ-GER-007_Porta-Giro-1Folha_L1.rfa`

---

## 8.5 Nome de tipo — `EM DESENVOLVIMENTO`

```
<Descricao> <Dimensao> <Acabamento>
```

Exemplos: `Gabinete Suspenso 1200x600 MDF Carvalho`, `Porta Giro 800x2100 Laca Branca`.

Dimensão em milímetros, sem unidade, separada por `x`, na ordem **largura × altura** (ou
**largura × profundidade** quando altura for constante na linha). Documente qual das
duas em cada linha de família — a inconsistência aqui é fonte crônica de erro.

---

## 8.6 Nome de material — `EM DESENVOLVIMENTO`

```
KMZ_<Classe>_<Descricao>_<Acabamento>
```

| Classe | Uso |
|---|---|
| `PED` | Pedra natural (mármore, granito, quartzito) |
| `PORC` | Porcelanato e cerâmica |
| `MAD` | Madeira, MDF, MDP, laminado |
| `MET` | Metal |
| `VID` | Vidro |
| `PINT` | Pintura e laca |
| `TEC` | Tecido e revestimento têxtil |
| `CONC` | Concreto e cimentício |
| `REV` | Revestimento especial (3D, ripado, acústico) |

Exemplos: `KMZ_PED_Granito-Preto_Polido`, `KMZ_MAD_Carvalho_Natural`,
`KMZ_PORC_Marmore-Claro_Acetinado`.

O prefixo `KMZ_` existe para separar material da biblioteca do material que vem junto de
família de terceiros. Sem isso, a lista de materiais do projeto vira um depósito.

---

## 8.7 Nome de vista — `EM DESENVOLVIMENTO`

```
<DISC>_<TIPO>_<Nivel-ou-Ambiente>_<Complemento>
```

| `<DISC>` | Disciplina |
|---|---|
| `ARQ` | Arquitetura |
| `INT` | Interiores |
| `APR` | Apresentação |
| `COORD` | Coordenação / trabalho (não vai para folha) |

Exemplos:
- `ARQ_PLANTA_Pav-Terreo`
- `INT_ELEV_Cozinha_01`
- `ARQ_CORTE_AA`
- `APR_3D_Gourmet-Premium`
- `COORD_PLANTA_Pav-Terreo_Trabalho`

**Regra dura — `APROVADO`:** vista com prefixo `COORD_` **nunca vai para folha**.
Isso permite filtrar e auditar o que é entregável com um clique, e é o que impede a
vista de trabalho de vazar para a prancha do cliente.

---

## 8.8 Numeração de prancha — `EM DESENVOLVIMENTO`

```
<DISC>-<NN>
```

| Faixa | Conteúdo |
|---|---|
| `ARQ-00` | Capa, índice, convenções |
| `ARQ-01` a `ARQ-19` | Plantas baixas |
| `ARQ-20` a `ARQ-29` | Cortes |
| `ARQ-30` a `ARQ-39` | Fachadas (**Rev.02**) |
| `ARQ-40` a `ARQ-59` | Ampliações |
| `ARQ-60` a `ARQ-79` | Detalhes |
| `INT-01` em diante | Interiores por ambiente |

---

## 8.9 Nome de arquivo de projeto — `EM DESENVOLVIMENTO`

```
KMZ_<CodObra>_<DISC>_<Fase>_R<NN>.rvt
```

Exemplo: `KMZ_2026-014_ARQ_EXEC_R03.rvt`

| Fase | Sigla |
|---|---|
| Estudo preliminar | `EP` |
| Anteprojeto | `AP` |
| Projeto legal | `PL` |
| Projeto executivo | `EXEC` |
| Como construído | `ACB` |

**Alinhamento com o app KMZERO:** `<CodObra>` deve ser o **mesmo identificador da obra
no sistema KMZERO** (cadastro de obras). Se os dois não baterem, o elo entre modelo e
orçamento se perde — e é justamente esse elo que diferencia a KMZERO de uma biblioteca
comum de famílias. Ver `KMZ_Obra` em [`09-parametros/`](./09-parametros/).

---

## 8.10 Sobre a ISO 19650

A norma ISO 19650 define uma convenção de nomenclatura bem mais extensa (projeto,
originador, volume, nível, tipo, disciplina, número). **Não adotei aqui**, por decisão
consciente: para o porte de projeto da KMZERO, a convenção completa é peso morto que
ninguém vai manter — e convenção não mantida é pior do que convenção simples.

Se a KMZERO entrar em contrato que exija ISO 19650, isso vira módulo próprio em revisão
futura, com mapeamento de/para a convenção acima. **Não tenho o texto da norma aqui para
citar campos específicos** — qualquer detalhamento precisa da fonte primária.

---

## 8.11 Pendências deste módulo

| # | Pendência |
|---|---|
| P-25 | Confirmar se `KMZ_Codigo` identifica a linha ou a peça |
| P-26 | Fixar a ordem dimensional (L×A ou L×P) por linha de família |
| P-27 | Confirmar o formato do código de obra do app KMZERO para alinhar `<CodObra>` |
