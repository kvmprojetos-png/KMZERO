# Dynamo — KMZERO

**Não há `.dyn` nesta revisão.** O motivo está em [`../README.md`](../README.md)
§Sobre o Dynamo: um grafo escrito sem o Dynamo instalado provavelmente não abre, e um
arquivo que não abre custa mais tempo do que economiza.

O que há aqui é a **lógica pronta para colar num nó Python** dentro de um grafo que você
monta em dois minutos.

## Grafo mínimo

```
[ String: "KMZ_Codigo" ] ──┐
                           ├──> [ Python Script ] ──> [ Watch ]
[ Categories / All Elements of Category ] ──┘
```

## Código do nó Python

Ver [`auditar_codigo.py`](./auditar_codigo.py).

**Não testado.** Duas coisas variam com a versão do Dynamo e precisam de conferência:

- O cabeçalho de importação (`clr`, `RevitServices`, `Revit.Elements`) mudou entre
  versões do Dynamo.
- `UnwrapElement` é necessário para converter o elemento Dynamo em elemento da API do
  Revit. Se você passar o elemento sem desembrulhar, a chamada a `LookupParameter` falha.

## Por que pyRevit em vez de Dynamo, para este padrão

Para auditoria e relatório, **pyRevit é a ferramenta melhor**: o script é um `.py` de
texto puro, que o Git versiona, compara e faz *merge* — exatamente como qualquer código.
Um `.dyn` é JSON gerado por máquina: o Git guarda, mas o *diff* é ilegível e o *merge* é
inviável na prática.

Dynamo continua sendo o caminho certo para o que é **geométrico e paramétrico** —
popular fachada, distribuir elementos ao longo de curva, gerar variação de forma. Use
cada um no que ele é bom.
