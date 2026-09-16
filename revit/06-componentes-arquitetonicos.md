# 06 — Componentes Arquitetônicos

Documento: KMZ-ARQ-BIM-001 · Módulo 06 · **Rev.00** · `EM DESENVOLVIMENTO`

Componentes **transversais** — usados em qualquer ambiente. Recebem código
`KMZ-GER-<NNN>`. Componentes específicos de um ambiente ficam no arquivo do ambiente.

---

## 6.1 Estado deste módulo

**Nenhum componente foi modelado.** O que segue é o inventário do que precisa existir,
com as decisões de categoria e hospedagem que precisam ser tomadas antes de modelar.
Tomar essas decisões depois de modelar cem famílias custa caro.

---

## 6.2 Esquadrias

| Componente | Categoria Revit | Hospedagem | Status |
|---|---|---|---|
| Porta de giro 1 folha | Porta | Parede | `A MODELAR` |
| Porta de giro 2 folhas | Porta | Parede | `A MODELAR` |
| Porta de correr aparente | Porta | Parede | `A MODELAR` |
| Porta de correr embutida | Porta | Parede | `A MODELAR` — exige vão na parede |
| Porta pivotante | Porta | Parede | `A MODELAR` |
| Porta camarão / sanfonada | Porta | Parede | `A MODELAR` |
| Janela de correr | Janela | Parede | `A MODELAR` |
| Janela maxim-ar | Janela | Parede | `A MODELAR` |
| Janela basculante | Janela | Parede | `A MODELAR` |
| Caixilho fixo | Janela | Parede | `A MODELAR` |
| Porta-balcão | Janela ou Porta | Parede | **Decisão pendente** |
| Veneziana / brise | Janela ou Modelo genérico | Parede | **Decisão pendente** |

**Decisão pendente relevante — porta-balcão:** como Porta, entra na tabela de portas e
gera vão com soleira; como Janela, entra na tabela de esquadrias de vidro. A escolha
muda a documentação. Recomendo **Janela**, porque na prática ela é especificada,
orçada e instalada junto com as esquadrias de alumínio, não com as portas internas.
`A VALIDAR`.

### Sistema de alumínio — `EM DESENVOLVIMENTO`

A referência de marca cita alumínio como componente próprio. Precisa de definição:
linha (ex.: suprema, integrada), espessura de perfil, tipo de vidro padrão, e se o
perfil será modelado em geometria real ou representado simplificadamente em L1/L2.

**Recomendação:** perfil real só em L3. Em L1/L2, perfil simplificado com a espessura
correta — o que importa em documentação é a dimensão do vão e a espessura do marco,
não o desenho do perfil.

---

## 6.3 Coberturas e telhados — `A MODELAR`

| Componente | Categoria | Observação |
|---|---|---|
| Telhado cerâmico | Telhado | Por tipo de telha |
| Telhado metálico / sanduíche | Telhado | |
| Laje impermeabilizada | Telhado ou Piso | **Decisão pendente** |
| Platibanda | Parede | |
| Calha e rufo | Modelo genérico ou Varredura | |
| Beiral | Parte do telhado | |

---

## 6.4 Circulação vertical — `A MODELAR`

| Componente | Categoria | Observação |
|---|---|---|
| Escada reta | Escada | |
| Escada em L / U com patamar | Escada | |
| Escada com degrau em leque | Escada | Geometria complexa; avaliar |
| Guarda-corpo de vidro | Guarda-corpo | |
| Guarda-corpo metálico | Guarda-corpo | |
| Corrimão | Guarda-corpo | |
| Rampa | Rampa | Inclinação sujeita a norma de acessibilidade |

**Dimensões de degrau, corrimão e rampa são reguladas por norma.** Não fixe valores por
analogia — **requer fonte primária** (acessibilidade e código de obras local).

---

## 6.5 Marcenaria transversal — `A MODELAR`

Módulos que se repetem em vários ambientes e são a **base do sistema modular**:

| Componente | Observação |
|---|---|
| Módulo base (armário inferior) | Largura variável por tipo |
| Módulo aéreo (armário superior) | |
| Torre / módulo alto | |
| Gaveteiro | Nº de gavetas por tipo |
| Nicho | |
| Prateleira | |
| Painel ripado | Também é revestimento |
| Bancada | Ver decisão de categoria em `05-biblioteca-L1-L2-L3.md` §5.4 |
| Zócalo / rodapé de marcenaria | |

**Este é o conjunto com maior retorno por hora investida.** Um sistema modular bem
resolvido aqui resolve Cozinha, Closet, Banheiro, Home Office e Gourmet de uma vez.
Modelar cada ambiente isoladamente é refazer o mesmo trabalho cinco vezes.

**Recomendação de sequência:** modelar a marcenaria transversal **antes** de fechar
qualquer ambiente.

---

## 6.6 Iluminação — `A MODELAR`

| Componente | Categoria | Fotometria |
|---|---|---|
| Spot embutido | Luminária | Ver decisão IES |
| Perfil de LED | Luminária | Linear |
| Fita LED | Luminária | Linear |
| Pendente | Luminária | |
| Arandela | Luminária | |
| Plafon | Luminária | |
| Luz de tarefa | Luminária | |
| Sensor de presença | **Decisão pendente** | Ver `07-ambientes/closet.md` §08 |

Decisão sobre arquivos IES: [`05-biblioteca-L1-L2-L3.md`](./05-biblioteca-L1-L2-L3.md) §5.4.

---

## 6.7 Revestimentos e acabamentos — `A MODELAR`

Tratados como **material + padrão de modelo (*model pattern*)**, não como família.
Paginação de piso e parede precisa de padrão de modelo com a dimensão real da peça —
ver [`03-anotacoes-revit.md`](./03-anotacoes-revit.md) §3.5.

Classes previstas: porcelanato · cerâmica · pedra natural (mármore, granito, quartzito) ·
madeira e laminado · cimentício · revestimento 3D · ripado · acústico · papel de parede.

**Pendência:** nenhuma dessas classes tem ainda o material Revit com as quatro
definições completas (aparência, gráficos, corte, identidade). Ver
[`04-representacao-arquitetonica.md`](./04-representacao-arquitetonica.md) §4.5.

---

## 6.8 Louças, metais e equipamentos — `A MODELAR`

Inventariados nos arquivos de ambiente (Banheiro, Cozinha, Gourmet). Ficam neste módulo
quando forem transversais.

---

## 6.9 Decoração — regra — `APROVADO`

Vaso · quadro · tapete · almofada · objeto de mesa · vegetação · livro.

> **Toda decoração entra com `KMZ_Quantificar = Não` e em categoria de decoração
> (Entourage ou Modelo genérico), nunca em Mobiliário.**

Decoração misturada com mobiliário contamina o quantitativo e o orçamento. É a diferença
entre uma biblioteca de projeto e um acervo de cenário.

---

## 6.10 Pendências deste módulo

| # | Pendência |
|---|---|
| P-33 | Decidir a categoria da porta-balcão e da veneziana |
| P-34 | Decidir laje impermeabilizada: Telhado ou Piso |
| P-35 | Consultar norma de acessibilidade para escada e rampa (fonte primária) |
| P-36 | Definir a linha de esquadria de alumínio padrão |
| P-37 | **Modelar a marcenaria transversal antes dos ambientes** |
| P-38 | Criar os materiais com as 4 definições completas |
