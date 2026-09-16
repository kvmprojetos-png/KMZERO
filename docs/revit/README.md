# Padrão de prancha KMZERO para Revit

Moldura e carimbo (*title block*) das pranchas KMZERO, formatos A0 a A4.
Documento de referência: **KMZ-ET-001 Rev. A** — `KMZ-ET-001-carimbo-revit.pdf`.

## Delimitação

O padrão KMZERO de **documentos de texto** (relatório, memorial, especificação,
laudo, RDO) não se aplica a prancha. Prancha é desenho técnico: não herda margem
de encadernação de texto, corpo justificado, "Página X de N" nem componentes de
relatório. Atravessam apenas a **camada de marca** (navy `#14253F` + dourado
`#C9A227` na moldura) e a **governança de revisão e status**.

## Conteúdo

| Arquivo | O que é |
|---|---|
| `KMZ-ET-001-carimbo-revit.pdf` | Especificação — cotas, paleta, mapeamento de parâmetros, procedimento |
| `KMZ-ET-001-carimbo-revit.html` | Fonte da especificação (A4, 2 folhas) |
| `gerar_pranchas_dxf.py` | Gerador dos DXF |
| `dxf/KMZ-PRANCHA-A0…A4.dxf` | Moldura + carimbo + zona de revisões, escala 1:1 |
| `dxf/KMZ-CARIMBO.dxf` | Só o carimbo, 175 × 102 mm |

## Regenerar

```bash
python3 docs/revit/gerar_pranchas_dxf.py          # DXF
chromium --headless --no-pdf-header-footer \
  --print-to-pdf=docs/revit/KMZ-ET-001-carimbo-revit.pdf \
  file://$PWD/docs/revit/KMZ-ET-001-carimbo-revit.html
```

As dimensões vivem nas constantes do topo de `gerar_pranchas_dxf.py`
(`FORMATOS`, `MARGEM_ESQ`, `CAR_W`, `CAR_H`, `LINHAS`). Alterou lá, rode de novo
e atualize a Tabela 1 e a Tabela 2 do HTML.

## O DXF é guia de traçado, não entregável

O Revit não importa SVG. Os DXF (R12 ASCII, milímetros, escala 1:1) servem para
importar no Editor de Famílias e traçar por cima com linhas nativas. **Exclua a
importação CAD antes de salvar a família.** Os campos precisam ser *Rótulos*
ligados a parâmetros — texto ou imagem vira geometria morta e não preenche.

## Pendência antes da Rev. 0

Margens 20/10 mm: valor herdado do padrão interno, atribuído à NBR 16752, **não
conferido contra o texto da norma**. Confirmar antes da emissão formal.
