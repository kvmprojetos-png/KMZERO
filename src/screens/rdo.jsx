import { MODELOS_CRONOGRAMA } from "./equipe.jsx";
import { useState, useEffect, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { NAVY, NAVY2, GOLD, GREEN, RED, ORANGE, BLUE, LIGHT, labelS, inputS, dateS, selS, bigBtn, css, T } from "../theme.js";
import { useTema } from "../lib/useTema.js";
import { hojeStr, fmtData, ultimosDias, dataPascoa, feriadosDoAno, feriadoEm, dataLocalIso, precoAlim, somaAlim, faltaPrecoAlim } from "../utils.js";
import { cloudRefs, enviarFotoNuvem, observarFotosNuvem, semUndefined, enviarDocNuvem, removerDocNuvem, observarColecaoNuvem, store } from "../lib/store.js";
import { FILE_DB_VERSION, FILE_STORE_NAME, openFileDB, fileStore, lerArquivoComoBase64, formatarTamanhoBytes, iconePorTipoArquivo } from "../lib/fileStore.js";
import { carregarScript, carregarPDFLibs, KM_PDF_PAGE_CSS, KM_PDF_CSS, gerarHeaderHTML, gerarFooterHTML, gerarAssinaturasHTML, fmtQtd, abrirOuBaixarHTML } from "../lib/pdf.js";
import { DEFAULT_FORNECEDORES, DEFAULT_OBRAS, DEFAULT_TRABALHADORES, gerarDadosMes30Dias, DEFAULT_EQUIPS, CARGOS, detectarUnidade, CATALOGO_KM_FULL, CAT_KM_BUSCA, CAT_KM_CATEGORIAS, CAT_KM_SUBCATEGORIAS, MATERIAIS_BANCO_DETALHADO, MATERIAIS_BANCO, MATERIAIS, CATALOGO_FROTA, CATALOGO_FROTA_NOMES, CATALOGO_EQUIPAMENTOS, CATALOGO_EQUIPAMENTOS_NOMES, MATERIAL_INFO, EQUIP_COLOR, STATUS_COLOR, EMPRESA_TEMPLATE, DEFAULT_FUNC_ESCRITORIO, DEFAULT_ATIVOS, VALOR_HORA_CARGO } from "../data/catalogos.js";
import { Badge, Btn, EmptyState, KMHeader, KMFooter, FotoViewer, Modal, confirmar, Assinatura, Grade } from "../components/ui.jsx";

export function TelaCronograma({ obras, cronogramas, onBack, onSalvar, empresa: empresaProp }) {
  const [obraId, setObraId] = useState(obras[0]?.id || 1);
  // Empresa cliente para o documento: vem por prop; sem prop, lê a mesma chave que o app grava (Sistema → Empresa)
  const [empresaStore, setEmpresaStore] = useState(null);
  useEffect(() => {
    if (empresaProp) return;
    let vivo = true;
    Promise.resolve(store.get("empresa")).then(e => { if (vivo && e && typeof e === "object") setEmpresaStore(e); }).catch(() => {});
    return () => { vivo = false; };
  }, [empresaProp]);
  const empresa = empresaProp || empresaStore || {};
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);

  const obra = obras.find(o => o.id === obraId);
  const etapas = cronogramas[obraId] || [];
  const obraTipo = obra?.tipo || "Edificação";

  const aplicarModelo = (tipo) => {
    if (etapas.length > 0 && !confirm(`Já existem ${etapas.length} etapas. Substituir tudo pelo modelo ${tipo}?`)) return;
    const dataInicio = new Date();
    let dataAtual = new Date(dataInicio);
    const novas = MODELOS_CRONOGRAMA[tipo].map((e, i) => {
      const ini = new Date(dataAtual);
      const fim = new Date(dataAtual);
      fim.setDate(fim.getDate() + e.duracao);
      dataAtual = new Date(fim);
      dataAtual.setDate(dataAtual.getDate() + 1);
      return {
        id: Date.now() + i,
        nome: e.nome,
        ordem: i,
        inicio: dataLocalIso(ini),
        fim: dataLocalIso(fim),
        progresso: 0,
        responsavel: "",
        obs: "",
      };
    });
    onSalvar(obraId, novas);
  };

  const salvarEtapa = (etapa) => {
    const ja = etapas.find(e => e.id === etapa.id);
    let novas;
    if (ja) {
      novas = etapas.map(e => e.id === etapa.id ? etapa : e);
    } else {
      novas = [...etapas, { ...etapa, ordem: etapas.length, id: Date.now() }];
    }
    onSalvar(obraId, novas);
    setModal(false);
    setEditando(null);
  };

  const removerEtapa = (id) => {
    if (!confirm("Remover esta etapa?")) return;
    onSalvar(obraId, etapas.filter(e => e.id !== id));
  };

  const moverEtapa = (id, direcao) => {
    const idx = etapas.findIndex(e => e.id === id);
    if (idx < 0) return;
    const novoIdx = idx + direcao;
    if (novoIdx < 0 || novoIdx >= etapas.length) return;
    const arr = [...etapas];
    [arr[idx], arr[novoIdx]] = [arr[novoIdx], arr[idx]];
    onSalvar(obraId, arr.map((e, i) => ({ ...e, ordem: i })));
  };

  const setProgresso = (id, valor) => {
    onSalvar(obraId, etapas.map(e => e.id === id ? { ...e, progresso: valor } : e));
  };

  const progressoGeral = etapas.length > 0
    ? Math.round(etapas.reduce((s, e) => s + (e.progresso || 0), 0) / etapas.length)
    : 0;

  const exportarPDF = () => {
    if (etapas.length === 0) { alert("Nenhuma etapa cadastrada."); return; }
    const fmt = d => d ? d.toLocaleDateString("pt-BR") : "—";
    const concluidas = etapas.filter(e => (e.progresso || 0) === 100).length;
    const andamento = etapas.filter(e => (e.progresso || 0) > 0 && (e.progresso || 0) < 100).length;
    const naoIniciadas = etapas.length - concluidas - andamento;
    const inicios = etapas.map(e => _dataLocalDoc(e.inicio)).filter(Boolean).map(d => d.getTime());
    const fins = etapas.map(e => _dataLocalDoc(e.fim)).filter(Boolean).map(d => d.getTime());
    const periodo = inicios.length && fins.length ? `${fmt(new Date(Math.min(...inicios)))} a ${fmt(new Date(Math.max(...fins)))}` : "";
    const html = `<html><head><meta charset="UTF-8"><title>Cronograma - ${_escDoc(obra.nome)}</title>
      <style>
        ${KM_PDF_PAGE_CSS}
        ${KM_PDF_CSS}
        .quadro tbody tr.total td { background: #fff7df; }
        .quadro td .obs { display: block; font-size: 7.5pt; color: #5c6b73; margin-top: 1px; }
      </style></head><body>
      ${gerarHeaderHTML({ tipo: "Cronograma da Obra", periodo, info_extra: `${obra.nome}${obra.local ? " · " + obra.local : ""}${obra.status ? " · " + obra.status : ""}`, empresa })}

      <div class="kpis">
        <div class="kpi"><b>${progressoGeral}%</b><span>Progresso geral</span></div>
        <div class="kpi"><b>${etapas.length}</b><span>Etapas</span></div>
        <div class="kpi ok"><b>${concluidas}</b><span>Concluídas</span></div>
        <div class="kpi alerta"><b>${andamento}</b><span>Em andamento</span></div>
      </div>

      <div class="sec">Etapas do projeto <small>${naoIniciadas} não iniciada${naoIniciadas === 1 ? "" : "s"}</small></div>
      <table class="quadro">
        <thead><tr><th style="width:5%" class="num">Nº</th><th style="width:34%">Etapa</th><th style="width:13%" class="centro">Início</th><th style="width:13%" class="centro">Fim</th><th style="width:7%" class="num">Dias</th><th style="width:12%" class="num">Progresso</th><th style="width:16%">Responsável</th></tr></thead>
        <tbody>
        ${etapas.map((e, i) => {
          const ini = _dataLocalDoc(e.inicio), fim = _dataLocalDoc(e.fim); // local (new Date("YYYY-MM-DD") voltava um dia)
          const dias = ini && fim ? Math.round((fim - ini) / 86400000) : null;
          const p = e.progresso || 0;
          const cls = p === 100 ? "txt-ok" : p > 0 ? "txt-alerta" : "txt-cinza";
          return `<tr><td class="num">${i + 1}</td><td><b>${_escDoc(e.nome)}</b>${e.obs ? `<span class="obs">${_escDoc(e.obs)}</span>` : ""}</td><td class="centro">${fmt(ini)}</td><td class="centro">${fmt(fim)}</td><td class="num">${dias === null ? "—" : dias + "d"}</td><td class="num ${cls}"><b>${p}%</b></td><td>${_escDoc(e.responsavel) || "—"}</td></tr>`;
        }).join("")}
        <tr class="total"><td colspan="5">Progresso geral (média das etapas)</td><td class="num">${progressoGeral}%</td><td></td></tr>
        </tbody>
      </table>
      ${gerarFooterHTML({ empresa })}
    </body></html>`;
    abrirOuBaixarHTML(html, `Cronograma-${String(obra.nome || "obra").replace(/[^a-z0-9]/gi, "_").substring(0, 25)}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Cronograma" sub="Etapas da obra" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: T.fundo, padding: 14 }}>
        <label style={labelS}>Obra</label>
        <select value={obraId} onChange={e => setObraId(parseInt(e.target.value))} style={selS}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        {/* Card de progresso geral */}
        <div style={{ background: `linear-gradient(135deg,${NAVY},${NAVY2})`, color: "#fff", borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 11, opacity: 0.85 }}>Progresso geral da obra</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: GOLD }}>{progressoGeral}%</div>
          <div style={{ height: 8, background: "rgba(255,255,255,0.2)", borderRadius: 4, marginTop: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progressoGeral}%`, background: GOLD, transition: "width 0.3s" }}></div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 6 }}>{etapas.filter(e => e.progresso === 100).length} de {etapas.length} etapas concluídas</div>
        </div>

        {/* Modelos prontos */}
        {etapas.length === 0 && (
          <div style={{ background: T.superficie, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: T.sombra }}>
            <div style={{ fontWeight: 800, color: T.titulo, fontSize: 13, marginBottom: 8 }}>🚀 Começar com modelo pronto</div>
            <div style={{ fontSize: 11, color: T.texto2, marginBottom: 10 }}>Aplica um modelo padrão de etapas baseado no tipo da obra (você pode editar depois).</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => aplicarModelo("Pavimentação")} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: ORANGE, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>🛣️ Pavimentação</button>
              <button onClick={() => aplicarModelo("Edificação")} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: BLUE, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>🏢 Edificação</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button onClick={() => { setEditando({ nome: "", inicio: "", fim: "", progresso: 0, responsavel: "", obs: "" }); setModal(true); }} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: NAVY, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>➕ Nova Etapa</button>
          {etapas.length > 0 && (
            <button onClick={exportarPDF} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: GOLD, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>📄 PDF</button>
          )}
        </div>

        {/* Lista de etapas */}
        {etapas.length === 0 ? (
          <EmptyState
            icon="📋"
            titulo="Nenhuma etapa cadastrada"
            subtitulo="Use um modelo pronto (Casa, Sobrado, Prédio) ou adicione manualmente. Cada etapa terá controle de progresso e prazo."
            cor={ORANGE}
          />
        ) : etapas.map((e, i) => {
          // Etapa não iniciada: cinza do tema (o #aaa fixo sumia no fundo escuro e era fraco no claro)
          const cor = e.progresso === 100 ? GREEN : e.progresso > 0 ? ORANGE : T.texto3;
          const concluida = e.progresso === 100;
          return (
            <div key={e.id} style={{ background: T.superficie, borderRadius: 12, padding: "12px 14px", marginBottom: 8, boxShadow: T.sombra, borderLeft: `4px solid ${cor}`, opacity: concluida ? 0.75 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 14, background: cor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, marginRight: 10 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: T.titulo, fontSize: 13, textDecoration: concluida ? "line-through" : "none" }}>{e.nome}</div>
                  <div style={{ fontSize: 10, color: T.texto2 }}>
                    {e.inicio && new Date(e.inicio).toLocaleDateString("pt-BR")}
                    {e.inicio && e.fim && " → "}
                    {e.fim && new Date(e.fim).toLocaleDateString("pt-BR")}
                    {e.responsavel && ` • ${e.responsavel}`}
                  </div>
                </div>
                <button onClick={() => moverEtapa(e.id, -1)} disabled={i === 0} style={{ background: "none", border: "none", color: i === 0 ? T.desabilitado : T.texto2, cursor: i === 0 ? "default" : "pointer", fontSize: 16 }}>↑</button>
                <button onClick={() => moverEtapa(e.id, 1)} disabled={i === etapas.length - 1} style={{ background: "none", border: "none", color: i === etapas.length - 1 ? T.desabilitado : T.texto2, cursor: i === etapas.length - 1 ? "default" : "pointer", fontSize: 16 }}>↓</button>
              </div>

              {/* Barra de progresso */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <input
                  type="range" min="0" max="100" step="10"
                  value={e.progresso || 0}
                  onChange={ev => setProgresso(e.id, parseInt(ev.target.value))}
                  style={{ flex: 1, accentColor: cor }}
                />
                <span style={{ fontSize: 12, fontWeight: 800, color: cor, minWidth: 40, textAlign: "right" }}>{e.progresso || 0}%</span>
              </div>

              {e.obs && <div style={{ fontSize: 11, color: T.texto2, fontStyle: "italic", marginTop: 4, paddingLeft: 38 }}>"{e.obs}"</div>}

              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button onClick={() => { setEditando(e); setModal(true); }} style={{ flex: 1, padding: 6, borderRadius: 6, border: `1px solid ${BLUE}`, background: T.superficie, color: BLUE, fontWeight: 700, cursor: "pointer", fontSize: 10 }}>✏️ Editar</button>
                <button onClick={() => removerEtapa(e.id)} style={{ padding: 6, borderRadius: 6, border: `1px solid ${RED}`, background: T.superficie, color: RED, fontWeight: 700, cursor: "pointer", fontSize: 10, width: 50 }}>🗑️</button>
              </div>
            </div>
          );
        })}
      </div>
      <KMFooter />

      <Modal show={modal} title={editando?.id ? "Editar Etapa" : "Nova Etapa"} onClose={() => { setModal(false); setEditando(null); }}>
        {editando && (
          <>
            <label style={labelS}>Nome da etapa</label>
            <input value={editando.nome || ""} onChange={ev => setEditando(e => ({ ...e, nome: ev.target.value }))} placeholder="Ex: Sondagem e topografia" style={inputS} />
            <label style={labelS}>Data início</label>
            <input value={editando.inicio || ""} onChange={ev => setEditando(e => ({ ...e, inicio: ev.target.value }))} type="date" style={dateS} />
            <label style={labelS}>Data fim prevista</label>
            <input value={editando.fim || ""} onChange={ev => setEditando(e => ({ ...e, fim: ev.target.value }))} type="date" style={dateS} />
            <label style={labelS}>Progresso (%)</label>
            <select value={editando.progresso || 0} onChange={ev => setEditando(e => ({ ...e, progresso: parseInt(ev.target.value) }))} style={selS}>
              {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => <option key={p} value={p}>{p}%</option>)}
            </select>
            <label style={labelS}>Responsável (opcional)</label>
            <input value={editando.responsavel || ""} onChange={ev => setEditando(e => ({ ...e, responsavel: ev.target.value }))} placeholder="Ex: Geovane" style={inputS} />
            <label style={labelS}>Observações (opcional)</label>
            <textarea value={editando.obs || ""} onChange={ev => setEditando(e => ({ ...e, obs: ev.target.value }))} rows={3} placeholder="Detalhes, obs técnicas..." style={{ ...inputS, fontFamily: "inherit" }} />
            <Btn label="💾 SALVAR" color={GREEN} onClick={() => { if (editando.nome) salvarEtapa(editando); }} />
          </>
        )}
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CRONOGRAMA PRO — Curva S, IDP, alertas, caminho crítico
   Visão executiva pra fiscalização e relatórios profissionais
══════════════════════════════════════════════════════════════════════ */

const _parseISO = (s) => { const d = new Date(s + "T00:00:00"); return isNaN(d) ? new Date() : d; };
const _diasEntre = (a, b) => Math.round((_parseISO(b) - _parseISO(a)) / 86400000);
const _fmtDia = (d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });


