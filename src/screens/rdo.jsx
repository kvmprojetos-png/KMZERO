import { MODELOS_CRONOGRAMA } from "./equipe.jsx";
import { useState, useEffect, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { loginFirebase, logoutFirebase, observarAutenticacao, recuperarSenha, atualizarSenha, usuarioAtual } from "../firebase.js";
import { NAVY, NAVY2, GOLD, GREEN, RED, ORANGE, BLUE, LIGHT, labelS, inputS, dateS, selS, bigBtn, css } from "../theme.js";
import { hojeStr, fmtData, ultimosDias, dataPascoa, feriadosDoAno, feriadoEm } from "../utils.js";
import { cloudRefs, enviarFotoNuvem, observarFotosNuvem, semUndefined, enviarDocNuvem, removerDocNuvem, observarColecaoNuvem, store } from "../lib/store.js";
import { FILE_DB_VERSION, FILE_STORE_NAME, openFileDB, fileStore, lerArquivoComoBase64, formatarTamanhoBytes, iconePorTipoArquivo } from "../lib/fileStore.js";
import { carregarScript, carregarPDFLibs, KM_PDF_PAGE_CSS, KM_PDF_CSS, gerarHeaderHTML, gerarFooterHTML, gerarAssinaturasHTML, fmtQtd, abrirOuBaixarHTML } from "../lib/pdf.js";
import { DEFAULT_FORNECEDORES, DEFAULT_OBRAS, DEFAULT_TRABALHADORES, gerarDadosMes30Dias, DEFAULT_EQUIPS, CARGOS, detectarUnidade, CATALOGO_KM_FULL, CAT_KM_BUSCA, CAT_KM_CATEGORIAS, CAT_KM_SUBCATEGORIAS, MATERIAIS_BANCO_DETALHADO, MATERIAIS_BANCO, MATERIAIS, CATALOGO_FROTA, CATALOGO_FROTA_NOMES, CATALOGO_EQUIPAMENTOS, CATALOGO_EQUIPAMENTOS_NOMES, MATERIAL_INFO, EQUIP_COLOR, STATUS_COLOR, EMPRESA_TEMPLATE, DEFAULT_FUNC_ESCRITORIO, DEFAULT_ATIVOS, VALOR_HORA_CARGO } from "../data/catalogos.js";
import { Badge, Btn, EmptyState, KMHeader, KMFooter, FotoViewer, Modal, confirmar, Assinatura } from "../components/ui.jsx";

export function TelaCronograma({ obras, cronogramas, onBack, onSalvar }) {
  const [obraId, setObraId] = useState(obras[0]?.id || 1);
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
        inicio: ini.toISOString().split("T")[0],
        fim: fim.toISOString().split("T")[0],
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
    const html = `<html><head><title>Cronograma - ${obra.nome}</title></head><body>
      <h1 style="color:#0f2151;border-bottom:3px solid #C0A040;padding-bottom:8px;">📅 Cronograma da Obra</h1>
      <p><b>Obra:</b> ${obra.nome}<br/>
      <b>Local:</b> ${obra.local}<br/>
      <b>Status:</b> ${obra.status}<br/>
      <b>Progresso geral:</b> ${progressoGeral}%<br/>
      <b>Total de etapas:</b> ${etapas.length}<br/>
      <b>Gerado em:</b> ${new Date().toLocaleString("pt-BR")}</p>

      <h2>📋 Etapas do Projeto</h2>
      <table>
        <tr>
          <th style="width:5%">Nº</th>
          <th>Etapa</th>
          <th style="width:10%">Início</th>
          <th style="width:10%">Fim</th>
          <th style="width:8%">Dias</th>
          <th style="width:10%">Progresso</th>
          <th style="width:14%">Responsável</th>
        </tr>
        ${etapas.map((e, i) => {
          const ini = e.inicio ? new Date(e.inicio).toLocaleDateString("pt-BR") : "—";
          const fim = e.fim ? new Date(e.fim).toLocaleDateString("pt-BR") : "—";
          let dias = "—";
          if (e.inicio && e.fim) {
            const d = Math.round((new Date(e.fim) - new Date(e.inicio)) / (1000 * 60 * 60 * 24));
            dias = d + "d";
          }
          const cor = e.progresso === 100 ? "#2aa84f" : e.progresso > 0 ? "#e87722" : "#999";
          return `<tr>
            <td style="text-align:center"><b>${i + 1}</b></td>
            <td><b>${e.nome}</b>${e.obs ? '<br/><span style="font-size:8pt;color:#888">' + e.obs + '</span>' : ''}</td>
            <td style="text-align:center">${ini}</td>
            <td style="text-align:center">${fim}</td>
            <td style="text-align:center">${dias}</td>
            <td style="text-align:center;color:${cor};font-weight:700">${e.progresso || 0}%</td>
            <td>${e.responsavel || "—"}</td>
          </tr>`;
        }).join("")}
      </table>
      <div class="footer">Sistema KMZERO • Cronograma gerado automaticamente</div>
    </body></html>`;
    abrirOuBaixarHTML(html, `Cronograma-${obra.nome.replace(/[^a-z0-9]/gi, "_").substring(0, 25)}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Cronograma" sub="Etapas da obra" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
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
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, color: NAVY, fontSize: 13, marginBottom: 8 }}>🚀 Começar com modelo pronto</div>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 10 }}>Aplica um modelo padrão de etapas baseado no tipo da obra (você pode editar depois).</div>
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
          const cor = e.progresso === 100 ? GREEN : e.progresso > 0 ? ORANGE : "#aaa";
          const concluida = e.progresso === 100;
          return (
            <div key={e.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${cor}`, opacity: concluida ? 0.75 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 14, background: cor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, marginRight: 10 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 13, textDecoration: concluida ? "line-through" : "none" }}>{e.nome}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>
                    {e.inicio && new Date(e.inicio).toLocaleDateString("pt-BR")}
                    {e.inicio && e.fim && " → "}
                    {e.fim && new Date(e.fim).toLocaleDateString("pt-BR")}
                    {e.responsavel && ` • ${e.responsavel}`}
                  </div>
                </div>
                <button onClick={() => moverEtapa(e.id, -1)} disabled={i === 0} style={{ background: "none", border: "none", color: i === 0 ? "#ddd" : "#666", cursor: i === 0 ? "default" : "pointer", fontSize: 16 }}>↑</button>
                <button onClick={() => moverEtapa(e.id, 1)} disabled={i === etapas.length - 1} style={{ background: "none", border: "none", color: i === etapas.length - 1 ? "#ddd" : "#666", cursor: i === etapas.length - 1 ? "default" : "pointer", fontSize: 16 }}>↓</button>
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

              {e.obs && <div style={{ fontSize: 11, color: "#666", fontStyle: "italic", marginTop: 4, paddingLeft: 38 }}>"{e.obs}"</div>}

              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button onClick={() => { setEditando(e); setModal(true); }} style={{ flex: 1, padding: 6, borderRadius: 6, border: `1px solid ${BLUE}`, background: "#fff", color: BLUE, fontWeight: 700, cursor: "pointer", fontSize: 10 }}>✏️ Editar</button>
                <button onClick={() => removerEtapa(e.id)} style={{ padding: 6, borderRadius: 6, border: `1px solid ${RED}`, background: "#fff", color: RED, fontWeight: 700, cursor: "pointer", fontSize: 10, width: 50 }}>🗑️</button>
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
  if (!pontos || pontos.length === 0) {
    return <div style={{ padding: 30, textAlign: "center", color: "#888", fontSize: 12 }}>Adicione etapas com datas pra ver a curva.</div>;
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
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ background: "#fff", borderRadius: 8 }}>
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line x1={padX} y1={py(v)} x2={W - padX} y2={py(v)} stroke="#e5e7eb" strokeDasharray="2 2" />
          <text x={padX - 4} y={py(v) + 3} fontSize="9" fill="#999" textAnchor="end">{v}%</text>
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
        <text key={i} x={px(pontos.indexOf(p))} y={H - 4} fontSize="8" fill="#888" textAnchor="middle">{p.data}</text>
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
  const hojeIso = new Date().toISOString().split("T")[0];
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
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        <select value={obraId} onChange={e => setObraId(parseInt(e.target.value))} style={{ ...selS, marginBottom: 10 }}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 12 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", borderLeft: `4px solid ${kpis.idp >= 0.95 ? GREEN : kpis.idp >= 0.85 ? ORANGE : RED}` }}>
            <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>IDP · Prazo</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: NAVY, marginTop: 2 }}>{kpis.idp.toFixed(2)}</div>
            <div style={{ fontSize: 10, color: kpis.idp >= 1 ? GREEN : RED, fontWeight: 700 }}>
              {kpis.idp >= 1 ? "✓ No ritmo" : `${((1 - kpis.idp) * 100).toFixed(1)}% abaixo`}
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", borderLeft: `4px solid ${BLUE}` }}>
            <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Avanço Físico</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: NAVY, marginTop: 2 }}>{kpis.pctExec.toFixed(1)}%</div>
            <div style={{ fontSize: 10, color: "#888" }}>Plan. {kpis.pctPrev.toFixed(1)}%</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", borderLeft: `4px solid ${kpis.atrasoCritico > 7 ? RED : kpis.atrasoCritico > 0 ? ORANGE : GREEN}` }}>
            <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Δ Crítico</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: NAVY, marginTop: 2 }}>
              {kpis.atrasoCritico > 0 ? `+${kpis.atrasoCritico}d` : "0d"}
            </div>
            <div style={{ fontSize: 10, color: kpis.atrasoCritico > 0 ? RED : GREEN, fontWeight: 700 }}>
              {kpis.atrasoCritico > 0 ? "Atrasado" : "Em dia"}
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", borderLeft: `4px solid #7c3aed` }}>
            <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Custo Base</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: NAVY, marginTop: 2 }}>
              R$ {(kpis.custoTotal / 1000).toFixed(2)}k
            </div>
            <div style={{ fontSize: 10, color: "#888" }}>EV: R$ {(kpis.va / 1000).toFixed(2)}k</div>
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
              background: aba === t.id ? NAVY : "#fff",
              color: aba === t.id ? "#fff" : NAVY,
              border: aba === t.id ? "none" : "1px solid #ddd",
              cursor: "pointer", fontSize: 11, fontWeight: 700,
            }}>{t.label}</button>
          ))}
        </div>

        {aba === "gantt" && (
          etapas.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 36 }}>📅</div>
              <div style={{ color: "#888", fontSize: 13, marginTop: 8 }}>
                Nenhuma etapa nessa obra. Crie etapas no <b>Cronograma simples</b> primeiro.
              </div>
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
              {etapas.map(e => {
                const def = (e.pctPrevisto || 0) - (e.progresso || 0);
                const corBarra = e.critica ? GOLD : BLUE;
                return (
                  <div key={e.id} onClick={() => abrirEtapa(e)} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #eee", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                        {e.critica && <span style={{ color: GOLD, fontSize: 11 }}>●</span>}
                        <span style={{ fontSize: 12, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.nome}</span>
                      </div>
                      <span style={{ fontSize: 10, color: "#888", marginLeft: 6, flexShrink: 0 }}>{e.progresso || 0}%</span>
                    </div>
                    <div style={{ position: "relative", height: 14, background: "#f5f5f5", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ position: "absolute", inset: 0, background: corBarra + "22" }} />
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${e.progresso || 0}%`, background: corBarra }} />
                      <div style={{ position: "absolute", left: `${e.pctPrevisto || 0}%`, top: 0, bottom: 0, width: 2, background: "#0f2151" }} title="Previsto" />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 9, color: "#888" }}>
                      <span>{e.inicio || "—"} → {e.fim || "—"}</span>
                      <span style={{ color: def > 12 ? RED : def > 5 ? ORANGE : GREEN, fontWeight: 700 }}>
                        {def === 0 ? "No ritmo" : def > 0 ? `${def.toFixed(0)} pts atrás` : `${Math.abs(def).toFixed(0)} pts à frente`}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize: 10, color: "#888", marginTop: 8, padding: "6px 8px", background: "#f9fafb", borderRadius: 6 }}>
                ● Etapa crítica • | Linha vertical = % previsto pra hoje
              </div>
            </div>
          )
        )}

        {aba === "curva" && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Curva S — Avanço Físico Acumulado</div>
            <CurvaSChart pontos={pontosCurvaS} />
            <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: "#888" }}>
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
            <div style={{ background: "#f0fdf4", borderRadius: 12, padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 36 }}>✅</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, marginTop: 8 }}>Tudo em ordem!</div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>Nenhuma inconsistência detectada.</div>
            </div>
          ) : (
            <div>
              {alertas.map((a, i) => {
                const cor = a.severidade === "alta" ? RED : a.severidade === "media" ? ORANGE : BLUE;
                return (
                  <div key={i} style={{ background: "#fff", borderRadius: 10, padding: 12, marginBottom: 8, borderLeft: `4px solid ${cor}`, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: NAVY }}>{a.etapa}</div>
                      <span style={{ background: cor, color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: 8, fontWeight: 800, textTransform: "uppercase" }}>{a.severidade}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#444", lineHeight: 1.4 }}>{a.msg}</div>
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
            <div style={{ background: "#f9fafb", borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 11, color: "#666" }}>
              📅 {etapaSel.inicio || "—"} → {etapaSel.fim || "—"}<br/>
              📊 Previsto pra hoje: <b>{etapaSel.pctPrevisto || 0}%</b>
            </div>
            <label style={labelS}>📈 Progresso Real (%)</label>
            <input type="number" min="0" max="100" value={progressoInput} onChange={e => setProgressoInput(e.target.value)} style={inputS} />
            <label style={labelS}>💰 Custo Base (R$)</label>
            <input type="number" value={custoInput} onChange={e => setCustoInput(e.target.value)} placeholder="0" style={inputS} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, background: criticaInput ? "#fef9e7" : "#f9fafb", borderRadius: 8, cursor: "pointer", marginBottom: 10 }}>
              <input type="checkbox" checked={criticaInput} onChange={e => setCriticaInput(e.target.checked)} />
              <span style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>⚠️ Etapa do Caminho Crítico</span>
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

export function gerarPDFRDORabnt({ numero, obra, data, clima, observacoes, presencas, trabalhadores, ativos, abastecimentos, pedidos, ocorrencias, encarregado, empresa, horasTrabalhadas, horimetros, fotos, alimentacao, totalAlimentacao, recebimentos }) {
  const trabObra = trabalhadores.filter(t => t.obraId === obra.id);
  const ativosObra = ativos.filter(a => a.obraId === obra.id);
  const abastDia = abastecimentos.filter(a => a.obraId === obra.id && a.data === data);
  const pedidosDia = pedidos.filter(p => p.obraId === obra.id && p.data === data);

  const presentes = trabObra.filter(t => presencas[t.id] === "Presente").length;
  const faltas    = trabObra.filter(t => presencas[t.id] === "Falta").length;
  const atestados = trabObra.filter(t => presencas[t.id] === "Atestado").length;
  // Calcula total de horas com horas trabalhadas reais (se passadas)
  let totalHoras = 0;
  let totalHE = 0;
  trabObra.forEach(t => {
    if (presencas[t.id] === "Presente") {
      const h = horasTrabalhadas?.[t.id] || 9;
      totalHoras += h;
      if (h > 9) totalHE += (h - 9);
    }
  });

  const html = `<html><head><title>RDO ${String(numero).padStart(3, "0")} — ${obra.nome}</title>
    <style>
      ${KM_PDF_PAGE_CSS}
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 9.5pt; line-height: 1.35; }
      .cabecalho { border: 2px solid #004080; padding: 0; margin-bottom: 12px; }
      .cabecalho-top { background: #004080; color: #fff; padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; }
      .logo { font-weight: 900; font-size: 22pt; letter-spacing: -1px; line-height: 1; }
      .logo-zero { color: #C0A040; }
      .logo-sub { font-size: 8pt; letter-spacing: 2.5px; opacity: 0.8; margin-top: 2px; }
      .titulo-rdo { font-size: 14pt; font-weight: 800; letter-spacing: 1px; }
      .num-rdo { font-size: 10pt; font-weight: 700; color: #C0A040; margin-top: 2px; text-align: right; }
      .empresa-info { padding: 8px 14px; background: #f5f8fc; font-size: 8.5pt; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; border-top: 1px solid #d0dae8; }
      .empresa-info b { color: #004080; }
      .info-obra { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 1px solid #ccc; margin-bottom: 12px; }
      .info-cell { padding: 6px 10px; border-right: 1px solid #ccc; }
      .info-cell:last-child { border-right: none; }
      .info-cell .lbl { font-size: 7.5pt; color: #777; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
      .info-cell .val { font-size: 11pt; color: #1a1a1a; font-weight: 700; margin-top: 1px; }
      h2 { color: #fff; background: #004080; font-size: 9.5pt; margin: 14px 0 0; padding: 5px 10px; letter-spacing: 0.5px; font-weight: 700; text-transform: uppercase; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 8.5pt; table-layout: auto; }
      th { background: #e8eef6; color: #003060; padding: 5px 6px; border: 1px solid #c5d0e0; text-align: left; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; white-space: nowrap; }
      td { padding: 4px 6px; border: 1px solid #d5dce6; vertical-align: top; overflow-wrap: break-word; word-break: normal; }
      /* Apenas em colunas de observação/texto longo permitimos quebra: usar classe .td-wrap */
      td.td-wrap, th.td-wrap { white-space: normal; overflow-wrap: break-word; word-break: normal; max-width: 280px; }
      /* Tabelas envolvidas em wrapper com scroll horizontal se passar */
      .table-scroll { overflow-x: auto; max-width: 100%; }
      /* Coluna 1 (numero): compacta */
      th:first-child, td:first-child { min-width: 28px; }
      /* Coluna 2 (nome): quebra em 2 linhas se for longo (não invade a coluna Cargo) */
      th:nth-child(2), td:nth-child(2) { white-space: normal; overflow-wrap: break-word; word-break: normal; min-width: 100px; }
      td.num { text-align: right; white-space: nowrap; }
      tr:nth-child(even) td { background: #fafbfd; }
      .num { text-align: center; font-variant-numeric: tabular-nums; }
      .badge-p { color: #2aa84f; font-weight: 700; }
      .badge-f { color: #d63b3b; font-weight: 700; }
      .badge-a { color: #e87722; font-weight: 700; }
      .resumo { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 6px 0 12px; }
      .resumo-card { padding: 6px; border: 1px solid #d5dce6; text-align: center; background: #fafbfd; }
      .resumo-card .v { font-size: 14pt; font-weight: 800; color: #004080; }
      .resumo-card .l { font-size: 7.5pt; color: #666; text-transform: uppercase; letter-spacing: 0.4px; }
      .obs-bloco { border: 1px solid #ccc; padding: 8px 10px; min-height: 50px; font-size: 9pt; background: #fafbfd; margin-bottom: 12px; line-height: 1.5; }
      .ocorrencia { padding: 5px 10px; border-left: 3px solid #C0A040; background: #fffbf0; margin-bottom: 4px; font-size: 9pt; }
      .ocorrencia .ts { font-size: 7.5pt; color: #888; margin-bottom: 2px; }
      .vazio { color: #aaa; font-style: italic; font-size: 9pt; padding: 8px; text-align: center; }
      .footer { margin-top: 16px; border-top: 2px solid #004080; padding-top: 8px; text-align: center; font-size: 7.5pt; color: #666; }
      .footer b { color: #004080; }

      /* MULTI-PÁGINA: regras de quebra para A4 */
      h2 { page-break-after: avoid; break-after: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; break-inside: avoid; }
      thead { display: table-header-group; }
      .ocorrencia, .obs-bloco { page-break-inside: avoid; break-inside: avoid; }
      img { page-break-inside: avoid; break-inside: avoid; max-width: 100%; }

      @media print {
        h2 + table thead { display: table-header-group; }
        .footer { page-break-before: avoid; }
      }
      ${KM_PDF_CSS}
    </style></head><body>

    ${gerarHeaderHTML({ tipo: "Relatório Diário de Obra", numero, info_extra: `${obra.nome} · ${obra.local || ""} · ${data} · Clima: ${clima || "—"}`, empresa })}

    <div class="resumo">
      <div class="resumo-card"><div class="v">${trabObra.length}</div><div class="l">Efetivo</div></div>
      <div class="resumo-card"><div class="v" style="color:#2aa84f">${presentes}</div><div class="l">Presentes</div></div>
      <div class="resumo-card"><div class="v" style="color:#d63b3b">${faltas}</div><div class="l">Faltas</div></div>
      <div class="resumo-card"><div class="v" style="color:#004080">${totalHoras}h</div><div class="l">Total Horas</div></div>
    </div>

    <h2>1. Mão de Obra — Apropriação de Custo Direto</h2>
    <table>
      <tr><th style="width:5%" class="num">Nº</th><th>Nome</th><th style="width:22%">Cargo</th><th style="width:9%" class="num">Entrada</th><th style="width:9%" class="num">Saída</th><th style="width:9%" class="num">Total h</th><th style="width:9%" class="num">H.E. (50%)</th><th style="width:11%" class="num">Status</th></tr>
      ${trabObra.length === 0 ? '<tr><td colspan="8" class="vazio">Sem mão de obra registrada</td></tr>' : trabObra.map((t, i) => {
        const status = presencas[t.id] || "Sem registro";
        const presente = status === "Presente";
        const horas = horasTrabalhadas?.[t.id] ?? (presente ? 9 : 0);
        const he = horas > 9 ? (horas - 9) : 0;
        // Calcula entrada e saída com base nas horas trabalhadas (padrão 7-11 + 12-17)
        const entrada = presente ? "07:00" : "—";
        // saída: se 9h normal = 17:00, mais HE depois
        let saida = "—";
        if (presente) {
          const totalH = horas + 1; // +1h almoço
          // calcula saída com base em 7h início e horas trabalhadas + 1h almoço (12-13)
          const saidaH = 7 + totalH; // ex: 9h trabalhadas + 1h almoço = 17h
          saida = String(Math.floor(saidaH)).padStart(2, "0") + ":" + String(Math.round((saidaH - Math.floor(saidaH)) * 60)).padStart(2, "0");
        }
        const cls = status === "Presente" ? "badge-p" : status === "Falta" ? "badge-f" : status === "Atestado" ? "badge-a" : "";
        return `<tr><td class="num">${i + 1}</td><td>${t.nome}</td><td>${t.cargo}</td><td class="num">${entrada}</td><td class="num">${saida}</td><td class="num"><b>${horas}h</b></td><td class="num" style="color:${he > 0 ? '#dc2626' : '#999'};font-weight:${he > 0 ? '700' : '400'}">${he > 0 ? "+" + he + "h" : "—"}</td><td class="num ${cls}">${status}</td></tr>`;
      }).join("")}
    </table>

    <h2>2. Ativos e Logística — Maquinário e Frota</h2>
    <table>
      <tr><th style="width:5%" class="num">Nº</th><th>Identificação</th><th style="width:14%">Placa</th><th style="width:14%">Tipo</th><th style="width:10%" class="num">Início (h)</th><th style="width:10%" class="num">Fim (h)</th><th style="width:9%" class="num">Trabalhadas</th><th style="width:13%" class="num">Combustível</th></tr>
      ${ativosObra.length === 0 ? '<tr><td colspan="8" class="vazio">Sem ativos nesta obra</td></tr>' : ativosObra.map((a, i) => {
        const abastA = abastDia.filter(x => x.ativoId === a.id);
        const totalAbast = abastA.reduce((s, x) => s + x.valor, 0);
        const horim = horimetros?.[a.id] || null;
        const inicioH = horim ? horim.inicio.toFixed(1) : "—";
        const fimH = horim ? horim.fim.toFixed(1) : "—";
        const trabH = horim ? `<b>${horim.horas}h</b>` : "—";
        return `<tr><td class="num">${i + 1}</td><td><b>${a.nome}</b></td><td>${a.placa || "—"}</td><td>${a.tipo}</td><td class="num">${inicioH}</td><td class="num">${fimH}</td><td class="num">${trabH}</td><td class="num">R$ ${totalAbast.toFixed(2)}</td></tr>`;
      }).join("")}
    </table>

    ${abastDia.length > 0 ? `
    <h2>2.1. Abastecimentos do Dia</h2>
    <table>
      <tr><th style="width:5%" class="num">Nº</th><th>Veículo</th><th style="width:13%">Posto</th><th style="width:10%" class="num">Litros</th><th style="width:11%" class="num">R$/Litro</th><th style="width:13%" class="num">Valor</th><th style="width:11%" class="num">Km/Horímetro</th></tr>
      ${abastDia.map((a, i) => {
        const ativo = ativosObra.find(x => x.id === a.ativoId);
        const valorLitro = a.litros > 0 ? (a.valor / a.litros).toFixed(2) : "—";
        return `<tr>
          <td class="num">${i + 1}</td>
          <td><b>${ativo?.nome || "—"}</b>${ativo?.placa ? `<br/><span style="font-size:8pt;color:#666">${ativo.placa}</span>` : ""}</td>
          <td>${a.posto || "—"}</td>
          <td class="num">${(parseFloat(a.litros) || 0).toFixed(1)}</td>
          <td class="num">R$ ${valorLitro}</td>
          <td class="num"><b>R$ ${(parseFloat(a.valor) || 0).toFixed(2)}</b></td>
          <td class="num">${a.km || a.horimetro || "—"}</td>
        </tr>`;
      }).join("")}
      <tr style="background:#fef9e7;font-weight:800">
        <td colspan="3" style="text-align:right">TOTAL DO DIA</td>
        <td class="num">${abastDia.reduce((s, a) => s + (parseFloat(a.litros) || 0), 0).toFixed(1)}L</td>
        <td></td>
        <td class="num" style="color:#dc7e00">R$ ${abastDia.reduce((s, a) => s + (parseFloat(a.valor) || 0), 0).toFixed(2)}</td>
        <td></td>
      </tr>
    </table>
    ` : ""}

    <h2>3. Materiais e Insumos</h2>
    <table>
      <tr><th style="width:11%" class="num">Pedido Nº</th><th>Material</th><th style="width:18%">Quantidade</th><th style="width:20%">Solicitante</th><th style="width:14%" class="num">Status</th></tr>
      ${pedidosDia.length === 0 ? '<tr><td colspan="5" class="vazio">Sem materiais/insumos registrados neste dia</td></tr>' : pedidosDia.map((p, i) => {
        const cls = p.status === "Aprovado" ? "badge-p" : p.status === "Negado" ? "badge-f" : "badge-a";
        const numPed = String(p.id).slice(-6);
        return `<tr><td class="num"><b>${numPed}</b></td><td>${p.material}</td><td>${fmtQtd(p.qtd)}</td><td>${p.enc}</td><td class="num ${cls}">${p.status}</td></tr>`;
      }).join("")}
    </table>

    <h2>4. Observações Gerais</h2>
    <div class="obs-bloco">${observacoes ? observacoes.replace(/\n/g, "<br>") : '<span class="vazio">— Sem observações —</span>'}</div>

    ${alimentacao && Object.keys(alimentacao).length > 0 ? `
    <h2>5. Alimentação do Dia</h2>
    <table>
      <tr>
        <th style="width:30%">Trabalhador</th>
        <th style="width:14%" class="num">☕ Manhã</th>
        <th style="width:14%" class="num">☕ Tarde</th>
        <th style="width:14%" class="num">🍱 Marmita</th>
        <th style="width:14%" class="num">🥪 Lanche</th>
        <th style="width:14%" class="num">Total</th>
      </tr>
      ${trabalhadores.filter(t => presencas[t.id] === "Presente").map(t => {
        const a = alimentacao[t.id] || {};
        const totalDia = (a.cafeManha ? (empresa.valorCafeManha || 4) : 0)
          + (a.cafeTarde ? (empresa.valorCafeTarde || 4) : 0)
          + (a.marmita ? (empresa.valorMarmita || 18) : 0)
          + (a.lanche ? (empresa.valorLanche || 10) : 0);
        return `<tr>
          <td>${t.nome}</td>
          <td class="num" style="color:${a.cafeManha ? '#2aa84f' : '#ccc'}">${a.cafeManha ? "✓ R$ " + (empresa.valorCafeManha || 4).toFixed(2) : "—"}</td>
          <td class="num" style="color:${a.cafeTarde ? '#2aa84f' : '#ccc'}">${a.cafeTarde ? "✓ R$ " + (empresa.valorCafeTarde || 4).toFixed(2) : "—"}</td>
          <td class="num" style="color:${a.marmita ? '#dc2626' : '#ccc'}">${a.marmita ? "✓ R$ " + (empresa.valorMarmita || 18).toFixed(2) : "—"}</td>
          <td class="num" style="color:${a.lanche ? '#0891b2' : '#ccc'}">${a.lanche ? "✓ R$ " + (empresa.valorLanche || 10).toFixed(2) : "—"}</td>
          <td class="num"><b>R$ ${totalDia.toFixed(2)}</b></td>
        </tr>`;
      }).join("")}
      <tr style="background:#fef9e7;font-weight:800">
        <td colspan="5" style="text-align:right">TOTAL DO DIA</td>
        <td class="num" style="color:#dc7e00">R$ ${(totalAlimentacao || 0).toFixed(2)}</td>
      </tr>
    </table>
    ` : ""}

    <h2>${alimentacao && Object.keys(alimentacao).length > 0 ? "6" : "5"}. Ocorrências Técnicas do Dia</h2>
    ${ocorrencias && ocorrencias.length > 0 ? ocorrencias.map(o => `
      <div class="ocorrencia">
        <div class="ts">📌 ${o.autor || "—"} • ${new Date(o.ts).toLocaleString("pt-BR")}</div>
        ${o.texto.replace(/\n/g, "<br>")}
      </div>`).join("") : '<div class="vazio">Nenhuma ocorrência registrada.</div>'}

    ${(() => {
      // Coletar TODAS as fotos: do encarregado + cupons combustível + recebimentos + ocorrências
      const todasFotos = [];

      // 1) Fotos enviadas pelo encarregado na etapa "Fotos"
      (fotos || []).forEach((f, i) => {
        todasFotos.push({ src: f, tipo: "Obra", legenda: `Foto da obra ${i + 1}`, cor: "#0f2151" });
      });

      // 2) Cupons fiscais de combustível do dia
      (abastDia || []).forEach(a => {
        if (a.fotoCupom) {
          const ativo = ativos.find(x => x.id === a.ativoId);
          todasFotos.push({
            src: a.fotoCupom,
            tipo: "Combustível",
            legenda: `⛽ ${ativo?.nome || "Veículo"} — R$ ${(parseFloat(a.valor) || 0).toFixed(2)} (${a.posto || "posto"})`,
            cor: "#dc7e00"
          });
        }
      });

      // 3) Fotos de recebimentos do dia (se a função recebeu o array)
      if (typeof recebimentos !== "undefined" && Array.isArray(recebimentos)) {
        recebimentos.filter(r => r.obraId === obra.id && r.data === data).forEach(r => {
          if (r.foto) {
            todasFotos.push({
              src: r.foto,
              tipo: "Recebimento",
              legenda: `📦 ${r.material} — ${r.qtd} (${r.conformidade || "Conforme"})`,
              cor: "#0891b2"
            });
          }
        });
      }

      // 4) Fotos das ocorrências do diário do dia
      (ocorrencias || []).forEach(o => {
        if (o.foto) {
          todasFotos.push({
            src: o.foto,
            tipo: "Ocorrência",
            legenda: `📝 ${(o.texto || "").substring(0, 50)}${o.texto && o.texto.length > 50 ? "..." : ""}`,
            cor: "#7c3aed"
          });
        }
      });

      if (todasFotos.length === 0) return "";

      const numSecao = alimentacao && Object.keys(alimentacao).length > 0 ? "7" : "6";

      return `
        <h2>${numSecao}. Registro Fotográfico (${todasFotos.length} foto${todasFotos.length > 1 ? "s" : ""})</h2>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 6px;">
          ${todasFotos.map((f, i) => `
            <div style="break-inside: avoid; border: 1px solid #ccc; border-radius: 4px; overflow: hidden; page-break-inside: avoid;">
              <div style="background:${f.cor};color:#fff;padding:2px 5px;font-size:7pt;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:0.5px;">${f.tipo}</div>
              <img src="${f.src}" alt="Foto ${i + 1}" style="width: 100%; height: 110px; object-fit: cover; display: block;" />
              <div style="padding: 3px 5px; font-size: 7pt; color: #444; background: #f5f8fc; line-height: 1.2;">${f.legenda}</div>
            </div>
          `).join("")}
        </div>
      `;
    })()}

    <div class="footer">
      <b>${empresa.razaoSocial}</b> — Documento gerado eletronicamente pelo Sistema KMZERO em ${new Date().toLocaleString("pt-BR")}<br>
      RDO Nº ${String(numero).padStart(3, "0")} • Encarregado responsável: ${encarregado || "—"} • Padrão ABNT
    </div>

    <script>window.onload=()=>{setTimeout(()=>window.print(),300);}</script>
    </body></html>`;
  abrirOuBaixarHTML(html, `RDO-${String(numero).padStart(3, "0")}-${obra.nome.replace(/[^a-z0-9]/gi, "_").substring(0, 30)}.html`);
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
  const ocorrenciasDia = diario.filter(d => d.obraId === obraId);

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

      let rdosSem = (rdosEmitidos || []).filter(r => {
        const isoR = r.dataIso || (() => { try { const [d, m, a] = r.data.split("/"); return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; } catch { return ""; } })();
        const dt = new Date(isoR);
        return r.obraId === oId && dt >= seg && dt <= sex;
      });

      let modoFallback = false;
      if (rdosSem.length === 0) {
        const todosObra = (rdosEmitidos || []).filter(r => r.obraId === oId);
        if (todosObra.length === 0) {
          alert("⚠️ Sem RDOs para esta obra ainda.\n\nObra: " + obraSel.nome + "\n\nFinalize pelo menos 1 dia de obra (RDO) para gerar o relatório semanal.");
          return;
        }
      // Pega últimos 7 RDOs por data (descendente)
      rdosSem = todosObra
        .sort((a, b) => {
          const dA = a.dataIso || a.data || "";
          const dB = b.dataIso || b.data || "";
          return dB.localeCompare(dA);
        })
        .slice(0, 7)
        .reverse(); // ordena ascendente pra exibição
      modoFallback = true;
    }

    // Calcula totais
    let totalPres = 0, totalFalt = 0, totalAtest = 0, totalHE = 0, totalAlimentacao = 0;
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
          const valDia = (ali.cafeManha ? (empresa.valorCafeManha || 4) : 0)
            + (ali.cafeTarde ? (empresa.valorCafeTarde || 4) : 0)
            + (ali.marmita ? (empresa.valorMarmita || 18) : 0)
            + (ali.lanche ? (empresa.valorLanche || 10) : 0);
          trabPres[tid].alimentacao += valDia;
        }
        else if (st === "Falta") { trabPres[tid].f++; totalFalt++; }
        else if (st === "Atestado") { trabPres[tid].a++; totalAtest++; }
      });
      totalHE += (r.totalHE || 0);
      totalAlimentacao += (r.totalAlimentacao || 0);
    });

    // Em modo fallback, ajusta seg/sex pras datas dos RDOs encontrados
    let segReal = seg, sexReal = sex;
    if (modoFallback && rdosSem.length > 0) {
      const datasRdos = [];
      for (let i = 0; i < rdosSem.length; i++) {
        const r = rdosSem[i];
        let iso = r.dataIso;
        if (!iso && r.data) {
          try {
            const partes = r.data.split("/");
            iso = partes[2] + "-" + partes[1].padStart(2, "0") + "-" + partes[0].padStart(2, "0");
          } catch (e) { iso = ""; }
        }
        const dt = new Date(iso);
        if (!isNaN(dt.getTime())) datasRdos.push(dt.getTime());
      }
      if (datasRdos.length > 0) {
        let minTs = datasRdos[0], maxTs = datasRdos[0];
        for (let i = 1; i < datasRdos.length; i++) {
          if (datasRdos[i] < minTs) minTs = datasRdos[i];
          if (datasRdos[i] > maxTs) maxTs = datasRdos[i];
        }
        segReal = new Date(minTs); segReal.setHours(0, 0, 0, 0);
        sexReal = new Date(maxTs); sexReal.setHours(23, 59, 59, 999);
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

    const datas = rdosSem.map(r => r.data).sort();
    const periodo = `${datas[0]} a ${datas[datas.length - 1]}`;

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

    // 💰 CUSTO consolidado da semana
    const custoMaoObra = Object.entries(trabPres).reduce((s, [tid, st]) => {
      const t = trabalhadores.find(x => String(x.id) === String(tid));
      const diaria = (t && parseFloat(t.diaria)) || 0;
      return s + (st.p + st.a) * diaria; // presença + atestado pagam
    }, 0);

    const custoTotalSem = custoMaoObra + totalAlimentacao + totalCombustivel + totalDespesas;

    // TESTE 1: contadores acumulados simples
    var totalRdosObra = 0;
    var totalPedidosObra = 0;
    for (var i = 0; i < (rdosEmitidos || []).length; i++) {
      if (rdosEmitidos[i].obraId === oId) totalRdosObra++;
    }
    for (var i = 0; i < (pedidos || []).length; i++) {
      if (pedidos[i].obraId === oId) totalPedidosObra++;
    }

    const html = `<html><head><title>RDO Semanal - ${obraSel.nome}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        h1 { color: #0f2151; border-bottom: 4px solid #C0A040; padding-bottom: 10px; margin: 0 0 6px 0; font-size: 22pt; }
        h2 { color: #0f2151; border-bottom: 2px solid #e5e5e5; padding-bottom: 6px; margin-top: 24px; font-size: 14pt; }
        h3 { color: #0f2151; margin-top: 16px; font-size: 11pt; }
        .header-info { background: linear-gradient(135deg,#0f2151,#1e3a8a); color: #fff; padding: 14px 18px; border-radius: 8px; margin-bottom: 16px; }
        .header-info p { margin: 4px 0; }
        .header-info b { color: #f5a623; }
        /* WRAPPER de tabela com scroll lateral no mobile */
        .table-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 6px; }
        .table-wrap::-webkit-scrollbar { height: 8px; }
        .table-wrap::-webkit-scrollbar-thumb { background: #C0A040; border-radius: 4px; }
        .table-wrap::-webkit-scrollbar-track { background: #f3f4f6; }
        .table-wrap table { margin-bottom: 0; }

        /* TABELA: cresce no tamanho do conteúdo (NÃO força width:100%) */
        table { border-collapse: collapse; font-size: 9pt; width: auto; }
        /* Quando explicitamente width:100%, permite quebra natural nas células */
        table[style*="width:100%"] { width: 100% !important; table-layout: fixed; }
        table[style*="width:100%"] td, table[style*="width:100%"] th { white-space: normal; overflow-wrap: break-word; word-break: keep-all; }
        table[style*="width:100%"] td[style*="text-align:right"], table[style*="width:100%"] td[style*="text-align:center"],
        table[style*="width:100%"] th[style*="text-align:right"], table[style*="width:100%"] th[style*="text-align:center"] { white-space: nowrap; }

        th { background: #0f2151; color: #fff; padding: 8px 12px; text-align: left; font-size: 9pt; white-space: nowrap; }
        td { padding: 6px 12px; border-bottom: 1px solid #eee; vertical-align: top; white-space: nowrap; }

        /* Classes específicas pras colunas */
        td.col-nome, th.col-nome { white-space: nowrap; }
        td.col-cargo, th.col-cargo { white-space: nowrap; }
        td.col-data, th.col-data { white-space: nowrap; }
        td.col-num, th.col-num { white-space: nowrap; text-align: right; }
        td.col-status, th.col-status { white-space: nowrap; text-align: center; }
        td.td-wrap, th.td-wrap { white-space: normal; overflow-wrap: break-word; word-break: normal; min-width: 180px; max-width: 280px; }

        th[style*="text-align:right"], td[style*="text-align:right"] { white-space: nowrap; }
        th[style*="text-align:center"], td[style*="text-align:center"] { white-space: nowrap; }
        tr:nth-child(even) td { background: #fafbfc; }
        .footer { margin-top: 30px; padding-top: 14px; border-top: 2px solid #C0A040; text-align: center; font-size: 9pt; color: #888; }
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0; }
        .kpi { background: #f5f7fa; padding: 12px; border-radius: 8px; border-left: 4px solid #C0A040; }
        .kpi-label { font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
        .kpi-value { font-size: 18pt; color: #0f2151; font-weight: 900; margin-top: 4px; }
        .kpi-sub { font-size: 8pt; color: #666; margin-top: 2px; }
        .fotos-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
        .foto-item img { width: 100%; height: 110px; object-fit: cover; border-radius: 6px; border: 1px solid #ddd; }
        .foto-item-info { font-size: 7.5pt; color: #666; margin-top: 3px; }
        .resumo-final { background: linear-gradient(135deg,#fef3c7,#fde68a); padding: 16px; border-radius: 10px; margin-top: 24px; border: 2px solid #C0A040; }
        .resumo-final h3 { color: #0f2151; margin-top: 0; }
        .badge-ok { background: #2aa84f; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 8pt; font-weight: 700; }
        .badge-pend { background: #e87722; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 8pt; font-weight: 700; }
        .badge-neg { background: #d63b3b; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 8pt; font-weight: 700; }

        /* ═══ PADRÃO A4 ═══ */
        @page { size: A4 portrait; margin: 12mm 10mm; }
        @media print { body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        body { max-width: 190mm; margin: 0 auto; padding: 8mm 0; box-sizing: border-box; }

        /* Quebra de página inteligente */
        h2 { page-break-after: avoid; break-after: avoid; }
        h3 { page-break-after: avoid; break-after: avoid; }
        table { page-break-inside: auto; break-inside: auto; }
        tr { page-break-inside: avoid; break-inside: avoid; }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        .km-header, .km-footer, .km-assinaturas { page-break-inside: avoid; break-inside: avoid; }
        .resumo-final, .kpis { page-break-inside: avoid; break-inside: avoid; }
        .fotos-grid { page-break-inside: auto; break-inside: auto; }
        .foto-item { page-break-inside: avoid; break-inside: avoid; }

        ${KM_PDF_CSS}
      </style>
      </head><body>

      ${gerarHeaderHTML({ tipo: "RDO Semanal Consolidado", periodo, info_extra: "Obra: " + obraSel.nome + " · " + rdosSem.length + " dia(s)", empresa })}

      <h2>📊 Indicadores da Semana</h2>
      <div class="kpis">
        <div class="kpi">
          <div class="kpi-label">👷 Presenças</div>
          <div class="kpi-value" style="color:#2aa84f">${totalPres}</div>
          <div class="kpi-sub">homens-dia</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">⚠️ Faltas</div>
          <div class="kpi-value" style="color:#d63b3b">${totalFalt}</div>
          <div class="kpi-sub">${totalAtest} atestado${totalAtest > 1 ? "s" : ""}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">⏱️ Horas Extras</div>
          <div class="kpi-value" style="color:#dc2626">${totalHE.toFixed(1)}h</div>
          <div class="kpi-sub">acréscimo 50%</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">📷 Fotos</div>
          <div class="kpi-value" style="color:#0891b2">${fotosSem.length}</div>
          <div class="kpi-sub">registros</div>
        </div>
      </div>

      <h2>👷 Frequência e Custos por Trabalhador</h2>
      <table style="width:100%">
        <tr>
          <th style="width:28%">Nome</th>
          <th style="width:18%">Cargo</th>
          <th style="width:7%;text-align:center">Pres.</th>
          <th style="width:7%;text-align:center">Falt.</th>
          <th style="width:7%;text-align:center">Atest.</th>
          <th style="width:7%;text-align:right">Horas</th>
          <th style="width:13%;text-align:right">☕ Alim.</th>
          <th style="width:13%;text-align:right">💰 A pagar</th>
        </tr>
        ${Object.entries(trabPres).map(([tid, st]) => {
          const t = trabalhadores.find(x => String(x.id) === String(tid));
          if (!t) return "";
          const diaria = parseFloat(t.diaria) || 0;
          const aPagar = (st.p + st.a) * diaria;
          return `<tr>
            <td><b>${t.nome}</b></td>
            <td>${t.cargo}</td>
            <td style="text-align:center;color:#2aa84f"><b>${st.p}</b></td>
            <td style="text-align:center;color:#d63b3b">${st.f}</td>
            <td style="text-align:center;color:#e87722">${st.a}</td>
            <td style="text-align:right">${st.horas}h</td>
            <td style="text-align:right;color:#dc7e00">R$ ${st.alimentacao.toFixed(2)}</td>
            <td style="text-align:right;color:#0f2151"><b>R$ ${aPagar.toFixed(2)}</b></td>
          </tr>`;
        }).join("")}
      </table>

      ${prodSem.length > 0 ? `
      <h2>📈 Produtividade Executada</h2>
      <div class="table-wrap"><table>
        <tr><th>Serviço</th><th style="text-align:right">Quantidade</th><th>Unidade</th></tr>
        ${Object.entries(prodTotal).map(([k, total]) => {
          const [tipo, un] = k.split("|");
          return `<tr><td><b>${tipo}</b></td><td style="text-align:right;color:#2aa84f"><b>${total.toFixed(1)}</b></td><td>${un}</td></tr>`;
        }).join("")}
      </table></div>
      ` : ""}

      <h2>📋 Atividades por Dia</h2>
      <div class="table-wrap"><table>
        <tr><th class="col-data">Data</th><th class="col-data">RDO Nº</th><th class="col-nome">Encarregado</th><th>Clima</th><th>Observações</th></tr>
        ${rdosSem.sort((a, b) => (a.data > b.data ? 1 : -1)).map(r => `
          <tr>
            <td class="col-data"><b>${r.data}</b></td>
            <td class="col-data">${String(r.numero).padStart(3, "0")}</td>
            <td class="col-nome">${r.encarregado || "—"}</td>
            <td>${r.clima || "—"}</td>
            <td class="td-wrap" style="font-size:8pt">${r.observacoes || "—"}</td>
          </tr>
        `).join("")}
      </table></div>

      ${diarioSem.length > 0 ? `
      <h2>📝 Anotações do Diário</h2>
      <div class="table-wrap"><table>
        <tr><th class="col-data">Data</th><th class="col-nome">Autor</th><th>Anotação</th></tr>
        ${diarioSem.sort((a, b) => a.ts - b.ts).map(d => `
          <tr>
            <td class="col-data">${new Date(d.ts).toLocaleDateString("pt-BR")}</td>
            <td class="col-nome">${d.autor || "—"}</td>
            <td class="td-wrap" style="font-size:8.5pt">${d.texto || "—"}</td>
          </tr>
        `).join("")}
      </table></div>
      ` : ""}

      ${pedidosSem.length > 0 ? `
      <h2>📦 Pedidos de Material (${pedidosSem.length})</h2>
      <p style="font-size:9pt">
        <span class="badge-ok">${pedAprov.length} APROVADO${pedAprov.length !== 1 ? "S" : ""}</span> &nbsp;
        <span class="badge-pend">${pedAguard.length} AGUARDANDO</span> &nbsp;
        <span class="badge-neg">${pedNeg.length} NEGADO${pedNeg.length !== 1 ? "S" : ""}</span>
      </p>
      <div class="table-wrap"><table>
        <tr><th class="col-data">Nº</th><th class="col-data">Data</th><th class="col-nome">Material</th><th>Qtd</th><th>Marca</th><th class="col-status">Status</th></tr>
        ${pedidosSem.sort((a, b) => a.ts - b.ts).map(p => {
          const cor = p.status === "Aprovado" ? "#2aa84f" : p.status === "Negado" ? "#d63b3b" : "#e87722";
          const numPed = String(p.id).slice(-6);
          return `<tr>
            <td class="col-data"><b>${numPed}</b></td>
            <td class="col-data">${p.dataSolicitacao || "—"}</td>
            <td class="col-nome"><b>${p.material || "—"}</b></td>
            <td>${p.qtd || "—"}</td>
            <td>${p.marca || "—"}</td>
            <td class="col-status" style="color:${cor}"><b>${p.status}</b></td>
          </tr>`;
        }).join("")}
      </table></div>
      ` : ""}

      ${(movPessSem.length > 0 || movEquipSem.length > 0) ? `
      <h2>🔄 Movimentações</h2>
      ${movPessSem.length > 0 ? `
        <h3>👷 Pessoal (${movPessSem.length})</h3>
        <div class="table-wrap"><table>
          <tr><th class="col-data">Data</th><th class="col-nome">Trabalhador</th><th>Origem → Destino</th><th>Motivo</th><th class="col-status">Status</th></tr>
          ${movPessSem.map(m => {
            const oOrig = obras.find(o => o.id === m.obraOrigem)?.nome || "—";
            const oDest = obras.find(o => o.id === m.obraDestino)?.nome || "—";
            return `<tr>
              <td class="col-data">${m.data || "—"}</td>
              <td class="col-nome"><b>${m.trabNome || "—"}</b></td>
              <td class="td-wrap" style="font-size:8pt">${oOrig} → ${oDest}</td>
              <td class="td-wrap" style="font-size:8pt">${m.motivo || "—"}</td>
              <td class="col-status">${m.status || "—"}</td>
            </tr>`;
          }).join("")}
        </table></div>
      ` : ""}
      ${movEquipSem.length > 0 ? `
        <h3>🔧 Equipamentos (${movEquipSem.length})</h3>
        <div class="table-wrap"><table>
          <tr><th class="col-data">Data</th><th class="col-nome">Item</th><th>Origem → Destino</th><th>Motivo</th><th class="col-status">Status</th></tr>
          ${movEquipSem.map(m => `<tr>
            <td class="col-data">${m.dataSolicitacao || "—"}</td>
            <td class="col-nome"><b>${m.itemNome || "—"}</b></td>
            <td class="td-wrap" style="font-size:8pt">${m.obraOrigemNome || "—"} → ${m.obraDestinoNome || "—"}</td>
            <td class="td-wrap" style="font-size:8pt">${m.motivo || "—"}</td>
            <td class="col-status">${m.status || "—"}</td>
          </tr>`).join("")}
        </table></div>
      ` : ""}
      ` : ""}

      ${despesasSem.length > 0 ? `
      <h2>💸 Despesas Avulsas</h2>
      <div class="table-wrap"><table>
        <tr><th class="col-data">Data</th><th class="col-nome">Categoria</th><th>Descrição</th><th style="text-align:right">Valor</th></tr>
        ${despesasSem.map(d => `<tr>
          <td class="col-data">${d.data || "—"}</td>
          <td class="col-nome">${d.categoria || "—"}</td>
          <td class="td-wrap" style="font-size:8.5pt">${d.descricao || "—"}</td>
          <td style="text-align:right;color:#dc7e00"><b>R$ ${(parseFloat(d.valor) || 0).toFixed(2)}</b></td>
        </tr>`).join("")}
        <tr style="background:#fef3c7;font-weight:700">
          <td colspan="3" style="text-align:right">TOTAL DESPESAS AVULSAS</td>
          <td style="text-align:right;color:#0f2151">R$ ${totalDespesas.toFixed(2)}</td>
        </tr>
      </table></div>
      ` : ""}

      ${combPorVeic.length > 0 ? `
      <h2>⛽ Combustível por Veículo</h2>
      <div class="table-wrap"><table>
        <tr><th class="col-nome">Veículo</th><th class="col-data">Placa</th><th style="text-align:center">Abastec.</th><th style="text-align:right">Litros</th><th style="text-align:right">Valor</th></tr>
        ${combPorVeic.map(v => `<tr>
          <td class="col-nome"><b>${v.ativo.nome}</b></td>
          <td class="col-data">${v.ativo.placa || "—"}</td>
          <td style="text-align:center">${v.qtd}</td>
          <td style="text-align:right">${v.litros.toFixed(1)}L</td>
          <td style="text-align:right;color:#dc7e00"><b>R$ ${v.gasto.toFixed(2)}</b></td>
        </tr>`).join("")}
      </table></div>
      ` : ""}

      ${fotosSem.length > 0 ? `
      <h2>📷 Registro Fotográfico (${fotosSem.length} fotos)</h2>
      <div class="fotos-grid">
        ${fotosSem.slice(0, 24).map(f => `
          <div class="foto-item">
            <img src="${f.foto}" alt="${f.legenda || ''}" />
            <div class="foto-item-info">
              <b>#${String(f.numero || 0).padStart(3, "0")}</b> · ${f.data || "—"} ${f.hora || ""}<br/>
              ${(f.legenda || "").substring(0, 35)}${(f.legenda || "").length > 35 ? "…" : ""}
            </div>
          </div>
        `).join("")}
      </div>
      ${fotosSem.length > 24 ? `<p style="font-size:9pt;color:#888;text-align:center">+ ${fotosSem.length - 24} foto(s) adicional(is) na galeria do app</p>` : ""}
      ` : ""}

      <h2>📊 Acumulado da Obra</h2>
      <table>
        <tr><th>Indicador</th><th style="text-align:right">Total</th></tr>
        <tr><td>📅 Total de RDOs emitidos</td><td style="text-align:right"><b>${totalRdosObra}</b></td></tr>
        <tr><td>📦 Total de pedidos da obra</td><td style="text-align:right"><b>${totalPedidosObra}</b></td></tr>
      </table>

      <div class="resumo-final">
        <h3>💰 RESUMO FINANCEIRO DA SEMANA</h3>
        <table style="margin:0;font-size:10pt">
          <tr><td><b>👷 Mão de Obra (diárias)</b></td><td style="text-align:right">R$ ${custoMaoObra.toFixed(2)}</td></tr>
          <tr><td><b>☕ Alimentação</b></td><td style="text-align:right">R$ ${totalAlimentacao.toFixed(2)}</td></tr>
          <tr><td><b>⛽ Combustível</b></td><td style="text-align:right">R$ ${totalCombustivel.toFixed(2)}</td></tr>
          <tr><td><b>💸 Despesas Avulsas</b></td><td style="text-align:right">R$ ${totalDespesas.toFixed(2)}</td></tr>
          <tr style="border-top:2px solid #0f2151;background:#0f2151;color:#f5a623;font-size:13pt;font-weight:900">
            <td style="padding:10px"><b>TOTAL DA SEMANA</b></td>
            <td style="text-align:right;padding:10px"><b>R$ ${custoTotalSem.toFixed(2)}</b></td>
          </tr>
        </table>
      </div>

      <div style="margin-top:30px">
        ${gerarAssinaturasHTML({ empresa, autor: empresa.responsavel })}
      </div>

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
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
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

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📋 Conteúdo do RDO</div>
          <div style={{ fontSize: 12, color: "#666" }}>
            <div style={{ padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>👷 Mão de obra: <b>{trabObra.length}</b> ({presentes} presentes)</div>
            <div style={{ padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>🚜 Ativos: <b>{ativos.filter(a => a.obraId === obraId).length}</b></div>
            <div style={{ padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>📦 Pedidos do dia: <b>{pedidos.filter(p => p.obraId === obraId && p.data === data).length}</b></div>
            <div style={{ padding: "4px 0" }}>📌 Ocorrências: <b>{ocorrenciasDia.length}</b></div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 8, fontSize: 14 }}>🏢 Empresa Emissora</div>
          <div style={{ fontSize: 11, color: "#666" }}>
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
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, fontSize: 13 }}>📜 RDOs Recentes ({rdosEmitidos.length})</div>
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
                  ocorrencias: diario.filter(d => d.obraId === r.obraId),
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
                <div key={r.id} style={{ background: "#fff", borderRadius: 10, padding: "10px 14px", marginBottom: 6, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: r.autoGerado ? `4px solid ${GREEN}` : `4px solid ${BLUE}` }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 22, marginRight: 10 }}>📄</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>RDO Nº {String(r.numero).padStart(3, "0")}{r.autoGerado && <span style={{ fontSize: 9, color: GREEN, fontWeight: 700, marginLeft: 6 }}>⚡ AUTO</span>}</div>
                      <div style={{ fontSize: 10, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o?.nome} • {r.data} • {r.encarregado}</div>
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
                          style={{ width: 60, height: 60, borderRadius: 6, objectFit: "cover", flexShrink: 0, cursor: "pointer", border: "1px solid #ddd" }}
                        />
                      ))}
                      <div style={{ fontSize: 9, color: "#888", alignSelf: "center", marginLeft: 4, flexShrink: 0 }}>
                        {r.fotos.length} foto{r.fotos.length > 1 ? "s" : ""}
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={baixar} style={{ flex: 1, background: GOLD, color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", fontWeight: 700, fontSize: 10, cursor: "pointer" }}>📄 PDF</button>
                    <button onClick={() => setEditandoRdo(r)} style={{ flex: 1, background: BLUE, color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", fontWeight: 700, fontSize: 10, cursor: "pointer" }}>✏️ Editar</button>
                    <button onClick={() => { confirmar(`Excluir RDO Nº ${r.numero}?`, () => { onRemoveRDO(r.id); }); }} style={{ background: "#fef2f2", color: RED, border: `1px solid ${RED}33`, borderRadius: 6, padding: "6px 10px", fontWeight: 700, fontSize: 10, cursor: "pointer" }}>🗑️</button>
                  </div>
                </div>
              );
            })}
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
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <select value={obraId} onChange={e => setObraId(parseInt(e.target.value))} style={{ ...selS, marginBottom: 12 }}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📝 Registrar Produção</div>
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
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📊 Totais Acumulados</div>
            {Object.entries(totais).map(([k, v]) => {
              const [t, u] = k.split("|");
              const cfg = TIPOS.find(x => x.nome === t);
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <span style={{ fontSize: 22, marginRight: 10 }}>{cfg?.icon || "📦"}</span>
                  <span style={{ flex: 1, fontSize: 13, color: NAVY }}>{t}</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: GREEN }}>{v.toFixed(2)} {u}</span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, fontSize: 13 }}>📜 Histórico</div>
        {minhasObra.length === 0 && <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: 16 }}>Nenhum registro.</div>}
        {minhasObra.map(p => {
          const cfg = TIPOS.find(x => x.nome === p.tipo);
          return (
            <div key={p.id} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
              <span style={{ fontSize: 24, marginRight: 10 }}>{cfg?.icon || "📦"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{p.tipo} — {fmtQtd(p.qtd)} {p.unidade}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{p.autor} • {p.data}</div>
                {p.obs && <div style={{ fontSize: 10, color: "#666", fontStyle: "italic" }}>{p.obs}</div>}
              </div>
              <button onClick={() => onRemove(p.id)} style={{ background: "#fee2e2", border: "2px solid #d63b3b", color: "#d63b3b", cursor: "pointer", padding: "6px 10px", borderRadius: 8, fontSize: 16, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>
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
