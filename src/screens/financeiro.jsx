import { CATEGORIAS_DESPESA } from "./equipamentos.jsx";
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

export function TelaDespesasAvulsas({ obras, despesas = [], onBack, onAdd, onEditar, onRemover }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [filtroObra, setFiltroObra] = useState("todas");
  const [filtroMes, setFiltroMes] = useState(new Date().getMonth());
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear());
  const [fotoVer, setFotoVer] = useState(null);

  const [form, setForm] = useState({
    categoria: "", obraId: "", data: new Date().toLocaleDateString("pt-BR"),
    valor: "", descricao: "", quemPagou: "", foto: ""
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const abrirNovo = () => {
    setEditandoId(null);
    setForm({ categoria: "", obraId: filtroObra !== "todas" ? filtroObra : "", data: new Date().toLocaleDateString("pt-BR"), valor: "", descricao: "", quemPagou: "Caixa da obra", foto: "" });
    setModal(true);
  };

  const abrirEdit = (d) => {
    setEditandoId(d.id);
    setForm({ ...d });
    setModal(true);
  };

  const salvar = () => {
    if (!form.categoria || !form.obraId || !form.valor) {
      alert("⚠️ Preencha categoria, obra e valor");
      return;
    }
    const dados = {
      ...form,
      id: editandoId || Date.now(),
      valor: parseFloat(form.valor) || 0,
      obraId: parseInt(form.obraId),
    };
    if (editandoId) onEditar(dados);
    else onAdd(dados);
    setModal(false);
  };

  const tirarFoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => set("foto", ev.target.result);
    r.readAsDataURL(f);
  };

  // Filtrar despesas
  const despesasFiltradas = (despesas || []).filter(d => {
    if (filtroObra !== "todas" && String(d.obraId) !== String(filtroObra)) return false;
    try {
      const [dia, mes, ano] = (d.data || "").split("/");
      if (parseInt(mes) - 1 !== filtroMes) return false;
      if (parseInt(ano) !== filtroAno) return false;
    } catch { return false; }
    return true;
  });

  // KPIs
  const totalMes = despesasFiltradas.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
  const porCategoria = {};
  despesasFiltradas.forEach(d => {
    porCategoria[d.categoria] = (porCategoria[d.categoria] || 0) + (parseFloat(d.valor) || 0);
  });
  const topCategorias = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Despesas Avulsas" sub={`${despesasFiltradas.length} no período`} onBack={onBack} right={
        <button onClick={abrirNovo} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ Nova</button>
      } />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* KPI Total */}
        <div style={{ background: `linear-gradient(135deg,${ORANGE},#dc7e00)`, color: "#fff", borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>💸 Total no período</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>R$ {totalMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          {topCategorias.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 10, opacity: 0.9 }}>
              Top: {topCategorias.map(([cat, v]) => {
                const c = CATEGORIAS_DESPESA.find(x => x.id === cat);
                return `${c?.nome || cat} R$${v.toFixed(0)}`;
              }).join(" • ")}
            </div>
          )}
        </div>

        {/* Filtros */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <label style={labelS}>🏗️ Obra</label>
          <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={selS}>
            <option value="todas">Todas as obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 2 }}>
              <label style={labelS}>📅 Mês</label>
              <select value={filtroMes} onChange={e => setFiltroMes(parseInt(e.target.value))} style={{ ...selS, marginBottom: 0 }}>
                {meses.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelS}>Ano</label>
              <input type="number" value={filtroAno} onChange={e => setFiltroAno(parseInt(e.target.value))} style={{ ...inputS, marginBottom: 0 }} />
            </div>
          </div>
        </div>

        {/* Lista */}
        {despesasFiltradas.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", color: "#aaa" }}>
            💸 Nenhuma despesa avulsa neste período.
            <button onClick={abrirNovo} style={{ display: "block", margin: "12px auto 0", background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>+ Adicionar primeira</button>
          </div>
        ) : (
          despesasFiltradas.sort((a, b) => b.id - a.id).map(d => {
            const cat = CATEGORIAS_DESPESA.find(c => c.id === d.categoria) || { nome: d.categoria, cor: "#888" };
            const obra = obras.find(o => o.id === d.obraId);
            return (
              <div key={d.id} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${cat.cor}` }}>
                <div style={{ display: "flex", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ background: cat.cor, color: "#fff", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800 }}>{cat.nome}</span>
                      <span style={{ fontSize: 9, color: "#888" }}>{d.data}</span>
                    </div>
                    <div style={{ fontSize: 12, color: NAVY, fontWeight: 700, marginTop: 2 }}>{obra?.nome || "—"}</div>
                    {d.descricao && <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{d.descricao}</div>}
                    {d.quemPagou && <div style={{ fontSize: 10, color: "#888", marginTop: 2, fontStyle: "italic" }}>💰 Pago por: {d.quemPagou}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: cat.cor }}>R$ {(parseFloat(d.valor) || 0).toFixed(2)}</div>
                    <button onClick={() => abrirEdit(d)} style={{ background: "none", border: "none", color: BLUE, fontSize: 16, cursor: "pointer", marginTop: 4 }}>✏️</button>
                  </div>
                </div>
                {d.foto && (
                  <img src={d.foto} alt="Comprovante" onClick={() => setFotoVer({ src: d.foto, legenda: `Comprovante: ${d.descricao || d.categoria}` })} style={{ width: "100%", borderRadius: 8, marginTop: 8, border: "1px solid #eee", cursor: "pointer" }} />
                )}
              </div>
            );
          })
        )}
      </div>
      <KMFooter />

      {/* MODAL ADD/EDITAR */}
      <Modal show={modal} title={editandoId ? "Editar Despesa" : "Nova Despesa Avulsa"} onClose={() => setModal(false)}>
        <label style={labelS}>📋 Categoria</label>
        <select value={form.categoria} onChange={e => set("categoria", e.target.value)} style={selS}>
          <option value="">— Selecione —</option>
          {CATEGORIAS_DESPESA.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        {form.categoria && (
          <div style={{ fontSize: 10, color: "#888", marginTop: -8, marginBottom: 10, fontStyle: "italic" }}>
            {CATEGORIAS_DESPESA.find(c => c.id === form.categoria)?.desc}
          </div>
        )}

        <label style={labelS}>🏗️ Obra</label>
        <select value={form.obraId} onChange={e => set("obraId", e.target.value === "" ? "" : parseInt(e.target.value))} style={selS}>
          <option value="">— Selecione —</option>
          {obras.filter(o => o.status === "Ativa").map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <label style={labelS}>📅 Data</label>
        <input value={form.data} onChange={e => set("data", e.target.value)} placeholder="DD/MM/AAAA" style={inputS} />

        <label style={labelS}>💰 Valor (R$)</label>
        <input value={form.valor} onChange={e => set("valor", e.target.value)} type="number" placeholder="Ex: 250" style={inputS} />

        <label style={labelS}>📝 Descrição</label>
        <textarea value={form.descricao} onChange={e => set("descricao", e.target.value)} rows={2} placeholder="Ex: Pipa pra molhar pavimento Trecho 2 - Posto Shell BR-262" style={{ ...inputS, fontFamily: "inherit", resize: "none" }} />

        <label style={labelS}>💳 Pago por</label>
        <select value={form.quemPagou} onChange={e => set("quemPagou", e.target.value)} style={selS}>
          <option value="Caixa da obra">Caixa da obra</option>
          <option value="Adiantamento empresa">Adiantamento empresa</option>
          <option value="Kleber (reembolso)">Kleber (reembolso)</option>
          <option value="Encarregado (reembolso)">Encarregado (reembolso)</option>
          <option value="Cartão da empresa">Cartão da empresa</option>
          <option value="PIX direto">PIX direto</option>
        </select>

        <label style={labelS}>📷 Foto do comprovante (opcional)</label>
        {form.foto ? (
          <div style={{ position: "relative", marginBottom: 10 }}>
            <img src={form.foto} alt="" style={{ width: "100%", borderRadius: 10 }} />
            <button onClick={() => set("foto", "")} style={{ position: "absolute", top: 6, right: 6, background: RED, color: "#fff", border: "none", borderRadius: 16, width: 28, height: 28, cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        ) : (
          <label style={{ display: "block", textAlign: "center", padding: 12, border: "1.5px dashed #dde2ef", borderRadius: 10, color: "#666", cursor: "pointer", fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
            📷 Anexar foto do recibo/cupom
            <input type="file" accept="image/*" capture="environment" onChange={tirarFoto} style={{ display: "none" }} />
          </label>
        )}

        {editandoId && (
          <button onClick={() => { confirmar("Excluir esta despesa?", () => { onRemover(editandoId); setModal(false); }) }} style={{ width: "100%", padding: 10, background: "#fef2f2", color: RED, border: `1px solid ${RED}33`, borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 12, marginBottom: 8 }}>🗑️ Excluir</button>
        )}
        <Btn label="💾 SALVAR" color={GREEN} onClick={salvar} />
      </Modal>
      {fotoVer && <FotoViewer src={fotoVer.src} legenda={fotoVer.legenda} onClose={() => setFotoVer(null)} />}
    </div>
  );
}


export function TelaCustos({ obras, trabalhadores, historico, ativos, abastecimentos, pedidos, despesasAvulsas = [], onBack }) {
  const [obraId, setObraId] = useState(obras[0]?.id || 1);
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const obra = obras.find(o => o.id === obraId);
  const trabObra = trabalhadores.filter(t => t.obraId === obraId);
  const ativosObra = ativos.filter(a => a.obraId === obraId);
  const abastObra = abastecimentos.filter(a => a.obraId === obraId);

  // Calcular custo de mão de obra: diária × dias trabalhados (presença + atestado)
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  let custoMaoObra = 0;
  let totalDiasTrab = 0;
  trabObra.forEach(t => {
    let diasPagos = 0;
    for (let d = 1; d <= totalDias; d++) {
      const iso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const s = (historico[iso] || {})[t.id];
      if (s === "Presente" || s === "Atestado") diasPagos++;
    }
    const diaria = parseFloat(t.diaria) || 0;
    custoMaoObra += diasPagos * diaria;
    totalDiasTrab += diasPagos;
  });

  // Custo de combustível (só dos abastecimentos da obra, mês/ano corretos)
  const custoCombustivel = abastObra
    .filter(a => {
      if (!a.ts && !a.data) return false;
      try {
        if (a.ts) {
          const d = new Date(a.ts);
          return d.getMonth() === mes && d.getFullYear() === ano;
        }
        const [dia, m, an] = (a.data || "").split("/");
        return parseInt(m) - 1 === mes && parseInt(an) === ano;
      } catch { return false; }
    })
    .reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);

  // Custo de materiais aprovados
  const custoMateriais = pedidos
    .filter(p => p.obraId === obraId && p.status === "Aprovado")
    .filter(p => {
      if (!p.data) return false;
      try {
        const partes = p.data.split("/");
        if (partes.length < 3) return false;
        return parseInt(partes[1]) - 1 === mes && parseInt(partes[2]) === ano;
      } catch { return false; }
    })
    .length * 100; // estimativa simples — pode ser refinado depois

  // 💸 Despesas avulsas (PIPA, frete, almoço motorista, etc)
  const despesasObra = (despesasAvulsas || []).filter(d => {
    if (d.obraId !== obraId) return false;
    if (!d.data) return false;
    try {
      const partes = d.data.split("/");
      if (partes.length < 3) return false;
      return parseInt(partes[1]) - 1 === mes && parseInt(partes[2]) === ano;
    } catch { return false; }
  });
  const custoDespesasAvulsas = despesasObra.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

  const total = custoMaoObra + custoCombustivel + custoMateriais + custoDespesasAvulsas;
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Custos por Obra" sub={`${meses[mes]}/${ano}`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <select value={obraId} onChange={e => setObraId(parseInt(e.target.value))} style={{ ...selS, marginBottom: 8 }}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <select value={mes} onChange={e => setMes(parseInt(e.target.value))} style={{ ...selS, flex: 2, marginBottom: 0 }}>
            {meses.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(parseInt(e.target.value))} style={{ ...selS, flex: 1, marginBottom: 0 }}>
            {[ano - 1, ano, ano + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div style={{ background: `linear-gradient(135deg,${NAVY},#243b7a)`, borderRadius: 14, padding: 16, marginBottom: 12, color: "#fff", boxShadow: "0 4px 14px rgba(15,33,81,0.3)" }}>
          <div style={{ fontSize: 11, opacity: 0.8 }}>📍 {obra?.nome}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Custo total apropriado</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: GOLD }}>R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderLeft: `4px solid ${GREEN}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>👷 Mão de Obra</div>
              <div style={{ fontSize: 11, color: "#888" }}>{totalDiasTrab} dias-homem • {trabObra.length} colaborador(es)</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: GREEN }}>R$ {custoMaoObra.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderLeft: `4px solid ${ORANGE}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>⛽ Combustível</div>
              <div style={{ fontSize: 11, color: "#888" }}>{ativosObra.length} ativo(s) • {abastObra.length} abastecimento(s)</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: ORANGE }}>R$ {custoCombustivel.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderLeft: `4px solid ${BLUE}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>📦 Materiais</div>
              <div style={{ fontSize: 11, color: "#888" }}>Pedidos aprovados (estimado)</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: BLUE }}>R$ {custoMateriais.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        {/* DESPESAS AVULSAS */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderLeft: `4px solid #ea580c` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>💸 Despesas avulsas</div>
              <div style={{ fontSize: 11, color: "#888" }}>{despesasObra.length} despesa{despesasObra.length === 1 ? "" : "s"} (PIPA, frete, almoço motorista...)</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#ea580c" }}>R$ {custoDespesasAvulsas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          </div>
          {despesasObra.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f0f0f0" }}>
              {despesasObra.slice(0, 5).map(d => {
                const cat = CATEGORIAS_DESPESA.find(c => c.id === d.categoria) || { nome: d.categoria, cor: "#888" };
                return (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", padding: "4px 0", fontSize: 11 }}>
                    <span style={{ background: cat.cor, color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, marginRight: 6 }}>{cat.nome}</span>
                    <span style={{ flex: 1, color: "#666" }}>{d.descricao || cat.nome}</span>
                    <span style={{ fontWeight: 700, color: "#ea580c" }}>R$ {(parseFloat(d.valor) || 0).toFixed(2)}</span>
                  </div>
                );
              })}
              {despesasObra.length > 5 && <div style={{ fontSize: 10, color: "#888", marginTop: 4, textAlign: "center" }}>+ {despesasObra.length - 5} despesas...</div>}
            </div>
          )}
        </div>

        <div style={{ background: "#fffaeb", borderRadius: 12, padding: "10px 14px", fontSize: 11, color: "#8b6f00", marginTop: 8 }}>
          💡 Custo de mão de obra = diária × dias trabalhados (presença + atestado). Custos de materiais estimados em R$ 100/pedido aprovado. Despesas avulsas vêm do registro manual.
        </div>
      </div>
      <KMFooter />
    </div>
  );
}

export function TelaPagamentos({ obras = [], onBack, onEditarObra }) {
  const [obraId, setObraId] = useState(obras[0]?.id || "");
  const obra = obras.find(o => o.id === obraId) || {};
  const [form, setForm] = useState({
    cliente: obra.cliente || "",
    clienteDoc: obra.clienteDoc || "",
    valorContrato: obra.valorContrato || "",
    dataInicioContrato: obra.dataInicioContrato || "",
    dataFimContrato: obra.dataFimContrato || "",
    formaPagContrato: obra.formaPagContrato || "À vista",
    obsContrato: obra.obsContrato || "",
  });
  const [alterado, setAlterado] = useState(false);
  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setAlterado(true);
  };

  useEffect(() => {
    const atual = obras.find(o => o.id === obraId) || {};
    setForm({
      cliente: atual.cliente || "",
      clienteDoc: atual.clienteDoc || "",
      valorContrato: atual.valorContrato || "",
      dataInicioContrato: atual.dataInicioContrato || "",
      dataFimContrato: atual.dataFimContrato || "",
      formaPagContrato: atual.formaPagContrato || "À vista",
      obsContrato: atual.obsContrato || "",
    });
    setAlterado(false);
  }, [obraId, obras]);

  const salvar = () => {
    if (!obraId) return;
    const dados = {
      ...obra,
      ...form,
      valorContrato: form.valorContrato || "",
    };
    onEditarObra(dados);
    setAlterado(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Pagamentos" sub="Gestão de contratos e condições" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <label style={labelS}>Obra</label>
        <select value={obraId} onChange={e => setObraId(e.target.value ? parseInt(e.target.value) : "")} style={selS}>
          <option value="">Selecione uma obra</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        {obraId ? (
          <div style={{ marginTop: 14, background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
            <label style={labelS}>Cliente / Contratante</label>
            <input value={form.cliente} onChange={e => set("cliente", e.target.value)} placeholder="Nome do cliente" style={inputS} />

            <label style={labelS}>CNPJ / CPF</label>
            <input value={form.clienteDoc} onChange={e => set("clienteDoc", e.target.value)} placeholder="00.000.000/0000-00" style={inputS} />

            <label style={labelS}>Valor do Contrato (R$)</label>
            <input value={form.valorContrato} onChange={e => set("valorContrato", e.target.value)} type="number" step="0.01" placeholder="0.00" style={inputS} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelS}>Data início</label>
                <input value={form.dataInicioContrato} onChange={e => set("dataInicioContrato", e.target.value)} type="date" style={dateS} />
              </div>
              <div>
                <label style={labelS}>Data fim</label>
                <input value={form.dataFimContrato} onChange={e => set("dataFimContrato", e.target.value)} type="date" style={dateS} />
              </div>
            </div>

            <label style={labelS}>Forma de Pagamento</label>
            <select value={form.formaPagContrato} onChange={e => set("formaPagContrato", e.target.value)} style={selS}>
              <option>À vista</option>
              <option>Parcelado em medições</option>
              <option>Empreitada total</option>
              <option>Por etapas</option>
              <option>Mensal</option>
              <option>Outra</option>
            </select>

            <label style={labelS}>Observações do contrato</label>
            <textarea value={form.obsContrato} onChange={e => set("obsContrato", e.target.value)} rows={3} placeholder="Cláusulas, retenções, encargos..." style={{ ...inputS, resize: "vertical", fontFamily: "inherit" }} />

            <button onClick={salvar} disabled={!alterado} style={{ width: "100%", marginTop: 14, padding: 12, background: alterado ? GREEN : "#d1d5db", color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, cursor: alterado ? "pointer" : "not-allowed" }}>
              {alterado ? "Salvar alterações" : "Sem alterações"}
            </button>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, textAlign: "center", color: "#666", marginTop: 14 }}>
            Selecione uma obra para editar as condições de pagamento.
          </div>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   FÉRIAS
════════════════════════════════════ */
