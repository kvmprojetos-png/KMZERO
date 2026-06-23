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

export function TabelaResumoEquipe({ obras, trabalhadores, historico, onNav }) {
  const [filtroObra, setFiltroObra] = useState("todas");
  const [colapsada, setColapsada] = useState(true);

  const hoje = new Date();
  const mes = hoje.getMonth();
  const ano = hoje.getFullYear();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  const calcularDiasMes = (t) => {
    let pres = 0, falt = 0, atest = 0;
    for (let d = 1; d <= totalDias; d++) {
      const iso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const s = (historico[iso] || {})[t.id];
      if (s === "Presente") pres++;
      else if (s === "Falta") falt++;
      else if (s === "Atestado") atest++;
    }
    const diasPagos = pres + atest;
    const diaria = parseFloat(t.diaria) || 0;
    return { pres, falt, atest, diasPagos, diaria, total: diaria * diasPagos };
  };

  const trabFiltro = filtroObra === "todas" ? trabalhadores : trabalhadores.filter(t => String(t.obraId) === String(filtroObra));
  const dados = trabFiltro.map(t => ({ ...t, _calc: calcularDiasMes(t), _obra: obras.find(o => o.id === t.obraId) })).sort((a, b) => (b._calc.total - a._calc.total) || (a.nome || "").localeCompare(b.nome || ""));
  const totalGeral = dados.reduce((s, d) => s + d._calc.total, 0);

  return (
    <div style={{ background: "#fff", borderRadius: 14, marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div onClick={() => setColapsada(c => !c)} style={{ background: `linear-gradient(135deg,${NAVY},${NAVY2 || "#243b7a"})`, color: "#fff", padding: "10px 14px", display: "flex", alignItems: "center", cursor: "pointer" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>📊 Resumo da Equipe — {meses[mes]}/{ano}</div>
          <div style={{ fontSize: 10, opacity: 0.85 }}>{dados.length} trabalhador(es) • Total: R$ {totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
        </div>
        <div style={{ fontSize: 18 }}>{colapsada ? "▸" : "▾"}</div>
      </div>

      {!colapsada && (
        <>
          <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "none", borderBottom: "1px solid #eee", fontSize: 12, fontWeight: 600, color: NAVY, background: "#fafbfc" }}>
            <option value="todas">🏗️ Todas as obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: NAVY, fontWeight: 700, fontSize: 10, borderBottom: "2px solid #e5e7eb" }}>Trabalhador</th>
                  <th style={{ padding: "8px 6px", textAlign: "center", color: GREEN, fontWeight: 700, fontSize: 10, borderBottom: "2px solid #e5e7eb" }}>P</th>
                  <th style={{ padding: "8px 6px", textAlign: "center", color: RED, fontWeight: 700, fontSize: 10, borderBottom: "2px solid #e5e7eb" }}>F</th>
                  <th style={{ padding: "8px 6px", textAlign: "center", color: ORANGE, fontWeight: 700, fontSize: 10, borderBottom: "2px solid #e5e7eb" }}>A</th>
                  <th style={{ padding: "8px 8px", textAlign: "right", color: NAVY, fontWeight: 700, fontSize: 10, borderBottom: "2px solid #e5e7eb" }}>Diária</th>
                  <th style={{ padding: "8px 8px", textAlign: "right", color: NAVY, fontWeight: 700, fontSize: 10, borderBottom: "2px solid #e5e7eb" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {dados.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "#aaa", fontSize: 12 }}>Nenhum trabalhador.</td></tr>
                )}
                {dados.map(d => (
                  <tr key={d.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ fontWeight: 700, color: NAVY, fontSize: 11 }}>{d.nome}</div>
                      <div style={{ fontSize: 9, color: "#888" }}>{d.cargo} • {d._obra?.nome?.substring(0, 22) || "—"}</div>
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "center", color: GREEN, fontWeight: 700, fontSize: 11 }}>{d._calc.pres}</td>
                    <td style={{ padding: "8px 6px", textAlign: "center", color: d._calc.falt > 0 ? RED : "#ccc", fontWeight: 700, fontSize: 11 }}>{d._calc.falt}</td>
                    <td style={{ padding: "8px 6px", textAlign: "center", color: d._calc.atest > 0 ? ORANGE : "#ccc", fontWeight: 700, fontSize: 11 }}>{d._calc.atest}</td>
                    <td style={{ padding: "8px 8px", textAlign: "right", color: d._calc.diaria === 0 ? "#ccc" : "#666", fontSize: 10, fontStyle: d._calc.diaria === 0 ? "italic" : "normal" }}>{d._calc.diaria === 0 ? "—" : "R$ " + d._calc.diaria.toFixed(2)}</td>
                    <td style={{ padding: "8px 8px", textAlign: "right", color: GREEN, fontWeight: 800, fontSize: 11 }}>R$ {d._calc.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f3f4f6" }}>
                  <td colSpan={5} style={{ padding: "10px", textAlign: "right", color: NAVY, fontWeight: 800, fontSize: 11 }}>TOTAL DO MÊS</td>
                  <td style={{ padding: "10px", textAlign: "right", color: GREEN, fontWeight: 900, fontSize: 13 }}>R$ {totalGeral.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ padding: "8px 12px", background: "#f9fafb", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #eee", fontSize: 10, color: "#888" }}>
            <span>P=Presença • F=Falta • A=Atestado</span>
            <button onClick={() => onNav("folha_quinzenal")} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Ver Folha →</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════
   CRONOGRAMA DA OBRA — etapas e progresso
════════════════════════════════════ */
export const MODELOS_CRONOGRAMA = {
  Pavimentação: [
    { nome: "Mobilização e canteiro", duracao: 7 },
    { nome: "Sondagem e topografia", duracao: 7 },
    { nome: "Limpeza e terraplanagem", duracao: 14 },
    { nome: "Sub-base", duracao: 14 },
    { nome: "Base", duracao: 14 },
    { nome: "Drenagem (manilhas + bocas de lobo)", duracao: 21 },
    { nome: "Meio-fio e sarjetas", duracao: 14 },
    { nome: "Pavimentação asfáltica / blocos", duracao: 14 },
    { nome: "Sinalização", duracao: 7 },
    { nome: "Limpeza final e entrega", duracao: 5 },
  ],
  Edificação: [
    { nome: "Mobilização e canteiro", duracao: 5 },
    { nome: "Demolições / preparação", duracao: 7 },
    { nome: "Fundações", duracao: 21 },
    { nome: "Estrutura", duracao: 30 },
    { nome: "Alvenaria", duracao: 30 },
    { nome: "Instalações elétricas", duracao: 21 },
    { nome: "Instalações hidráulicas", duracao: 21 },
    { nome: "Revestimentos", duracao: 21 },
    { nome: "Pintura e acabamentos", duracao: 14 },
    { nome: "Limpeza final e entrega", duracao: 5 },
  ],
};


export function TelaEquipe({ obras, trabalhadores, usuarios = [], onBack, onAdd, onRemove, onVerDetalhe, onEditar }) {
  const [modal, setModal] = useState(false);
  const [filtroObra, setFiltroObra] = useState("todas");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos"); // todos | aso_vencido | sem_epi | inapto
  const [form, setForm] = useState({ nome: "", cargo: "", obraId: "", cpf: "", tel: "", diaria: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const checaASO = (t) => {
    if (!t.asoValidade) return { vencido: false, vencendo: false, dias: null };
    try {
      const v = new Date(t.asoValidade);
      const dias = Math.ceil((v - new Date()) / (1000 * 60 * 60 * 24));
      return { vencido: dias < 0, vencendo: dias >= 0 && dias <= 30, dias };
    } catch { return { vencido: false, vencendo: false, dias: null }; }
  };

  const lista = trabalhadores
    .filter(t => filtroObra === "todas" || String(t.obraId) === String(filtroObra))
    .filter(t => !busca || t.nome.toLowerCase().includes(busca.toLowerCase()) || (t.cargo || "").toLowerCase().includes(busca.toLowerCase()))
    .filter(t => {
      if (filtroStatus === "todos") return true;
      const aso = checaASO(t);
      if (filtroStatus === "aso_vencido") return aso.vencido || aso.vencendo;
      if (filtroStatus === "sem_epi") return !t.epiEntregue;
      if (filtroStatus === "inapto") return t.asoStatus === "Inapto" || t.asoStatus === "Apto com restrições";
      return true;
    });

  const totalAsoVencido = trabalhadores.filter(t => { const a = checaASO(t); return a.vencido || a.vencendo; }).length;
  const totalSemEPI = trabalhadores.filter(t => !t.epiEntregue).length;
  const totalInapto = trabalhadores.filter(t => t.asoStatus === "Inapto" || t.asoStatus === "Apto com restrições").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Equipe" sub={`${trabalhadores.length} trabalhador(es)`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 12 }}>

        {/* Indicadores rápidos clicáveis (filtros) */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button onClick={() => setFiltroStatus("todos")} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: filtroStatus === "todos" ? `2px solid ${NAVY}` : "1px solid #dde2ef", background: filtroStatus === "todos" ? "#dde6f5" : "#fff", cursor: "pointer" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>{trabalhadores.length}</div>
            <div style={{ fontSize: 9, color: "#666" }}>Todos</div>
          </button>
          <button onClick={() => setFiltroStatus(filtroStatus === "aso_vencido" ? "todos" : "aso_vencido")} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: filtroStatus === "aso_vencido" ? `2px solid ${RED}` : "1px solid #dde2ef", background: filtroStatus === "aso_vencido" ? "#fef2f2" : "#fff", cursor: "pointer" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: totalAsoVencido > 0 ? RED : "#888" }}>{totalAsoVencido}</div>
            <div style={{ fontSize: 9, color: "#666" }}>ASO 30d</div>
          </button>
          <button onClick={() => setFiltroStatus(filtroStatus === "sem_epi" ? "todos" : "sem_epi")} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: filtroStatus === "sem_epi" ? `2px solid ${ORANGE}` : "1px solid #dde2ef", background: filtroStatus === "sem_epi" ? "#fff8f0" : "#fff", cursor: "pointer" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: totalSemEPI > 0 ? ORANGE : "#888" }}>{totalSemEPI}</div>
            <div style={{ fontSize: 9, color: "#666" }}>S/ EPI</div>
          </button>
          <button onClick={() => setFiltroStatus(filtroStatus === "inapto" ? "todos" : "inapto")} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: filtroStatus === "inapto" ? `2px solid ${RED}` : "1px solid #dde2ef", background: filtroStatus === "inapto" ? "#fef2f2" : "#fff", cursor: "pointer" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: totalInapto > 0 ? RED : "#888" }}>{totalInapto}</div>
            <div style={{ fontSize: 9, color: "#666" }}>Inapto</div>
          </button>
        </div>

        <div style={{ position: "relative", marginBottom: 8 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>🔍</span>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou cargo..." style={{ ...inputS, paddingLeft: 38, marginBottom: 0 }} />
        </div>
        <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ ...selS, marginBottom: 12, marginTop: 8 }}>
          <option value="todas">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        {lista.map(t => {
          const obra = obras.find(o => o.id === t.obraId);
          const aso = checaASO(t);
          const indicadores = [];
          // Indicador: tem conta de login no sistema
          const temLogin = usuarios.some(u => u.nome.toLowerCase().trim() === t.nome.toLowerCase().trim() && u.perfil !== "gestor");
          if (temLogin) indicadores.push({ icon: "🔑", label: "Tem login", cor: BLUE });
          if (aso.vencido) indicadores.push({ icon: "🏥", label: `ASO vencido`, cor: RED });
          else if (aso.vencendo) indicadores.push({ icon: "🏥", label: `ASO em ${aso.dias}d`, cor: ORANGE });
          if (!t.epiEntregue) indicadores.push({ icon: "👕", label: "Sem EPI", cor: ORANGE });
          if (t.asoStatus === "Inapto") indicadores.push({ icon: "❌", label: "Inapto", cor: RED });
          else if (t.asoStatus === "Apto com restrições") indicadores.push({ icon: "⚠️", label: "Restrições", cor: ORANGE });

          return (
            <div key={t.id} onClick={() => onVerDetalhe && onVerDetalhe(t)} style={{ background: "#fff", borderRadius: 12, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer" }}>
              {t.foto ? (
                <img src={t.foto} alt="" style={{ width: 44, height: 44, borderRadius: 22, objectFit: "cover", border: `2px solid ${NAVY}`, marginRight: 10, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 22, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginRight: 10, flexShrink: 0, color: "#fff" }}>👷</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nome}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{t.cargo} • {obra ? obra.nome : "-"}</div>
                {indicadores.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                    {indicadores.map((i, idx) => (
                      <span key={idx} style={{ background: i.cor + "22", color: i.cor, padding: "2px 6px", borderRadius: 6, fontSize: 9, fontWeight: 700 }}>{i.icon} {i.label}</span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onPointerDown={(e) => { e.stopPropagation(); }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Confirmação simples e direta — sem confirm() nativo
                  confirmar(`Remover ${t.nome}?\n\nEsta ação não pode ser desfeita.`, () => {
                    onRemove(t.id);
                  });
                }}
                style={{
                  background: "#fee2e2",
                  border: `2px solid ${RED}`,
                  color: RED,
                  fontSize: 18,
                  cursor: "pointer",
                  marginRight: 6,
                  borderRadius: 8,
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "rgba(214,59,59,0.3)",
                  flexShrink: 0,
                }}
              >🗑️</button>
              <span style={{ color: "#ccc", fontSize: 18 }}>›</span>
            </div>
          );
        })}
        {lista.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: 20 }}>Nenhum resultado.</div>}
        <Btn label="➕ Adicionar Trabalhador" color={NAVY} onClick={() => setModal(true)} style={{ marginTop: 8 }} />
      </div>
      <KMFooter />
      <Modal show={modal} title="Novo Trabalhador" onClose={() => setModal(false)}>
        {[{ l: "Nome Completo", k: "nome", p: "Nome" }, { l: "CPF", k: "cpf", p: "000.000.000-00" }, { l: "Telefone", k: "tel", p: "(27) 9 0000-0000" }, { l: "💰 Diária (R$/dia)", k: "diaria", p: "100" }].map(f => (
          <div key={f.k}><label style={labelS}>{f.l}</label><input value={form[f.k]} onChange={e => set(f.k, e.target.value)} placeholder={f.p} style={inputS} /></div>
        ))}
        <label style={labelS}>Cargo</label>
        <select value={form.cargo} onChange={e => set("cargo", e.target.value)} style={selS}>
          <option value="">Selecione</option>
          {CARGOS.map(c => <option key={c}>{c}</option>)}
        </select>
        <label style={labelS}>Obra</label>
        <select value={form.obraId} onChange={e => set("obraId", parseInt(e.target.value))} style={selS}>
          <option value="">Selecione a obra</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ background: "#fffaeb", borderRadius: 8, padding: "10px 12px", fontSize: 11, color: "#8b6f00", marginBottom: 10, lineHeight: 1.5 }}>
          💡 Esta tela cadastra <b>trabalhador</b> (folha, presença, frequência).<br/>
          Pra dar <b>acesso ao app</b> (login do encarregado), vá em <b>⚙️ Sistema → 🔑 Acessos do App</b>.
        </div>
        <Btn label="SALVAR" color={GREEN} onClick={() => {
          if (!form.nome || !form.cargo || !form.obraId) return;
          const novo = { id: Date.now(), nome: form.nome, cargo: form.cargo, obraId: form.obraId, cpf: form.cpf, tel: form.tel, diaria: form.diaria };
          onAdd(novo, null); // sempre sem login — é só pra folha
          setModal(false);
          setForm({ nome: "", cargo: "", obraId: "", cpf: "", tel: "", diaria: "" });
        }} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   FICHA CADASTRAL
════════════════════════════════════ */

export function TelaFicha({ obras, onBack, onAdd }) {
  const [form, setForm] = useState({
    nome: "", cpf: "", rg: "", nasc: "", tel: "", cargo: "", obraId: "", inicio: "",
    diaria: "",
    tamCamisa: "", tamCalca: "", tamBota: "", tamLuva: "", tamCapacete: "",
    epiEntregue: false, epiData: "",
    foto: null,
    asoData: "", asoValidade: "", asoStatus: "Apto",
    docCtps: null, docCpf: null, docComprov: null,
  });
  const [salvo, setSalvo] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Sugerir diária por cargo
  const SUGESTAO_DIARIA = {
    "Auxiliar": "90", "Servente": "90",
    "Pedreiro": "150", "Carpinteiro": "150", "Pintor": "140", "Armador": "140", "Azulejista": "150",
    "Eletricista": "180", "Encanador": "180",
    "Encarregado": "200", "Mestre de Obras": "220",
    "Encarregado / Operador Retroescavadeira": "250",
    "Operador de Máquina": "200", "Motorista": "150", "Vigia": "100",
  };

  const aplicarSugestao = () => {
    if (form.cargo && SUGESTAO_DIARIA[form.cargo] && !form.diaria) {
      set("diaria", SUGESTAO_DIARIA[form.cargo]);
    }
  };

  const handleFoto = (e, campo) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set(campo, ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Ficha Cadastral" sub="Novo Colaborador" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {salvo ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 64 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: GREEN, marginTop: 12 }}>Ficha Salva!</div>
            <div style={{ color: "#666", marginTop: 6, fontSize: 13 }}>{form.nome} cadastrado com sucesso.</div>
            <Btn label="Nova Ficha" color={NAVY} onClick={() => { setSalvo(false); setForm({ nome: "", cpf: "", rg: "", nasc: "", tel: "", cargo: "", obraId: "", inicio: "", diaria: "", tamCamisa: "", tamCalca: "", tamBota: "", tamLuva: "", tamCapacete: "", epiEntregue: false, epiData: "", foto: null, asoData: "", asoValidade: "", asoStatus: "Apto", docCtps: null, docCpf: null, docComprov: null }); }} style={{ marginTop: 24 }} />
            <Btn label="Voltar" color="#eee" text={NAVY} onClick={onBack} style={{ marginTop: 10 }} />
          </div>
        ) : (
          <>
            {/* FOTO DO ROSTO */}
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              {form.foto ? (
                <div style={{ position: "relative", display: "inline-block" }}>
                  <img src={form.foto} alt="" style={{ width: 96, height: 96, borderRadius: 48, objectFit: "cover", border: `3px solid ${NAVY}` }} />
                  <button onClick={() => set("foto", null)} style={{ position: "absolute", top: 0, right: 0, background: RED, color: "#fff", border: "none", borderRadius: 14, width: 28, height: 28, fontSize: 14, cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>✕</button>
                </div>
              ) : (
                <div style={{ width: 96, height: 96, borderRadius: 48, background: "#dde6f5", border: `3px solid ${NAVY}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 42 }}>👤</div>
              )}
              <div style={{ marginTop: 8 }}>
                <label style={{ background: "#eef2ff", border: "none", borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 700, color: NAVY, cursor: "pointer", display: "inline-block" }}>
                  📷 {form.foto ? "Trocar Foto" : "Tirar Foto"}
                  <input type="file" accept="image/*" capture="user" onChange={(e) => handleFoto(e, "foto")} style={{ display: "none" }} />
                </label>
              </div>
            </div>

            {/* DADOS PESSOAIS */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>👤 Dados Pessoais</div>
              {[{ l: "Nome Completo", k: "nome", p: "Nome completo" }, { l: "CPF", k: "cpf", p: "000.000.000-00" }, { l: "RG", k: "rg", p: "00.000.000-0" }, { l: "Data de Nascimento", k: "nasc", p: "DD/MM/AAAA" }, { l: "Telefone / WhatsApp", k: "tel", p: "(27) 9 0000-0000" }].map(f => (
                <div key={f.k}><label style={labelS}>{f.l}</label><input value={form[f.k]} onChange={e => set(f.k, e.target.value)} placeholder={f.p} style={inputS} /></div>
              ))}
            </div>

            {/* CONTRATUAIS */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>💼 Informações Contratuais</div>
              <label style={labelS}>Cargo / Função</label>
              <select value={form.cargo} onChange={e => { set("cargo", e.target.value); setTimeout(aplicarSugestao, 0); }} style={selS}>
                <option value="">Selecione</option>
                {CARGOS.map(c => <option key={c}>{c}</option>)}
              </select>
              <label style={labelS}>Obra Atual</label>
              <select value={form.obraId} onChange={e => set("obraId", parseInt(e.target.value))} style={selS}>
                <option value="">Selecione a obra</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
              <label style={labelS}>Data de Início</label>
              <input value={form.inicio} onChange={e => set("inicio", e.target.value)} type="date" style={dateS} />
              <label style={labelS}>💰 Valor da Diária (R$/dia)</label>
              <input value={form.diaria} onChange={e => set("diaria", e.target.value)} type="number" placeholder="Ex: 100" style={inputS} />
              {form.cargo && SUGESTAO_DIARIA[form.cargo] && !form.diaria && (
                <button onClick={() => set("diaria", SUGESTAO_DIARIA[form.cargo])} style={{ background: "#dde6f5", color: NAVY, border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>
                  💡 Usar sugestão para {form.cargo}: R$ {SUGESTAO_DIARIA[form.cargo]}
                </button>
              )}
              {form.diaria && (
                <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: GREEN, fontWeight: 600 }}>
                  💰 Diária: R$ {parseFloat(form.diaria).toFixed(2)} • Quinzena cheia (10 dias úteis): R$ {(parseFloat(form.diaria) * 10).toFixed(2)}
                </div>
              )}
            </div>

            {/* EXAME MÉDICO ASO */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>🏥 Exame Médico (ASO)</div>
              <label style={labelS}>Data do exame</label>
              <input value={form.asoData} onChange={e => set("asoData", e.target.value)} type="date" style={dateS} />
              <label style={labelS}>Validade</label>
              <input value={form.asoValidade} onChange={e => set("asoValidade", e.target.value)} type="date" style={dateS} />
              <label style={labelS}>Status / Aptidão</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {[
                  { v: "Apto", c: GREEN, icon: "✅" },
                  { v: "Apto com restrições", c: ORANGE, icon: "⚠️" },
                  { v: "Inapto", c: RED, icon: "❌" },
                ].map(s => (
                  <button key={s.v} onClick={() => set("asoStatus", s.v)} style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: `2px solid ${form.asoStatus === s.v ? s.c : "#dde2ef"}`, background: form.asoStatus === s.v ? s.c : "#fff", color: form.asoStatus === s.v ? "#fff" : "#666", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>
                    <div style={{ fontSize: 18 }}>{s.icon}</div>
                    {s.v}
                  </button>
                ))}
              </div>
            </div>

            {/* EPI / UNIFORME */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>👕 EPI / Uniforme</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelS}>Camisa</label>
                  <select value={form.tamCamisa} onChange={e => set("tamCamisa", e.target.value)} style={selS}>
                    <option value="">—</option>
                    {["PP", "P", "M", "G", "GG", "XGG", "XXGG"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelS}>Calça</label>
                  <select value={form.tamCalca} onChange={e => set("tamCalca", e.target.value)} style={selS}>
                    <option value="">—</option>
                    {["36", "38", "40", "42", "44", "46", "48", "50", "52"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelS}>Bota</label>
                  <select value={form.tamBota} onChange={e => set("tamBota", e.target.value)} style={selS}>
                    <option value="">—</option>
                    {["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelS}>Luva</label>
                  <select value={form.tamLuva} onChange={e => set("tamLuva", e.target.value)} style={selS}>
                    <option value="">—</option>
                    {["P", "M", "G", "GG"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelS}>Capacete</label>
                  <select value={form.tamCapacete} onChange={e => set("tamCapacete", e.target.value)} style={selS}>
                    <option value="">—</option>
                    <option>Único (ajustável)</option>
                    <option>Pequeno</option>
                    <option>Médio</option>
                    <option>Grande</option>
                  </select>
                </div>
              </div>
              <div style={{ background: "#f0f7ff", borderRadius: 10, padding: "10px 12px", marginTop: 6 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: NAVY, fontWeight: 600 }}>
                  <input type="checkbox" checked={form.epiEntregue} onChange={e => set("epiEntregue", e.target.checked)} style={{ width: 18, height: 18 }} />
                  EPI/Uniforme já entregue
                </label>
                {form.epiEntregue && (
                  <div style={{ marginTop: 8 }}>
                    <label style={labelS}>Data de entrega</label>
                    <input value={form.epiData} onChange={e => set("epiData", e.target.value)} type="date" style={{ ...inputS, marginBottom: 0 }} />
                  </div>
                )}
              </div>
            </div>

            {/* DOCUMENTOS DIGITAIS */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📋 Documentos (foto)</div>
              {[
                { k: "docCtps", l: "CTPS / Carteira de Trabalho", icon: "📘" },
                { k: "docCpf", l: "CPF / RG", icon: "🆔" },
                { k: "docComprov", l: "Comprovante de Residência", icon: "🏠" },
              ].map(d => (
                <div key={d.k} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{d.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{d.l}</span>
                  </div>
                  {form[d.k] ? (
                    <div style={{ position: "relative" }}>
                      <img src={form[d.k]} alt="" style={{ width: "100%", maxHeight: 140, objectFit: "cover", borderRadius: 8, border: "1px solid #dde2ef" }} />
                      <button onClick={() => set(d.k, null)} style={{ position: "absolute", top: 4, right: 4, background: RED, color: "#fff", border: "none", borderRadius: 14, width: 26, height: 26, fontSize: 13, cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>✕</button>
                    </div>
                  ) : (
                    <label style={{ display: "block", padding: 10, borderRadius: 8, border: "1.5px dashed #c5d0e5", background: "#f9fafb", textAlign: "center", cursor: "pointer", fontSize: 11, color: "#666" }}>
                      📷 Tirar foto / escolher
                      <input type="file" accept="image/*" onChange={(e) => handleFoto(e, d.k)} style={{ display: "none" }} />
                    </label>
                  )}
                </div>
              ))}
            </div>

            <Btn label="SALVAR FICHA COMPLETA" color={GOLD} onClick={() => { if (form.nome && form.cpf) { onAdd({ id: Date.now(), ...form }); setSalvo(true); } }} style={{ marginBottom: 24 }} />
          </>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   RELATÓRIO DIÁRIO
════════════════════════════════════ */

export function gerarFichaCadastralPDF(t, obra, empresa) {
  const fmtCPF = (cpf) => cpf ? cpf.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "—";
  const fmtTel = (tel) => tel || "—";
  const fmtData = (d) => {
    if (!d) return "—";
    if (d.includes("/")) return d;
    try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
  };
  const v = (val) => val && String(val).trim() ? val : "—";

  // Tipo de folha (badge)
  const tiposFolha = { semanal: "Semanal (7 dias)", quinzenal: "Quinzenal (15 dias)", mensal: "Mensal (30 dias)", personalizado: "Personalizado" };
  const tipoFolhaLabel = tiposFolha[t.tipoFolha] || "Quinzenal";

  // Formas de cálculo
  const formasCalculo = { diaria: "Por diária", mensal_fixo: "Salário mensal fixo", hora: "Por hora", producao: "Por produção" };
  const formaCalcLabel = formasCalculo[t.formaCalculo] || "Por diária";

  // Remuneração
  let remuneracao = "—";
  if (t.formaCalculo === "mensal_fixo" && t.salarioFixo) {
    remuneracao = `R$ ${parseFloat(t.salarioFixo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês (fixo)`;
  } else if (t.diaria) {
    remuneracao = `R$ ${parseFloat(t.diaria).toFixed(2).replace(".", ",")}/dia`;
  } else if (t.salarioMensal) {
    remuneracao = `R$ ${parseFloat(t.salarioMensal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês`;
  }

  // Detectar se é direto (obra) ou indireto (escritório)
  const ehIndireto = !t.obraId && !obra;
  const tipoVinculo = ehIndireto ? "Funcionário Indireto / Escritório" : "Funcionário Direto / Obra";

  // Data de emissão
  const dataEmissao = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const idTrab = String(t.id).padStart(5, "0");

  const html = `<html>
    <head>
      <title>Ficha Cadastral - ${t.nome}</title>
      <style>
        ${KM_PDF_PAGE_CSS}
        @page { size: A4 portrait; margin: 8mm 10mm; }
        @media print {
          body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break { page-break-before: always; }
        }
        body {
          font-family: 'Arial', 'Helvetica', sans-serif;
          color: #1a1a1a;
          font-size: 9pt;
          line-height: 1.25;
          margin: 0;
          padding: 0;
        }
        /* CABEÇALHO INSTITUCIONAL */
        .cabecalho {
          display: flex;
          justify-content: space-between;
          align-items: stretch;
          border-bottom: 3px solid #0f2151;
          padding-bottom: 5px;
          margin-bottom: 6px;
        }
        .cabecalho-empresa { flex: 1; padding-right: 8px; }
        .cabecalho-logo {
          font-size: 18pt;
          font-weight: 900;
          letter-spacing: -1px;
          line-height: 1;
          margin-bottom: 2px;
        }
        .cabecalho-logo .km { color: #0f2151; }
        .cabecalho-logo .zero { color: #F5A623; }
        .cabecalho-razao { font-size: 8.5pt; color: #1a1a1a; font-weight: 700; line-height: 1.2; }
        .cabecalho-dados { font-size: 7pt; color: #555; line-height: 1.3; margin-top: 1px; }
        .cabecalho-tagline { font-size: 6.5pt; color: #888; letter-spacing: 1.5px; font-weight: 600; margin-top: 1px; }
        .foto-3x4 {
          width: 72px; height: 92px;
          border: 1.5px solid #0f2151;
          display: flex; align-items: center; justify-content: center;
          flex-direction: column;
          color: #888; font-size: 7pt; text-align: center;
          background: repeating-linear-gradient(45deg, #fafafa, #fafafa 4px, #fff 4px, #fff 8px);
          flex-shrink: 0;
        }
        .foto-3x4 .label { font-weight: 700; letter-spacing: 0.5px; }

        /* TÍTULO PRINCIPAL */
        .titulo-doc {
          text-align: center;
          background: #0f2151;
          color: #fff;
          padding: 4px 8px;
          margin: 4px 0;
          letter-spacing: 1px;
        }
        .titulo-doc h1 {
          font-size: 11pt;
          font-weight: 900;
          margin: 0;
          letter-spacing: 1.5px;
        }
        .titulo-doc .sub { font-size: 7pt; color: #F5A623; margin-top: 1px; letter-spacing: 0.8px; }
        .ribbon-tipo {
          display: flex; justify-content: space-between;
          background: #FFF7E6; border: 1px solid #F5A623;
          padding: 2px 8px; font-size: 7.5pt;
          margin-bottom: 4px;
        }
        .ribbon-tipo b { color: #7c6f3a; }

        /* SEÇÕES */
        .secao-titulo {
          background: linear-gradient(90deg, #0f2151 0%, #1a3370 100%);
          color: #fff;
          padding: 2px 8px;
          font-size: 8pt;
          font-weight: 700;
          letter-spacing: 0.8px;
          margin: 4px 0 0 0;
        }
        .secao {
          border: 1px solid #0f2151;
          border-top: none;
          padding: 0;
          margin-bottom: 4px;
        }
        /* TABELA DE CAMPOS */
        table.dados {
          width: 100%;
          border-collapse: collapse;
          font-size: 8.5pt;
        }
        table.dados td {
          border: 1px solid #d0d4dc;
          padding: 2px 5px;
          vertical-align: top;
          line-height: 1.2;
        }
        table.dados td.label {
          background: #f4f6fa;
          font-size: 6.5pt;
          color: #555;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          font-weight: 700;
          width: 1px;
          white-space: nowrap;
          padding-right: 8px;
        }
        table.dados td.valor {
          font-size: 9pt;
          color: #000;
          font-weight: 500;
        }
        table.dados td.valor.destaque {
          font-weight: 800;
          color: #0f2151;
        }

        /* ASSINATURAS */
        .assinaturas {
          display: flex; gap: 16px; margin-top: 8px;
        }
        .ass-bloco { flex: 1; text-align: center; }
        .ass-bloco .linha-ass {
          border-top: 1px solid #000;
          margin-top: 22px;
          padding-top: 2px;
          font-size: 7.5pt;
          color: #444;
          font-weight: 600;
        }
        .ass-bloco .nome-ass { font-size: 7pt; color: #888; margin-top: 1px; }

        /* LGPD */
        .lgpd-alerta {
          background: #fff8e1; border-left: 3px solid #F5A623;
          padding: 3px 8px; font-size: 7pt; color: #7c6f3a;
          margin: 4px 0 2px 0;
          line-height: 1.3;
        }
        .lgpd-alerta b { color: #5c5210; }

        /* RODAPÉ */
        .rodape-doc {
          margin-top: 6px;
          border-top: 1px solid #ccc;
          padding-top: 3px;
          font-size: 6.5pt;
          color: #999;
          display: flex; justify-content: space-between;
          letter-spacing: 0.2px;
        }

        /* ═══ CRACHÁ ═══ */
        .cracha-page { padding-top: 20mm; }
        .cracha-grid {
          display: flex;
          gap: 10mm;
          flex-wrap: wrap;
          justify-content: center;
        }
        .cracha {
          width: 85mm; height: 54mm;
          border: 2px solid #0f2151;
          border-radius: 5px;
          padding: 0;
          background: #fff;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .cracha-header {
          background: linear-gradient(135deg, #0f2151 0%, #1a3370 100%);
          color: #fff;
          padding: 3px 6px;
          display: flex; justify-content: space-between; align-items: center;
        }
        .cracha-logo {
          font-size: 11pt; font-weight: 900; letter-spacing: -0.5px;
        }
        .cracha-logo .zero { color: #F5A623; }
        .cracha-tagline { font-size: 5pt; letter-spacing: 1.5px; opacity: 0.85; }
        .cracha-body {
          flex: 1;
          display: flex;
          padding: 4mm;
          gap: 3mm;
          background: #fff;
        }
        .cracha-foto {
          width: 22mm; height: 30mm;
          border: 1px solid #0f2151;
          background: repeating-linear-gradient(45deg, #f9f9f9, #f9f9f9 3px, #fff 3px, #fff 6px);
          display: flex; align-items: center; justify-content: center;
          font-size: 6pt; color: #aaa; text-align: center;
          flex-shrink: 0;
        }
        .cracha-info { flex: 1; font-size: 7pt; line-height: 1.3; }
        .cracha-nome { font-size: 9pt; font-weight: 900; color: #0f2151; line-height: 1.1; margin-bottom: 1mm; }
        .cracha-cargo { font-size: 7pt; color: #F5A623; font-weight: 700; margin-bottom: 1mm; letter-spacing: 0.3px; }
        .cracha-detalhe { font-size: 6pt; color: #444; line-height: 1.4; }
        .cracha-detalhe b { color: #0f2151; font-weight: 700; }
        .cracha-footer {
          background: #F5A623;
          color: #0f2151;
          font-size: 5.5pt;
          font-weight: 700;
          padding: 1.5mm 6px;
          letter-spacing: 0.8px;
          text-align: center;
          line-height: 1;
        }
        .cracha-titulo-pg {
          text-align: center;
          background: #0f2151;
          color: #fff;
          padding: 5px;
          margin-bottom: 10mm;
          letter-spacing: 1px;
        }
        .cracha-titulo-pg h1 { font-size: 13pt; margin: 0; font-weight: 900; }
        .cracha-titulo-pg .sub { font-size: 8pt; color: #F5A623; margin-top: 2px; letter-spacing: 0.6px; }
        .cracha-instrucoes {
          margin-top: 8mm;
          background: #f4f6fa;
          border-left: 3px solid #0f2151;
          padding: 4px 10px;
          font-size: 8pt;
          color: #555;
          line-height: 1.5;
        }
      </style>
    </head>
    <body>

      <!-- ════════ PÁGINA 1 — FICHA CADASTRAL A4 ════════ -->
      <div class="cabecalho">
        <div class="cabecalho-empresa">
          <div class="cabecalho-logo"><span class="km">KM</span><span class="zero">ZERO</span></div>
          <div class="cabecalho-tagline">GESTÃO DE OBRAS</div>
          <div class="cabecalho-razao">${v(empresa.razaoSocial) || "KM Consultoria, Assessoria e Serviços de Engenharia Ltda"}</div>
          <div class="cabecalho-dados">
            CNPJ: ${v(empresa.cnpj) || "60.368.233/0001-73"} &nbsp;•&nbsp;
            ${v(empresa.endereco) || "Alegre/ES"}<br>
            ${v(empresa.responsavel) || "Eng. Kleber Vieira Martins · CREA-ES"} &nbsp;•&nbsp;
            ${v(empresa.telefone) || "(28) 99925-8172"} &nbsp;•&nbsp;
            ${v(empresa.email) || "kvmprojetos@gmail.com"}
          </div>
        </div>
        <div class="foto-3x4">
          <div class="label">FOTO</div>
          <div style="font-size:6pt;margin-top:1px;">3x4</div>
        </div>
      </div>

      <div class="titulo-doc">
        <h1>FICHA CADASTRAL DE COLABORADOR</h1>
        <div class="sub">DOCUMENTO PARA ARQUIVO INTERNO</div>
      </div>

      <div class="ribbon-tipo">
        <span><b>📁 Vínculo:</b> ${tipoVinculo}</span>
        <span><b>🆔 Matrícula:</b> #${idTrab}</span>
        <span><b>📅 Emissão:</b> ${dataEmissao}</span>
      </div>

      <div class="secao-titulo">1. IDENTIFICAÇÃO PESSOAL</div>
      <div class="secao">
        <table class="dados">
          <tr>
            <td class="label">Nome Completo</td>
            <td class="valor destaque" colspan="3">${v(t.nome)}</td>
          </tr>
          <tr>
            <td class="label">CPF</td><td class="valor">${fmtCPF(t.cpf)}</td>
            <td class="label">RG</td><td class="valor">${v(t.rg)}</td>
          </tr>
          <tr>
            <td class="label">Data Nascimento</td><td class="valor">${fmtData(t.nasc)}</td>
            <td class="label">Estado Civil</td><td class="valor">${v(t.estadoCivil)}</td>
          </tr>
          <tr>
            <td class="label">Nacionalidade</td><td class="valor">${v(t.nacionalidade) || "Brasileira"}</td>
            <td class="label">Naturalidade</td><td class="valor">${v(t.naturalidade)}</td>
          </tr>
          <tr>
            <td class="label">Tipo Sanguíneo</td><td class="valor">${v(t.tipoSanguineo)}</td>
            <td class="label">Escolaridade</td><td class="valor">${v(t.escolaridade)}</td>
          </tr>
          <tr>
            <td class="label">Nome do Pai</td><td class="valor" colspan="3">${v(t.nomePai)}</td>
          </tr>
          <tr>
            <td class="label">Nome da Mãe</td><td class="valor" colspan="3">${v(t.nomeMae)}</td>
          </tr>
        </table>
      </div>

      <div class="secao-titulo">2. ENDEREÇO E CONTATO</div>
      <div class="secao">
        <table class="dados">
          <tr>
            <td class="label">Endereço</td>
            <td class="valor" colspan="3">${v(t.endereco)}</td>
          </tr>
          <tr>
            <td class="label">Bairro</td><td class="valor">${v(t.bairro)}</td>
            <td class="label">Cidade / UF</td><td class="valor">${v(t.cidade)}</td>
          </tr>
          <tr>
            <td class="label">CEP</td><td class="valor">${v(t.cep)}</td>
            <td class="label">Telefone Cel.</td><td class="valor">${fmtTel(t.tel)}</td>
          </tr>
          <tr>
            <td class="label">Tel. Recado</td><td class="valor">${fmtTel(t.telRecado)}</td>
            <td class="label">E-mail</td><td class="valor">${v(t.email)}</td>
          </tr>
        </table>
      </div>

      <div class="secao-titulo">3. DADOS PROFISSIONAIS E REMUNERAÇÃO</div>
      <div class="secao">
        <table class="dados">
          <tr>
            <td class="label">Cargo / Função</td><td class="valor destaque">${v(t.cargo)}</td>
            <td class="label">Obra Atual</td><td class="valor">${ehIndireto ? "Escritório (Indireto)" : (obra?.nome || "—")}</td>
          </tr>
          <tr>
            <td class="label">Data Admissão</td><td class="valor">${fmtData(t.admissao || t.inicio)}</td>
            <td class="label">CTPS / PIS</td><td class="valor">${v(t.ctps || t.pis)}</td>
          </tr>
          <tr>
            <td class="label">Tipo de Folha</td><td class="valor"><b>${tipoFolhaLabel}</b></td>
            <td class="label">Forma de Cálculo</td><td class="valor">${formaCalcLabel}</td>
          </tr>
          <tr>
            <td class="label">Remuneração</td><td class="valor destaque" colspan="3">${remuneracao}</td>
          </tr>
        </table>
      </div>

      <div class="secao-titulo">4. SAÚDE E SEGURANÇA — ASO</div>
      <div class="secao">
        <table class="dados">
          <tr>
            <td class="label">Data do ASO</td><td class="valor">${fmtData(t.asoData)}</td>
            <td class="label">Validade ASO</td><td class="valor destaque">${fmtData(t.asoValidade)}</td>
          </tr>
          <tr>
            <td class="label">Status</td><td class="valor"><b>${v(t.asoStatus) || "Apto"}</b></td>
            <td class="label">Convênio Saúde</td><td class="valor">${v(t.convenio)}</td>
          </tr>
          <tr>
            <td class="label">Alergias / Condições</td>
            <td class="valor" colspan="3">${v(t.condicoesMedicas)}</td>
          </tr>
        </table>
      </div>

      <div class="secao-titulo">5. UNIFORMES E EPI</div>
      <div class="secao">
        <table class="dados">
          <tr>
            <td class="label">Camisa</td><td class="valor">${v(t.tamCamisa)}</td>
            <td class="label">Calça</td><td class="valor">${v(t.tamCalca)}</td>
            <td class="label">Bota</td><td class="valor">${v(t.tamBota)}</td>
            <td class="label">Capacete</td><td class="valor">${v(t.tamCapacete)}</td>
          </tr>
          <tr>
            <td class="label">EPI Entregue</td>
            <td class="valor" colspan="7">${t.epiEntregue ? "✓ Sim — em " + fmtData(t.epiData) : "✗ Não entregue"}</td>
          </tr>
        </table>
      </div>

      <div class="secao-titulo">6. CONTATO DE EMERGÊNCIA</div>
      <div class="secao">
        <table class="dados">
          <tr>
            <td class="label">Nome</td><td class="valor">${v(t.emergenciaNome)}</td>
            <td class="label">Parentesco</td><td class="valor">${v(t.emergenciaParentesco)}</td>
            <td class="label">Telefone</td><td class="valor">${fmtTel(t.emergenciaTel)}</td>
          </tr>
        </table>
      </div>

      <div class="secao-titulo">7. DADOS BANCÁRIOS</div>
      <div class="secao">
        <table class="dados">
          <tr>
            <td class="label">Banco</td><td class="valor">${v(t.banco)}</td>
            <td class="label">Agência</td><td class="valor">${v(t.agencia)}</td>
            <td class="label">Conta</td><td class="valor">${v(t.conta)} ${v(t.tipoConta) !== "—" ? "(" + t.tipoConta + ")" : ""}</td>
          </tr>
          <tr>
            <td class="label">Chave PIX</td>
            <td class="valor" colspan="5">${v(t.pix)}</td>
          </tr>
        </table>
      </div>

      <div class="lgpd-alerta">
        <b>⚠️ Confidencialidade — LGPD:</b> Este documento contém dados pessoais protegidos pela Lei Geral de Proteção de Dados (Lei 13.709/2018). Uso restrito à empresa emissora. Não pode ser compartilhado sem autorização do titular.
      </div>

      <div class="assinaturas">
        <div class="ass-bloco">
          <div class="linha-ass">Assinatura do Colaborador</div>
          <div class="nome-ass">${v(t.nome)}<br>CPF: ${fmtCPF(t.cpf)}</div>
        </div>
        <div class="ass-bloco">
          <div class="linha-ass">Responsável pela Empresa</div>
          <div class="nome-ass">${v(empresa.responsavel) || "Eng. Kleber Vieira Martins"}<br>CREA-ES</div>
        </div>
      </div>

      <div style="text-align:right;margin-top:6px;font-size:8pt;color:#444;">
        Local e Data: _______________________________________ , _____ / _____ / _________
      </div>

      <div class="rodape-doc">
        <span><b>${v(empresa.razaoSocial)?.split(",")[0] || "KM Consultoria"}</b> · Matrícula #${idTrab}</span>
        <span>Documento emitido pelo KMZERO em ${dataEmissao}</span>
      </div>

      <!-- ════════ PÁGINA 2 — CRACHÁ A4 ════════ -->
      <div class="page-break cracha-page">
        <div class="cracha-titulo-pg">
          <h1>CARTEIRA DE IDENTIFICAÇÃO</h1>
          <div class="sub">RECORTE E PLASTIFIQUE PARA USO EM OBRA</div>
        </div>

        <div class="cracha-grid">
          <!-- 2 crachás iguais para arquivar 1 e usar 1 -->
          ${[1, 2].map(() => `
            <div class="cracha">
              <div class="cracha-header">
                <div class="cracha-logo">KM<span class="zero">ZERO</span></div>
                <div class="cracha-tagline">GESTÃO DE OBRAS</div>
              </div>
              <div class="cracha-body">
                <div class="cracha-foto">
                  <div>FOTO<br>3x4</div>
                </div>
                <div class="cracha-info">
                  <div class="cracha-nome">${v(t.nome).substring(0, 28)}</div>
                  <div class="cracha-cargo">${v(t.cargo)?.toUpperCase()}</div>
                  <div class="cracha-detalhe">
                    <b>CPF:</b> ${fmtCPF(t.cpf)}<br>
                    <b>Matrícula:</b> #${idTrab}<br>
                    <b>Admissão:</b> ${fmtData(t.admissao || t.inicio)}<br>
                    <b>Tipo Sang.:</b> ${v(t.tipoSanguineo)}<br>
                    <b>Emergência:</b> ${fmtTel(t.emergenciaTel)}
                  </div>
                </div>
              </div>
              <div class="cracha-footer">
                ${v(empresa.razaoSocial)?.split(",")[0]?.toUpperCase() || "KM CONSULTORIA"} · ${v(empresa.cnpj) || "60.368.233/0001-73"}
              </div>
            </div>
          `).join("")}
        </div>

        <div class="cracha-instrucoes">
          <b>📋 Instruções de uso:</b><br>
          1. Recorte os crachás na linha externa.<br>
          2. Cole uma foto 3x4 atual no espaço indicado.<br>
          3. Plastifique (recomenda-se laminação 125 microns).<br>
          4. Use cordão / clip da empresa.<br>
          5. Mantenha sempre visível durante as atividades em obra.<br>
          6. Em caso de perda, comunique ao responsável imediatamente.
        </div>

        <div class="rodape-doc" style="margin-top: 8mm;">
          <span><b>${v(empresa.razaoSocial)?.split(",")[0] || "KM Consultoria"}</b> · Carteira #${idTrab}</span>
          <span>Emitida em ${dataEmissao}</span>
        </div>
      </div>

    </body>
  </html>`;

  abrirOuBaixarHTML(html, `Ficha-${t.nome.replace(/[^a-z0-9]/gi, "_").substring(0, 30)}`);
}

/* ════════════════════════════════════
   DETALHE DO TRABALHADOR
════════════════════════════════════ */

export function CalendarioPresenca({ trabalhador, historico, podeEditar = false, onEditarDia }) {
  const [mesOffset, setMesOffset] = useState(0);

  const hoje = new Date();
  const ref = new Date(hoje.getFullYear(), hoje.getMonth() + mesOffset, 1);
  const ano = ref.getFullYear();
  const mes = ref.getMonth();

  const chaveISODia = (dia) => `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const PROXIMO_STATUS = { null: "Presente", "Presente": "Falta", "Falta": "Atestado", "Atestado": null };

  const tocarDia = (dia, st) => {
    if (!podeEditar || !onEditarDia) return;
    const ehFuturo = mesOffset === 0 && dia > hoje.getDate();
    if (ehFuturo) return;
    onEditarDia(chaveISODia(dia), PROXIMO_STATUS[st] !== undefined ? PROXIMO_STATUS[st] : "Presente");
  };

  const nomesMes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const diasSemana = ["D", "S", "T", "Q", "Q", "S", "S"];

  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  const statusDoDia = (dia) => {
    const mm = String(mes + 1).padStart(2, "0");
    const dd = String(dia).padStart(2, "0");
    const chaveISO = `${ano}-${mm}-${dd}`;
    const registro = historico[chaveISO] || {};
    return registro[trabalhador.id] || null;
  };

  const corFundo = (st) => {
    if (st === "Presente") return "#dcfce7";
    if (st === "Falta") return "#fee2e2";
    if (st === "Atestado") return "#fef3c7";
    return "#f8fafc";
  };
  const corTexto = (st) => {
    if (st === "Presente") return "#15803d";
    if (st === "Falta") return "#b91c1c";
    if (st === "Atestado") return "#a16207";
    return "#cbd5e1";
  };

  const celulas = [];
  for (let i = 0; i < primeiroDia; i++) celulas.push(null);
  for (let d = 1; d <= totalDias; d++) celulas.push(d);

  let contPresente = 0, contFalta = 0, contAtestado = 0;
  for (let d = 1; d <= totalDias; d++) {
    const st = statusDoDia(d);
    if (st === "Presente") contPresente++;
    else if (st === "Falta") contFalta++;
    else if (st === "Atestado") contAtestado++;
  }

  const ehMesAtual = mesOffset === 0;

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button
          onClick={() => setMesOffset(mesOffset - 1)}
          aria-label="Mês anterior"
          style={{ background: "#f1f5f9", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer", color: NAVY, fontWeight: 700 }}
        >
          ‹
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 800, color: NAVY, fontSize: 14 }}>📅 {nomesMes[mes]} {ano}</div>
          <div style={{ fontSize: 10, color: "#888" }}>Calendário de presença</div>
        </div>
        <button
          onClick={() => setMesOffset(Math.min(0, mesOffset + 1))}
          aria-label="Próximo mês"
          disabled={ehMesAtual}
          style={{ background: ehMesAtual ? "#f8fafc" : "#f1f5f9", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: ehMesAtual ? "default" : "pointer", color: ehMesAtual ? "#cbd5e1" : NAVY, fontWeight: 700 }}
        >
          ›
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {diasSemana.map((ds, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#94a3b8", padding: "2px 0" }}>{ds}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {celulas.map((dia, i) => {
          if (dia === null) return <div key={i} />;
          const st = statusDoDia(dia);
          const ehHoje = ehMesAtual && dia === hoje.getDate();
          return (
            <div
              key={i}
              onClick={() => tocarDia(dia, st)}
              style={{
                aspectRatio: "1",
                background: corFundo(st),
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                border: ehHoje ? `2px solid ${NAVY}` : "1px solid #f1f5f9",
                minHeight: 34,
                cursor: podeEditar && !(ehMesAtual && dia > hoje.getDate()) ? "pointer" : "default",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: st ? corTexto(st) : "#94a3b8" }}>{dia}</div>
              {st && (
                <div style={{ fontSize: 9, lineHeight: 1 }}>
                  {st === "Presente" ? "✓" : st === "Falta" ? "✕" : "⚕"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-around", marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#15803d" }}>{contPresente}</div>
          <div style={{ fontSize: 9, color: "#888" }}>Presenças</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#b91c1c" }}>{contFalta}</div>
          <div style={{ fontSize: 9, color: "#888" }}>Faltas</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#a16207" }}>{contAtestado}</div>
          <div style={{ fontSize: 9, color: "#888" }}>Atestados</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 10, fontSize: 9, color: "#94a3b8" }}>
        <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#dcfce7", borderRadius: 2, marginRight: 3 }}></span>Presente</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#fee2e2", borderRadius: 2, marginRight: 3 }}></span>Falta</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#fef3c7", borderRadius: 2, marginRight: 3 }}></span>Atestado</span>
      </div>
      {podeEditar && (
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 10, color: NAVY, fontWeight: 600, background: "#f0f6ff", borderRadius: 8, padding: "6px 8px" }}>
          ✏️ Modo gestor: toque no dia para corrigir (Presente → Falta → Atestado → limpar)
        </div>
      )}
    </div>
  );
}


export function TelaTrabalhadorDetalhe({ trabalhador, obras, historico, rdosEmitidos = [], empresa = {}, usuario, onBack, onEditar, onEditarPresenca }) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(trabalhador || {});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (!trabalhador) return null;
  const obra = obras.find(o => o.id === trabalhador.obraId);
  const dias = ultimosDias(30);
  const stats = { Presente: 0, Falta: 0, Atestado: 0, "Sem registro": 0 };
  dias.forEach(d => {
    const s = (historico[d] || {})[trabalhador.id] || "Sem registro";
    stats[s] = (stats[s] || 0) + 1;
  });
  const presPct = Math.round((stats.Presente / 30) * 100);

  const salvar = () => { onEditar(form); setEditando(false); };

  // ASO próximo do vencimento?
  let asoStatusInfo = null;
  if (trabalhador.asoValidade) {
    try {
      const validade = new Date(trabalhador.asoValidade);
      const hoje = new Date();
      const dias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
      if (dias < 0) asoStatusInfo = { texto: `Vencido há ${Math.abs(dias)} dias`, cor: RED, icon: "❌" };
      else if (dias <= 30) asoStatusInfo = { texto: `Vence em ${dias} dia(s)`, cor: ORANGE, icon: "⚠️" };
      else asoStatusInfo = { texto: `Válido por ${dias} dias`, cor: GREEN, icon: "✅" };
    } catch (e) {}
  }

  // Aniversário próximo?
  let aniversarioProximo = null;
  if (trabalhador.nasc) {
    try {
      const [d, m] = trabalhador.nasc.includes("/") ? trabalhador.nasc.split("/") : trabalhador.nasc.split("-").reverse();
      const hoje = new Date();
      const aniv = new Date(hoje.getFullYear(), parseInt(m) - 1, parseInt(d));
      if (aniv < hoje) aniv.setFullYear(hoje.getFullYear() + 1);
      const dias = Math.ceil((aniv - hoje) / (1000 * 60 * 60 * 24));
      if (dias <= 30) aniversarioProximo = dias;
    } catch (e) {}
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Detalhes" sub={trabalhador.nome} onBack={onBack} right={
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => gerarFichaCadastralPDF(trabalhador, obra, empresa)} title="Imprimir Ficha" style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>🖨️</button>
          <button onClick={() => setEditando(true)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏️ Editar</button>
        </div>
      } />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 18, textAlign: "center", marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          {trabalhador.foto ? (
            <img src={trabalhador.foto} alt="" style={{ width: 90, height: 90, borderRadius: 45, objectFit: "cover", border: `3px solid ${NAVY}`, marginBottom: 8 }} />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: 40, background: NAVY, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 40, marginBottom: 8 }}>👷</div>
          )}
          <div style={{ fontWeight: 800, color: NAVY, fontSize: 20 }}>{trabalhador.nome}</div>
          <div style={{ fontSize: 13, color: "#666" }}>{trabalhador.cargo}</div>
          <div style={{ fontSize: 12, color: BLUE, marginTop: 4 }}>📍 {obra?.nome || "—"}</div>

          {/* Status ASO */}
          {trabalhador.asoStatus && (
            <div style={{ marginTop: 8 }}>
              <span style={{
                display: "inline-block", padding: "4px 12px", borderRadius: 14, fontSize: 11, fontWeight: 700,
                background: trabalhador.asoStatus === "Apto" ? "#f0fdf4" : trabalhador.asoStatus === "Inapto" ? "#fef2f2" : "#fff8f0",
                color: trabalhador.asoStatus === "Apto" ? GREEN : trabalhador.asoStatus === "Inapto" ? RED : ORANGE,
                border: `1px solid ${trabalhador.asoStatus === "Apto" ? GREEN : trabalhador.asoStatus === "Inapto" ? RED : ORANGE}33`,
              }}>
                {trabalhador.asoStatus === "Apto" ? "✅" : trabalhador.asoStatus === "Inapto" ? "❌" : "⚠️"} {trabalhador.asoStatus}
              </span>
            </div>
          )}

          {aniversarioProximo !== null && (
            <div style={{ marginTop: 8, background: "#fef3c7", color: "#92400e", borderRadius: 20, padding: "4px 12px", display: "inline-block", fontSize: 11, fontWeight: 700 }}>
              🎂 {aniversarioProximo === 0 ? "Aniversário hoje!" : aniversarioProximo === 1 ? "Aniversário amanhã!" : `Aniversário em ${aniversarioProximo} dias`}
            </div>
          )}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📋 Dados Pessoais</div>
          {[
            { l: "CPF", v: trabalhador.cpf || "—" },
            { l: "RG", v: trabalhador.rg || "—" },
            { l: "Nascimento", v: trabalhador.nasc || "—" },
            { l: "Telefone", v: trabalhador.tel || "—" },
            { l: "Data de início", v: trabalhador.inicio || "—" },
            { l: "💰 Diária", v: trabalhador.diaria ? `R$ ${parseFloat(trabalhador.diaria).toFixed(2)}/dia` : "—" },
            { l: "Quinzena cheia (10 dias)", v: trabalhador.diaria ? `R$ ${(parseFloat(trabalhador.diaria) * 10).toFixed(2)}` : "—" },
          ].map(d => (
            <div key={d.l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
              <span style={{ fontSize: 13, color: "#666" }}>{d.l}</span>
              <span style={{ fontSize: 13, color: NAVY, fontWeight: 600 }}>{d.v}</span>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>👕 EPI / Uniforme</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { l: "👕 Camisa", v: trabalhador.tamCamisa },
              { l: "👖 Calça", v: trabalhador.tamCalca },
              { l: "👢 Bota", v: trabalhador.tamBota },
              { l: "🧤 Luva", v: trabalhador.tamLuva },
              { l: "⛑️ Capacete", v: trabalhador.tamCapacete },
            ].map(d => (
              <div key={d.l} style={{ background: LIGHT, borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 10, color: "#888" }}>{d.l}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{d.v || "—"}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: trabalhador.epiEntregue ? "#f0fdf4" : "#fef2f2", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>{trabalhador.epiEntregue ? "✅" : "⚠️"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: trabalhador.epiEntregue ? GREEN : RED }}>
                {trabalhador.epiEntregue ? "EPI Entregue" : "EPI Pendente"}
              </div>
              {trabalhador.epiEntregue && trabalhador.epiData && (
                <div style={{ fontSize: 10, color: "#666" }}>Entregue em {new Date(trabalhador.epiData).toLocaleDateString("pt-BR")}</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📊 Frequência (30 dias)</div>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: presPct >= 80 ? GREEN : presPct >= 50 ? ORANGE : RED }}>{presPct}%</div>
            <div style={{ fontSize: 11, color: "#888" }}>Taxa de presença</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1, background: "#f0fdf4", borderRadius: 8, padding: "6px 4px", textAlign: "center" }}><div style={{ fontWeight: 800, color: GREEN }}>{stats.Presente}</div><div style={{ fontSize: 9, color: "#666" }}>Presente</div></div>
            <div style={{ flex: 1, background: "#fef2f2", borderRadius: 8, padding: "6px 4px", textAlign: "center" }}><div style={{ fontWeight: 800, color: RED }}>{stats.Falta}</div><div style={{ fontSize: 9, color: "#666" }}>Falta</div></div>
            <div style={{ flex: 1, background: "#fff8f0", borderRadius: 8, padding: "6px 4px", textAlign: "center" }}><div style={{ fontWeight: 800, color: ORANGE }}>{stats.Atestado}</div><div style={{ fontSize: 9, color: "#666" }}>Atestado</div></div>
          </div>
        </div>

        {/* CALENDÁRIO DE PRESENÇA DO MÊS (gestor pode corrigir) */}
        <CalendarioPresenca
          trabalhador={trabalhador}
          historico={historico}
          podeEditar={usuario?.perfil === "gestor"}
          onEditarDia={(dataISO, novoStatus) => onEditarPresenca && onEditarPresenca(dataISO, trabalhador.id, novoStatus)}
        />

        {/* ALIMENTAÇÃO DO MÊS */}
        {(() => {
          const hoje = new Date();
          const mes = hoje.getMonth();
          const ano = hoje.getFullYear();
          const rdosMes = rdosEmitidos.filter(r => {
            if (!r.data) return false;
            try { const [d, m, y] = r.data.split("/"); return parseInt(m) - 1 === mes && parseInt(y) === ano; } catch { return false; }
          });
          let qtdManha = 0, qtdTarde = 0, qtdMarmita = 0, qtdLanche = 0, totalAli = 0;
          rdosMes.forEach(r => {
            const ali = (r.alimentacao || {})[trabalhador.id];
            if (!ali) return;
            if (ali.cafeManha) { qtdManha++; totalAli += (empresa.valorCafeManha || 4); }
            if (ali.cafeTarde) { qtdTarde++; totalAli += (empresa.valorCafeTarde || 4); }
            if (ali.marmita) { qtdMarmita++; totalAli += (empresa.valorMarmita || 18); }
            if (ali.lanche) { qtdLanche++; totalAli += (empresa.valorLanche || 10); }
          });
          if (rdosMes.length === 0) return null;
          return (
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 800, color: NAVY, fontSize: 14, flex: 1 }}>☕ Alimentação no mês</div>
                <div style={{ background: "#dc7e00", color: "#fff", padding: "4px 10px", borderRadius: 6, fontWeight: 800, fontSize: 13 }}>R$ {totalAli.toFixed(2)}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                <div style={{ background: "#fef9e7", padding: 8, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#92400e" }}>{qtdManha}</div>
                  <div style={{ fontSize: 9, color: "#666" }}>☕ Manhã</div>
                </div>
                <div style={{ background: "#fef9e7", padding: 8, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#b45309" }}>{qtdTarde}</div>
                  <div style={{ fontSize: 9, color: "#666" }}>☕ Tarde</div>
                </div>
                <div style={{ background: "#fef2f2", padding: 8, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#dc2626" }}>{qtdMarmita}</div>
                  <div style={{ fontSize: 9, color: "#666" }}>🍱 Marmita</div>
                </div>
                <div style={{ background: "#f0f7ff", padding: 8, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0891b2" }}>{qtdLanche}</div>
                  <div style={{ fontSize: 9, color: "#666" }}>🥪 Lanche</div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: "#888", marginTop: 8, textAlign: "center", fontStyle: "italic" }}>Baseado em {rdosMes.length} RDO(s) no mês</div>
            </div>
          );
        })()}

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>🏥 Exame Médico (ASO)</div>
          {!trabalhador.asoData && !trabalhador.asoValidade ? (
            <div style={{ color: "#aaa", fontSize: 12, fontStyle: "italic", textAlign: "center", padding: 8 }}>Nenhum exame cadastrado.</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
                <span style={{ fontSize: 13, color: "#666" }}>Data do exame</span>
                <span style={{ fontSize: 13, color: NAVY, fontWeight: 600 }}>{trabalhador.asoData ? new Date(trabalhador.asoData).toLocaleDateString("pt-BR") : "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
                <span style={{ fontSize: 13, color: "#666" }}>Validade</span>
                <span style={{ fontSize: 13, color: NAVY, fontWeight: 600 }}>{trabalhador.asoValidade ? new Date(trabalhador.asoValidade).toLocaleDateString("pt-BR") : "—"}</span>
              </div>
              {asoStatusInfo && (
                <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: asoStatusInfo.cor === RED ? "#fef2f2" : asoStatusInfo.cor === ORANGE ? "#fff8f0" : "#f0fdf4", color: asoStatusInfo.cor, fontWeight: 700, fontSize: 13, textAlign: "center" }}>
                  {asoStatusInfo.icon} {asoStatusInfo.texto}
                </div>
              )}
            </>
          )}
        </div>

        {(trabalhador.docCtps || trabalhador.docCpf || trabalhador.docComprov) && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📋 Documentos Anexados</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { k: "docCtps", l: "CTPS", icon: "📘" },
                { k: "docCpf", l: "CPF/RG", icon: "🆔" },
                { k: "docComprov", l: "Residência", icon: "🏠" },
              ].map(d => (
                <div key={d.k} style={{ textAlign: "center" }}>
                  {trabalhador[d.k] ? (
                    <a href={trabalhador[d.k]} target="_blank" rel="noreferrer">
                      <img src={trabalhador[d.k]} alt={d.l} style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid #dde2ef", cursor: "pointer" }} />
                    </a>
                  ) : (
                    <div style={{ height: 80, background: LIGHT, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#ccc" }}>—</div>
                  )}
                  <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>{d.icon} {d.l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {trabalhador.tel && (
          <a href={`https://wa.me/55${trabalhador.tel.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ display: "block", textDecoration: "none", marginBottom: 12 }}>
            <div style={{ background: "#25D366", color: "#fff", borderRadius: 12, padding: "12px 16px", textAlign: "center", fontWeight: 700, fontSize: 14, boxShadow: "0 3px 10px #25D36644" }}>
              💬 Chamar no WhatsApp
            </div>
          </a>
        )}

        {/* IMPRIMIR FICHA CADASTRAL */}
        <button onClick={() => gerarFichaCadastralPDF(trabalhador, obra, empresa)} style={{ width: "100%", background: NAVY, color: "#fff", border: "none", borderRadius: 12, padding: "14px", marginTop: 10, fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 14px rgba(15,33,81,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          🖨️ IMPRIMIR FICHA CADASTRAL (A4)
        </button>
        <div style={{ fontSize: 10, color: "#888", textAlign: "center", marginTop: 4, fontStyle: "italic" }}>Documento oficial pra arquivo físico (gaveteiro)</div>
      </div>
      <KMFooter />

      <Modal show={editando} title="Editar Trabalhador" onClose={() => setEditando(false)}>
        {/* FOTO */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          {form.foto ? (
            <div style={{ position: "relative", display: "inline-block" }}>
              <img src={form.foto} alt="" style={{ width: 80, height: 80, borderRadius: 40, objectFit: "cover", border: `2px solid ${NAVY}` }} />
              <button onClick={() => set("foto", null)} style={{ position: "absolute", top: -4, right: -4, background: RED, color: "#fff", border: "none", borderRadius: 12, width: 24, height: 24, fontSize: 12, cursor: "pointer" }}>✕</button>
            </div>
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: 40, background: "#dde6f5", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>👤</div>
          )}
          <div style={{ marginTop: 6 }}>
            <label style={{ background: "#eef2ff", border: "none", borderRadius: 16, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: NAVY, cursor: "pointer", display: "inline-block" }}>
              📷 {form.foto ? "Trocar" : "Adicionar foto"}
              <input type="file" accept="image/*" capture="user" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => set("foto", ev.target.result); r.readAsDataURL(f); }} style={{ display: "none" }} />
            </label>
          </div>
        </div>

        <div style={{ fontSize: 13, color: "#666", marginBottom: 10, fontWeight: 700 }}>👤 Dados Pessoais</div>
        <label style={labelS}>Nome Completo</label>
        <input value={form.nome || ""} onChange={e => set("nome", e.target.value)} style={inputS} />
        <label style={labelS}>CPF</label>
        <input value={form.cpf || ""} onChange={e => set("cpf", e.target.value)} placeholder="000.000.000-00" style={inputS} />
        <label style={labelS}>RG</label>
        <input value={form.rg || ""} onChange={e => set("rg", e.target.value)} placeholder="00.000.000-0" style={inputS} />
        <label style={labelS}>Data de Nascimento</label>
        <input value={form.nasc || ""} onChange={e => set("nasc", e.target.value)} placeholder="DD/MM/AAAA" style={inputS} />
        <label style={labelS}>Estado Civil</label>
        <select value={form.estadoCivil || ""} onChange={e => set("estadoCivil", e.target.value)} style={selS}>
          <option value="">—</option><option>Solteiro(a)</option><option>Casado(a)</option><option>União Estável</option><option>Divorciado(a)</option><option>Viúvo(a)</option>
        </select>
        <label style={labelS}>Naturalidade (cidade-UF onde nasceu)</label>
        <input value={form.naturalidade || ""} onChange={e => set("naturalidade", e.target.value)} placeholder="Ex: Alegre - ES" style={inputS} />
        <label style={labelS}>Nome do Pai</label>
        <input value={form.nomePai || ""} onChange={e => set("nomePai", e.target.value)} style={inputS} />
        <label style={labelS}>Nome da Mãe</label>
        <input value={form.nomeMae || ""} onChange={e => set("nomeMae", e.target.value)} style={inputS} />

        <div style={{ fontSize: 13, color: "#666", marginBottom: 10, fontWeight: 700, marginTop: 10 }}>📞 Contato</div>
        <label style={labelS}>Telefone / WhatsApp</label>
        <input value={form.tel || ""} onChange={e => set("tel", e.target.value)} placeholder="(27) 9 0000-0000" style={inputS} />
        <label style={labelS}>Telefone para recado</label>
        <input value={form.telRecado || ""} onChange={e => set("telRecado", e.target.value)} placeholder="(27) 0000-0000" style={inputS} />
        <label style={labelS}>E-mail</label>
        <input value={form.email || ""} onChange={e => set("email", e.target.value)} placeholder="email@exemplo.com" style={inputS} />
        <label style={labelS}>Endereço completo</label>
        <input value={form.endereco || ""} onChange={e => set("endereco", e.target.value)} placeholder="Rua, número, complemento" style={inputS} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelS}>Bairro</label>
            <input value={form.bairro || ""} onChange={e => set("bairro", e.target.value)} style={inputS} />
          </div>
          <div>
            <label style={labelS}>Cidade / UF</label>
            <input value={form.cidade || ""} onChange={e => set("cidade", e.target.value)} placeholder="Alegre - ES" style={inputS} />
          </div>
        </div>
        <label style={labelS}>CEP</label>
        <input value={form.cep || ""} onChange={e => set("cep", e.target.value)} placeholder="29500-000" style={inputS} />

        <div style={{ fontSize: 13, color: "#666", marginBottom: 10, fontWeight: 700, marginTop: 10 }}>💼 Contratuais</div>
        <label style={labelS}>Cargo</label>
        <select value={form.cargo || ""} onChange={e => set("cargo", e.target.value)} style={selS}>
          <option value="">Selecione</option>
          {CARGOS.map(c => <option key={c}>{c}</option>)}
        </select>
        <label style={labelS}>Obra</label>
        <select value={form.obraId || ""} onChange={e => set("obraId", parseInt(e.target.value))} style={selS}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <label style={labelS}>Data de Admissão</label>
        <input value={(() => {
          // Aceita formatos: "YYYY-MM-DD" (já correto), "DD/MM/YYYY" (BR antigo) ou vazio
          const v = form.admissao || form.inicio || "";
          if (!v) return "";
          if (v.includes("-") && v.length === 10) return v; // já está em YYYY-MM-DD
          if (v.includes("/")) {
            // Converter DD/MM/YYYY para YYYY-MM-DD
            const partes = v.split("/");
            if (partes.length === 3) {
              const [d, m, a] = partes;
              return `${a.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
            }
          }
          return "";
        })()} onChange={e => set("admissao", e.target.value)} type="date" style={{ ...dateS }} />
        <label style={labelS}>💰 Valor da Diária (R$/dia)</label>
        <input value={form.diaria || ""} onChange={e => set("diaria", e.target.value)} type="number" placeholder="100" style={inputS} />
        <label style={labelS}>CTPS / PIS</label>
        <input value={form.ctps || ""} onChange={e => set("ctps", e.target.value)} placeholder="Carteira de Trabalho ou PIS" style={inputS} />

        <div style={{ fontSize: 13, color: "#666", marginBottom: 10, fontWeight: 700, marginTop: 10 }}>💼 Folha de Pagamento</div>
        <div style={{ background: "#fff7e6", border: `1px solid ${GOLD}`, borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontSize: 11, color: "#7c6f3a", lineHeight: 1.5 }}>
          💡 Defina como esse trabalhador será pago. Cada um pode ter seu próprio regime (semanal, quinzenal ou mensal).
        </div>
        <label style={labelS}>Tipo de folha</label>
        <select value={form.tipoFolha || "quinzenal"} onChange={e => set("tipoFolha", e.target.value)} style={selS}>
          <option value="semanal">📅 Semanal (7 dias)</option>
          <option value="quinzenal">📆 Quinzenal (15 dias) — padrão</option>
          <option value="mensal">🗓️ Mensal (30 dias)</option>
          <option value="personalizado">⚙️ Personalizado (cliente define)</option>
        </select>
        {form.tipoFolha === "semanal" && (
          <>
            <label style={labelS}>Dia de pagamento da semana</label>
            <select value={form.diaPagamento || "Sexta-feira"} onChange={e => set("diaPagamento", e.target.value)} style={selS}>
              <option>Segunda-feira</option>
              <option>Terça-feira</option>
              <option>Quarta-feira</option>
              <option>Quinta-feira</option>
              <option>Sexta-feira</option>
              <option>Sábado</option>
              <option>Domingo</option>
            </select>
          </>
        )}
        {form.tipoFolha === "quinzenal" && (
          <>
            <label style={labelS}>Dias de fechamento da quinzena</label>
            <select value={form.diaFechamento || "1_15"} onChange={e => set("diaFechamento", e.target.value)} style={selS}>
              <option value="1_15">Dia 1 ao 15 | Dia 16 ao último</option>
              <option value="3_17">Dia 3 ao 17 | Dia 18 ao 2 (mês seguinte)</option>
              <option value="5_20">Dia 5 ao 20 | Dia 21 ao 4 (mês seguinte)</option>
              <option value="custom">Personalizado (defino na folha)</option>
            </select>
          </>
        )}
        {form.tipoFolha === "mensal" && (
          <>
            <label style={labelS}>Dia de pagamento do mês</label>
            <input value={form.diaPagamentoMes || "5"} onChange={e => set("diaPagamentoMes", e.target.value)} type="number" min="1" max="31" placeholder="Ex: 5 (todo dia 5)" style={inputS} />
            <label style={labelS}>Início do período de cálculo</label>
            <select value={form.inicioMes || "1"} onChange={e => set("inicioMes", e.target.value)} style={selS}>
              <option value="1">Dia 1 ao último dia do mês</option>
              <option value="21_anterior">Dia 21 do mês anterior ao 20 do mês</option>
              <option value="custom">Personalizado</option>
            </select>
          </>
        )}
        {form.tipoFolha === "personalizado" && (
          <div style={{ background: "#eff6ff", border: `1px solid ${BLUE}`, borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontSize: 11, color: "#1e3a8a", lineHeight: 1.5 }}>
            ℹ️ O período da folha será definido manualmente cada vez que você gerar a folha desse trabalhador.
          </div>
        )}
        <label style={labelS}>📌 Último pagamento (âncora do ciclo)</label>
        <input value={form.ultimoPagamento || ""} onChange={e => set("ultimoPagamento", e.target.value)} type="date" style={{ ...dateS }} />
        <div style={{ fontSize: 10, color: "#888", marginTop: -4, marginBottom: 10, lineHeight: 1.4 }}>
          Data da última sexta em que recebeu. A folha "Por Ciclo" usa isso para abrir o próximo período automaticamente (seg–sex).
        </div>
        <label style={labelS}>Forma de cálculo do dia</label>
        <select value={form.formaCalculo || "diaria"} onChange={e => set("formaCalculo", e.target.value)} style={selS}>
          <option value="diaria">Por diária (R$ × dias trabalhados)</option>
          <option value="mensal_fixo">Salário mensal fixo (sem variação)</option>
          <option value="hora">Por hora trabalhada (em breve)</option>
          <option value="producao">Por produção / empreitada (em breve)</option>
        </select>
        {form.formaCalculo === "mensal_fixo" && (
          <>
            <label style={labelS}>Salário mensal fixo (R$)</label>
            <input value={form.salarioFixo || ""} onChange={e => set("salarioFixo", e.target.value)} type="number" placeholder="Ex: 3000" style={inputS} />
          </>
        )}

        <label style={labelS}>Dias não trabalhados que pagam</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          {[{ k: "pagaFeriado", l: "🎉 Feriado nacional" }, { k: "pagaAtestado", l: "🏥 Atestado" }].map(o => {
            const ehCLT = (form.formaCalculo || "diaria") === "mensal_fixo";
            const ativo = form[o.k] !== undefined ? form[o.k] === true : ehCLT;
            return (
              <button key={o.k} type="button" onClick={() => set(o.k, !ativo)} style={{
                flex: 1, padding: "10px 8px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "center",
                border: ativo ? "2px solid #15803d" : "1.5px solid #dde2ef",
                background: ativo ? "#15803d15" : "#f9fafb", color: ativo ? "#15803d" : "#888",
              }}>
                {o.l}<br />{ativo ? "✓ Paga" : "Não paga"}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>
          💡 Padrão: CLT paga, diarista não paga. Ajuste por trabalhador.
        </div>

        <div style={{ fontSize: 13, color: "#666", marginBottom: 10, fontWeight: 700, marginTop: 10 }}>🏥 Saúde / ASO</div>
        <label style={labelS}>Data do exame</label>
        <input value={(() => {
          const v = form.asoData || ""; if (!v) return "";
          if (v.includes("-") && v.length === 10) return v;
          if (v.includes("/")) { const p = v.split("/"); if (p.length === 3) return `${p[2].padStart(4,"0")}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`; }
          return "";
        })()} onChange={e => set("asoData", e.target.value)} type="date" style={{ ...dateS }} />
        <label style={labelS}>Validade</label>
        <input value={(() => {
          const v = form.asoValidade || ""; if (!v) return "";
          if (v.includes("-") && v.length === 10) return v;
          if (v.includes("/")) { const p = v.split("/"); if (p.length === 3) return `${p[2].padStart(4,"0")}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`; }
          return "";
        })()} onChange={e => set("asoValidade", e.target.value)} type="date" style={{ ...dateS }} />
        <label style={labelS}>Status</label>
        <select value={form.asoStatus || "Apto"} onChange={e => set("asoStatus", e.target.value)} style={selS}>
          <option>Apto</option><option>Apto com restrições</option><option>Inapto</option>
        </select>
        <label style={labelS}>Tipo Sanguíneo</label>
        <select value={form.tipoSanguineo || ""} onChange={e => set("tipoSanguineo", e.target.value)} style={selS}>
          <option value="">—</option>{["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(t => <option key={t}>{t}</option>)}
        </select>
        <label style={labelS}>Alergias / Condições Médicas</label>
        <input value={form.condicoesMedicas || ""} onChange={e => set("condicoesMedicas", e.target.value)} placeholder="Ex: hipertensão, alergia a antibiótico" style={inputS} />
        <label style={labelS}>Convênio / Plano de Saúde</label>
        <input value={form.convenio || ""} onChange={e => set("convenio", e.target.value)} style={inputS} />

        <div style={{ fontSize: 13, color: "#666", marginBottom: 10, fontWeight: 700, marginTop: 10 }}>🚨 Contato de Emergência</div>
        <label style={labelS}>Nome</label>
        <input value={form.emergenciaNome || ""} onChange={e => set("emergenciaNome", e.target.value)} style={inputS} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelS}>Parentesco</label>
            <input value={form.emergenciaParentesco || ""} onChange={e => set("emergenciaParentesco", e.target.value)} placeholder="Esposa, Pai, Irmão..." style={inputS} />
          </div>
          <div>
            <label style={labelS}>Telefone</label>
            <input value={form.emergenciaTel || ""} onChange={e => set("emergenciaTel", e.target.value)} placeholder="(27) 9 0000-0000" style={inputS} />
          </div>
        </div>

        <div style={{ fontSize: 13, color: "#666", marginBottom: 10, fontWeight: 700, marginTop: 10 }}>🏦 Dados Bancários</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelS}>Banco</label>
            <input value={form.banco || ""} onChange={e => set("banco", e.target.value)} placeholder="Ex: Caixa, BB" style={inputS} />
          </div>
          <div>
            <label style={labelS}>Tipo</label>
            <select value={form.tipoConta || ""} onChange={e => set("tipoConta", e.target.value)} style={selS}>
              <option value="">—</option><option>Corrente</option><option>Poupança</option>
            </select>
          </div>
          <div>
            <label style={labelS}>Agência</label>
            <input value={form.agencia || ""} onChange={e => set("agencia", e.target.value)} style={inputS} />
          </div>
          <div>
            <label style={labelS}>Conta</label>
            <input value={form.conta || ""} onChange={e => set("conta", e.target.value)} style={inputS} />
          </div>
        </div>
        <label style={labelS}>Chave PIX</label>
        <input value={form.pix || ""} onChange={e => set("pix", e.target.value)} placeholder="CPF, telefone, email ou chave aleatória" style={inputS} />

        <div style={{ fontSize: 13, color: "#666", marginBottom: 10, fontWeight: 700, marginTop: 10 }}>👕 EPI / Uniforme</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelS}>Camisa</label>
            <select value={form.tamCamisa || ""} onChange={e => set("tamCamisa", e.target.value)} style={selS}>
              <option value="">—</option>{["PP", "P", "M", "G", "GG", "XGG", "XXGG"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelS}>Calça</label>
            <select value={form.tamCalca || ""} onChange={e => set("tamCalca", e.target.value)} style={selS}>
              <option value="">—</option>{["36", "38", "40", "42", "44", "46", "48", "50", "52"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelS}>Bota</label>
            <select value={form.tamBota || ""} onChange={e => set("tamBota", e.target.value)} style={selS}>
              <option value="">—</option>{["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelS}>Luva</label>
            <select value={form.tamLuva || ""} onChange={e => set("tamLuva", e.target.value)} style={selS}>
              <option value="">—</option>{["P", "M", "G", "GG"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <label style={labelS}>Capacete</label>
        <select value={form.tamCapacete || ""} onChange={e => set("tamCapacete", e.target.value)} style={selS}>
          <option value="">—</option>
          <option>Único (ajustável)</option><option>Pequeno</option><option>Médio</option><option>Grande</option>
        </select>

        <div style={{ background: "#f0f7ff", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: NAVY, fontWeight: 600 }}>
            <input type="checkbox" checked={!!form.epiEntregue} onChange={e => set("epiEntregue", e.target.checked)} style={{ width: 18, height: 18 }} />
            EPI/Uniforme entregue
          </label>
          {form.epiEntregue && (
            <div style={{ marginTop: 8 }}>
              <label style={labelS}>Data de entrega</label>
              <input value={form.epiData || ""} onChange={e => set("epiData", e.target.value)} type="date" style={{ ...inputS, marginBottom: 0 }} />
            </div>
          )}
        </div>

        <label style={labelS}>📝 Observações Gerais</label>
        <textarea value={form.observacoes || ""} onChange={e => set("observacoes", e.target.value)} rows={3} placeholder="Anotações importantes sobre o colaborador" style={{ ...inputS, fontFamily: "inherit" }} />

        <Btn label="💾 SALVAR" color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   MENSAGENS
════════════════════════════════════ */

export function TelaFerias({ obras, trabalhadores, ferias, onBack, onAdd, onRemove }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ trabId: "", inicio: "", fim: "", obs: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const hoje = new Date();
  const emFerias = ferias.filter(f => new Date(f.inicio) <= hoje && new Date(f.fim) >= hoje);
  const futuras = ferias.filter(f => new Date(f.inicio) > hoje);
  const passadas = ferias.filter(f => new Date(f.fim) < hoje);

  const salvar = () => {
    if (!form.trabId || !form.inicio || !form.fim) return;
    onAdd({ id: Date.now(), trabId: parseInt(form.trabId), inicio: form.inicio, fim: form.fim, obs: form.obs });
    setModal(false);
    setForm({ trabId: "", inicio: "", fim: "", obs: "" });
  };

  const renderItem = (f, color) => {
    const t = trabalhadores.find(x => x.id === f.trabId);
    const obra = obras.find(o => o.id === t?.obraId);
    return (
      <div key={f.id} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${color}` }}>
        <div style={{ width: 30, height: 30, borderRadius: 15, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginRight: 10 }}>🌴</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{t?.nome || "—"}</div>
          <div style={{ fontSize: 11, color: "#888" }}>{t?.cargo} • {obra?.nome}</div>
          <div style={{ fontSize: 11, color, fontWeight: 700, marginTop: 2 }}>{new Date(f.inicio).toLocaleDateString("pt-BR")} → {new Date(f.fim).toLocaleDateString("pt-BR")}</div>
          {f.obs && <div style={{ fontSize: 10, color: "#999", fontStyle: "italic" }}>{f.obs}</div>}
        </div>
        <button onClick={() => onRemove(f.id)} style={{ background: "#fee2e2", border: "2px solid #d63b3b", color: "#d63b3b", cursor: "pointer", padding: "6px 10px", borderRadius: 8, fontSize: 16, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Férias" sub="Escala de descanso" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, background: GREEN, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{emFerias.length}</div>
            <div style={{ fontSize: 10 }}>Em férias</div>
          </div>
          <div style={{ flex: 1, background: BLUE, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{futuras.length}</div>
            <div style={{ fontSize: 10 }}>Programadas</div>
          </div>
          <div style={{ flex: 1, background: "#888", borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{passadas.length}</div>
            <div style={{ fontSize: 10 }}>Concluídas</div>
          </div>
        </div>

        {emFerias.length > 0 && <>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, fontSize: 13 }}>🌴 Em férias agora</div>
          {emFerias.map(f => renderItem(f, GREEN))}
        </>}
        {futuras.length > 0 && <>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, fontSize: 13, marginTop: 12 }}>📅 Programadas</div>
          {futuras.map(f => renderItem(f, BLUE))}
        </>}
        {passadas.length > 0 && <>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, fontSize: 13, marginTop: 12 }}>✓ Concluídas</div>
          {passadas.slice(0, 5).map(f => renderItem(f, "#888"))}
        </>}

        <Btn label="➕ Programar Férias" color={NAVY} onClick={() => setModal(true)} style={{ marginTop: 12 }} />
      </div>
      <KMFooter />

      <Modal show={modal} title="Programar Férias" onClose={() => setModal(false)}>
        <label style={labelS}>Trabalhador</label>
        <select value={form.trabId} onChange={e => set("trabId", e.target.value)} style={selS}>
          <option value="">Selecione</option>
          {trabalhadores.map(t => <option key={t.id} value={t.id}>{t.nome} — {t.cargo}</option>)}
        </select>
        <label style={labelS}>Data início</label>
        <input value={form.inicio} onChange={e => set("inicio", e.target.value)} type="date" style={dateS} />
        <label style={labelS}>Data fim</label>
        <input value={form.fim} onChange={e => set("fim", e.target.value)} type="date" style={dateS} />
        <label style={labelS}>Observação (opcional)</label>
        <input value={form.obs} onChange={e => set("obs", e.target.value)} placeholder="Férias regulares 30 dias..." style={inputS} />
        <Btn label="SALVAR" color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   RDO ABNT — Relatório Diário com numeração e PDF padrão ABNT
════════════════════════════════════ */

export function TelaRH({ obras, trabalhadores, onBack, onVerTrabalhador }) {
  const [aba, setAba] = useState("aniversarios");

  // Aniversariantes do mês atual
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const aniversariantes = trabalhadores.filter(t => {
    if (!t.nasc) return false;
    try {
      const partes = t.nasc.includes("/") ? t.nasc.split("/") : t.nasc.split("-").reverse();
      const m = parseInt(partes[1]) - 1;
      return m === mesAtual;
    } catch { return false; }
  }).map(t => {
    const partes = t.nasc.includes("/") ? t.nasc.split("/") : t.nasc.split("-").reverse();
    const dia = parseInt(partes[0]);
    return { ...t, dia };
  }).sort((a, b) => a.dia - b.dia);

  // EPI pendente
  const epiPendente = trabalhadores.filter(t => !t.epiEntregue);
  const epiEntregue = trabalhadores.filter(t => t.epiEntregue);

  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="RH" sub="Aniversários e EPI" onBack={onBack} />
      <div style={{ display: "flex", gap: 0, background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        {[
          { v: "aniversarios", l: "🎂 Aniversários", n: aniversariantes.length },
          { v: "epi", l: "👕 EPI", n: epiPendente.length },
        ].map(a => (
          <button key={a.v} onClick={() => setAba(a.v)} style={{
            flex: 1, padding: "12px 0", background: "none", border: "none",
            borderBottom: aba === a.v ? `3px solid ${NAVY}` : "3px solid transparent",
            color: aba === a.v ? NAVY : "#888", fontWeight: aba === a.v ? 800 : 600, fontSize: 13, cursor: "pointer"
          }}>
            {a.l} {a.n > 0 && <span style={{ background: aba === a.v ? NAVY : "#ccc", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, marginLeft: 4 }}>{a.n}</span>}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {aba === "aniversarios" && (
          <>
            <div style={{ background: `linear-gradient(135deg,#fbbf24,#f59e0b)`, borderRadius: 14, padding: 14, marginBottom: 12, color: "#fff", boxShadow: "0 4px 14px #f59e0b44" }}>
              <div style={{ fontSize: 11, opacity: 0.9 }}>Aniversariantes</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>🎂 {meses[mesAtual]}</div>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>{aniversariantes.length} colaborador(es) este mês</div>
            </div>

            {aniversariantes.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 12, padding: 24, textAlign: "center", color: "#aaa" }}>
                Nenhum aniversariante em {meses[mesAtual]}.
              </div>
            ) : aniversariantes.map(t => {
              const obra = obras.find(o => o.id === t.obraId);
              const eHoje = t.dia === hoje.getDate();
              return (
                <div key={t.id} onClick={() => onVerTrabalhador(t)} style={{ background: eHoje ? "#fef3c7" : "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer", borderLeft: `4px solid ${eHoje ? "#f59e0b" : "#fbbf24"}` }}>
                  <div style={{ width: 50, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: eHoje ? "#92400e" : NAVY }}>{String(t.dia).padStart(2, "0")}</div>
                    <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase" }}>{meses[mesAtual].slice(0, 3)}</div>
                  </div>
                  <div style={{ flex: 1, marginLeft: 10 }}>
                    <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>
                      {eHoje && "🎉 "}{t.nome}
                    </div>
                    <div style={{ fontSize: 11, color: "#888" }}>{t.cargo} • {obra?.nome}</div>
                    {t.tel && (
                      <a href={`https://wa.me/55${t.tel.replace(/\D/g, "")}?text=Parab%C3%A9ns%20pelo%20seu%20anivers%C3%A1rio!`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: "#25D366", fontWeight: 700, textDecoration: "none" }}>💬 Mandar parabéns no WhatsApp</a>
                    )}
                  </div>
                  <span style={{ color: "#ccc", fontSize: 18 }}>›</span>
                </div>
              );
            })}
          </>
        )}

        {aba === "epi" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, background: GREEN, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{epiEntregue.length}</div>
                <div style={{ fontSize: 10 }}>EPI Entregue</div>
              </div>
              <div style={{ flex: 1, background: RED, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{epiPendente.length}</div>
                <div style={{ fontSize: 10 }}>Pendentes</div>
              </div>
            </div>

            {epiPendente.length > 0 && <>
              <div style={{ fontWeight: 700, color: RED, marginBottom: 8, fontSize: 13 }}>⚠️ EPI Pendente de Entrega</div>
              {epiPendente.map(t => {
                const obra = obras.find(o => o.id === t.obraId);
                const tamanhos = [t.tamCamisa && `Camisa ${t.tamCamisa}`, t.tamCalca && `Calça ${t.tamCalca}`, t.tamBota && `Bota ${t.tamBota}`].filter(Boolean).join(" • ");
                return (
                  <div key={t.id} onClick={() => onVerTrabalhador(t)} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer", borderLeft: `4px solid ${RED}` }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 17, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginRight: 10 }}>👷</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{t.nome}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>{t.cargo} • {obra?.nome}</div>
                        {tamanhos && <div style={{ fontSize: 10, color: BLUE, marginTop: 2 }}>{tamanhos}</div>}
                        {!tamanhos && <div style={{ fontSize: 10, color: ORANGE, marginTop: 2 }}>⚠️ Tamanhos não cadastrados</div>}
                      </div>
                      <span style={{ color: "#ccc", fontSize: 18 }}>›</span>
                    </div>
                  </div>
                );
              })}
            </>}

            {epiEntregue.length > 0 && <>
              <div style={{ fontWeight: 700, color: GREEN, marginBottom: 8, fontSize: 13, marginTop: 14 }}>✅ EPI Entregue</div>
              {epiEntregue.map(t => {
                const obra = obras.find(o => o.id === t.obraId);
                return (
                  <div key={t.id} onClick={() => onVerTrabalhador(t)} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer", borderLeft: `4px solid ${GREEN}` }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 17, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginRight: 10 }}>👷</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{t.nome}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>{t.cargo} • {obra?.nome}</div>
                        {t.epiData && <div style={{ fontSize: 10, color: GREEN, marginTop: 2 }}>📅 Entregue em {new Date(t.epiData).toLocaleDateString("pt-BR")}</div>}
                      </div>
                      <span style={{ color: "#ccc", fontSize: 18 }}>›</span>
                    </div>
                  </div>
                );
              })}
            </>}
          </>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   LINKS ÚTEIS — atalhos para sites externos
════════════════════════════════════ */
export const LINKS_PADRAO = [
  { id: 1, nome: "Calculadora de Concreto", url: "https://www.google.com/search?q=calculadora+de+concreto", icon: "🧮", cat: "Cálculos" },
  { id: 2, nome: "Conversor m² / m³",       url: "https://www.google.com/search?q=conversor+metro+quadrado+cubico", icon: "📐", cat: "Cálculos" },
  { id: 3, nome: "Cotação de Materiais",    url: "https://www.google.com/search?q=cotacao+material+construcao", icon: "💰", cat: "Materiais" },
  { id: 4, nome: "NBR 6118 (Concreto)",     url: "https://www.google.com/search?q=NBR+6118+concreto", icon: "📜", cat: "Normas" },
  { id: 5, nome: "Tabela TCPO",             url: "https://www.google.com/search?q=tabela+TCPO", icon: "📊", cat: "Cálculos" },
  { id: 6, nome: "WhatsApp Web",            url: "https://web.whatsapp.com", icon: "💬", cat: "Comunicação" },
  { id: 7, nome: "Google Maps",             url: "https://maps.google.com", icon: "🗺️", cat: "Comunicação" },
  { id: 8, nome: "Receita Federal CNPJ",    url: "https://servicos.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp", icon: "🏛️", cat: "Documentos" },
];


export function TelaContatos({ obras, trabalhadores, usuarios, onBack, onVerTrabalhador }) {
  const [busca, setBusca] = useState("");
  const [filtroObra, setFiltroObra] = useState("todas");
  const [aba, setAba] = useState("trabalhadores"); // trabalhadores | encarregados

  const lista = aba === "trabalhadores"
    ? trabalhadores.filter(t => t.tel)
    : usuarios.filter(u => u.perfil === "encarregado" && u.tel);

  const filtrados = lista.filter(p => {
    const passaObra = filtroObra === "todas" || String(p.obraId) === String(filtroObra);
    const passaBusca = !busca || p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.cargo || "").toLowerCase().includes(busca.toLowerCase());
    return passaObra && passaBusca;
  });

  // Agrupar por obra
  const grupos = {};
  filtrados.forEach(p => {
    const obra = obras.find(o => o.id === p.obraId);
    const nomeObra = obra?.nome || "Sem obra";
    (grupos[nomeObra] = grupos[nomeObra] || []).push(p);
  });

  const limparTel = (tel) => tel?.replace(/\D/g, "") || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Contatos" sub="Lista telefônica" onBack={onBack} />
      <div style={{ display: "flex", gap: 0, background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        {[
          { v: "trabalhadores", l: "👷 Trabalhadores", n: trabalhadores.filter(t => t.tel).length },
          { v: "encarregados", l: "🏢 Encarregados", n: usuarios.filter(u => u.perfil === "encarregado" && u.tel).length },
        ].map(a => (
          <button key={a.v} onClick={() => setAba(a.v)} style={{
            flex: 1, padding: "12px 0", background: "none", border: "none",
            borderBottom: aba === a.v ? `3px solid ${NAVY}` : "3px solid transparent",
            color: aba === a.v ? NAVY : "#888", fontWeight: aba === a.v ? 800 : 600, fontSize: 13, cursor: "pointer"
          }}>
            {a.l} <span style={{ background: aba === a.v ? NAVY : "#ccc", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, marginLeft: 4 }}>{a.n}</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por nome ou cargo..." style={inputS} />

        {aba === "trabalhadores" && (
          <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ ...selS, marginBottom: 12 }}>
            <option value="todas">Todas as obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        )}

        {filtrados.length === 0 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 30, textAlign: "center", color: "#aaa" }}>
            📞 {lista.length === 0 ? "Nenhum contato com telefone cadastrado." : "Nenhum resultado para a busca."}
          </div>
        )}

        {Object.entries(grupos).map(([nomeObra, pessoas]) => (
          <div key={nomeObra} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>📍 {nomeObra}</div>
            {pessoas.map(p => {
              const tel = limparTel(p.tel);
              return (
                <div key={p.id} style={{ background: "#fff", borderRadius: 12, padding: "10px 12px", marginBottom: 6, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
                  <div onClick={() => onVerTrabalhador && aba === "trabalhadores" && onVerTrabalhador(p)} style={{ width: 38, height: 38, borderRadius: 19, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginRight: 10, cursor: aba === "trabalhadores" ? "pointer" : "default" }}>
                    {aba === "trabalhadores" ? "👷" : "🏢"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }} onClick={() => onVerTrabalhador && aba === "trabalhadores" && onVerTrabalhador(p)}>
                    <div style={{ fontWeight: 700, color: NAVY, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{p.cargo || "Encarregado"} • {p.tel}</div>
                  </div>
                  <a href={`tel:+55${tel}`} style={{ background: BLUE, color: "#fff", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", marginRight: 6, fontSize: 16 }}>📞</a>
                  <a href={`https://wa.me/55${tel}`} target="_blank" rel="noreferrer" style={{ background: "#25D366", color: "#fff", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 16 }}>💬</a>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   ADIANTAMENTOS / VALES
════════════════════════════════════ */

export function TelaAdiantamentos({ obras, trabalhadores, adiantamentos, onBack, onAdd, onRemove }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ trabId: "", valor: "", motivo: "", data: new Date().toLocaleDateString("pt-BR") });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const salvar = () => {
    if (!form.trabId || !form.valor) return;
    onAdd({ id: Date.now(), trabId: parseInt(form.trabId), valor: parseFloat(form.valor), motivo: form.motivo, data: form.data, ts: Date.now(), descontado: false });
    setForm({ trabId: "", valor: "", motivo: "", data: new Date().toLocaleDateString("pt-BR") });
    setModal(false);
  };

  // Adiantamentos do mês atual
  const hoje = new Date();
  const ehMesAtual = (data) => {
    try {
      const [d, m, a] = data.split("/");
      return parseInt(m) - 1 === hoje.getMonth() && parseInt(a) === hoje.getFullYear();
    } catch { return false; }
  };

  const adiantMes = adiantamentos.filter(a => ehMesAtual(a.data));
  const totalMes = adiantMes.reduce((s, a) => s + a.valor, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Adiantamentos" sub="Vales e antecipações" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ background: `linear-gradient(135deg,${ORANGE},#c2410c)`, borderRadius: 14, padding: 16, marginBottom: 12, color: "#fff", boxShadow: "0 4px 14px #ea580c44" }}>
          <div style={{ fontSize: 11, opacity: 0.9 }}>Total adiantado este mês</div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>R$ {totalMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>{adiantMes.length} adiantamento(s) registrado(s)</div>
        </div>

        <div style={{ background: "#fffaeb", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "#8b6f00", marginBottom: 12 }}>
          💡 Os adiantamentos do mês atual são automaticamente descontados na 2ª quinzena.
        </div>

        <Btn label="➕ Registrar Adiantamento" color={ORANGE} onClick={() => setModal(true)} style={{ marginBottom: 14 }} />

        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, fontSize: 13 }}>📜 Histórico</div>
        {adiantamentos.length === 0 && <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", color: "#aaa" }}>Nenhum adiantamento registrado.</div>}
        {[...adiantamentos].sort((a, b) => b.ts - a.ts).map(a => {
          const t = trabalhadores.find(x => x.id === a.trabId);
          const obra = obras.find(o => o.id === t?.obraId);
          return (
            <div key={a.id} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${ORANGE}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{t?.nome || "—"}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{t?.cargo} • {obra?.nome}</div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>📅 {a.data}</div>
                  {a.motivo && <div style={{ fontSize: 11, color: "#777", fontStyle: "italic", marginTop: 2 }}>"{a.motivo}"</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: ORANGE }}>R$ {a.valor.toFixed(2)}</div>
                  <button onClick={() => { confirmar("Remover este adiantamento?", () => { onRemove(a.id); }); }} style={{ background: "#fee2e2", border: "2px solid #d63b3b", color: "#d63b3b", cursor: "pointer", fontSize: 16, marginTop: 2, padding: "6px 10px", borderRadius: 8, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <KMFooter />

      <Modal show={modal} title="Novo Adiantamento" onClose={() => setModal(false)}>
        <label style={labelS}>Trabalhador</label>
        <select value={form.trabId} onChange={e => set("trabId", e.target.value)} style={selS}>
          <option value="">Selecione</option>
          {trabalhadores.map(t => <option key={t.id} value={t.id}>{t.nome} — {t.cargo}</option>)}
        </select>
        <label style={labelS}>Valor (R$)</label>
        <input value={form.valor} onChange={e => set("valor", e.target.value)} type="number" placeholder="500,00" style={inputS} />
        <label style={labelS}>Motivo (opcional)</label>
        <input value={form.motivo} onChange={e => set("motivo", e.target.value)} placeholder="Ex: emergência, mercado, etc." style={inputS} />
        <label style={labelS}>Data</label>
        <input value={form.data} onChange={e => set("data", e.target.value)} placeholder="DD/MM/AAAA" style={inputS} />
        <Btn label="✓ REGISTRAR" color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   EXAMES MÉDICOS (ASO) — controle e renovação
════════════════════════════════════ */

export function TelaExames({ obras, trabalhadores, onBack, onVerTrabalhador }) {
  const [filtro, setFiltro] = useState("vence_30"); // vence_30 | vencido | apto | inapto | sem_aso

  const checaASO = (t) => {
    if (!t.asoValidade) return { tem: false };
    try {
      const v = new Date(t.asoValidade);
      const dias = Math.ceil((v - new Date()) / (1000 * 60 * 60 * 24));
      return { tem: true, dias, vencido: dias < 0, vencendo: dias >= 0 && dias <= 30, ok: dias > 30 };
    } catch { return { tem: false }; }
  };

  const trabComStatus = trabalhadores.map(t => ({ ...t, _aso: checaASO(t) }));

  const grupos = {
    vencido: trabComStatus.filter(t => t._aso.vencido),
    vence_30: trabComStatus.filter(t => t._aso.vencendo),
    apto: trabComStatus.filter(t => t._aso.ok && t.asoStatus === "Apto"),
    inapto: trabComStatus.filter(t => t.asoStatus === "Inapto" || t.asoStatus === "Apto com restrições"),
    sem_aso: trabComStatus.filter(t => !t._aso.tem),
  };

  const lista = grupos[filtro] || [];

  const exportar = () => {
    const titulo = { vencido: "ASO Vencidos", vence_30: "ASO Vencendo (30 dias)", apto: "Aptos", inapto: "Inaptos / Restrições", sem_aso: "Sem ASO Cadastrado" }[filtro];
    const html = `<html><head><title>${titulo}</title>
      <style>
        ${KM_PDF_PAGE_CSS}
        @page { size: A4 portrait; margin: 12mm 10mm; }
        @media print { body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        body { font-family: Arial; color: #222; margin: 0 auto; max-width: 190mm; padding: 6mm 4mm; box-sizing: border-box; }
        h1, h2, h3 { page-break-after: avoid; break-after: avoid; }
        h1 { color: #004080; border-bottom: 3px solid #C0A040; padding-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; table-layout: auto; page-break-inside: auto; break-inside: auto; }
        tr { page-break-inside: avoid; break-inside: avoid; }
        thead { display: table-header-group; }
        th { background: #004080; color: #fff; padding: 8px; white-space: nowrap; }
        td { padding: 6px 8px; border: 1px solid #ddd; vertical-align: top; overflow-wrap: break-word; word-break: normal; }
        /* Coluna do nome (1ª): NÃO quebra, se alarga ao texto */
        th:first-child, td:first-child { white-space: nowrap; min-width: 110px; }
        /* Coluna 2 (cargo): NÃO quebra */
        th:nth-child(2), td:nth-child(2) { white-space: nowrap; min-width: 80px; }
        /* Datas/status: não quebram */
        th:nth-child(4), td:nth-child(4), th:nth-child(5), td:nth-child(5) { white-space: nowrap; }
        td.td-wrap { white-space: normal; overflow-wrap: break-word; word-break: normal; }
        tr:nth-child(even) td { background: #f5f8fc; }
      </style></head><body>
      <h1>🏥 Controle de Exames Médicos — ${titulo}</h1>
      <p><b>Total:</b> ${lista.length} trabalhador(es) • <b>Gerado:</b> ${new Date().toLocaleString("pt-BR")}</p>
      <table>
        <tr><th>Nome</th><th>Cargo</th><th>Obra</th><th>Validade</th><th>Status</th><th>Telefone</th></tr>
        ${lista.map(t => {
          const obra = obras.find(o => o.id === t.obraId);
          return `<tr>
            <td><b>${t.nome}</b></td>
            <td>${t.cargo}</td>
            <td>${obra?.nome || "—"}</td>
            <td>${t.asoValidade ? new Date(t.asoValidade).toLocaleDateString("pt-BR") : "—"}</td>
            <td>${t.asoStatus || "—"}</td>
            <td>${t.tel || "—"}</td>
          </tr>`;
        }).join("")}
      </table>
      <script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
      </body></html>`;
    abrirOuBaixarHTML(html, `Exames-${titulo.replace(/\s/g, "_")}.html`);
  };

  const cores = {
    vencido: { bg: RED, light: "#fef2f2", icon: "❌", titulo: "ASO Vencido" },
    vence_30: { bg: ORANGE, light: "#fff8f0", icon: "⚠️", titulo: "Vencendo em 30 dias" },
    apto: { bg: GREEN, light: "#f0fdf4", icon: "✅", titulo: "Aptos" },
    inapto: { bg: RED, light: "#fef2f2", icon: "🚫", titulo: "Inaptos / Restrições" },
    sem_aso: { bg: "#888", light: "#f5f5f5", icon: "❓", titulo: "Sem ASO" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Exames Médicos" sub="Controle de ASO" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* Resumo */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {Object.entries(grupos).map(([k, l]) => {
            const c = cores[k];
            return (
              <button key={k} onClick={() => setFiltro(k)} style={{ background: filtro === k ? c.bg : "#fff", color: filtro === k ? "#fff" : NAVY, border: filtro === k ? "none" : `1.5px solid ${c.bg}33`, borderRadius: 12, padding: "10px 8px", cursor: "pointer", textAlign: "left", boxShadow: filtro === k ? `0 4px 14px ${c.bg}55` : "none" }}>
                <div style={{ fontSize: 22 }}>{c.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>{l.length}</div>
                <div style={{ fontSize: 10, opacity: filtro === k ? 0.9 : 0.7 }}>{c.titulo}</div>
              </button>
            );
          })}
        </div>

        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{cores[filtro].icon} {cores[filtro].titulo} • {lista.length}</span>
          {lista.length > 0 && <button onClick={exportar} style={{ background: "none", border: `1px solid ${BLUE}`, color: BLUE, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>📄 PDF</button>}
        </div>

        {lista.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, textAlign: "center", color: "#aaa" }}>
            {filtro === "vencido" && "🎉 Nenhum exame vencido!"}
            {filtro === "vence_30" && "✅ Nenhum exame vencendo nos próximos 30 dias."}
            {filtro === "apto" && "Nenhum trabalhador apto cadastrado."}
            {filtro === "inapto" && "✅ Nenhum trabalhador inapto."}
            {filtro === "sem_aso" && "🎉 Todos os trabalhadores têm ASO cadastrado."}
          </div>
        ) : lista.map(t => {
          const obra = obras.find(o => o.id === t.obraId);
          return (
            <div key={t.id} onClick={() => onVerTrabalhador(t)} style={{ background: "#fff", borderRadius: 12, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer", borderLeft: `4px solid ${cores[filtro].bg}` }}>
              {t.foto ? (
                <img src={t.foto} alt="" style={{ width: 40, height: 40, borderRadius: 20, objectFit: "cover", marginRight: 10, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 20, background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginRight: 10, flexShrink: 0 }}>👷</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{t.nome}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{t.cargo} • {obra?.nome || "—"}</div>
                {t.asoValidade && (
                  <div style={{ fontSize: 11, color: cores[filtro].bg, fontWeight: 700, marginTop: 2 }}>
                    {filtro === "vencido" && `❌ Vencido há ${Math.abs(t._aso.dias)} dia(s)`}
                    {filtro === "vence_30" && `⚠️ Vence em ${t._aso.dias} dia(s) — ${new Date(t.asoValidade).toLocaleDateString("pt-BR")}`}
                    {filtro === "apto" && `✅ Válido até ${new Date(t.asoValidade).toLocaleDateString("pt-BR")}`}
                    {filtro === "inapto" && `🚫 ${t.asoStatus}`}
                  </div>
                )}
                {filtro === "sem_aso" && <div style={{ fontSize: 11, color: "#888", fontStyle: "italic", marginTop: 2 }}>Sem cadastro de exame</div>}
              </div>
              {t.tel && (
                <a href={`https://wa.me/55${t.tel.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ background: "#25D366", color: "#fff", borderRadius: 7, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 14, marginRight: 4 }}>💬</a>
              )}
              <span style={{ color: "#ccc", fontSize: 18 }}>›</span>
            </div>
          );
        })}

        <div style={{ background: "#fffaeb", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "#8b6f00", marginTop: 14 }}>
          💡 <b>Dica:</b> Toque em um trabalhador para editar a data do próximo exame.
        </div>
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   MANUTENÇÃO PREVENTIVA — Ativos e Ferramentas
════════════════════════════════════ */
