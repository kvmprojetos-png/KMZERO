# -*- coding: utf-8 -*-
"""
KMZERO — Auditar Familias
KMZ-ARQ-BIM-001 · Modulo 11 · Rev.00

SOMENTE LEITURA. Este script nao abre transacao e nao altera o modelo.

STATUS: NAO TESTADO DENTRO DO REVIT. Ver ../../../../README.md, secao de aviso.
Pontos que podem exigir ajuste na primeira execucao:
  - leitura de nome via BuiltInParameter (pendencia P-45)
  - versao-alvo do Revit ainda nao definida (pendencia P-05)
"""
import re

from pyrevit import revit, DB, script

__title__ = "Auditar\nFamilias"
__author__ = "KMZERO Arquitetura"

output = script.get_output()
doc = revit.doc

# --- Padrao KMZERO -----------------------------------------------------------
# Modulo 08, item 8.2. HOF (nao HO): divergencia da referencia visual resolvida
# a favor de tres letras para todos os ambientes.
AMBIENTES = set([
    "SAL", "COZ", "SUI", "QRT", "BAN", "LVB", "CLS", "LAV",
    "GOU", "HOF", "VAR", "COR", "GAR", "DEP", "TER", "JAR",
    "ACM", "CIR", "GER",
])
RE_CODIGO = re.compile(r"^KMZ-([A-Z]{3})-(\d{3})$")
NIVEIS = set(["L1", "L2", "L3"])
RE_NOME_LIMPO = re.compile(r"^[A-Za-z0-9_\-\.]+$")


def texto(elemento, nome_parametro):
    """Le um parametro de texto. Devolve None se ausente ou vazio."""
    p = elemento.LookupParameter(nome_parametro)
    if p is None:
        return None
    try:
        v = p.AsString()
    except Exception:
        return None
    if v is None or not v.strip():
        return None
    return v.strip()


def nome_do_tipo(simbolo):
    """Nome do tipo via BuiltInParameter.

    Element.Name conflita com atributos do Python em algumas versoes do
    pyRevit; BuiltInParameter e o caminho robusto. Pendencia P-45.
    """
    try:
        p = simbolo.get_Parameter(DB.BuiltInParameter.SYMBOL_NAME_PARAM)
        if p is not None:
            v = p.AsString()
            if v:
                return v
    except Exception:
        pass
    try:
        return DB.Element.Name.GetValue(simbolo)
    except Exception:
        return "(nome nao lido)"


def coletar_simbolos():
    return (DB.FilteredElementCollector(doc)
              .OfClass(DB.FamilySymbol)
              .WhereElementIsElementType()
              .ToElements())


def coletar_in_place():
    """Familias modeladas no local. Modulo 05, regra 5.5.3."""
    achados = []
    for fam in DB.FilteredElementCollector(doc).OfClass(DB.Family).ToElements():
        try:
            if fam.IsInPlace:
                achados.append(fam)
        except Exception:
            # IsInPlace pode nao existir em versoes antigas da API.
            pass
    return achados


def auditar():
    problemas = {
        "Sem KMZ_Codigo": [],
        "KMZ_Codigo fora do padrao": [],
        "Ambiente desconhecido": [],
        "KMZ_Familia_Nivel invalido": [],
        "Sem KMZ_Quantificar": [],
        "Nome com acento ou espaco": [],
    }

    simbolos = coletar_simbolos()
    for s in simbolos:
        try:
            nome_familia = s.Family.Name
        except Exception:
            nome_familia = "(familia nao lida)"
        rotulo = "{0} : {1}".format(nome_familia, nome_do_tipo(s))

        codigo = texto(s, "KMZ_Codigo")
        if codigo is None:
            problemas["Sem KMZ_Codigo"].append((s.Id, rotulo, "-"))
        else:
            m = RE_CODIGO.match(codigo)
            if not m:
                problemas["KMZ_Codigo fora do padrao"].append((s.Id, rotulo, codigo))
            elif m.group(1) not in AMBIENTES:
                problemas["Ambiente desconhecido"].append((s.Id, rotulo, m.group(1)))

        nivel = texto(s, "KMZ_Familia_Nivel")
        if nivel is not None and nivel.upper() not in NIVEIS:
            problemas["KMZ_Familia_Nivel invalido"].append((s.Id, rotulo, nivel))

        if s.LookupParameter("KMZ_Quantificar") is None:
            problemas["Sem KMZ_Quantificar"].append((s.Id, rotulo, "-"))

        if not RE_NOME_LIMPO.match(nome_familia):
            problemas["Nome com acento ou espaco"].append((s.Id, rotulo, nome_familia))

    return simbolos, problemas


def relatar(simbolos, problemas, in_place):
    output.print_md("# KMZERO — Auditoria de Famílias")
    output.print_md(
        "Padrão **KMZ-ARQ-BIM-001 Rev.00** · somente leitura · "
        "**script não testado**, confira os achados antes de agir."
    )
    output.print_md("---")

    total_problemas = sum(len(v) for v in problemas.values()) + len(in_place)
    output.print_md("**Tipos analisados:** {0}".format(len(simbolos)))
    output.print_md("**Ocorrências encontradas:** {0}".format(total_problemas))
    output.print_md("---")

    if total_problemas == 0:
        output.print_md("## ✅ Nenhuma ocorrência")
        output.print_md(
            "Atenção: isso pode significar que o modelo está conforme, **ou** que os "
            "parâmetros KMZERO ainda não foram aplicados às famílias. "
            "Se `Sem KMZ_Codigo` veio zerado num modelo que você sabe que não usa o "
            "padrão, o arquivo de parâmetros compartilhados provavelmente não foi "
            "carregado. Ver módulo 09."
        )
        return

    for titulo, itens in problemas.items():
        if not itens:
            continue
        output.print_md("## {0} — {1}".format(titulo, len(itens)))
        linhas = []
        for eid, rotulo, valor in itens:
            linhas.append([output.linkify(eid), rotulo, valor])
        output.print_table(
            table_data=linhas,
            title="",
            columns=["Id", "Família : Tipo", "Valor"],
        )

    if in_place:
        output.print_md("## Famílias in-place — {0}".format(len(in_place)))
        output.print_md(
            "Modelo no local não é reutilizável nem versionável e infla o arquivo. "
            "Regra 5.5.3: não entra na biblioteca."
        )
        linhas = []
        for fam in in_place:
            try:
                nome = fam.Name
            except Exception:
                nome = "(nome nao lido)"
            linhas.append([output.linkify(fam.Id), nome])
        output.print_table(table_data=linhas, title="", columns=["Id", "Família"])


if __name__ == "__main__":
    _simbolos, _problemas = auditar()
    relatar(_simbolos, _problemas, coletar_in_place())
