# 04 — Representação Arquitetônica

Documento: KMZ-ARQ-BIM-001 · Módulo 04 · **Rev.00** · `EM DESENVOLVIMENTO`

---

## 4.1 Vistas do conjunto padrão — `EM DESENVOLVIMENTO`

| Vista | Escala usual | Obrigatória em |
|---|---|---|
| Implantação | 1:200 / 1:250 | Projeto completo |
| Planta de situação | 1:500 | Quando exigido por órgão |
| Planta baixa (por pavimento) | 1:50 | Sempre |
| Planta de layout / mobiliário | 1:50 | Projeto de interiores |
| Planta de forro | 1:50 | **Rev.01 — módulo Forros** |
| Planta de piso / paginação | 1:50 | Projeto de interiores |
| Planta de pontos (elétrica/hidráulica aparente) | 1:50 | Projeto de interiores |
| Cortes (mín. 2, ortogonais entre si) | 1:50 | Sempre |
| Fachadas / elevações externas | 1:50 / 1:100 | **Rev.02 — módulo Fachadas** |
| Elevações internas (4 faces por ambiente) | 1:25 | Projeto de interiores |
| Ampliações (áreas molhadas, escada) | 1:25 | Sempre que houver |
| Detalhes construtivos | 1:10 / 1:5 / 1:2 | Conforme necessidade |
| Vistas 3D / perspectivas | — | Apresentação |

---

## 4.2 Altura de corte da planta baixa — `A VALIDAR`

Proposta: **1,50 m** acima do nível do piso acabado do pavimento, com faixa de
visualização inferior estendida para capturar mobiliário baixo e degraus.

Ajuste obrigatório caso a caso: peitoril alto, janela alta, mezanino e pé-direito duplo
quebram o corte padrão. No Revit isso é *View Range* por vista, não uma configuração
global — cada vista que foge do padrão deve ter o desvio anotado.

---

## 4.3 Planta de layout — `EM DESENVOLVIMENTO`

Conteúdo mínimo, conforme observado nas referências aprovadas (bloco 04 das pranchas):

- Perímetro do ambiente com cotas gerais externas
- Mobiliário e marcenaria em projeção, com peso médio
- Circulação livre indicada
- Abertura de portas com arco de giro
- Tag de ambiente (nome + área)
- Indicação das elevações internas
- Norte (quando aplicável)

**Cotas em planta de layout:** cadeia externa para dimensões gerais, cadeia interna
apenas para o que define a marcenaria. Cota redundante em planta de layout é ruído.

---

## 4.4 Elevações internas — `EM DESENVOLVIMENTO`

Padrão KMZERO: **quatro faces por ambiente**, numeradas no sentido horário a partir da
face onde está a entrada principal. Escala 1:25.

Cada elevação carrega:
- Cota de altura de bancada, de armário superior, de nicho e de ponto elétrico
- Identificação do revestimento por face
- Tag de marcenaria com `KMZ_Codigo`
- Paginação de revestimento quando houver

---

## 4.5 Materiais e acabamentos — `EM DESENVOLVIMENTO`

Cada material no Revit precisa de **quatro definições coerentes**, e é aqui que a
maioria dos templates falha:

| Definição | Para quê | Se estiver errada |
|---|---|---|
| **Aparência** (render) | Imagem PREMIUM / CONTEXTO | Render bonito, documentação inútil |
| **Gráficos** (cor e padrão em vista) | Planta, corte, elevação | Prancha ilegível |
| **Corte** (padrão de corte e cor) | Corte e detalhe | Detalhe irreconhecível |
| **Identidade** (descrição, fabricante, modelo, custo) | Tabela de materiais e orçamento | **Quantitativo não sai** — e a promessa comercial da KMZERO cai |

A quarta é a que sustenta o discurso de "menos imprevisto, mais controle". Material sem
campo de identidade preenchido não gera lista de materiais confiável.

Nomenclatura de material: ver [`08-nomenclatura-bim.md`](./08-nomenclatura-bim.md).

---

## 4.6 Pendências deste módulo

| # | Pendência |
|---|---|
| P-18 | Validar altura de corte 1,50 m contra a prática da KMZERO |
| P-19 | Definir a biblioteca de materiais com as 4 definições completas |
| P-20 | Definir o critério de numeração das elevações internas em ambiente sem entrada clara |
