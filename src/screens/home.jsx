import { TabelaResumoEquipe } from "./equipe.jsx";
import { gerarSolicitacaoPedidoPDF } from "./suprimentos.jsx";
import { useState, useEffect, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { loginFirebase, logoutFirebase, observarAutenticacao, recuperarSenha, atualizarSenha, usuarioAtual } from "../firebase.js";
import { NAVY, NAVY2, GOLD, GREEN, RED, ORANGE, BLUE, LIGHT, labelS, inputS, dateS, selS, bigBtn, css } from "../theme.js";
import { hojeStr, fmtData, ultimosDias, dataPascoa, feriadosDoAno, feriadoEm } from "../utils.js";
import { EMPRESA_ID, cloudRefs, enviarFotoNuvem, observarFotosNuvem, semUndefined, enviarDocNuvem, removerDocNuvem, observarColecaoNuvem, store } from "../lib/store.js";
import { FILE_DB_NAME, FILE_DB_VERSION, FILE_STORE_NAME, openFileDB, fileStore, lerArquivoComoBase64, formatarTamanhoBytes, iconePorTipoArquivo } from "../lib/fileStore.js";
import { carregarScript, carregarPDFLibs, KM_PDF_PAGE_CSS, KM_PDF_CSS, gerarHeaderHTML, gerarFooterHTML, gerarAssinaturasHTML, fmtQtd, abrirOuBaixarHTML } from "../lib/pdf.js";
import { DEFAULT_FORNECEDORES, DEFAULT_OBRAS, DEFAULT_TRABALHADORES, gerarDadosMes30Dias, DEFAULT_EQUIPS, CARGOS, detectarUnidade, CATALOGO_KM_FULL, CAT_KM_BUSCA, CAT_KM_CATEGORIAS, CAT_KM_SUBCATEGORIAS, MATERIAIS_BANCO_DETALHADO, MATERIAIS_BANCO, MATERIAIS, CATALOGO_FROTA, CATALOGO_FROTA_NOMES, CATALOGO_EQUIPAMENTOS, CATALOGO_EQUIPAMENTOS_NOMES, MATERIAL_INFO, EQUIP_COLOR, STATUS_COLOR, DEFAULT_USUARIOS, EMPRESA_PADRAO, DEFAULT_FUNC_ESCRITORIO, DEFAULT_ATIVOS, VALOR_HORA_CARGO } from "../data/catalogos.js";
import { Badge, Btn, EmptyState, KMHeader, KMFooter, FotoViewer, Modal, confirmar, Assinatura } from "../components/ui.jsx";

export function TelaHome({ obra, usuario, mensagens, trabalhadores, presencasHoje, onNav, onLogout }) {
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
            <button onClick={() => onNav("mensagens")} style={{ position: "relative", background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 18, width: 36, height: 36, cursor: "pointer", fontSize: 16 }}>
              💬
              {novasMsgs > 0 && <span style={{ position: "absolute", top: -2, right: -2, background: RED, color: "#fff", borderRadius: 10, padding: "1px 5px", fontSize: 9, fontWeight: 800 }}>{novasMsgs}</span>}
            </button>
            <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Sair</button>
          </div>
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>Obra: {obra?.nome}</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ marginBottom: 14 }} className="km-card-anim">
          <div style={{ fontSize: 22, fontWeight: 800, color: NAVY }}>
            {emojiSaudacao} {saudacao}, {usuario?.nome?.split(" ")[0] || "Marcos"}!
          </div>
          <div style={{ fontSize: 13, color: "#888" }}>Encarregado • {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</div>
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
          <button onClick={() => onNav("produtividade")} style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 14, padding: "14px 8px", cursor: "pointer", textAlign: "center", boxShadow: "0 4px 14px #16a34a44" }}>
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
        <div style={{ background: "#fff", borderRadius: 14, padding: "12px 14px", marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Resumo de Hoje</span>
            <span style={{ fontSize: 9, color: "#888", fontStyle: "italic" }}>👆 toque pra ver detalhes</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ v: presentes, l: "Presentes", c: GREEN, dest: "fluxo" }, { v: faltas, l: "Faltas", c: RED, dest: "fluxo" }, { v: atestados, l: "Atestados", c: ORANGE, dest: "fluxo" }].map(s => (
              <div key={s.l} onClick={() => onNav(s.dest)} style={{ flex: 1, textAlign: "center", background: LIGHT, borderRadius: 10, padding: "8px 4px", cursor: "pointer", border: `1px solid ${s.c}33` }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 10, color: "#666" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div onClick={() => onNav("equipe")} style={{ background: "#fff", borderRadius: 14, padding: "12px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", cursor: "pointer" }}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Equipe da Obra ({trabalhadores.length})</span>
            <span style={{ color: "#bbb", fontSize: 16 }}>›</span>
          </div>
          {trabalhadores.slice(0, 3).map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 8 }}>👷</div>
              <div style={{ flex: 1, fontSize: 13, color: NAVY, fontWeight: 600 }}>{t.nome}</div>
              <div style={{ fontSize: 11, color: "#888" }}>{t.cargo}</div>
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

export function TelaPainelGestor({ obras, trabalhadores, pedidos, equips, historico, mensagens, movimentacoes, manutencoes, cronogramas, movEquip, ativos, abastecimentos, empresa, usuario, onNav, onLogout, onAprovar, onNegar }) {
  const pendentes = pedidos.filter(p => p.status === "Aguardando").length;
  const movPendentes = (movimentacoes || []).filter(m => m.status === "Aguardando").length;
  const movEquipPendentes = (movEquip || []).filter(m => m.status === "Aguardando").length;
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const pedidosFiltrados = filtroStatus === "todos" ? pedidos : pedidos.filter(p => p.status === filtroStatus);
  const totalAlertas = gerarAlertas({ obras, trabalhadores, equips, pedidos, historico, manutencoes, cronogramas, movEquip, ativos, abastecimentos }).length;
  const novasMsgs = mensagens?.filter(m => !m.lida && m.para === usuario?.id).length || 0;

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

  // Categorias do menu — ordenadas por uso/importância
  const categorias = [
    {
      titulo: "📋 Operação Diária",
      cor: GOLD,
      desc: "Relatórios, presenças e custos",
      itens: [
        { icon: "📄", l: "RDO ABNT",      nav: "rdo",         c: GOLD,         destaque: true },
        { icon: "📦", l: "Pedidos",       nav: "pedidos",     c: pendentes > 0 ? RED : "#0891b2", badge: pendentes },
        { icon: "💵", l: "Custos/Obra",   nav: "custos",      c: "#16a34a" },
        { icon: "💸", l: "Desp. Avulsas", nav: "despesas",    c: "#ea580c" },
        { icon: "📷", l: "Galeria Fotos", nav: "galeria",     c: "#7c3aed" },
        { icon: "📊", l: "Dashboard",     nav: "dashboard",   c: "#0d9488" },
        { icon: "📅", l: "Calendário",    nav: "calendario",  c: "#7c3aed" },
        { icon: "🗺️", l: "Mapa Obras",   nav: "mapa",        c: "#16a34a" },
        { icon: "🚨", l: "Alertas",       nav: "alertas",     c: totalAlertas > 0 ? RED : "#9ca3af", badge: totalAlertas },
      ],
    },
    {
      titulo: "👥 Recursos Humanos",
      cor: BLUE,
      desc: "Equipe, folha e gestão de pessoas",
      itens: [
        { icon: "💰", l: "Folha de Pagamento", nav: "folha_quinzenal", c: "#15803d" },
        { icon: "📋", l: "Histórico Folhas", nav: "hist_folha",      c: "#059669" },
        { icon: "💸", l: "Adiantamentos",   nav: "adiantamentos",   c: "#ea580c" },
        { icon: "🔄", l: "Movimentações",   nav: "aprovar_mov",     c: movPendentes > 0 ? RED : "#0e7490", badge: movPendentes },
        { icon: "👥", l: "Equipe",          nav: "equipe",          c: BLUE },
        { icon: "📋", l: "Fichas",          nav: "ficha",           c: ORANGE },
        { icon: "📞", l: "Contatos",        nav: "contatos",        c: "#0284c7" },
        { icon: "🏥", l: "Exames (ASO)",    nav: "exames",          c: "#dc2626" },
        { icon: "🎂", l: "Aniv. / EPI",     nav: "rh",              c: "#f59e0b" },
        { icon: "🌴", l: "Férias",          nav: "ferias",          c: "#0e7490" },
        { icon: "💵", l: "Folha Mensal",    nav: "folha",           c: "#059669" },
      ],
    },
    {
      titulo: "🏗️ Obras & Recursos",
      cor: NAVY,
      desc: "Obras, máquinas e materiais",
      itens: [
        { icon: "🏗️", l: "Obras",          nav: "obras",         c: NAVY },
        { icon: "📅", l: "Cronograma",      nav: "cronograma",    c: "#7c3aed" },
        { icon: "🎯", l: "Cronograma Pro",  nav: "cronograma_pro", c: "#5b21b6" },
        { icon: "🔄", l: "Mov. Equip.",      nav: "mov_equip",     c: movEquipPendentes > 0 ? RED : "#0e7490", badge: movEquipPendentes },
        { icon: "🚜", l: "Ativos/Frota",    nav: "ativos",        c: "#ea580c" },
        { icon: "⛽", l: "Combustível",     nav: "frota",         c: "#dc7e00" },
        { icon: "🔧", l: "Manutenções",     nav: "manutencao",    c: "#dc2626" },
        { icon: "⚙️", l: "Equipamentos",   nav: "equip_gestao",  c: "#475569" },
        { icon: "🔨", l: "Ferramentas",     nav: "ferramentas",   c: "#7c2d12" },
        { icon: "🏪", l: "Fornecedores",    nav: "fornecedores",  c: "#16a34a" },
        { icon: "📥", l: "Recebimentos",    nav: "recebimento",   c: "#0891b2" },
      ],
    },
    {
      titulo: "📈 Análise & Comunicação",
      cor: "#a855f7",
      desc: "Relatórios e mensagens",
      itens: [
        { icon: "📐", l: "Produtividade",   nav: "produtividade", c: "#15803d" },
        { icon: "📈", l: "Consolidado",     nav: "consolidado",   c: "#a855f7" },
        { icon: "📓", l: "Diário Obra",     nav: "diario",        c: "#2563eb" },
        { icon: "💬", l: "Mensagens",       nav: "mensagens",     c: "#db2777", badge: novasMsgs },
      ],
    },
    {
      titulo: "⚙️ Sistema",
      cor: "#475569",
      desc: "Configurações e segurança",
      itens: [
        { icon: "👤", l: "Minha Conta",   nav: "minha_conta", c: "#0891b2" },
        { icon: "🆘", l: "Ajuda & Suporte", nav: "ajuda", c: "#16a34a" },
        { icon: "🔗", l: "Links Úteis",   nav: "links",   c: "#0284c7" },
        { icon: "🔑", l: "Usuários e Permissões", nav: "acessos", c: "#0891b2" },
        { icon: "🏢", l: "Empresa",       nav: "empresa", c: "#334155" },
        { icon: "💾", l: "Exportar Dados",        nav: "backup",  c: "#6b7280" },
        // Itens abaixo só aparecem para o desenvolvedor (Kleber)
        ...(usuario?.email === "kvmprojetos@gmail.com" ? [
          { icon: "🔧", l: "Painel Técnico",  nav: "diagnostico", c: "#dc2626" },
          { icon: "🎬", l: "Popular Demo",  nav: "gerar_simulacao", c: "#7c3aed" },
          { icon: "🧹", l: "Limpar Banco",    nav: "zerar_tudo", c: "#dc2626" },
        ] : []),
      ],
    },
  ];

  // Total de avisos pra mostrar no resumo
  const totalAvisos = totalAlertas + movPendentes + pendentes + novasMsgs;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader right={
        <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Sair</button>
      } />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {/* Saudação */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "12px 14px", marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 12, color: "#888" }}>Painel do Gestor</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>{usuario?.nome || "Gestor"}</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>

        {/* Stats rápidas — CLICÁVEIS */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div onClick={() => onNav("obras")} style={{ flex: 1, background: BLUE, borderRadius: 12, padding: "10px 6px", textAlign: "center", cursor: "pointer", boxShadow: `0 3px 10px ${BLUE}40` }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{obras.filter(o => o.status === "Ativa").length}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)" }}>🏗️ Obras</div>
          </div>
          <div onClick={() => onNav("equipe")} style={{ flex: 1, background: ORANGE, borderRadius: 12, padding: "10px 6px", textAlign: "center", cursor: "pointer", boxShadow: `0 3px 10px ${ORANGE}40` }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{trabalhadores.length}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)" }}>👥 Equipe</div>
          </div>
          <div onClick={() => onNav("alertas")} style={{ flex: 1, background: totalAvisos > 0 ? RED : GREEN, borderRadius: 12, padding: "10px 6px", textAlign: "center", cursor: "pointer", boxShadow: `0 3px 10px ${totalAvisos > 0 ? RED + "40" : GREEN + "40"}` }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{totalAvisos}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)" }}>🚨 Avisos</div>
          </div>
        </div>

        {/* Atalhos rápidos (4 mais usados) */}
        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>⚡ Acesso Rápido</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
          {[
            { icon: "📄", l: "RDO ABNT",       nav: "rdo",           c: GOLD },
            { icon: "💰", l: "Folha de Pagamento", nav: "folha_quinzenal", c: "#15803d" },
            { icon: "📋", l: "Cadastrar Ficha", nav: "ficha",         c: ORANGE },
            { icon: "🚨", l: "Alertas",         nav: "alertas",       c: totalAlertas > 0 ? RED : "#9ca3af", badge: totalAlertas },
          ].map(b => (
            <button key={b.nav} onClick={() => onNav(b.nav)} style={{ background: b.c, color: "#fff", border: "none", borderRadius: 14, padding: "16px 8px", cursor: "pointer", textAlign: "center", boxShadow: `0 4px 14px ${b.c}55`, position: "relative" }}>
              <div style={{ fontSize: 32 }}>{b.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4 }}>{b.l}</div>
              {b.badge > 0 && <div style={{ position: "absolute", top: 6, right: 8, background: "#fff", color: RED, borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 800 }}>{b.badge}</div>}
            </button>
          ))}
        </div>

        {/* TABELA RESUMO DA EQUIPE — padrão elite */}
        <TabelaResumoEquipe obras={obras} trabalhadores={trabalhadores} historico={historico} onNav={onNav} />

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
            color: NAVY,
            textTransform: "uppercase",
            letterSpacing: 1.5,
            fontWeight: 800,
          }}>Todas as Funções</div>
          <div style={{
            flex: 1,
            height: 1,
            background: "linear-gradient(90deg, rgba(15,33,81,0.15) 0%, transparent 100%)",
          }} />
          <div style={{ fontSize: 10, color: "#888", fontWeight: 600 }}>
            {categorias.length} categorias
          </div>
        </div>
        {categorias.map((cat, idx) => (
          <CategoriaCard key={idx} categoria={cat} onNav={onNav} />
        ))}

        {/* Pedidos pendentes resumo */}
        {pendentes > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              📦 Pedidos Aguardando Aprovação
              <span style={{ background: RED, color: "#fff", borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>{pendentes}</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "#888", fontStyle: "italic" }}>👆 toque pra ver</span>
            </div>
            {pedidos.filter(p => p.status === "Aguardando").slice(0, 3).map(p => {
              const itens = p.itens || [{ material: p.material, qtd: p.qtd }];
              return (
                <div key={p.id} onClick={() => onNav("pedidos")} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer", transition: "all 0.2s", borderLeft: `4px solid ${ORANGE}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{p.obra}</div>
                      <div style={{ fontSize: 10, color: "#888" }}>👷 {p.enc} • {p.data} • <b style={{ color: NAVY }}>{itens.length} {itens.length === 1 ? "item" : "itens"}</b></div>
                      <div style={{ marginTop: 6, background: "#f9fafb", borderRadius: 6, padding: "6px 8px" }}>
                        {itens.slice(0, 3).map((it, i) => (
                          <div key={i} style={{ fontSize: 11, color: "#444" }}>• <b>{it.material}</b> — <span style={{ color: GREEN, fontWeight: 700 }}>{it.qtd}</span></div>
                        ))}
                        {itens.length > 3 && <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>+ {itens.length - 3} item(ns)...</div>}
                      </div>
                      {p.obsGeral && <div style={{ fontSize: 10, color: "#888", fontStyle: "italic", marginTop: 4 }}>📝 {p.obsGeral}</div>}
                    </div>
                    <span style={{ color: "#bbb", fontSize: 16 }}>›</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => onNegar(p.id)} style={{ flex: 1, padding: 8, borderRadius: 8, border: "none", background: RED, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 11 }}>✕ NEGAR</button>
                    <button onClick={() => abrirAprovacao(p)} style={{ flex: 2, padding: 8, borderRadius: 8, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 11 }}>✓ APROVAR</button>
                  </div>
                </div>
              );
            })}
            {pendentes > 3 && (
              <button onClick={() => onNav("pedidos")} style={{ width: "100%", padding: 10, borderRadius: 10, border: `1.5px solid ${NAVY}`, background: "#fff", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                Ver todos os {pendentes} pedidos →
              </button>
            )}
          </div>
        )}
      </div>
      <KMFooter />

      {/* MODAL APROVAÇÃO COM PAGAMENTO E PRAZO */}
      <Modal show={!!pedidoAprovando} title="✓ Aprovar Pedido" onClose={() => setPedidoAprovando(null)}>
        {pedidoAprovando && (() => {
          const itens = pedidoAprovando.itens || [{ material: pedidoAprovando.material, qtd: pedidoAprovando.qtd }];
          const obraDoPedido = obras.find(o => o.id === pedidoAprovando.obraId);
          return (
            <>
              <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "10px 12px", marginBottom: 12, borderLeft: `3px solid ${GREEN}` }}>
                <div style={{ fontSize: 11, color: "#166534", fontWeight: 700, marginBottom: 4 }}>📋 Pedido</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{pedidoAprovando.obra}</div>
                <div style={{ fontSize: 10, color: "#666", marginBottom: 6 }}>👷 {pedidoAprovando.enc} • {pedidoAprovando.data}</div>
                {itens.map((it, i) => (
                  <div key={i} style={{ fontSize: 11, color: "#444", paddingLeft: 8 }}>{i + 1}) <b>{it.material}</b> — <span style={{ color: GREEN, fontWeight: 700 }}>{it.qtd}</span></div>
                ))}
              </div>

              <div style={{ background: "#fef9e7", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 11, color: "#8b6f00" }}>
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
                <div style={{ background: "#fef2f2", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 11, color: RED }}>
                  ⚠️ Atenção: a obra <b>{pedidoAprovando.obra}</b> ainda não tem endereço completo cadastrado. Edite a obra para incluir endereço de entrega.
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setPedidoAprovando(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#eee", color: NAVY, fontWeight: 800, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
                <button onClick={confirmarAprovacao} style={{ flex: 2, padding: 12, borderRadius: 10, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 13 }}>✓ Aprovar Pedido</button>
              </div>
            </>
          );
        })()}
      </Modal>
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
      background: "#fff",
      borderRadius: 14,
      marginBottom: 10,
      overflow: "hidden",
      boxShadow: aberto ? `0 4px 20px ${corRGBA(categoria.cor, 0.18)}` : "0 2px 8px rgba(0,0,0,0.06)",
      transition: "all 0.25s ease",
      border: aberto ? `1.5px solid ${corRGBA(categoria.cor, 0.3)}` : "1.5px solid transparent",
    }}>
      <button onClick={() => setAberto(!aberto)} style={{
        width: "100%",
        padding: "14px 16px",
        border: "none",
        background: aberto
          ? `linear-gradient(90deg, ${corRGBA(categoria.cor, 0.08)} 0%, transparent 100%)`
          : "#fff",
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
          <div style={{ fontWeight: 800, color: NAVY, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
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
          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
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
                  background: "#fff",
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

export function TelaRelatorio({ obras, trabalhadores, pedidos, presencasHoje, onBack }) {
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
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <select value={obraId} onChange={e => setObraId(parseInt(e.target.value))} style={{ ...selS, marginBottom: 14 }}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>👷 Mão de Obra</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, textAlign: "center", background: "#f0fdf4", borderRadius: 10, padding: "8px 4px" }}><div style={{ fontSize: 18, fontWeight: 900, color: GREEN }}>{presentes}</div><div style={{ fontSize: 10, color: "#666" }}>Presentes</div></div>
            <div style={{ flex: 1, textAlign: "center", background: "#fef2f2", borderRadius: 10, padding: "8px 4px" }}><div style={{ fontSize: 18, fontWeight: 900, color: RED }}>{faltas}</div><div style={{ fontSize: 10, color: "#666" }}>Faltas</div></div>
            <div style={{ flex: 1, textAlign: "center", background: "#fff8f0", borderRadius: 10, padding: "8px 4px" }}><div style={{ fontSize: 18, fontWeight: 900, color: ORANGE }}>{trab.length - presentes - faltas}</div><div style={{ fontSize: 10, color: "#666" }}>Atestados</div></div>
          </div>
          {trab.map((t, i, arr) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", paddingBottom: 6, marginBottom: 6, borderBottom: i < arr.length - 1 ? "1px solid #f0f0f0" : "none" }}>
              <span style={{ fontSize: 14, marginRight: 8 }}>{presencasHoje[t.id] === "Presente" ? "✅" : presencasHoje[t.id] === "Falta" ? "❌" : "📋"}</span>
              <span style={{ flex: 1, fontSize: 13, color: NAVY }}>{t.nome} — {t.cargo}</span>
              <Badge label={presencasHoje[t.id] || "—"} color={STATUS_COLOR[presencasHoje[t.id]] || "#888"} small />
            </div>
          ))}
          {trab.length === 0 && <div style={{ color: "#aaa", fontSize: 13 }}>Sem trabalhadores.</div>}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>⚙️ Equipamentos</div>
          {equips.map(eq => (
            <div key={eq.id} style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 22, marginRight: 10 }}>{eq.icon}</span>
              <span style={{ flex: 1, fontSize: 14, color: NAVY }}>{eq.nome}</span>
              <Badge label={eq.status} color={EQUIP_COLOR[eq.status]} small />
            </div>
          ))}
        </div>

        {pedidosObra.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📦 Pedidos de Material</div>
            {pedidosObra.map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ fontSize: 13, color: NAVY }}>{p.material} — {fmtQtd(p.qtd)}</div>
                <Badge label={p.status} color={p.status === "Aprovado" ? GREEN : p.status === "Negado" ? RED : ORANGE} small />
              </div>
            ))}
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📷 Fotos da Obra</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {["🏗️", "🧱", "🔨"].map((f, i) => (
              <div key={i} style={{ background: "#dde6f5", borderRadius: 10, height: 68, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>{f}</div>
            ))}
          </div>
        </div>

        <Btn label="📤 Exportar Relatório PDF" color={NAVY} onClick={() => {
          const html = `
            <html><head><title>Relatório ${obra?.nome} - ${hoje}</title>
            <style>
              body{font-family:Arial,sans-serif;padding:30px;color:#222;}
              h1{color:${NAVY};border-bottom:3px solid ${GOLD};padding-bottom:8px;}
              h2{color:${NAVY};margin-top:24px;}
              table{width:100%;border-collapse:collapse;margin:10px 0;}
              th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px;}
              th{background:${NAVY};color:#fff;}
              .badge{display:inline-block;padding:3px 8px;border-radius:10px;color:#fff;font-size:11px;font-weight:bold;}
              .footer{margin-top:40px;text-align:center;color:#888;font-size:11px;border-top:1px solid #ddd;padding-top:10px;}
            </style></head><body>
              <h1>📋 Relatório Diário — ${obra?.nome || ""}</h1>
              <p><b>Data:</b> ${hoje} &nbsp;|&nbsp; <b>Local:</b> ${obra?.local || ""}</p>
              <h2>👷 Mão de Obra</h2>
              <table><tr><th>Trabalhador</th><th>Cargo</th><th>Status</th></tr>
              ${trab.map(t => `<tr><td>${t.nome}</td><td>${t.cargo}</td><td><span class="badge" style="background:${STATUS_COLOR[presencasHoje[t.id]] || "#888"}">${presencasHoje[t.id] || "—"}</span></td></tr>`).join("")}
              </table>
              <p><b>Resumo:</b> ${presentes} Presentes • ${faltas} Faltas • ${trab.length - presentes - faltas} Atestados/Sem registro</p>
              <h2>⚙️ Equipamentos</h2>
              <table><tr><th>Equipamento</th><th>Código</th><th>Status</th></tr>
              ${equips.map(eq => `<tr><td>${eq.nome}</td><td>${eq.codigo}</td><td><span class="badge" style="background:${EQUIP_COLOR[eq.status]}">${eq.status}</span></td></tr>`).join("")}
              </table>
              ${pedidosObra.length > 0 ? `
                <h2>📦 Pedidos de Material</h2>
                <table><tr><th>Pedido Nº</th><th>Material</th><th>Quantidade</th><th>Status</th></tr>
                ${pedidosObra.map(p => `<tr><td><b>${String(p.id).slice(-6)}</b></td><td>${p.material}</td><td>${fmtQtd(p.qtd)}</td><td><span class="badge" style="background:${p.status === "Aprovado" ? GREEN : p.status === "Negado" ? RED : ORANGE}">${p.status}</span></td></tr>`).join("")}
                </table>
              ` : ""}
              <div class="footer"><b>KM ZERO</b> — Gestão de Obras &nbsp;|&nbsp; KM Consultoria e Serviços &nbsp;|&nbsp; Gerado em ${new Date().toLocaleString("pt-BR")}</div>
              <script>window.onload=()=>{setTimeout(()=>window.print(),300);}</script>
            </body></html>`;
          abrirOuBaixarHTML(html, `Relatorio-${(obra?.nome || "obra").replace(/[^a-z0-9]/gi, "_").substring(0, 25)}-${hoje.replace(/\//g, "-")}.html`);
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
      <KMHeader title="Dashboard" sub="Visão geral" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <select value={obraId} onChange={e => setObraId(e.target.value)} style={{ ...selS, marginBottom: 14 }}>
          <option value="todas">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📊 Presenças (últimos 7 dias)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dadosPresenca}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="Presentes" fill={GREEN} />
              <Bar dataKey="Faltas" fill={RED} />
              <Bar dataKey="Atestados" fill={ORANGE} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {dadosPedidos.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📦 Status dos Pedidos</div>
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
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>👥 Distribuição por Cargo</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dadosCargos} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                <Tooltip />
                <Bar dataKey="qtd" fill={BLUE} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>💰 Folha Total (mês)</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: GREEN }}>
            R$ {trabFiltro.reduce((s, t) => s + (parseFloat(t.salario) || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Soma dos salários base de {trabFiltro.length} trabalhador(es)</div>
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
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {alertas.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: 32, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 64 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: GREEN, marginTop: 12 }}>Tudo em ordem!</div>
            <div style={{ color: "#666", marginTop: 6, fontSize: 13 }}>Nenhum alerta no momento.</div>
          </div>
        ) : (
          <>
            {/* KPIs CLICÁVEIS — funcionam como filtro */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div onClick={() => setFiltro(filtro === "alta" ? "todas" : "alta")} style={{ flex: 1, background: filtro === "alta" ? RED : "#fff", color: filtro === "alta" ? "#fff" : RED, border: `2px solid ${RED}`, borderRadius: 10, padding: "10px 6px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{altas}</div>
                <div style={{ fontSize: 10, fontWeight: 700 }}>🔴 ALTA</div>
              </div>
              <div onClick={() => setFiltro(filtro === "media" ? "todas" : "media")} style={{ flex: 1, background: filtro === "media" ? ORANGE : "#fff", color: filtro === "media" ? "#fff" : ORANGE, border: `2px solid ${ORANGE}`, borderRadius: 10, padding: "10px 6px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{medias}</div>
                <div style={{ fontSize: 10, fontWeight: 700 }}>🟠 MÉDIA</div>
              </div>
              <div onClick={() => setFiltro(filtro === "baixa" ? "todas" : "baixa")} style={{ flex: 1, background: filtro === "baixa" ? BLUE : "#fff", color: filtro === "baixa" ? "#fff" : BLUE, border: `2px solid ${BLUE}`, borderRadius: 10, padding: "10px 6px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
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
              <div key={a.id} onClick={() => irParaAlerta(a)} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${a.color}`, cursor: a.navegarPara ? "pointer" : "default" }}>
                <div style={{ fontSize: 26, marginRight: 12 }}>{a.icone}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{a.titulo}</div>
                  <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>{a.detalhe}</div>
                  {a.navegarPara && <div style={{ fontSize: 9, color: BLUE, marginTop: 3, fontWeight: 700 }}>👆 Toque pra resolver →</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Badge label={a.tipo} color={a.color} small />
                  {a.navegarPara && <span style={{ color: "#bbb", fontSize: 16 }}>›</span>}
                </div>
              </div>
            ))}

            {visiveis.length === 0 && (
              <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", color: "#aaa", fontSize: 12 }}>
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

export function TelaRelatorioConsolidado({ obras, trabalhadores, pedidos, historico, onBack }) {
  const [periodo, setPeriodo] = useState("semana");
  const [obraId, setObraId] = useState("todas");

  const dias = ultimosDias(periodo === "semana" ? 7 : 30);
  const trabFiltro = obraId === "todas" ? trabalhadores : trabalhadores.filter(t => String(t.obraId) === String(obraId));
  const pedidosFiltro = obraId === "todas" ? pedidos : pedidos.filter(p => String(p.obraId) === String(obraId));

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
    let p = 0, f = 0;
    dias.forEach(d => {
      const s = (historico[d] || {})[t.id];
      if (s === "Presente") p++;
      else if (s === "Falta") f++;
    });
    return { ...t, presentes: p, faltas: f, taxa: dias.length > 0 ? Math.round((p / dias.length) * 100) : 0 };
  }).sort((a, b) => b.taxa - a.taxa);

  const tituloPeriodo = periodo === "semana" ? "Últimos 7 dias" : "Últimos 30 dias";

  const exportar = () => {
    const html = `<html><head><title>Relatório Consolidado - ${tituloPeriodo}</title>
      <style>
        ${KM_PDF_PAGE_CSS}
        body{font-family:Arial;padding:30px;color:#222;}
        h1{color:${NAVY};border-bottom:3px solid ${GOLD};padding-bottom:8px;}
        h2{color:${NAVY};margin-top:24px;}
        table{width:100%;border-collapse:collapse;margin:10px 0;}
        th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px;}
        th{background:${NAVY};color:#fff;}
        .stat{display:inline-block;padding:12px 20px;margin:5px;border-radius:8px;color:#fff;font-weight:bold;}
        .footer{margin-top:40px;text-align:center;color:#888;font-size:11px;border-top:1px solid #ddd;padding-top:10px;}
      </style></head><body>
      <h1>📊 Relatório Consolidado — ${tituloPeriodo}</h1>
      <p><b>Obra:</b> ${obraId === "todas" ? "Todas" : obras.find(o => String(o.id) === String(obraId))?.nome} &nbsp;|&nbsp; <b>Gerado em:</b> ${new Date().toLocaleString("pt-BR")}</p>
      <h2>Resumo</h2>
      <div>
        <span class="stat" style="background:${GREEN}">${totalP} Presenças</span>
        <span class="stat" style="background:${RED}">${totalF} Faltas</span>
        <span class="stat" style="background:${ORANGE}">${totalA} Atestados</span>
      </div>
      <h2>👥 Ranking de Frequência</h2>
      <table><tr><th>#</th><th>Nome</th><th>Cargo</th><th>Presenças</th><th>Faltas</th><th>Taxa</th></tr>
      ${ranking.map((t, i) => `<tr><td>${i + 1}</td><td>${t.nome}</td><td>${t.cargo}</td><td>${t.presentes}</td><td>${t.faltas}</td><td><b>${t.taxa}%</b></td></tr>`).join("")}
      </table>
      <h2>📦 Pedidos no Período</h2>
      <p>Total: ${pedidosFiltro.length} • Aprovados: ${pedidosFiltro.filter(p => p.status === "Aprovado").length} • Negados: ${pedidosFiltro.filter(p => p.status === "Negado").length} • Aguardando: ${pedidosFiltro.filter(p => p.status === "Aguardando").length}</p>
      <div class="footer"><b>KM ZERO</b> — Gestão de Obras &nbsp;|&nbsp; KM Consultoria e Serviços</div>
      <script>window.onload=()=>{setTimeout(()=>window.print(),300);}</script>
      </body></html>`;
    abrirOuBaixarHTML(html, `Consolidado-${tituloPeriodo.replace(/\s/g, "_")}.html`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Relatório Consolidado" sub={tituloPeriodo} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
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

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>🏆 Ranking de Frequência</div>
          {ranking.length === 0 && <div style={{ color: "#aaa", fontSize: 13 }}>Sem dados.</div>}
          {ranking.map((t, i) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: i < ranking.length - 1 ? "1px solid #f0f0f0" : "none" }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: i === 0 ? GOLD : i === 1 ? "#cbd5e1" : i === 2 ? "#e29361" : "#eee", color: i < 3 ? "#fff" : "#888", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, marginRight: 10 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: NAVY, fontWeight: 600 }}>{t.nome}</div>
                <div style={{ fontSize: 10, color: "#888" }}>{t.cargo}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: t.taxa >= 80 ? GREEN : t.taxa >= 50 ? ORANGE : RED }}>{t.taxa}%</div>
                <div style={{ fontSize: 9, color: "#888" }}>{t.presentes}P / {t.faltas}F</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📦 Pedidos no Período</div>
          <div style={{ display: "flex", gap: 6, fontSize: 12, color: "#666" }}>
            <span style={{ background: "#dde6f5", padding: "4px 10px", borderRadius: 8, fontWeight: 700, color: NAVY }}>Total: {pedidosFiltro.length}</span>
            <span style={{ background: "#f0fdf4", padding: "4px 10px", borderRadius: 8, fontWeight: 700, color: GREEN }}>✓ {pedidosFiltro.filter(p => p.status === "Aprovado").length}</span>
            <span style={{ background: "#fef2f2", padding: "4px 10px", borderRadius: 8, fontWeight: 700, color: RED }}>✕ {pedidosFiltro.filter(p => p.status === "Negado").length}</span>
            <span style={{ background: "#fff8f0", padding: "4px 10px", borderRadius: 8, fontWeight: 700, color: ORANGE }}>⏳ {pedidosFiltro.filter(p => p.status === "Aguardando").length}</span>
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
