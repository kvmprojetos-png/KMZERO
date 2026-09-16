# Matriz Oficial de Ambiente KMZERO

Documento: KMZ-ARQ-BIM-001 · Módulo 07 · **Rev.00** · `APROVADO`

---

## A sequência — `APROVADO`

Todo ambiente KMZERO é desenvolvido nesta ordem, sem pular etapa:

```
01 Famílias  →  02 L1/L2/L3  →  03 Dimensões  →  04 Posicionamento  →  05 Ergonomia
     →  06 Materiais  →  07 Marcenaria  →  08 Iluminação  →  09 Decoração
     →  10 Kits  →  11 BIM/Revit  →  12 Documentação  →  13 Renderização
```

A ordem não é arbitrária. Ela vai do **objeto** ao **dado** ao **entregável**: primeiro
se define o que existe, depois como se comporta no espaço, depois o que ele informa, e
só então como aparece. Começar pela renderização — que é a tentação — produz biblioteca
bonita e inútil.

## O que cada etapa entrega

| # | Etapa | Entregável concreto |
|---|---|---|
| 01 | **Famílias** | Lista fechada de componentes do ambiente, cada um com `KMZ_Codigo` |
| 02 | **L1/L2/L3** | Definição de qual nível cada família terá e quando |
| 03 | **Dimensões** | Tabela de dimensões por tipo, com procedência de cada número |
| 04 | **Posicionamento** | Regra de hospedagem, altura de instalação, ponto de inserção |
| 05 | **Ergonomia** | Alturas de uso, alcance, circulação mínima — **com fonte** |
| 06 | **Materiais** | Paleta do ambiente mapeada para materiais `KMZ_*` |
| 07 | **Marcenaria** | Soluções internas: gavetas, divisórias, organizadores, ferragem |
| 08 | **Iluminação** | Tipos de luz, posição, temperatura de cor, fotometria |
| 09 | **Decoração** | Objetos de cena — categoria separada, **nunca quantificados como projeto** |
| 10 | **Kits** | Composições Básico / Conforto / Premium |
| 11 | **BIM/Revit** | Parâmetros do ambiente, tabelas, filtros, view templates |
| 12 | **Documentação** | Pranchas que o ambiente gera |
| 13 | **Renderização** | Os três níveis: CATÁLOGO, CONTEXTO, PREMIUM |

## Os três kits — `APROVADO`

| Kit | Definição |
|---|---|
| **BÁSICO** | Essencial e funcional. O que o ambiente precisa para funcionar. |
| **CONFORTO** | Mais praticidade. Acrescenta organização, automação simples, acabamento melhor. |
| **PREMIUM** | Sofisticação total. Materiais nobres, iluminação cênica, detalhamento completo. |

Os kits são **composições de famílias já existentes**, não famílias novas. Um kit é uma
lista + um conjunto de tipos escolhidos. Isso é o que permite orçar três níveis de
proposta para o mesmo cliente sem remodelar nada.

## Os três níveis de render — `APROVADO`

| Nível | Enquadramento | Fundo | Uso |
|---|---|---|---|
| **CATÁLOGO** | Objeto isolado | Neutro | Ficha de família, catálogo |
| **CONTEXTO** | Aplicado no ambiente, escala correta | Ambiente real | Proposta, apresentação |
| **PREMIUM** | Ambiente completo, atmosfera | Iluminação real | Venda, portfólio, social |

## Template de arquivo de ambiente

Ao abrir um ambiente novo, copie a estrutura de qualquer arquivo desta pasta. Todos
seguem o mesmo esqueleto, na ordem da matriz, com:

1. Cabeçalho com código, revisão e status
2. Bloco de **referência visual** com a identificação obrigatória
3. As 13 etapas, cada uma com status próprio
4. Tabela de pendências ao final

**Regra de transcrição:** dado lido de imagem entra marcado `A VALIDAR`, com a coluna
"Procedência" preenchida como *"transcrito da referência visual"*. Nunca como `APROVADO`.
