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

export function TelaGerarSimulacao({ onGerar, onBack }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Gerar 30 Dias" sub="Modo demonstração" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        <div style={{ background: `linear-gradient(135deg,#7c3aed,#5b21b6)`, color: "#fff", borderRadius: 14, padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>🎬</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Simular 1 mês de operação</div>
          <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4 }}>
            Pré-popula o app com dados realistas pra você ver como tudo funciona depois de um mês de uso.
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 8 }}>📋 O que vai ser gerado:</div>
          <div style={{ fontSize: 12, color: "#444", lineHeight: 1.7 }}>
            ✅ <b>30 dias</b> de presença (70% Presente, 20% Falta, 10% Atestado)<br/>
            ✅ <b>~70 RDOs</b> (1 por obra ativa por dia útil)<br/>
            ✅ <b>~350 fotos</b> carimbadas (5 por obra/dia)<br/>
            ✅ <b>~10 pedidos</b> de material (com aprovados/negados/pendentes)<br/>
            ✅ <b>~7 despesas avulsas</b> (PIPA, frete, etc)<br/>
            ✅ <b>~6 anotações</b> no diário<br/>
            ✅ <b>~4 movimentações</b> de pessoal<br/>
            ✅ <b>~3 movimentações</b> de equipamento<br/>
            ✅ <b>~6 abastecimentos</b><br/>
            ✅ <b>~4 recebimentos</b> (medições)<br/>
            ✅ <b>2 adiantamentos</b><br/>
            ✅ <b>12 entradas</b> de produtividade
          </div>
        </div>

        <div style={{ background: "#fef9e7", borderRadius: 12, padding: 12, marginBottom: 10, fontSize: 11, color: "#8b6f00", lineHeight: 1.5 }}>
          ⚠️ <b>Cuidado:</b> Isto vai <b>SUBSTITUIR</b> todos os dados atuais (RDOs, pedidos, fotos, despesas, etc).<br/><br/>
          🗑️ Você pode <b>excluir cada um manualmente</b> depois pra ver o app vazio de novo.<br/><br/>
          💾 Antes de gerar, recomendo fazer um <b>Backup</b> em <i>Sistema → Backup</i>.
        </div>

        <Btn label="🎬 GERAR 30 DIAS DE DADOS" color="#7c3aed" onClick={onGerar} />
        <Btn label="Cancelar" color="#eee" text={NAVY} onClick={onBack} style={{ marginTop: 8 }} />
      </div>
      <KMFooter />
    </div>
  );
}


