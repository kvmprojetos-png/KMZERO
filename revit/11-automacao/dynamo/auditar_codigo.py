# -*- coding: utf-8 -*-
"""
KMZERO — auditoria de KMZ_Codigo (no Python do Dynamo)
KMZ-ARQ-BIM-001 modulo 11 · Rev.00 · NAO TESTADO

Entrada  IN[0]: lista de elementos (All Elements of Category)
Entrada  IN[1]: nome do parametro a auditar (ex.: "KMZ_Codigo")
Saida    OUT  : lista de [Id, nome, valor, situacao]

Confira o cabecalho de importacao contra a sua versao do Dynamo antes de rodar.
"""
import re

import clr
clr.AddReference("RevitAPI")
from Autodesk.Revit.DB import BuiltInParameter  # noqa: E402

clr.AddReference("RevitNodes")
import Revit  # noqa: E402
clr.ImportExtensions(Revit.Elements)

AMBIENTES = [
    "SAL", "COZ", "SUI", "QRT", "BAN", "LVB", "CLS", "LAV",
    "GOU", "HOF", "VAR", "COR", "GAR", "DEP", "TER", "JAR",
    "ACM", "CIR", "GER",
]
PADRAO = re.compile(r"^KMZ-([A-Z]{3})-(\d{3})$")

elementos = IN[0] if isinstance(IN[0], list) else [IN[0]]
nome_param = IN[1] if len(IN) > 1 and IN[1] else "KMZ_Codigo"

resultado = []
for item in elementos:
    el = UnwrapElement(item)
    if el is None:
        continue

    try:
        nome = el.get_Parameter(BuiltInParameter.SYMBOL_NAME_PARAM).AsString()
    except Exception:
        nome = "(nome nao lido)"

    p = el.LookupParameter(nome_param)
    if p is None:
        resultado.append([el.Id.IntegerValue, nome, None, "PARAMETRO AUSENTE"])
        continue

    valor = p.AsString()
    if not valor:
        resultado.append([el.Id.IntegerValue, nome, valor, "VAZIO"])
        continue

    m = PADRAO.match(valor.strip())
    if not m:
        resultado.append([el.Id.IntegerValue, nome, valor, "FORA DO PADRAO KMZ-<AMB>-<NNN>"])
    elif m.group(1) not in AMBIENTES:
        resultado.append([el.Id.IntegerValue, nome, valor,
                          "AMBIENTE DESCONHECIDO: " + m.group(1)])
    else:
        resultado.append([el.Id.IntegerValue, nome, valor, "OK"])

OUT = resultado
