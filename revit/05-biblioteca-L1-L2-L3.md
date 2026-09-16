# 05 — Biblioteca KMZERO: Níveis L1 / L2 / L3

Documento: KMZ-ARQ-BIM-001 · Módulo 05 · **Rev.00** · `APROVADO` (conceito) · `EM DESENVOLVIMENTO` (critérios)

---

## 5.1 Os três níveis — `APROVADO`

| Nível | Nome | Finalidade |
|---|---|---|
| **L1** | **TÉCNICO** | Documentar. Geometria mínima que representa corretamente em planta, corte e elevação, e que quantifica. |
| **L2** | **PROJETO** | Projetar e apresentar. Geometria reconhecível, materiais corretos, usável em vista 3D e em render de CONTEXTO. |
| **L3** | **PREMIUM** | Vender. Geometria detalhada, materiais com aparência calibrada, pronta para render PREMIUM. |

O ponto que faz isso funcionar: **o mesmo objeto existe nos três níveis com o mesmo
código e os mesmos parâmetros**. O que muda é o peso geométrico, não a identidade.
Isso permite trocar o nível conforme a fase do projeto sem refazer a documentação.

---

## 5.2 Critérios objetivos — `EM DESENVOLVIMENTO`

Sem critério objetivo, "L2" vira opinião. Proposta de critérios mensuráveis — **todos
`A VALIDAR`**, precisam de teste em modelo real:

| Critério | L1 — Técnico | L2 — Projeto | L3 — Premium |
|---|---|---|---|
| Geometria | Volume simplificado | Volume + elementos principais (portas, gavetas, puxadores) | Detalhe completo, chanfro, rebaixo, ferragem |
| *Detail Level* do Revit | Visível em Coarse | Visível em Medium | Visível em Fine |
| Materiais | 1 genérico | Por componente, gráficos corretos | Por componente, aparência calibrada para render |
| Parâmetros | Grupo Identificação + Dimensional + Orçamento | + Materiais | + Documentação completa |
| Peso-alvo do `.rfa` | `A VALIDAR` — proposto ≤ 300 KB | `A VALIDAR` — proposto ≤ 1,5 MB | `A VALIDAR` — proposto ≤ 6 MB |
| Usável em | Documentação executiva, quantitativo | Projeto, apresentação, CONTEXTO | Render PREMIUM |

**Por que o peso importa:** um projeto de interiores com 200 famílias L3 carregadas fica
inoperável. A regra prática é modelar em L1/L2 e **trocar para L3 só nos ambientes que
vão para render**. Se as três versões compartilham código e parâmetros, essa troca é
mecânica — é exatamente para isso que o sistema de níveis existe.

---

## 5.3 Uso do *Detail Level* nativo — `EM DESENVOLVIMENTO`

Alternativa (ou complemento) aos três arquivos separados: **uma única família com a
geometria controlada por *Detail Level*** — volume simples visível em Coarse, detalhe
em Fine.

| Abordagem | Vantagem | Desvantagem |
|---|---|---|
| **3 arquivos** (L1/L2/L3) | Controle total de peso; L1 continua leve de verdade | Três arquivos para manter sincronizados |
| **1 arquivo com Detail Level** | Um arquivo só; troca instantânea por vista | O arquivo carrega o peso do L3 sempre, mesmo em vista Coarse |

**Recomendação para decisão do responsável técnico:** modelo híbrido — **L1 e L2 numa
única família** controlada por Detail Level (o ganho de manutenção compensa e o peso
ainda é aceitável), e **L3 como arquivo separado**, carregado só quando for renderizar.
Isso evita que todo projeto arraste o peso de render.

`A VALIDAR` — precisa de teste com uma família real antes de virar padrão.

---

## 5.4 Categorias de família — `EM DESENVOLVIMENTO`

| Conteúdo KMZERO | Categoria Revit | Observação |
|---|---|---|
| Marcenaria (armário, bancada, nicho) | Mobiliário / Sistemas de mobiliário | Sistemas de mobiliário agrupa conjuntos |
| Louças e metais | Aparelho sanitário | Hospeda em parede quando aplicável |
| Eletrodomésticos | Equipamento especializado | |
| Luminárias | Luminária | Precisa de fotometria; ver abaixo |
| Portas | Porta | Hospedada |
| Janelas / esquadrias | Janela | Hospedada |
| Decoração (vaso, quadro, tapete) | Entourage ou Modelo genérico | **Nunca** quantificar decoração junto com marcenaria |
| Bancada de pedra | Mobiliário ou Modelo genérico | Decidir; afeta o quantitativo de m² de pedra |

**Ponto que precisa de decisão:** luminária KMZERO vai carregar **fotometria real
(arquivo IES)** ou só geometria? Sem IES, o render PREMIUM depende de iluminação
montada à mão a cada projeto — o que contradiz a proposta de biblioteca pronta. Com IES,
é preciso obter os arquivos dos fabricantes. `A VALIDAR`.

---

## 5.5 Regras duras de família — `APROVADO`

1. **Toda família KMZERO carrega `KMZ_Codigo`.** Sem código, não entra na biblioteca.
2. **Toda família KMZERO é quantificável.** Se não gera linha de tabela útil, é
   decoração — e decoração vai para categoria de decoração, não para mobiliário.
3. **Nada de família *in-place* na biblioteca.** Modelo no local não é reutilizável,
   não é versionável e infla o arquivo. Aceito apenas como solução pontual de obra,
   nunca como componente de catálogo.
4. **Nomenclatura fixa.** Ver [`08-nomenclatura-bim.md`](./08-nomenclatura-bim.md).
5. **Tipos, não famílias, para variação dimensional.** Um armário de 60, 80 e 100 cm é
   **uma família com três tipos** — não três famílias.

---

## 5.6 Pendências deste módulo

| # | Pendência |
|---|---|
| P-21 | Decidir entre 3 arquivos, Detail Level, ou o híbrido recomendado |
| P-22 | Validar os pesos-alvo de `.rfa` com famílias reais |
| P-23 | Decidir sobre fotometria IES nas luminárias |
| P-24 | Decidir a categoria da bancada de pedra (afeta quantitativo) |