export function TelaBackup({ todoEstado, onRestaurar, onBack }) {
  const [textoImport, setTextoImport] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [modoImportar, setModoImportar] = useState(false);

  const dataHoje = new Date().toISOString().split("T")[0];
  const filename = `kmzero-backup-${dataHoje}.json`;

  const exportar = () => {
    const json = JSON.stringify(todoEstado, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setSucesso("✅ Backup exportado!");
    setTimeout(() => setSucesso(""), 3000);
  };

  const compartilhar = async () => {
    const json = JSON.stringify(todoEstado, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const file = new File([blob], filename, { type: "application/json" });
    const data = {
      title: "Backup KMZERO",
      text: `Backup do KMZERO • ${new Date().toLocaleString("pt-BR")}\n\n📊 Resumo:\n• ${todoEstado.obras?.length || 0} obras\n• ${todoEstado.trabalhadores?.length || 0} trabalhadores\n• ${Object.keys(todoEstado.historico || {}).length} dias de histórico`,
    };
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ ...data, files: [file] });
        setSucesso("✅ Backup compartilhado!");
        setTimeout(() => setSucesso(""), 3000);
        return;
      } catch (e) { if (e.name !== "AbortError") setErro("Erro ao compartilhar"); return; }
    }
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch (e) {}
    }
    setErro("⚠️ Compartilhamento não suportado. Use 'Baixar Backup' e envie o arquivo manualmente.");
  };

  const enviarWhatsApp = () => {
    const resumo = `*Backup KMZERO* — ${new Date().toLocaleString("pt-BR")}\n\n📊 Resumo dos dados:\n• ${todoEstado.obras?.length || 0} obras\n• ${todoEstado.trabalhadores?.length || 0} trabalhadores\n• ${todoEstado.equips?.length || 0} equipamentos\n• ${todoEstado.pedidos?.length || 0} pedidos\n• ${Object.keys(todoEstado.historico || {}).length} dias com registro\n\n⚠️ Anexe o arquivo JSON baixado.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(resumo)}`, "_blank");
  };

  const enviarEmail = () => {
    const corpo = `Backup KMZERO — ${new Date().toLocaleString("pt-BR")}%0A%0A📊 Resumo dos dados:%0A• ${todoEstado.obras?.length || 0} obras%0A• ${todoEstado.trabalhadores?.length || 0} trabalhadores%0A• ${todoEstado.equips?.length || 0} equipamentos%0A• ${todoEstado.pedidos?.length || 0} pedidos%0A• ${Object.keys(todoEstado.historico || {}).length} dias com registro%0A%0A⚠️ Anexe o arquivo JSON baixado.`;
    window.location.href = `mailto:?subject=${encodeURIComponent("Backup KMZERO - " + dataHoje)}&body=${corpo}`;
  };

  const importarArquivo = (e) => {
    setErro(""); setSucesso("");
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const dados = JSON.parse(ev.target.result);
        if (!dados.obras || !dados.trabalhadores) throw new Error("inválido");
        if (!confirm("Tem certeza? Os dados atuais serão substituídos pelos do arquivo.")) return;
        onRestaurar(dados);
        setSucesso("✅ Dados restaurados com sucesso!");
      } catch {
        setErro("⚠️ Arquivo inválido. Verifique se é um backup do KMZERO.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const importarTexto = () => {
    setErro(""); setSucesso("");
    try {
      const dados = JSON.parse(textoImport);
      if (!dados.obras || !dados.trabalhadores) throw new Error("inválido");
      if (!confirm("Tem certeza? Os dados atuais serão substituídos.")) return;
      onRestaurar(dados);
      setSucesso("✅ Dados restaurados!");
      setTextoImport("");
    } catch {
      setErro("⚠️ JSON inválido.");
    }
  };

  const stats = {
    Obras: todoEstado.obras?.length || 0,
    Trabalhadores: todoEstado.trabalhadores?.length || 0,
    "Ativos/Frota": todoEstado.ativos?.length || 0,
    Equipamentos: todoEstado.equips?.length || 0,
    Ferramentas: todoEstado.ferramentas?.length || 0,
    Pedidos: todoEstado.pedidos?.length || 0,
    "Dias c/ presença": Object.keys(todoEstado.historico || {}).length,
    "RDOs emitidos": todoEstado.rdosEmitidos?.length || 0,
    "Anotações": todoEstado.diario?.length || 0,
    "Links salvos": todoEstado.links?.length || 0,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Backup & Restaurar" sub="Segurança dos seus dados" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📦 Resumo dos Dados</div>
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f0f0f0" }}>
              <span style={{ fontSize: 13, color: "#666" }}>{k}</span>
              <span style={{ fontSize: 13, color: NAVY, fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 4, fontSize: 14 }}>💾 Salvar Backup</div>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>Recomendação: faça backup ao menos 1× por semana.</div>

          <button onClick={compartilhar} style={{ width: "100%", padding: 14, marginBottom: 8, background: BLUE, color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: `0 4px 14px ${BLUE}44`, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            📲 Compartilhar (WhatsApp / Drive / Email)
          </button>
          <div style={{ fontSize: 10, color: "#888", textAlign: "center", marginBottom: 10 }}>Funciona melhor no celular</div>

          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button onClick={enviarWhatsApp} style={{ flex: 1, padding: 10, background: "#25D366", color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>💬 WhatsApp</button>
            <button onClick={enviarEmail} style={{ flex: 1, padding: 10, background: "#dc2626", color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>📧 E-mail</button>
          </div>
          <button onClick={exportar} style={{ width: "100%", padding: 12, background: GREEN, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>💾 Baixar Arquivo .json</button>
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 4, fontSize: 14 }}>📥 Restaurar Backup</div>
          <div style={{ fontSize: 11, color: ORANGE, marginBottom: 10, fontWeight: 600 }}>⚠️ Cuidado: substitui todos os dados atuais.</div>

          <label style={{ display: "block", padding: 12, borderRadius: 10, border: "1.5px dashed #c5d0e5", background: "#f9fafb", textAlign: "center", cursor: "pointer", fontSize: 13, color: NAVY, fontWeight: 600, marginBottom: 8 }}>
            📁 Escolher arquivo .json
            <input type="file" accept=".json,application/json" onChange={importarArquivo} style={{ display: "none" }} />
          </label>

          <button onClick={() => setModoImportar(!modoImportar)} style={{ background: "none", border: "none", color: BLUE, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
            {modoImportar ? "▲ Esconder" : "▼ Ou colar texto JSON"}
          </button>

          {modoImportar && (
            <div style={{ marginTop: 10 }}>
              <textarea value={textoImport} onChange={e => setTextoImport(e.target.value)} rows={5} placeholder='{"obras":[...],"trabalhadores":[...]}' style={{ ...inputS, resize: "none", fontFamily: "monospace", fontSize: 11 }} />
              <Btn label="⚠️ Restaurar do texto" color={ORANGE} onClick={importarTexto} />
            </div>
          )}
        </div>

        {sucesso && <div style={{ background: "#f0fdf4", color: GREEN, borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{sucesso}</div>}
        {erro && <div style={{ background: "#fef2f2", color: RED, borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{erro}</div>}

        <div style={{ background: "#fffaeb", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "#8b6f00", marginTop: 12 }}>
          💡 <b>Dica:</b> use o botão "Compartilhar" no celular pra enviar o backup direto pro Google Drive, e-mail ou WhatsApp num só toque.
        </div>
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   MAPA DE OBRAS (visualização simplificada)
════════════════════════════════════ */

export function TelaEscritorio({ obras, funcEscritorio, onBack, onAdd, onEditar, onRemover }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ nome: "", cargo: "", salarioMensal: "", ativo: true, dataAdmissao: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const obrasAtivas = obras.filter(o => o.status === "Ativa");
  const numObrasAtivas = obrasAtivas.length || 1;

  const totalIndireto = funcEscritorio.filter(f => f.ativo).reduce((s, f) => s + (parseFloat(f.salarioMensal) || 0), 0);
  const rateioPorObra = totalIndireto / numObrasAtivas;

  const abrirNovo = () => { setEditandoId(null); setForm({ nome: "", cargo: "", salarioMensal: "", ativo: true, dataAdmissao: "" }); setModal(true); };
  const abrirEdit = (f) => { setEditandoId(f.id); setForm(f); setModal(true); };
  const salvar = () => {
    if (!form.nome) return;
    if (editandoId) onEditar({ ...form, id: editandoId, salarioMensal: parseFloat(form.salarioMensal) || 0 });
    else onAdd({ ...form, id: Date.now(), salarioMensal: parseFloat(form.salarioMensal) || 0 });
    setModal(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Escritório" sub="Funcionários indiretos" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* CARD EXPLICATIVO */}
        <div style={{ background: "#f3e8ff", borderRadius: 12, padding: 14, marginBottom: 12, border: `1px solid #7c3aed33` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#5b21b6", marginBottom: 4 }}>📐 Custo indireto / Rateio</div>
          <div style={{ fontSize: 11, color: "#5b21b6", lineHeight: 1.5 }}>
            Funcionários do escritório (engenheiro, secretária, contador, etc) têm o salário <b>rateado igualmente</b> entre as obras ativas. Aparece em cada obra como <b>"Mão de obra indireta"</b>.
          </div>
        </div>

        {/* RESUMO RATEIO */}
        <div style={{ background: `linear-gradient(135deg,${NAVY},${NAVY2 || "#243b7a"})`, color: "#fff", borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>💰 Custo total mensal indireto</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: GOLD, marginTop: 4 }}>R$ {totalIndireto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: 8, textAlign: "center" }}>
              <div style={{ fontSize: 10, opacity: 0.85 }}>🏗️ Obras ativas</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{numObrasAtivas}</div>
            </div>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: 8, textAlign: "center" }}>
              <div style={{ fontSize: 10, opacity: 0.85 }}>📊 Rateio por obra</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: GOLD }}>R$ {rateioPorObra.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <Btn label="➕ Adicionar Funcionário do Escritório" color={NAVY} onClick={abrirNovo} style={{ marginBottom: 12 }} />

        {/* LISTA */}
        {funcEscritorio.length === 0 ? (
          <EmptyState
            icon="📐"
            titulo="Nenhum funcionário do escritório"
            subtitulo="Cadastre engenheiros, mestres de obra, encarregados administrativos. Custos são rateados entre as obras ativas."
            cor="#7c3aed"
          />
        ) : funcEscritorio.map(f => (
          <div key={f.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${f.ativo ? "#7c3aed" : "#ccc"}`, opacity: f.ativo ? 1 : 0.6 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ fontSize: 32, marginRight: 12 }}>📐</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{f.nome}{!f.ativo && <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>(inativo)</span>}</div>
                <div style={{ fontSize: 11, color: "#666" }}>{f.cargo || "—"}</div>
                <div style={{ fontSize: 12, color: GREEN, fontWeight: 700, marginTop: 4 }}>R$ {(parseFloat(f.salarioMensal) || 0).toFixed(2)}/mês</div>
                {f.ativo && numObrasAtivas > 0 && (
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2, fontStyle: "italic" }}>
                    → R$ {((parseFloat(f.salarioMensal) || 0) / numObrasAtivas).toFixed(2)} por obra ativa
                  </div>
                )}
              </div>
              <button onClick={() => abrirEdit(f)} style={{ background: "none", border: "none", color: BLUE, fontSize: 18, cursor: "pointer" }}>✏️</button>
            </div>
          </div>
        ))}
      </div>
      <KMFooter />

      <Modal show={modal} title={editandoId ? "Editar Funcionário" : "Novo Funcionário"} onClose={() => setModal(false)}>
        <label style={labelS}>Nome</label>
        <input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: Mozart" style={inputS} />
        <label style={labelS}>Cargo / Função</label>
        <input value={form.cargo} onChange={e => set("cargo", e.target.value)} placeholder="Ex: Engenheiro Orçamentista" style={inputS} />
        <label style={labelS}>💰 Salário mensal (R$)</label>
        <input value={form.salarioMensal} onChange={e => set("salarioMensal", e.target.value)} type="number" placeholder="Ex: 5000" style={inputS} />
        <label style={labelS}>Data de Admissão</label>
        <input value={form.dataAdmissao} onChange={e => set("dataAdmissao", e.target.value)} type="date" style={dateS} />
        <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: NAVY, fontWeight: 600 }}>
            <input type="checkbox" checked={!!form.ativo} onChange={e => set("ativo", e.target.checked)} style={{ width: 18, height: 18 }} />
            Ativo (entrar no rateio)
          </label>
          <div style={{ fontSize: 10, color: "#888", marginTop: 4, marginLeft: 26 }}>Desmarque se ele estiver de férias ou afastado.</div>
        </div>
        {editandoId && (
          <button onClick={() => { confirmar(`Remover ${form.nome}?`, () => { onRemover(editandoId); setModal(false); }) }} style={{ width: "100%", padding: 10, background: "#fef2f2", color: RED, border: `1px solid ${RED}33`, borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 12, marginBottom: 8 }}>🗑️ Excluir</button>
        )}
        <Btn label="💾 SALVAR" color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   CONFIG EMPRESA
════════════════════════════════════ */
/* ════════════════════════════════════
   ACESSOS DO APP — Gerenciar usuários (gestor cria/edita/deleta lançadores)
════════════════════════════════════ */

export function TelaAjuda({ empresa, onBack }) {
  const [abertos, setAbertos] = useState({});
  const [aba, setAba] = useState("sobre"); // "sobre" | "faq" | "termos" | "lgpd"

  const toggleFaq = (id) => setAbertos(o => ({ ...o, [id]: !o[id] }));

  const faqs = [
    {
      id: "como_inicio",
      pergunta: "Como começo a usar o KMZERO?",
      resposta: "O KMZERO já vem com dados de exemplo. Como gestor, você acessa o Painel do Gestor pela tela inicial. Pelo menu Sistema → Empresa, configura os dados da sua empresa. Pelo menu Recursos Humanos → Equipe, cadastra trabalhadores e encarregados. Pelo menu Obras & Recursos → Obras, cadastra as obras em andamento. Os encarregados acessam pelo seu próprio cadastro (criado em Sistema → Acessos do App).",
    },
    {
      id: "como_rdo",
      pergunta: "Como faço um RDO (Relatório Diário de Obra)?",
      resposta: "No Painel do Gestor, toque em RDO ABNT (botão dourado em Acesso Rápido). Escolha a obra, depois confirme a presença dos trabalhadores marcando quem trabalhou. Em seguida o aplicativo registra serviços executados, equipamentos usados e fotos da obra. Ao finalizar, gera um relatório no padrão ABNT pronto para imprimir ou enviar.",
    },
    {
      id: "como_pedidos",
      pergunta: "Como aprovo um pedido de compra?",
      resposta: "Quando um encarregado faz um pedido pelo aplicativo, ele aparece no Painel do Gestor com etiqueta laranja \"Aguardando Aprovação\". Toque no pedido para ver os itens. Para aprovar, escolha a forma de pagamento, o prazo e o fornecedor. O aplicativo gera uma Solicitação de Pedido de Compra em PDF que você pode enviar diretamente ao fornecedor.",
    },
    {
      id: "como_folha",
      pergunta: "Como gero a folha quinzenal de pagamento?",
      resposta: "Em Recursos Humanos → Folha de Pagamento, selecione o período. O aplicativo calcula automaticamente os dias trabalhados, horas extras, descontos de adiantamentos e o valor líquido a pagar. Você pode exportar a folha em PDF para arquivo ou envio aos trabalhadores.",
    },
    {
      id: "esqueci_senha",
      pergunta: "Esqueci minha senha. O que fazer?",
      resposta: "Na tela de login do gestor, toque em \"Esqueci minha senha\" abaixo do botão ENTRAR. Digite seu email cadastrado. Você vai receber um link de recuperação no email para definir uma nova senha. Verifique a caixa de entrada e a pasta de spam. O email pode demorar até 3 minutos.",
    },
    {
      id: "trocar_senha",
      pergunta: "Como troco minha senha sem precisar do email?",
      resposta: "Acesse o menu Sistema → Minha Conta. Lá você encontra a opção de trocar senha. Informe a senha atual e defina uma nova. A troca acontece imediatamente, sem precisar do email.",
    },
    {
      id: "encarregado_acessar",
      pergunta: "Como os encarregados acessam o aplicativo?",
      resposta: "O gestor cadastra cada encarregado em Sistema → Acessos do App, definindo um email e uma senha simples. Esses dados são compartilhados com o encarregado, que entra na tela inicial selecionando o próprio perfil. Os encarregados só veem a obra à qual estão vinculados.",
    },
    {
      id: "offline",
      pergunta: "O aplicativo funciona sem internet?",
      resposta: "Sim. O KMZERO foi projetado para funcionar offline. Os dados ficam salvos localmente no aparelho e podem ser usados sem internet. Quando a conexão voltar, os dados serão sincronizados com a nuvem automaticamente.",
    },
    {
      id: "fotos",
      pergunta: "Onde ficam guardadas as fotos das obras?",
      resposta: "Todas as fotos tiradas pelo aplicativo (fotos do RDO, fotos de equipamentos, fotos de fichas de trabalhadores) ficam guardadas no próprio aplicativo e podem ser vistas em Operação Diária → Galeria Fotos, agrupadas por obra e data.",
    },
    {
      id: "backup",
      pergunta: "Como faço backup dos dados?",
      resposta: "Em Sistema → Backup, você pode exportar todos os dados em arquivo único para guardar no seu computador. Recomendamos fazer backup pelo menos uma vez por mês. Em breve, com a sincronização na nuvem ativa, o backup será automático.",
    },
    {
      id: "suporte",
      pergunta: "Como entro em contato com o suporte?",
      resposta: "Para falar com o suporte técnico do KMZERO, use o WhatsApp (28) 99925-8172, envie email para kvmprojetos@gmail.com, ou siga @km_engenharias no Instagram. O atendimento é de segunda a sexta, das 8h às 18h.",
    },
  ];

  const wppUrl = "https://wa.me/5528999258172?text=" + encodeURIComponent("Olá! Preciso de ajuda com o KMZERO.");

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Ajuda & Suporte" sub="FAQ, Termos e Contato" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* CARD CONTATO RÁPIDO */}
        <div style={{
          background: `linear-gradient(135deg, ${GREEN} 0%, #15803d 100%)`,
          color: "#fff",
          borderRadius: 14,
          padding: 16,
          marginBottom: 14,
          boxShadow: "0 4px 16px rgba(22,163,74,0.25)",
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>💬 Precisa de ajuda agora?</div>
          <div style={{ fontSize: 11, opacity: 0.95, marginBottom: 12, lineHeight: 1.5 }}>
            Entre em contato pelos canais oficiais da KM Consultoria. Atendimento de segunda a sexta, das 8h às 18h.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href={wppUrl} target="_blank" rel="noopener noreferrer" style={{
              flex: "1 1 130px",
              background: "rgba(255,255,255,0.18)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              textAlign: "center",
              backdropFilter: "blur(6px)",
            }}>💬 WhatsApp</a>
            <a href="mailto:kvmprojetos@gmail.com?subject=Suporte%20KMZERO" style={{
              flex: "1 1 130px",
              background: "rgba(255,255,255,0.18)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              textAlign: "center",
              backdropFilter: "blur(6px)",
            }}>✉️ E-mail</a>
            <a href="https://instagram.com/km_engenharias" target="_blank" rel="noopener noreferrer" style={{
              flex: "1 1 130px",
              background: "rgba(255,255,255,0.18)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              textAlign: "center",
              backdropFilter: "blur(6px)",
            }}>📷 Instagram</a>
          </div>
          <div style={{ fontSize: 10, opacity: 0.85, marginTop: 10, textAlign: "center" }}>
            📞 (28) 99925-8172 · ✉️ kvmprojetos@gmail.com
          </div>
        </div>

        {/* ABAS */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {[
            { k: "sobre", l: "ℹ️ Sobre", c: "#0F2151" },
            { k: "faq", l: "🆘 Perguntas", c: "#16a34a" },
            { k: "termos", l: "📄 Termos", c: "#0891b2" },
            { k: "lgpd", l: "🔒 LGPD", c: "#7c3aed" },
          ].map(t => (
            <button
              key={t.k}
              onClick={() => setAba(t.k)}
              style={{
                flex: "1 1 90px",
                padding: "10px 6px",
                background: aba === t.k ? t.c : "#fff",
                color: aba === t.k ? "#fff" : "#666",
                border: aba === t.k ? "none" : "1px solid #e5e7eb",
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: aba === t.k ? `0 3px 10px ${t.c}40` : "none",
              }}
            >{t.l}</button>
          ))}
        </div>

        {/* CONTEÚDO SOBRE */}
        {aba === "sobre" && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 0, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            {/* Header navy com logo */}
            <div style={{
              background: "linear-gradient(135deg, #0F2151 0%, #1e3a8a 100%)",
              padding: "24px 20px",
              textAlign: "center",
              color: "#fff",
            }}>
              <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
                🏗️ GESTÃO DE OBRAS
              </div>
              <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: -1.5 }}>
                <span style={{ color: "#fff" }}>KM</span>
                <span style={{ color: "#F5A623" }}>ZERO</span>
              </div>
              <div style={{ height: 2, width: 50, background: "#F5A623", margin: "10px auto", borderRadius: 2 }} />
              <div style={{ fontSize: 13, fontStyle: "italic", opacity: 0.9 }}>
                KM Consultoria · Engenharia Civil
              </div>
            </div>

            {/* Quem desenvolveu */}
            <div style={{ padding: "20px 18px" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0F2151", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                👨‍💼 Quem desenvolve
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: 30,
                  background: "linear-gradient(135deg, #F5A623, #FFC857)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28, flexShrink: 0,
                  boxShadow: "0 4px 14px rgba(245,166,35,0.4)",
                }}>👷</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0F2151" }}>
                    Kleber Vieira Martins
                  </div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                    Engenheiro Civil · CREA-ES
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, lineHeight: 1.5 }}>
                    Fundador da KM Consultoria, em Alegre-ES. Atua há mais de 10 anos em obras civis no sul capixaba.
                  </div>
                </div>
              </div>

              <div style={{
                background: "#FFF7E6",
                borderLeft: "4px solid #F5A623",
                padding: "10px 14px",
                fontSize: 12,
                color: "#444",
                lineHeight: 1.6,
                borderRadius: "0 8px 8px 0",
                marginBottom: 16,
              }}>
                "O KMZERO nasceu de uma frustração real: gerir obras no papel, em planilhas e por WhatsApp não dava conta. Construí o que eu mesmo gostaria de ter em campo, com a linguagem e os processos de quem está no canteiro todo dia."
              </div>
            </div>

            {/* O que é */}
            <div style={{ padding: "0 18px 16px", borderTop: "1px solid #f3f4f6", paddingTop: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0F2151", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                🎯 O que é o KMZERO
              </div>
              <div style={{ fontSize: 12, color: "#444", lineHeight: 1.7 }}>
                O KMZERO é um aplicativo profissional de gestão de obras, desenvolvido em Engenharia Civil pela KM Consultoria. Centraliza em uma plataforma única o controle de equipes, materiais, custos, relatórios técnicos e comunicação entre canteiro e escritório.
              </div>
            </div>

            {/* Tecnologia */}
            <div style={{ padding: "0 18px 16px", borderTop: "1px solid #f3f4f6", paddingTop: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0F2151", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                ⚡ Tecnologia
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
                {[
                  ["🔒 Firebase Auth", "Google Cloud"],
                  ["☁️ Firestore", "Banco em São Paulo"],
                  ["📱 React + Vite", "Frontend moderno"],
                  ["🌐 Vercel", "CDN global"],
                  ["📄 jsPDF", "Relatórios ABNT"],
                  ["🔐 LGPD", "Conformidade legal"],
                ].map(([k, v], i) => (
                  <div key={i} style={{
                    background: "#f9fafb",
                    padding: "8px 10px",
                    borderRadius: 8,
                    borderLeft: "3px solid #0F2151",
                  }}>
                    <div style={{ fontWeight: 700, color: "#0F2151" }}>{k}</div>
                    <div style={{ color: "#64748b", fontSize: 10 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contato direto */}
            <div style={{ padding: "16px 18px", borderTop: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0F2151", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                💬 Fale com a KM
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                <a href="https://wa.me/5528999258172?text=Olá! Vim do app KMZERO." target="_blank" rel="noopener noreferrer" style={{ color: "#16a34a", textDecoration: "none", fontWeight: 700 }}>
                  💬 WhatsApp (28) 99925-8172
                </a>
                <a href="mailto:kvmprojetos@gmail.com?subject=Contato KMZERO" style={{ color: "#0891b2", textDecoration: "none", fontWeight: 700 }}>
                  ✉️ kvmprojetos@gmail.com
                </a>
                <a href="https://instagram.com/km_engenharias" target="_blank" rel="noopener noreferrer" style={{ color: "#E4405F", textDecoration: "none", fontWeight: 700 }}>
                  📷 @km_engenharias
                </a>
              </div>
            </div>

            {/* Footer da seção Sobre */}
            <div style={{
              background: "#f9fafb",
              padding: "12px 18px",
              textAlign: "center",
              fontSize: 10,
              color: "#94a3b8",
              borderTop: "1px solid #f3f4f6",
            }}>
              <div style={{ fontWeight: 700, color: "#475569", letterSpacing: 1 }}>KMZERO · Versão 1.0 · Maio/2026</div>
              <div style={{ marginTop: 4 }}>© 2026 KM Consultoria · CNPJ 60.368.233/0001-73</div>
              <div style={{ marginTop: 4 }}>Alegre · ES · Brasil</div>
            </div>
          </div>
        )}

        {/* CONTEÚDO FAQ */}
        {aba === "faq" && (
          <div>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 10, lineHeight: 1.5, padding: "0 4px" }}>
              Toque em uma pergunta para ver a resposta. Se não encontrar o que precisa, fale com o suporte pelos canais acima.
            </div>
            {faqs.map(f => (
              <div key={f.id} style={{ background: "#fff", borderRadius: 12, marginBottom: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                <button
                  onClick={() => toggleFaq(f.id)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: abertos[f.id] ? "#f0fdf4" : "#fff",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    transition: "background 0.2s ease",
                  }}
                >
                  <div style={{ fontSize: 16, color: GREEN }}>{abertos[f.id] ? "❓" : "❔"}</div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: NAVY }}>{f.pergunta}</div>
                  <div style={{
                    fontSize: 18,
                    color: GREEN,
                    transition: "transform 0.2s ease",
                    transform: abertos[f.id] ? "rotate(45deg)" : "rotate(0)",
                  }}>+</div>
                </button>
                {abertos[f.id] && (
                  <div style={{
                    padding: "0 14px 14px 38px",
                    fontSize: 12,
                    color: "#444",
                    lineHeight: 1.7,
                    background: "#f9fafb",
                    borderTop: "1px solid #e5e7eb",
                    paddingTop: 12,
                  }}>
                    {f.resposta}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* CONTEÚDO TERMOS */}
        {aba === "termos" && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 8 }}>📄 Termos de Uso</div>
            <div style={{ fontSize: 10, color: "#888", marginBottom: 14 }}>Última atualização: maio de 2026</div>

            <div style={{ fontSize: 12, color: "#333", lineHeight: 1.7 }}>
              <p style={{ marginTop: 0 }}>
                <b>1. Aceitação dos termos</b><br/>
                Ao usar o KMZERO, você concorda com estes termos. Se não concordar, por favor não utilize o aplicativo.
              </p>

              <p>
                <b>2. Sobre o aplicativo</b><br/>
                O KMZERO é um aplicativo de gestão de obras desenvolvido pela KM Consultoria (CNPJ 60.368.233/0001-73), destinado ao controle interno de canteiros, equipes, materiais, custos e relatórios. O aplicativo é fornecido "no estado em que se encontra", sem garantia de operação ininterrupta.
              </p>

              <p>
                <b>3. Conta e segurança</b><br/>
                Você é responsável por manter sigilo sobre sua senha e por todas as atividades realizadas com sua conta. Em caso de uso indevido suspeito, troque sua senha e informe o suporte imediatamente.
              </p>

              <p>
                <b>4. Uso permitido</b><br/>
                O KMZERO é destinado exclusivamente para gestão de obras civis. É proibido usar o aplicativo para qualquer finalidade ilícita, para fraudar registros oficiais, ou para qualquer atividade que viole a legislação brasileira.
              </p>

              <p>
                <b>5. Conteúdo do usuário</b><br/>
                Você é proprietário dos dados que insere no aplicativo (cadastros, fotos, relatórios, etc.). A KM Consultoria não reivindica nenhuma propriedade sobre esses dados. Você pode exportar ou apagar seus dados a qualquer momento.
              </p>

              <p>
                <b>6. Responsabilidades</b><br/>
                A KM Consultoria não se responsabiliza por perdas de dados decorrentes de falha do aparelho do usuário, exclusão acidental, ou problemas de conexão. Recomendamos backup periódico em Sistema → Backup.
              </p>

              <p>
                <b>7. Atualizações</b><br/>
                Estes termos podem ser atualizados a qualquer momento. A versão vigente sempre estará disponível dentro do aplicativo, em Sistema → Ajuda & Suporte → Termos de Uso.
              </p>

              <p>
                <b>8. Foro</b><br/>
                Fica eleito o foro da comarca de Alegre-ES para dirimir quaisquer questões relacionadas a estes termos, com renúncia expressa a qualquer outro.
              </p>

              <p style={{ marginBottom: 0 }}>
                <b>9. Contato</b><br/>
                Em caso de dúvidas, escreva para kvmprojetos@gmail.com ou WhatsApp (28) 99925-8172.
              </p>
            </div>
          </div>
        )}

        {/* CONTEÚDO LGPD */}
        {aba === "lgpd" && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 8 }}>🔒 Política de Privacidade (LGPD)</div>
            <div style={{ fontSize: 10, color: "#888", marginBottom: 14 }}>
              Conforme Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais
            </div>

            <div style={{ fontSize: 12, color: "#333", lineHeight: 1.7 }}>
              <p style={{ marginTop: 0 }}>
                <b>Controlador dos dados</b><br/>
                KM CONSULTORIA, ASSESSORIA E SERVIÇOS DE ENGENHARIA LTDA · CNPJ 60.368.233/0001-73 · R. Pastor da Silva Colares, 148 — Guararema, Alegre-ES.
              </p>

              <p>
                <b>Quais dados coletamos</b><br/>
                Para funcionamento do aplicativo, coletamos: nome, e-mail e senha de gestor e encarregados; dados de trabalhadores cadastrados pelo gestor (nome, CPF, função, salário, fotos); dados das obras (localização, fotos, RDOs); dados de pedidos e fornecedores. Não coletamos dados sensíveis (saúde, biometria, opinião política) sem consentimento expresso.
              </p>

              <p>
                <b>Para que usamos seus dados</b><br/>
                Os dados são usados exclusivamente para o funcionamento do aplicativo: autenticação, exibição de informações, geração de relatórios, controle de obras. Não vendemos dados a terceiros. Não usamos para marketing.
              </p>

              <p>
                <b>Onde os dados ficam</b><br/>
                Os dados ficam armazenados localmente no aparelho do usuário e, quando autenticado pelo Firebase, em servidores do Google Cloud (data center em São Paulo, Brasil). As senhas ficam criptografadas, ninguém da KM Consultoria pode vê-las.
              </p>

              <p>
                <b>Compartilhamento com terceiros</b><br/>
                Compartilhamos dados apenas com o Google (Firebase) para autenticação e armazenamento em nuvem. O Google segue rigorosos padrões de segurança e LGPD. Não há outros compartilhamentos.
              </p>

              <p>
                <b>Seus direitos como titular</b><br/>
                Você pode, a qualquer momento: solicitar confirmação dos dados que temos sobre você; pedir acesso aos seus dados; corrigir dados incompletos ou incorretos; solicitar exclusão de seus dados; revogar consentimento. Para exercer qualquer direito, escreva para kvmprojetos@gmail.com.
              </p>

              <p>
                <b>Tempo de armazenamento</b><br/>
                Mantemos seus dados enquanto sua conta estiver ativa. Após a exclusão da conta, os dados são removidos em até 30 dias, exceto quando houver obrigação legal de retenção (por exemplo, registros trabalhistas e fiscais conforme legislação aplicável).
              </p>

              <p>
                <b>Segurança</b><br/>
                Utilizamos criptografia, autenticação segura e controle de acesso para proteger seus dados. Mesmo assim, nenhum sistema é 100% seguro. Em caso de incidente, comunicamos os titulares afetados conforme exige a LGPD.
              </p>

              <p>
                <b>Cookies e rastreamento</b><br/>
                O KMZERO não usa cookies de rastreamento publicitário. Usamos apenas armazenamento local técnico necessário ao funcionamento do aplicativo.
              </p>

              <p style={{ marginBottom: 0 }}>
                <b>Encarregado de dados (DPO)</b><br/>
                Kleber Vieira Martins · CREA-ES · E-mail kvmprojetos@gmail.com · Tel (28) 99925-8172.
              </p>
            </div>
          </div>
        )}

        {/* Versão do app */}
        <div style={{ marginTop: 18, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#999", lineHeight: 1.6 }}>
            <div><b>KMZERO</b> · Versão 1.0.0 · Atualizado em maio/2026</div>
            <div style={{ marginTop: 2 }}>© 2026 KM Consultoria · Engenharia Civil</div>
            <div style={{ marginTop: 2 }}>Alegre-ES · CNPJ 60.368.233/0001-73</div>
          </div>
        </div>
      </div>
      <KMFooter />
    </div>
  );
}


export function TelaConfigEmpresa({ empresa, onSave, onBack }) {
  const [form, setForm] = useState(empresa);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [salvo, setSalvo] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Empresa" sub="Dados para RDO/PDF" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <label style={labelS}>Razão Social</label>
          <input value={form.razaoSocial} onChange={e => set("razaoSocial", e.target.value)} style={inputS} />
          <label style={labelS}>CNPJ</label>
          <input value={form.cnpj} onChange={e => set("cnpj", e.target.value)} placeholder="00.000.000/0001-00" style={inputS} />
          <label style={labelS}>Responsável Técnico</label>
          <input value={form.responsavel} onChange={e => set("responsavel", e.target.value)} style={inputS} />
          <label style={labelS}>Registro Profissional</label>
          <input value={form.registro} onChange={e => set("registro", e.target.value)} placeholder="CREA-ES 12345" style={inputS} />
          <label style={labelS}>E-mail</label>
          <input value={form.email} onChange={e => set("email", e.target.value)} style={inputS} />
          <label style={labelS}>Telefone</label>
          <input value={form.telefone} onChange={e => set("telefone", e.target.value)} style={inputS} />
          <label style={labelS}>📍 Endereço</label>
          <input value={form.endereco || ""} onChange={e => set("endereco", e.target.value)} placeholder="Rua, número, bairro, cidade-UF" style={inputS} />
          <label style={labelS}>📷 Instagram</label>
          <input
            value={form.instagram || ""}
            onChange={e => set("instagram", e.target.value.replace(/^@/, ""))}
            placeholder="km_engenharias (sem o @)"
            style={inputS}
          />
          {form.instagram && (
            <a
              href={`https://instagram.com/${form.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: BLUE,
                textDecoration: "none",
                marginTop: -8,
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              📷 Ver @{form.instagram} no Instagram ›
            </a>
          )}

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "2px solid #f3f4f6" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 4 }}>🏢 Logomarca da Empresa</div>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 12 }}>
              A logo aparece nos cabeçalhos dos relatórios (RDO, pedidos, folha) ao lado da identidade KMZERO. Use uma imagem PNG ou JPG, de preferência com fundo transparente.
            </div>

            {form.logoBase64 ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                  <img src={form.logoBase64} alt="Logo da empresa" style={{ maxWidth: "100%", maxHeight: 90, objectFit: "contain" }} />
                </div>
                <button
                  onClick={() => set("logoBase64", "")}
                  style={{ width: "100%", padding: 10, background: "#fee2e2", color: RED, border: "1px solid " + RED + "55", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  🗑️ Remover logomarca
                </button>
              </div>
            ) : (
              <div style={{ background: "#f9fafb", border: "1px dashed #cbd5e1", borderRadius: 10, padding: 20, textAlign: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>🖼️</div>
                <div style={{ fontSize: 12, color: "#888" }}>Nenhuma logomarca carregada</div>
              </div>
            )}

            <label style={{ ...labelS, display: "block" }}>Carregar imagem da logo</label>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={e => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  alert("Imagem muito grande. O tamanho máximo é 2 MB. Reduza a imagem e tente novamente.");
                  e.target.value = "";
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => set("logoBase64", reader.result);
                reader.onerror = () => alert("Não foi possível ler a imagem. Tente outro arquivo.");
                reader.readAsDataURL(file);
              }}
              style={{ ...inputS, padding: 8 }}
            />
          </div>

          <Btn label="💾 SALVAR" color={GREEN} onClick={() => { onSave(form); setSalvo(true); setTimeout(() => setSalvo(false), 2500); }} style={{ marginTop: 16 }} />
          {salvo && <div style={{ background: "#f0fdf4", color: GREEN, borderRadius: 8, padding: "8px 12px", fontSize: 13, marginTop: 8, textAlign: "center", fontWeight: 600 }}>✅ Salvo!</div>}
        </div>
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   PRODUTIVIDADE (m² alvenaria, m³ concreto, etc.)
════════════════════════════════════ */

export function TelaDiagnostico({ onNav, onBack }) {
  const [resultados, setResultados] = useState({});

  const marcar = (nav, status) => setResultados(r => ({ ...r, [nav]: status }));

  const TESTES = [
    { grupo: "📋 Operação Diária", itens: [
      { nav: "rdo", l: "RDO ABNT" },
      { nav: "custos", l: "Custos por Obra" },
      { nav: "dashboard", l: "Dashboard" },
      { nav: "calendario", l: "Calendário" },
      { nav: "mapa", l: "Mapa de Obras" },
      { nav: "alertas", l: "Alertas" },
    ]},
    { grupo: "👥 Recursos Humanos", itens: [
      { nav: "folha_quinzenal", l: "Folha de Pagamento" },
      { nav: "hist_folha", l: "Histórico de Folhas" },
      { nav: "adiantamentos", l: "Adiantamentos" },
      { nav: "aprovar_mov", l: "Movimentações" },
      { nav: "equipe", l: "Equipe" },
      { nav: "ficha", l: "Ficha Cadastral" },
      { nav: "contatos", l: "Contatos" },
      { nav: "exames", l: "Exames (ASO)" },
      { nav: "rh", l: "Aniv./EPI" },
      { nav: "ferias", l: "Férias" },
      { nav: "folha", l: "Folha Mensal" },
    ]},
    { grupo: "🏗️ Obras & Recursos", itens: [
      { nav: "obras", l: "Obras" },
      { nav: "cronograma", l: "Cronograma" },
      { nav: "ativos", l: "Ativos/Frota" },
      { nav: "frota", l: "Combustível & Frota Dashboard" },
      { nav: "despesas", l: "Despesas Avulsas (PIPA, frete, almoço motorista)" },
      { nav: "manutencao", l: "Manutenções" },
      { nav: "equip_gestao", l: "Equipamentos" },
      { nav: "ferramentas", l: "Ferramentas" },
      { nav: "recebimento", l: "Recebimentos" },
    ]},
    { grupo: "📈 Análise & Comunicação", itens: [
      { nav: "produtividade", l: "Produtividade" },
      { nav: "consolidado", l: "Consolidado" },
      { nav: "diario", l: "Diário Obra" },
      { nav: "mensagens", l: "Mensagens" },
    ]},
    { grupo: "⚙️ Sistema", itens: [
      { nav: "links", l: "Links Úteis" },
      { nav: "empresa", l: "Empresa" },
      { nav: "backup", l: "Backup" },
    ]},
  ];

  const todosTestes = TESTES.flatMap(g => g.itens);
  const okCount = todosTestes.filter(t => resultados[t.nav] === "ok").length;
  const erroCount = todosTestes.filter(t => resultados[t.nav] === "erro").length;
  const restantes = todosTestes.length - okCount - erroCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Diagnóstico" sub="Teste cada botão" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ background: NAVY, color: "#fff", borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>🔍 Como usar:</div>
          <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.5 }}>
            1. Toque em <b style={{ color: GOLD }}>"Abrir"</b> em cada botão<br/>
            2. Volte aqui e marque <b style={{ color: GREEN }}>✓ Funcionou</b> ou <b style={{ color: RED }}>✕ Quebrado</b><br/>
            3. No fim, me envie o relatório com os botões que falharam
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, background: GREEN, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{okCount}</div>
            <div style={{ fontSize: 10 }}>Funcionando</div>
          </div>
          <div style={{ flex: 1, background: RED, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{erroCount}</div>
            <div style={{ fontSize: 10 }}>Com problema</div>
          </div>
          <div style={{ flex: 1, background: "#888", borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{restantes}</div>
            <div style={{ fontSize: 10 }}>Não testado</div>
          </div>
        </div>

        {TESTES.map(grupo => (
          <div key={grupo.grupo} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{grupo.grupo}</div>
            {grupo.itens.map(t => {
              const status = resultados[t.nav];
              return (
                <div key={t.nav} style={{ background: status === "ok" ? "#f0fdf4" : status === "erro" ? "#fef2f2" : "#fff", borderRadius: 10, padding: "10px 12px", marginBottom: 6, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: NAVY }}>{t.l}</div>
                  <button onClick={() => onNav(t.nav)} style={{ background: BLUE, color: "#fff", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", marginRight: 6 }}>Abrir</button>
                  <button onClick={() => marcar(t.nav, "ok")} style={{ background: status === "ok" ? GREEN : "#f0fdf4", color: status === "ok" ? "#fff" : GREEN, border: `1.5px solid ${GREEN}`, borderRadius: 7, padding: "6px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginRight: 4 }}>✓</button>
                  <button onClick={() => marcar(t.nav, "erro")} style={{ background: status === "erro" ? RED : "#fef2f2", color: status === "erro" ? "#fff" : RED, border: `1.5px solid ${RED}`, borderRadius: 7, padding: "6px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✕</button>
                </div>
              );
            })}
          </div>
        ))}

        {erroCount > 0 && (
          <div style={{ background: "#fef2f2", border: `1.5px solid ${RED}33`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 800, color: RED, fontSize: 13, marginBottom: 8 }}>⚠️ Botões com problema:</div>
            {todosTestes.filter(t => resultados[t.nav] === "erro").map(t => {
              const grupo = TESTES.find(g => g.itens.some(i => i.nav === t.nav));
              return <div key={t.nav} style={{ fontSize: 12, color: NAVY, padding: "3px 0" }}>• <b>{t.l}</b> ({grupo?.grupo})</div>;
            })}
            <button onClick={() => {
              const txt = "🔧 *KMZERO - Botões com problema*\n\n" + todosTestes.filter(t => resultados[t.nav] === "erro").map(t => "• " + t.l).join("\n");
              const url = `https://wa.me/?text=${encodeURIComponent(txt)}`;
              window.open(url, "_blank");
            }} style={{ background: "#25D366", color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer", marginTop: 10, width: "100%" }}>
              💬 Enviar lista por WhatsApp (pra mim)
            </button>
          </div>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   APP ROOT COM STORAGE
════════════════════════════════════ */
/* ════════════════════════════════════
   ZERAR TUDO — tela com confirmação por digitação
════════════════════════════════════ */
/* ════════════════════════════════════════════════════
   TELA DE ANEXOS DA OBRA
   Gestor anexa qualquer tipo, encarregado anexa fotos e atestados
══════════════════════════════════════════════════════ */
export const CATEGORIAS_ANEXO_GESTOR = [
  { id: "projetos", label: "Projetos", icon: "📐", cor: "#0891b2" },
  { id: "contratos", label: "Contratos", icon: "📋", cor: "#7c3aed" },
  { id: "art_rrt", label: "ART/RRT", icon: "📜", cor: "#dc2626" },
  { id: "planilhas", label: "Planilhas/Orçamentos", icon: "📊", cor: "#16a34a" },
  { id: "licencas", label: "Licenças/Alvarás", icon: "🏛️", cor: "#ca8a04" },
  { id: "memoriais", label: "Memoriais Descritivos", icon: "📝", cor: "#475569" },
  { id: "diario_oficial", label: "Diário Oficial", icon: "📰", cor: "#334155" },
  { id: "outros_gestor", label: "Outros (Gestor)", icon: "📁", cor: "#6b7280" },
];

export const CATEGORIAS_ANEXO_ENCARREGADO = [
  { id: "fotos_extras", label: "Fotos Extras", icon: "📷", cor: "#0891b2" },
  { id: "atestados", label: "Atestados Médicos", icon: "🏥", cor: "#dc2626" },
  { id: "notas_fiscais", label: "Notas Fiscais", icon: "🧾", cor: "#16a34a" },
  { id: "comprovantes", label: "Comprovantes", icon: "📑", cor: "#7c3aed" },
];


export function TelaZerarTudo({ onBack, onZerar, onResetTotal }) {
  const [etapa, setEtapa] = useState(0); // 0=escolher modo, 1=aviso lancamentos, 2=digitar senha lancamentos, 3=aviso total, 4=digitar senha total
  const [senhaDigit, setSenhaDigit] = useState("");
  const [erro, setErro] = useState("");

  const confirmarLancamentos = () => {
    if (senhaDigit.trim().toUpperCase() === "ZERAR") {
      onZerar();
    } else {
      setErro("❌ Digite ZERAR para confirmar");
    }
  };

  const confirmarTotal = () => {
    if (senhaDigit.trim().toUpperCase() === "RESETAR TUDO") {
      onResetTotal();
    } else {
      setErro("❌ Digite RESETAR TUDO para confirmar");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="🧹 Limpar Dados" sub="Escolher o que apagar" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 18 }}>

        {/* ETAPA 0: ESCOLHA */}
        {etapa === 0 && (
          <>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 14, lineHeight: 1.5 }}>
              Escolha o que deseja fazer:
            </div>

            {/* Opção 1: Lançamentos */}
            <button onClick={() => setEtapa(1)} style={{ width: "100%", textAlign: "left", padding: 16, background: "#fff", border: "2px solid #f97316", borderRadius: 14, cursor: "pointer", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 28 }}>🧹</div>
                <div style={{ fontWeight: 800, color: "#9a3412", fontSize: 14 }}>Apagar Lançamentos</div>
              </div>
              <div style={{ fontSize: 11, color: "#7c2d12", lineHeight: 1.5, marginBottom: 6 }}>
                Apaga só os dados de movimento (RDOs, pedidos, fotos, presenças, despesas, etc).
              </div>
              <div style={{ fontSize: 11, color: "#15803d", lineHeight: 1.5 }}>
                ✅ Mantém obras, trabalhadores, acessos, empresa, fornecedores
              </div>
            </button>

            {/* Opção 2: Reset Total */}
            <button onClick={() => setEtapa(3)} style={{ width: "100%", textAlign: "left", padding: 16, background: "#fff", border: "2px solid #dc2626", borderRadius: 14, cursor: "pointer", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 28 }}>💣</div>
                <div style={{ fontWeight: 800, color: "#991b1b", fontSize: 14 }}>Reset Total</div>
              </div>
              <div style={{ fontSize: 11, color: "#7f1d1d", lineHeight: 1.5, marginBottom: 6 }}>
                <b>APAGA ABSOLUTAMENTE TUDO</b> e deixa o app como se fosse a primeira instalação.
              </div>
              <div style={{ fontSize: 11, color: "#991b1b", lineHeight: 1.5 }}>
                ⚠️ Apaga: obras, trabalhadores, acessos, empresa, lançamentos, TUDO.
              </div>
            </button>

            <button onClick={onBack} style={{ width: "100%", marginTop: 6, padding: 12, background: "#f3f4f6", color: NAVY, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Cancelar
            </button>
          </>
        )}

        {/* ETAPA 1: AVISO LANCAMENTOS */}
        {etapa === 1 && (
          <>
            <div style={{ background: "#fff7ed", border: "2px solid #f97316", borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>🧹</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#9a3412", marginBottom: 6 }}>Apagar Lançamentos</div>
              <div style={{ fontSize: 13, color: "#7c2d12", lineHeight: 1.5 }}>
                Será apagado:
                <ul style={{ margin: "8px 0 0 20px", padding: 0, lineHeight: 1.7 }}>
                  <li>RDOs emitidos</li>
                  <li>Pedidos de material</li>
                  <li>Fotos da galeria</li>
                  <li>Despesas avulsas</li>
                  <li>Histórico de presenças</li>
                  <li>Movimentações</li>
                  <li>Adiantamentos</li>
                  <li>Anotações do diário</li>
                  <li>Abastecimentos</li>
                  <li>Produtividade</li>
                </ul>
              </div>
            </div>

            <div style={{ background: "#dcfce7", border: "1px solid #16a34a", borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#166534", marginBottom: 6 }}>✅ NÃO será apagado:</div>
              <ul style={{ margin: "0 0 0 20px", padding: 0, fontSize: 12, color: "#15803d", lineHeight: 1.6 }}>
                <li>Obras cadastradas</li>
                <li>Trabalhadores (folha)</li>
                <li>Acessos do app (logins)</li>
                <li>Dados da empresa</li>
                <li>Fornecedores</li>
                <li>Equipamentos e ativos</li>
              </ul>
            </div>

            <button onClick={() => setEtapa(2)} style={{ width: "100%", padding: 14, background: "#f97316", color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 12px rgba(249,115,22,0.3)" }}>
              🧹 PROSSEGUIR COM A LIMPEZA
            </button>

            <button onClick={() => setEtapa(0)} style={{ width: "100%", marginTop: 10, padding: 12, background: "#f3f4f6", color: NAVY, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              ← Voltar
            </button>
          </>
        )}

        {/* ETAPA 2: SENHA LANCAMENTOS */}
        {etapa === 2 && (
          <>
            <div style={{ background: "#fff7ed", border: "2px solid #f97316", borderRadius: 14, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 32, marginBottom: 8, textAlign: "center" }}>🔐</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#9a3412", marginBottom: 8, textAlign: "center" }}>Confirmação</div>
              <div style={{ fontSize: 13, color: "#7c2d12", lineHeight: 1.5, marginBottom: 12, textAlign: "center" }}>
                Digite a palavra<br/>
                <b style={{ fontSize: 18, color: "#f97316", fontFamily: "monospace", letterSpacing: 2 }}>ZERAR</b>
              </div>

              <input
                type="text"
                value={senhaDigit}
                onChange={e => { setSenhaDigit(e.target.value); setErro(""); }}
                placeholder="Digite ZERAR"
                autoFocus
                autoComplete="off"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: erro ? "2px solid #dc2626" : "2px solid #fed7aa",
                  fontSize: 18,
                  fontWeight: 700,
                  textAlign: "center",
                  letterSpacing: 2,
                  marginBottom: 8,
                  background: "#fff",
                  color: "#f97316",
                  textTransform: "uppercase",
                }}
              />

              {erro && (
                <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600 }}>
                  {erro}
                </div>
              )}
            </div>

            <button onClick={confirmarLancamentos} disabled={!senhaDigit.trim()} style={{
              width: "100%", padding: 14, background: senhaDigit.trim() ? "#f97316" : "#fdba74",
              color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14,
              cursor: senhaDigit.trim() ? "pointer" : "not-allowed",
            }}>
              ✓ CONFIRMAR E ZERAR LANÇAMENTOS
            </button>

            <button onClick={() => { setEtapa(1); setSenhaDigit(""); setErro(""); }} style={{ width: "100%", marginTop: 10, padding: 12, background: "#f3f4f6", color: NAVY, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              ← Voltar
            </button>
          </>
        )}

        {/* ETAPA 3: AVISO RESET TOTAL */}
        {etapa === 3 && (
          <>
            <div style={{ background: "#fef2f2", border: "3px solid #dc2626", borderRadius: 14, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 36, marginBottom: 8, textAlign: "center" }}>💣</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#7f1d1d", marginBottom: 10, textAlign: "center" }}>RESET TOTAL</div>
              <div style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.6 }}>
                <p style={{ margin: "0 0 10px 0" }}><b>⚠️ Atenção MÁXIMA!</b></p>
                <p style={{ margin: "0 0 10px 0" }}>
                  Esta ação vai apagar <b>TUDO</b>:
                </p>
                <ul style={{ margin: "0 0 0 20px", padding: 0, lineHeight: 1.7 }}>
                  <li>🏗️ Todas as obras</li>
                  <li>👥 Todos os trabalhadores</li>
                  <li>🔑 Todos os acessos (exceto o seu)</li>
                  <li>🏢 Dados da empresa</li>
                  <li>🏪 Fornecedores</li>
                  <li>⚙️ Equipamentos e ativos</li>
                  <li>📄 Todos os RDOs</li>
                  <li>📦 Todos os pedidos</li>
                  <li>📷 Todas as fotos</li>
                  <li>💸 Tudo de financeiro</li>
                  <li>📊 Histórico, presença, diário, mensagens</li>
                  <li>🎯 Cronogramas</li>
                  <li>📈 Produtividade</li>
                  <li>... e <b>todo o resto</b></li>
                </ul>
                <p style={{ margin: "12px 0 0 0", fontWeight: 700 }}>
                  O app vai voltar ao estado inicial, como se fosse a primeira instalação.
                </p>
              </div>
            </div>

            <button onClick={() => setEtapa(4)} style={{ width: "100%", padding: 14, background: "#dc2626", color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 12px rgba(220,38,38,0.4)" }}>
              💣 PROSSEGUIR COM RESET TOTAL
            </button>

            <button onClick={() => setEtapa(0)} style={{ width: "100%", marginTop: 10, padding: 12, background: "#f3f4f6", color: NAVY, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              ← Voltar
            </button>
          </>
        )}

        {/* ETAPA 4: SENHA RESET TOTAL */}
        {etapa === 4 && (
          <>
            <div style={{ background: "#fef2f2", border: "3px solid #dc2626", borderRadius: 14, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 36, marginBottom: 8, textAlign: "center" }}>🔐💣</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#7f1d1d", marginBottom: 8, textAlign: "center" }}>Confirmação Final</div>
              <div style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.5, marginBottom: 12, textAlign: "center" }}>
                Para confirmar o reset total, digite a frase<br/>
                <b style={{ fontSize: 18, color: "#dc2626", fontFamily: "monospace", letterSpacing: 1 }}>RESETAR TUDO</b>
              </div>

              <input
                type="text"
                value={senhaDigit}
                onChange={e => { setSenhaDigit(e.target.value); setErro(""); }}
                placeholder="Digite RESETAR TUDO"
                autoFocus
                autoComplete="off"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: erro ? "2px solid #dc2626" : "2px solid #fca5a5",
                  fontSize: 16,
                  fontWeight: 700,
                  textAlign: "center",
                  letterSpacing: 1,
                  marginBottom: 8,
                  background: "#fff",
                  color: "#dc2626",
                  textTransform: "uppercase",
                }}
              />

              {erro && (
                <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600 }}>
                  {erro}
                </div>
              )}
            </div>

            <button onClick={confirmarTotal} disabled={!senhaDigit.trim()} style={{
              width: "100%", padding: 14, background: senhaDigit.trim() ? "#dc2626" : "#fca5a5",
              color: "#fff", border: "none", borderRadius: 12, fontWeight: 900, fontSize: 14,
              cursor: senhaDigit.trim() ? "pointer" : "not-allowed",
              boxShadow: senhaDigit.trim() ? "0 4px 12px rgba(220,38,38,0.5)" : "none",
            }}>
              💣 CONFIRMAR RESET TOTAL
            </button>

            <button onClick={() => { setEtapa(3); setSenhaDigit(""); setErro(""); }} style={{ width: "100%", marginTop: 10, padding: 12, background: "#f3f4f6", color: NAVY, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              ← Voltar
            </button>
          </>
        )}

      </div>
      <KMFooter />
    </div>
  );
}

