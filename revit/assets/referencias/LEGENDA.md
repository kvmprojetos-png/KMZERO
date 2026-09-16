# Referências visuais — KMZERO Arquitetura

## Identificação obrigatória

> **REFERÊNCIA VISUAL APROVADA — CONCEITO**
>
> A linguagem gráfica, composição e direção estética são referências KMZERO.
> Textos, números, CNPJ, registros, dimensões ou outros dados ilustrativos
> eventualmente gerados na imagem **não constituem dados técnicos aprovados**.

Esta identificação vale para **todos** os arquivos desta pasta, sem exceção.

## Acervo Rev.00

| Arquivo | Ambiente | Prancha | Vinculado a |
|---|---|---|---|
| `REF-AMB-BANHEIRO-Rev00.jpg` | Banheiro | KMZ BANHEIRO | [`../../07-ambientes/banheiro.md`](../../07-ambientes/banheiro.md) |
| `REF-AMB-COZINHA-Rev00.jpg` | Cozinha | KMZ COZINHA | [`../../07-ambientes/cozinha.md`](../../07-ambientes/cozinha.md) |
| `REF-AMB-CLOSET-Rev00.jpg` | Closet | KMZ CLOSET | [`../../07-ambientes/closet.md`](../../07-ambientes/closet.md) |
| `REF-AMB-HOMEOFFICE-Rev00.jpg` | Home Office | KMZ HOME OFFICE | [`../../07-ambientes/home-office.md`](../../07-ambientes/home-office.md) |
| `REF-AMB-GOURMET-Rev00.jpg` | Gourmet | KMZ GOURMET | [`../../07-ambientes/gourmet.md`](../../07-ambientes/gourmet.md) |

## Política de arquivo

- **Formato no repositório:** JPEG qualidade 92, sem subamostragem de croma
  (`subsampling=0`), resolução original preservada. Os PNG originais somavam 11 MB;
  em JPEG somam 3 MB. Git versiona binário sem fazer *diff* nem *merge* — cada revisão
  de imagem duplica o arquivo inteiro no histórico, então peso importa.
- **Masters:** os PNG/PSD originais **não vivem no Git**. Guarde-os no repositório de
  arquivos da KMZERO ou no BIM 360/ACC, onde há versionamento nativo para binário.
- **Nomenclatura:** `REF-<CATEGORIA>-<ASSUNTO>-Rev<NN>.jpg`
  Categorias: `AMB` (ambiente), `COMP` (componente), `DOC` (documentação/prancha),
  `MAT` (material/acabamento), `IDE` (identidade).
- **Revisão de imagem:** nova revisão = **arquivo novo** com `Rev.NN` incrementado.
  Não sobrescreva o anterior — a comparação entre revisões é parte do padrão.

## Nota sobre a paleta medida

Os valores `#00101A` (escuro) e `#EF9D1C` (dourado) registrados em
[`../../01-identidade.md`](../../01-identidade.md) foram **medidos por amostragem de
pixels** nestas cinco imagens (faixas gráficas superior e inferior, regiões não
fotográficas, média ponderada). São medição real do material aprovado — portanto
**cor é dado válido**, ao contrário das cotas. As cinco imagens concordam entre si,
o que reforça a medição.
