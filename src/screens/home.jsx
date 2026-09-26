import { TabelaResumoEquipe } from "./equipe.jsx";
import { gerarSolicitacaoPedidoPDF } from "./suprimentos.jsx";
import { useState, useEffect, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { NAVY, NAVY2, GOLD, GREEN, RED, ORANGE, BLUE, LIGHT, labelS, inputS, dateS, selS, bigBtn, css, T } from "../theme.js";
import { hojeStr, fmtData, ultimosDias, dataPascoa, feriadosDoAno, feriadoEm, dataLocalIso } from "../utils.js";
import { cloudRefs, enviarFotoNuvem, observarFotosNuvem, semUndefined, enviarDocNuvem, removerDocNuvem, observarColecaoNuvem, store } from "../lib/store.js";
import { FILE_DB_VERSION, FILE_STORE_NAME, openFileDB, fileStore, lerArquivoComoBase64, formatarTamanhoBytes, iconePorTipoArquivo } from "../lib/fileStore.js";
import { carregarScript, carregarPDFLibs, KM_PDF_PAGE_CSS, KM_PDF_CSS, gerarHeaderHTML, gerarFooterHTML, gerarAssinaturasHTML, fmtQtd, abrirOuBaixarHTML } from "../lib/pdf.js";
import { DEFAULT_FORNECEDORES, DEFAULT_OBRAS, DEFAULT_TRABALHADORES, gerarDadosMes30Dias, DEFAULT_EQUIPS, CARGOS, detectarUnidade, CATALOGO_KM_FULL, CAT_KM_BUSCA, CAT_KM_CATEGORIAS, CAT_KM_SUBCATEGORIAS, MATERIAIS_BANCO_DETALHADO, MATERIAIS_BANCO, MATERIAIS, CATALOGO_FROTA, CATALOGO_FROTA_NOMES, CATALOGO_EQUIPAMENTOS, CATALOGO_EQUIPAMENTOS_NOMES, MATERIAL_INFO, EQUIP_COLOR, STATUS_COLOR, EMPRESA_TEMPLATE, DEFAULT_FUNC_ESCRITORIO, DEFAULT_ATIVOS, VALOR_HORA_CARGO } from "../data/catalogos.js";
import { Badge, Btn, EmptyState, KMHeader, KMFooter, FotoViewer, Modal, confirmar, Assinatura, Grade, UsuarioLogado } from "../components/ui.jsx";
import { useEscritorio } from "../components/ui.jsx";
import { useTema } from "../lib/useTema.js";
import { SinoAvisos } from "./avisos.jsx";
// Nomes das telas iguais aos do menu lateral ("Indicadores", "Alertas", "Avisos"…) e e-mail do desenvolvedor
import { EMAIL_DEV, labelDaTela, telaPermitida } from "../components/menuGrupos.js";

/* ── Documentos de saída (PDF/impressão) desta tela: padrão do núcleo (src/lib/pdf.js) ──
   Regras: só dados da EMPRESA CLIENTE (Sistema → Empresa), cores só em hex fixo, classes
   compartilhadas (.sec, .quadro, .kpis, .selo…), cabeçalho/rodapé via gerarHeaderHTML/gerarFooterHTML. */
const escHTML = v => String(v ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// "YYYY-MM-DD" → "DD/MM/YYYY" sem passar por Date (evita o deslocamento de fuso em UTC)
const fmtDiaMesAno = iso => { const [a, m, d] = String(iso || "").slice(0, 10).split("-"); return a && m && d ? `${d}/${m}/${a}` : String(iso || ""); };
// Dia (AAAA-MM-DD, hora local) em que a solicitação de material foi aberta: aceita "DD/MM/AAAA" e "DD/MM/AAAA, HH:MM:SS"
// (pedido.data dos pedidos reais), "AAAA-MM-DD" ou "DD/MM/AAAA" em dataSolicitacao (demonstração) ou o carimbo em
// milissegundos (ts / id numérico). Sem data conhecida devolve "" e o pedido fica fora da contagem por período.
const diaDoPedido = p => {
  const bruta = String(p?.data || p?.dataSolicitacao || "").trim();
  const br = bruta.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = bruta.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ms = Number(p?.ts ?? p?.id);
  return Number.isFinite(ms) && ms > 1e12 ? dataLocalIso(new Date(ms)) : "";
};
// Empresa cliente do documento: a prop (quando a tela recebe) ou o cadastro salvo em Sistema → Empresa
async function empresaDoDocumento(empresa) {
  if (empresa && typeof empresa === "object" && Object.keys(empresa).length) return empresa;
  try { return (await store.get("empresa")) || {}; } catch { return {}; }
}
const seloHTML = (texto, tom) => `<span class="selo${tom ? " " + tom : ""}">${escHTML(texto || "—")}</span>`;
const TOM_PRESENCA = { Presente: "ok", Falta: "erro", Atestado: "alerta" };
const TOM_PEDIDO = { Aprovado: "ok", Negado: "erro", Aguardando: "alerta" };
const TOM_EQUIP = { "Disponível": "ok", "Quebrada": "erro" };

export function TelaHome({ obra, usuario, mensagens, trabalhadores, presencasHoje, avisosNaoLidos = 0, onNav, onLogout }) {
  const presentes = Object.values(presencasHoje).filter(v => v === "Presente").length;
  const faltas    = Object.values(presencasHoje).filter(v => v === "Falta").length;
  const atestados = Object.values(presencasHoje).filter(v => v === "Atestado").length;
  const novasMsgs = (mensagens || []).filter(m => m.para === usuario?.id && !m.lida).length;
  // Saudação inteligente por horário
  const h = new Date().getHours();
  const saudacao = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const emojiSaudacao = h < 6 ? "🌙" : h < 12 ? "☀️" : h < 18 ? "🌤️" : "🌆";
  const totalPresencas = presentes + faltas + atestados;
  const equipeTotal = (trabalhadores || []).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ background: `linear-gradient(180deg,${NAVY} 0%,${NAVY2} 100%)`, padding: "10px 14px 12px", paddingTop: "max(10px, env(safe-area-inset-top, 10px))", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <div><span style={{ fontWeight: 900, fontSize: 20, color: "#fff", letterSpacing: -1 }}>KM</span><span style={{ fontWeight: 900, fontSize: 20, color: GOLD, letterSpacing: -1 }}>ZERO</span></div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.5)", letterSpacing: 2.5 }}>GESTÃO DE OBRAS</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <UsuarioLogado compacto />
            <SinoAvisos n={avisosNaoLidos} onClick={() => onNav("avisos")} />
            <button onClick={() => onNav("mensagens")} style={{ position: "relative", background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 18, width: 36, height: 36, cursor: "pointer", fontSize: 16 }}>
              💬
              {novasMsgs > 0 && <span style={{ position: "absolute", top: -2, right: -2, background: RED, color: "#fff", borderRadius: 10, padding: "1px 5px", fontSize: 9, fontWeight: 800 }}>{novasMsgs}</span>}
            </button>
            <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Sair</button>
          </div>
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>Obra: {obra?.nome}</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", background: T.fundo, padding: 14 }}>
        <div style={{ marginBottom: 14 }} className="km-card-anim">
          <div style={{ fontSize: 22, fontWeight: 800, color: T.titulo }}>
            {emojiSaudacao} {saudacao}, {usuario?.nome?.split(" ")[0] || "Marcos"}!
          </div>
          <div style={{ fontSize: 13, color: T.texto2 }}>Encarregado • {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</div>
          {/* Card resumo do dia */}
          {totalPresencas > 0 && (
            <div style={{
              marginTop: 10,
              background: "linear-gradient(135deg, #0f2151 0%, #1a3370 100%)",
              borderRadius: 12,
              padding: "12px 14px",
              color: "#fff",
              boxShadow: "0 4px 14px rgba(15,33,81,0.2)",
            }}>
              <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600, letterSpacing: 2, marginBottom: 6 }}>📊 RESUMO DO DIA</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: GREEN }}>{presentes}</div>
                    <div style={{ fontSize: 10, opacity: 0.75 }}>Presentes</div>
                  </div>
                  {faltas > 0 && (
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: RED }}>{faltas}</div>
                      <div style={{ fontSize: 10, opacity: 0.75 }}>Faltas</div>
                    </div>
                  )}
                  {atestados > 0 && (
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: ORANGE }}>{atestados}</div>
                      <div style={{ fontSize: 10, opacity: 0.75 }}>Atestados</div>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>de {equipeTotal} {equipeTotal === 1 ? "pessoa" : "pessoas"}</div>
                </div>
              </div>
            </div>
          )}
          {totalPresencas === 0 && equipeTotal > 0 && (
            <div onClick={() => onNav("fluxo")} style={{
              marginTop: 10,
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              borderRadius: 12,
              padding: "12px 14px",
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(245,158,11,0.3)",
            }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>⏰ Hora de registrar presença!</div>
              <div style={{ fontSize: 11, opacity: 0.95, marginTop: 2 }}>Toque para começar o registro da equipe</div>
            </div>
          )}
        </div>
        {novasMsgs > 0 && (
          <div onClick={() => onNav("mensagens")} style={{ background: `linear-gradient(135deg,#db2777,#9d174d)`, color: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 14, cursor: "pointer", boxShadow: "0 3px 10px #db277744" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>💬 Você tem {novasMsgs} mensagem(ns) nova(s)</div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>Toque para ler</div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          {[
            { icon: "✅", label: "Registrar\nPresença", color: GREEN,  nav: "fluxo" },
            { icon: "📦", label: "Solicitar\nMaterial",  color: ORANGE, nav: "material" },
            { icon: "📷", label: "Enviar\nFotos",        color: BLUE,   nav: "fotos_solo" },
            // Botão colorido com texto branco: precisa do hex fixo (T.titulo fica claro no escuro e quebra o `${b.color}44` da sombra)
            { icon: "⚙️", label: "Controle de\nEquip.", color: NAVY,   nav: "equip_solo" },
          ].map(b => (
            <button key={b.nav} onClick={() => onNav(b.nav)} style={{ background: b.color, color: "#fff", border: "none", borderRadius: 14, padding: "18px 8px", cursor: "pointer", textAlign: "center", boxShadow: `0 4px 14px ${b.color}44` }}>
              <div style={{ fontSize: 32 }}>{b.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, whiteSpace: "pre-line", lineHeight: 1.35 }}>{b.label}</div>
            </button>
          ))}
        </div>
        <button onClick={() => onNav("diario")} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 14, padding: "14px", cursor: "pointer", textAlign: "center", boxShadow: "0 4px 14px #2563eb44", marginBottom: 10, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>📓</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Diário de Obra (com Voz 🎤)</span>
        </button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <button onClick={() => onNav("produtividade")} style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 14, padding: "14px 8px", cursor: "pointer", textAlign: "center", boxShadow: "0 4px 14px #16a34a44" }}>
            <div style={{ fontSize: 28 }}>📐</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>Produtividade</div>
          </button>
          <button onClick={() => onNav("recebimento")} style={{ background: "#0891b2", color: "#fff", border: "none", borderRadius: 14, padding: "14px 8px", cursor: "pointer", textAlign: "center", boxShadow: "0 4px 14px #0891b244" }}>
            <div style={{ fontSize: 28 }}>📥</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>Recebimento</div>
          </button>
          <button onClick={() => onNav("solicitar_mov")} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 14, padding: "14px 8px", cursor: "pointer", textAlign: "center", boxShadow: "0 4px 14px #7c3aed44" }}>
            <div style={{ fontSize: 28 }}>🔄</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>Mov. Pessoal</div>
          </button>
          <button onClick={() => onNav("mov_equip")} style={{ background: "#0e7490", color: "#fff", border: "none", borderRadius: 14, padding: "14px 8px", cursor: "pointer", textAlign: "center", boxShadow: "0 4px 14px #0e749044" }}>
            <div style={{ fontSize: 28 }}>🔧</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>Mov. Equipamentos</div>
          </button>
        </div>
        <div style={{ background: T.superficie, borderRadius: 14, padding: "12px 14px", marginBottom: 12, boxShadow: T.sombra }}>
          <div style={{ fontWeight: 700, color: T.titulo, marginBottom: 10, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Resumo de Hoje</span>
            <span style={{ fontSize: 9, color: T.texto2, fontStyle: "italic" }}>👆 toque pra ver detalhes</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ v: presentes, l: "Presentes", c: GREEN, dest: "fluxo" }, { v: faltas, l: "Faltas", c: RED, dest: "fluxo" }, { v: atestados, l: "Atestados", c: ORANGE, dest: "fluxo" }].map(s => (
              <div key={s.l} onClick={() => onNav(s.dest)} style={{ flex: 1, textAlign: "center", background: T.superficie2, borderRadius: 10, padding: "8px 4px", cursor: "pointer", border: `1px solid ${s.c}33` }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 10, color: T.texto2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div onClick={() => onNav("equipe")} style={{ background: T.superficie, borderRadius: 14, padding: "12px 14px", boxShadow: T.sombra, cursor: "pointer" }}>
          <div style={{ fontWeight: 700, color: T.titulo, marginBottom: 10, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Equipe da Obra ({trabalhadores.length})</span>
            <span style={{ color: T.desabilitado, fontSize: 16 }}>›</span>
          </div>
          {trabalhadores.slice(0, 3).map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 8 }}>👷</div>
              <div style={{ flex: 1, fontSize: 13, color: T.titulo, fontWeight: 600 }}>{t.nome}</div>
              <div style={{ fontSize: 11, color: T.texto2 }}>{t.cargo}</div>
            </div>
          ))}
          {trabalhadores.length > 3 && <div style={{ fontSize: 12, color: BLUE, marginTop: 4 }}>+{trabalhadores.length - 3} trabalhadores — toque pra ver todos</div>}
        </div>
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   FLUXO DIÁRIO
════════════════════════════════════ */

/* Momento (ms) de um lançamento: usa ts/id (gravados com Date.now()) e, se não houver, a data dd/mm/aaaa */
function tsLancamento(r) {
  const n = Number(r?.ts) || Number(r?.id);
  if (n && n > 1e11) return n;
  try {
    const [d, m, a] = String(r?.data || "").split("/");
    const t = new Date(parseInt(a), parseInt(m) - 1, parseInt(d)).getTime();
    return isNaN(t) ? 0 : t;
  } catch { return 0; }
}
const maisRecentes = (lista, n) => [...(lista || [])].sort((a, b) => tsLancamento(b) - tsLancamento(a)).slice(0, n);

export function TelaPainelGestor({ obras, trabalhadores, pedidos, equips, historico, mensagens, movimentacoes, manutencoes, cronogramas, movEquip, ativos, abastecimentos, empresa, usuario, rdosEmitidos = [], fotosObras = [], avisosNaoLidos = 0, onNav, onLogout, onAprovar, onNegar }) {
  const escritorio = !!useEscritorio(); // modo escritório (gestor em tela larga): versão de escritório; no app de campo continua igual
  const pendentes = pedidos.filter(p => p.status === "Aguardando").length;
  const movPendentes = (movimentacoes || []).filter(m => m.status === "Aguardando").length;
  const movEquipPendentes = (movEquip || []).filter(m => m.status === "Aguardando").length;
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const pedidosFiltrados = filtroStatus === "todos" ? pedidos : pedidos.filter(p => p.status === filtroStatus);
  const totalAlertas = gerarAlertas({ obras, trabalhadores, equips, pedidos, historico, manutencoes, cronogramas, movEquip, ativos, abastecimentos }).length;
  const novasMsgs = mensagens?.filter(m => !m.lida && m.para === usuario?.id).length || 0;
  // Áreas liberadas (usuario.acessos, menuGrupos.js): atalho para tela fora delas não aparece;
  // cartão informativo fica, sem o clique. A guarda de KMZeroApp.jsx segura o que escapar.
  const pode = nav => telaPermitida(usuario, nav);

  // Modal de aprovação com forma pagamento + prazo
  const [pedidoAprovando, setPedidoAprovando] = useState(null);
  const [formaPag, setFormaPag] = useState("");
  const [prazo, setPrazo] = useState("");

  const abrirAprovacao = (p) => {
    setPedidoAprovando(p);
    setFormaPag(p.formaPagamento || "");
    setPrazo(p.prazoEntrega || "");
  };

  const confirmarAprovacao = () => {
    if (!pedidoAprovando) return;
    const obraDoPedido = obras.find(o => o.id === pedidoAprovando.obraId);
    const pedidoCompleto = { ...pedidoAprovando, formaPagamento: formaPag, prazoEntrega: prazo, status: "Aprovado" };
    onAprovar(pedidoAprovando.id, { formaPagamento: formaPag, prazoEntrega: prazo });
    // Gera PDF DIRETO (sem confirm — o usuário pode fechar se não quiser)
    setTimeout(() => {
      try {
        gerarSolicitacaoPedidoPDF(pedidoCompleto, obraDoPedido, empresa);
      } catch (e) {
        console.error("Erro ao gerar PDF:", e);
        alert("✅ Pedido aprovado!\n\n⚠️ Não foi possível gerar o PDF agora. Tente abrir o pedido novamente para baixar.");
      }
    }, 200);
    setPedidoAprovando(null);
    setFormaPag("");
    setPrazo("");
  };

  // Categorias do menu (celular) — ordenadas por uso/importância.
  // Os nomes vêm de menuGrupos.js (os mesmos do menu lateral); os tiles estreitos do celular
  // mantêm um rótulo curto quando o nome do menu não cabe ("Custos/Obra", "Aniv. / EPI").
  const L = (nav, curto) => curto || labelDaTela(nav, nav);
  const categorias = [
    {
      titulo: "📋 Operação Diária",
      cor: GOLD,
      desc: "Relatórios, presenças e custos",
      itens: [
        { icon: "📄", l: "RDO ABNT",      nav: "rdo",         c: GOLD,         destaque: true },
        { icon: "📦", l: L("pedidos"),    nav: "pedidos",     c: pendentes > 0 ? RED : "#0891b2", badge: pendentes },
        { icon: "💵", l: "Custos/Obra",   nav: "custos",      c: "#16a34a" },
        { icon: "🧾", l: L("pagamentos"), nav: "pagamentos", c: "#10b981" },
        { icon: "💸", l: "Desp. Avulsas", nav: "despesas",    c: "#ea580c" },
        { icon: "📷", l: "Galeria Fotos", nav: "galeria",     c: "#7c3aed" },
        { icon: "📊", l: L("dashboard"),  nav: "dashboard",   c: "#0d9488" },
        { icon: "📅", l: L("calendario"), nav: "calendario",  c: "#7c3aed" },
        { icon: "🗺️", l: "Mapa Obras",   nav: "mapa",        c: "#16a34a" },
        { icon: "🚨", l: L("alertas"),    nav: "alertas",     c: totalAlertas > 0 ? RED : "#9ca3af", badge: totalAlertas },
      ],
    },
    {
      titulo: "👥 Recursos Humanos",
      cor: BLUE,
      desc: "Equipe, folha e gestão de pessoas",
      itens: [
        { icon: "💰", l: L("folha_quinzenal"), nav: "folha_quinzenal", c: "#15803d" },
        { icon: "📋", l: "Histórico Folhas", nav: "hist_folha",      c: "#059669" },
        { icon: "💸", l: L("adiantamentos"), nav: "adiantamentos",   c: "#ea580c" },
        { icon: "🔄", l: L("aprovar_mov"),  nav: "aprovar_mov",     c: movPendentes > 0 ? RED : "#0e7490", badge: movPendentes },
        { icon: "👥", l: L("equipe"),       nav: "equipe",          c: BLUE },
        { icon: "📋", l: "Fichas",          nav: "ficha",           c: ORANGE },
        { icon: "📞", l: L("contatos"),     nav: "contatos",        c: "#0284c7" },
        { icon: "🏥", l: L("exames"),       nav: "exames",          c: "#dc2626" },
        { icon: "🎂", l: "Aniv. / EPI",     nav: "rh",              c: "#f59e0b" },
        { icon: "🌴", l: L("ferias"),       nav: "ferias",          c: "#0e7490" },
        { icon: "💵", l: "Folha Mensal",    nav: "folha_quinzenal", c: "#059669" },
      ],
    },
    {
      titulo: "🏗️ Obras & Recursos",
      cor: NAVY,
      desc: "Obras, máquinas e materiais",
      itens: [
        { icon: "🏗️", l: L("obras"),          nav: "obras",         c: NAVY },
        { icon: "📅", l: L("cronograma"),     nav: "cronograma",    c: "#7c3aed" },
        { icon: "🎯", l: L("cronograma_pro"), nav: "cronograma_pro", c: "#5b21b6" },
        { icon: "🔄", l: L("mov_equip"),      nav: "mov_equip",     c: movEquipPendentes > 0 ? RED : "#0e7490", badge: movEquipPendentes },
        { icon: "🚜", l: "Ativos/Frota",    nav: "ativos",        c: "#ea580c" },
        { icon: "⛽", l: L("frota"),          nav: "frota",         c: "#dc7e00" },
        { icon: "🔧", l: L("manutencao"),     nav: "manutencao",    c: "#dc2626" },
        { icon: "⚙️", l: "Equipamentos",   nav: "equip_gestao",  c: "#475569" },
        { icon: "🔨", l: L("ferramentas"),    nav: "ferramentas",   c: "#7c2d12" },
        { icon: "🏪", l: L("fornecedores"),   nav: "fornecedores",  c: "#16a34a" },
        { icon: "🤝", l: L("clientes"),       nav: "clientes",     c: "#475569" },
        { icon: "📥", l: L("recebimento"),    nav: "recebimento",   c: "#0891b2" },
      ],
    },
    {
      titulo: "📈 Análise & Comunicação",
      cor: "#a855f7",
      desc: "Relatórios e mensagens",
      itens: [
        { icon: "📐", l: L("produtividade"), nav: "produtividade", c: "#15803d" },
        { icon: "📈", l: L("consolidado"),   nav: "consolidado",   c: "#a855f7" },
        { icon: "📓", l: "Diário Obra",     nav: "diario",        c: "#2563eb" },
        { icon: "🔔", l: L("avisos"),        nav: "avisos",        c: "#0891b2", badge: avisosNaoLidos },
        { icon: "💬", l: L("mensagens"),     nav: "mensagens",     c: "#db2777", badge: novasMsgs },
      ],
    },
    {
      titulo: "⚙️ Sistema",
      cor: "#475569",
      desc: "Configurações e segurança",
      itens: [
        { icon: "👤", l: "Minha Conta",   nav: "minha_conta", c: "#0891b2" },
        { icon: "🆘", l: "Ajuda & Suporte", nav: "ajuda", c: "#16a34a" },
        { icon: "🔗", l: L("links"),      nav: "links",   c: "#0284c7" },
        { icon: "🔑", l: L("acessos"),    nav: "acessos", c: "#0891b2" },
        { icon: "🏢", l: L("empresa"),    nav: "empresa", c: "#334155" },
        { icon: "💾", l: L("backup"),     nav: "backup",  c: "#6b7280" },
        // Itens abaixo só aparecem para o desenvolvedor (Kleber)
        ...(usuario?.email === EMAIL_DEV ? [
          { icon: "🔧", l: L("diagnostico"),     nav: "diagnostico", c: "#dc2626" },
          { icon: "🎬", l: L("gerar_simulacao"), nav: "gerar_simulacao", c: "#7c3aed" },
          { icon: "🧹", l: L("zerar_tudo"),      nav: "zerar_tudo", c: "#dc2626" },
        ] : []),
      ],
    },
  ].map(cat => ({ ...cat, itens: cat.itens.filter(i => pode(i.nav)) })).filter(cat => cat.itens.length > 0);

  // Pendências: soma de alertas do sistema + movimentações + pedidos + mensagens (o indicador que soma tudo).
  // "Alertas" = o que o sistema detecta; "Avisos" = notificações/recados — nomes distintos, conceitos distintos.
  const totalPendencias = totalAlertas + movPendentes + pendentes + novasMsgs;

  // MODAL APROVAÇÃO COM PAGAMENTO E PRAZO — o mesmo nas duas versões (celular e escritório)
  const modalAprovacao = (
    <Modal show={!!pedidoAprovando} title="✓ Aprovar Pedido" onClose={() => setPedidoAprovando(null)}>
      {pedidoAprovando && (() => {
        const itens = pedidoAprovando.itens || [{ material: pedidoAprovando.material, qtd: pedidoAprovando.qtd }];
        const obraDoPedido = obras.find(o => o.id === pedidoAprovando.obraId);
        return (
          <>
            <div style={{ background: T.sucessoFundo, borderRadius: 10, padding: "10px 12px", marginBottom: 12, borderLeft: `3px solid ${GREEN}` }}>
              <div style={{ fontSize: 11, color: T.sucessoTexto, fontWeight: 700, marginBottom: 4 }}>📋 Pedido</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.titulo }}>{pedidoAprovando.obra}</div>
              <div style={{ fontSize: 10, color: T.texto2, marginBottom: 6 }}>👷 {pedidoAprovando.enc} • {pedidoAprovando.data}</div>
              {itens.map((it, i) => (
                <div key={i} style={{ fontSize: 11, color: T.texto, paddingLeft: 8 }}>{i + 1}) <b>{it.material}</b> — <span style={{ color: GREEN, fontWeight: 700 }}>{it.qtd}</span></div>
              ))}
            </div>

            <div style={{ background: T.avisoFundo, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 11, color: T.avisoTexto }}>
              💡 Preencha forma de pagamento e prazo para o fornecedor. Após aprovar, o app pergunta se você quer gerar a <b>Solicitação de Pedido de Compra</b> em PDF para enviar.
            </div>

            <label style={labelS}>💰 Forma de pagamento</label>
            <select value={formaPag} onChange={e => setFormaPag(e.target.value)} style={selS}>
              <option value="">— Selecione —</option>
              <option>À vista</option>
              <option>Boleto 7 dias</option>
              <option>Boleto 15 dias</option>
              <option>Boleto 30 dias</option>
              <option>30/60 dias</option>
              <option>30/60/90 dias</option>
              <option>Faturado mensal</option>
              <option>PIX antecipado</option>
              <option>A combinar</option>
            </select>

            <label style={labelS}>📅 Prazo de entrega</label>
            <input value={prazo} onChange={e => setPrazo(e.target.value)} placeholder="Ex: até 02/05/2026 ou 3 dias úteis" style={inputS} />

            {!obraDoPedido?.endereco && (
              <div style={{ background: T.erroFundo, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 11, color: RED }}>
                ⚠️ Atenção: a obra <b>{pedidoAprovando.obra}</b> ainda não tem endereço completo cadastrado. Edite a obra para incluir endereço de entrega.
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPedidoAprovando(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: T.superficie2, color: T.titulo, fontWeight: 800, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
              <button onClick={confirmarAprovacao} style={{ flex: 2, padding: 12, borderRadius: 10, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 13 }}>✓ Aprovar Pedido</button>
            </div>
          </>
        );
      })()}
    </Modal>
  );

  /* ══════════ VERSÃO DE ESCRITÓRIO (largura >= 1024) ══════════
     Mesmos cálculos de cima; sem a lista de categorias (o menu lateral já faz isso). */
  if (escritorio) {
    const hoje = hojeStr();
    const presHoje = (historico || {})[hoje] || {};
    const presentesHoje = Object.values(presHoje).filter(v => v === "Presente").length;
    const obrasAtivas = obras.filter(o => o.status === "Ativa");
    const pedidosAguardando = pedidos.filter(p => p.status === "Aguardando");
    const rdosRecentes = maisRecentes(rdosEmitidos, 8);
    const fotosRecentes = maisRecentes(fotosObras, 8);
    const limite7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const nomeObra = (obraId, alternativa) => obras.find(o => String(o.id) === String(obraId))?.nome || alternativa || "Obra";
    const nomeEmpresa = empresa?.nomeFantasia || empresa?.razaoSocial || "";
    const dataExtenso = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    const cartaoS = { background: T.superficie, borderRadius: 14, padding: 16, boxShadow: T.sombra };
    const tituloSecaoS = { fontSize: 12, color: T.titulo, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 800, marginBottom: 10 };
    const btnPeqS = (cor) => ({ background: cor, color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontWeight: 800, cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" });
    const textoVazio = "Nada ainda: os lançamentos da equipe aparecem aqui.";
    const indicadores = [
      { v: obrasAtivas.length,    l: "Obras ativas",       nav: "obras",      c: BLUE },
      { v: trabalhadores.length,  l: "Trabalhadores",      nav: "equipe",     c: T.titulo },
      { v: presentesHoje,         l: "Presentes hoje",     nav: "calendario", c: GREEN },
      { v: pendentes,             l: "Pedidos aguardando", nav: "pedidos",    c: pendentes > 0 ? ORANGE : T.texto3 },
      { v: totalPendencias,       l: "Pendências",         nav: "alertas",    c: totalPendencias > 0 ? RED : GREEN },
    ].filter(i => pode(i.nav));
    const outrasPendencias = [
      { icon: "🔄", l: "Movimentações de pessoal",      v: movPendentes,      nav: "aprovar_mov" },
      { icon: "🔧", l: "Movimentações de equipamentos", v: movEquipPendentes, nav: "mov_equip" },
      { icon: "🔔", l: "Avisos novos",                  v: avisosNaoLidos,    nav: "avisos" },
      { icon: "💬", l: "Mensagens novas",               v: novasMsgs,         nav: "mensagens" },
      { icon: "🚨", l: "Alertas",                       v: totalAlertas,      nav: "alertas" },
    ].filter(i => pode(i.nav));
    // Cartões informativos (obras, RDOs, fotos): continuam no Painel; só levam à tela se ela for da pessoa
    const clique = nav => (pode(nav) ? { onClick: () => onNav(nav), cursor: "pointer" } : { onClick: undefined, cursor: "default" });

    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        {/* Sem cabeçalho no escritório: o menu lateral já tem Sair e o badge de Avisos (KMHeader sem título vira null) */}
        <KMHeader />
        <div style={{ flex: 1, overflowY: "auto", background: T.fundo, padding: 24 }}>
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>

            {/* (1) Cabeçalho da página + indicadores */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 900, color: T.titulo, lineHeight: 1.1 }}>Painel</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.texto, marginTop: 4 }}>{[nomeEmpresa, usuario?.nome || "Gestor"].filter(Boolean).join(" · ")}</div>
                <div style={{ fontSize: 12, color: T.texto2, marginTop: 2 }}>{dataExtenso}</div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {indicadores.map(i => (
                  <div key={i.l} onClick={() => onNav(i.nav)} style={{ background: T.superficie, border: `1px solid ${T.borda}`, borderRadius: 12, padding: "10px 16px", minWidth: 118, cursor: "pointer", boxShadow: T.sombra }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: i.c, lineHeight: 1.1 }}>{i.v}</div>
                    <div style={{ fontSize: 11, color: T.texto2, fontWeight: 600, marginTop: 2 }}>{i.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* (2) Obras (esquerda) + Pendências (direita) */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20, alignItems: "start" }}>
              <div>
                <div style={tituloSecaoS}>Obras</div>
                {obrasAtivas.length === 0 ? (
                  <div style={{ ...cartaoS, color: T.texto2, fontSize: 13 }}>Nenhuma obra ativa. Cadastre em Obras.</div>
                ) : (
                  <Grade min={300} gap={12}>
                    {obrasAtivas.map(o => {
                      const trabObra = trabalhadores.filter(t => String(t.obraId) === String(o.id));
                      const presentesObra = trabObra.filter(t => presHoje[t.id] === "Presente").length;
                      const ultimoRdo = maisRecentes((rdosEmitidos || []).filter(r => String(r.obraId) === String(o.id)), 1)[0];
                      const fotos7d = (fotosObras || []).filter(f => String(f.obraId) === String(o.id) && tsLancamento(f) >= limite7d).length;
                      const local = [o.cliente, o.endereco || o.local].filter(Boolean).join(" · ");
                      return (
                        <div key={o.id} onClick={clique("obras").onClick} style={{ ...cartaoS, cursor: clique("obras").cursor, borderTop: `4px solid ${BLUE}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ fontWeight: 800, color: T.titulo, fontSize: 14, lineHeight: 1.3 }}>{o.nome}</div>
                            <Badge label={o.status} color={GREEN} small />
                          </div>
                          {local && <div style={{ fontSize: 11, color: T.texto2, marginTop: 4 }}>{local}</div>}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                            <div style={{ background: T.superficie2, borderRadius: 8, padding: "8px 10px" }}>
                              <div style={{ fontSize: 18, fontWeight: 900, color: GREEN }}>{presentesObra}<span style={{ fontSize: 11, color: T.texto2, fontWeight: 600 }}> / {trabObra.length}</span></div>
                              <div style={{ fontSize: 10, color: T.texto2 }}>Presentes hoje</div>
                            </div>
                            <div style={{ background: T.superficie2, borderRadius: 8, padding: "8px 10px" }}>
                              <div style={{ fontSize: 18, fontWeight: 900, color: BLUE }}>{fotos7d}</div>
                              <div style={{ fontSize: 10, color: T.texto2 }}>Fotos (7 dias)</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: T.texto2, marginTop: 10 }}>
                            {ultimoRdo
                              ? <>📄 Último RDO: <b style={{ color: T.titulo }}>nº {ultimoRdo.numero ?? "—"}</b> em {ultimoRdo.data || "—"}</>
                              : <span style={{ color: T.texto3 }}>📄 Nenhum RDO emitido ainda</span>}
                          </div>
                        </div>
                      );
                    })}
                  </Grade>
                )}
              </div>

              <div>
                <div style={tituloSecaoS}>Pendências</div>
                <div style={cartaoS}>
                  {/* Aprovar/negar pedido é de quem tem a área Suprimentos */}
                  {pode("pedidos") && <>
                  <div style={{ fontWeight: 800, color: T.titulo, fontSize: 13, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    📦 Pedidos aguardando
                    {pendentes > 0 && <span style={{ background: RED, color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 800 }}>{pendentes}</span>}
                  </div>
                  {pendentes === 0 && <div style={{ fontSize: 12, color: T.texto3 }}>Nenhum pedido aguardando.</div>}
                  {pedidosAguardando.slice(0, 5).map(p => {
                    const itens = p.itens || [{ material: p.material, qtd: p.qtd }];
                    const resumo = itens.slice(0, 2).map(it => `${it.material} (${it.qtd})`).join(", ") + (itens.length > 2 ? ` +${itens.length - 2}` : "");
                    return (
                      <div key={p.id} style={{ borderLeft: `3px solid ${ORANGE}`, background: T.avisoFundo, borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, color: T.titulo, fontSize: 12 }}>{p.obra}</div>
                        <div style={{ fontSize: 10, color: T.texto2 }}>👷 {p.enc} • {p.data}</div>
                        <div style={{ fontSize: 11, color: T.texto, marginTop: 3 }}>{resumo}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <button onClick={() => abrirAprovacao(p)} style={{ ...btnPeqS(GREEN), flex: 2 }}>✓ Aprovar</button>
                          <button onClick={() => onNegar(p.id)} style={{ ...btnPeqS(RED), flex: 1 }}>✕ Negar</button>
                        </div>
                      </div>
                    );
                  })}
                  {pendentes > 5 && (
                    <button onClick={() => onNav("pedidos")} style={{ width: "100%", padding: 8, borderRadius: 8, border: `1.5px solid ${T.contorno}`, background: T.superficie, color: T.contorno, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>
                      Ver todos os {pendentes} pedidos →
                    </button>
                  )}
                  </>}
                  <div style={pode("pedidos") ? { borderTop: `1px solid ${T.borda}`, marginTop: 12, paddingTop: 10 } : undefined}>
                    {outrasPendencias.map(i => (
                      <div key={i.nav} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                        <span style={{ fontSize: 16 }}>{i.icon}</span>
                        <span style={{ flex: 1, fontSize: 12, color: T.texto }}>{i.l}</span>
                        <span style={{ fontSize: 14, fontWeight: 900, color: i.v > 0 ? RED : T.texto3, minWidth: 22, textAlign: "right" }}>{i.v}</span>
                        <button onClick={() => onNav(i.nav)} style={btnPeqS(i.v > 0 ? NAVY : "#9ca3af")}>Ver</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* (3) Atividade recente */}
            <div style={tituloSecaoS}>Atividade recente</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={cartaoS}>
                <div style={{ fontWeight: 800, color: T.titulo, fontSize: 13, marginBottom: 8 }}>📄 Últimos RDOs</div>
                {rdosRecentes.length === 0
                  ? <div style={{ fontSize: 12, color: T.texto3 }}>{textoVazio}</div>
                  : rdosRecentes.map(r => (
                    <div key={r.id} onClick={clique("rdo").onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${T.borda}`, cursor: clique("rdo").cursor }}>
                      <span style={{ background: GOLD, color: NAVY, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>nº {r.numero ?? "—"}</span>
                      <span style={{ flex: 1, fontSize: 12, color: T.titulo, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeObra(r.obraId, r.obra)}</span>
                      <span style={{ fontSize: 11, color: T.texto2, whiteSpace: "nowrap" }}>{r.data || "—"}</span>
                    </div>
                  ))}
              </div>
              <div style={cartaoS}>
                <div style={{ fontWeight: 800, color: T.titulo, fontSize: 13, marginBottom: 8 }}>📷 Últimas fotos</div>
                {fotosRecentes.length === 0
                  ? <div style={{ fontSize: 12, color: T.texto3 }}>{textoVazio}</div>
                  : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {fotosRecentes.map(f => {
                        const src = f.fotoUrl || f.foto;
                        return (
                          <div key={f.id} onClick={clique("galeria").onClick} style={{ width: 96, cursor: clique("galeria").cursor }}>
                            {src
                              ? <img src={src} alt={f.legenda || ""} style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8, background: T.superficie2, display: "block" }} />
                              : <div style={{ width: 96, height: 96, borderRadius: 8, background: T.superficie2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>📷</div>}
                            <div style={{ fontSize: 10, color: T.titulo, fontWeight: 600, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.obraNome || nomeObra(f.obraId)}</div>
                            <div style={{ fontSize: 10, color: T.texto2 }}>{f.data || "—"}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>
            </div>

          </div>
        </div>
        <KMFooter />
        {modalAprovacao}
      </div>
    );
  }

  /* ══════════ VERSÃO DE CAMPO (celular) — igual à de sempre ══════════ */
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader right={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}><SinoAvisos n={avisosNaoLidos} onClick={() => onNav("avisos")} /><button onClick={onLogout} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Sair</button></div>
      } />
      <div style={{ flex: 1, overflowY: "auto", background: T.fundo, padding: 14 }}>
        {/* Saudação */}
        <div style={{ background: T.superficie, borderRadius: 14, padding: "12px 14px", marginBottom: 12, boxShadow: T.sombra }}>
          <div style={{ fontSize: 12, color: T.texto2 }}>Painel do Gestor</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.titulo }}>{usuario?.nome || "Gestor"}</div>
          <div style={{ fontSize: 11, color: T.texto2, marginTop: 2 }}>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>

        {/* Stats rápidas — CLICÁVEIS */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {pode("obras") && <div onClick={() => onNav("obras")} style={{ flex: 1, background: BLUE, borderRadius: 12, padding: "10px 6px", textAlign: "center", cursor: "pointer", boxShadow: `0 3px 10px ${BLUE}40` }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{obras.filter(o => o.status === "Ativa").length}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)" }}>🏗️ Obras</div>
          </div>}
          {pode("equipe") && <div onClick={() => onNav("equipe")} style={{ flex: 1, background: ORANGE, borderRadius: 12, padding: "10px 6px", textAlign: "center", cursor: "pointer", boxShadow: `0 3px 10px ${ORANGE}40` }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{trabalhadores.length}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)" }}>👥 Equipe</div>
          </div>}
          <div onClick={() => onNav("alertas")} style={{ flex: 1, background: totalPendencias > 0 ? RED : GREEN, borderRadius: 12, padding: "10px 6px", textAlign: "center", cursor: "pointer", boxShadow: `0 3px 10px ${totalPendencias > 0 ? RED + "40" : GREEN + "40"}` }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{totalPendencias}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)" }}>🚨 Pendências</div>
          </div>
        </div>

        {/* Atalhos rápidos (4 mais usados) */}
        <div style={{ fontSize: 11, color: T.texto2, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>⚡ Acesso Rápido</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
          {[
            { icon: "📄", l: "RDO ABNT",       nav: "rdo",           c: GOLD },
            { icon: "💰", l: "Folha de Pagamento", nav: "folha_quinzenal", c: "#15803d" },
            { icon: "📋", l: "Cadastrar Ficha", nav: "ficha",         c: ORANGE },
            { icon: "🚨", l: "Alertas",         nav: "alertas",       c: totalAlertas > 0 ? RED : "#9ca3af", badge: totalAlertas },
          ].filter(b => pode(b.nav)).map(b => (
            <button key={b.nav} onClick={() => onNav(b.nav)} style={{ background: b.c, color: "#fff", border: "none", borderRadius: 14, padding: "16px 8px", cursor: "pointer", textAlign: "center", boxShadow: `0 4px 14px ${b.c}55`, position: "relative" }}>
              <div style={{ fontSize: 32 }}>{b.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4 }}>{b.l}</div>
              {/* Contador branco fixo: fica sobre o botão colorido (não sobre a superfície), então não segue o tema */}
              {b.badge > 0 && <div style={{ position: "absolute", top: 6, right: 8, background: "#fff", color: RED, borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 800 }}>{b.badge}</div>}
            </button>
          ))}
        </div>

        {/* TABELA RESUMO DA EQUIPE — padrão elite */}
        {pode("equipe") && <TabelaResumoEquipe obras={obras} trabalhadores={trabalhadores} historico={historico} onNav={onNav} />}

        {/* Categorias agrupadas */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          margin: "18px 0 10px",
          padding: "0 4px",
        }}>
          <div style={{ fontSize: 18 }}>📂</div>
          <div style={{
            fontSize: 12,
            color: T.titulo,
            textTransform: "uppercase",
            letterSpacing: 1.5,
            fontWeight: 800,
          }}>Todas as Funções</div>
          <div style={{
            flex: 1,
            height: 1,
            background: `linear-gradient(90deg, ${T.borda2} 0%, transparent 100%)`,
          }} />
          <div style={{ fontSize: 10, color: T.texto2, fontWeight: 600 }}>
            {categorias.length} categorias
          </div>
        </div>
        {categorias.map((cat, idx) => (
          <CategoriaCard key={idx} categoria={cat} onNav={onNav} />
        ))}

        {/* Pedidos pendentes resumo (aprovar/negar é de quem tem a área Suprimentos) */}
        {pendentes > 0 && pode("pedidos") && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 700, color: T.titulo, marginBottom: 10, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              📦 Pedidos Aguardando Aprovação
              <span style={{ background: RED, color: "#fff", borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>{pendentes}</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: T.texto2, fontStyle: "italic" }}>👆 toque pra ver</span>
            </div>
            {pedidos.filter(p => p.status === "Aguardando").slice(0, 3).map(p => {
              const itens = p.itens || [{ material: p.material, qtd: p.qtd }];
              return (
                <div key={p.id} onClick={() => onNav("pedidos")} style={{ background: T.superficie, borderRadius: 12, padding: "10px 14px", marginBottom: 8, boxShadow: T.sombra, cursor: "pointer", transition: "all 0.2s", borderLeft: `4px solid ${ORANGE}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: T.titulo, fontSize: 13 }}>{p.obra}</div>
                      <div style={{ fontSize: 10, color: T.texto2 }}>👷 {p.enc} • {p.data} • <b style={{ color: T.titulo }}>{itens.length} {itens.length === 1 ? "item" : "itens"}</b></div>
                      <div style={{ marginTop: 6, background: T.superficie2, borderRadius: 6, padding: "6px 8px" }}>
                        {itens.slice(0, 3).map((it, i) => (
                          <div key={i} style={{ fontSize: 11, color: T.texto }}>• <b>{it.material}</b> — <span style={{ color: GREEN, fontWeight: 700 }}>{it.qtd}</span></div>
                        ))}
                        {itens.length > 3 && <div style={{ fontSize: 10, color: T.texto2, marginTop: 2 }}>+ {itens.length - 3} item(ns)...</div>}
                      </div>
                      {p.obsGeral && <div style={{ fontSize: 10, color: T.texto2, fontStyle: "italic", marginTop: 4 }}>📝 {p.obsGeral}</div>}
                    </div>
                    <span style={{ color: T.desabilitado, fontSize: 16 }}>›</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => onNegar(p.id)} style={{ flex: 1, padding: 8, borderRadius: 8, border: "none", background: RED, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 11 }}>✕ NEGAR</button>
                    <button onClick={() => abrirAprovacao(p)} style={{ flex: 2, padding: 8, borderRadius: 8, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 11 }}>✓ APROVAR</button>
                  </div>
                </div>
              );
            })}
            {pendentes > 3 && (
              <button onClick={() => onNav("pedidos")} style={{ width: "100%", padding: 10, borderRadius: 10, border: `1.5px solid ${T.contorno}`, background: T.superficie, color: T.contorno, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                Ver todos os {pendentes} pedidos →
              </button>
            )}
          </div>
        )}
      </div>
      <KMFooter />

      {modalAprovacao}
    </div>
  );
}

// Card de categoria com expansão

export function CategoriaCard({ categoria, onNav }) {
  const [aberto, setAberto] = useState(false);
  const totalBadges = categoria.itens.reduce((s, i) => s + (i.badge || 0), 0);

  // Separa emoji do título para destacar visualmente
  const tituloPartes = categoria.titulo.match(/^(\S+)\s+(.+)$/);
  const emoji = tituloPartes ? tituloPartes[1] : "";
  const nomeCategoria = tituloPartes ? tituloPartes[2] : categoria.titulo;

  // Converte hex para rgba (para gradiente sutil de fundo)
  const corRGBA = (hex, a) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  return (
    <div style={{
      background: T.superficie,
      borderRadius: 14,
      marginBottom: 10,
      overflow: "hidden",
      boxShadow: aberto ? `0 4px 20px ${corRGBA(categoria.cor, 0.18)}` : T.sombra,
      transition: "all 0.25s ease",
      border: aberto ? `1.5px solid ${corRGBA(categoria.cor, 0.3)}` : "1.5px solid transparent",
    }}>
      <button onClick={() => setAberto(!aberto)} style={{
        width: "100%",
        padding: "14px 16px",
        border: "none",
        background: aberto
          ? `linear-gradient(90deg, ${corRGBA(categoria.cor, 0.08)} 0%, transparent 100%)`
          : T.superficie,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        textAlign: "left",
        borderBottom: aberto ? `1px solid ${corRGBA(categoria.cor, 0.15)}` : "none",
        transition: "background 0.25s ease",
      }}>
        {/* Ícone grande com fundo colorido */}
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${categoria.cor} 0%, ${corRGBA(categoria.cor, 0.7)} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          marginRight: 12,
          flexShrink: 0,
          boxShadow: `0 3px 10px ${corRGBA(categoria.cor, 0.35)}`,
        }}>
          {emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: T.titulo, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
            {nomeCategoria}
            {totalBadges > 0 && (
              <span style={{
                background: RED,
                color: "#fff",
                borderRadius: 10,
                padding: "2px 8px",
                fontSize: 10,
                fontWeight: 800,
                boxShadow: `0 2px 6px ${RED}50`,
              }}>{totalBadges}</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: T.texto2, marginTop: 2 }}>
            {categoria.desc} <span style={{ color: categoria.cor, fontWeight: 700 }}>• {categoria.itens.length} opções</span>
          </div>
        </div>
        <span style={{
          color: categoria.cor,
          fontSize: 22,
          fontWeight: 700,
          transition: "transform 0.25s ease",
          transform: aberto ? "rotate(90deg)" : "rotate(0)",
          marginLeft: 4,
        }}>›</span>
      </button>
      {aberto && (
        <div style={{
          padding: 12,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          background: corRGBA(categoria.cor, 0.03),
        }}>
          {categoria.itens.map(b => (
            <button
              key={b.nav}
              onClick={() => onNav(b.nav)}
              style={{
                background: b.c,
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "14px 8px",
                cursor: "pointer",
                textAlign: "center",
                boxShadow: `0 3px 10px ${b.c}40`,
                position: "relative",
                gridColumn: b.destaque ? "span 2" : "span 1",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                minHeight: 76,
              }}
              onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
              onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
              onTouchStart={e => e.currentTarget.style.transform = "scale(0.97)"}
              onTouchEnd={e => e.currentTarget.style.transform = "scale(1)"}
            >
              <div style={{ fontSize: b.destaque ? 30 : 24 }}>{b.icon}</div>
              <div style={{ fontSize: b.destaque ? 13 : 12, fontWeight: 700, marginTop: 4 }}>{b.l}</div>
              {b.badge > 0 && (
                <div style={{
                  position: "absolute",
                  top: 6,
                  right: 8,
                  background: "#fff", // contador branco fixo: fica sobre o botão colorido, não sobre a superfície
                  color: RED,
                  borderRadius: 10,
                  padding: "2px 7px",
                  fontSize: 10,
                  fontWeight: 800,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                }}>{b.badge}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════
   OBRAS (GESTOR)
════════════════════════════════════ */

export function TelaRelatorio({ obras, trabalhadores, pedidos, presencasHoje, empresa, onBack }) {
  const [obraId, setObraId] = useState(obras[0]?.id);
  const obra = obras.find(o => o.id === obraId) || obras[0];
  const equips = DEFAULT_EQUIPS.filter(e => e.obraId === obraId);
  const trab = trabalhadores.filter(t => t.obraId === obraId);
  const pedidosObra = pedidos.filter(p => p.obraId === obraId);
  const hoje = new Date().toLocaleDateString("pt-BR");

  const presentes = trab.filter(t => presencasHoje[t.id] === "Presente").length;
  const faltas    = trab.filter(t => presencasHoje[t.id] === "Falta").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Relatório Diário" sub={`${obra?.nome || ""} — ${hoje}`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: T.fundo, padding: 14 }}>
        <select value={obraId} onChange={e => setObraId(parseInt(e.target.value))} style={{ ...selS, marginBottom: 14 }}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ background: T.superficie, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: T.sombra }}>
          <div style={{ fontWeight: 800, color: T.titulo, marginBottom: 10, fontSize: 14 }}>👷 Mão de Obra</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, textAlign: "center", background: T.sucessoFundo, borderRadius: 10, padding: "8px 4px" }}><div style={{ fontSize: 18, fontWeight: 900, color: GREEN }}>{presentes}</div><div style={{ fontSize: 10, color: T.texto2 }}>Presentes</div></div>
            <div style={{ flex: 1, textAlign: "center", background: T.erroFundo, borderRadius: 10, padding: "8px 4px" }}><div style={{ fontSize: 18, fontWeight: 900, color: RED }}>{faltas}</div><div style={{ fontSize: 10, color: T.texto2 }}>Faltas</div></div>
            <div style={{ flex: 1, textAlign: "center", background: T.avisoFundo, borderRadius: 10, padding: "8px 4px" }}><div style={{ fontSize: 18, fontWeight: 900, color: ORANGE }}>{trab.length - presentes - faltas}</div><div style={{ fontSize: 10, color: T.texto2 }}>Atestados</div></div>
          </div>
          {trab.map((t, i, arr) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", paddingBottom: 6, marginBottom: 6, borderBottom: i < arr.length - 1 ? `1px solid ${T.borda}` : "none" }}>
              <span style={{ fontSize: 14, marginRight: 8 }}>{presencasHoje[t.id] === "Presente" ? "✅" : presencasHoje[t.id] === "Falta" ? "❌" : "📋"}</span>
              <span style={{ flex: 1, fontSize: 13, color: T.titulo }}>{t.nome} — {t.cargo}</span>
              <Badge label={presencasHoje[t.id] || "—"} color={STATUS_COLOR[presencasHoje[t.id]] || "#888"} small />
            </div>
          ))}
          {trab.length === 0 && <div style={{ color: T.texto3, fontSize: 13 }}>Sem trabalhadores.</div>}
        </div>

        <div style={{ background: T.superficie, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: T.sombra }}>
          <div style={{ fontWeight: 800, color: T.titulo, marginBottom: 10, fontSize: 14 }}>⚙️ Equipamentos</div>
          {equips.map(eq => (
            <div key={eq.id} style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 22, marginRight: 10 }}>{eq.icon}</span>
              <span style={{ flex: 1, fontSize: 14, color: T.titulo }}>{eq.nome}</span>
              <Badge label={eq.status} color={EQUIP_COLOR[eq.status]} small />
            </div>
          ))}
        </div>

        {pedidosObra.length > 0 && (
          <div style={{ background: T.superficie, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: T.sombra }}>
            <div style={{ fontWeight: 800, color: T.titulo, marginBottom: 10, fontSize: 14 }}>📦 Pedidos de Material</div>
            {pedidosObra.map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, paddingBottom: 6, borderBottom: `1px solid ${T.borda}` }}>
                <div style={{ fontSize: 13, color: T.titulo }}>{p.material} — {fmtQtd(p.qtd)}</div>
                <Badge label={p.status} color={p.status === "Aprovado" ? GREEN : p.status === "Negado" ? RED : ORANGE} small />
              </div>
            ))}
          </div>
        )}

        <div style={{ background: T.superficie, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: T.sombra }}>
          <div style={{ fontWeight: 800, color: T.titulo, marginBottom: 10, fontSize: 14 }}>📷 Fotos da Obra</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {["🏗️", "🧱", "🔨"].map((f, i) => (
              <div key={i} style={{ background: T.infoFundo, borderRadius: 10, height: 68, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>{f}</div>
            ))}
          </div>
        </div>

        <Btn label="📤 Exportar Relatório PDF" color={NAVY} onClick={async () => {
          // Modelo migrado para o padrão do núcleo (esta tela não está no menu; mantido sem captura).
          const emp = await empresaDoDocumento(empresa);
          const linhasTrab = trab.length
            ? trab.map(t => `<tr><td>${escHTML(t.nome)}</td><td>${escHTML(t.cargo)}</td><td>${seloHTML(presencasHoje[t.id], TOM_PRESENCA[presencasHoje[t.id]])}</td></tr>`).join("")
            : `<tr><td class="vazio" colspan="3">Sem registros</td></tr>`;
          const linhasEquip = equips.length
            ? equips.map(eq => `<tr><td>${escHTML(eq.nome)}</td><td>${escHTML(eq.codigo)}</td><td>${seloHTML(eq.status, TOM_EQUIP[eq.status])}</td></tr>`).join("")
            : `<tr><td class="vazio" colspan="3">Sem registros</td></tr>`;
          const html = `<html><head><meta charset="UTF-8"><title>Relatório ${escHTML(obra?.nome || "")} - ${hoje}</title>
            <style>
              ${KM_PDF_PAGE_CSS}
              ${KM_PDF_CSS}
            </style></head><body>
              ${gerarHeaderHTML({ tipo: "Relatório Diário", periodo: hoje, info_extra: [obra?.nome, obra?.local].filter(Boolean).join(" · "), empresa: emp })}
              <div class="kpis">
                <div class="kpi ok"><b>${presentes}</b><span>Presentes</span></div>
                <div class="kpi erro"><b>${faltas}</b><span>Faltas</span></div>
                <div class="kpi alerta"><b>${trab.length - presentes - faltas}</b><span>Atestados / sem registro</span></div>
              </div>
              <div class="sec">1. Mão de obra <small>chamada do dia</small></div>
              <table class="quadro"><thead><tr><th style="width:45%">Trabalhador</th><th style="width:35%">Cargo</th><th style="width:20%">Situação</th></tr></thead>
              <tbody>${linhasTrab}</tbody></table>
              <div class="sec">2. Equipamentos</div>
              <table class="quadro"><thead><tr><th style="width:45%">Equipamento</th><th style="width:30%">Código</th><th style="width:25%">Situação</th></tr></thead>
              <tbody>${linhasEquip}</tbody></table>
              ${pedidosObra.length > 0 ? `
                <div class="sec">3. Pedidos de material</div>
                <table class="quadro"><thead><tr><th style="width:14%" class="num">Pedido Nº</th><th style="width:46%">Material</th><th style="width:20%" class="num">Quantidade</th><th style="width:20%">Situação</th></tr></thead>
                <tbody>${pedidosObra.map(p => `<tr><td class="num"><b>${escHTML(String(p.id).slice(-6))}</b></td><td>${escHTML(p.material)}</td><td class="num">${escHTML(fmtQtd(p.qtd))}</td><td>${seloHTML(p.status, TOM_PEDIDO[p.status])}</td></tr>`).join("")}</tbody></table>
              ` : ""}
              ${gerarFooterHTML({ empresa: emp, documento: "Relatório Diário" })}
            </body></html>`;
          abrirOuBaixarHTML(html, `Relatorio-${(obra?.nome || "obra").replace(/[^a-z0-9]/gi, "_").substring(0, 25)}-${hoje.replace(/\//g, "-")}.html`, { empresa: emp });
        }} style={{ marginBottom: 4 }} />
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   DASHBOARD GESTOR — gráficos
════════════════════════════════════ */

export function TelaDashboard({ obras, trabalhadores, pedidos, historico, onBack }) {
  const { paleta } = useTema(); // hex do tema atual para o Recharts (var() não funciona em atributo SVG)
  const [obraId, setObraId] = useState("todas");
  const dias = ultimosDias(7);
  const trabFiltro = obraId === "todas" ? trabalhadores : trabalhadores.filter(t => String(t.obraId) === String(obraId));

  const dadosPresenca = dias.map(d => {
    const pres = historico[d] || {};
    let p = 0, f = 0, a = 0;
    trabFiltro.forEach(t => {
      const s = pres[t.id];
      if (s === "Presente") p++;
      else if (s === "Falta") f++;
      else if (s === "Atestado") a++;
    });
    return { dia: fmtData(d), Presentes: p, Faltas: f, Atestados: a };
  });

  const totalPedidos = obraId === "todas" ? pedidos : pedidos.filter(p => String(p.obraId) === String(obraId));
  const dadosPedidos = [
    { name: "Aprovados",  value: totalPedidos.filter(p => p.status === "Aprovado").length,  color: GREEN },
    { name: "Aguardando", value: totalPedidos.filter(p => p.status === "Aguardando").length, color: ORANGE },
    { name: "Negados",    value: totalPedidos.filter(p => p.status === "Negado").length,    color: RED },
  ].filter(x => x.value > 0);

  const cargosCount = {};
  trabFiltro.forEach(t => { cargosCount[t.cargo] = (cargosCount[t.cargo] || 0) + 1; });
  const dadosCargos = Object.entries(cargosCount).map(([k, v]) => ({ name: k, qtd: v }));

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title={labelDaTela("dashboard", "Indicadores")} sub="Números e gráficos" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: T.fundo, padding: 14 }}>
        <select value={obraId} onChange={e => setObraId(e.target.value)} style={{ ...selS, marginBottom: 14 }}>
          <option value="todas">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ background: T.superficie, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: T.sombra }}>
          <div style={{ fontWeight: 800, color: T.titulo, marginBottom: 10, fontSize: 14 }}>📊 Presenças (últimos 7 dias)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dadosPresenca}>
              <CartesianGrid strokeDasharray="3 3" stroke={paleta.grade} />
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: paleta.texto2 }} stroke={paleta.texto2} />
              <YAxis tick={{ fontSize: 10, fill: paleta.texto2 }} stroke={paleta.texto2} />
              <Tooltip contentStyle={{ background: paleta.superficie, border: `1px solid ${paleta.borda}`, color: paleta.texto }} />
              <Bar dataKey="Presentes" fill={GREEN} />
              <Bar dataKey="Faltas" fill={RED} />
              <Bar dataKey="Atestados" fill={ORANGE} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {dadosPedidos.length > 0 && (
          <div style={{ background: T.superficie, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: T.sombra }}>
            <div style={{ fontWeight: 800, color: T.titulo, marginBottom: 10, fontSize: 14 }}>📦 Status dos Pedidos</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={dadosPedidos} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, value }) => `${name}: ${value}`}>
                  {dadosPedidos.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {dadosCargos.length > 0 && (
          <div style={{ background: T.superficie, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: T.sombra }}>
            <div style={{ fontWeight: 800, color: T.titulo, marginBottom: 10, fontSize: 14 }}>👥 Distribuição por Cargo</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dadosCargos} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={paleta.grade} />
                <XAxis type="number" tick={{ fontSize: 10, fill: paleta.texto2 }} stroke={paleta.texto2} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: paleta.texto2 }} stroke={paleta.texto2} width={90} />
                <Tooltip contentStyle={{ background: paleta.superficie, border: `1px solid ${paleta.borda}`, color: paleta.texto }} />
                <Bar dataKey="qtd" fill={BLUE} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div style={{ background: T.superficie, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: T.sombra }}>
          <div style={{ fontWeight: 800, color: T.titulo, marginBottom: 10, fontSize: 14 }}>💰 Folha Total (mês)</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: GREEN }}>
            R$ {trabFiltro.reduce((s, t) => s + (parseFloat(t.salario) || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11, color: T.texto2, marginTop: 4 }}>Soma dos salários base de {trabFiltro.length} trabalhador(es)</div>
        </div>
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   TRABALHADOR DETALHE
════════════════════════════════════ */
/* ════════════════════════════════════
   FICHA CADASTRAL IMPRIMÍVEL — A4 oficial pra arquivo físico
════════════════════════════════════ */
/* ════════════════════════════════════
   PEDIDOS — Lista completa com filtro, detalhes e download
════════════════════════════════════ */
/* ════════════════════════════════════
   DETALHE DE 1 PEDIDO — visualização completa antes de decidir
════════════════════════════════════ */

export function gerarAlertas({ obras, trabalhadores, equips, pedidos, historico, manutencoes = [], cronogramas = {}, movEquip = [], ativos = [], abastecimentos = [] }) {
  const alertas = [];
  const agora = Date.now();

  // 1) Equipamentos quebrados há muito tempo
  equips.filter(e => e.status === "Quebrada").forEach(e => {
    const obra = obras.find(o => o.id === e.obraId);
    alertas.push({ id: `eq-${e.id}`, tipo: "Equipamento", icone: "🔧", titulo: `${e.nome} quebrada`, detalhe: `${obra?.nome || ""} • Cód: ${e.codigo}`, prio: "alta", color: RED, navegarPara: "equip_gestao" });
  });

  // 2) Pedidos aguardando há mais de 24h
  pedidos.filter(p => p.status === "Aguardando").forEach(p => {
    const idade = (agora - p.id) / (1000 * 60 * 60); // horas
    const itens = p.itens || [{ material: p.material, qtd: p.qtd }];
    const resumoItens = itens.length === 1 ? `${itens[0].material} — ${itens[0].qtd}` : `${itens.length} itens`;
    if (idade > 24) {
      alertas.push({ id: `ped-${p.id}`, tipo: "Pedido", icone: "📦", titulo: `Pedido pendente há ${Math.floor(idade / 24)} dia(s)`, detalhe: `${resumoItens} • ${p.obra}`, prio: "media", color: ORANGE, navegarPara: "pedidos", contextoId: p.id });
    } else {
      alertas.push({ id: `ped-${p.id}`, tipo: "Pedido", icone: "📦", titulo: `Pedido aguardando aprovação`, detalhe: `${resumoItens} • ${p.obra}`, prio: "baixa", color: BLUE, navegarPara: "pedidos", contextoId: p.id });
    }
  });

  // 3) Trabalhadores com muitas faltas (últimos 7 dias)
  const dias7 = ultimosDias(7);
  trabalhadores.forEach(t => {
    let faltas = 0;
    dias7.forEach(d => { if ((historico[d] || {})[t.id] === "Falta") faltas++; });
    if (faltas >= 3) {
      const obra = obras.find(o => o.id === t.obraId);
      alertas.push({ id: `falta-${t.id}`, tipo: "Frequência", icone: "⚠️", titulo: `${t.nome}: ${faltas} faltas em 7 dias`, detalhe: `${t.cargo} • ${obra?.nome || ""}`, prio: "alta", color: RED, navegarPara: "equipe", contextoId: t.id });
    }
  });

  // 4) ASO vencido ou próximo do vencimento
  trabalhadores.forEach(t => {
    if (!t.asoValidade) return;
    try {
      const validade = new Date(t.asoValidade);
      const hoje = new Date();
      const dias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
      if (dias < 0) {
        alertas.push({ id: `aso-${t.id}`, tipo: "ASO", icone: "🏥", titulo: `ASO de ${t.nome} VENCIDO`, detalhe: `Vencido há ${Math.abs(dias)} dia(s) • ${t.cargo}`, prio: "alta", color: RED, navegarPara: "aso", contextoId: t.id });
      } else if (dias <= 30) {
        alertas.push({ id: `aso-${t.id}`, tipo: "ASO", icone: "🏥", titulo: `ASO de ${t.nome} vence em ${dias} dia(s)`, detalhe: `${t.cargo}`, prio: "media", color: ORANGE, navegarPara: "aso", contextoId: t.id });
      }
    } catch (e) {}
  });

  // 5) Trabalhadores Inaptos
  trabalhadores.filter(t => t.asoStatus === "Inapto").forEach(t => {
    const obra = obras.find(o => o.id === t.obraId);
    alertas.push({ id: `inapto-${t.id}`, tipo: "ASO", icone: "❌", titulo: `${t.nome} está INAPTO`, detalhe: `${t.cargo} • ${obra?.nome || ""}`, prio: "alta", color: RED, navegarPara: "aso", contextoId: t.id });
  });

  // 6) Obras sem trabalhadores
  obras.filter(o => o.status === "Ativa").forEach(o => {
    const n = trabalhadores.filter(t => t.obraId === o.id).length;
    if (n === 0) alertas.push({ id: `obra-${o.id}`, tipo: "Obra", icone: "🏗️", titulo: `${o.nome} sem equipe`, detalhe: o.local, prio: "media", color: ORANGE, navegarPara: "obras", contextoId: o.id });
  });

  // 7) Sem registro de presença hoje
  const hoje = hojeStr();
  if (!historico[hoje] || Object.keys(historico[hoje]).length === 0) {
    if (trabalhadores.length > 0) alertas.push({ id: `pres-hoje`, tipo: "Presença", icone: "📅", titulo: "Sem registro de presença hoje", detalhe: "Encarregados ainda não confirmaram", prio: "alta", color: RED, navegarPara: "calendario" });
  }

  // 8) Manutenções atrasadas ou próximas
  const agoraD = new Date();
  manutencoes.filter(m => !m.realizada).forEach(m => {
    try {
      const d = new Date(m.proxData);
      const dias = Math.ceil((d - agoraD) / (1000 * 60 * 60 * 24));
      if (dias < 0) {
        alertas.push({ id: `man-${m.id}`, tipo: "Manutenção", icone: "🔧", titulo: `Manutenção atrasada (${Math.abs(dias)}d)`, detalhe: m.tipo, prio: "alta", color: RED, navegarPara: "manutencoes", contextoId: m.id });
      } else if (dias <= 7) {
        alertas.push({ id: `man-${m.id}`, tipo: "Manutenção", icone: "🔧", titulo: `Manutenção em ${dias}d`, detalhe: m.tipo, prio: "media", color: ORANGE, navegarPara: "manutencoes", contextoId: m.id });
      }
    } catch (e) {}
  });

  // 9) Etapas do cronograma atrasadas
  Object.entries(cronogramas || {}).forEach(([obraId, etapas]) => {
    const obra = obras.find(o => String(o.id) === String(obraId));
    if (!obra) return;
    (etapas || []).forEach(e => {
      if (e.progresso === 100) return;
      try {
        if (e.fim) {
          const fim = new Date(e.fim);
          const dias = Math.ceil((fim - agoraD) / (1000 * 60 * 60 * 24));
          if (dias < 0 && e.progresso < 100) {
            alertas.push({ id: `cron-${e.id}`, tipo: "Cronograma", icone: "📅", titulo: `${e.nome} atrasada ${Math.abs(dias)}d`, detalhe: `${obra.nome} • ${e.progresso || 0}% concluído`, prio: "alta", color: RED, navegarPara: "cronograma", contextoId: obraId });
          } else if (dias <= 7 && e.progresso < 80) {
            alertas.push({ id: `cron-${e.id}`, tipo: "Cronograma", icone: "📅", titulo: `${e.nome} vence em ${dias}d`, detalhe: `${obra.nome} • ${e.progresso || 0}% concluído`, prio: "media", color: ORANGE, navegarPara: "cronograma", contextoId: obraId });
          }
        }
      } catch (er) {}
    });
  });

  // 10) Empréstimos de equipamento atrasados/vencendo
  (movEquip || []).filter(m => m.status === "Aprovado" && m.tipo === "emprestimo" && m.prazo).forEach(m => {
    try {
      const fim = new Date(m.prazo);
      const dias = Math.ceil((fim - agoraD) / (1000 * 60 * 60 * 24));
      if (dias < 0) {
        alertas.push({ id: `me-${m.id}`, tipo: "Empréstimo", icone: "🔧", titulo: `${m.itemNome} não devolvido`, detalhe: `Atrasado ${Math.abs(dias)}d • ${m.obraDestinoNome}`, prio: "alta", color: RED, navegarPara: "mov_equip", contextoId: m.id });
      } else if (dias <= 2) {
        alertas.push({ id: `me-${m.id}`, tipo: "Empréstimo", icone: "🔧", titulo: `${m.itemNome} vence em ${dias}d`, detalhe: `Em ${m.obraDestinoNome}`, prio: "media", color: ORANGE, navegarPara: "mov_equip", contextoId: m.id });
      }
    } catch (e) {}
  });

  // 11) Movimentações aguardando aprovação (gestor precisa decidir)
  (movEquip || []).filter(m => m.status === "Aguardando").forEach(m => {
    alertas.push({ id: `mep-${m.id}`, tipo: "Aprovação", icone: "🔄", titulo: `Mov. de ${m.itemNome} aguardando`, detalhe: `${m.obraOrigemNome} → ${m.obraDestinoNome}`, prio: "media", color: ORANGE, navegarPara: "mov_equip", contextoId: m.id });
  });

  // 12) Veículos sem abastecer há muito tempo (>30 dias se está ativo)
  (ativos || []).filter(a => a.status === "Ativo" && a.tipo !== "Ferramenta").forEach(ativo => {
    const abasts = (abastecimentos || []).filter(x => x.ativoId === ativo.id);
    if (abasts.length === 0) return;
    const ultimaData = abasts
      .map(x => { try { const [d, m, y] = (x.data || "").split("/"); return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)); } catch { return null; } })
      .filter(Boolean)
      .sort((a, b) => b - a)[0];
    if (!ultimaData) return;
    const diasSemAbast = Math.floor((agoraD - ultimaData) / (1000 * 60 * 60 * 24));
    if (diasSemAbast > 30) {
      alertas.push({ id: `comb-${ativo.id}`, tipo: "Combustível", icone: "⛽", titulo: `${ativo.nome} sem abastecer ${diasSemAbast}d`, detalhe: ativo.tipo, prio: "media", color: ORANGE, navegarPara: "frota", contextoId: ativo.id });
    }
  });

  return alertas.sort((a, b) => ({ alta: 0, media: 1, baixa: 2 }[a.prio] - { alta: 0, media: 1, baixa: 2 }[b.prio]));
}


export function TelaAlertas({ obras, trabalhadores, equips, pedidos, historico, manutencoes, cronogramas, movEquip, ativos, abastecimentos, onBack, onNav }) {
  const alertas = gerarAlertas({ obras, trabalhadores, equips, pedidos, historico, manutencoes, cronogramas, movEquip, ativos, abastecimentos });
  const altas = alertas.filter(a => a.prio === "alta").length;
  const medias = alertas.filter(a => a.prio === "media").length;
  const baixas = alertas.length - altas - medias;
  const [filtro, setFiltro] = useState("todas");

  const visiveis = filtro === "todas" ? alertas : alertas.filter(a => a.prio === filtro);

  const irParaAlerta = (alerta) => {
    if (alerta.navegarPara && onNav) {
      onNav(alerta.navegarPara);
    } else {
      alert(`📋 ${alerta.titulo}\n\n${alerta.detalhe}`);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Alertas" sub={`${alertas.length} alerta(s) ativo(s)`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: T.fundo, padding: 14 }}>
        {alertas.length === 0 ? (
          <div style={{ background: T.superficie, borderRadius: 14, padding: 32, textAlign: "center", boxShadow: T.sombra }}>
            <div style={{ fontSize: 64 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: GREEN, marginTop: 12 }}>Tudo em ordem!</div>
            <div style={{ color: T.texto2, marginTop: 6, fontSize: 13 }}>Nenhum alerta no momento.</div>
          </div>
        ) : (
          <>
            {/* KPIs CLICÁVEIS — funcionam como filtro */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div onClick={() => setFiltro(filtro === "alta" ? "todas" : "alta")} style={{ flex: 1, background: filtro === "alta" ? RED : T.superficie, color: filtro === "alta" ? "#fff" : RED, border: `2px solid ${RED}`, borderRadius: 10, padding: "10px 6px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{altas}</div>
                <div style={{ fontSize: 10, fontWeight: 700 }}>🔴 ALTA</div>
              </div>
              <div onClick={() => setFiltro(filtro === "media" ? "todas" : "media")} style={{ flex: 1, background: filtro === "media" ? ORANGE : T.superficie, color: filtro === "media" ? "#fff" : ORANGE, border: `2px solid ${ORANGE}`, borderRadius: 10, padding: "10px 6px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{medias}</div>
                <div style={{ fontSize: 10, fontWeight: 700 }}>🟠 MÉDIA</div>
              </div>
              <div onClick={() => setFiltro(filtro === "baixa" ? "todas" : "baixa")} style={{ flex: 1, background: filtro === "baixa" ? BLUE : T.superficie, color: filtro === "baixa" ? "#fff" : BLUE, border: `2px solid ${BLUE}`, borderRadius: 10, padding: "10px 6px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{baixas}</div>
                <div style={{ fontSize: 10, fontWeight: 700 }}>🔵 BAIXA</div>
              </div>
            </div>
            {filtro !== "todas" && (
              <button onClick={() => setFiltro("todas")} style={{ width: "100%", padding: 8, background: NAVY, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 11, marginBottom: 10 }}>
                ✕ Limpar filtro (ver todas {alertas.length})
              </button>
            )}

            {/* Lista de alertas — cards clicáveis */}
            {visiveis.map(a => (
              <div key={a.id} onClick={() => irParaAlerta(a)} style={{ background: T.superficie, borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: T.sombra, borderLeft: `4px solid ${a.color}`, cursor: a.navegarPara ? "pointer" : "default" }}>
                <div style={{ fontSize: 26, marginRight: 12 }}>{a.icone}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: T.titulo, fontSize: 13 }}>{a.titulo}</div>
                  <div style={{ fontSize: 11, color: T.texto2, marginTop: 2 }}>{a.detalhe}</div>
                  {a.navegarPara && <div style={{ fontSize: 9, color: BLUE, marginTop: 3, fontWeight: 700 }}>👆 Toque pra resolver →</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Badge label={a.tipo} color={a.color} small />
                  {a.navegarPara && <span style={{ color: T.desabilitado, fontSize: 16 }}>›</span>}
                </div>
              </div>
            ))}

            {visiveis.length === 0 && (
              <div style={{ background: T.superficie, borderRadius: 12, padding: 20, textAlign: "center", color: T.texto3, fontSize: 12 }}>
                Nenhum alerta com prioridade {filtro}.
              </div>
            )}
          </>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   RELATÓRIO CONSOLIDADO (semana/mês)
════════════════════════════════════ */

export function TelaRelatorioConsolidado({ obras, trabalhadores, pedidos, historico, empresa, onBack }) {
  const [periodo, setPeriodo] = useState("semana");
  const [obraId, setObraId] = useState("todas");

  const dias = ultimosDias(periodo === "semana" ? 7 : 30);
  const trabFiltro = obraId === "todas" ? trabalhadores : trabalhadores.filter(t => String(t.obraId) === String(obraId));
  // Pedidos do período: só as solicitações ABERTAS dentro dos mesmos dias da frequência (pela data do pedido),
  // para tela e PDF contarem a mesma coisa. A situação (aprovado / aguardando / negado) é a atual de cada uma.
  const diasSet = new Set(dias);
  const pedidosObra = obraId === "todas" ? pedidos : pedidos.filter(p => String(p.obraId) === String(obraId));
  const pedidosFiltro = pedidosObra.filter(p => diasSet.has(diaDoPedido(p)));

  let totalP = 0, totalF = 0, totalA = 0;
  dias.forEach(d => {
    const pres = historico[d] || {};
    trabFiltro.forEach(t => {
      const s = pres[t.id];
      if (s === "Presente") totalP++;
      else if (s === "Falta") totalF++;
      else if (s === "Atestado") totalA++;
    });
  });

  const ranking = trabFiltro.map(t => {
    let p = 0, f = 0, a = 0;
    dias.forEach(d => {
      const s = (historico[d] || {})[t.id];
      if (s === "Presente") p++;
      else if (s === "Falta") f++;
      else if (s === "Atestado") a++;
    });
    // Taxa = presenças ÷ dias com chamada registrada para o colaborador (presenças + faltas + atestados).
    // Fins de semana, feriados e dias não lançados não entram no divisor; sem nenhuma chamada a taxa fica indefinida (null).
    const registros = p + f + a;
    return { ...t, presentes: p, faltas: f, atestados: a, registros, taxa: registros > 0 ? Math.round((p / registros) * 100) : null };
  }).sort((a, b) => (b.taxa ?? -1) - (a.taxa ?? -1) || b.presentes - a.presentes || String(a.nome || "").localeCompare(String(b.nome || "")));
  const semChamada = ranking.filter(t => t.taxa == null).length;

  const tituloPeriodo = periodo === "semana" ? "Últimos 7 dias" : "Últimos 30 dias";
  const nomeObra = obraId === "todas" ? "Todas as obras" : (obras.find(o => String(o.id) === String(obraId))?.nome || "");
  // Frequência média do período: presenças ÷ chamadas registradas (presenças + faltas + atestados);
  // quem não teve nenhuma chamada no período não entra na conta.
  const totalRegistros = totalP + totalF + totalA;
  const taxaGeral = totalRegistros > 0 ? Math.round((totalP / totalRegistros) * 100) : 0;

  const exportar = async () => {
    const emp = await empresaDoDocumento(empresa);
    const periodoTxt = dias.length ? `${tituloPeriodo} · ${fmtDiaMesAno(dias[0])} a ${fmtDiaMesAno(dias[dias.length - 1])}` : tituloPeriodo;
    const nomeDaObra = id => obras.find(o => String(o.id) === String(id))?.nome || "";
    // Cor da taxa: verde a partir de 80%, âmbar a partir de 50%, vermelho abaixo; cinza quando não houve chamada.
    const tomTaxa = taxa => (taxa == null ? "txt-cinza" : taxa >= 80 ? "txt-ok" : taxa >= 50 ? "txt-alerta" : "txt-erro");
    const txtTaxa = taxa => (taxa == null ? "—" : `${taxa}%`);
    const linhasRanking = ranking.length
      ? ranking.map((t, i) => `<tr>
          <td class="num">${i + 1}</td>
          <td><b>${escHTML(t.nome)}</b>${obraId === "todas" && nomeDaObra(t.obraId) ? `<span class="sub">${escHTML(nomeDaObra(t.obraId))}</span>` : ""}</td>
          <td>${escHTML(t.cargo || "—")}</td>
          <td class="num">${t.presentes}</td>
          <td class="num">${t.faltas}</td>
          <td class="num">${t.atestados}</td>
          <td class="num ${tomTaxa(t.taxa)}"><b>${txtTaxa(t.taxa)}</b></td>
        </tr>`).join("") + `<tr class="total"><td colspan="3">Total · ${trabFiltro.length} colaborador${trabFiltro.length === 1 ? "" : "es"}${semChamada ? ` (${semChamada} sem chamada no período)` : ""}</td><td class="num">${totalP}</td><td class="num">${totalF}</td><td class="num">${totalA}</td><td class="num">${totalRegistros > 0 ? `${taxaGeral}%` : "—"}</td></tr>`
      : `<tr><td class="vazio" colspan="7">Sem registros no período</td></tr>`;
    // Situação dos pedidos abertos no período (mesma lista da tela: pedidosFiltro)
    const contagem = {};
    pedidosFiltro.forEach(p => { const s = p.status || "Sem situação"; contagem[s] = (contagem[s] || 0) + 1; });
    const ordem = ["Aprovado", "Aguardando", "Negado"];
    const situacoes = [...ordem, ...Object.keys(contagem).filter(s => !ordem.includes(s)).sort((a, b) => a.localeCompare(b))];
    const pct = n => (pedidosFiltro.length ? Math.round((n / pedidosFiltro.length) * 100) : 0);
    const linhasPedidos = pedidosFiltro.length
      ? situacoes.map(s => `<tr><td>${seloHTML(s, TOM_PEDIDO[s])}</td><td class="num">${contagem[s] || 0}</td><td class="num">${pct(contagem[s] || 0)}%</td></tr>`).join("")
        + `<tr class="total"><td>Total</td><td class="num">${pedidosFiltro.length}</td><td class="num">100%</td></tr>`
      : `<tr><td class="vazio" colspan="3">Sem solicitações abertas no período</td></tr>`;
    const html = `<html><head><meta charset="UTF-8"><title>Relatório Consolidado - ${escHTML(tituloPeriodo)}</title>
      <style>
        ${KM_PDF_PAGE_CSS}
        ${KM_PDF_CSS}
        .sub { display: block; font-size: 7pt; font-weight: 400; color: #5c6b73; margin-top: 1px; }
      </style></head><body>
      ${gerarHeaderHTML({ tipo: "Relatório Consolidado", periodo: periodoTxt, subtitulo: "Frequência e pedidos de material", info_extra: nomeObra, empresa: emp })}
      <div class="sec">1. Resumo do período <small>${dias.length} dias corridos · ${trabFiltro.length} colaborador${trabFiltro.length === 1 ? "" : "es"}${semChamada ? ` (${semChamada} sem chamada)` : ""} · ${totalRegistros} chamada${totalRegistros === 1 ? "" : "s"} registrada${totalRegistros === 1 ? "" : "s"} · ${escHTML(nomeObra)}</small></div>
      <div class="kpis">
        <div class="kpi ok"><b>${totalP}</b><span>Presenças</span></div>
        <div class="kpi erro"><b>${totalF}</b><span>Faltas</span></div>
        <div class="kpi alerta"><b>${totalA}</b><span>Atestados</span></div>
        <div class="kpi"><b>${totalRegistros > 0 ? `${taxaGeral}%` : "—"}</b><span>Frequência média</span></div>
      </div>
      <div class="sec">2. Ranking de frequência <small>por colaborador, da maior taxa para a menor</small></div>
      <table class="quadro"><thead><tr>
        <th style="width:5%" class="num">Nº</th><th style="width:32%">Nome</th><th style="width:27%">Cargo</th>
        <th style="width:10%" class="num">Presenças</th><th style="width:9%" class="num">Faltas</th><th style="width:10%" class="num">Atestados</th><th style="width:7%" class="num">Taxa</th>
      </tr></thead>
      <tbody>${linhasRanking}</tbody></table>
      <div class="nota">Taxa = presenças ÷ dias com chamada registrada para o colaborador (presenças + faltas + atestados); fins de semana, feriados e dias sem chamada não entram na conta. Verde a partir de 80%, âmbar a partir de 50%, vermelho abaixo. Colaborador sem nenhuma chamada no período aparece com "—" e não entra na frequência média. Presença, falta e atestado conforme a chamada diária registrada no sistema.</div>
      <div class="junto"><!-- quadro curto: vai inteiro para a página seguinte em vez de ser dividido -->
      <div class="sec">3. Pedidos de material <small>solicitações abertas de ${dias.length ? `${fmtDiaMesAno(dias[0])} a ${fmtDiaMesAno(dias[dias.length - 1])}` : escHTML(tituloPeriodo.toLowerCase())} · ${escHTML(nomeObra)}</small></div>
      <table class="quadro"><thead><tr><th style="width:50%">Situação</th><th style="width:25%" class="num">Pedidos</th><th style="width:25%" class="num">% do total</th></tr></thead>
      <tbody>${linhasPedidos}</tbody></table>
      <div class="nota">Conta cada solicitação de material pela data em que foi aberta no sistema, dentro do mesmo período da frequência; a situação (aprovado, aguardando, negado) é a atual de cada pedido. Solicitações de outros períodos não entram.</div>
      </div>
      ${gerarFooterHTML({ empresa: emp, documento: "Relatório Consolidado" })}
      </body></html>`;
    abrirOuBaixarHTML(html, `Consolidado-${tituloPeriodo.replace(/\s/g, "_")}.html`, { empresa: emp });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Relatório Consolidado" sub={tituloPeriodo} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: T.fundo, padding: 14 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <select value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ ...selS, flex: 1, marginBottom: 0 }}>
            <option value="semana">Última semana</option>
            <option value="mes">Último mês</option>
          </select>
          <select value={obraId} onChange={e => setObraId(e.target.value)} style={{ ...selS, flex: 1, marginBottom: 0 }}>
            <option value="todas">Todas as obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, background: GREEN, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{totalP}</div>
            <div style={{ fontSize: 10 }}>Presenças</div>
          </div>
          <div style={{ flex: 1, background: RED, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{totalF}</div>
            <div style={{ fontSize: 10 }}>Faltas</div>
          </div>
          <div style={{ flex: 1, background: ORANGE, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{totalA}</div>
            <div style={{ fontSize: 10 }}>Atestados</div>
          </div>
        </div>

        <div style={{ background: T.superficie, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: T.sombra }}>
          <div style={{ fontWeight: 800, color: T.titulo, marginBottom: 10, fontSize: 14 }}>🏆 Ranking de Frequência</div>
          {ranking.length === 0 && <div style={{ color: T.texto3, fontSize: 13 }}>Sem dados.</div>}
          {ranking.map((t, i) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: i < ranking.length - 1 ? `1px solid ${T.borda}` : "none" }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: i === 0 ? GOLD : i === 1 ? "#cbd5e1" : i === 2 ? "#e29361" : T.superficie2, color: i < 3 ? "#fff" : T.texto2, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, marginRight: 10 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: T.titulo, fontWeight: 600 }}>{t.nome}</div>
                <div style={{ fontSize: 10, color: T.texto2 }}>{t.cargo}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: t.taxa == null ? T.texto3 : t.taxa >= 80 ? GREEN : t.taxa >= 50 ? ORANGE : RED }}>{t.taxa == null ? "—" : `${t.taxa}%`}</div>
                <div style={{ fontSize: 9, color: T.texto2 }}>{t.taxa == null ? "sem chamada" : `${t.presentes}P / ${t.faltas}F`}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: T.superficie, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: T.sombra }}>
          <div style={{ fontWeight: 800, color: T.titulo, fontSize: 14 }}>📦 Pedidos no Período</div>
          <div style={{ fontSize: 11, color: T.texto2, marginBottom: 10 }}>Solicitações abertas nos {tituloPeriodo.toLowerCase()} · situação atual de cada uma</div>
          <div style={{ display: "flex", gap: 6, fontSize: 12, color: T.texto2 }}>
            <span style={{ background: T.infoFundo, padding: "4px 10px", borderRadius: 8, fontWeight: 700, color: T.titulo }}>Total: {pedidosFiltro.length}</span>
            <span style={{ background: T.sucessoFundo, padding: "4px 10px", borderRadius: 8, fontWeight: 700, color: GREEN }}>✓ {pedidosFiltro.filter(p => p.status === "Aprovado").length}</span>
            <span style={{ background: T.erroFundo, padding: "4px 10px", borderRadius: 8, fontWeight: 700, color: RED }}>✕ {pedidosFiltro.filter(p => p.status === "Negado").length}</span>
            <span style={{ background: T.avisoFundo, padding: "4px 10px", borderRadius: 8, fontWeight: 700, color: ORANGE }}>⏳ {pedidosFiltro.filter(p => p.status === "Aguardando").length}</span>
          </div>
        </div>

        <Btn label="📤 Exportar PDF" color={NAVY} onClick={exportar} />
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   ATIVOS / FROTA (retroescavadeiras, caminhões)
════════════════════════════════════ */
