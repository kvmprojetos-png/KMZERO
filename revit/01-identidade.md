# 01 — Identidade KMZERO

Documento: KMZ-ARQ-BIM-001 · Módulo 01 · **Rev.00** · `EM DESENVOLVIMENTO`

---

## 1.1 Escala cromática — `A VALIDAR` (ver conflito no manual §1.3)

### Marca

| Token | Hex | Uso | Procedência |
|---|---|---|---|
| `KMZ-PETROLEO-PROFUNDO` | `#00101A` | Grandes áreas chapadas, faixa de cabeçalho e rodapé de prancha, fundo de capa | Medido nas referências |
| `KMZ-PETROLEO` | `#052F3D` | Blocos, cabeçalho de tabela, carimbo, títulos | App KMZERO em produção |
| `KMZ-PETROLEO-CLARO` | `#0B7285` | Realce secundário, filetes internos, hover | App KMZERO em produção |
| `KMZ-DOURADO` | `#EF9D1C` | Acento: filetes, "ZERO" do wordmark, ícones, numeração de bloco | Medido nas referências |
| `KMZ-BRANCO` | `#FFFFFF` | Fundo de prancha, texto sobre petróleo | — |
| `KMZ-GRAFITE` | `#1F2937` | Texto corrido sobre branco | `A VALIDAR` — proposto |
| `KMZ-CINZA-BORDA` | `#E6EEF2` | Bordas, linhas de tabela, separadores | App KMZERO em produção |

### Cores semânticas de dado (nunca são cor de marca)

Herdadas da skill `kmzero-documentos`, que está correta neste ponto:

| Significado | Hex |
|---|---|
| OK / no prazo | `#2E7D32` |
| Atenção | `#E08A00` |
| Crítico | `#C0392B` |
| Planejado / baseline | `#6B7280` |

### Regra de ouro — `APROVADO`

> **O dourado nunca entra em dado.** Ele é a cor universal de atenção; usá-lo para
> representar uma informação neutra destrói a leitura do documento. Dourado vive
> exclusivamente na moldura: filetes, cabeçalho, rodapé, carimbo, numeração de bloco.

Mesma regra, dita ao contrário: **cor semântica nunca entra na moldura.** Um filete
vermelho numa prancha KMZERO significa que alguma coisa está crítica — não "detalhe
decorativo".

---

## 1.2 Wordmark — `APROVADO`

- Composição: **`KM` branco + `ZERO` dourado**, sem espaço entre as partes.
- Assinatura secundária: `ARQUITETURA`, caixa alta, tracking largo, peso leve,
  centralizada abaixo do wordmark.
- Fundo mínimo: só sobre `KMZ-PETROLEO-PROFUNDO`, `KMZ-PETROLEO` ou branco.
  **Nunca sobre foto sem tarja.**
- Área de respiro: no mínimo a altura do "K" em todos os lados. `A VALIDAR`.

---

## 1.3 Tipografia — `EM DESENVOLVIMENTO`

| Papel | Fonte | Observação |
|---|---|---|
| Documento técnico (A4) | **Arial** ou **Segoe UI** | Já definido na skill `kmzero-documentos` |
| Prancha e anotação Revit | `A VALIDAR` | Ver conflito abaixo |

**Ponto em aberto que precisa de decisão:** a skill de documentos usa Arial/Segoe UI,
mas as referências visuais das pranchas usam uma sans condensada de peso alto nos
títulos (`KMZ BANHEIRO`, `KMZ COZINHA`). Não consigo identificar a família tipográfica
a partir de imagem com confiança — **não vou chutar um nome de fonte.**

Duas saídas honestas:
1. Você informa a fonte usada na criação das pranchas; eu registro.
2. Adota-se Arial/Arial Narrow como padrão único (disponível em qualquer máquina e em
   qualquer instalação Revit, o que elimina o problema de fonte faltante em anotação).

**Recomendação:** opção 2. Fonte exótica em template Revit compartilhado é fonte de
retrabalho garantido — quem abrir o arquivo sem a fonte instalada vê a anotação
substituída e a prancha quebra.

---

## 1.4 Linguagem verbal — `APROVADO`

Extraído das referências aprovadas, onde aparece de forma consistente:

- **Assinatura de marca:** *"Do zero ao extraordinário."*
- **Proposta de valor:** *"Menos imprevisto · Mais controle · Mais lucro."*
- **Descritor:** *"Biblioteca inteligente para projetos reais."*
- **Pilares recorrentes:** Qualidade · Funcionalidade · Estética · Resultado
- **Cadeia de entrega:** Projeto → BIM → Execução → Resultado

Tom: premium, afirmativo, direto. Frase curta. Sem superlativo vazio.

---

## 1.5 Grid da prancha de ambiente — `APROVADO` (composição)

Estrutura observada nas cinco referências, consistente entre todas:

```
┌─────────────────────────────────────────────────────────────┐
│ FAIXA SUPERIOR  wordmark · descritor · pilares · proposta    │  petróleo profundo
├──────────────┬────────────────────────────┬─────────────────┤
│ TÍTULO       │                            │ CITAÇÃO         │
│ KMZ <AMB>    │      IMAGEM-HERÓI          │ + atributos     │
│ + descrição  │      (RENDER PREMIUM)      │ com ícone       │
│ + ícones     │                            │ + wordmark      │
├──────┬───────┴──────┬─────────────────────┴─────────────────┤
│  01  │      02      │            03                          │
│ CATÁ-│   CONTEXTO   │   VARIAÇÕES DE LAYOUT                  │
│ LOGO │              │                                        │
├──────┴──┬───────┬───┴────┬──────────────────────────────────┤
│   04    │  05   │   06   │            07                     │
│ PLANTA  │ DIMEN-│ FAMÍ-  │  MATERIAIS E ACABAMENTOS          │
│ LAYOUT  │ SÕES  │ LIAS   │                                   │
├─────────┼───────┼────────┼───────────────┬──────────────────┤
│   08    │  09   │   10   │      11       │       12          │
│ MARCE-  │ ILUMI-│ KITS   │ PARAMETRIZA-  │  DOCUMENTAÇÃO     │
│ NARIA   │ NAÇÃO │        │ ÇÃO BIM       │                   │
├─────────┴───────┴────────┴───────────────┴──────────────────┤
│ FAIXA INFERIOR  wordmark · cadeia de entrega · assinatura    │  petróleo profundo
└─────────────────────────────────────────────────────────────┘
```

**Regras da composição:**
- Numeração de bloco em **dourado**, dois dígitos (`01`…`12`), sempre no canto superior
  esquerdo do bloco.
- Título do bloco em caixa alta, petróleo; subtítulo em cinza, menor, mesma linha de base.
- Bloco 10 é flexível: é "KITS POR USO" na maioria, mas vira "ELETRODOMÉSTICOS" na
  cozinha. **A posição é fixa; o conteúdo se adapta ao ambiente.**
- Bloco 11 é sempre uma **tabela de parâmetros** — é o bloco que prova que a família
  é BIM de verdade e não decoração.

---

## 1.6 Pendências deste módulo

| # | Pendência |
|---|---|
| P-01 | Decisão dos hex oficiais (conflito imagens × app × skill) |
| P-07 | Definir a família tipográfica das pranchas |
| P-08 | Confirmar área de respiro do wordmark |
| P-09 | Confirmar `KMZ-GRAFITE` `#1F2937` para texto corrido |
