# Controle de Revisões — Manual de Padrões BIM/Revit KMZERO

Documento: **KMZ-ARQ-BIM-001**

Regra: **módulo novo não reescreve o manual.** Entra como revisão incremental, com
arquivo próprio e uma linha nesta tabela.

| Rev. | Data | Módulo afetado | O que mudou | Decidido por | Status |
|---|---|---|---|---|---|
| **00** | 2026-09 | Estrutura completa | Criação do working standard: identidade, documentação, anotações, representação, biblioteca L1/L2/L3, componentes, matriz de ambientes, nomenclatura, parâmetros compartilhados, especificação `.RTE`, automação. 5 ambientes iniciados (Banheiro, Cozinha, Closet, Home Office, Gourmet) a partir de referências visuais aprovadas. | Kleber V. Martins | Vigente |

## Fila de revisões previstas

| Rev. prevista | Módulo | Observação |
|---|---|---|
| Rev.01 | **Forros KMZERO** | Já sinalizado como próximo módulo |
| Rev.02 | **Fachadas KMZERO** | — |
| Rev.03 | Paisagismo / áreas externas | — |
| Rev.04 | Áreas comuns (edifícios) | — |
| — | Ambientes restantes | Ver [`07-ambientes/_BACKLOG.md`](./07-ambientes/_BACKLOG.md) |

## Pendências abertas de Rev.00

| # | Pendência | Bloqueia | Responsável |
|---|---|---|---|
| P-01 | **Decidir os hex oficiais de marca** (conflito entre imagens, app e skill) | Template `.RTE`, carimbo, materiais de render | Resp. técnico |
| P-02 | Corrigir os hex placeholder na skill `kmzero-documentos` (`#14253F` / `#C9A227`) | Coerência entre documento técnico e projeto | Resp. técnico |
| P-03 | Validar todas as cotas marcadas `A VALIDAR` nos arquivos de ambiente | Uso em projeto executivo | Resp. técnico |
| P-04 | Confirmar edição vigente da NBR 16752 e o que ela substituiu | §02 Documentação e folhas | Resp. técnico |
| P-05 | Definir versão-alvo do Revit (afeta formato `.RTE` e API de automação) | §10 e §11 | Resp. técnico |
| P-06 | Testar os scripts de automação dentro do Revit | §11 | Resp. técnico |

## Como abrir uma revisão

1. Crie o arquivo do módulo novo (ou edite o existente).
2. Acrescente a linha nesta tabela com número, data, o que mudou e quem decidiu.
3. Atualize o índice em `MANUAL-PADROES-BIM-REVIT.md` §0.
4. Se a mudança rebaixa ou altera um item `APROVADO`, diga explicitamente o que foi
   substituído — nunca apague a decisão anterior sem registro.
