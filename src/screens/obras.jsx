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

export function TelaObras({ obras, usuarios = [], clientes = [], trabalhadores, ativos, equips, ferramentas, pedidos, abastecimentos, manutencoes, cronogramas, historico, recebimentos, rdosEmitidos, onBack, onAdd, onEditar, onRemover, onNav, onNavAnexos }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [obraSelecionada, setObraSelecionada] = useState(null);
  const [form, setForm] = useState({ nome: "", local: "", status: "Ativa", tipo: "Edificação", apontadorId: "", clienteId: "", cliente: "", clienteDoc: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const abrirNovo = () => { setEditandoId(null); setForm({ nome: "", local: "", status: "Ativa", tipo: "Edificação", apontadorId: "", clienteId: "", cliente: "", clienteDoc: "" }); setModal(true); };
  const abrirEdit = (o) => { setEditandoId(o.id); setForm({ ...o, clienteId: o.clienteId || "", cliente: o.cliente || "", clienteDoc: o.clienteDoc || "" }); setModal(true); };
  const salvar = () => {
    if (!form.nome || !form.local) return;
    const apontadorId = form.apontadorId ? (isNaN(Number(form.apontadorId)) ? form.apontadorId : Number(form.apontadorId)) : "";
    const clienteId = form.clienteId ? (isNaN(Number(form.clienteId)) ? form.clienteId : Number(form.clienteId)) : "";
    const dados = { ...form, apontadorId, clienteId };
    if (editandoId) onEditar({ ...dados, id: editandoId });
    else onAdd({ id: Date.now(), ...dados });
    setModal(false);
  };

  // Se uma obra está selecionada, mostra os detalhes
  if (obraSelecionada) {
    return <TelaObraDetalhe
      obra={obraSelecionada}
      usuarios={usuarios}
      clientes={clientes}
      trabalhadores={trabalhadores}
      ativos={ativos}
      equips={equips}
      ferramentas={ferramentas}
      pedidos={pedidos}
      abastecimentos={abastecimentos}
      manutencoes={manutencoes}
      cronogramas={cronogramas}
      historico={historico}
      recebimentos={recebimentos}
      rdosEmitidos={rdosEmitidos}
      onBack={() => setObraSelecionada(null)}
      onEditar={() => {
        // FIX: fechar tela de detalhe ANTES de abrir o modal
        // Antes: o modal abria mas ficava escondido atrás do detalhe
        const obraParaEditar = obraSelecionada;
        setObraSelecionada(null);
        // Pequeno delay para garantir que o detalhe fechou antes do modal abrir
        setTimeout(() => abrirEdit(obraParaEditar), 0);
      }}
      onNav={(destino) => {
        if (destino === "anexos_obra" && onNavAnexos) {
          onNavAnexos(obraSelecionada);
        } else if (onNav) {
          onNav(destino);
        }
      }}
    />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Obras" sub={`${obras.filter(o => o.status === "Ativa").length} ativas • Toque para ver detalhes`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {obras.map(o => {
          const nTrab = trabalhadores.filter(t => t.obraId === o.id).length;
          const nAtivos = (ativos || []).filter(a => a.obraId === o.id).length;
          const nPedidos = (pedidos || []).filter(p => p.obraId === o.id).length;
          const cron = (cronogramas || {})[o.id] || [];
          const progresso = cron.length > 0 ? Math.round(cron.reduce((s, e) => s + (e.progresso || 0), 0) / cron.length) : 0;
          return (
            <div key={o.id} data-test={`obra-card-${o.id}`} onClick={() => setObraSelecionada(o)} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 10, borderLeft: `5px solid ${o.status === "Ativa" ? GREEN : "#ccc"}`, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 15 }}>{o.nome}</div>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>📍 {o.local}</div>
                  {o.apontadorId && (
                    <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>👷 Apontador: {usuarios.find(u => u.id === o.apontadorId)?.nome || "Não encontrado"}</div>
                  )}
                  {progresso > 0 && (
                    <div style={{ marginTop: 8, marginBottom: 4 }}>
                      <div style={{ height: 5, background: "#eee", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: progresso + "%", height: "100%", background: progresso === 100 ? GREEN : ORANGE, transition: "width 0.3s" }}></div>
                      </div>
                      <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>📅 Cronograma: {progresso}%</div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <Badge label={o.status} color={o.status === "Ativa" ? GREEN : "#888"} small />
                    <Badge label={`👷 ${nTrab}`} color={BLUE} small />
                    {nAtivos > 0 && <Badge label={`🚜 ${nAtivos}`} color={ORANGE} small />}
                    {nPedidos > 0 && <Badge label={`📦 ${nPedidos}`} color="#7c3aed" small />}
                    {o.tipo && <Badge label={o.tipo === "Pavimentação" ? "🛣️ " + o.tipo : "🏢 " + o.tipo} color="#475569" small />}
                  </div>
                </div>
                <span style={{ color: "#bbb", fontSize: 24, marginLeft: 8 }}>›</span>
              </div>
            </div>
          );
        })}
        <Btn data-test="nova-obra" label="➕ Nova Obra" color={NAVY} onClick={abrirNovo} />
      </div>
      <KMFooter />
      <Modal show={modal} title={editandoId ? "Editar Obra" : "Nova Obra"} onClose={() => setModal(false)}>
        <label style={labelS}>Nome da Obra</label>
        <input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: Residencial Paraíso" style={inputS} />

        <label style={labelS}>Cidade / UF</label>
        <input value={form.local} onChange={e => set("local", e.target.value)} placeholder="Ex: Alegre - ES" style={inputS} />

        <label style={labelS}>📍 Endereço completo de entrega</label>
        <input value={form.endereco || ""} onChange={e => set("endereco", e.target.value)} placeholder="Rua, número, bairro" style={inputS} />

        <label style={labelS}>🚩 Ponto de referência (opcional)</label>
        <input value={form.refLocal || ""} onChange={e => set("refLocal", e.target.value)} placeholder="Ex: Próximo ao posto, esquina com farmácia" style={inputS} />

        <div style={{ background: "#f0f7ff", borderRadius: 10, padding: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#0c4a6e", fontWeight: 700, marginBottom: 4 }}>📡 Localização GPS (opcional)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input value={form.lat || ""} onChange={e => set("lat", e.target.value)} placeholder="Latitude" type="number" step="any" style={{ ...inputS, marginBottom: 0, fontSize: 12 }} />
            <input value={form.lng || ""} onChange={e => set("lng", e.target.value)} placeholder="Longitude" type="number" step="any" style={{ ...inputS, marginBottom: 0, fontSize: 12 }} />
          </div>
          <button onClick={() => {
            if (!navigator.geolocation) { alert("Geolocalização não disponível"); return; }
            navigator.geolocation.getCurrentPosition(
              p => { set("lat", p.coords.latitude.toFixed(6)); set("lng", p.coords.longitude.toFixed(6)); },
              () => alert("Não foi possível obter a localização"),
              { enableHighAccuracy: true }
            );
          }} style={{ width: "100%", marginTop: 6, padding: 8, background: BLUE, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>📡 Capturar localização atual</button>
        </div>

        <label style={labelS}>Tipo de Obra</label>
        <select value={form.tipo || "Edificação"} onChange={e => set("tipo", e.target.value)} style={selS}>
          <option>Edificação</option><option>Pavimentação</option><option>Drenagem</option><option>Reforma</option><option>Outra</option>
        </select>

        <label style={labelS}>👷 Apontador</label>
        <select value={form.apontadorId || ""} onChange={e => set("apontadorId", e.target.value)} style={selS}>
          <option value="">Selecionar apontador</option>
          {usuarios.filter(u => u.perfil !== "gestor").map(u => (
            <option key={u.id} value={u.id}>{u.nome}{u.cargo ? ` • ${u.cargo}` : ""}</option>
          ))}
        </select>

        <label style={labelS}>👤 Cliente</label>
        <select data-test="select-cliente-obras" value={form.clienteId || ""} onChange={e => {
          const value = e.target.value;
          const clienteId = value ? (isNaN(Number(value)) ? value : Number(value)) : "";
          const cliente = clientes.find(c => c.id === clienteId);
          if (cliente) {
            setForm(f => ({ ...f, clienteId, cliente: cliente.nome || "", clienteDoc: cliente.documento || "" }));
          } else {
            set("clienteId", clienteId);
          }
        }} style={selS}>
          <option value="">Selecionar cliente</option>
          {clientes.map(c => (
            <option key={c.id} value={c.id}>{c.nome}{c.cidade ? ` • ${c.cidade}` : ""}</option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <button data-test="gerenciar-clientes" onClick={() => onNav && onNav("clientes")} style={{ flex: 1, background: "#eef2ff", border: "1px solid #c7d2fe", color: NAVY, borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontWeight: 700 }}>Gerenciar clientes</button>
          <div style={{ flex: 2, background: "#f8fafc", borderRadius: 10, padding: 10, border: "1px solid #e2e8f0", fontSize: 11, color: "#475569" }}>
            Se o cliente não existir, crie-o em Clientes e depois selecione aqui. Caso queira manter um nome livre, deixe em branco e preencha o campo abaixo.
          </div>
        </div>

        {/* ════ CONTRATO DA OBRA ════ */}
        <div style={{ background: "#fff7e6", border: `1px solid ${GOLD}30`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#8a6d1a", letterSpacing: 1, marginBottom: 8 }}>📋 CONTRATO DA OBRA</div>

          <label style={labelS}>Cliente / Contratante</label>
          <input
            value={form.cliente || ""}
            onChange={e => set("cliente", e.target.value)}
            placeholder="Nome do cliente ou empresa contratante"
            style={inputS}
          />

          <label style={labelS}>CNPJ / CPF do contratante (opcional)</label>
          <input
            value={form.clienteDoc || ""}
            onChange={e => set("clienteDoc", e.target.value)}
            placeholder="00.000.000/0000-00 ou 000.000.000-00"
            style={inputS}
          />

          <label style={labelS}>💰 Valor do Contrato (R$)</label>
          <input
            value={form.valorContrato || ""}
            onChange={e => set("valorContrato", e.target.value)}
            type="number"
            step="0.01"
            placeholder="Ex: 250000.00"
            style={inputS}
          />
          {form.valorContrato && parseFloat(form.valorContrato) > 0 && (
            <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, marginTop: -8, marginBottom: 12 }}>
              ✓ R$ {parseFloat(form.valorContrato).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          )}

          <label style={labelS}>📅 Data de início do contrato</label>
          <input
            type="date"
            value={form.dataInicioContrato || ""}
            onChange={e => set("dataInicioContrato", e.target.value)}
            style={{ ...dateS }}
          />

          <label style={labelS}>🏁 Prazo final do contrato</label>
          <input
            type="date"
            value={form.dataFimContrato || ""}
            onChange={e => set("dataFimContrato", e.target.value)}
            style={{ ...dateS }}
          />

          <label style={labelS}>Forma de Pagamento</label>
          <select value={form.formaPagContrato || "À vista"} onChange={e => set("formaPagContrato", e.target.value)} style={selS}>
            <option>À vista</option>
            <option>Parcelado em medições</option>
            <option>Empreitada total</option>
            <option>Por etapas</option>
            <option>Mensal</option>
            <option>Outra</option>
          </select>

          <label style={labelS}>Observações do contrato (opcional)</label>
          <textarea
            value={form.obsContrato || ""}
            onChange={e => set("obsContrato", e.target.value)}
            rows={2}
            placeholder="Cláusulas especiais, garantias, multas, retenções..."
            style={{ ...inputS, fontFamily: "inherit", resize: "none" }}
          />
        </div>

        <label style={labelS}>Status</label>
        <select value={form.status} onChange={e => set("status", e.target.value)} style={selS}>
          <option>Ativa</option><option>Pausada</option><option>Concluída</option>
        </select>

        {editandoId && (
          <button onClick={() => { confirmar(`Remover ${form.nome}? Esta ação não pode ser desfeita.`, () => { onRemover(editandoId); setModal(false); }) }} style={{ width: "100%", padding: 10, background: "#fef2f2", color: RED, border: `1px solid ${RED}33`, borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 12, marginBottom: 8 }}>🗑️ Excluir Obra</button>
        )}
        <Btn label={editandoId ? "SALVAR" : "ADICIONAR"} color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   DETALHE DA OBRA — tudo relacionado
════════════════════════════════════ */

export function TelaObraDetalhe({ obra, usuarios = [], clientes = [], trabalhadores, ativos, equips, ferramentas, pedidos, abastecimentos, manutencoes, cronogramas, historico, recebimentos, rdosEmitidos, onBack, onEditar, onNav }) {
  const apontador = usuarios.find(u => u.id === obra.apontadorId);
  const cliente = clientes.find(c => String(c.id) === String(obra.clienteId));
  const trabObra = trabalhadores.filter(t => t.obraId === obra.id);
  const ativosObra = (ativos || []).filter(a => a.obraId === obra.id);
  const equipsObra = (equips || []).filter(e => e.obraId === obra.id);
  const ferramentasObra = (ferramentas || []).filter(f => f.obraId === obra.id);
  const pedidosObra = (pedidos || []).filter(p => p.obraId === obra.id);
  const abastObra = (abastecimentos || []).filter(a => a.obraId === obra.id);
  const manutObra = (manutencoes || []).filter(m => m.obraId === obra.id || ativosObra.some(a => a.id == m.itemId && m.tipoItem === "ativo"));
  const recebObra = (recebimentos || []).filter(r => r.obraId === obra.id);
  const rdosObra = (rdosEmitidos || []).filter(r => r.obraId === obra.id);
  const cron = (cronogramas || {})[obra.id] || [];
  const progresso = cron.length > 0 ? Math.round(cron.reduce((s, e) => s + (e.progresso || 0), 0) / cron.length) : 0;

  // Cálculos do mês
  const hoje = new Date();
  const mes = hoje.getMonth();
  const ano = hoje.getFullYear();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  let totalCustoMaoObra = 0;
  let diasTrabalhados = 0;
  trabObra.forEach(t => {
    let dias = 0;
    for (let d = 1; d <= totalDias; d++) {
      const iso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const s = (historico[iso] || {})[t.id];
      if (s === "Presente" || s === "Atestado") dias++;
    }
    totalCustoMaoObra += dias * (parseFloat(t.diaria) || 0);
    diasTrabalhados += dias;
  });

  const totalCombustivel = abastObra.filter(a => {
    if (!a.data) return false;
    try { const [d, m, y] = a.data.split("/"); return parseInt(m) - 1 === mes && parseInt(y) === ano; } catch { return false; }
  }).reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);

  // Custo de alimentação do mês — soma de todos os RDOs da obra no mês
  const totalAlimentacaoMes = rdosObra.filter(r => {
    if (!r.data) return false;
    try { const [d, m, y] = r.data.split("/"); return parseInt(m) - 1 === mes && parseInt(y) === ano; } catch { return false; }
  }).reduce((s, r) => s + (parseFloat(r.totalAlimentacao) || 0), 0);

  const totalMaterialAprov = pedidosObra.filter(p => p.status === "Aprovado" && p.data && p.data.includes(`/${String(mes + 1).padStart(2, "0")}/${ano}`)).length * 100;
  const custoTotalMes = totalCustoMaoObra + totalCombustivel + totalMaterialAprov + totalAlimentacaoMes;

  const Secao = ({ titulo, icone, valor, cor, onClickAcao, acaoLabel, children }) => (
    <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 20, marginRight: 8 }}>{icone}</div>
        <div style={{ flex: 1, fontWeight: 800, color: NAVY, fontSize: 13 }}>{titulo}</div>
        {valor !== undefined && <div style={{ background: cor, color: "#fff", padding: "3px 10px", borderRadius: 6, fontWeight: 800, fontSize: 12 }}>{valor}</div>}
      </div>
      {children}
      {onClickAcao && (
        <button onClick={onClickAcao} style={{ width: "100%", marginTop: 8, padding: 8, background: "#f3f4f6", color: NAVY, border: "none", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{acaoLabel} →</button>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title={obra.nome} sub="Detalhes completos" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* CABEÇALHO DA OBRA */}
        <div style={{ background: `linear-gradient(135deg,${NAVY},${NAVY2})`, color: "#fff", borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{obra.tipo === "Pavimentação" ? "🛣️" : "🏢"} {obra.nome}</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>📍 {obra.local} • {obra.status}</div>
            </div>
            <button onClick={onEditar} style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️ Editar</button>
          </div>
          {cron.length > 0 && (
            <>
              <div style={{ fontSize: 10, opacity: 0.85, marginTop: 4 }}>Progresso do cronograma</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.2)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: progresso + "%", height: "100%", background: GOLD, transition: "width 0.3s" }}></div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, color: GOLD }}>{progresso}%</div>
              </div>
            </>
          )}
        </div>

        {/* CARD CONTRATO (só aparece se tem valor cadastrado) */}
        {obra.valorContrato && parseFloat(obra.valorContrato) > 0 && (
          <div style={{
            background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY2} 100%)`,
            borderRadius: 14, padding: 14, marginBottom: 12,
            color: "#fff", boxShadow: "0 4px 14px rgba(15,33,81,0.3)",
            border: `2px solid ${GOLD}`,
          }}>
            <div style={{ fontSize: 10, color: GOLD, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 800, marginBottom: 4 }}>📋 CONTRATO DA OBRA</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 6 }}>
              R$ {parseFloat(obra.valorContrato).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            {apontador && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", marginBottom: 6 }}>
                👷 <b>{apontador.nome}</b>{apontador.cargo ? ` · ${apontador.cargo}` : ""}
              </div>
            )}
            {(cliente || obra.cliente) && (
              <div data-test="obra-cliente" style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", marginBottom: 6 }}>
                👤 <b>{cliente ? cliente.nome : obra.cliente}</b>{(cliente?.documento || obra.clienteDoc) && <span style={{ opacity: 0.7 }}> · {cliente?.documento || obra.clienteDoc}</span>}
              </div>
            )}
            {(obra.dataInicioContrato || obra.dataFimContrato) && (
              <div style={{ display: "flex", gap: 10, fontSize: 11, color: "rgba(255,255,255,0.85)", marginBottom: 4 }}>
                {obra.dataInicioContrato && <span>📅 Início: <b>{new Date(obra.dataInicioContrato + "T12:00:00").toLocaleDateString("pt-BR")}</b></span>}
                {obra.dataFimContrato && <span>🏁 Prazo: <b>{new Date(obra.dataFimContrato + "T12:00:00").toLocaleDateString("pt-BR")}</b></span>}
              </div>
            )}
            {/* Margem estimada (Valor contrato - custo do mês × meses estimados) */}
            {(() => {
              const valor = parseFloat(obra.valorContrato);
              if (custoTotalMes > 0 && obra.dataInicioContrato && obra.dataFimContrato) {
                const ini = new Date(obra.dataInicioContrato + "T12:00:00");
                const fim = new Date(obra.dataFimContrato + "T12:00:00");
                const mesesObra = Math.max(1, Math.round((fim - ini) / (1000 * 60 * 60 * 24 * 30)));
                const custoTotalProjetado = custoTotalMes * mesesObra;
                const margem = valor - custoTotalProjetado;
                const margemPct = (margem / valor) * 100;
                return (
                  <div style={{ marginTop: 8, background: "rgba(0,0,0,0.2)", padding: "6px 10px", borderRadius: 8, fontSize: 11 }}>
                    💼 Margem estimada: <b style={{ color: margem > 0 ? "#10b981" : "#ef4444" }}>R$ {margem.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b> ({margemPct.toFixed(1)}%)
                    <div style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>Estimativa baseada no custo do mês × {mesesObra} mês(es) de obra</div>
                  </div>
                );
              }
              return null;
            })()}
            {obra.formaPagContrato && (
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>💳 Pagamento: {obra.formaPagContrato}</div>
            )}
          </div>
        )}

        {/* RESUMO FINANCEIRO DO MÊS */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>💰 CUSTO ESTIMADO DO MÊS</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: GREEN, marginBottom: 10 }}>R$ {custoTotalMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div style={{ background: "#f0fdf4", padding: 8, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#888" }}>👷 Mão de obra</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: GREEN }}>R$ {totalCustoMaoObra.toFixed(2)}</div>
              <div style={{ fontSize: 9, color: "#888" }}>{diasTrabalhados} dias</div>
            </div>
            <div style={{ background: "#fff8f0", padding: 8, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#888" }}>⛽ Combustível</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: ORANGE }}>R$ {totalCombustivel.toFixed(2)}</div>
            </div>
            <div style={{ background: "#fef9e7", padding: 8, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#888" }}>☕ Alimentação</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#dc7e00" }}>R$ {totalAlimentacaoMes.toFixed(2)}</div>
            </div>
            <div style={{ background: "#f0f7ff", padding: 8, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#888" }}>📦 Materiais (est.)</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: BLUE }}>R$ {totalMaterialAprov.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* EQUIPE */}
        <Secao titulo="Equipe nesta obra" icone="👷" valor={trabObra.length} cor={BLUE} onClickAcao={() => onNav && onNav("equipe")} acaoLabel="Ver todos">
          {trabObra.length === 0 ? (
            <div style={{ color: "#aaa", fontSize: 12, fontStyle: "italic", padding: 6 }}>Sem equipe alocada.</div>
          ) : trabObra.slice(0, 5).map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f3f4f6" }}>
              {t.foto ? (
                <img src={t.foto} alt="" style={{ width: 28, height: 28, borderRadius: 14, objectFit: "cover", marginRight: 8 }} />
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: 14, background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, marginRight: 8 }}>👷</div>
              )}
              <div style={{ flex: 1, fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: NAVY }}>{t.nome}</div>
                <div style={{ fontSize: 10, color: "#888" }}>{t.cargo}</div>
              </div>
              {t.diaria && <div style={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>R$ {t.diaria}/dia</div>}
            </div>
          ))}
          {trabObra.length > 5 && <div style={{ fontSize: 11, color: "#888", textAlign: "center", padding: 4 }}>... e mais {trabObra.length - 5}</div>}
        </Secao>

        {/* ATIVOS / FROTA */}
        {ativosObra.length > 0 && (
          <Secao titulo="Ativos e Frota" icone="🚜" valor={ativosObra.length} cor={ORANGE} onClickAcao={() => onNav && onNav("ativos")} acaoLabel="Gerenciar">
            {ativosObra.map(a => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f3f4f6", fontSize: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, color: NAVY }}>{a.nome}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>{a.placa || a.tipo}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 10, color: "#666" }}>
                  {a.horimetro && <div>{a.horimetro}h</div>}
                  <div style={{ color: GREEN, fontWeight: 700 }}>R$ {(a.valorHora || 0)}/h</div>
                </div>
              </div>
            ))}
          </Secao>
        )}

        {/* EQUIPAMENTOS */}
        {equipsObra.length > 0 && (
          <Secao titulo="Equipamentos" icone="⚙️" valor={equipsObra.length} cor="#475569" onClickAcao={() => onNav && onNav("equip_gestao")} acaoLabel="Gerenciar">
            {equipsObra.slice(0, 5).map(e => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f3f4f6", fontSize: 12 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 16, marginRight: 6 }}>{e.icon || "⚙️"}</span>
                  <span style={{ fontWeight: 600, color: NAVY }}>{e.nome}</span>
                  <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>{e.codigo}</span>
                </div>
                <Badge label={e.status} color={EQUIP_COLOR[e.status]} small />
              </div>
            ))}
            {equipsObra.length > 5 && <div style={{ fontSize: 11, color: "#888", textAlign: "center", padding: 4 }}>... e mais {equipsObra.length - 5}</div>}
          </Secao>
        )}

        {/* PEDIDOS DE MATERIAL */}
        {pedidosObra.length > 0 && (
          <Secao titulo="Pedidos de Material" icone="📦" valor={pedidosObra.length} cor="#7c3aed">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 4 }}>
              <div style={{ background: "#f0fdf4", padding: 6, borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: GREEN }}>{pedidosObra.filter(p => p.status === "Aprovado").length}</div>
                <div style={{ fontSize: 9, color: "#666" }}>Aprovados</div>
              </div>
              <div style={{ background: "#fff8f0", padding: 6, borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: ORANGE }}>{pedidosObra.filter(p => p.status === "Aguardando").length}</div>
                <div style={{ fontSize: 9, color: "#666" }}>Aguardando</div>
              </div>
              <div style={{ background: "#fef2f2", padding: 6, borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: RED }}>{pedidosObra.filter(p => p.status === "Negado").length}</div>
                <div style={{ fontSize: 9, color: "#666" }}>Negados</div>
              </div>
            </div>
          </Secao>
        )}

        {/* ANEXOS */}
        <Secao titulo="Anexos" icone="📎" valor="" cor="#0891b2" onClickAcao={() => onNav && onNav("anexos_obra")} acaoLabel="Gerenciar anexos">
          <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5 }}>
            Projetos, contratos, ART/RRT, planilhas, licenças e demais documentos da obra.
          </div>
        </Secao>

        {/* CRONOGRAMA */}
        {cron.length > 0 ? (
          <Secao titulo="Cronograma" icone="📅" valor={`${progresso}%`} cor="#7c3aed" onClickAcao={() => onNav && onNav("cronograma")} acaoLabel="Editar cronograma">
            {cron.slice(0, 5).map((e, i) => {
              const cor = e.progresso === 100 ? GREEN : e.progresso > 0 ? ORANGE : "#aaa";
              return (
                <div key={e.id} style={{ display: "flex", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #f3f4f6", fontSize: 12 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 11, background: cor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 10, marginRight: 8 }}>{i + 1}</div>
                  <div style={{ flex: 1, color: NAVY, fontSize: 11 }}>{e.nome}</div>
                  <div style={{ fontSize: 10, color: cor, fontWeight: 700 }}>{e.progresso || 0}%</div>
                </div>
              );
            })}
            {cron.length > 5 && <div style={{ fontSize: 11, color: "#888", textAlign: "center", padding: 4 }}>... e mais {cron.length - 5} etapas</div>}
          </Secao>
        ) : (
          <Secao titulo="Cronograma" icone="📅" valor="—" cor="#aaa" onClickAcao={() => onNav && onNav("cronograma")} acaoLabel="Criar cronograma">
            <div style={{ color: "#aaa", fontSize: 11, fontStyle: "italic" }}>Cronograma ainda não criado.</div>
          </Secao>
        )}

        {/* RDOs */}
        {rdosObra.length > 0 && (
          <Secao titulo="RDOs Emitidos" icone="📄" valor={rdosObra.length} cor={BLUE} onClickAcao={() => onNav && onNav("rdo")} acaoLabel="Ver todos">
            {rdosObra.slice(0, 3).map(r => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f3f4f6", fontSize: 12 }}>
                <div>
                  <span style={{ fontWeight: 600, color: NAVY }}>RDO Nº {String(r.numero).padStart(3, "0")}</span>
                  {r.autoGerado && <span style={{ fontSize: 9, color: GREEN, fontWeight: 700, marginLeft: 6 }}>⚡ AUTO</span>}
                </div>
                <span style={{ fontSize: 11, color: "#666" }}>{r.data}</span>
              </div>
            ))}
          </Secao>
        )}

        {/* MANUTENÇÕES */}
        {manutObra.length > 0 && (
          <Secao titulo="Manutenções" icone="🔧" valor={manutObra.filter(m => !m.realizada).length} cor={RED} onClickAcao={() => onNav && onNav("manutencao")} acaoLabel="Gerenciar">
            <div style={{ fontSize: 11, color: "#666" }}>
              {manutObra.filter(m => !m.realizada).length} pendente(s) • {manutObra.filter(m => m.realizada).length} concluída(s)
            </div>
          </Secao>
        )}

      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   EQUIPE (GESTOR)
════════════════════════════════════ */

export function TelaMapa({ obras, trabalhadores, onBack, onEditar }) {
  const ativas = obras.filter(o => o.status === "Ativa");
  const totalTrab = trabalhadores.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Mapa de Obras" sub="Visão geral" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ background: `linear-gradient(135deg,${NAVY},#243b7a)`, borderRadius: 14, padding: 16, marginBottom: 14, color: "#fff", boxShadow: "0 4px 14px rgba(15,33,81,0.3)" }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Obras ativas</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{ativas.length}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Trabalhadores</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{totalTrab}</div>
            </div>
          </div>
        </div>

        {/* Mapa visual estilizado */}
        <div style={{ background: "#dde6f5", borderRadius: 14, padding: 14, marginBottom: 14, position: "relative", height: 200, overflow: "hidden", border: "1px solid #c5d0e5" }}>
          <div style={{ position: "absolute", top: 8, left: 12, fontSize: 11, color: "#888", fontWeight: 700 }}>📍 Mapa visual</div>
          {/* Grid de fundo */}
          <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0 }}>
            {[...Array(8)].map((_, i) => <line key={"h" + i} x1="0" y1={i * 25} x2="100%" y2={i * 25} stroke="#c5d0e5" strokeWidth="0.5" />)}
            {[...Array(10)].map((_, i) => <line key={"v" + i} x1={`${i * 10}%`} y1="0" x2={`${i * 10}%`} y2="100%" stroke="#c5d0e5" strokeWidth="0.5" />)}
          </svg>
          {/* Pinos das obras */}
          {ativas.map((o, i) => {
            const left = 15 + (i * 23) % 70;
            const top = 30 + (i * 37) % 130;
            return (
              <div key={o.id} style={{ position: "absolute", left: `${left}%`, top, fontSize: 32, cursor: "pointer", transform: "translate(-50%, -100%)" }} title={o.nome}>
                📍
              </div>
            );
          })}
        </div>

        {/* Lista de obras com info detalhada */}
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, fontSize: 14 }}>📋 Obras Cadastradas</div>
        {obras.map(o => {
          const nTrab = trabalhadores.filter(t => t.obraId === o.id).length;
          return (
            <div key={o.id} onClick={() => onEditar && onEditar(o)} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer", borderLeft: `5px solid ${o.status === "Ativa" ? GREEN : "#ccc"}` }}>
              <div style={{ fontSize: 28, marginRight: 12 }}>📍</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{o.nome}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{o.local}</div>
                <div style={{ fontSize: 11, color: BLUE, marginTop: 2 }}>👷 {nTrab} trabalhador(es)</div>
              </div>
              <Badge label={o.status} color={o.status === "Ativa" ? GREEN : "#888"} small />
            </div>
          );
        })}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   ALERTAS AUTOMÁTICOS
════════════════════════════════════ */
