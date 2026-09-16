# 02 — Documentação, Folhas e Carimbos

Documento: KMZ-ARQ-BIM-001 · Módulo 02 · **Rev.00** · `EM DESENVOLVIMENTO`

---

## ⚠️ Aviso de procedência normativa

As referências de norma abaixo estão marcadas com o nível de confiança real.
**Nenhuma foi verificada contra o texto publicado da ABNT nesta revisão** — não tenho
acesso ao conteúdo das normas aqui. Antes de qualquer entrega executiva, confirme na
fonte primária (ABNT Catálogo ou a cópia licenciada da KMZERO).

| Norma | Assunto | Confiança |
|---|---|---|
| NBR 16752 | Desenho técnico — requisitos para apresentação em folhas | **Provável** — acredito que consolidou/substituiu a NBR 10068 e a NBR 10582; **confirmar edição vigente e o que exatamente revogou** |
| NBR 10068 | Folha de desenho — leiaute e dimensões | **Provável** — possivelmente revogada pela 16752 |
| NBR 13142 | Dobramento de cópia | **Provável** |
| NBR 6492 | Representação de projetos de arquitetura | **Provável** — há edição antiga (1994) e revisão mais recente; confirmar qual se aplica |

**Regra da KMZERO (já firmada na skill `kmzero-documentos`):** a NBR 16752 rege
**folha de desenho**, não documento de texto. Relatório, memorial e laudo em A4 seguem
o padrão de documento da KMZERO, não o carimbo de prancha.

---

## 2.1 Formatos de folha — `APROVADO` (dimensões são ISO 216, fato)

| Formato | Dimensões (mm) | Uso típico KMZERO |
|---|---|---|
| **A0** | 841 × 1189 | Implantação, prancha de conjunto, apresentação grande |
| **A1** | 594 × 841 | Planta baixa e cortes de projeto executivo |
| **A2** | 420 × 594 | Ampliações, setorizações |
| **A3** | 297 × 420 | Detalhes, prancha de ambiente, caderno de apresentação |
| **A4** | 210 × 297 | Documento de texto, ficha de família, ficha de ambiente |

Margens `A VALIDAR` (valores usuais da NBR 10068, **a confirmar**):

| Formato | Esquerda | Demais |
|---|---|---|
| A0, A1 | 25 mm | 10 mm |
| A2, A3, A4 | 25 mm | 7 mm |

A margem esquerda maior existe para **dobra e arquivamento** — não é estética, e não
deve ser reduzida para "ganhar área de desenho".

---

## 2.2 Dobramento — `A VALIDAR`

Toda cópia dobra para **A4 (210 × 297 mm)**, com o carimbo visível na face superior
após a dobra. Sequência: dobra horizontal primeiro, vertical depois. Referência
presumida: NBR 13142. **Diagrama de dobra por formato ainda não elaborado** — entra em
revisão futura.

---

## 2.3 Carimbo KMZERO — `EM DESENVOLVIMENTO`

Posição: **canto inferior direito**, encostado nas margens direita e inferior.
Largura `A VALIDAR` (usual: 175 mm para A0–A2; reduzido para A3).

### Campos obrigatórios

| # | Campo | Origem no Revit | Parâmetro KMZERO |
|---|---|---|---|
| 1 | Logotipo KMZERO + `ARQUITETURA` | Imagem no título | — |
| 2 | Cliente | Informações do projeto | `KMZ_Cliente` |
| 3 | Obra / empreendimento | Informações do projeto | `KMZ_Obra` |
| 4 | Endereço da obra | Informações do projeto | (nativo) |
| 5 | Título da prancha | Parâmetro da folha | (nativo `Nome da folha`) |
| 6 | Conteúdo / disciplina | Parâmetro da folha | `A VALIDAR` |
| 7 | Escala(s) | Vista / manual | (nativo) |
| 8 | Data de emissão | Parâmetro da folha | (nativo `Data de emissão`) |
| 9 | Número da prancha | Parâmetro da folha | `KMZ_Numero_Prancha` |
| 10 | Revisão | Parâmetro da folha | `KMZ_Revisao_Prancha` |
| 11 | **Status do documento** | Parâmetro da folha | `KMZ_Status_Documento` |
| 12 | Responsável técnico + CREA/CAU | Informações do projeto | `KMZ_Responsavel_Tecnico`, `KMZ_CREA_CAU` |
| 13 | Autor / desenhista | Parâmetro da folha | (nativo `Desenhado por`) |
| 14 | Verificado por | Parâmetro da folha | (nativo `Verificado por`) |
| 15 | Tabela de revisões | Nuvem/revisão nativa do Revit | (nativo) |
| 16 | Norte (quando houver planta) | Símbolo de anotação | — |

### Status do documento — `APROVADO` (lista fechada)

`PRELIMINAR` · `PARA APROVAÇÃO` · `APROVADO` · `PARA EXECUÇÃO` · `COMO CONSTRUÍDO` · `CANCELADO`

Lista fechada porque status livre em carimbo é como campo de texto livre em banco de
dados: vira lixo em três projetos. Implementar como parâmetro de projeto do tipo texto
com validação por *Key Schedule*, ou como parâmetro de instância da folha alimentado por
uma tabela-chave. Ver §09 e §10.

### Modo marca × modo órgão — `APROVADO`

Herdado da skill `kmzero-documentos` e vale igual para prancha:

| Situação | Moldura |
|---|---|
| Cliente privado / uso interno | **Modo marca** — petróleo + dourado |
| Entrega a órgão público / licitação | **Modo órgão** — moldura neutra, sem cor de marca, seguindo o padrão exigido pelo contratante |

O modo órgão não é "versão pobre": é requisito contratual. Um carimbo KMZERO dourado
numa prancha de prefeitura pode gerar exigência de reapresentação.

---

## 2.4 Composição da prancha — `EM DESENVOLVIMENTO`

- **Grid de referência:** `A VALIDAR`. Proposto: módulo de 10 mm, com vistas alinhadas
  ao grid.
- **Ordem de leitura:** superior-esquerda → inferior-direita.
- **Legenda e notas:** faixa vertical à direita, imediatamente acima do carimbo,
  largura igual à do carimbo. Isso mantém o alinhamento vertical da prancha inteira.
- **Quadro de áreas / quantitativos:** tabela Revit inserida na folha, nunca texto
  digitado. Texto digitado desatualiza e ninguém percebe.
- **Regra dura — `APROVADO`:** nenhum dado numérico é digitado à mão na prancha.
  Área, cota, quantitativo e contagem saem de vista, tabela ou parâmetro. Se um número
  na prancha não tem origem paramétrica, ele está errado — só ainda não se sabe quando.

---

## 2.5 Pendências deste módulo

| # | Pendência |
|---|---|
| P-04 | Confirmar edição vigente da NBR 16752 e o que ela revogou |
| P-10 | Confirmar margens por formato contra a norma |
| P-11 | Elaborar diagramas de dobra por formato |
| P-12 | Definir largura e altura exatas do carimbo por formato |
| P-13 | Definir o parâmetro de disciplina/conteúdo da folha |