export function calcularKPIsCronograma(etapas, hojeIso) {
  if (!etapas || etapas.length === 0) {
    return { idp: 1, pctPrev: 0, pctExec: 0, atrasoCritico: 0, custoTotal: 0, vp: 0, va: 0 };
  }
  const custoTotal = etapas.reduce((s, e) => s + (parseFloat(e.custoBase) || 0), 0);
  const vp = etapas.reduce((s, e) => s + (parseFloat(e.custoBase) || 0) * ((e.pctPrevisto || 0) / 100), 0);
  const va = etapas.reduce((s, e) => s + (parseFloat(e.custoBase) || 0) * ((e.progresso || 0) / 100), 0);
  const idp = vp > 0 ? va / vp : 1;
  const pctPrev = custoTotal > 0 ? (vp / custoTotal) * 100 : 0;
  const pctExec = custoTotal > 0 ? (va / custoTotal) * 100 : 0;
  let atrasoCritico = 0;
  etapas.filter(e => e.critica).forEach(e => {
    if (e.fim && e.fimReal) {
      const dias = _diasEntre(e.fim, e.fimReal);
      if (dias > atrasoCritico) atrasoCritico = dias;
    }
  });
  return { idp, pctPrev, pctExec, atrasoCritico, custoTotal, vp, va };
}


export function detectarInconsistenciasCronograma(etapas, hojeIso) {
  const alertas = [];
  const hojeD = new Date(hojeIso + "T00:00:00");
  etapas.forEach(e => {
    if (e.critica && e.fim && e.fimReal) {
      const dias = _diasEntre(e.fim, e.fimReal);
      if (dias > 7) alertas.push({ tipo: "prazo", severidade: "alta", etapa: e.nome, msg: `Etapa crítica com ${dias} dias de atraso projetado — impacto direto no caminho crítico` });
    }
    if (e.pctPrevisto !== undefined && e.progresso !== undefined) {
      const def = e.pctPrevisto - e.progresso;
      if (def > 12 && e.progresso < 100) alertas.push({ tipo: "ritmo", severidade: "media", etapa: e.nome, msg: `Defasagem de ${def.toFixed(0)} pontos — produtividade abaixo do plano` });
      if (e.progresso > e.pctPrevisto + 15) alertas.push({ tipo: "antecipacao", severidade: "media", etapa: e.nome, msg: `Execução ${e.progresso}% acima do previsto (${e.pctPrevisto}%) — validar pedidos de material` });
    }
    if (e.inicio && e.fim && hojeD >= _parseISO(e.inicio) && hojeD <= _parseISO(e.fim)) {
      if ((e.progresso || 0) === 0) alertas.push({ tipo: "parada", severidade: "alta", etapa: e.nome, msg: `Etapa deveria ter começado mas progresso ainda em 0%` });
    }
  });
  return alertas;
}


export function calcularPctPrevistoEtapa(etapa, hojeIso) {
  if (!etapa.inicio || !etapa.fim) return etapa.pctPrevisto || 0;
  const ini = _parseISO(etapa.inicio);
  const fim = _parseISO(etapa.fim);
  const hoje = new Date(hojeIso + "T00:00:00");
  if (hoje < ini) return 0;
  if (hoje >= fim) return 100;
  const total = (fim - ini) / 86400000;
  const decorrido = (hoje - ini) / 86400000;
  return Math.round((decorrido / total) * 100);
}


export function gerarPontosCurvaS(etapas, hojeIso) {
  if (!etapas || etapas.length === 0) return [];
  const datasI = etapas.filter(e => e.inicio).map(e => _parseISO(e.inicio).getTime());
  const datasF = etapas.filter(e => e.fim).map(e => _parseISO(e.fim).getTime());
  if (datasI.length === 0 || datasF.length === 0) return [];
  const inicio = new Date(Math.min(...datasI));
  const fim = new Date(Math.max(...datasF));
  const totalDias = Math.max(1, Math.round((fim - inicio) / 86400000));
  const hoje = new Date(hojeIso + "T00:00:00");
  const pontos = [];
  const passos = 12;
  for (let i = 0; i <= passos; i++) {
    const data = new Date(inicio.getTime() + (totalDias / passos) * i * 86400000);
    const fracao = i / passos;
    const x = (fracao - 0.5) * 6;
    const sig = 1 / (1 + Math.exp(-x));
    const planejado = sig * 100;
    let executado = null;
    if (data <= hoje) {
      const pctReal = etapas.reduce((s, e) => {
        if (!e.inicio || !e.fim) return s;
        const eIni = _parseISO(e.inicio);
        const eFim = _parseISO(e.fim);
        const peso = 1 / etapas.length;
        if (data >= eFim) return s + (e.progresso || 0) * peso;
        if (data >= eIni) {
          const fr = (data - eIni) / (eFim - eIni);
          return s + Math.min(e.progresso || 0, fr * 100) * peso;
        }
        return s;
      }, 0);
      executado = pctReal;
    }
    pontos.push({
      data: _fmtDia(data),
      ts: data.getTime(),
      planejado: +planejado.toFixed(1),
      executado: executado !== null ? +executado.toFixed(1) : null,
      ehHoje: Math.abs((data - hoje) / 86400000) < (totalDias / passos) / 2,
    });
  }
  return pontos;
}


export function CurvaSChart({ pontos }) {
  const { paleta } = useTema(); // hex do tema atual para o SVG (var() não funciona em atributo SVG)
  if (!pontos || pontos.length === 0) {
    return <div style={{ padding: 30, textAlign: "center", color: T.texto2, fontSize: 12 }}>Adicione etapas com datas pra ver a curva.</div>;
  }
  const W = 360, H = 180, padX = 30, padY = 20;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const px = (i) => padX + (i / (pontos.length - 1)) * innerW;
  const py = (v) => padY + innerH - (v / 100) * innerH;
  const pathPlan = pontos.map((p, i) => `${i === 0 ? "M" : "L"} ${px(i)} ${py(p.planejado)}`).join(" ");
  const pontosExec = pontos.filter(p => p.executado !== null);
  const pathExec = pontosExec.map((p, idx) => `${idx === 0 ? "M" : "L"} ${px(pontos.indexOf(p))} ${py(p.executado)}`).join(" ");
  const idxHoje = pontos.findIndex(p => p.ehHoje);
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ background: T.superficie, borderRadius: 8 }}>
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line x1={padX} y1={py(v)} x2={W - padX} y2={py(v)} stroke={paleta.grade} strokeDasharray="2 2" />
          <text x={padX - 4} y={py(v) + 3} fontSize="9" fill={paleta.texto2} textAnchor="end">{v}%</text>
        </g>
      ))}
      {idxHoje >= 0 && (
        <g>
          <line x1={px(idxHoje)} y1={padY} x2={px(idxHoje)} y2={H - padY} stroke={GOLD} strokeWidth="1.5" strokeDasharray="3 3" />
          <text x={px(idxHoje) + 3} y={padY + 8} fontSize="9" fill={GOLD} fontWeight="700">HOJE</text>
        </g>
      )}
      <path d={pathPlan} fill="none" stroke="#94a3b8" strokeWidth="2" />
      {pathExec && <path d={pathExec} fill="none" stroke={GOLD} strokeWidth="2.5" />}
      {pontosExec.map((p, i) => (
        <circle key={i} cx={px(pontos.indexOf(p))} cy={py(p.executado)} r="3" fill={GOLD} />
      ))}
      {pontos.filter((_, i) => i % 3 === 0).map((p, i) => (
        <text key={i} x={px(pontos.indexOf(p))} y={H - 4} fontSize="8" fill={paleta.texto2} textAnchor="middle">{p.data}</text>
      ))}
    </svg>
  );
}


