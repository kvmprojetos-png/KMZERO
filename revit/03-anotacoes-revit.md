# 03 — Anotações Revit

Documento: KMZ-ARQ-BIM-001 · Módulo 03 · **Rev.00** · `EM DESENVOLVIMENTO`

---

## 3.1 Princípio — `APROVADO`

> **Anotação não é decoração: é hierarquia.** Quem olha a prancha precisa entender em
> dois segundos o que é estrutura, o que é acabamento e o que é observação. Se tudo tem
> o mesmo peso gráfico, nada tem.

Três níveis de peso, e só três:

| Peso | Onde | Leitura |
|---|---|---|
| **Forte** | Corte, elevação, eixo, nível, título de vista | Estrutura a leitura |
| **Médio** | Cota, tag de ambiente, tag de porta/janela | Informa |
| **Leve** | Chamada de detalhe, nota, texto auxiliar, hachura | Complementa |

---

## 3.2 Espessuras de linha — `A VALIDAR`

Proposta de mapeamento para as *Line Weights* do Revit (1–16). **Todos os valores
abaixo são proposta, não medição.** Precisam de teste de plotagem real antes de virar
padrão.

| Elemento | Peso Revit (proposto) | mm na escala 1:50 |
|---|---|---|
| Corte de parede estrutural | 5 | ~0,50 |
| Corte de parede de vedação | 4 | ~0,35 |
| Corte de mobiliário / marcenaria | 3 | ~0,25 |
| Projeção (vista) | 2 | ~0,18 |
| Linha fina / hachura / auxiliar | 1 | ~0,13 |
| Eixo, corte, elevação | 3 | ~0,25 |
| Cota e extensão | 1 | ~0,13 |

**Teste obrigatório antes de aprovar:** plotar uma prancha A1 em 1:50 e uma A3 em 1:25
e verificar se a hierarquia se mantém legível nos dois. Peso que funciona em tela e
some no papel não serve.

---

## 3.3 Objetos de anotação — `EM DESENVOLVIMENTO`

| Objeto | Convenção KMZERO | Status |
|---|---|---|
| **Tag de ambiente** | Nome + área + código KMZ do ambiente | `EM DESENVOLVIMENTO` |
| **Tag de porta** | Código do tipo, em círculo | `A VALIDAR` |
| **Tag de janela** | Código do tipo, em losango | `A VALIDAR` |
| **Tag de marcenaria** | `KMZ_Codigo` da família (ex.: identificação do módulo) | `EM DESENVOLVIMENTO` |
| **Tag de acabamento** | Código do material + face | `EM DESENVOLVIMENTO` |
| **Cota** | Traço inclinado 45°, texto acima da linha, sem unidade repetida | `A VALIDAR` |
| **Nível (elevação)** | Triângulo cheio, cota em metros com 2 casas, sinal explícito (`+`/`−`) | `EM DESENVOLVIMENTO` |
| **Eixo** | Círculo; letras no eixo horizontal, números no vertical | `A VALIDAR` |
| **Corte** | Marca em ambas as extremidades, letra maiúscula, seta indicando o sentido de visão | `EM DESENVOLVIMENTO` |
| **Elevação interna** | Símbolo de quatro faces numeradas no sentido horário | `EM DESENVOLVIMENTO` |
| **Chamada de detalhe** | Círculo ou retângulo com a referência da folha de destino | `EM DESENVOLVIMENTO` |
| **Norte** | Símbolo próprio KMZERO, sempre no mesmo canto da prancha | `A VALIDAR` |

Todas as famílias de anotação precisam ser **criadas como `.rfa` de categoria de
anotação** — nenhuma existe ainda. Ver backlog em §10.

---

## 3.4 Texto — `A VALIDAR`

| Papel | Altura no papel (proposta) |
|---|---|
| Título de vista | 5,0 mm |
| Subtítulo / escala | 3,0 mm |
| Texto de cota | 2,0 mm |
| Nota e texto corrido | 2,5 mm |
| Texto de tabela | 2,5 mm |

Regra: **altura no papel, nunca em unidade de modelo.** No Revit isso significa definir
o tipo de texto com tamanho em mm e deixar a escala da vista fazer o resto. Texto
dimensionado em unidade de modelo muda de tamanho quando a escala muda — erro clássico
e caro.

Fonte: ver conflito tipográfico em [`01-identidade.md`](./01-identidade.md) §1.3.
**Recomendação: Arial**, pela disponibilidade universal.

---

## 3.5 Padrões de preenchimento (hachuras) — `EM DESENVOLVIMENTO`

| Material | Padrão | Status |
|---|---|---|
| Alvenaria cerâmica | Diagonal 45° simples | `A VALIDAR` |
| Concreto | Pontilhado + triângulos | `A VALIDAR` |
| Concreto armado | Diagonal cruzada | `A VALIDAR` |
| Madeira (corte) | Veio longitudinal | `A VALIDAR` |
| MDF / MDP (corte) | Sólido cinza claro com borda | `A VALIDAR` |
| Isolamento | Zigue-zague | `A VALIDAR` |
| Vidro | Linha dupla fina | `A VALIDAR` |
| Pedra natural / mármore | Irregular | `A VALIDAR` |

Distinção importante para quem for montar: no Revit, **padrão de desenho** (*drafting*)
escala com a vista; **padrão de modelo** (*model*) é fixo no espaço real. Paginação de
piso e revestimento usa **model pattern**. Hachura de corte usa **drafting pattern**.
Trocar os dois é o erro mais comum de template.

---

## 3.6 Pendências deste módulo

| # | Pendência |
|---|---|
| P-14 | Teste de plotagem para validar espessuras de linha |
| P-15 | Criar as famílias `.rfa` de anotação (nenhuma existe) |
| P-16 | Definir o símbolo de norte KMZERO |
| P-17 | Desenhar os padrões de preenchimento customizados |
