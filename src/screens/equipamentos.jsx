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

export function TelaEquip({ obra, equips, onBack, onSaveEquips }) {
  const obraEquips = equips.filter(e => e.obraId === obra.id);
  const [local, setLocal] = useState(obraEquips);
  const ciclo = { "Em Uso": "Disponível", "Disponível": "Em Uso", "Quebrada": "Disponível" };
  const toggle = (id) => setLocal(es => es.map(e => e.id === id ? { ...e, status: ciclo[e.status] } : e));

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Controle de Equipamentos" sub={obra.nome} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 12 }}>
        {local.map(eq => (
          <div key={eq.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 30, marginRight: 12 }}>{eq.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{eq.nome}</div>
              <div style={{ fontSize: 11, color: "#999" }}>Cód: {eq.codigo}</div>
            </div>
            <button onClick={() => toggle(eq.id)} style={{ background: EQUIP_COLOR[eq.status], color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{eq.status}</button>
          </div>
        ))}
        {local.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: 30 }}>Nenhum equipamento nesta obra.</div>}
        <Btn label="💾 Salvar Alterações" color={GREEN} onClick={() => { onSaveEquips(local); onBack(); }} style={{ marginTop: 8 }} />
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   PAINEL GESTOR
════════════════════════════════════ */
/* ════════════════════════════════════
   TABELA RESUMO DA EQUIPE (Padrão Elite) — na home do gestor
════════════════════════════════════ */

export function TelaEquipamentosGestao({ obras, equips, onBack, onAdd, onEditar, onRemover }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [filtroObra, setFiltroObra] = useState("todas");
  const [form, setForm] = useState({ nome: "", codigo: "", obraId: "", status: "Disponível", icon: "🔧" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lista = filtroObra === "todas" ? equips : equips.filter(e => String(e.obraId) === String(filtroObra));

  const abrirNovo = () => { setEditandoId(null); setForm({ nome: "", codigo: "", obraId: "", status: "Disponível", icon: "🔧" }); setModal(true); };
  const abrirEdit = (eq) => { setEditandoId(eq.id); setForm(eq); setModal(true); };
  const salvar = () => {
    if (!form.nome || !form.codigo || !form.obraId) return;
    if (editandoId) onEditar({ ...form, id: editandoId });
    else onAdd({ ...form, id: Date.now(), obraId: parseInt(form.obraId) });
    setModal(false);
  };

  const ICONS = ["🔧", "🔄", "🏗️", "⚙️", "🔨", "🪓", "🧰", "🪛", "⛏️", "🪜"];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Equipamentos" sub="Gestão completa" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 12 }}>
        <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ ...selS, marginBottom: 12 }}>
          <option value="todas">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        {lista.map(eq => {
          const obra = obras.find(o => o.id === eq.obraId);
          return (
            <div key={eq.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 30, marginRight: 12 }}>{eq.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{eq.nome}</div>
                <div style={{ fontSize: 11, color: "#999" }}>{eq.codigo} • {obra?.nome}</div>
              </div>
              <Badge label={eq.status} color={EQUIP_COLOR[eq.status] || "#888"} small />
              <button onClick={() => abrirEdit(eq)} style={{ background: "none", border: "none", color: BLUE, fontSize: 16, marginLeft: 8, cursor: "pointer" }}>✏️</button>
              <button onClick={() => onRemover(eq.id)} style={{ background: "#fee2e2", border: "2px solid #d63b3b", color: "#d63b3b", fontSize: 16, marginLeft: 4, cursor: "pointer", padding: "6px 10px", borderRadius: 8, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>
            </div>
          );
        })}
        {lista.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: 20 }}>Nenhum equipamento.</div>}
        <Btn label="➕ Adicionar Equipamento" color={NAVY} onClick={abrirNovo} style={{ marginTop: 8 }} />
      </div>
      <KMFooter />

      <Modal show={modal} title={editandoId ? "Editar Equipamento" : "Novo Equipamento"} onClose={() => setModal(false)}>
        <label style={labelS}>Nome</label>
        <input
          value={form.nome}
          onChange={e => {
            const novoNome = e.target.value;
            set("nome", novoNome);
            // Auto-preenche o ícone se o nome bater com um do catálogo
            const itemCat = CATALOGO_EQUIPAMENTOS.find(c => c.nome === novoNome);
            if (itemCat) set("icon", itemCat.icon);
          }}
          list="catalogo-equipamentos"
          placeholder="Ex: Betoneira"
          style={inputS}
        />
        <datalist id="catalogo-equipamentos">
          {CATALOGO_EQUIPAMENTOS_NOMES.map(n => <option key={n} value={n} />)}
        </datalist>
        <label style={labelS}>Código</label>
        <input value={form.codigo} onChange={e => set("codigo", e.target.value)} placeholder="Ex: EQ045" style={inputS} />
        <label style={labelS}>Obra</label>
        <select value={form.obraId} onChange={e => set("obraId", parseInt(e.target.value))} style={selS}>
          <option value="">Selecione</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <label style={labelS}>Status</label>
        <select value={form.status} onChange={e => set("status", e.target.value)} style={selS}>
          <option>Disponível</option><option>Em Uso</option><option>Quebrada</option>
        </select>
        <label style={labelS}>Ícone</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {ICONS.map(i => (
            <button key={i} onClick={() => set("icon", i)} style={{ width: 40, height: 40, fontSize: 22, border: form.icon === i ? `2px solid ${NAVY}` : "1px solid #ddd", borderRadius: 8, background: form.icon === i ? "#dde6f5" : "#fff", cursor: "pointer" }}>{i}</button>
          ))}
        </div>
        <Btn label={editandoId ? "SALVAR ALTERAÇÕES" : "ADICIONAR"} color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   BACKUP/RESTAURAR
════════════════════════════════════ */
/* ════════════════════════════════════
   GERAR SIMULAÇÃO DE 30 DIAS
════════════════════════════════════ */

export function TelaAtivos({ obras, ativos, abastecimentos, onBack, onAdd, onEditar, onRemover, onAbastecer }) {
  const [modal, setModal] = useState(false);
  const [modalAbast, setModalAbast] = useState(null); // ativo selecionado
  const [editandoId, setEditandoId] = useState(null);
  const [filtroObra, setFiltroObra] = useState("todas");
  const [form, setForm] = useState({ tipo: "Retroescavadeira", nome: "", placa: "", obraId: "", horimetro: 0, valorHora: 80, status: "Ativo" });
  const [formAbast, setFormAbast] = useState({ litros: "", valor: "", horimetro: "", combustivel: "Diesel", fotoCupom: null });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setAB = (k, v) => setFormAbast(f => ({ ...f, [k]: v }));

  const handleFotoCupom = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setAB("fotoCupom", ev.target.result);
    reader.readAsDataURL(file);
  };

  const lista = filtroObra === "todas" ? ativos : ativos.filter(a => String(a.obraId) === String(filtroObra));
  const TIPOS = ["Retroescavadeira", "Caminhão", "Betoneira Móvel", "Empilhadeira", "Caminhão Pipa", "Caminhonete", "Outro"];

  const abrirNovo = () => { setEditandoId(null); setForm({ tipo: "Retroescavadeira", nome: "", placa: "", obraId: "", horimetro: 0, valorHora: 80, status: "Ativo" }); setModal(true); };
  const abrirEdit = (a) => { setEditandoId(a.id); setForm(a); setModal(true); };
  const salvar = () => {
    if (!form.nome || !form.placa || !form.obraId) return;
    if (editandoId) onEditar({ ...form, id: editandoId, obraId: parseInt(form.obraId), horimetro: parseFloat(form.horimetro) || 0, valorHora: parseFloat(form.valorHora) || 0 });
    else onAdd({ ...form, id: Date.now(), obraId: parseInt(form.obraId), horimetro: parseFloat(form.horimetro) || 0, valorHora: parseFloat(form.valorHora) || 0 });
    setModal(false);
  };

  const abastecer = () => {
    if (!formAbast.litros || !formAbast.valor) return;
    onAbastecer({
      id: Date.now(), ativoId: modalAbast.id, obraId: modalAbast.obraId,
      litros: parseFloat(formAbast.litros), valor: parseFloat(formAbast.valor),
      horimetro: parseFloat(formAbast.horimetro) || 0, combustivel: formAbast.combustivel,
      fotoCupom: formAbast.fotoCupom,
      data: new Date().toLocaleDateString("pt-BR"), ts: Date.now(),
    });
    setModalAbast(null);
    setFormAbast({ litros: "", valor: "", horimetro: "", combustivel: "Diesel", fotoCupom: null });
  };

  const ICONS = { "Retroescavadeira": "🚜", "Caminhão": "🚛", "Betoneira Móvel": "🚧", "Empilhadeira": "🏗️", "Caminhão Pipa": "🚿", "Caminhonete": "🛻", "Outro": "⚙️" };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Ativos & Frota" sub="Veículos e maquinário" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 12 }}>
        <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ ...selS, marginBottom: 12 }}>
          <option value="todas">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        {lista.map(a => {
          const obra = obras.find(o => o.id === a.obraId);
          const meusAbast = abastecimentos.filter(x => x.ativoId === a.id);
          const totalAbast = meusAbast.reduce((s, x) => s + x.valor, 0);
          return (
            <div key={a.id} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 32, marginRight: 12 }}>{ICONS[a.tipo] || "⚙️"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{a.nome}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{a.tipo} • {a.placa}</div>
                  <div style={{ fontSize: 11, color: BLUE }}>📍 {obra?.nome || "—"}</div>
                </div>
                <button onClick={() => abrirEdit(a)} style={{ background: "none", border: "none", color: BLUE, fontSize: 16, cursor: "pointer" }}>✏️</button>
                <button onClick={() => { confirmar(`Remover ${a.nome}?`, () => { onRemover(a.id); }); }} style={{ background: "#fee2e2", border: "2px solid #d63b3b", color: "#d63b3b", fontSize: 16, cursor: "pointer", marginLeft: 4, padding: "6px 10px", borderRadius: 8, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, fontSize: 11 }}>
                <span style={{ background: "#f0f7ff", color: BLUE, padding: "3px 8px", borderRadius: 4, fontWeight: 700 }}>⏱️ {a.horimetro}h</span>
                <span style={{ background: "#f0fdf4", color: GREEN, padding: "3px 8px", borderRadius: 4, fontWeight: 700 }}>R$ {a.valorHora}/h</span>
                {totalAbast > 0 && <span style={{ background: "#fff8f0", color: ORANGE, padding: "3px 8px", borderRadius: 4, fontWeight: 700 }}>⛽ R$ {totalAbast.toFixed(2)}</span>}
              </div>
              <button onClick={() => setModalAbast(a)} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "none", background: ORANGE, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>⛽ Registrar Abastecimento</button>
            </div>
          );
        })}
        {lista.length === 0 && (
          <EmptyState
            icon="🚜"
            titulo="Nenhum ativo cadastrado"
            subtitulo="Cadastre máquinas, veículos e equipamentos motorizados. Você poderá controlar combustível, manutenções e movimentação entre obras."
            cor={ORANGE}
          />
        )}
        <Btn label="➕ Cadastrar Ativo" color={NAVY} onClick={abrirNovo} style={{ marginTop: 8 }} />
      </div>
      <KMFooter />

      <Modal show={modal} title={editandoId ? "Editar Ativo" : "Novo Ativo"} onClose={() => setModal(false)}>
        <label style={labelS}>Tipo</label>
        <select value={form.tipo} onChange={e => set("tipo", e.target.value)} style={selS}>
          {TIPOS.map(t => <option key={t}>{t}</option>)}
        </select>
        <label style={labelS}>Nome / Identificação</label>
        <input
          value={form.nome}
          onChange={e => {
            const novoNome = e.target.value;
            set("nome", novoNome);
            // Auto-preenche tipo, combustível, valor-hora, etc se bater com catálogo
            const itemCat = CATALOGO_FROTA.find(c => c.nome === novoNome);
            if (itemCat) {
              set("tipo", itemCat.tipo);
              if (itemCat.combustivel) set("combustivel", itemCat.combustivel);
              if (itemCat.consumoMedio !== undefined) set("consumoMedio", itemCat.consumoMedio);
              if (itemCat.valorHora !== undefined) set("valorHora", itemCat.valorHora);
            }
          }}
          list="catalogo-frota"
          placeholder="Ex: Retro 01, Caminhão Pipa, Escavadeira..."
          style={inputS}
        />
        <datalist id="catalogo-frota">
          {CATALOGO_FROTA_NOMES.map(n => <option key={n} value={n} />)}
        </datalist>
        <label style={labelS}>Placa</label>
        <input value={form.placa} onChange={e => set("placa", e.target.value)} placeholder="ABC-1234" style={inputS} />
        <label style={labelS}>Obra</label>
        <select value={form.obraId} onChange={e => set("obraId", e.target.value === "" ? "" : parseInt(e.target.value))} style={selS}>
          <option value="">Selecione</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <label style={labelS}>Horímetro / Odômetro atual</label>
        <input value={form.horimetro} onChange={e => set("horimetro", e.target.value)} type="number" placeholder="0" style={inputS} />
        <label style={labelS}>Valor por hora (R$)</label>
        <input value={form.valorHora} onChange={e => set("valorHora", e.target.value)} type="number" placeholder="80" style={inputS} />
        <Btn label={editandoId ? "SALVAR" : "ADICIONAR"} color={GREEN} onClick={salvar} />
      </Modal>

      <Modal show={!!modalAbast} title={`⛽ Abastecer ${modalAbast?.nome || ""}`} onClose={() => setModalAbast(null)}>
        <label style={labelS}>Combustível</label>
        <select value={formAbast.combustivel} onChange={e => setAB("combustivel", e.target.value)} style={selS}>
          <option>Diesel</option><option>Gasolina</option><option>Etanol</option><option>Arla</option>
        </select>
        <label style={labelS}>Litros</label>
        <input value={formAbast.litros} onChange={e => setAB("litros", e.target.value)} type="number" placeholder="50" style={inputS} />
        <label style={labelS}>Valor total (R$)</label>
        <input value={formAbast.valor} onChange={e => setAB("valor", e.target.value)} type="number" placeholder="450,00" style={inputS} />
        <label style={labelS}>Horímetro / Odômetro atual</label>
        <input value={formAbast.horimetro} onChange={e => setAB("horimetro", e.target.value)} type="number" placeholder={modalAbast?.horimetro?.toString()} style={inputS} />

        <label style={labelS}>📸 Foto do Cupom</label>
        {formAbast.fotoCupom ? (
          <div style={{ position: "relative", marginBottom: 12 }}>
            <img src={formAbast.fotoCupom} alt="Cupom" style={{ width: "100%", borderRadius: 10, border: "1.5px solid #dde2ef" }} />
            <button onClick={() => setAB("fotoCupom", null)} style={{ position: "absolute", top: 6, right: 6, background: RED, color: "#fff", border: "none", borderRadius: 16, width: 28, height: 28, cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        ) : (
          <label style={{ display: "block", padding: 14, borderRadius: 10, border: "1.5px dashed #c5d0e5", background: "#f9fafb", textAlign: "center", cursor: "pointer", fontSize: 13, color: "#666", marginBottom: 12 }}>
            📷 Tirar foto do cupom fiscal
            <input type="file" accept="image/*" capture="environment" onChange={handleFotoCupom} style={{ display: "none" }} />
          </label>
        )}

        <Btn label="✓ REGISTRAR" color={GREEN} onClick={abastecer} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   APROPRIAÇÃO DE CUSTOS POR OBRA
════════════════════════════════════ */
/* ════════════════════════════════════
   FROTA & COMBUSTÍVEL — dashboard executivo
════════════════════════════════════ */

export function TelaFrota({ obras, ativos, abastecimentos, onBack, onNav }) {
  const [periodo, setPeriodo] = useState("mes"); // semana | mes | trimestre | ano
  const [filtroAtivo, setFiltroAtivo] = useState("todos");

  const hoje = new Date();
  const calcDataInicio = () => {
    const d = new Date(hoje);
    if (periodo === "semana") d.setDate(d.getDate() - 7);
    else if (periodo === "mes") d.setMonth(d.getMonth() - 1);
    else if (periodo === "trimestre") d.setMonth(d.getMonth() - 3);
    else if (periodo === "ano") d.setFullYear(d.getFullYear() - 1);
    return d;
  };
  const dataInicio = calcDataInicio();

  const dataDeStr = (s) => {
    if (!s) return null;
    try { const [d, m, y] = s.split("/"); return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)); } catch { return null; }
  };

  // Filtrar abastecimentos por período
  const abastFiltrados = (abastecimentos || []).filter(a => {
    const d = dataDeStr(a.data);
    if (!d) return false;
    if (d < dataInicio || d > hoje) return false;
    if (filtroAtivo !== "todos" && String(a.ativoId) !== String(filtroAtivo)) return false;
    return true;
  });

  // KPIs gerais
  const totalGasto = abastFiltrados.reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);
  const totalLitros = abastFiltrados.reduce((s, a) => s + (parseFloat(a.litros) || 0), 0);
  const valorPorLitro = totalLitros > 0 ? totalGasto / totalLitros : 0;
  const totalAbastecimentos = abastFiltrados.length;

  // Por veículo
  const porVeiculo = (ativos || []).map(a => {
    const abasts = abastFiltrados.filter(x => x.ativoId === a.id);
    const gasto = abasts.reduce((s, x) => s + (parseFloat(x.valor) || 0), 0);
    const litros = abasts.reduce((s, x) => s + (parseFloat(x.litros) || 0), 0);
    return { ativo: a, gasto, litros, qtd: abasts.length };
  }).filter(v => v.gasto > 0).sort((a, b) => b.gasto - a.gasto);

  // Por obra
  const porObra = obras.map(o => {
    const abasts = abastFiltrados.filter(x => x.obraId === o.id);
    const gasto = abasts.reduce((s, x) => s + (parseFloat(x.valor) || 0), 0);
    return { obra: o, gasto, qtd: abasts.length };
  }).filter(o => o.gasto > 0).sort((a, b) => b.gasto - a.gasto);

  // Evolução por dia (últimos 14 dias)
  const evolucao = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    const dStr = d.toLocaleDateString("pt-BR");
    const gastoDia = abastFiltrados
      .filter(a => a.data === dStr)
      .reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);
    evolucao.push({
      dia: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      valor: gastoDia,
    });
  }

  const cores = ["#0f2151", "#f5a623", "#2aa84f", "#dc2626", "#7c3aed", "#0891b2", "#ea580c"];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Frota & Combustível" sub="Dashboard executivo" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* Filtros */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <label style={labelS}>📅 Período</label>
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {[
              { v: "semana", l: "7d" },
              { v: "mes", l: "30d" },
              { v: "trimestre", l: "90d" },
              { v: "ano", l: "1 ano" },
            ].map(p => (
              <button key={p.v} onClick={() => setPeriodo(p.v)} style={{
                flex: 1, padding: "6px 4px", borderRadius: 6,
                border: "none",
                background: periodo === p.v ? NAVY : "#f3f4f6",
                color: periodo === p.v ? "#fff" : "#666",
                fontSize: 11, fontWeight: 700, cursor: "pointer"
              }}>{p.l}</button>
            ))}
          </div>
          <label style={labelS}>🚗 Veículo</label>
          <select value={filtroAtivo} onChange={e => setFiltroAtivo(e.target.value)} style={selS}>
            <option value="todos">Todos os veículos</option>
            {(ativos || []).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          <div style={{ background: `linear-gradient(135deg,${ORANGE},#dc7e00)`, color: "#fff", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 10, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5 }}>💰 Total gasto</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>R$ {totalGasto.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>{totalAbastecimentos} abastecimentos</div>
          </div>
          <div style={{ background: `linear-gradient(135deg,${BLUE},#0c4a6e)`, color: "#fff", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 10, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5 }}>⛽ Litros</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{totalLitros.toFixed(0)}L</div>
            <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>R$ {valorPorLitro.toFixed(2)}/litro</div>
          </div>
        </div>

        {/* Gráfico evolução */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, fontSize: 13, marginBottom: 8 }}>📈 Evolução (últimos 14 dias)</div>
          {evolucao.every(e => e.valor === 0) ? (
            <div style={{ color: "#aaa", fontSize: 11, textAlign: "center", padding: 16 }}>Sem abastecimentos nos últimos 14 dias.</div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="dia" tick={{ fontSize: 9 }} interval={1} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => "R$ " + v} />
                <Tooltip formatter={(v) => "R$ " + v.toFixed(2)} />
                <Line type="monotone" dataKey="valor" stroke={ORANGE} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Por veículo (barras) */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, fontSize: 13, marginBottom: 8 }}>🚗 Gasto por veículo</div>
          {porVeiculo.length === 0 ? (
            <div style={{ color: "#aaa", fontSize: 11, textAlign: "center", padding: 16 }}>Nenhum abastecimento no período.</div>
          ) : (
            <>
              {porVeiculo.map((v, i) => {
                const max = porVeiculo[0].gasto;
                const pct = (v.gasto / max) * 100;
                return (
                  <div key={v.ativo.id} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: NAVY }}>
                        {v.ativo.tipo === "Carro" ? "🚗" : v.ativo.tipo === "Moto" ? "🏍️" : v.ativo.tipo === "Caminhão" ? "🚛" : "🚜"} {v.ativo.nome}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: NAVY }}>R$ {v.gasto.toFixed(2)}</div>
                    </div>
                    <div style={{ height: 8, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: pct + "%", height: "100%", background: cores[i % cores.length], transition: "width 0.3s" }}></div>
                    </div>
                    <div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>
                      {v.litros.toFixed(0)}L • {v.qtd} abastecimentos
                      {v.ativo.consumoMedio && v.litros > 0 && (
                        <span> • Consumo médio: <b style={{ color: GREEN }}>{v.ativo.consumoMedio} {v.ativo.tipo === "Retroescavadeira" ? "L/h" : "km/L"}</b></span>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Por obra */}
        {porObra.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, color: NAVY, fontSize: 13, marginBottom: 8 }}>🏗️ Gasto por obra</div>
            {porObra.map((o, i) => {
              const pct = (o.gasto / totalGasto) * 100;
              return (
                <div key={o.obra.id} style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: i < porObra.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <div style={{ width: 8, height: 36, borderRadius: 4, background: cores[i % cores.length], marginRight: 10 }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{o.obra.nome}</div>
                    <div style={{ fontSize: 9, color: "#888" }}>{o.qtd} abastecimentos • {pct.toFixed(1)}% do total</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>R$ {o.gasto.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Lista de veículos pra editar */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <div style={{ flex: 1, fontWeight: 800, color: NAVY, fontSize: 13 }}>🚙 Frota cadastrada ({(ativos || []).length})</div>
            <button onClick={() => onNav && onNav("ativos")} style={{ background: NAVY, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Gerenciar</button>
          </div>
          {(ativos || []).map(a => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 22, marginRight: 8 }}>{a.tipo === "Carro" ? "🚗" : a.tipo === "Moto" ? "🏍️" : a.tipo === "Caminhão" ? "🚛" : "🚜"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{a.nome}</div>
                <div style={{ fontSize: 9, color: "#888" }}>
                  {a.placa || "Sem placa"}
                  {a.responsavel && ` • ${a.responsavel}`}
                  {a.combustivel && ` • ⛽ ${a.combustivel}`}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   DESPESAS AVULSAS — Pipa, Frete, Almoço motorista, etc
════════════════════════════════════ */
export const CATEGORIAS_DESPESA = [
  { id: "pipa",     nome: "💧 Pipa d'água",         cor: "#0891b2", desc: "Caminhão pipa pra molhar a obra" },
  { id: "frete",    nome: "🚛 Frete avulso",        cor: "#0f2151", desc: "Transporte de material/equipamento" },
  { id: "almoco",   nome: "🍱 Almoço de terceiros", cor: "#f97316", desc: "Almoço motorista/visita do fornecedor" },
  { id: "solo",     nome: "🚜 Viagem de solo/bica", cor: "#92400e", desc: "Caminhões trazendo material" },
  { id: "hospedagem", nome: "🏨 Hospedagem",        cor: "#7c3aed", desc: "Estadia equipe externa" },
  { id: "diaria_extra", nome: "💵 Diária extra",    cor: "#dc2626", desc: "Pagamento avulso fora da folha" },
  { id: "manutencao_avulsa", nome: "🔧 Manutenção avulsa", cor: "#525252", desc: "Conserto pontual" },
  { id: "taxas",    nome: "📋 Taxas / impostos",    cor: "#16a34a", desc: "Taxas, alvarás, ART" },
  { id: "outros",   nome: "💸 Outros",              cor: "#6b7280", desc: "Outras despesas avulsas" },
];


export function TelaSolicitarMov({ obras, trabalhadores, usuario, onBack, onSolicitar }) {
  const [trabId, setTrabId] = useState("");
  const [obraDestino, setObraDestino] = useState("");
  const [tipo, setTipo] = useState("hoje");
  const [motivo, setMotivo] = useState("");
  const [ok, setOk] = useState(false);

  // Encarregado vê todos os trabalhadores (banco geral)
  const obraAtual = obras.find(o => o.id === usuario?.obraId);

  const enviar = () => {
    if (!trabId || !obraDestino) return;
    const t = trabalhadores.find(x => String(x.id) === String(trabId));
    onSolicitar({
      id: Date.now(),
      trabId: trabId,
      trabNome: t?.nome,
      obraOrigem: t?.obraId,
      obraDestino: obraDestino,
      tipo, motivo,
      solicitante: usuario?.nome,
      status: "Aguardando",
      data: new Date().toLocaleDateString("pt-BR"),
      ts: Date.now(),
    });
    setOk(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Mover Pessoal" sub="Solicitar movimentação" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {ok ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 64 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: GREEN, marginTop: 12 }}>Solicitação Enviada!</div>
            <div style={{ color: "#666", marginTop: 6, fontSize: 13 }}>O gestor receberá o pedido para aprovação.</div>
            <Btn label="Nova Solicitação" color={NAVY} onClick={() => { setOk(false); setTrabId(""); setObraDestino(""); setMotivo(""); }} style={{ marginTop: 24 }} />
            <Btn label="Voltar" color="#eee" text={NAVY} onClick={onBack} style={{ marginTop: 10 }} />
          </div>
        ) : (
          <>
            <div style={{ background: "#fff8e1", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#7b5800", marginBottom: 12 }}>
              ℹ️ A movimentação só será efetivada após aprovação do gestor.
            </div>

            <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <label style={labelS}>Trabalhador (banco geral)</label>
              <select value={trabId} onChange={e => setTrabId(e.target.value)} style={selS}>
                <option value="">Selecione</option>
                {[...trabalhadores].sort((a, b) => (a.nome || "").localeCompare(b.nome || "")).map(t => {
                  const o = obras.find(x => x.id === t.obraId);
                  return <option key={t.id} value={t.id}>{t.nome} — {t.cargo} ({o?.nome || "sem obra"})</option>;
                })}
              </select>

              <label style={labelS}>Obra de destino</label>
              <select value={obraDestino} onChange={e => setObraDestino(e.target.value)} style={selS}>
                <option value="">Selecione</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>

              <label style={labelS}>Tipo de movimentação</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {[
                  { v: "hoje", l: "Apenas hoje", icon: "📅" },
                  { v: "definitivo", l: "Definitivo", icon: "🔄" },
                ].map(t => (
                  <button key={t.v} onClick={() => setTipo(t.v)} style={{ flex: 1, padding: "12px 8px", borderRadius: 10, border: `2px solid ${tipo === t.v ? NAVY : "#dde2ef"}`, background: tipo === t.v ? "#dde6f5" : "#fff", color: tipo === t.v ? NAVY : "#666", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                    <div style={{ fontSize: 22 }}>{t.icon}</div>
                    {t.l}
                  </button>
                ))}
              </div>

              <label style={labelS}>Motivo</label>
              <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} placeholder="Ex: precisamos de pedreiro extra para concretagem..." style={{ ...inputS, resize: "none", marginBottom: 0 }} />
            </div>

            <Btn label="📤 ENVIAR SOLICITAÇÃO" color={ORANGE} onClick={enviar} />
          </>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   MOVIMENTAÇÃO DE EQUIPAMENTOS — entre obras
════════════════════════════════════ */
/* ════════════════════════════════════
   DETALHE MOV. EQUIPAMENTO/FERRAMENTA — visualização completa
════════════════════════════════════ */

export function TelaMovEquipDetalhe({ mov, obras, equips, ferramentas, usuario, onBack, onAprovar, onNegar, onDevolver }) {
  if (!mov) return null;
  const obraOrigem = obras.find(o => o.id === mov.obraOrigemId);
  const obraDestino = obras.find(o => o.id === mov.obraDestinoId);
  const item = mov.tipoItem === "equipamento"
    ? (equips || []).find(x => x.id === mov.itemId)
    : (ferramentas || []).find(x => x.id === mov.itemId);

  const cor = mov.status === "Aguardando" ? ORANGE : mov.status === "Aprovado" ? GREEN : mov.status === "Devolvido" ? BLUE : RED;
  const statusLabel = mov.status === "Aguardando" ? "⏳ Aguardando" : mov.status === "Aprovado" ? "✓ Aprovado" : mov.status === "Devolvido" ? "↩️ Devolvido" : "✕ Negado";

  const prazoInfo = (() => {
    if (!mov.prazo || mov.tipo !== "emprestimo" || mov.status !== "Aprovado") return null;
    const hoje = new Date();
    const prazo = new Date(mov.prazo);
    const dias = Math.ceil((prazo - hoje) / (1000 * 60 * 60 * 24));
    if (dias < 0) return { atrasado: true, dias: Math.abs(dias) };
    if (dias <= 2) return { vencendo: true, dias };
    return { dias };
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Detalhe da Movimentação" sub={mov.status} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* CABEÇALHO */}
        <div style={{ background: `linear-gradient(135deg,${cor},${cor}cc)`, color: "#fff", borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 36, marginRight: 10 }}>{mov.tipoItem === "equipamento" ? "⚙️" : "🔨"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
                {mov.tipoItem === "equipamento" ? "EQUIPAMENTO" : "FERRAMENTA"}
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>{mov.itemNome}</div>
              {mov.itemCodigo && <div style={{ fontSize: 11, opacity: 0.85 }}>{mov.itemCodigo}</div>}
            </div>
            <div style={{ background: "rgba(255,255,255,0.25)", padding: "4px 10px", borderRadius: 10, fontSize: 11, fontWeight: 800 }}>{statusLabel}</div>
          </div>
        </div>

        {/* TIPO DE MOVIMENTAÇÃO */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${BLUE}` }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>📋 Tipo</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>
            {mov.tipo === "emprestimo" ? "🔁 Empréstimo (volta depois)" : "↪️ Transferência (mudança definitiva)"}
          </div>
          {mov.prazo && mov.tipo === "emprestimo" && (
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              📅 Prazo de devolução: <b style={{ color: NAVY }}>{new Date(mov.prazo).toLocaleDateString("pt-BR")}</b>
              {prazoInfo?.atrasado && <span style={{ color: RED, fontWeight: 700 }}> • ⚠️ Atrasado {prazoInfo.dias} dias</span>}
              {prazoInfo?.vencendo && <span style={{ color: ORANGE, fontWeight: 700 }}> • ⏱️ Vence em {prazoInfo.dias} dia(s)</span>}
            </div>
          )}
        </div>

        {/* ROTA */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 8 }}>🔄 Rota da Movimentação</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, background: "#fef9e7", borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 9, color: "#8b6f00", fontWeight: 700, textTransform: "uppercase" }}>📤 Origem</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginTop: 2 }}>{mov.obraOrigemNome}</div>
              {obraOrigem?.local && <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{obraOrigem.local}</div>}
            </div>
            <div style={{ fontSize: 22, color: NAVY }}>→</div>
            <div style={{ flex: 1, background: "#f0fdf4", borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 9, color: "#14532d", fontWeight: 700, textTransform: "uppercase" }}>📥 Destino</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginTop: 2 }}>{mov.obraDestinoNome}</div>
              {obraDestino?.local && <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{obraDestino.local}</div>}
            </div>
          </div>
        </div>

        {/* SOLICITANTE / MOTIVO */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: "#888", fontWeight: 700, textTransform: "uppercase" }}>👷 Solicitante</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{mov.solicitante}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "#888", fontWeight: 700, textTransform: "uppercase" }}>📅 Data</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{mov.dataSolicitacao || "—"}</div>
            </div>
          </div>
          {mov.motivo && (
            <div style={{ background: "#fef9e7", borderRadius: 8, padding: 10, borderLeft: `3px solid ${ORANGE}` }}>
              <div style={{ fontSize: 10, color: "#8b6f00", fontWeight: 700, marginBottom: 2 }}>📝 Motivo / Observação</div>
              <div style={{ fontSize: 12, color: "#444", fontStyle: "italic" }}>"{mov.motivo}"</div>
            </div>
          )}
        </div>

        {/* INFO DO ITEM */}
        {item && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${NAVY}` }}>
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>🔍 Sobre o item</div>
            {item.tipo && <div style={{ fontSize: 11, color: "#666" }}>Tipo: <b style={{ color: NAVY }}>{item.tipo}</b></div>}
            {item.numeroSerie && <div style={{ fontSize: 11, color: "#666" }}>Nº Série: <b style={{ color: NAVY }}>{item.numeroSerie}</b></div>}
            {item.estado && <div style={{ fontSize: 11, color: "#666" }}>Estado: <b style={{ color: NAVY }}>{item.estado}</b></div>}
            {item.obs && <div style={{ fontSize: 11, color: "#666", fontStyle: "italic", marginTop: 4 }}>{item.obs}</div>}
          </div>
        )}

        {/* AÇÕES */}
        {usuario?.perfil === "gestor" && (
          <div style={{ marginTop: 12 }}>
            {mov.status === "Aguardando" && (
              <>
                <button onClick={() => { onAprovar(mov.id); onBack(); }} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14, marginBottom: 8, boxShadow: "0 4px 12px rgba(42,168,79,0.3)" }}>
                  ✓ APROVAR MOVIMENTAÇÃO
                </button>
                <button onClick={() => { confirmar("Negar esta movimentação?", () => { onNegar(mov.id); onBack(); }) }} style={{ width: "100%", padding: 12, borderRadius: 12, border: `1.5px solid ${RED}`, background: "#fff", color: RED, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                  ✕ Negar Movimentação
                </button>
              </>
            )}
            {mov.status === "Aprovado" && mov.tipo === "emprestimo" && (
              <button onClick={() => { confirmar(`Marcar "${mov.itemNome}" como devolvido a ${mov.obraOrigemNome}?`, () => { onDevolver(mov.id); onBack(); }) }} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: BLUE, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14, boxShadow: "0 4px 12px rgba(30,107,191,0.3)" }}>
                ↩️ Marcar como Devolvido
              </button>
            )}
            {mov.status === "Aprovado" && mov.tipo === "transferencia" && (
              <button onClick={() => { confirmar("Confirmar transferência?", () => { onDevolver(mov.id, true); onBack(); }) }} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14, boxShadow: "0 4px 12px rgba(42,168,79,0.3)" }}>
                ✓ Confirmar Recebimento
              </button>
            )}
          </div>
        )}
      </div>
      <KMFooter />
    </div>
  );
}


export function TelaMovEquip({ obras, equips, ferramentas, movEquip, usuario, onBack, onSolicitar, onAprovar, onNegar, onDevolver, onVerDetalhe }) {
  const [aba, setAba] = useState("ativas");
  const [modal, setModal] = useState(false);
  const [filtroObra, setFiltroObra] = useState("todas");
  const [form, setForm] = useState({
    tipoItem: "equipamento",
    itemId: "",
    obraDestino: "",
    tipo: "emprestimo",
    prazo: "",
    motivo: "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const itens = form.tipoItem === "equipamento" ? (equips || []) : (ferramentas || []);
  const itemEscolhido = itens.find(x => x.id === parseInt(form.itemId));
  const obraOrigem = itemEscolhido ? obras.find(o => o.id === itemEscolhido.obraId) : null;

  const enviar = () => {
    if (!form.itemId || !form.obraDestino) { alert("Selecione o item e a obra destino"); return; }
    if (form.tipo === "emprestimo" && !form.prazo) { alert("Defina o prazo de devolução"); return; }
    onSolicitar({
      id: Date.now(),
      tipoItem: form.tipoItem,
      itemId: parseInt(form.itemId),
      itemNome: itemEscolhido.nome,
      itemCodigo: itemEscolhido.codigo || "",
      obraOrigemId: itemEscolhido.obraId,
      obraOrigemNome: obraOrigem?.nome,
      obraDestinoId: parseInt(form.obraDestino),
      obraDestinoNome: obras.find(o => o.id === parseInt(form.obraDestino))?.nome,
      tipo: form.tipo,
      prazo: form.prazo,
      motivo: form.motivo,
      solicitante: usuario?.nome || "—",
      solicitantePerfil: usuario?.perfil || "—",
      status: usuario?.perfil === "gestor" ? "Aprovado" : "Aguardando",
      data: new Date().toLocaleDateString("pt-BR"),
      ts: Date.now(),
    });
    setForm({ tipoItem: "equipamento", itemId: "", obraDestino: "", tipo: "emprestimo", prazo: "", motivo: "" });
    setModal(false);
  };

  const lista = (movEquip || []).filter(m => {
    if (aba === "ativas") return m.status === "Aguardando" || m.status === "Aprovado" || m.status === "Em trânsito";
    return m.status === "Devolvido" || m.status === "Concluído" || m.status === "Negado";
  }).filter(m => filtroObra === "todas" || String(m.obraOrigemId) === String(filtroObra) || String(m.obraDestinoId) === String(filtroObra));

  const aguardando = (movEquip || []).filter(m => m.status === "Aguardando").length;
  const aprovadas = (movEquip || []).filter(m => m.status === "Aprovado").length;

  const checaPrazo = (m) => {
    if (m.tipo !== "emprestimo" || !m.prazo || m.status !== "Aprovado") return null;
    try {
      const fim = new Date(m.prazo);
      const dias = Math.ceil((fim - new Date()) / (1000 * 60 * 60 * 24));
      if (dias < 0) return { atrasado: true, dias: Math.abs(dias) };
      if (dias <= 2) return { vencendo: true, dias };
      return { ok: true, dias };
    } catch { return null; }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Mov. Equipamentos" sub="Empréstimos e transferências" onBack={onBack} />

      <div style={{ display: "flex", gap: 6, padding: "10px 12px 0", background: "#fff" }}>
        <div style={{ flex: 1, background: "#fff8f0", border: `1px solid ${ORANGE}33`, borderRadius: 8, padding: 8, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: ORANGE }}>{aguardando}</div>
          <div style={{ fontSize: 9, color: "#666" }}>Aguardando</div>
        </div>
        <div style={{ flex: 1, background: "#f0fdf4", border: `1px solid ${GREEN}33`, borderRadius: 8, padding: 8, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: GREEN }}>{aprovadas}</div>
          <div style={{ fontSize: 9, color: "#666" }}>Em uso</div>
        </div>
      </div>

      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #e5e7eb", paddingTop: 6 }}>
        {[
          { v: "ativas", l: "🔄 Ativas" },
          { v: "historico", l: "📜 Histórico" },
        ].map(a => (
          <button key={a.v} onClick={() => setAba(a.v)} style={{
            flex: 1, padding: "10px 0", background: "none", border: "none",
            borderBottom: aba === a.v ? `3px solid ${NAVY}` : "3px solid transparent",
            color: aba === a.v ? NAVY : "#888", fontWeight: aba === a.v ? 800 : 600, fontSize: 12, cursor: "pointer"
          }}>{a.l}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 12 }}>
        <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ ...selS, marginBottom: 10 }}>
          <option value="todas">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <Btn label="➕ Solicitar Movimentação" color={NAVY} onClick={() => setModal(true)} style={{ marginBottom: 12 }} />

        {lista.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, textAlign: "center", color: "#aaa" }}>
            {aba === "ativas" ? "Nenhuma movimentação ativa." : "Nenhuma movimentação no histórico."}
          </div>
        ) : lista.map(m => {
          const prazoInfo = checaPrazo(m);
          const cor = m.status === "Aguardando" ? ORANGE
            : m.status === "Aprovado" && prazoInfo?.atrasado ? RED
            : m.status === "Aprovado" && prazoInfo?.vencendo ? ORANGE
            : m.status === "Aprovado" ? GREEN
            : m.status === "Devolvido" || m.status === "Concluído" ? "#888"
            : m.status === "Negado" ? RED
            : "#888";
          return (
            <div key={m.id} onClick={() => onVerDetalhe && onVerDetalhe(m)} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${cor}`, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontSize: 24, marginRight: 10 }}>{m.tipoItem === "equipamento" ? "⚙️" : "🔨"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: NAVY, fontSize: 13 }}>
                    {m.itemNome}
                    {m.itemCodigo && <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>{m.itemCodigo}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                    📤 {m.obraOrigemNome} <span style={{ color: NAVY }}>→</span> 📥 {m.obraDestinoNome}
                  </div>
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                    {m.tipo === "emprestimo" ? "🔁 Empréstimo" : "↪️ Transferência"}
                    {m.prazo && m.tipo === "emprestimo" && <span> • Prazo: {new Date(m.prazo).toLocaleDateString("pt-BR")}</span>}
                    <span> • {m.solicitante}</span>
                  </div>
                  {m.motivo && <div style={{ fontSize: 11, color: "#777", fontStyle: "italic", marginTop: 4 }}>"{m.motivo}"</div>}
                  {prazoInfo?.atrasado && (
                    <div style={{ fontSize: 11, color: RED, fontWeight: 700, marginTop: 4 }}>⚠️ Atrasado há {prazoInfo.dias} dia(s)</div>
                  )}
                  {prazoInfo?.vencendo && (
                    <div style={{ fontSize: 11, color: ORANGE, fontWeight: 700, marginTop: 4 }}>⏱️ Vence em {prazoInfo.dias} dia(s)</div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Badge label={m.status} color={cor} small />
                  <span style={{ color: "#bbb", fontSize: 16 }}>›</span>
                </div>
              </div>

              {m.status === "Aguardando" && usuario?.perfil === "gestor" && (
                <div style={{ display: "flex", gap: 6, marginTop: 8 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => onAprovar(m.id)} style={{ flex: 1, background: GREEN, color: "#fff", border: "none", borderRadius: 8, padding: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>✓ Aprovar</button>
                  <button onClick={() => { confirmar("Negar esta movimentação?", () => { onNegar(m.id); }); }} style={{ flex: 1, background: RED, color: "#fff", border: "none", borderRadius: 8, padding: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>✕ Negar</button>
                </div>
              )}
              {m.status === "Aprovado" && m.tipo === "emprestimo" && (
                <button onClick={(e) => { e.stopPropagation(); confirmar(`Marcar "${m.itemNome}" como devolvido a ${m.obraOrigemNome}?`, () => { onDevolver(m.id); }); }} style={{ width: "100%", marginTop: 8, background: BLUE, color: "#fff", border: "none", borderRadius: 8, padding: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>↩️ Marcar como Devolvido</button>
              )}
              {m.status === "Aprovado" && m.tipo === "transferencia" && (
                <button onClick={(e) => { e.stopPropagation(); confirmar("Concluir transferência?", () => { onDevolver(m.id, true); }); }} style={{ width: "100%", marginTop: 8, background: GREEN, color: "#fff", border: "none", borderRadius: 8, padding: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>✓ Confirmar Recebimento</button>
              )}
            </div>
          );
        })}
      </div>
      <KMFooter />

      <Modal show={modal} title="Movimentar Equipamento" onClose={() => setModal(false)}>
        <label style={labelS}>Tipo de item</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[
            { v: "equipamento", l: "⚙️ Equipamento" },
            { v: "ferramenta", l: "🔨 Ferramenta" },
          ].map(t => (
            <button key={t.v} onClick={() => { set("tipoItem", t.v); set("itemId", ""); }} style={{ flex: 1, padding: "10px 4px", borderRadius: 10, border: `2px solid ${form.tipoItem === t.v ? NAVY : "#dde2ef"}`, background: form.tipoItem === t.v ? "#dde6f5" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, color: form.tipoItem === t.v ? NAVY : "#666" }}>{t.l}</button>
          ))}
        </div>

        <label style={labelS}>Selecione o item</label>
        <select value={form.itemId} onChange={e => set("itemId", e.target.value)} style={selS}>
          <option value="">— Selecione —</option>
          {itens.map(i => {
            const o = obras.find(x => x.id === i.obraId);
            return <option key={i.id} value={i.id}>{i.nome} {i.codigo ? "(" + i.codigo + ")" : ""} • {o?.nome?.substring(0, 25) || "?"}</option>;
          })}
        </select>

        {itemEscolhido && obraOrigem && (
          <div style={{ background: "#f0f7ff", borderRadius: 8, padding: 10, fontSize: 11, color: NAVY, marginBottom: 10 }}>
            📍 Atualmente na obra: <b>{obraOrigem.nome}</b>
          </div>
        )}

        <label style={labelS}>Obra de destino</label>
        <select value={form.obraDestino} onChange={e => set("obraDestino", e.target.value)} style={selS}>
          <option value="">— Selecione —</option>
          {obras.filter(o => itemEscolhido ? o.id !== itemEscolhido.obraId : true).map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <label style={labelS}>Tipo de movimentação</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[
            { v: "emprestimo", l: "🔁 Empréstimo", desc: "Volta depois" },
            { v: "transferencia", l: "↪️ Transferência", desc: "Definitiva" },
          ].map(t => (
            <button key={t.v} onClick={() => set("tipo", t.v)} style={{ flex: 1, padding: "10px 6px", borderRadius: 10, border: `2px solid ${form.tipo === t.v ? NAVY : "#dde2ef"}`, background: form.tipo === t.v ? "#dde6f5" : "#fff", cursor: "pointer", color: form.tipo === t.v ? NAVY : "#666", textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{t.l}</div>
              <div style={{ fontSize: 9, opacity: 0.7 }}>{t.desc}</div>
            </button>
          ))}
        </div>

        {form.tipo === "emprestimo" && (
          <>
            <label style={labelS}>Prazo de devolução</label>
            <input value={form.prazo} onChange={e => set("prazo", e.target.value)} type="date" style={dateS} />
          </>
        )}

        <label style={labelS}>Motivo (opcional)</label>
        <input value={form.motivo} onChange={e => set("motivo", e.target.value)} placeholder="Ex: precisa pra concretar a laje" style={inputS} />

        {usuario?.perfil === "gestor" && (
          <div style={{ background: "#f0fdf4", borderRadius: 8, padding: 8, fontSize: 11, color: GREEN, marginBottom: 10 }}>
            ✅ Por ser gestor, esta movimentação será aprovada automaticamente.
          </div>
        )}
        {usuario?.perfil === "encarregado" && (
          <div style={{ background: "#fff8f0", borderRadius: 8, padding: 8, fontSize: 11, color: ORANGE, marginBottom: 10 }}>
            ⏳ Aguardará aprovação do gestor antes de ser confirmada.
          </div>
        )}

        <Btn label="✓ SOLICITAR" color={GREEN} onClick={enviar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   DETALHE MOV. PESSOAL — visualização completa
════════════════════════════════════ */

export function TelaMovPessoalDetalhe({ mov, obras, trabalhadores, onBack, onAprovar, onNegar }) {
  if (!mov) return null;
  const trab = trabalhadores.find(t => t.id === mov.trabId);
  const oOrigem = obras.find(o => o.id === mov.obraOrigem);
  const oDestino = obras.find(o => o.id === mov.obraDestino);
  const cor = mov.status === "Aprovado" ? GREEN : mov.status === "Negado" ? RED : ORANGE;
  const statusLabel = mov.status === "Aguardando" ? "⏳ Aguardando" : mov.status === "Aprovado" ? "✓ Aprovado" : "✕ Negado";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Detalhe Movimentação" sub={mov.status} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* CABEÇALHO */}
        <div style={{ background: `linear-gradient(135deg,${cor},${cor}cc)`, color: "#fff", borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 36, marginRight: 10 }}>👷</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>TRABALHADOR</div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>{mov.trabNome}</div>
              {trab?.funcao && <div style={{ fontSize: 11, opacity: 0.85 }}>{trab.funcao}</div>}
            </div>
            <div style={{ background: "rgba(255,255,255,0.25)", padding: "4px 10px", borderRadius: 10, fontSize: 11, fontWeight: 800 }}>{statusLabel}</div>
          </div>
        </div>

        {/* TIPO */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${BLUE}` }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>📋 Tipo</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>
            {mov.tipo === "hoje" ? "📅 Apenas hoje" : "🔄 Mudança definitiva"}
          </div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
            {mov.tipo === "hoje" ? "O trabalhador volta pra obra original amanhã" : "O trabalhador troca de obra permanentemente"}
          </div>
        </div>

        {/* ROTA */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 8 }}>🔄 De / Para</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, background: "#fef9e7", borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 9, color: "#8b6f00", fontWeight: 700, textTransform: "uppercase" }}>📤 Saindo de</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginTop: 2 }}>{oOrigem?.nome || "—"}</div>
              {oOrigem?.local && <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{oOrigem.local}</div>}
            </div>
            <div style={{ fontSize: 22, color: NAVY }}>→</div>
            <div style={{ flex: 1, background: "#f0fdf4", borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 9, color: "#14532d", fontWeight: 700, textTransform: "uppercase" }}>📥 Indo para</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginTop: 2 }}>{oDestino?.nome || "—"}</div>
              {oDestino?.local && <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{oDestino.local}</div>}
            </div>
          </div>
        </div>

        {/* SOLICITANTE / DATA / MOTIVO */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: "#888", fontWeight: 700, textTransform: "uppercase" }}>👷 Solicitante</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{mov.solicitante}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "#888", fontWeight: 700, textTransform: "uppercase" }}>📅 Data</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{mov.data}</div>
            </div>
          </div>
          {mov.motivo && (
            <div style={{ background: "#fef9e7", borderRadius: 8, padding: 10, borderLeft: `3px solid ${ORANGE}` }}>
              <div style={{ fontSize: 10, color: "#8b6f00", fontWeight: 700, marginBottom: 2 }}>📝 Motivo</div>
              <div style={{ fontSize: 12, color: "#444", fontStyle: "italic" }}>"{mov.motivo}"</div>
            </div>
          )}
        </div>

        {/* INFO TRABALHADOR */}
        {trab && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${NAVY}` }}>
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>👤 Sobre o trabalhador</div>
            {trab.funcao && <div style={{ fontSize: 11, color: "#666" }}>Função: <b style={{ color: NAVY }}>{trab.funcao}</b></div>}
            {trab.diaria && <div style={{ fontSize: 11, color: "#666" }}>Diária: <b style={{ color: GREEN }}>R$ {parseFloat(trab.diaria).toFixed(2)}</b></div>}
            {trab.tel && <div style={{ fontSize: 11, color: "#666" }}>📞 {trab.tel}</div>}
          </div>
        )}

        {/* AÇÕES */}
        {mov.status === "Aguardando" && (
          <div style={{ marginTop: 12 }}>
            <button onClick={() => { onAprovar(mov); onBack(); }} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14, marginBottom: 8, boxShadow: "0 4px 12px rgba(42,168,79,0.3)" }}>
              ✓ APROVAR MOVIMENTAÇÃO
            </button>
            <button onClick={() => { confirmar("Negar esta movimentação?", () => { onNegar(mov.id); onBack(); }) }} style={{ width: "100%", padding: 12, borderRadius: 12, border: `1.5px solid ${RED}`, background: "#fff", color: RED, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              ✕ Negar Movimentação
            </button>
          </div>
        )}
      </div>
      <KMFooter />
    </div>
  );
}


export function TelaAprovarMov({ obras, trabalhadores, movimentacoes, onBack, onAprovar, onNegar, onVerDetalhe }) {
  const [filtro, setFiltro] = useState("Aguardando");
  const lista = filtro === "todas" ? movimentacoes : movimentacoes.filter(m => m.status === filtro);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Movimentações" sub="Aprovar mudanças de equipe" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <select value={filtro} onChange={e => setFiltro(e.target.value)} style={{ ...selS, marginBottom: 12 }}>
          <option value="Aguardando">Aguardando</option>
          <option value="Aprovado">Aprovadas</option>
          <option value="Negado">Negadas</option>
          <option value="todas">Todas</option>
        </select>

        {lista.length === 0 && <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", color: "#aaa" }}>Nenhuma solicitação.</div>}

        {lista.map(m => {
          const oOrigem = obras.find(o => o.id === m.obraOrigem);
          const oDestino = obras.find(o => o.id === m.obraDestino);
          const cor = m.status === "Aprovado" ? GREEN : m.status === "Negado" ? RED : ORANGE;
          return (
            <div key={m.id} onClick={() => onVerDetalhe && onVerDetalhe(m)} style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${cor}`, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>👷 {m.trabNome}</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Solicitado por {m.solicitante} • {m.data}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Badge label={m.status} color={cor} small />
                  <span style={{ color: "#bbb", fontSize: 16 }}>›</span>
                </div>
              </div>

              <div style={{ background: "#f5f8fc", borderRadius: 8, padding: "8px 10px", fontSize: 12, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#888" }}>{oOrigem?.nome || "—"}</span>
                  <span style={{ color: NAVY, fontSize: 16 }}>→</span>
                  <span style={{ color: NAVY, fontWeight: 700 }}>{oDestino?.nome}</span>
                </div>
                <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                  {m.tipo === "hoje" ? "📅 Apenas hoje" : "🔄 Mudança definitiva"}
                </div>
              </div>

              {m.motivo && <div style={{ fontSize: 12, color: "#555", fontStyle: "italic", marginBottom: 8 }}>"{m.motivo}"</div>}

              {m.status === "Aguardando" && (
                <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => onNegar(m.id)} style={{ flex: 1, padding: 9, borderRadius: 8, border: "none", background: RED, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>✕ NEGAR</button>
                  <button onClick={() => onAprovar(m)} style={{ flex: 1, padding: 9, borderRadius: 8, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>✓ APROVAR</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   FERRAMENTAS (inchada, enxadão, carrinho, etc.)
════════════════════════════════════ */

export function TelaFerramentas({ obras, ferramentas, onBack, onAdd, onEditar, onRemover }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [filtroObra, setFiltroObra] = useState("todas");
  const [form, setForm] = useState({ nome: "", quantidade: 1, obraId: "", estado: "Bom", icon: "🔨" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const ICONS = ["🔨", "🪓", "⛏️", "🧰", "🪛", "🚿", "🛒", "🪣", "🧱", "📐", "🪜", "🔗"];
  const SUGEST = ["Inchada", "Enxadão", "Carrinho de mão", "Pá", "Picareta", "Marreta", "Martelo", "Talhadeira", "Trena", "Nível", "Prumo", "Linha", "Colher de pedreiro", "Desempenadeira", "Régua"];

  const lista = filtroObra === "todas" ? ferramentas : ferramentas.filter(f => String(f.obraId) === String(filtroObra));

  const abrirNovo = () => { setEditandoId(null); setForm({ nome: "", quantidade: 1, obraId: "", estado: "Bom", icon: "🔨" }); setModal(true); };
  const abrirEdit = (f) => { setEditandoId(f.id); setForm(f); setModal(true); };
  const salvar = () => {
    if (!form.nome || !form.obraId) return;
    if (editandoId) onEditar({ ...form, id: editandoId, obraId: parseInt(form.obraId), quantidade: parseInt(form.quantidade) || 1 });
    else onAdd({ ...form, id: Date.now(), obraId: parseInt(form.obraId), quantidade: parseInt(form.quantidade) || 1 });
    setModal(false);
  };

  const COR_ESTADO = { "Bom": GREEN, "Desgastado": ORANGE, "Quebrado": RED };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Ferramentas" sub="Manuais e elétricas" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 12 }}>
        <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ ...selS, marginBottom: 12 }}>
          <option value="todas">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        {lista.map(f => {
          const obra = obras.find(o => o.id === f.obraId);
          return (
            <div key={f.id} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 28, marginRight: 12 }}>{f.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{f.nome} <span style={{ background: "#dde6f5", color: NAVY, padding: "1px 8px", borderRadius: 8, fontSize: 11, marginLeft: 4 }}>×{f.quantidade}</span></div>
                <div style={{ fontSize: 11, color: "#888" }}>📍 {obra?.nome}</div>
              </div>
              <Badge label={f.estado} color={COR_ESTADO[f.estado] || "#888"} small />
              <button onClick={() => abrirEdit(f)} style={{ background: "none", border: "none", color: BLUE, fontSize: 16, marginLeft: 8, cursor: "pointer" }}>✏️</button>
              <button onClick={() => onRemover(f.id)} style={{ background: "#fee2e2", border: "2px solid #d63b3b", color: "#d63b3b", fontSize: 16, marginLeft: 4, cursor: "pointer", padding: "6px 10px", borderRadius: 8, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>
            </div>
          );
        })}
        {lista.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: 20 }}>Nenhuma ferramenta cadastrada.</div>}
        <Btn label="➕ Adicionar Ferramenta" color={NAVY} onClick={abrirNovo} style={{ marginTop: 8 }} />
      </div>
      <KMFooter />

      <Modal show={modal} title={editandoId ? "Editar Ferramenta" : "Nova Ferramenta"} onClose={() => setModal(false)}>
        <label style={labelS}>Nome</label>
        <input value={form.nome} onChange={e => set("nome", e.target.value)} list="sugest-ferr" placeholder="Ex: Inchada, Carrinho de mão..." style={inputS} />
        <datalist id="sugest-ferr">{SUGEST.map(s => <option key={s} value={s} />)}</datalist>

        <label style={labelS}>Quantidade</label>
        <input value={form.quantidade} onChange={e => set("quantidade", e.target.value)} type="number" min="1" style={inputS} />

        <label style={labelS}>Obra</label>
        <select value={form.obraId} onChange={e => set("obraId", e.target.value === "" ? "" : parseInt(e.target.value))} style={selS}>
          <option value="">Selecione</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <label style={labelS}>Estado</label>
        <select value={form.estado} onChange={e => set("estado", e.target.value)} style={selS}>
          <option>Bom</option><option>Desgastado</option><option>Quebrado</option>
        </select>

        <label style={labelS}>Ícone</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {ICONS.map(i => (
            <button key={i} onClick={() => set("icon", i)} style={{ width: 40, height: 40, fontSize: 22, border: form.icon === i ? `2px solid ${NAVY}` : "1px solid #ddd", borderRadius: 8, background: form.icon === i ? "#dde6f5" : "#fff", cursor: "pointer" }}>{i}</button>
          ))}
        </div>

        <Btn label={editandoId ? "SALVAR" : "ADICIONAR"} color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   RH: ANIVERSARIANTES & EPI PENDENTE
════════════════════════════════════ */

export function TelaManutencao({ obras, ativos, ferramentas, equips, manutencoes, onBack, onAdd, onRemover }) {
  const [aba, setAba] = useState("agenda"); // agenda | historico
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ tipoItem: "ativo", itemId: "", tipo: "Troca de óleo", proxData: "", observacao: "", obraId: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const TIPOS_MAN = ["Troca de óleo", "Troca de filtro", "Lubrificação", "Revisão geral", "Troca de pneus", "Calibração", "Reparo", "Limpeza", "Outro"];

  const salvar = () => {
    if (!form.itemId || !form.proxData) return;
    onAdd({ id: Date.now(), ...form, ts: Date.now(), realizada: false });
    setForm({ tipoItem: "ativo", itemId: "", tipo: "Troca de óleo", proxData: "", observacao: "", obraId: "" });
    setModal(false);
  };

  const marcarRealizada = (id) => {
    const m = manutencoes.find(x => x.id === id);
    if (!m) return;
    if (!confirm(`Marcar "${m.tipo}" como realizada?`)) return;
    onAdd({ ...m, realizada: true, dataRealizada: new Date().toLocaleDateString("pt-BR"), id: m.id });
  };

  // Análise de status
  const hoje = new Date();
  const hojeMs = hoje.getTime();
  const checaStatus = (m) => {
    if (m.realizada) return { txt: "Realizada", cor: GREEN, dias: 0, prio: 3 };
    try {
      const d = new Date(m.proxData);
      const dias = Math.ceil((d - hoje) / (1000 * 60 * 60 * 24));
      if (dias < 0) return { txt: `Atrasada ${Math.abs(dias)}d`, cor: RED, dias, prio: 0 };
      if (dias <= 7) return { txt: `Em ${dias}d`, cor: ORANGE, dias, prio: 1 };
      return { txt: `Em ${dias}d`, cor: BLUE, dias, prio: 2 };
    } catch { return { txt: "—", cor: "#888", dias: 999, prio: 4 }; }
  };

  const lista = aba === "agenda" ? manutencoes.filter(m => !m.realizada) : manutencoes.filter(m => m.realizada);
  const ordenada = [...lista].map(m => ({ ...m, _s: checaStatus(m) })).sort((a, b) => a._s.prio - b._s.prio);

  const getNomeItem = (m) => {
    if (m.tipoItem === "ativo") return ativos.find(x => x.id === parseInt(m.itemId))?.nome || "—";
    if (m.tipoItem === "ferramenta") return ferramentas.find(x => x.id === parseInt(m.itemId))?.nome || "—";
    if (m.tipoItem === "equipamento") return equips.find(x => x.id === parseInt(m.itemId))?.nome || "—";
    return "—";
  };

  const getIconeItem = (tipoItem) => ({ ativo: "🚜", ferramenta: "🔨", equipamento: "⚙️" }[tipoItem] || "🔧");

  const atrasadas = manutencoes.filter(m => !m.realizada && checaStatus(m).dias < 0).length;
  const urgentes = manutencoes.filter(m => !m.realizada && checaStatus(m).dias >= 0 && checaStatus(m).dias <= 7).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Manutenções" sub="Preventiva e corretiva" onBack={onBack} />
      <div style={{ display: "flex", gap: 0, background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        {[
          { v: "agenda", l: "🗓️ Agenda", n: manutencoes.filter(m => !m.realizada).length },
          { v: "historico", l: "✅ Histórico", n: manutencoes.filter(m => m.realizada).length },
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
        {aba === "agenda" && (
          <>
            {(atrasadas > 0 || urgentes > 0) && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {atrasadas > 0 && (
                  <div style={{ flex: 1, background: RED, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>{atrasadas}</div>
                    <div style={{ fontSize: 10 }}>Atrasadas</div>
                  </div>
                )}
                {urgentes > 0 && (
                  <div style={{ flex: 1, background: ORANGE, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>{urgentes}</div>
                    <div style={{ fontSize: 10 }}>Esta semana</div>
                  </div>
                )}
              </div>
            )}
            <Btn label="➕ Agendar Manutenção" color={NAVY} onClick={() => setModal(true)} style={{ marginBottom: 14 }} />
          </>
        )}

        {ordenada.length === 0 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, textAlign: "center", color: "#aaa" }}>
            {aba === "agenda" ? "🎉 Nenhuma manutenção agendada." : "Nenhuma manutenção concluída ainda."}
          </div>
        )}

        {ordenada.map(m => {
          const obra = obras.find(o => o.id === parseInt(m.obraId));
          return (
            <div key={m.id} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${m._s.cor}` }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 24, marginRight: 10 }}>{getIconeItem(m.tipoItem)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{getNomeItem(m)}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{m.tipo}</div>
                  {obra && <div style={{ fontSize: 10, color: BLUE }}>📍 {obra.nome}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: m._s.cor, fontWeight: 800 }}>{m._s.txt}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>{m.realizada ? `✓ ${m.dataRealizada}` : new Date(m.proxData).toLocaleDateString("pt-BR")}</div>
                </div>
              </div>
              {m.observacao && <div style={{ fontSize: 11, color: "#666", fontStyle: "italic", marginBottom: 6, paddingLeft: 34 }}>"{m.observacao}"</div>}

              {!m.realizada && (
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button onClick={() => marcarRealizada(m.id)} style={{ flex: 1, padding: 7, borderRadius: 8, border: "none", background: GREEN, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>✓ MARCAR REALIZADA</button>
                  <button onClick={() => { confirmar("Remover esta manutenção?", () => { onRemover(m.id); }); }} style={{ padding: 7, borderRadius: 8, border: "none", background: "#fef2f2", color: RED, fontWeight: 700, cursor: "pointer", fontSize: 11, width: 50 }}>🗑️</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <KMFooter />

      <Modal show={modal} title="Agendar Manutenção" onClose={() => setModal(false)}>
        <label style={labelS}>Tipo de item</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[
            { v: "ativo", l: "🚜 Ativo/Frota" },
            { v: "ferramenta", l: "🔨 Ferramenta" },
            { v: "equipamento", l: "⚙️ Equipamento" },
          ].map(t => (
            <button key={t.v} onClick={() => set("tipoItem", t.v)} style={{ flex: 1, padding: "10px 4px", borderRadius: 10, border: `2px solid ${form.tipoItem === t.v ? NAVY : "#dde2ef"}`, background: form.tipoItem === t.v ? "#dde6f5" : "#fff", cursor: "pointer", fontSize: 11, fontWeight: 700, color: form.tipoItem === t.v ? NAVY : "#666" }}>{t.l}</button>
          ))}
        </div>

        <label style={labelS}>Selecione o item</label>
        <select value={form.itemId} onChange={e => set("itemId", e.target.value)} style={selS}>
          <option value="">—</option>
          {form.tipoItem === "ativo" && ativos.map(a => <option key={a.id} value={a.id}>{a.nome} ({a.placa})</option>)}
          {form.tipoItem === "ferramenta" && ferramentas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          {form.tipoItem === "equipamento" && equips.map(e => <option key={e.id} value={e.id}>{e.nome} ({e.codigo})</option>)}
        </select>

        <label style={labelS}>Tipo de manutenção</label>
        <select value={form.tipo} onChange={e => set("tipo", e.target.value)} style={selS}>
          {TIPOS_MAN.map(t => <option key={t}>{t}</option>)}
        </select>

        <label style={labelS}>Próxima data</label>
        <input value={form.proxData} onChange={e => set("proxData", e.target.value)} type="date" style={dateS} />

        <label style={labelS}>Observação (opcional)</label>
        <input value={form.observacao} onChange={e => set("observacao", e.target.value)} placeholder="Ex: óleo 15W40, troca a cada 250h" style={inputS} />

        <Btn label="✓ AGENDAR" color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   HISTÓRICO DE PAGAMENTOS — Folhas quinzenais salvas
════════════════════════════════════ */
