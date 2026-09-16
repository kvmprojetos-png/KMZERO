#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera os DXF (R12 ASCII) do padrao de prancha KMZERO, para uso como guia de
tracado no Editor de Familias do Revit.

Saida: docs/revit/dxf/KMZ-PRANCHA-<FORMATO>.dxf  (A0..A4, paisagem)
       docs/revit/dxf/KMZ-CARIMBO.dxf            (so a legenda, 175x65)

Geometria em MILIMETROS, escala 1:1. Textos em ASCII puro de proposito:
DXF R12 nao carrega encoding e acento vira lixo no import.
"""

import os

# ---------------------------------------------------------------- parametros

FORMATOS = {                      # paisagem (largura, altura) em mm
    "A0": (1189.0, 841.0),
    "A1": (841.0, 594.0),
    "A2": (594.0, 420.0),
    "A3": (420.0, 297.0),
    "A4": (297.0, 210.0),
}

MARGEM_ESQ = 20.0                 # borda de arquivamento
MARGEM     = 10.0                 # direita, superior, inferior

CAR_W, CAR_H = 175.0, 65.0        # carimbo: identico em todos os formatos
LINHAS = (16.0, 11.0, 26.0, 12.0) # alturas das 4 faixas, de cima para baixo

REV_H_CAB  = 7.0                  # cabecalho da tabela de revisoes
REV_H_LIN  = 6.0                  # cada linha de revisao
REV_N_LIN  = 5                    # linhas desenhadas como guia
REV_COLS   = (15.0, 25.0, 65.0, 23.0, 23.0, 24.0)   # soma = 175
REV_TIT    = ("REV", "DATA", "DESCRICAO", "ELABOROU", "VERIFICOU", "APROVOU")

H_ROTULO = 2.5                    # altura de texto dos rotulos fixos

LAYERS = (                        # (nome, cor ACI)
    ("KMZ-FOLHA",       8),       # borda externa do papel
    ("KMZ-MOLDURA",     7),       # quadro interno (linha grossa)
    ("KMZ-CARIMBO",     7),       # contorno da legenda
    ("KMZ-CARIMBO-DIV", 8),       # divisoes internas da legenda
    ("KMZ-REVISOES",    8),       # zona reservada da tabela de revisoes
    ("KMZ-ROTULO",      4),       # textos fixos dos campos
    ("KMZ-MARCA",       2),       # filete dourado / caixa do logo
)

# ------------------------------------------------------------------ DXF base

def _g(code, value):
    return "%d\n%s\n" % (code, value)

def linha(layer, x1, y1, x2, y2):
    return ("0\nLINE\n" + _g(8, layer)
            + _g(10, "%.4f" % x1) + _g(20, "%.4f" % y1) + _g(30, "0.0")
            + _g(11, "%.4f" % x2) + _g(21, "%.4f" % y2) + _g(31, "0.0"))

def retangulo(layer, x, y, w, h):
    return (linha(layer, x,     y,     x + w, y)
          + linha(layer, x + w, y,     x + w, y + h)
          + linha(layer, x + w, y + h, x,     y + h)
          + linha(layer, x,     y + h, x,     y))

def texto(layer, x, y, altura, conteudo):
    return ("0\nTEXT\n" + _g(8, layer)
            + _g(10, "%.4f" % x) + _g(20, "%.4f" % y) + _g(30, "0.0")
            + _g(40, "%.4f" % altura) + _g(1, conteudo))

def documento(entidades):
    tabela = "0\nSECTION\n" + _g(2, "TABLES") + "0\nTABLE\n" + _g(2, "LAYER") + _g(70, len(LAYERS))
    for nome, cor in LAYERS:
        tabela += ("0\nLAYER\n" + _g(2, nome) + _g(70, 0)
                   + _g(62, cor) + _g(6, "CONTINUOUS"))
    tabela += "0\nENDTAB\n0\nENDSEC\n"
    return (tabela + "0\nSECTION\n" + _g(2, "ENTITIES") + entidades
            + "0\nENDSEC\n0\nEOF\n")

# ---------------------------------------------------------------- componentes

def carimbo(x0, y0):
    """Legenda 175x65 com canto inferior esquerdo em (x0, y0)."""
    e = retangulo("KMZ-CARIMBO", x0, y0, CAR_W, CAR_H)

    # bordas horizontais das faixas, de cima para baixo
    y = y0 + CAR_H
    ys = [y]
    for altura in LINHAS:
        y -= altura
        ys.append(y)
        if y > y0 + 0.01:
            e += linha("KMZ-CARIMBO-DIV", x0, y, x0 + CAR_W, y)

    # filete dourado sob a faixa de identificacao
    e += linha("KMZ-MARCA", x0, ys[1], x0 + CAR_W, ys[1])

    # divisores verticais por faixa
    for topo, base, cortes in (
            (ys[0], ys[1], (55.0,)),                       # logo | nome da prancha
            (ys[1], ys[2], (120.0,)),                      # obra/contrato | status
            (ys[2], ys[3], (40.0, 80.0, 120.0)),           # elaborou|verificou|aprovou|RT
            (ys[3], ys[4], (55.0, 85.0, 105.0, 135.0))):   # codigo|data|rev|escala|folha
        for dx in cortes:
            e += linha("KMZ-CARIMBO-DIV", x0 + dx, base, x0 + dx, topo)

    # caixa reservada ao logo
    e += retangulo("KMZ-MARCA", x0 + 4.0, ys[1] + 3.0, 47.0, LINHAS[0] - 6.0)
    e += texto("KMZ-MARCA", x0 + 6.0, ys[1] + 6.0, 3.0, "LOGO KMZERO")

    # rotulos fixos: (faixa, offset x, texto)
    rotulos = (
        (0,  57.0, "NOME DA PRANCHA"),
        (1,   2.0, "OBRA / CONTRATO"),
        (1, 122.0, "STATUS"),
        (2,   2.0, "ELABOROU"),
        (2,  42.0, "VERIFICOU"),
        (2,  82.0, "APROVOU"),
        (2, 122.0, "RESPONSAVEL TECNICO / CREA"),
        (3,   2.0, "DOCUMENTO No"),
        (3,  57.0, "DATA"),
        (3,  87.0, "REV"),
        (3, 107.0, "ESCALA"),
        (3, 137.0, "FOLHA"),
    )
    for faixa, dx, rotulo in rotulos:
        e += texto("KMZ-ROTULO", x0 + dx, ys[faixa] - H_ROTULO - 1.5, H_ROTULO, rotulo)
    return e

def tabela_revisoes(x0, y0):
    """Zona reservada a Tabela de Revisoes nativa do Revit, acima do carimbo."""
    altura = REV_H_CAB + REV_H_LIN * REV_N_LIN
    e = retangulo("KMZ-REVISOES", x0, y0, CAR_W, altura)

    # cabecalho fica embaixo: a tabela do Revit cresce para cima
    e += linha("KMZ-REVISOES", x0, y0 + REV_H_CAB, x0 + CAR_W, y0 + REV_H_CAB)
    for i in range(1, REV_N_LIN):
        y = y0 + REV_H_CAB + REV_H_LIN * i
        e += linha("KMZ-REVISOES", x0, y, x0 + CAR_W, y)

    dx = 0.0
    for i, largura in enumerate(REV_COLS):
        if i:
            e += linha("KMZ-REVISOES", x0 + dx, y0, x0 + dx, y0 + altura)
        e += texto("KMZ-ROTULO", x0 + dx + 1.5, y0 + 2.0, H_ROTULO, REV_TIT[i])
        dx += largura
    return e

def prancha(nome, largura, altura):
    e  = retangulo("KMZ-FOLHA", 0.0, 0.0, largura, altura)

    ix, iy = MARGEM_ESQ, MARGEM
    iw = largura - MARGEM_ESQ - MARGEM
    ih = altura - 2 * MARGEM
    e += retangulo("KMZ-MOLDURA", ix, iy, iw, ih)

    cx = ix + iw - CAR_W
    e += carimbo(cx, iy)
    e += tabela_revisoes(cx, iy + CAR_H)
    e += texto("KMZ-ROTULO", ix + 2.0, iy + ih - 5.0, 3.5, "KMZ-PRANCHA-" + nome)
    return e

# ------------------------------------------------------------------- execucao

def main():
    destino = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dxf")
    os.makedirs(destino, exist_ok=True)

    gerados = []
    for nome, (largura, altura) in FORMATOS.items():
        caminho = os.path.join(destino, "KMZ-PRANCHA-%s.dxf" % nome)
        with open(caminho, "w") as fh:
            fh.write(documento(prancha(nome, largura, altura)))
        gerados.append((caminho, largura, altura))

    caminho = os.path.join(destino, "KMZ-CARIMBO.dxf")
    with open(caminho, "w") as fh:
        fh.write(documento(carimbo(0.0, 0.0) + tabela_revisoes(0.0, CAR_H)))
    gerados.append((caminho, CAR_W, CAR_H + REV_H_CAB + REV_H_LIN * REV_N_LIN))

    for caminho, largura, altura in gerados:
        print("%-28s %7.1f x %6.1f mm  %6d bytes"
              % (os.path.basename(caminho), largura, altura, os.path.getsize(caminho)))

if __name__ == "__main__":
    main()