export function TelaCronogramaPro({ obras, cronogramas, onBack, onSalvar }) {
  const [obraId, setObraId] = useState(obras[0]?.id || 1);
  const [aba, setAba] = useState("gantt");
  const [etapaSel, setEtapaSel] = useState(null);
  const [custoInput, setCustoInput] = useState("");
  const [criticaInput, setCriticaInput] = useState(false);
  const [progressoInput, setProgressoInput] = useState(0);

  const obra = obras.find(o => o.id === obraId);
  const hojeIso = dataLocalIso();
  const etapasRaw = cronogramas[obraId] || [];

  const etapas = etapasRaw.map(e => ({
    ...e,
    pctPrevisto: calcularPctPrevistoEtapa(e, hojeIso),
    fimReal: e.fimReal || e.fim,
    custoBase: e.custoBase || 0,
  }));

  const kpis = calcularKPIsCronograma(etapas, hojeIso);
  const alertas = detectarInconsistenciasCronograma(etapas, hojeIso);
  const pontosCurvaS = gerarPontosCurvaS(etapas, hojeIso);

  const abrirEtapa = (e) => {
    setEtapaSel(e);
    setCustoInput(String(e.custoBase || ""));
    setCriticaInput(!!e.critica);
    setProgressoInput(e.progresso || 0);
  };

  const salvarEtapa = () => {
    const novas = etapasRaw.map(et => et.id === etapaSel.id ? {
      ...et,
      custoBase: parseFloat(custoInput) || 0,
      critica: criticaInput,
      progresso: parseInt(progressoInput) || 0,
    } : et);
    onSalvar(obraId, novas);
    setEtapaSel(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Cronograma Pro" sub={obra?.nome || "—"} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: T.fundo, padding: 14 }}>

        <select value={obraId} onChange={e => setObraId(parseInt(e.target.value))} style={{ ...selS, marginBottom: 10 }}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 12 }}>
          <div style={{ background: T.superficie, borderRadius: 10, padding: "10px 12px", borderLeft: `4px solid ${kpis.idp >= 0.95 ? GREEN : kpis.idp >= 0.85 ? ORANGE : RED}` }}>
            <div style={{ fontSize: 9, color: T.texto2, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>IDP · Prazo</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: T.titulo, marginTop: 2 }}>{kpis.idp.toFixed(2)}</div>
            <div style={{ fontSize: 10, color: kpis.idp >= 1 ? GREEN : RED, fontWeight: 700 }}>
              {kpis.idp >= 1 ? "✓ No ritmo" : `${((1 - kpis.idp) * 100).toFixed(1)}% abaixo`}
            </div>
          </div>
          <div style={{ background: T.superficie, borderRadius: 10, padding: "10px 12px", borderLeft: `4px solid ${BLUE}` }}>
            <div style={{ fontSize: 9, color: T.texto2, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Avanço Físico</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: T.titulo, marginTop: 2 }}>{kpis.pctExec.toFixed(1)}%</div>
            <div style={{ fontSize: 10, color: T.texto2 }}>Plan. {kpis.pctPrev.toFixed(1)}%</div>
          </div>
          <div style={{ background: T.superficie, borderRadius: 10, padding: "10px 12px", borderLeft: `4px solid ${kpis.atrasoCritico > 7 ? RED : kpis.atrasoCritico > 0 ? ORANGE : GREEN}` }}>
            <div style={{ fontSize: 9, color: T.texto2, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Δ Crítico</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: T.titulo, marginTop: 2 }}>
              {kpis.atrasoCritico > 0 ? `+${kpis.atrasoCritico}d` : "0d"}
            </div>
            <div style={{ fontSize: 10, color: kpis.atrasoCritico > 0 ? RED : GREEN, fontWeight: 700 }}>
              {kpis.atrasoCritico > 0 ? "Atrasado" : "Em dia"}
            </div>
          </div>
          <div style={{ background: T.superficie, borderRadius: 10, padding: "10px 12px", borderLeft: `4px solid #7c3aed` }}>
            <div style={{ fontSize: 9, color: T.texto2, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Custo Base</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: T.titulo, marginTop: 2 }}>
              R$ {(kpis.custoTotal / 1000).toFixed(2)}k
            </div>
            <div style={{ fontSize: 10, color: T.texto2 }}>EV: R$ {(kpis.va / 1000).toFixed(2)}k</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[
            { id: "gantt", label: "📊 Gantt" },
            { id: "curva", label: "📈 Curva S" },
            { id: "alertas", label: `🚨 Alertas${alertas.length > 0 ? ` (${alertas.length})` : ""}` },
          ].map(t => (
            <button key={t.id} onClick={() => setAba(t.id)} style={{
              flex: 1, padding: "8px 4px", borderRadius: 8,
              background: aba === t.id ? NAVY : T.superficie,
              color: aba === t.id ? "#fff" : T.titulo,
              border: aba === t.id ? "none" : `1px solid ${T.borda}`,
              cursor: "pointer", fontSize: 11, fontWeight: 700,
            }}>{t.label}</button>
          ))}
        </div>

        {aba === "gantt" && (
          etapas.length === 0 ? (
            <div style={{ background: T.superficie, borderRadius: 12, padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 36 }}>📅</div>
              <div style={{ color: T.texto2, fontSize: 13, marginTop: 8 }}>
                Nenhuma etapa nessa obra. Crie etapas no <b>Cronograma simples</b> primeiro.
              </div>
            </div>
          ) : (
            <div style={{ background: T.superficie, borderRadius: 12, padding: 12, boxShadow: T.sombra }}>
              {etapas.map(e => {
                const def = (e.pctPrevisto || 0) - (e.progresso || 0);
                const corBarra = e.critica ? GOLD : BLUE;
                return (
                  <div key={e.id} onClick={() => abrirEtapa(e)} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${T.borda}`, cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                        {e.critica && <span style={{ color: GOLD, fontSize: 11 }}>●</span>}
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.titulo, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.nome}</span>
                      </div>
                      <span style={{ fontSize: 10, color: T.texto2, marginLeft: 6, flexShrink: 0 }}>{e.progresso || 0}%</span>
                    </div>
                    <div style={{ position: "relative", height: 14, background: T.superficie2, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ position: "absolute", inset: 0, background: corBarra + "22" }} />
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${e.progresso || 0}%`, background: corBarra }} />
                      {/* Marcador do previsto: T.contorno é navy no claro e ciano no escuro (NAVY fixo sumia na barra escura) */}
                      <div style={{ position: "absolute", left: `${e.pctPrevisto || 0}%`, top: 0, bottom: 0, width: 2, background: T.contorno }} title="Previsto" />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 9, color: T.texto2 }}>
                      <span>{e.inicio || "—"} → {e.fim || "—"}</span>
                      <span style={{ color: def > 12 ? RED : def > 5 ? ORANGE : GREEN, fontWeight: 700 }}>
                        {def === 0 ? "No ritmo" : def > 0 ? `${def.toFixed(0)} pts atrás` : `${Math.abs(def).toFixed(0)} pts à frente`}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize: 10, color: T.texto2, marginTop: 8, padding: "6px 8px", background: T.superficie2, borderRadius: 6 }}>
                ● Etapa crítica • | Linha vertical = % previsto pra hoje
              </div>
            </div>
          )
        )}

        {aba === "curva" && (
          <div style={{ background: T.superficie, borderRadius: 12, padding: 12, boxShadow: T.sombra }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.titulo, marginBottom: 8 }}>Curva S — Avanço Físico Acumulado</div>
            <CurvaSChart pontos={pontosCurvaS} />
            <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: T.texto2 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 12, height: 2, background: "#94a3b8" }} /> Planejado
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 12, height: 2, background: GOLD }} /> Executado
              </span>
            </div>
          </div>
        )}

        {aba === "alertas" && (
          alertas.length === 0 ? (
            <div style={{ background: T.sucessoFundo, borderRadius: 12, padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 36 }}>✅</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, marginTop: 8 }}>Tudo em ordem!</div>
              <div style={{ fontSize: 11, color: T.texto2, marginTop: 4 }}>Nenhuma inconsistência detectada.</div>
            </div>
          ) : (
            <div>
              {alertas.map((a, i) => {
                const cor = a.severidade === "alta" ? RED : a.severidade === "media" ? ORANGE : BLUE;
                return (
                  <div key={i} style={{ background: T.superficie, borderRadius: 10, padding: 12, marginBottom: 8, borderLeft: `4px solid ${cor}`, boxShadow: T.sombra }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.titulo }}>{a.etapa}</div>
                      <span style={{ background: cor, color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: 8, fontWeight: 800, textTransform: "uppercase" }}>{a.severidade}</span>
                    </div>
                    <div style={{ fontSize: 12, color: T.texto, lineHeight: 1.4 }}>{a.msg}</div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
      <KMFooter />

      <Modal show={!!etapaSel} title={etapaSel?.nome || ""} onClose={() => setEtapaSel(null)}>
        {etapaSel && (
          <>
            <div style={{ background: T.superficie2, borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 11, color: T.texto2 }}>
              📅 {etapaSel.inicio || "—"} → {etapaSel.fim || "—"}<br/>
              📊 Previsto pra hoje: <b>{etapaSel.pctPrevisto || 0}%</b>
            </div>
            <label style={labelS}>📈 Progresso Real (%)</label>
            <input type="number" min="0" max="100" value={progressoInput} onChange={e => setProgressoInput(e.target.value)} style={inputS} />
            <label style={labelS}>💰 Custo Base (R$)</label>
            <input type="number" value={custoInput} onChange={e => setCustoInput(e.target.value)} placeholder="0" style={inputS} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, background: criticaInput ? T.avisoFundo : T.superficie2, borderRadius: 8, cursor: "pointer", marginBottom: 10 }}>
              <input type="checkbox" checked={criticaInput} onChange={e => setCriticaInput(e.target.checked)} />
              <span style={{ fontSize: 12, fontWeight: 700, color: T.titulo }}>⚠️ Etapa do Caminho Crítico</span>
            </label>
            <Btn label="💾 SALVAR" color={GREEN} onClick={salvarEtapa} />
          </>
        )}
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   PAINEL GESTOR
════════════════════════════════════ */
/* ════════════════════════════════════
   PAINEL GESTOR
════════════════════════════════════ */

/* ── Utilidades dos documentos de saída (papel branco; cores só em hex do padrão do núcleo) ── */
const _escDoc = v => String(v ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const _quebrasDoc = s => _escDoc(s).replace(/\r?\n/g, "<br/>");
const _brl = v => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const _numDoc = (v, casas = 1) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const _horasDoc = v => { const n = Number(v) || 0; return (Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })) + "h"; };
const _dataHoraDoc = ts => { const d = new Date(ts); return isNaN(d) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
/* "YYYY-MM-DD" → Date local. new Date("YYYY-MM-DD") lê em UTC e, no Brasil, volta um dia. */
const _dataLocalDoc = s => { if (!s) return null; const d = new Date(String(s).slice(0, 10) + "T00:00:00"); return isNaN(d) ? null : d; };
const _isoDeBR = br => { const [d, m, a] = String(br || "").split("/"); return d && m && a ? `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : ""; };
const _clsStatusPedido = st => st === "Aprovado" ? "txt-ok" : st === "Negado" ? "txt-erro" : "txt-alerta";
const _clsSituacao = st => st === "Presente" ? "txt-ok" : st === "Falta" ? "txt-erro" : st === "Atestado" ? "txt-alerta" : "txt-cinza";
/* Anotações do diário do MESMO dia do RDO. O diário grava só ts (Date.now()); se algum registro trouxer "data" DD/MM/AAAA, vale ela. */
const _diarioDoDia = (diario, obraId, dataBR) => {
  const iso = _isoDeBR(dataBR);
  if (!iso) return [];
  return (diario || []).filter(d => d.obraId === obraId && (d.data ? _isoDeBR(d.data) === iso : d.ts ? dataLocalIso(new Date(d.ts)) === iso : false));
};
/* Foto guardada como SVG em data-URI SEM width/height (ex.: placeholders da demonstração): o html2canvas do PDF usa como
   recorte da origem o tamanho natural que o navegador dá a um SVG só com viewBox (200×150) e a foto sai como um retângulo
   liso. Injeta width/height a partir do viewBox; JPEG/PNG e SVG já dimensionados passam intactos. */
const _srcImgDoc = src => {
  src = String(src || "");
  const m = /^data:image\/svg\+xml(;[^,]*)?,/i.exec(src);
  if (!m) return src;
  const cab = m[0], corpo = src.slice(cab.length), b64 = /;base64/i.test(cab);
  let svg;
  try { svg = b64 ? new TextDecoder().decode(Uint8Array.from(atob(corpo), c => c.charCodeAt(0))) : decodeURIComponent(corpo); } catch { return src; }
  const raiz = /<svg\b[^>]*>/i.exec(svg);
  if (!raiz) return src;
  const semW = !/\swidth\s*=/i.test(raiz[0]), semH = !/\sheight\s*=/i.test(raiz[0]);
  if (!semW && !semH) return src;
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(raiz[0]);
  const w = vb ? vb[1] : "800", h = vb ? vb[2] : "600";
  const novaRaiz = raiz[0].replace(/<svg\b/i, `<svg${semW ? ` width="${w}"` : ""}${semH ? ` height="${h}"` : ""}`);
  const novo = svg.replace(raiz[0], () => novaRaiz);
  try {
    if (!b64) return cab + encodeURIComponent(novo);
    let bin = ""; new TextEncoder().encode(novo).forEach(b => { bin += String.fromCharCode(b); });
    return cab + btoa(bin);
  } catch { return src; }
};

export function gerarPDFRDORabnt({ numero, obra, data, clima, observacoes, presencas, trabalhadores, ativos, abastecimentos, pedidos, ocorrencias, encarregado, empresa, horasTrabalhadas, horimetros, fotos, alimentacao, totalAlimentacao, recebimentos }) {
  presencas = presencas || {};
  empresa = empresa || {};
  const trabObra = (trabalhadores || []).filter(t => t.obraId === obra.id);
  const ativosObra = (ativos || []).filter(a => a.obraId === obra.id);
  const abastDia = (abastecimentos || []).filter(a => a.obraId === obra.id && a.data === data);
  const pedidosDia = (pedidos || []).filter(p => p.obraId === obra.id && p.data === data);

  const presentes = trabObra.filter(t => presencas[t.id] === "Presente").length;
  const faltas    = trabObra.filter(t => presencas[t.id] === "Falta").length;
  const atestados = trabObra.filter(t => presencas[t.id] === "Atestado").length;
  // Total de horas com as horas trabalhadas reais (se passadas); padrão 9h por presente
  let totalHoras = 0;
  let totalHE = 0;
  trabObra.forEach(t => {
    if (presencas[t.id] === "Presente") {
      const h = Number(horasTrabalhadas?.[t.id]) || 9;
      totalHoras += h;
      if (h > 9) totalHE += (h - 9);
    }
  });

  const numeroTxt = String(numero ?? "").padStart(3, "0");
  const temAlim = !!(alimentacao && Object.keys(alimentacao).length > 0);
  const trabAlim = (trabalhadores || []).filter(t => presencas[t.id] === "Presente");
  const totalAlimDia = trabAlim.reduce((s, t) => s + somaAlim(empresa, alimentacao?.[t.id]), 0);

  // Registro fotográfico: fotos do encarregado + cupons de combustível + recebimentos + ocorrências do dia
  const todasFotos = [];
  (fotos || []).forEach((f, i) => todasFotos.push({ src: f, tipo: "Obra", legenda: `Foto da obra ${i + 1}` }));
  abastDia.forEach(a => {
    if (!a.fotoCupom) return;
    const ativo = (ativos || []).find(x => x.id === a.ativoId);
    todasFotos.push({ src: a.fotoCupom, tipo: "Combustível", legenda: `${ativo?.nome || "Veículo"} — ${_brl(a.valor)} (${a.posto || "posto"})` });
  });
  if (Array.isArray(recebimentos)) {
    recebimentos.filter(r => r.obraId === obra.id && r.data === data && r.foto).forEach(r => {
      todasFotos.push({ src: r.foto, tipo: "Recebimento", legenda: `${r.material} — ${r.qtd} (${r.conformidade || "Conforme"})` });
    });
  }
  (ocorrencias || []).forEach(o => {
    if (o.foto) todasFotos.push({ src: o.foto, tipo: "Ocorrência", legenda: `${(o.texto || "").substring(0, 50)}${o.texto && o.texto.length > 50 ? "…" : ""}` });
  });

  // Numeração das seções (as condicionais só contam quando aparecem)
  let nSec = 4;
  const secAlim = temAlim ? ++nSec : 0;
  const secOcor = ++nSec;
  const secFotos = todasFotos.length ? ++nSec : 0;

  const assinantes = [
    encarregado ? { nome: encarregado, cargo: "Encarregado responsável" } : null,
    empresa.responsavel && empresa.responsavel !== encarregado ? { nome: empresa.responsavel, cargo: "Responsável técnico" + (empresa.registro ? " · " + empresa.registro : "") } : null,
  ].filter(Boolean);
  if (!assinantes.length) assinantes.push({ nome: "", cargo: "Encarregado responsável" });
  assinantes.push({ nome: "Fiscalização", cargo: "Visto / Carimbo" });

  // As assinaturas nunca ficam órfãs numa folha em branco: o ÚLTIMO bloco de conteúdo do
  // documento leva a classe .junto ("nunca fica por último na página"); quando as assinaturas
  // não cabem, o paginador leva esse bloco (e o título da seção) junto para a página seguinte.
  // Sem fotos, o último bloco é o da seção Ocorrências; com fotos, é a última linha da grade.
  const ocorrenciasHTML = ocorrencias && ocorrencias.length > 0
    ? ocorrencias.map((o, i) => `<div class="bloco alerta${!todasFotos.length && i === ocorrencias.length - 1 ? " junto" : ""}"><span class="rotulo">${_escDoc(o.autor) || "—"}${o.ts ? " · " + _dataHoraDoc(o.ts) : ""}</span>${_quebrasDoc(o.texto || "")}</div>`).join("")
    : `<div class="vazio${todasFotos.length ? "" : " junto"}">Nenhuma ocorrência registrada.</div>`;
  // Fotos em linhas de 3 (uma grade por linha): a linha inteira muda de página junta e a última
  // linha fica com as assinaturas, sem tornar a grade toda indivisível.
  const linhasFotos = [];
  for (let i = 0; i < todasFotos.length; i += 3) linhasFotos.push(todasFotos.slice(i, i + 3));
  const fotosHTML = linhasFotos.map((linha, li) => `<div class="fotos linha${li === linhasFotos.length - 1 ? " junto" : ""}">${linha.map((f, k) => {
    const n = li * 3 + k + 1;
    return `<figure><img src="${_escDoc(_srcImgDoc(f.src))}" alt="Foto ${n}"/><figcaption><b>${f.tipo}</b> · ${_escDoc(f.legenda)}</figcaption></figure>`;
  }).join("")}</div>`).join("");

  const html = `<html><head><meta charset="UTF-8"><title>RDO ${numeroTxt} — ${_escDoc(obra.nome)}</title>
    <style>
      ${KM_PDF_PAGE_CSS}
      ${KM_PDF_CSS}
      .quadro tbody tr.total td { background: #fff7df; }
      .fotos.linha { margin-bottom: 6px; }
      .fotos.linha.junto { margin-bottom: 8px; }
    </style></head><body>

    ${gerarHeaderHTML({ tipo: "Relatório Diário de Obra", numero, periodo: data, info_extra: `${obra.nome}${obra.local ? " · " + obra.local : ""} · Clima: ${clima || "—"}${encarregado ? " · Encarregado: " + encarregado : ""}`, empresa })}

    <div class="kpis">
      <div class="kpi"><b>${trabObra.length}</b><span>Efetivo</span></div>
      <div class="kpi ok"><b>${presentes}</b><span>Presentes</span></div>
      <div class="kpi erro"><b>${faltas}</b><span>Faltas${atestados ? " · " + atestados + " atestado" + (atestados > 1 ? "s" : "") : ""}</span></div>
      <div class="kpi"><b>${_horasDoc(totalHoras)}</b><span>Total de horas</span></div>
    </div>

    <div class="sec">1. Mão de obra <small>apropriação de custo direto</small></div>
    <table class="quadro compacto">
      <thead><tr><th style="width:5%" class="num">Nº</th><th style="width:27%">Nome</th><th style="width:20%">Cargo</th><th style="width:9%" class="centro">Entrada</th><th style="width:9%" class="centro">Saída</th><th style="width:8%" class="num">Horas</th><th style="width:10%" class="num">Extra 50%</th><th style="width:12%" class="centro">Situação</th></tr></thead>
      <tbody>
      ${trabObra.length === 0 ? '<tr><td colspan="8" class="vazio">Sem mão de obra registrada</td></tr>' : trabObra.map((t, i) => {
        const status = presencas[t.id] || "Sem registro";
        const presente = status === "Presente";
        const horas = presente ? (Number(horasTrabalhadas?.[t.id]) || 9) : (Number(horasTrabalhadas?.[t.id]) || 0);
        const he = horas > 9 ? (horas - 9) : 0;
        // Entrada e saída a partir das horas trabalhadas (7h de início + horas + 1h de almoço)
        const entrada = presente ? "07:00" : "—";
        let saida = "—";
        if (presente) {
          const saidaH = 7 + horas + 1;
          saida = String(Math.floor(saidaH)).padStart(2, "0") + ":" + String(Math.round((saidaH - Math.floor(saidaH)) * 60)).padStart(2, "0");
        }
        return `<tr><td class="num">${i + 1}</td><td>${_escDoc(t.nome)}</td><td>${_escDoc(t.cargo)}</td><td class="centro">${entrada}</td><td class="centro">${saida}</td><td class="num"><b>${_horasDoc(horas)}</b></td><td class="num ${he > 0 ? "txt-erro" : "txt-cinza"}">${he > 0 ? "<b>+" + _horasDoc(he) + "</b>" : "—"}</td><td class="centro ${_clsSituacao(status)}"><b>${_escDoc(status)}</b></td></tr>`;
      }).join("") + `<tr class="total"><td colspan="5">Total do dia</td><td class="num">${_horasDoc(totalHoras)}</td><td class="num">${totalHE > 0 ? "+" + _horasDoc(totalHE) : "—"}</td><td class="centro">${presentes} de ${trabObra.length}</td></tr>`}
      </tbody>
    </table>

    <div class="sec">2. Ativos e logística <small>maquinário e frota</small></div>
    <table class="quadro compacto">
      <thead><tr><th style="width:5%" class="num">Nº</th><th style="width:24%">Identificação</th><th style="width:12%">Placa</th><th style="width:17%">Tipo</th><th style="width:11%;text-align:right">Horímetro início</th><th style="width:11%;text-align:right">Horímetro fim</th><th style="width:8%" class="num">Horas</th><th style="width:12%" class="num">Combustível</th></tr></thead>
      <tbody>
      ${ativosObra.length === 0 ? '<tr><td colspan="8" class="vazio">Sem ativos nesta obra</td></tr>' : ativosObra.map((a, i) => {
        const abastA = abastDia.filter(x => x.ativoId === a.id);
        const totalAbast = abastA.reduce((s, x) => s + (parseFloat(x.valor) || 0), 0);
        const horim = horimetros?.[a.id] || null;
        const inicioH = horim ? _numDoc(horim.inicio, 1) : "—";
        const fimH = horim ? _numDoc(horim.fim, 1) : "—";
        const trabH = horim ? `<b>${_horasDoc(horim.horas)}</b>` : "—";
        return `<tr><td class="num">${i + 1}</td><td><b>${_escDoc(a.nome)}</b></td><td>${_escDoc(a.placa) || "—"}</td><td>${_escDoc(a.tipo)}</td><td class="num">${inicioH}</td><td class="num">${fimH}</td><td class="num">${trabH}</td><td class="num">${abastA.length ? _brl(totalAbast) : "—"}</td></tr>`;
      }).join("")}
      </tbody>
    </table>

    ${abastDia.length > 0 ? `
    <div class="sec">2.1. Abastecimentos do dia</div>
    <table class="quadro">
      <thead><tr><th style="width:5%" class="num">Nº</th><th style="width:25%">Veículo</th><th style="width:20%">Posto</th><th style="width:10%" class="num">Litros</th><th style="width:12%" class="num">R$/litro</th><th style="width:14%" class="num">Valor</th><th style="width:14%;text-align:right">Km ou horímetro</th></tr></thead>
      <tbody>
      ${abastDia.map((a, i) => {
        const ativo = (ativos || []).find(x => x.id === a.ativoId);
        const litros = parseFloat(a.litros) || 0, valor = parseFloat(a.valor) || 0;
        return `<tr><td class="num">${i + 1}</td><td><b>${_escDoc(ativo?.nome) || "—"}</b>${ativo?.placa ? `<br/><span class="txt-cinza">${_escDoc(ativo.placa)}</span>` : ""}</td><td>${_escDoc(a.posto) || "—"}</td><td class="num">${_numDoc(litros, 1)}</td><td class="num">${litros > 0 ? _brl(valor / litros) : "—"}</td><td class="num"><b>${_brl(valor)}</b></td><td class="num">${_escDoc(a.km || a.horimetro) || "—"}</td></tr>`;
      }).join("")}
      <tr class="total"><td colspan="3">Total do dia</td><td class="num">${_numDoc(abastDia.reduce((s, a) => s + (parseFloat(a.litros) || 0), 0), 1)} L</td><td></td><td class="num">${_brl(abastDia.reduce((s, a) => s + (parseFloat(a.valor) || 0), 0))}</td><td></td></tr>
      </tbody>
    </table>
    ` : ""}

    <div class="sec">3. Materiais e insumos</div>
    <table class="quadro">
      <thead><tr><th style="width:12%" class="num">Pedido Nº</th><th style="width:36%">Material</th><th style="width:16%" class="num">Quantidade</th><th style="width:22%">Solicitante</th><th style="width:14%" class="centro">Situação</th></tr></thead>
      <tbody>
      ${pedidosDia.length === 0 ? '<tr><td colspan="5" class="vazio">Sem materiais ou insumos registrados neste dia</td></tr>' : pedidosDia.map(p => `<tr><td class="num"><b>${String(p.id).slice(-6)}</b></td><td>${_escDoc(p.material)}</td><td class="num">${_escDoc(fmtQtd(p.qtd))}</td><td>${_escDoc(p.enc) || "—"}</td><td class="centro ${_clsStatusPedido(p.status)}"><b>${_escDoc(p.status) || "—"}</b></td></tr>`).join("")}
      </tbody>
    </table>

    <div class="sec">4. Observações gerais</div>
    ${observacoes ? `<div class="bloco">${_quebrasDoc(observacoes)}</div>` : '<div class="vazio">Sem observações</div>'}

    ${temAlim ? `
    <div class="sec">${secAlim}. Alimentação do dia</div>
    <table class="quadro">
      <thead><tr><th style="width:30%">Trabalhador</th><th style="width:14%" class="num">Café manhã</th><th style="width:14%" class="num">Café tarde</th><th style="width:14%" class="num">Marmita</th><th style="width:14%" class="num">Lanche</th><th style="width:14%" class="num">Total</th></tr></thead>
      <tbody>
      ${trabAlim.length === 0 ? '<tr><td colspan="6" class="vazio">Sem refeições registradas</td></tr>' : trabAlim.map(t => {
        const a = alimentacao[t.id] || {};
        // Só soma o que tem preço configurado; refeição marcada sem preço sai como "sem preço"
        const cel = k => { if (!a[k]) return '<span class="txt-cinza">—</span>'; const p = precoAlim(empresa, k); return p === null ? '<span class="txt-alerta">sem preço</span>' : _brl(p); };
        return `<tr><td>${_escDoc(t.nome)}</td><td class="num">${cel("cafeManha")}</td><td class="num">${cel("cafeTarde")}</td><td class="num">${cel("marmita")}</td><td class="num">${cel("lanche")}</td><td class="num"><b>${_brl(somaAlim(empresa, a))}</b></td></tr>`;
      }).join("") + `<tr class="total"><td colspan="5">Total do dia</td><td class="num">${_brl(totalAlimDia)}</td></tr>`}
      </tbody>
    </table>
    ${faltaPrecoAlim(empresa) ? '<div class="nota">Refeição sem preço configurado aparece como "sem preço" e não entra no total. Configure os preços em Sistema → Empresa.</div>' : ""}
    ` : ""}

    <div class="sec">${secOcor}. Ocorrências técnicas do dia</div>
    ${ocorrenciasHTML}

    ${todasFotos.length ? `
    <div class="sec">${secFotos}. Registro fotográfico <small>${todasFotos.length} foto${todasFotos.length > 1 ? "s" : ""}</small></div>
    ${fotosHTML}
    ` : ""}

    ${gerarAssinaturasHTML({ empresa, assinantes })}
    ${gerarFooterHTML({ empresa, autor: encarregado })}
    </body></html>`;
  abrirOuBaixarHTML(html, `RDO-${numeroTxt}-${String(obra.nome || "obra").replace(/[^a-z0-9]/gi, "_").substring(0, 30)}.html`);
}


export function TelaRDO({ obras, trabalhadores, ativos, abastecimentos, pedidos, historico, diario, usuario, empresa, rdosEmitidos, recebimentos = [], fotosObras = [], despesasAvulsas = [], movimentacoes = [], movEquip = [], produtividade = [], cronogramas = [], onBack, onEmitirRDO, onUpdateRDO, onRemoveRDO }) {
  const [obraId, setObraId] = useState(obras[0]?.id || 1);
  const [data, setData] = useState(new Date().toLocaleDateString("pt-BR"));
  const [clima, setClima] = useState("Bom");
  const [observacoes, setObservacoes] = useState("");
  const [editandoRdo, setEditandoRdo] = useState(null);
  const [fotoVer, setFotoVer] = useState(null); // foto fullscreen

  const obra = obras.find(o => o.id === obraId);
  const isoData = (() => { const [d, m, a] = data.split("/"); return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; })();
  const presencasDia = historico[isoData] || {};
  const ocorrenciasDia = _diarioDoDia(diario, obraId, data); // só o dia do RDO (antes entrava o diário inteiro da obra)

  const proxNumero = rdosEmitidos.length + 1;

  const emitir = () => {
    const numero = proxNumero;
    onEmitirRDO({ id: Date.now(), numero, obraId, data, dataIso: isoData, encarregado: usuario?.nome, clima, observacoes, ts: Date.now() });
    gerarPDFRDORabnt({ numero, obra, data, clima, observacoes, presencas: presencasDia, trabalhadores, ativos, abastecimentos, pedidos, ocorrencias: ocorrenciasDia, encarregado: usuario?.nome, empresa, recebimentos });
  };

  // RDO Semanal Consolidado: junta todos os RDOs da semana atual da obra selecionada
  const emitirSemanal = (oId) => {
    try {
      const obraSel = obras.find(o => o.id === oId);
      if (!obraSel) {
        alert("⚠️ Obra não encontrada");
        return;
      }
      const hoje = new Date();
      const dia = hoje.getDay();
      const seg = new Date(hoje); seg.setDate(hoje.getDate() - (dia === 0 ? 6 : dia - 1)); seg.setHours(0, 0, 0, 0);
      const sex = new Date(seg); sex.setDate(seg.getDate() + 6); sex.setHours(23, 59, 59, 999);

      const isoDe = r => r.dataIso || _isoDeBR(r.data); // "YYYY-MM-DD" do RDO (dataIso ou a data DD/MM/AAAA)
      let rdosSem = (rdosEmitidos || []).filter(r => {
        const dt = _dataLocalDoc(isoDe(r)); // local: new Date("YYYY-MM-DD") lia em UTC e jogava a segunda-feira no domingo
        return r.obraId === oId && dt && dt >= seg && dt <= sex;
      });

      let modoFallback = false;
      if (rdosSem.length === 0) {
        const todosObra = (rdosEmitidos || []).filter(r => r.obraId === oId);
        if (todosObra.length === 0) {
          alert("⚠️ Sem RDOs para esta obra ainda.\n\nObra: " + obraSel.nome + "\n\nFinalize pelo menos 1 dia de obra (RDO) para gerar o relatório semanal.");
          return;
        }
      // Pega os últimos 7 RDOs por data (descendente) e devolve em ordem crescente pra exibição
      rdosSem = todosObra
        .sort((a, b) => isoDe(b).localeCompare(isoDe(a)))
        .slice(0, 7)
        .reverse();
      modoFallback = true;
    }

    // Calcula totais
    let totalPres = 0, totalFalt = 0, totalAtest = 0, totalHE = 0;
    const trabPres = {}; // { trabId: { presentes, faltas, atestados, horas, alimentacao } }
    rdosSem.forEach(r => {
      const pres = r.presencas || {};
      Object.entries(pres).forEach(([tid, st]) => {
        if (!trabPres[tid]) trabPres[tid] = { p: 0, f: 0, a: 0, horas: 0, alimentacao: 0 };
        if (st === "Presente") {
          trabPres[tid].p++; totalPres++;
          trabPres[tid].horas += (r.horasTrabalhadas?.[tid] || 9);
          // Soma alimentação por trabalhador
          const ali = (r.alimentacao || {})[tid] || {};
          const valDia = somaAlim(empresa, ali); // só o que tem preço configurado (sem valor inventado)
          trabPres[tid].alimentacao += valDia;
        }
        else if (st === "Falta") { trabPres[tid].f++; totalFalt++; }
        else if (st === "Atestado") { trabPres[tid].a++; totalAtest++; }
      });
      totalHE += (r.totalHE || 0);
      // Alimentação da semana: NÃO soma r.totalAlimentacao (campo gravado na emissão); sai de somaFreq, calculada das marcações (abaixo)
    });

    // Em modo fallback, ajusta seg/sex pras datas dos RDOs encontrados
    let segReal = seg, sexReal = sex;
    if (modoFallback && rdosSem.length > 0) {
      const datasRdos = rdosSem.map(r => _dataLocalDoc(isoDe(r))).filter(Boolean).map(d => d.getTime());
      if (datasRdos.length > 0) {
        segReal = new Date(Math.min(...datasRdos)); segReal.setHours(0, 0, 0, 0);
        sexReal = new Date(Math.max(...datasRdos)); sexReal.setHours(23, 59, 59, 999);
      }
    }

    // ⛽ Combustível do período
    const abastSemana = (abastecimentos || []).filter(a => {
      if (a.obraId !== oId) return false;
      try {
        const [d, m, y] = (a.data || "").split("/");
        const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        return dt >= segReal && dt <= sexReal;
      } catch { return false; }
    });
    const totalCombustivel = abastSemana.reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);
    const totalLitros = abastSemana.reduce((s, a) => s + (parseFloat(a.litros) || 0), 0);

    // Por veículo
    const ativosObraSel = (ativos || []).filter(a => a.obraId === oId);
    const combPorVeic = ativosObraSel.map(a => {
      const aa = abastSemana.filter(x => x.ativoId === a.id);
      return {
        ativo: a,
        gasto: aa.reduce((s, x) => s + (parseFloat(x.valor) || 0), 0),
        litros: aa.reduce((s, x) => s + (parseFloat(x.litros) || 0), 0),
        qtd: aa.length,
      };
    }).filter(v => v.gasto > 0);

    // Período pelo calendário (ordenar "DD/MM/AAAA" como texto errava a virada de mês)
    const rdosOrdenados = [...rdosSem].sort((a, b) => isoDe(a).localeCompare(isoDe(b)));
    const periodo = rdosOrdenados.length ? `${rdosOrdenados[0].data} a ${rdosOrdenados[rdosOrdenados.length - 1].data}` : "";

    // 📷 FOTOS do período
    const fotosSem = (fotosObras || []).filter(f => {
      if (f.obraId !== oId) return false;
      try {
        const [d, m, y] = (f.data || "").split("/");
        const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        return dt >= segReal && dt <= sexReal;
      } catch { return false; }
    });

    // 📦 PEDIDOS do período
    const pedidosSem = (pedidos || []).filter(p => {
      if (p.obraId !== oId) return false;
      try {
        const [d, m, y] = (p.dataSolicitacao || p.data || "").split("/");
        const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        return dt >= segReal && dt <= sexReal;
      } catch { return false; }
    });
    const pedAprov = pedidosSem.filter(p => p.status === "Aprovado");
    const pedAguard = pedidosSem.filter(p => p.status === "Aguardando");
    const pedNeg = pedidosSem.filter(p => p.status === "Negado");

    // 💸 DESPESAS avulsas do período
    const despesasSem = (despesasAvulsas || []).filter(d => {
      if (d.obraId !== oId) return false;
      try {
        const [dia, m, y] = (d.data || "").split("/");
        const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(dia));
        return dt >= segReal && dt <= sexReal;
      } catch { return false; }
    });
    const totalDespesas = despesasSem.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

    // 📋 DIÁRIO do período
    const diarioSem = (diario || []).filter(d => {
      if (d.obraId !== oId) return false;
      const dt = new Date(d.ts || 0);
      return dt >= segReal && dt <= sexReal;
    });

    // 🔄 MOVIMENTAÇÕES do período (pessoal e equipamento)
    const movPessSem = (movimentacoes || []).filter(m => {
      const dt = new Date(m.ts || 0);
      const envolvida = m.obraOrigem === oId || m.obraDestino === oId;
      return envolvida && dt >= segReal && dt <= sexReal;
    });
    const movEquipSem = (movEquip || []).filter(m => {
      const dt = new Date(m.ts || 0);
      const envolvida = m.obraOrigemId === oId || m.obraDestinoId === oId;
      return envolvida && dt >= segReal && dt <= sexReal;
    });

    // 📈 PRODUTIVIDADE do período
    const prodSem = (produtividade || []).filter(p => {
      if (p.obraId !== oId) return false;
      const dt = new Date(p.ts || 0);
      return dt >= segReal && dt <= sexReal;
    });
    const prodTotal = {};
    prodSem.forEach(p => {
      const k = `${p.tipo}|${p.unidade}`;
      prodTotal[k] = (prodTotal[k] || 0) + (parseFloat(p.qtd) || 0);
    });

    // TESTE 1: contadores acumulados simples
    var totalRdosObra = 0;
    var totalPedidosObra = 0;
    for (var i = 0; i < (rdosEmitidos || []).length; i++) {
      if (rdosEmitidos[i].obraId === oId) totalRdosObra++;
    }
    for (var i = 0; i < (pedidos || []).length; i++) {
      if (pedidos[i].obraId === oId) totalPedidosObra++;
    }

    // Linhas da tabela de frequência (só trabalhadores ainda cadastrados) e os totais que fecham com elas
    const linhasFreq = Object.entries(trabPres).map(([tid, st]) => {
      const t = trabalhadores.find(x => String(x.id) === String(tid));
      if (!t) return null;
      const diaria = parseFloat(t.diaria) || 0;
      return { t, st, aPagar: (st.p + st.a) * diaria };
    }).filter(Boolean);
    const somaFreq = linhasFreq.reduce((s, l) => ({ p: s.p + l.st.p, f: s.f + l.st.f, a: s.a + l.st.a, horas: s.horas + l.st.horas, alimentacao: s.alimentacao + l.st.alimentacao, aPagar: s.aPagar + l.aPagar }), { p: 0, f: 0, a: 0, horas: 0, alimentacao: 0, aPagar: 0 });

    // 💰 CUSTO consolidado da semana — mesma fonte da tabela de frequência, para o "Resumo financeiro" bater com o quadro:
    // mão de obra = (presenças + atestados) × diária; alimentação = refeições marcadas nos RDOs × preço configurado
    // (não o campo gravado r.totalAlimentacao, que na demonstração era um valor fixo por presente e divergia da tabela).
    const custoMaoObra = somaFreq.aPagar;
    const totalAlimentacao = somaFreq.alimentacao;
    const custoTotalSem = custoMaoObra + totalAlimentacao + totalCombustivel + totalDespesas;

    const html = `<html><head><meta charset="UTF-8"><title>RDO Semanal - ${_escDoc(obraSel.nome)}</title>
      <style>
        ${KM_PDF_PAGE_CSS}
        ${KM_PDF_CSS}
        .quadro tbody tr.total td { background: #fff7df; }
        .selos { margin: 0 0 6px; }
        .selos .selo { margin-right: 6px; }
      </style></head><body>

      ${gerarHeaderHTML({ tipo: "RDO Semanal Consolidado", periodo, info_extra: `${obraSel.nome}${obraSel.local ? " · " + obraSel.local : ""} · ${rdosSem.length} dia(s)${modoFallback ? " · últimos RDOs emitidos (nenhum na semana atual)" : ""}`, empresa })}

      <div class="sec">Indicadores da semana</div>
      <div class="kpis">
        <div class="kpi ok"><b>${totalPres}</b><span>Presenças (homens-dia)</span></div>
        <div class="kpi erro"><b>${totalFalt}</b><span>Faltas · ${totalAtest} atestado${totalAtest === 1 ? "" : "s"}</span></div>
        <div class="kpi alerta"><b>${_horasDoc(totalHE)}</b><span>Horas extras (50%)</span></div>
        <div class="kpi"><b>${fotosSem.length}</b><span>Fotos registradas</span></div>
      </div>

      <div class="sec">Frequência e custos por trabalhador</div>
      <table class="quadro compacto">
        <thead><tr><th style="width:25%">Nome</th><th style="width:18%">Cargo</th><th style="width:9%" class="num">Presente</th><th style="width:7%" class="num">Falta</th><th style="width:9%" class="num">Atestado</th><th style="width:7%" class="num">Horas</th><th style="width:12%" class="num">Alimentação</th><th style="width:13%" class="num">A pagar</th></tr></thead>
        <tbody>
        ${linhasFreq.length === 0 ? '<tr><td colspan="8" class="vazio">Sem presenças registradas nos RDOs do período</td></tr>' : linhasFreq.map(({ t, st, aPagar }) => `<tr><td><b>${_escDoc(t.nome)}</b></td><td>${_escDoc(t.cargo)}</td><td class="num txt-ok"><b>${st.p}</b></td><td class="num ${st.f ? "txt-erro" : "txt-cinza"}">${st.f}</td><td class="num ${st.a ? "txt-alerta" : "txt-cinza"}">${st.a}</td><td class="num">${_horasDoc(st.horas)}</td><td class="num">${_brl(st.alimentacao)}</td><td class="num"><b>${_brl(aPagar)}</b></td></tr>`).join("") + `<tr class="total"><td colspan="2">Total da semana</td><td class="num">${somaFreq.p}</td><td class="num">${somaFreq.f}</td><td class="num">${somaFreq.a}</td><td class="num">${_horasDoc(somaFreq.horas)}</td><td class="num">${_brl(somaFreq.alimentacao)}</td><td class="num">${_brl(somaFreq.aPagar)}</td></tr>`}
        </tbody>
      </table>
      <div class="nota">Presente, Falta e Atestado = dias no período. A pagar = (presenças + atestados) × diária do trabalhador. Alimentação = refeições marcadas nos RDOs com preço configurado.</div>

      ${prodSem.length > 0 ? `
      <div class="sec">Produtividade executada</div>
      <table class="quadro">
        <thead><tr><th style="width:60%">Serviço</th><th style="width:20%" class="num">Quantidade</th><th style="width:20%">Unidade</th></tr></thead>
        <tbody>${Object.entries(prodTotal).map(([k, total]) => { const [tipo, un] = k.split("|"); return `<tr><td><b>${_escDoc(tipo)}</b></td><td class="num txt-ok"><b>${_numDoc(total, 1)}</b></td><td>${_escDoc(un)}</td></tr>`; }).join("")}</tbody>
      </table>
      ` : ""}

      <div class="sec">Atividades por dia</div>
      <table class="quadro">
        <thead><tr><th style="width:13%">Data</th><th style="width:9%" class="num">RDO Nº</th><th style="width:20%">Encarregado</th><th style="width:12%">Clima</th><th style="width:46%">Observações</th></tr></thead>
        <tbody>${rdosOrdenados.length === 0 ? '<tr><td colspan="5" class="vazio">Sem registros</td></tr>' : rdosOrdenados.map(r => `<tr><td><b>${_escDoc(r.data)}</b></td><td class="num">${String(r.numero ?? "").padStart(3, "0")}</td><td>${_escDoc(r.encarregado) || "—"}</td><td>${_escDoc(r.clima) || "—"}</td><td>${r.observacoes ? _quebrasDoc(r.observacoes) : "—"}</td></tr>`).join("")}</tbody>
      </table>

      ${diarioSem.length > 0 ? `
      <div class="sec">Anotações do diário</div>
      <table class="quadro">
        <thead><tr><th style="width:13%">Data</th><th style="width:22%">Autor</th><th style="width:65%">Anotação</th></tr></thead>
        <tbody>${diarioSem.sort((a, b) => a.ts - b.ts).map(d => `<tr><td>${new Date(d.ts).toLocaleDateString("pt-BR")}</td><td>${_escDoc(d.autor) || "—"}</td><td>${d.texto ? _quebrasDoc(d.texto) : "—"}</td></tr>`).join("")}</tbody>
      </table>
      ` : ""}

      ${pedidosSem.length > 0 ? `
      <div class="sec">Pedidos de material <small>${pedidosSem.length} no período</small></div>
      <div class="selos"><span class="selo ok">${pedAprov.length} aprovado${pedAprov.length !== 1 ? "s" : ""}</span><span class="selo alerta">${pedAguard.length} aguardando</span><span class="selo erro">${pedNeg.length} negado${pedNeg.length !== 1 ? "s" : ""}</span></div>
      <table class="quadro">
        <thead><tr><th style="width:10%" class="num">Nº</th><th style="width:13%">Data</th><th style="width:33%">Material</th><th style="width:14%" class="num">Quantidade</th><th style="width:16%">Marca</th><th style="width:14%" class="centro">Situação</th></tr></thead>
        <tbody>${pedidosSem.sort((a, b) => (a.ts || 0) - (b.ts || 0)).map(p => `<tr><td class="num"><b>${String(p.id).slice(-6)}</b></td><td>${_escDoc(p.dataSolicitacao || p.data) || "—"}</td><td><b>${_escDoc(p.material) || "—"}</b></td><td class="num">${p.qtd ? _escDoc(fmtQtd(p.qtd)) : "—"}</td><td>${_escDoc(p.marca) || "—"}</td><td class="centro ${_clsStatusPedido(p.status)}"><b>${_escDoc(p.status) || "—"}</b></td></tr>`).join("")}</tbody>
      </table>
      ` : ""}

      ${movPessSem.length > 0 ? `
      <div class="sec">Movimentações de pessoal <small>${movPessSem.length} no período</small></div>
      <table class="quadro">
        <thead><tr><th style="width:12%">Data</th><th style="width:22%">Trabalhador</th><th style="width:28%">Origem → Destino</th><th style="width:24%">Motivo</th><th style="width:14%" class="centro">Situação</th></tr></thead>
        <tbody>${movPessSem.map(m => { const oOrig = obras.find(o => o.id === m.obraOrigem)?.nome || "—"; const oDest = obras.find(o => o.id === m.obraDestino)?.nome || "—"; return `<tr><td>${_escDoc(m.data) || "—"}</td><td><b>${_escDoc(m.trabNome) || "—"}</b></td><td>${_escDoc(oOrig)} → ${_escDoc(oDest)}</td><td>${_escDoc(m.motivo) || "—"}</td><td class="centro">${_escDoc(m.status) || "—"}</td></tr>`; }).join("")}</tbody>
      </table>
      ` : ""}
      ${movEquipSem.length > 0 ? `
      <div class="sec">Movimentações de equipamentos <small>${movEquipSem.length} no período</small></div>
      <table class="quadro">
        <thead><tr><th style="width:12%">Data</th><th style="width:22%">Item</th><th style="width:28%">Origem → Destino</th><th style="width:24%">Motivo</th><th style="width:14%" class="centro">Situação</th></tr></thead>
        <tbody>${movEquipSem.map(m => `<tr><td>${_escDoc(m.dataSolicitacao) || "—"}</td><td><b>${_escDoc(m.itemNome) || "—"}</b></td><td>${_escDoc(m.obraOrigemNome) || "—"} → ${_escDoc(m.obraDestinoNome) || "—"}</td><td>${_escDoc(m.motivo) || "—"}</td><td class="centro">${_escDoc(m.status) || "—"}</td></tr>`).join("")}</tbody>
      </table>
      ` : ""}

      ${despesasSem.length > 0 ? `
      <div class="sec">Despesas avulsas</div>
      <table class="quadro">
        <thead><tr><th style="width:13%">Data</th><th style="width:22%">Categoria</th><th style="width:47%">Descrição</th><th style="width:18%" class="num">Valor</th></tr></thead>
        <tbody>${despesasSem.map(d => `<tr><td>${_escDoc(d.data) || "—"}</td><td>${_escDoc(d.categoria) || "—"}</td><td>${_escDoc(d.descricao) || "—"}</td><td class="num"><b>${_brl(d.valor)}</b></td></tr>`).join("")}<tr class="total"><td colspan="3">Total das despesas avulsas</td><td class="num">${_brl(totalDespesas)}</td></tr></tbody>
      </table>
      ` : ""}

      ${combPorVeic.length > 0 ? `
      <div class="sec">Combustível por veículo</div>
      <table class="quadro">
        <thead><tr><th style="width:30%">Veículo</th><th style="width:14%">Placa</th><th style="width:18%" class="num">Abastecimentos</th><th style="width:16%" class="num">Litros</th><th style="width:22%" class="num">Valor</th></tr></thead>
        <tbody>${combPorVeic.map(v => `<tr><td><b>${_escDoc(v.ativo.nome)}</b></td><td>${_escDoc(v.ativo.placa) || "—"}</td><td class="num">${v.qtd}</td><td class="num">${_numDoc(v.litros, 1)} L</td><td class="num"><b>${_brl(v.gasto)}</b></td></tr>`).join("")}<tr class="total"><td colspan="2">Total do período</td><td class="num">${combPorVeic.reduce((s, v) => s + v.qtd, 0)}</td><td class="num">${_numDoc(combPorVeic.reduce((s, v) => s + v.litros, 0), 1)} L</td><td class="num">${_brl(combPorVeic.reduce((s, v) => s + v.gasto, 0))}</td></tr></tbody>
      </table>
      ` : ""}

      ${fotosSem.length > 0 ? `
      <div class="sec">Registro fotográfico <small>${fotosSem.length} foto${fotosSem.length > 1 ? "s" : ""}</small></div>
      <div class="fotos f4">
        ${fotosSem.slice(0, 24).map(f => `<figure><img src="${_escDoc(_srcImgDoc(f.foto))}" alt=""/><figcaption><b>#${String(f.numero || 0).padStart(3, "0")}</b> · ${_escDoc(f.data) || "—"} ${_escDoc(f.hora || "")}<br/>${_escDoc((f.legenda || "").substring(0, 35))}${(f.legenda || "").length > 35 ? "…" : ""}</figcaption></figure>`).join("")}
      </div>
      ${fotosSem.length > 24 ? `<div class="nota">+ ${fotosSem.length - 24} foto(s) adicional(is) na galeria do aplicativo.</div>` : ""}
      ` : ""}

      <div class="sec">Acumulado da obra</div>
      <table class="quadro">
        <thead><tr><th style="width:70%">Indicador</th><th style="width:30%" class="num">Total</th></tr></thead>
        <tbody><tr><td>Total de RDOs emitidos</td><td class="num"><b>${totalRdosObra}</b></td></tr><tr><td>Total de pedidos da obra</td><td class="num"><b>${totalPedidosObra}</b></td></tr></tbody>
      </table>

      <div class="sec">Resumo financeiro da semana</div>
      <table class="quadro junto">
        <thead><tr><th style="width:70%">Item</th><th style="width:30%" class="num">Valor</th></tr></thead>
        <tbody>
          <tr><td><b>Mão de obra (diárias)</b></td><td class="num">${_brl(custoMaoObra)}</td></tr>
          <tr><td><b>Alimentação</b></td><td class="num">${_brl(totalAlimentacao)}</td></tr>
          <tr><td><b>Combustível</b></td><td class="num">${_brl(totalCombustivel)}</td></tr>
          <tr><td><b>Despesas avulsas</b></td><td class="num">${_brl(totalDespesas)}</td></tr>
          <tr class="total"><td>Total da semana</td><td class="num">${_brl(custoTotalSem)}</td></tr>
        </tbody>
      </table>

      ${gerarAssinaturasHTML({ empresa, autor: empresa.responsavel })}
      ${gerarFooterHTML({ empresa, autor: empresa.responsavel })}
    </body></html>`;

      abrirOuBaixarHTML(html, "RDO-Semanal-" + obraSel.nome.replace(/[^a-z0-9]/gi, "_").substring(0, 25) + "-" + periodo.replace(/\//g, "-").replace(/\s/g, ""));
    } catch (err) {
      console.error("Erro RDO Semanal:", err);
      alert("❌ ERRO no RDO Semanal:\n\n" + (err && err.message ? err.message : err) + "\n\nLinha: " + (err && err.stack ? err.stack.split("\n")[1] : "?"));
    }
  };

  const trabObra = trabalhadores.filter(t => t.obraId === obraId);
  const presentes = trabObra.filter(t => presencasDia[t.id] === "Presente").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="RDO ABNT" sub="Relatório Diário Auditável" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: T.fundo, padding: 14 }}>
        <div style={{ background: `linear-gradient(135deg,${NAVY},${NAVY2})`, color: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: "0 4px 14px rgba(15,33,81,0.3)" }}>
          <div style={{ fontSize: 11, opacity: 0.7 }}>Próximo RDO</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: GOLD }}>Nº {String(proxNumero).padStart(3, "0")}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>{rdosEmitidos.length} RDO(s) já emitidos</div>
        </div>

        <label style={labelS}>Obra</label>
        <select value={obraId} onChange={e => setObraId(parseInt(e.target.value))} style={selS}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <label style={labelS}>Data do RDO</label>
        <input value={data} onChange={e => setData(e.target.value)} placeholder="DD/MM/AAAA" style={inputS} />

        <label style={labelS}>Condição climática</label>
        <select value={clima} onChange={e => setClima(e.target.value)} style={selS}>
          <option>Bom</option><option>Nublado</option><option>Chuva leve</option><option>Chuva forte</option><option>Vento forte</option><option>Calor extremo</option>
        </select>

        <label style={labelS}>Observações gerais (opcional)</label>
        <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} placeholder="Ex: serviço de alvenaria conforme cronograma..." style={{ ...inputS, resize: "none", fontFamily: "inherit" }} />

        <div style={{ background: T.superficie, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: T.sombra }}>
          <div style={{ fontWeight: 800, color: T.titulo, marginBottom: 10, fontSize: 14 }}>📋 Conteúdo do RDO</div>
          <div style={{ fontSize: 12, color: T.texto2 }}>
            <div style={{ padding: "4px 0", borderBottom: `1px solid ${T.borda}` }}>👷 Mão de obra: <b>{trabObra.length}</b> ({presentes} presentes)</div>
            <div style={{ padding: "4px 0", borderBottom: `1px solid ${T.borda}` }}>🚜 Ativos: <b>{ativos.filter(a => a.obraId === obraId).length}</b></div>
            <div style={{ padding: "4px 0", borderBottom: `1px solid ${T.borda}` }}>📦 Pedidos do dia: <b>{pedidos.filter(p => p.obraId === obraId && p.data === data).length}</b></div>
            <div style={{ padding: "4px 0" }}>📌 Ocorrências: <b>{ocorrenciasDia.length}</b></div>
          </div>
        </div>

        <div style={{ background: T.superficie, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: T.sombra }}>
          <div style={{ fontWeight: 800, color: T.titulo, marginBottom: 8, fontSize: 14 }}>🏢 Empresa Emissora</div>
          <div style={{ fontSize: 11, color: T.texto2 }}>
            <div><b>{empresa.razaoSocial}</b></div>
            <div>CNPJ: {empresa.cnpj}</div>
            <div>Resp. Técnico: {empresa.responsavel}</div>
            <div>{empresa.telefone} • {empresa.email}</div>
          </div>
        </div>

        <Btn label="📄 EMITIR RDO PADRÃO ABNT (PDF)" color={GOLD} onClick={emitir} />

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={() => emitirSemanal(obraId)} style={{ flex: 1, background: NAVY, color: "#fff", border: "none", borderRadius: 10, padding: "10px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>📅 RDO Semanal Consolidado</button>
        </div>

        {rdosEmitidos.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, color: T.titulo, marginBottom: 8, fontSize: 13 }}>📜 RDOs Recentes ({rdosEmitidos.length})</div>
            <Grade min={320} gap={6} style={{ marginBottom: 6 }}>
            {rdosEmitidos.slice(0, 10).map(r => {
              const o = obras.find(x => x.id === r.obraId);
              const baixar = () => {
                const isoDt = r.dataIso || (() => { const [d, m, a] = r.data.split("/"); return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; })();
                gerarPDFRDORabnt({
                  numero: r.numero,
                  obra: o,
                  data: r.data,
                  clima: r.clima || "Bom",
                  observacoes: r.observacoes || "",
                  presencas: r.presencas || historico[isoDt] || {},
                  trabalhadores, ativos, abastecimentos, pedidos,
                  ocorrencias: _diarioDoDia(diario, r.obraId, r.data),
                  encarregado: r.encarregado,
                  empresa,
                  horasTrabalhadas: r.horasTrabalhadas,
                  horimetros: r.horimetros,
                  fotos: r.fotos,
                  alimentacao: r.alimentacao,
                  totalAlimentacao: r.totalAlimentacao,
                  recebimentos,
                });
              };
              return (
                <div key={r.id} style={{ background: T.superficie, borderRadius: 10, padding: "10px 14px", boxShadow: T.sombra, borderLeft: r.autoGerado ? `4px solid ${GREEN}` : `4px solid ${BLUE}` }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 22, marginRight: 10 }}>📄</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: T.titulo, fontSize: 13 }}>RDO Nº {String(r.numero).padStart(3, "0")}{r.autoGerado && <span style={{ fontSize: 9, color: GREEN, fontWeight: 700, marginLeft: 6 }}>⚡ AUTO</span>}</div>
                      <div style={{ fontSize: 10, color: T.texto2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o?.nome} • {r.data} • {r.encarregado}</div>
                    </div>
                  </div>

                  {/* Mini-galeria de fotos do RDO — clicáveis */}
                  {r.fotos && r.fotos.length > 0 && (
                    <div style={{ display: "flex", gap: 4, marginBottom: 6, overflowX: "auto", paddingBottom: 4 }}>
                      {r.fotos.map((f, i) => (
                        <img
                          key={i}
                          src={f}
                          alt={`Foto ${i + 1}`}
                          onClick={() => setFotoVer({ src: f, legenda: `RDO Nº ${String(r.numero).padStart(3, "0")} • ${o?.nome} • ${r.data}` })}
                          style={{ width: 60, height: 60, borderRadius: 6, objectFit: "cover", flexShrink: 0, cursor: "pointer", border: `1px solid ${T.borda}` }}
                        />
                      ))}
                      <div style={{ fontSize: 9, color: T.texto2, alignSelf: "center", marginLeft: 4, flexShrink: 0 }}>
                        {r.fotos.length} foto{r.fotos.length > 1 ? "s" : ""}
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={baixar} style={{ flex: 1, background: GOLD, color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", fontWeight: 700, fontSize: 10, cursor: "pointer" }}>📄 PDF</button>
                    <button onClick={() => setEditandoRdo(r)} style={{ flex: 1, background: BLUE, color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", fontWeight: 700, fontSize: 10, cursor: "pointer" }}>✏️ Editar</button>
                    <button onClick={() => { confirmar(`Excluir RDO Nº ${r.numero}?`, () => { onRemoveRDO(r.id); }); }} style={{ background: T.erroFundo, color: RED, border: `1px solid ${RED}33`, borderRadius: 6, padding: "6px 10px", fontWeight: 700, fontSize: 10, cursor: "pointer" }}>🗑️</button>
                  </div>
                </div>
              );
            })}
            </Grade>
          </div>
        )}

        {/* MODAL EDITAR RDO */}
        {editandoRdo && (
          <Modal show={!!editandoRdo} title={`Editar RDO Nº ${String(editandoRdo.numero).padStart(3, "0")}`} onClose={() => setEditandoRdo(null)}>
            <label style={labelS}>Data</label>
            <input value={editandoRdo.data || ""} onChange={e => setEditandoRdo(r => ({ ...r, data: e.target.value }))} placeholder="DD/MM/AAAA" style={inputS} />
            <label style={labelS}>Clima</label>
            <select value={editandoRdo.clima || "Bom"} onChange={e => setEditandoRdo(r => ({ ...r, clima: e.target.value }))} style={selS}>
              {["Bom", "Nublado", "Chuvoso", "Sol forte", "Vento forte", "Garoa", "Tempestade"].map(c => <option key={c}>{c}</option>)}
            </select>
            <label style={labelS}>Observações / Atividades</label>
            <textarea value={editandoRdo.observacoes || ""} onChange={e => setEditandoRdo(r => ({ ...r, observacoes: e.target.value }))} rows={5} placeholder="Atividades realizadas, ocorrências, etc." style={{ ...inputS, fontFamily: "inherit" }} />
            <label style={labelS}>Encarregado</label>
            <input value={editandoRdo.encarregado || ""} onChange={e => setEditandoRdo(r => ({ ...r, encarregado: e.target.value }))} style={inputS} />
            <Btn label="💾 SALVAR ALTERAÇÕES" color={GREEN} onClick={() => {
              onUpdateRDO(editandoRdo);
              setEditandoRdo(null);
            }} />
          </Modal>
        )}
      </div>
      <KMFooter />
      {fotoVer && <FotoViewer src={fotoVer.src} legenda={fotoVer.legenda} onClose={() => setFotoVer(null)} />}
    </div>
  );
}

/* ════════════════════════════════════
   CONFIGURAÇÕES DA EMPRESA
════════════════════════════════════ */
/* ════════════════════════════════════
   ESCRITÓRIO — Funcionários indiretos (rateio entre obras)
════════════════════════════════════ */

export function TelaProdutividade({ obras, usuario, produtividade, onBack, onAdd, onRemove }) {
  const [obraId, setObraId] = useState(usuario?.obraId || obras[0]?.id || 1);
  const [tipo, setTipo] = useState("Alvenaria");
  const [qtd, setQtd] = useState("");
  const [unidade, setUnidade] = useState("m²");
  const [obs, setObs] = useState("");

  const TIPOS = [
    { nome: "Alvenaria", unidade: "m²", icon: "🧱" },
    { nome: "Concretagem", unidade: "m³", icon: "🏗️" },
    { nome: "Reboco", unidade: "m²", icon: "🎨" },
    { nome: "Piso", unidade: "m²", icon: "▪️" },
    { nome: "Forro", unidade: "m²", icon: "📐" },
    { nome: "Telhado", unidade: "m²", icon: "🏠" },
    { nome: "Pintura", unidade: "m²", icon: "🖌️" },
    { nome: "Escavação", unidade: "m³", icon: "⛏️" },
    { nome: "Estrutura Metálica", unidade: "kg", icon: "⚙️" },
    { nome: "Outro", unidade: "un", icon: "📦" },
  ];

  const adicionar = () => {
    if (!qtd) return;
    onAdd({ id: Date.now(), obraId, tipo, qtd: parseFloat(qtd), unidade, obs, autor: usuario?.nome, ts: Date.now(), data: new Date().toLocaleDateString("pt-BR") });
    setQtd(""); setObs("");
  };

  const minhasObra = produtividade.filter(p => p.obraId === obraId).sort((a, b) => b.ts - a.ts);
  const obra = obras.find(o => o.id === obraId);

  // Totais por tipo
  const totais = {};
  minhasObra.forEach(p => {
    const k = `${p.tipo}|${p.unidade}`;
    totais[k] = (totais[k] || 0) + p.qtd;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Produtividade" sub={obra?.nome} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: T.fundo, padding: 14 }}>
        <select value={obraId} onChange={e => setObraId(parseInt(e.target.value))} style={{ ...selS, marginBottom: 12 }}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ background: T.superficie, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: T.sombra }}>
          <div style={{ fontWeight: 800, color: T.titulo, marginBottom: 10, fontSize: 14 }}>📝 Registrar Produção</div>
          <label style={labelS}>Tipo de serviço</label>
          <select value={tipo} onChange={e => { const t = TIPOS.find(x => x.nome === e.target.value); setTipo(e.target.value); if (t) setUnidade(t.unidade); }} style={selS}>
            {TIPOS.map(t => <option key={t.nome}>{t.nome}</option>)}
          </select>
          <label style={labelS}>Quantidade executada</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={qtd} onChange={e => setQtd(e.target.value)} type="number" placeholder="Ex: 25,5" style={{ ...inputS, flex: 2, marginBottom: 0 }} />
            <select value={unidade} onChange={e => setUnidade(e.target.value)} style={{ ...selS, flex: 1, marginBottom: 0 }}>
              {["m²", "m³", "m", "kg", "un", "t", "L"].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <label style={{ ...labelS, marginTop: 10 }}>Observação (opcional)</label>
          <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: parede sul do bloco A" style={inputS} />
          <Btn label="✓ REGISTRAR" color={GREEN} onClick={adicionar} />
        </div>

        {Object.keys(totais).length > 0 && (
          <div style={{ background: T.superficie, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: T.sombra }}>
            <div style={{ fontWeight: 800, color: T.titulo, marginBottom: 10, fontSize: 14 }}>📊 Totais Acumulados</div>
            {Object.entries(totais).map(([k, v]) => {
              const [t, u] = k.split("|");
              const cfg = TIPOS.find(x => x.nome === t);
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.borda}` }}>
                  <span style={{ fontSize: 22, marginRight: 10 }}>{cfg?.icon || "📦"}</span>
                  <span style={{ flex: 1, fontSize: 13, color: T.titulo }}>{t}</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: GREEN }}>{v.toFixed(2)} {u}</span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ fontWeight: 700, color: T.titulo, marginBottom: 8, fontSize: 13 }}>📜 Histórico</div>
        {minhasObra.length === 0 && <div style={{ color: T.texto3, fontSize: 13, textAlign: "center", padding: 16 }}>Nenhum registro.</div>}
        {minhasObra.map(p => {
          const cfg = TIPOS.find(x => x.nome === p.tipo);
          return (
            <div key={p.id} style={{ background: T.superficie, borderRadius: 12, padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: T.sombra }}>
              <span style={{ fontSize: 24, marginRight: 10 }}>{cfg?.icon || "📦"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: T.titulo, fontSize: 13 }}>{p.tipo} — {fmtQtd(p.qtd)} {p.unidade}</div>
                <div style={{ fontSize: 11, color: T.texto2 }}>{p.autor} • {p.data}</div>
                {p.obs && <div style={{ fontSize: 10, color: T.texto2, fontStyle: "italic" }}>{p.obs}</div>}
              </div>
              <button onClick={() => onRemove(p.id)} style={{ background: T.erroFundo, border: `2px solid ${RED}`, color: RED, cursor: "pointer", padding: "6px 10px", borderRadius: 8, fontSize: 16, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>
            </div>
          );
        })}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   RECEBIMENTO DE MATERIAL (com foto + validação visual)
════════════════════════════════════ */
