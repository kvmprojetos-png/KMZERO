import { CATEGORIAS_FORNECEDOR } from "./midia.jsx";
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

export function TelaMaterial({ obra, usuario, onBack, onAddPedido }) {
  const [itens, setItens] = useState([]); // CESTA: lista de itens do pedido
  const [mat, setMat] = useState("");
  const [busca, setBusca] = useState("");
  const [qtd, setQtd] = useState("");
  const [unid, setUnid] = useState("unidades");
  const [marca, setMarca] = useState("");
  const [obs, setObs] = useState("");
  const [obsGeral, setObsGeral] = useState("");
  const [ok, setOk] = useState(false);

  // Quando seleciona um material, ajusta unidade automaticamente
  const selecionarMaterial = (nome) => {
    setMat(nome);
    setBusca("");
    const info = MATERIAL_INFO[nome];
    if (info?.un) {
      setUnid(info.un);
    } else {
      // Tenta achar no catálogo profissional
      const noPro = (CATALOGO_KM_FULL || []).find(m => m[1] === nome);
      if (noPro) setUnid(noPro[2]);
      else setUnid(detectarUnidade(nome));
    }
    setMarca("");
  };

  // Info do material selecionado (categoria, marcas)
  const infoMaterial = mat ? MATERIAL_INFO[mat] : null;
  const marcasDisponiveis = infoMaterial?.marcas || [];

  // Busca inteligente
  const normalizar = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const termoNorm = normalizar(busca);
  const palavras = termoNorm.split(/\s+/).filter(p => p.length > 0);

  // Sugestões do banco principal (com marcas)
  const sugestoesPrincipal = busca.length === 0 ? [] : MATERIAIS_BANCO_DETALHADO
    .map(item => {
      const mNorm = normalizar(item.nome);
      const catNorm = normalizar(item.cat || "");
      let score = 0;
      for (const p of palavras) {
        if (mNorm.includes(p)) score += 1;
        if (catNorm.includes(p)) score += 0.5;
      }
      if (mNorm.startsWith(termoNorm)) score += 2;
      return { item, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(x => x.item);

  // Sugestões do CATÁLOGO PROFISSIONAL (sem duplicar com o banco principal)
  const nomesJaListados = new Set(sugestoesPrincipal.map(s => normalizar(s.nome)));
  const sugestoesCatalogo = busca.length < 2 ? [] : (CATALOGO_KM_FULL || [])
    .map(m => {
      // m = [id, nome, unidade, categoria, subcategoria]
      const mNorm = normalizar(m[1]);
      const catNorm = normalizar(m[3] || "");
      const subNorm = normalizar(m[4] || "");
      let score = 0;
      for (const p of palavras) {
        if (mNorm.includes(p)) score += 1;
        if (catNorm.includes(p)) score += 0.4;
        if (subNorm.includes(p)) score += 0.4;
      }
      if (mNorm.startsWith(termoNorm)) score += 2;
      return { m, score };
    })
    .filter(x => x.score > 0 && !nomesJaListados.has(normalizar(x.m[1])))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(x => ({
      // Adapta pro formato do banco principal
      nome: x.m[1],
      un: x.m[2],
      cat: x.m[3],
      subcat: x.m[4],
      idCatalogo: x.m[0],
      marcas: [],
      doCatalogo: true, // flag pra mostrar visualmente
    }));

  // Combina os dois (principal primeiro)
  const sugestoes = [...sugestoesPrincipal, ...sugestoesCatalogo];

  // Adiciona item à cesta (não envia ainda)
  const adicionarNaCesta = () => {
    if (!mat || !qtd) return;
    const matComMarca = marca ? `${mat} (${marca})` : mat;
    const novo = {
      idLocal: Date.now() + Math.random(),
      material: matComMarca,
      materialBase: mat,
      marca,
      categoria: infoMaterial?.cat || "",
      qtdNum: parseFloat(qtd),
      unidade: unid,
      qtd: `${qtd} ${unid}`,
      obs,
    };
    setItens(its => [...its, novo]);
    // Limpa pra próximo item
    setMat(""); setBusca(""); setQtd(""); setMarca(""); setObs("");
  };

  const removerItem = (idLocal) => setItens(its => its.filter(i => i.idLocal !== idLocal));

  // ENVIA todo o pedido (cesta) de uma vez
  const enviarPedido = () => {
    if (itens.length === 0) return;
    onAddPedido({
      id: Date.now(),
      obra: obra.nome,
      obraId: obra.id,
      itens, // múltiplos itens!
      // Compatibilidade com pedidos antigos (1 item):
      material: itens.length === 1 ? itens[0].material : `${itens.length} itens`,
      qtd: itens.length === 1 ? itens[0].qtd : `${itens.length} itens`,
      obsGeral,
      enc: usuario?.nome?.split(" ")[0] || "Encarregado",
      status: "Aguardando",
      data: new Date().toLocaleDateString("pt-BR"),
    });
    setOk(true);
  };

  const totalItens = itens.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Solicitar Material" sub={obra.nome} onBack={onBack} right={
        totalItens > 0 ? <div style={{ background: GOLD, color: "#fff", borderRadius: 14, padding: "4px 10px", fontWeight: 800, fontSize: 12 }}>🛒 {totalItens}</div> : null
      } />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {ok ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 64 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: GREEN, marginTop: 12 }}>Pedido Enviado!</div>
            <div style={{ color: "#666", marginTop: 6, fontSize: 13 }}><b>{itens.length} item(ns)</b> aguardando aprovação do gestor.</div>
            <div style={{ background: "#f0fdf4", borderRadius: 10, padding: 12, marginTop: 16, textAlign: "left" }}>
              {itens.map((i, idx) => (
                <div key={i.idLocal} style={{ fontSize: 11, color: "#444", paddingBottom: 4 }}>
                  {idx + 1}) <b>{i.material}</b> — {i.qtd}
                </div>
              ))}
            </div>
            <Btn label="Novo Pedido" color={NAVY} onClick={() => { setOk(false); setItens([]); setObsGeral(""); }} style={{ marginTop: 24 }} />
            <Btn label="Voltar" color="#eee" text={NAVY} onClick={onBack} style={{ marginTop: 10 }} />
          </div>
        ) : (
          <>
            {/* CESTA — itens já adicionados */}
            {itens.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 14, padding: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12, borderLeft: `4px solid ${GREEN}` }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ flex: 1, fontWeight: 800, color: NAVY, fontSize: 13 }}>🛒 Cesta de pedido ({totalItens})</div>
                  <button onClick={() => { confirmar("Limpar todos os itens?", () => { setItens([]); }); }} style={{ background: "none", border: "none", color: RED, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Limpar</button>
                </div>
                {itens.map((i, idx) => (
                  <div key={i.idLocal} style={{ display: "flex", alignItems: "flex-start", padding: "8px 0", borderBottom: idx < itens.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: NAVY, fontWeight: 700 }}>{idx + 1}) {i.material}</div>
                      <div style={{ fontSize: 11, color: GREEN, fontWeight: 700, marginTop: 2 }}>📏 {i.qtd}</div>
                      {i.obs && <div style={{ fontSize: 10, color: "#888", marginTop: 2, fontStyle: "italic" }}>obs: {i.obs}</div>}
                    </div>
                    <button onClick={() => removerItem(i.idLocal)} style={{ background: "none", border: "none", color: "#bbb", fontSize: 16, cursor: "pointer", padding: 4 }}>🗑️</button>
                  </div>
                ))}
              </div>
            )}

            {/* FORM ADICIONAR ITEM */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: NAVY, fontWeight: 800, marginBottom: 8 }}>➕ Adicionar item</div>
              <label style={labelS}>🔍 Buscar material</label>
              <input
                value={mat || busca}
                onChange={e => { setBusca(e.target.value); setMat(""); setMarca(""); }}
                placeholder="Ex: cimento, brita, tubo 50mm..."
                style={inputS}
                autoFocus={!mat && itens.length === 0}
              />
              {mat && (
                <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "8px 12px", marginBottom: 8, display: "flex", alignItems: "center" }}>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, color: GREEN, fontWeight: 700 }}>✓ {mat}</span>
                    {infoMaterial?.cat && <span style={{ fontSize: 9, color: "#888", marginLeft: 6, background: "#fff", padding: "2px 6px", borderRadius: 6 }}>{infoMaterial.cat}</span>}
                  </span>
                  <button onClick={() => { setMat(""); setBusca(""); setMarca(""); }} style={{ background: "none", border: "none", color: RED, fontSize: 13, cursor: "pointer", fontWeight: 700 }}>Trocar</button>
                </div>
              )}
              {!mat && busca.length > 0 && (
                <div style={{ background: "#f9fafb", borderRadius: 8, marginTop: 4, maxHeight: 280, overflowY: "auto" }}>
                  {sugestoes.length === 0 ? (
                    <div style={{ padding: 12, color: "#888", fontSize: 12, fontStyle: "italic" }}>
                      Nada encontrado. Toque em "Pedir mesmo assim" abaixo:
                    </div>
                  ) : (
                    sugestoes.map(s => (
                      <div key={(s.idCatalogo || "") + s.nome} onClick={() => selecionarMaterial(s.nome)} style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #eee", background: s.doCatalogo ? "#fefce8" : "transparent" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                          {s.doCatalogo && <span style={{ fontSize: 9, background: "#854d0e", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>PRO</span>}
                          <div style={{ flex: 1, fontSize: 13, color: NAVY, fontWeight: 600, lineHeight: 1.3 }}>{s.nome}</div>
                        </div>
                        <div style={{ fontSize: 10, color: "#888", marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {s.idCatalogo && <span style={{ fontFamily: "monospace", background: "#fef3c7", padding: "1px 5px", borderRadius: 3, color: "#854d0e", fontWeight: 700 }}>{s.idCatalogo}</span>}
                          <span style={{ background: "#eff6ff", padding: "1px 6px", borderRadius: 4, color: BLUE }}>{s.cat}</span>
                          <span style={{ color: ORANGE, fontWeight: 600 }}>📏 {s.un}</span>
                          {s.marcas && s.marcas.length > 0 && <span>🏷️ {s.marcas.length} marca(s)</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              {!mat && busca.length > 0 && sugestoes.length === 0 && (
                <button onClick={() => { setMat(busca); setUnid(detectarUnidade(busca)); }} style={{ background: ORANGE, color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", marginTop: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, width: "100%" }}>
                  ➕ Pedir "{busca}" mesmo assim
                </button>
              )}

              {/* MARCA */}
              {mat && marcasDisponiveis.length > 0 && (
                <>
                  <label style={labelS}>🏷️ Marca preferida (opcional)</label>
                  <select value={marca} onChange={e => setMarca(e.target.value)} style={selS}>
                    <option value="">— Sem preferência (qualquer marca) —</option>
                    {marcasDisponiveis.map(mk => <option key={mk} value={mk}>{mk}</option>)}
                  </select>
                </>
              )}

              {/* QUANTIDADE */}
              {mat && (
                <>
                  <label style={labelS}>📏 Quantidade <span style={{ color: ORANGE, fontSize: 10, fontWeight: 600 }}>(unidade detectada)</span></label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={qtd} onChange={e => setQtd(e.target.value)} placeholder="Ex: 10" type="number" style={{ ...inputS, flex: 1, marginBottom: 0 }} />
                    <select value={unid} onChange={e => setUnid(e.target.value)} style={{ ...selS, flex: 1, marginBottom: 0 }}>
                      {["sacos", "m²", "m³", "kg", "ton", "unidades", "litros", "barras", "rolos", "metros", "peças"].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <label style={labelS}>📝 Observação do item (opcional)</label>
                  <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: cor branca, urgente..." style={inputS} />

                  <button onClick={adicionarNaCesta} disabled={!mat || !qtd} style={{
                    width: "100%", padding: 12, borderRadius: 10, border: "none",
                    background: mat && qtd ? GOLD : "#ccc",
                    color: "#fff", fontWeight: 800, fontSize: 13, cursor: mat && qtd ? "pointer" : "default"
                  }}>
                    ➕ Adicionar à cesta
                  </button>
                </>
              )}
            </div>

            {/* OBSERVAÇÃO GERAL DO PEDIDO + ENVIAR */}
            {itens.length > 0 && (
              <>
                <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
                  <label style={labelS}>📝 Observação geral do pedido (opcional)</label>
                  <textarea value={obsGeral} onChange={e => setObsGeral(e.target.value)} rows={2} placeholder="Ex: entregar até sexta, urgente, etc." style={{ ...inputS, resize: "none", fontFamily: "inherit", marginBottom: 0 }} />
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={onBack} style={{ flex: 1, padding: "14px", borderRadius: 10, border: "none", background: "#eee", color: NAVY, fontWeight: 800, cursor: "pointer", fontSize: 14 }}>Cancelar</button>
                  <button onClick={enviarPedido} style={{ flex: 2, padding: "14px", borderRadius: 10, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14, boxShadow: "0 4px 14px rgba(42,168,79,0.3)" }}>
                    📤 Enviar Pedido ({totalItens} {totalItens === 1 ? "item" : "itens"})
                  </button>
                </div>

                <div style={{ background: "#f0f7ff", borderRadius: 8, padding: 10, marginTop: 10, fontSize: 11, color: "#0c4a6e", textAlign: "center" }}>
                  💡 Continue adicionando quantos itens precisar antes de enviar
                </div>
              </>
            )}

            {itens.length === 0 && (
              <div style={{ textAlign: "center", padding: 16, color: "#888", fontSize: 11, fontStyle: "italic" }}>
                Nenhum item na cesta ainda. Adicione o primeiro item acima.
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
   FOTOS SOLO (com câmera real)
════════════════════════════════════ */
/* ════════════════════════════════════
   CARIMBAR FOTO — adiciona data/hora/obra/numeração na imagem
════════════════════════════════════ */
export async function carimbarFoto(dataUrl, info) {
  // info: { numero, obra, autor, data, hora }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      // Desenha imagem original
      ctx.drawImage(img, 0, 0);

      // Tamanho do rodapé proporcional à imagem
      const fontePx = Math.max(16, Math.round(img.width / 50));
      const padding = Math.round(fontePx * 0.7);
      const linhaAltura = Math.round(fontePx * 1.4);
      const rodapeAltura = linhaAltura * 3 + padding * 2;
      const margemBottom = Math.round(fontePx * 0.4);

      // Posiciona rodapé no canto inferior esquerdo (com margem)
      const rodapeY = img.height - rodapeAltura - margemBottom;
      const rodapeX = margemBottom;
      const rodapeLargura = img.width - margemBottom * 2;

      // Sombra/fundo translúcido escuro com gradiente
      const grad = ctx.createLinearGradient(0, rodapeY, 0, rodapeY + rodapeAltura);
      grad.addColorStop(0, "rgba(0,0,0,0.55)");
      grad.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = grad;
      // Cantos arredondados
      const radius = Math.round(fontePx * 0.4);
      ctx.beginPath();
      ctx.moveTo(rodapeX + radius, rodapeY);
      ctx.lineTo(rodapeX + rodapeLargura - radius, rodapeY);
      ctx.quadraticCurveTo(rodapeX + rodapeLargura, rodapeY, rodapeX + rodapeLargura, rodapeY + radius);
      ctx.lineTo(rodapeX + rodapeLargura, rodapeY + rodapeAltura - radius);
      ctx.quadraticCurveTo(rodapeX + rodapeLargura, rodapeY + rodapeAltura, rodapeX + rodapeLargura - radius, rodapeY + rodapeAltura);
      ctx.lineTo(rodapeX + radius, rodapeY + rodapeAltura);
      ctx.quadraticCurveTo(rodapeX, rodapeY + rodapeAltura, rodapeX, rodapeY + rodapeAltura - radius);
      ctx.lineTo(rodapeX, rodapeY + radius);
      ctx.quadraticCurveTo(rodapeX, rodapeY, rodapeX + radius, rodapeY);
      ctx.closePath();
      ctx.fill();

      // Borda dourada fina
      ctx.strokeStyle = "#f5a623";
      ctx.lineWidth = Math.max(2, Math.round(fontePx / 12));
      ctx.stroke();

      // Texto — Linha 1: KMZERO + data/hora
      ctx.fillStyle = "#f5a623";
      ctx.font = `bold ${fontePx}px Arial, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText("KMZERO", rodapeX + padding, rodapeY + padding);

      // Data/hora à direita da linha 1
      const dataHoraTexto = `📅 ${info.data}   🕐 ${info.hora}`;
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.round(fontePx * 0.85)}px Arial, sans-serif`;
      const dhWidth = ctx.measureText(dataHoraTexto).width;
      ctx.fillText(dataHoraTexto, rodapeX + rodapeLargura - dhWidth - padding, rodapeY + padding + Math.round(fontePx * 0.1));

      // Linha 2: Foto #N — Obra
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.round(fontePx * 0.95)}px Arial, sans-serif`;
      const numeroTxt = `Foto #${String(info.numero).padStart(3, "0")}`;
      ctx.fillStyle = "#f5a623";
      ctx.fillText(numeroTxt, rodapeX + padding, rodapeY + padding + linhaAltura);
      const numWidth = ctx.measureText(numeroTxt).width;

      ctx.fillStyle = "#fff";
      const obraTxt = `— ${info.obra}`;
      // Quebra obra se for muito grande
      const maxObraLargura = rodapeLargura - padding * 2 - numWidth - 10;
      const obraExibida = obraTxt.length * (fontePx * 0.5) > maxObraLargura
        ? obraTxt.substring(0, Math.floor(maxObraLargura / (fontePx * 0.55))) + "..."
        : obraTxt;
      ctx.fillText(obraExibida, rodapeX + padding + numWidth + 8, rodapeY + padding + linhaAltura);

      // Linha 3: 👷 Autor
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.round(fontePx * 0.85)}px Arial, sans-serif`;
      ctx.fillText(`👷 ${info.autor}`, rodapeX + padding, rodapeY + padding + linhaAltura * 2);

      // Converte de volta pra DataURL
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => resolve(dataUrl); // fallback: retorna sem carimbo se falhar
    img.src = dataUrl;
  });
}



export function TelaFornecedores({ fornecedores = [], onBack, onAdd, onEditar, onRemover }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtroCat, setFiltroCat] = useState("todas");
  const [form, setForm] = useState({
    nome: "", razaoSocial: "", cnpj: "", categoria: "",
    contato: "", telefone: "", whatsapp: "", email: "",
    endereco: "", obs: ""
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const abrirNovo = () => {
    setEditandoId(null);
    setForm({ nome: "", razaoSocial: "", cnpj: "", categoria: "", contato: "", telefone: "", whatsapp: "", email: "", endereco: "", obs: "" });
    setModal(true);
  };

  const abrirEdit = (f) => {
    setEditandoId(f.id);
    setForm({ ...f });
    setModal(true);
  };

  const salvar = () => {
    if (!form.nome) { alert("⚠️ Informe o nome do fornecedor"); return; }
    const dados = { ...form, id: editandoId || Date.now() };
    if (editandoId) onEditar(dados);
    else onAdd(dados);
    setModal(false);
  };

  // Filtro
  const filtrados = fornecedores
    .filter(f => filtroCat === "todas" || f.categoria === filtroCat)
    .filter(f => {
      if (!busca) return true;
      const q = busca.toLowerCase();
      return f.nome?.toLowerCase().includes(q)
        || f.razaoSocial?.toLowerCase().includes(q)
        || f.contato?.toLowerCase().includes(q)
        || f.cnpj?.includes(q)
        || f.telefone?.includes(q);
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Fornecedores" sub={`${fornecedores.length} cadastrado(s)`} onBack={onBack} right={
        <button onClick={abrirNovo} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ Novo</button>
      } />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* Busca + filtro */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por nome, CNPJ, contato..." style={inputS} />
          <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} style={{ ...selS, marginBottom: 0 }}>
            <option value="todas">Todas as categorias</option>
            {CATEGORIAS_FORNECEDOR.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {filtrados.length === 0 ? (
          <EmptyState
            icon="🏪"
            titulo={fornecedores.length === 0 ? "Nenhum fornecedor cadastrado" : "Nenhum fornecedor neste filtro"}
            subtitulo={fornecedores.length === 0 ? "Cadastre seus fornecedores com CNPJ, contatos e condições de pagamento. Eles ficarão disponíveis ao criar pedidos de compra." : "Tente outro filtro ou limpe a busca."}
            botaoLabel={fornecedores.length === 0 ? "+ Cadastrar primeiro" : null}
            onBotao={fornecedores.length === 0 ? abrirNovo : null}
            cor={BLUE}
          />
        ) : (
          filtrados.map(f => (
            <div key={f.id} onClick={() => abrirEdit(f)} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${BLUE}`, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>🏪 {f.nome}</div>
                  </div>
                  {f.razaoSocial && <div style={{ fontSize: 11, color: "#666" }}>{f.razaoSocial}</div>}
                  {f.cnpj && <div style={{ fontSize: 10, color: "#888" }}>CNPJ: {f.cnpj}</div>}
                  {f.categoria && <div style={{ fontSize: 9, color: "#fff", background: BLUE, padding: "2px 6px", borderRadius: 4, fontWeight: 700, display: "inline-block", marginTop: 4 }}>{f.categoria}</div>}
                  {f.contato && <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>👤 {f.contato}</div>}
                  {(f.telefone || f.whatsapp) && (
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }} onClick={e => e.stopPropagation()}>
                      {f.telefone && <a href={`tel:${f.telefone.replace(/\D/g, "")}`} style={{ fontSize: 10, color: BLUE, textDecoration: "none", fontWeight: 600 }}>📞 {f.telefone}</a>}
                      {f.whatsapp && <a href={`https://wa.me/55${f.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener" style={{ fontSize: 10, color: GREEN, textDecoration: "none", fontWeight: 600 }}>💬 WhatsApp</a>}
                      {f.email && <a href={`mailto:${f.email}`} style={{ fontSize: 10, color: ORANGE, textDecoration: "none", fontWeight: 600 }}>📧 Email</a>}
                    </div>
                  )}
                </div>
                <span style={{ color: "#bbb", fontSize: 16 }}>›</span>
              </div>
            </div>
          ))
        )}
      </div>
      <KMFooter />

      {/* MODAL */}
      <Modal show={modal} title={editandoId ? "Editar Fornecedor" : "Novo Fornecedor"} onClose={() => setModal(false)}>
        <label style={labelS}>🏪 Nome (apelido / como você chama)</label>
        <input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: Casa do Pedreiro" style={inputS} />

        <label style={labelS}>📋 Razão Social</label>
        <input value={form.razaoSocial} onChange={e => set("razaoSocial", e.target.value)} placeholder="Ex: Casa do Pedreiro Comércio LTDA" style={inputS} />

        <label style={labelS}>🏛️ CNPJ</label>
        <input value={form.cnpj} onChange={e => set("cnpj", e.target.value)} placeholder="00.000.000/0001-00" style={inputS} />

        <label style={labelS}>🏷️ Categoria</label>
        <select value={form.categoria} onChange={e => set("categoria", e.target.value)} style={selS}>
          <option value="">— Selecione —</option>
          {CATEGORIAS_FORNECEDOR.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <label style={labelS}>👤 Pessoa de contato</label>
        <input value={form.contato} onChange={e => set("contato", e.target.value)} placeholder="Ex: João, vendedor" style={inputS} />

        <label style={labelS}>📞 Telefone fixo</label>
        <input value={form.telefone} onChange={e => set("telefone", e.target.value)} placeholder="(28) 0000-0000" style={inputS} />

        <label style={labelS}>💬 WhatsApp</label>
        <input value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)} placeholder="(28) 9 0000-0000" style={inputS} />

        <label style={labelS}>📧 Email</label>
        <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="contato@fornecedor.com.br" type="email" style={inputS} />

        <label style={labelS}>📍 Endereço</label>
        <input value={form.endereco} onChange={e => set("endereco", e.target.value)} placeholder="Rua, cidade" style={inputS} />

        <label style={labelS}>📝 Observações</label>
        <textarea value={form.obs} onChange={e => set("obs", e.target.value)} rows={2} placeholder="Forma de pagamento usual, prazo médio, etc" style={{ ...inputS, fontFamily: "inherit", resize: "none" }} />

        {editandoId && (
          <button onClick={() => { confirmar(`Excluir "${form.nome}"?`, () => { onRemover(editandoId); setModal(false); }) }} style={{ width: "100%", padding: 10, background: "#fef2f2", color: RED, border: `1px solid ${RED}33`, borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 12, marginBottom: 8 }}>🗑️ Excluir Fornecedor</button>
        )}
        <Btn label="💾 SALVAR" color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   GALERIA DE FOTOS POR OBRA
════════════════════════════════════ */

export function TelaPedidoDetalhe({ pedido, obras, empresa, onBack, onAprovar, onNegar, onRemover, onEditar }) {
  const [modal, setModal] = useState(false);
  const [formaPag, setFormaPag] = useState(pedido.formaPagamento || "");
  const [prazo, setPrazo] = useState(pedido.prazoEntrega || "");

  // EDIÇÃO de itens antes de aprovar/negar
  const [modalEdicao, setModalEdicao] = useState(false);
  const [itensEdit, setItensEdit] = useState(pedido.itens || [{ material: pedido.material || "", qtd: pedido.qtd || "", obs: pedido.obs || "" }]);
  const [obsGeralEdit, setObsGeralEdit] = useState(pedido.obsGeral || "");

  const abrirEdicao = () => {
    setItensEdit(JSON.parse(JSON.stringify(pedido.itens || [{ material: pedido.material || "", qtd: pedido.qtd || "", obs: pedido.obs || "" }])));
    setObsGeralEdit(pedido.obsGeral || "");
    setModalEdicao(true);
  };

  const setItem = (i, campo, valor) => {
    setItensEdit(prev => prev.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it));
  };

  const adicionarItem = () => setItensEdit(prev => [...prev, { material: "", qtd: "", obs: "" }]);
  const removerItem = (i) => setItensEdit(prev => prev.filter((_, idx) => idx !== i));

  const salvarEdicao = () => {
    const itensLimpos = itensEdit.filter(it => it.material && it.material.trim());
    if (itensLimpos.length === 0) {
      alert("⚠️ Adicione pelo menos um item");
      return;
    }
    onEditar({ ...pedido, itens: itensLimpos, obsGeral: obsGeralEdit });
    setModalEdicao(false);
    alert("✅ Pedido atualizado!");
  };

  const obra = obras.find(o => o.id === pedido.obraId);
  const itens = pedido.itens || [{ material: pedido.material, qtd: pedido.qtd, obs: pedido.obs }];
  const numeroPedido = String(pedido.id).slice(-6);
  const cor = pedido.status === "Aprovado" ? GREEN : pedido.status === "Negado" ? RED : ORANGE;
  const statusLabel = pedido.status === "Aprovado" ? "✓ Aprovado" : pedido.status === "Negado" ? "✕ Negado" : "⏳ Aguardando";

  const aprovar = () => {
    const pedidoCompleto = { ...pedido, formaPagamento: formaPag, prazoEntrega: prazo, status: "Aprovado" };
    onAprovar(pedido.id, { formaPagamento: formaPag, prazoEntrega: prazo });
    setTimeout(() => {
      try { gerarSolicitacaoPedidoPDF(pedidoCompleto, obra, empresa); }
      catch (e) { alert("✅ Aprovado! Erro ao gerar PDF: " + e.message); }
    }, 200);
    setModal(false);
    onBack();
  };

  const baixarPDF = () => {
    try { gerarSolicitacaoPedidoPDF(pedido, obra, empresa); }
    catch (e) { alert("⚠️ Erro: " + e.message); }
  };

  const negarPedido = () => {
    confirmar("Negar este pedido? O encarregado será notificado.", () => {
      onNegar(pedido.id);
      onBack();
    });
  };

  const removerPedido = () => {
    confirmar(`Excluir pedido Nº ${numeroPedido}?\n\nEsta ação não pode ser desfeita.`, () => {
      onRemover(pedido.id);
      onBack();
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title={`Pedido Nº ${numeroPedido}`} sub={pedido.status} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* CABEÇALHO */}
        <div style={{ background: `linear-gradient(135deg,${cor},${cor}cc)`, color: "#fff", borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Pedido Nº {numeroPedido}</div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>{pedido.obra}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.25)", padding: "4px 10px", borderRadius: 10, fontSize: 11, fontWeight: 800 }}>{statusLabel}</div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.9 }}>
            👷 Solicitado por <b>{pedido.enc}</b> em {pedido.data}
          </div>
        </div>

        {/* INFO DA OBRA / ENTREGA */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>📍 Entregar em</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{obra?.nome || "—"}</div>
          {obra?.endereco && <div style={{ fontSize: 12, color: "#444", marginTop: 4 }}>📌 {obra.endereco}</div>}
          {obra?.refLocal && <div style={{ fontSize: 11, color: "#666", marginTop: 2, fontStyle: "italic" }}>Ref: {obra.refLocal}</div>}
          {obra?.local && <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>📍 {obra.local}</div>}
          {(obra?.lat && obra?.lng) && (
            <a href={`https://maps.google.com/?q=${obra.lat},${obra.lng}`} target="_blank" rel="noopener" style={{ display: "inline-block", marginTop: 6, padding: "4px 10px", background: BLUE, color: "#fff", borderRadius: 6, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>📡 Ver no Mapa</a>
          )}
          {!obra?.endereco && (
            <div style={{ background: "#fef2f2", borderRadius: 6, padding: "6px 8px", marginTop: 8, fontSize: 10, color: RED }}>
              ⚠️ Obra sem endereço cadastrado. Recomendado completar antes de aprovar.
            </div>
          )}
        </div>

        {/* ITENS DO PEDIDO */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 8 }}>📦 Itens solicitados ({itens.length})</div>
          {itens.map((it, i) => (
            <div key={i} style={{ padding: "10px 0", borderBottom: i < itens.length - 1 ? "1px solid #f0f0f0" : "none" }}>
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <div style={{ background: NAVY, color: "#fff", width: 22, height: 22, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, marginRight: 8, flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{it.materialBase || it.material}</div>
                  {it.marca && <div style={{ fontSize: 11, color: BLUE, fontWeight: 600, marginTop: 2 }}>🏷️ Marca: {it.marca}</div>}
                  {it.categoria && <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{it.categoria}</div>}
                  {it.obs && <div style={{ fontSize: 11, color: "#666", marginTop: 4, fontStyle: "italic" }}>📝 {it.obs}</div>}
                </div>
                <div style={{ background: "#f0fdf4", padding: "4px 10px", borderRadius: 6, fontSize: 13, fontWeight: 800, color: GREEN, whiteSpace: "nowrap" }}>{it.qtd}</div>
              </div>
            </div>
          ))}
        </div>

        {/* OBSERVAÇÃO GERAL */}
        {pedido.obsGeral && (
          <div style={{ background: "#fef9e7", borderRadius: 12, padding: 14, marginBottom: 10, borderLeft: `4px solid ${ORANGE}` }}>
            <div style={{ fontSize: 11, color: "#8b6f00", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>📝 Observação Geral</div>
            <div style={{ fontSize: 13, color: "#444" }}>{pedido.obsGeral}</div>
          </div>
        )}

        {/* DADOS DE PAGAMENTO (se aprovado) */}
        {pedido.status === "Aprovado" && (pedido.formaPagamento || pedido.prazoEntrega) && (
          <div style={{ background: "#f0fdf4", borderRadius: 12, padding: 14, marginBottom: 10, borderLeft: `4px solid ${GREEN}` }}>
            <div style={{ fontSize: 11, color: "#14532d", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>💰 Pagamento e prazo</div>
            <div style={{ fontSize: 12, color: "#14532d" }}>
              <div><b>Forma:</b> {pedido.formaPagamento || "—"}</div>
              <div><b>Prazo:</b> {pedido.prazoEntrega || "—"}</div>
            </div>
          </div>
        )}

        {/* AÇÕES */}
        <div style={{ marginTop: 12 }}>
          {pedido.status === "Aguardando" ? (
            <>
              <button onClick={abrirEdicao} style={{ width: "100%", padding: 12, borderRadius: 12, border: `1.5px solid ${BLUE}`, background: "#eff6ff", color: BLUE, fontWeight: 800, cursor: "pointer", fontSize: 13, marginBottom: 8 }}>
                ✏️ Editar Itens do Pedido
              </button>
              <button onClick={() => setModal(true)} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14, marginBottom: 8, boxShadow: "0 4px 12px rgba(42,168,79,0.3)" }}>
                ✓ APROVAR E GERAR PDF DO PEDIDO
              </button>
              <button onClick={negarPedido} style={{ width: "100%", padding: 12, borderRadius: 12, border: `1.5px solid ${RED}`, background: "#fff", color: RED, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                ✕ Negar Pedido
              </button>
            </>
          ) : pedido.status === "Aprovado" ? (
            <>
              <button onClick={baixarPDF} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: NAVY, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14, marginBottom: 8, boxShadow: "0 4px 12px rgba(15,33,81,0.3)" }}>
                📥 Baixar / Enviar Pedido (PDF A6)
              </button>
              <button onClick={removerPedido} style={{ width: "100%", padding: 10, borderRadius: 12, border: `1px solid ${RED}33`, background: "#fff", color: RED, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                🗑️ Excluir Pedido
              </button>
            </>
          ) : (
            <button onClick={removerPedido} style={{ width: "100%", padding: 12, borderRadius: 12, border: `1px solid ${RED}33`, background: "#fff", color: RED, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              🗑️ Excluir Pedido
            </button>
          )}
        </div>
      </div>
      <KMFooter />

      {/* MODAL APROVAÇÃO */}
      <Modal show={modal} title="✓ Aprovar Pedido" onClose={() => setModal(false)}>
        <div style={{ background: "#fef9e7", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 11, color: "#8b6f00" }}>
          💡 Preencha forma de pagamento e prazo para gerar a Solicitação de Pedido (PDF A6) que vai pro fornecedor.
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
        <input value={prazo} onChange={e => setPrazo(e.target.value)} placeholder="Ex: até 05/05/2026" style={inputS} />

        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setModal(false)} style={{ flex: 1, padding: 11, borderRadius: 8, border: "none", background: "#eee", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Cancelar</button>
          <button onClick={aprovar} style={{ flex: 2, padding: 11, borderRadius: 8, border: "none", background: GREEN, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>✓ Aprovar e Gerar PDF</button>
        </div>
      </Modal>

      {/* MODAL EDIÇÃO */}
      <Modal show={modalEdicao} title="✏️ Editar Pedido" onClose={() => setModalEdicao(false)}>
        <div style={{ background: "#eff6ff", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 11, color: "#1e40af", lineHeight: 1.5 }}>
          💡 Pode ajustar materiais, quantidades e observações antes de aprovar ou negar.
        </div>

        {itensEdit.map((it, i) => (
          <div key={i} style={{ background: "#f9fafb", borderRadius: 10, padding: 10, marginBottom: 8, border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "#666", fontWeight: 700 }}>ITEM {i + 1}</div>
              {itensEdit.length > 1 && (
                <button onClick={() => removerItem(i)} style={{ background: "#fee2e2", color: RED, border: "none", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✕</button>
              )}
            </div>

            <label style={labelS}>📦 Material</label>
            <input value={it.material} onChange={e => setItem(i, "material", e.target.value)} placeholder="Ex: Cimento CP-II" style={inputS} />

            <label style={labelS}>📏 Quantidade (ex: 10 sacos, 2,5 m³)</label>
            <input value={it.qtd} onChange={e => setItem(i, "qtd", e.target.value)} placeholder="Ex: 10 sacos" style={inputS} />

            <label style={labelS}>📝 Observação (opcional)</label>
            <input value={it.obs || ""} onChange={e => setItem(i, "obs", e.target.value)} placeholder="Marca, especificação, etc." style={inputS} />
          </div>
        ))}

        <button onClick={adicionarItem} style={{ width: "100%", padding: 10, background: "#f3f4f6", color: NAVY, border: `1px dashed ${NAVY}66`, borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, marginBottom: 12 }}>
          ➕ Adicionar Item
        </button>

        <label style={labelS}>📝 Observação Geral do Pedido</label>
        <textarea value={obsGeralEdit} onChange={e => setObsGeralEdit(e.target.value)} placeholder="Observações pro fornecedor" rows="2" style={{ ...inputS, resize: "vertical", minHeight: 50 }} />

        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button onClick={() => setModalEdicao(false)} style={{ flex: 1, padding: 11, borderRadius: 8, border: "none", background: "#eee", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Cancelar</button>
          <button onClick={salvarEdicao} style={{ flex: 2, padding: 11, borderRadius: 8, border: "none", background: GREEN, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>💾 Salvar Alterações</button>
        </div>
      </Modal>
    </div>
  );
}


export function TelaPedidos({ obras, pedidos, empresa, onBack, onVerDetalhe, onAprovar, onNegar, onRemover, onCriar, usuario, fornecedores = [] }) {
  const [filtro, setFiltro] = useState("todos");
  const [pedidoEdit, setPedidoEdit] = useState(null);
  const [formaPag, setFormaPag] = useState("");
  const [prazo, setPrazo] = useState("");

  // ════ NOVO PEDIDO PELO GESTOR ════
  const [modalNovo, setModalNovo] = useState(false);
  const [novoObraId, setNovoObraId] = useState(obras[0]?.id || "");
  const [novoFornecedorId, setNovoFornecedorId] = useState("");
  const [novoItens, setNovoItens] = useState([{ material: "", qtd: "1", unidade: "un" }]);
  const [novoObs, setNovoObs] = useState("");
  const [novoPrioridade, setNovoPrioridade] = useState("Normal");

  const abrirNovoPedido = () => {
    setNovoObraId(obras[0]?.id || "");
    setNovoFornecedorId("");
    setNovoItens([{ material: "", qtd: "1", unidade: "un" }]);
    setNovoObs("");
    setNovoPrioridade("Normal");
    setModalNovo(true);
  };

  const addItemNovo = () => setNovoItens([...novoItens, { material: "", qtd: "1", unidade: "un" }]);
  const removerItemNovo = (i) => setNovoItens(novoItens.filter((_, idx) => idx !== i));
  const updateItemNovo = (i, campo, valor) => {
    setNovoItens(novoItens.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it));
  };

  const salvarNovoPedido = () => {
    if (!novoObraId) { alert("Selecione uma obra."); return; }
    const itensValidos = novoItens.filter(i => i.material && i.material.trim());
    if (itensValidos.length === 0) { alert("Adicione pelo menos um item com nome."); return; }
    const fornecedor = fornecedores.find(f => String(f.id) === String(novoFornecedorId));
    const obraSelecionada = obras.find(o => String(o.id) === String(novoObraId));
    const novoPedido = {
      id: Date.now(),
      obraId: novoObraId,
      obraNome: obraSelecionada?.nome || "",
      itens: itensValidos,
      material: itensValidos[0].material, // compatibilidade legado
      qtd: itensValidos[0].qtd,
      fornecedorId: fornecedor ? fornecedor.id : null,
      fornecedorNome: fornecedor ? fornecedor.nome : "",
      observacaoGeral: novoObs,
      prioridade: novoPrioridade,
      status: "Aguardando",
      data: new Date().toLocaleString("pt-BR"),
      criadoPor: usuario?.nome || "Gestor",
      criadoPorTipo: "Gestor",
    };
    if (onCriar) onCriar(novoPedido);
    setModalNovo(false);
  };

  const filtrados = filtro === "todos" ? pedidos : pedidos.filter(p => p.status === filtro);

  const aprovar = () => {
    if (!pedidoEdit) return;
    const obraDoPedido = obras.find(o => o.id === pedidoEdit.obraId);
    const pedidoCompleto = { ...pedidoEdit, formaPagamento: formaPag, prazoEntrega: prazo, status: "Aprovado" };
    onAprovar(pedidoEdit.id, { formaPagamento: formaPag, prazoEntrega: prazo });
    setTimeout(() => {
      try { gerarSolicitacaoPedidoPDF(pedidoCompleto, obraDoPedido, empresa); }
      catch (e) { alert("✅ Aprovado! Erro ao gerar PDF: " + e.message); }
    }, 200);
    setPedidoEdit(null);
    setFormaPag("");
    setPrazo("");
  };

  const baixar = (p) => {
    const obraDoPedido = obras.find(o => o.id === p.obraId);
    try {
      gerarSolicitacaoPedidoPDF(p, obraDoPedido, empresa);
    } catch (e) {
      alert("⚠️ Não foi possível gerar o PDF: " + e.message);
    }
  };

  const total = pedidos.length;
  const totalPendentes = pedidos.filter(p => p.status === "Aguardando").length;
  const totalAprovados = pedidos.filter(p => p.status === "Aprovado").length;
  const totalNegados = pedidos.filter(p => p.status === "Negado").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Pedidos de Material" sub={`${total} total`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
          <div onClick={() => setFiltro("Aguardando")} style={{ background: filtro === "Aguardando" ? ORANGE : "#fff", color: filtro === "Aguardando" ? "#fff" : NAVY, borderRadius: 10, padding: 10, textAlign: "center", cursor: "pointer", border: `1.5px solid ${ORANGE}` }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{totalPendentes}</div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>⏳ Aguardando</div>
          </div>
          <div onClick={() => setFiltro("Aprovado")} style={{ background: filtro === "Aprovado" ? GREEN : "#fff", color: filtro === "Aprovado" ? "#fff" : NAVY, borderRadius: 10, padding: 10, textAlign: "center", cursor: "pointer", border: `1.5px solid ${GREEN}` }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{totalAprovados}</div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>✓ Aprovados</div>
          </div>
          <div onClick={() => setFiltro("Negado")} style={{ background: filtro === "Negado" ? RED : "#fff", color: filtro === "Negado" ? "#fff" : NAVY, borderRadius: 10, padding: 10, textAlign: "center", cursor: "pointer", border: `1.5px solid ${RED}` }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{totalNegados}</div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>✕ Negados</div>
          </div>
        </div>

        <button onClick={() => setFiltro("todos")} style={{
          width: "100%", padding: 8, background: filtro === "todos" ? NAVY : "#fff", color: filtro === "todos" ? "#fff" : NAVY,
          border: `1.5px solid ${NAVY}`, borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 11, marginBottom: 8
        }}>📋 Ver todos ({total})</button>

        {/* BOTÃO NOVO PEDIDO (gestor) */}
        {onCriar && (
          <button onClick={abrirNovoPedido} style={{
            width: "100%", padding: 12, marginBottom: 12,
            background: `linear-gradient(135deg, ${GOLD}, #d99517)`,
            color: "#fff", border: "none", borderRadius: 10,
            fontWeight: 800, fontSize: 13, cursor: "pointer",
            boxShadow: `0 4px 12px ${GOLD}40`,
          }}>
            ➕ NOVO PEDIDO DE COMPRA
          </button>
        )}

        {filtrados.length === 0 ? (
          <EmptyState
            icon="📦"
            titulo="Nenhum pedido neste filtro"
            subtitulo="Quando houver pedidos de compra criados pelos encarregados ou pelo gestor, eles aparecerão aqui."
            cor={ORANGE}
          />
        ) : filtrados.sort((a, b) => b.id - a.id).map(p => {
          const itens = p.itens || [{ material: p.material, qtd: p.qtd }];
          const cor = p.status === "Aprovado" ? GREEN : p.status === "Negado" ? RED : ORANGE;
          const numeroPedido = String(p.id).slice(-6);
          return (
            <div key={p.id} onClick={() => onVerDetalhe && onVerDetalhe(p)} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${cor}`, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: "#888", fontWeight: 600 }}>Nº {numeroPedido} • {p.data}</div>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 13, marginTop: 2 }}>{p.obra}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>👷 {p.enc} • <b style={{ color: NAVY }}>{itens.length} {itens.length === 1 ? "item" : "itens"}</b></div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ background: cor, color: "#fff", padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 800 }}>{p.status}</div>
                  <span style={{ color: "#bbb", fontSize: 16 }}>›</span>
                </div>
              </div>

              <div style={{ background: "#f9fafb", borderRadius: 6, padding: "6px 8px", marginBottom: 6 }}>
                {itens.slice(0, 3).map((it, i) => (
                  <div key={i} style={{ fontSize: 11, color: "#444", paddingBottom: 2 }}>
                    {i + 1}) <b>{it.material}</b> — <span style={{ color: GREEN, fontWeight: 700 }}>{it.qtd}</span>
                  </div>
                ))}
                {itens.length > 3 && <div style={{ fontSize: 10, color: BLUE, fontWeight: 600 }}>+ {itens.length - 3} item(ns) — toque pra ver todos</div>}
              </div>

              {p.obsGeral && <div style={{ fontSize: 10, color: "#888", fontStyle: "italic", marginBottom: 6 }}>📝 {p.obsGeral}</div>}

              {p.status === "Aprovado" && (p.formaPagamento || p.prazoEntrega) && (
                <div style={{ background: "#f0fdf4", borderRadius: 6, padding: "4px 8px", marginBottom: 6, fontSize: 10, color: "#14532d" }}>
                  💰 {p.formaPagamento || "—"} • 📅 {p.prazoEntrega || "—"}
                </div>
              )}

              <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                {p.status === "Aguardando" ? (
                  <>
                    <button onClick={() => onNegar(p.id)} style={{ flex: 1, padding: 7, borderRadius: 8, border: "none", background: RED, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>✕ Negar</button>
                    <button onClick={() => { setPedidoEdit(p); setFormaPag(""); setPrazo(""); }} style={{ flex: 2, padding: 7, borderRadius: 8, border: "none", background: GREEN, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>✓ Aprovar e Gerar Pedido</button>
                  </>
                ) : p.status === "Aprovado" ? (
                  <>
                    <button onClick={() => baixar(p)} style={{ flex: 2, padding: 7, borderRadius: 8, border: "none", background: NAVY, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>📥 Baixar Pedido (A6)</button>
                    <button onClick={() => { confirmar(`Excluir pedido Nº ${numeroPedido}?`, () => { onRemover(p.id); }); }} style={{ padding: 7, borderRadius: 8, border: `1px solid ${RED}33`, background: "#fff", color: RED, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>🗑️</button>
                  </>
                ) : (
                  <button onClick={() => { confirmar(`Excluir pedido Nº ${numeroPedido}?`, () => { onRemover(p.id); }); }} style={{ flex: 1, padding: 7, borderRadius: 8, border: `1px solid ${RED}33`, background: "#fff", color: RED, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>🗑️ Excluir</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <KMFooter />

      {/* MODAL APROVAÇÃO */}
      <Modal show={!!pedidoEdit} title="✓ Aprovar Pedido" onClose={() => setPedidoEdit(null)}>
        {pedidoEdit && (() => {
          const itens = pedidoEdit.itens || [{ material: pedidoEdit.material, qtd: pedidoEdit.qtd }];
          const obraDoPedido = obras.find(o => o.id === pedidoEdit.obraId);
          return (
            <>
              <div style={{ background: "#f0fdf4", borderRadius: 10, padding: 10, marginBottom: 10, borderLeft: `3px solid ${GREEN}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{pedidoEdit.obra}</div>
                <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>{itens.length} {itens.length === 1 ? "item" : "itens"} • 👷 {pedidoEdit.enc}</div>
                {itens.map((it, i) => (
                  <div key={i} style={{ fontSize: 10, color: "#444" }}>{i + 1}) <b>{it.material}</b> — <span style={{ color: GREEN, fontWeight: 700 }}>{it.qtd}</span></div>
                ))}
              </div>

              <div style={{ background: "#fef9e7", borderRadius: 6, padding: 8, marginBottom: 10, fontSize: 10, color: "#8b6f00" }}>
                💡 Após aprovar, o PDF do pedido (A6) é gerado automaticamente.
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
              <input value={prazo} onChange={e => setPrazo(e.target.value)} placeholder="Ex: até 05/05/2026" style={inputS} />

              {!obraDoPedido?.endereco && (
                <div style={{ background: "#fef2f2", borderRadius: 6, padding: 8, marginBottom: 10, fontSize: 10, color: RED }}>
                  ⚠️ A obra não tem endereço cadastrado. O PDF não terá detalhes de entrega completos.
                </div>
              )}

              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setPedidoEdit(null)} style={{ flex: 1, padding: 11, borderRadius: 8, border: "none", background: "#eee", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Cancelar</button>
                <button onClick={aprovar} style={{ flex: 2, padding: 11, borderRadius: 8, border: "none", background: GREEN, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>✓ Aprovar e Gerar PDF</button>
              </div>
            </>
          );
        })()}
      </Modal>

      {/* MODAL: NOVO PEDIDO PELO GESTOR */}
      <Modal show={modalNovo} title="➕ Novo Pedido de Compra" onClose={() => setModalNovo(false)}>
        <div style={{ background: "#fff7e6", borderRadius: 8, padding: "8px 10px", marginBottom: 12, fontSize: 11, color: "#8a6d1a", lineHeight: 1.4 }}>
          💡 Pedido criado pelo gestor já entra como <b>Aguardando aprovação</b>. Você pode aprovar em seguida na lista.
        </div>

        <label style={labelS}>🏗️ Obra</label>
        <select value={novoObraId} onChange={e => setNovoObraId(e.target.value)} style={selS}>
          <option value="">Selecione a obra...</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        {fornecedores.length > 0 && (
          <>
            <label style={labelS}>🏪 Fornecedor (opcional)</label>
            <select value={novoFornecedorId} onChange={e => setNovoFornecedorId(e.target.value)} style={selS}>
              <option value="">Não definir fornecedor agora</option>
              {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </>
        )}

        <label style={labelS}>🚨 Prioridade</label>
        <select value={novoPrioridade} onChange={e => setNovoPrioridade(e.target.value)} style={selS}>
          <option>Baixa</option>
          <option>Normal</option>
          <option>Alta</option>
          <option>Urgente</option>
        </select>

        <label style={labelS}>📦 Itens do Pedido</label>
        {novoItens.map((item, i) => (
          <div key={i} style={{ background: "#f9fafb", borderRadius: 8, padding: 8, marginBottom: 6, border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: NAVY }}>Item {i + 1}</span>
              {novoItens.length > 1 && (
                <button onClick={() => removerItemNovo(i)} style={{ background: "none", border: "none", color: RED, cursor: "pointer", fontSize: 14 }}>🗑️</button>
              )}
            </div>
            <input
              value={item.material}
              onChange={e => updateItemNovo(i, "material", e.target.value)}
              placeholder="Ex: Cimento CP-II"
              style={{ ...inputS, fontSize: 13, marginBottom: 4 }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <input
                value={item.qtd}
                onChange={e => updateItemNovo(i, "qtd", e.target.value)}
                type="number"
                placeholder="Qtd"
                style={{ ...inputS, fontSize: 13, marginBottom: 0 }}
              />
              <select
                value={item.unidade}
                onChange={e => updateItemNovo(i, "unidade", e.target.value)}
                style={{ ...selS, fontSize: 12, marginBottom: 0 }}
              >
                <option value="un">un</option>
                <option value="kg">kg</option>
                <option value="m">m</option>
                <option value="m²">m²</option>
                <option value="m³">m³</option>
                <option value="L">L</option>
                <option value="sc">sc (saco)</option>
                <option value="pç">pç (peça)</option>
              </select>
            </div>
          </div>
        ))}
        <button onClick={addItemNovo} style={{ width: "100%", padding: 8, marginBottom: 10, background: "#f0f7ff", color: BLUE, border: `1px dashed ${BLUE}`, borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
          ➕ Adicionar mais um item
        </button>

        <label style={labelS}>📝 Observações</label>
        <textarea
          value={novoObs}
          onChange={e => setNovoObs(e.target.value)}
          placeholder="Detalhes adicionais, urgência específica, local de entrega..."
          rows={2}
          style={{ ...inputS, fontFamily: "inherit", resize: "none" }}
        />

        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button onClick={() => setModalNovo(false)} style={{ flex: 1, padding: 11, borderRadius: 8, border: "none", background: "#eee", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Cancelar</button>
          <button onClick={salvarNovoPedido} style={{ flex: 2, padding: 11, borderRadius: 8, border: "none", background: GREEN, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>📦 Criar Pedido</button>
        </div>
      </Modal>
    </div>
  );
}


/* ════════════════════════════════════
   SOLICITAÇÃO DE PEDIDO DE COMPRA — documento NÃO FISCAL
════════════════════════════════════ */

export function gerarSolicitacaoPedidoPDF(pedido, obra, empresa) {
  const itens = pedido.itens && pedido.itens.length > 0
    ? pedido.itens
    : [{ material: pedido.material, qtd: pedido.qtd, obs: pedido.obs }]; // compat com pedidos antigos

  const linkMaps = (obra?.lat && obra?.lng)
    ? `https://maps.google.com/?q=${obra.lat},${obra.lng}`
    : (obra?.endereco ? `https://maps.google.com/?q=${encodeURIComponent(obra.endereco + ", " + (obra.local || ""))}` : "");

  const numeroPedido = String(pedido.id).slice(-6); // últimos 6 dígitos do ID

  const html = `<html>
    <head>
      <title>Pedido Nº ${numeroPedido}</title>
      <style>
        ${KM_PDF_PAGE_CSS}
        @page { size: A6; margin: 4mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 7.5pt; line-height: 1.25; margin: 0; padding: 0; width: 97mm; }

        .topo { border: 2px solid #0f2151; border-radius: 4px; padding: 0; margin-bottom: 4px; }
        .topo-header { background: #0f2151; color: #fff; padding: 4px 6px; }
        .topo-header .razao { font-size: 8pt; font-weight: 800; line-height: 1.1; }
        .topo-header .sub { font-size: 6pt; opacity: 0.85; line-height: 1.2; }
        .topo-titulo { display: flex; justify-content: space-between; align-items: center; padding: 3px 6px; background: #f5f8fc; border-top: 1px solid #d0dae8; }
        .topo-titulo h1 { margin: 0; font-size: 9pt; color: #0f2151; letter-spacing: 0.5px; font-weight: 900; }
        .topo-titulo .num { font-size: 9pt; color: #C0A040; font-weight: 800; }

        .selo {
          background: #fef9e7; border: 1px dashed #f5a623;
          padding: 2px 5px; text-align: center; margin: 3px 0;
          font-size: 6pt; color: #8b6f00; font-weight: 700; letter-spacing: 0.3px;
        }

        .info-row { display: flex; gap: 4px; margin-bottom: 3px; }
        .info-cell {
          flex: 1; border: 1px solid #ccc; border-radius: 3px;
          padding: 3px 5px; font-size: 7pt;
        }
        .info-cell .label { font-size: 5.5pt; color: #888; text-transform: uppercase; letter-spacing: 0.2px; font-weight: 700; }
        .info-cell .val { font-size: 7.5pt; font-weight: 700; color: #1a1a1a; }

        .bloco-entrega {
          background: #eff6ff; border-left: 3px solid #1e6bbf;
          padding: 4px 6px; margin-bottom: 3px; border-radius: 0 3px 3px 0;
        }
        .bloco-entrega .h { font-size: 6pt; color: #0c4a6e; text-transform: uppercase; font-weight: 800; letter-spacing: 0.3px; margin-bottom: 1px; }
        .bloco-entrega .linha { font-size: 7pt; color: #1a1a1a; line-height: 1.3; }
        .bloco-entrega b { color: #0c4a6e; }
        .bloco-entrega a { color: #1e6bbf; text-decoration: none; word-break: break-all; }

        .h-secao {
          background: #0f2151; color: #fff;
          padding: 2px 6px; margin: 3px 0 2px;
          font-size: 6.5pt; letter-spacing: 0.3px; font-weight: 800;
          text-transform: uppercase;
        }
        table { width: 100%; max-width: 100%; border-collapse: collapse; font-size: 7pt; table-layout: fixed; }
        th { background: #e8eef6; color: #003060; padding: 2px 4px; border: 1px solid #c5d0e0; text-align: left; font-size: 6pt; text-transform: uppercase; font-weight: 800; white-space: nowrap; }
        td { padding: 2px 4px; border: 1px solid #d5dce6; vertical-align: top; white-space: nowrap; }
        td.td-wrap { white-space: normal; overflow-wrap: break-word; word-break: normal; }
        td.num { width: 12px; text-align: center; color: #888; font-weight: 700; }
        td.qtd { text-align: right; font-weight: 700; color: #2aa84f; white-space: nowrap; width: 50px; }
        .marca { font-size: 6pt; color: #1e6bbf; font-weight: 600; }
        .obs-item { font-size: 6pt; color: #888; font-style: italic; }

        .pagamento {
          background: #f0fdf4; border-left: 3px solid #2aa84f;
          padding: 4px 6px; margin: 3px 0; border-radius: 0 3px 3px 0;
        }
        .pagamento .h { font-size: 6pt; color: #14532d; text-transform: uppercase; font-weight: 800; letter-spacing: 0.3px; }
        .pagamento .row { display: flex; gap: 6px; margin-top: 2px; }
        .pagamento .field { flex: 1; }
        .pagamento .field b { font-size: 6pt; color: #14532d; }
        .pagamento .preencher {
          border-bottom: 1px solid #888; min-height: 12px;
          padding: 1px 0; font-size: 8pt; font-weight: 600;
        }

        .obs-geral {
          background: #fef9e7; border-left: 3px solid #f5a623;
          padding: 3px 6px; margin: 3px 0; border-radius: 0 3px 3px 0;
          font-size: 7pt;
        }

        .ass {
          margin-top: 8px; text-align: center;
        }
        .ass-linha {
          border-top: 1px solid #000; padding-top: 2px;
          font-size: 6pt; color: #555; line-height: 1.3;
        }
        .ass-linha b { color: #0f2151; font-size: 7pt; }

        .footer-doc {
          margin-top: 4px; padding-top: 2px; border-top: 1px solid #ddd;
          font-size: 5pt; color: #888; text-align: center; line-height: 1.2;
        }

        /* Multi-página */
        h3, .h-secao { page-break-after: avoid; break-after: avoid; }
        tr, .bloco-entrega, .pagamento, .ass { page-break-inside: avoid; break-inside: avoid; }
      </style>
    </head>
    <body>
      <div class="topo">
        <div class="topo-header">
          <div class="razao">${empresa?.razaoSocial || "KM Consultoria, Assessoria e Serviços de Engenharia Ltda"}</div>
          <div class="sub">CNPJ: ${empresa?.cnpj || "—"} • ${empresa?.responsavel || "Kleber Vieira Martins"}</div>
          <div class="sub">📱 ${empresa?.telefone || ""} • 📧 ${empresa?.email || ""}</div>
        </div>
        <div class="topo-titulo">
          <h1>SOLICITAÇÃO DE PEDIDO</h1>
          <div class="num">Nº ${numeroPedido}</div>
        </div>
      </div>

      <div class="selo">⚠️ DOCUMENTO INTERNO — NÃO É NOTA FISCAL ⚠️</div>

      <div class="info-row">
        <div class="info-cell">
          <div class="label">📅 Data</div>
          <div class="val">${pedido.data || new Date().toLocaleDateString("pt-BR")}</div>
        </div>
        <div class="info-cell">
          <div class="label">👷 Solicitante</div>
          <div class="val">${pedido.enc || "—"}</div>
        </div>
      </div>

      <div class="bloco-entrega">
        <div class="h">📍 Entregar em</div>
        <div class="linha"><b>${obra?.nome || pedido.obra || "—"}</b></div>
        ${obra?.endereco ? `<div class="linha">${obra.endereco}</div>` : ""}
        ${obra?.refLocal ? `<div class="linha">📌 Ref: ${obra.refLocal}</div>` : ""}
        ${obra?.local ? `<div class="linha">${obra.local}</div>` : ""}
        ${linkMaps ? `<div class="linha"><a href="${linkMaps}">📡 Ver no mapa</a></div>` : ""}
      </div>

      <div class="h-secao">📦 Itens (${itens.length})</div>
      <table>
        <thead>
          <tr>
            <th class="num" style="width:16px;">#</th>
            <th>Material</th>
            <th style="text-align:right;width:50px;">Qtd</th>
          </tr>
        </thead>
        <tbody>
          ${itens.map((item, i) => `
            <tr>
              <td class="num">${i + 1}</td>
              <td class="td-wrap">
                <b>${item.materialBase || item.material}</b>
                ${item.marca ? `<br/><span class="marca">🏷️ ${item.marca}</span>` : ""}
                ${item.obs ? `<div class="obs-item">📝 ${item.obs}</div>` : ""}
              </td>
              <td class="qtd">${fmtQtd(item.qtd)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      ${pedido.obsGeral ? `
        <div class="obs-geral">
          <b style="font-size:6pt;color:#8b6f00;">📝 OBSERVAÇÃO GERAL:</b><br/>
          ${pedido.obsGeral}
        </div>
      ` : ""}

      <div class="pagamento">
        <div class="h">💰 Pagamento e Prazo</div>
        <div class="row">
          <div class="field">
            <b>Forma de pagto:</b>
            <div class="preencher">${pedido.formaPagamento || "&nbsp;"}</div>
          </div>
          <div class="field">
            <b>Prazo entrega:</b>
            <div class="preencher">${pedido.prazoEntrega || "&nbsp;"}</div>
          </div>
        </div>
      </div>

      <div class="ass">
        <div style="height:18px;"></div>
        <div class="ass-linha">
          <b>${empresa?.responsavel || "Kleber Vieira Martins"}</b><br/>
          ${empresa?.razaoSocial?.split(",")[0] || "KM Consultoria"} • ${empresa?.telefone || ""}
        </div>
      </div>

      <div class="footer-doc">
        Sistema KMZERO • Pedido Nº ${numeroPedido} • ${new Date().toLocaleString("pt-BR")}<br/>
        Esta solicitação não substitui nota fiscal
      </div>
    </body>
  </html>`;

  abrirOuBaixarHTML(html, `Pedido-${numeroPedido}-${(obra?.nome || "obra").substring(0, 20).replace(/[^a-z0-9]/gi, "_")}`);
}

/* ════════════════════════════════════
   FICHA CADASTRAL IMPRIMÍVEL — A4 oficial pra arquivo físico
════════════════════════════════════ */

export function TelaRecebimento({ obras, pedidos, usuario, recebimentos, onBack, onAdd }) {
  const [step, setStep] = useState("lista"); // lista | novo | foto | confirmar
  const [pedidoSel, setPedidoSel] = useState(null);
  const [foto, setFoto] = useState(null);
  const [obs, setObs] = useState("");
  const [conformidade, setConformidade] = useState("Conforme");

  const ehGestor = usuario?.perfil === "gestor";
  const aprovados = pedidos.filter(p => p.status === "Aprovado" && (ehGestor || (usuario?.obraId && p.obraId === usuario.obraId)));
  const meusReceb = recebimentos.filter(r => ehGestor || (usuario?.obraId && r.obraId === usuario.obraId));

  const handleFoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => { setFoto(ev.target.result); setStep("confirmar"); };
    r.readAsDataURL(f);
  };

  const confirmar = () => {
    onAdd({
      id: Date.now(), pedidoId: pedidoSel.id, obraId: pedidoSel.obraId,
      material: pedidoSel.material, qtd: pedidoSel.qtd, foto, obs, conformidade,
      autor: usuario?.nome, ts: Date.now(), data: new Date().toLocaleDateString("pt-BR"),
    });
    setStep("lista"); setPedidoSel(null); setFoto(null); setObs(""); setConformidade("Conforme");
  };

  if (step === "novo") return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Selecionar Pedido" onBack={() => setStep("lista")} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>Selecione o pedido aprovado que está sendo recebido:</div>
        {aprovados.length === 0 && <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", color: "#aaa" }}>Nenhum pedido aprovado para receber.</div>}
        {aprovados.map(p => (
          <div key={p.id} onClick={() => { setPedidoSel(p); setStep("foto"); }} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer", borderLeft: `4px solid ${GREEN}` }}>
            <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{p.material} — {fmtQtd(p.qtd)}</div>
            <div style={{ fontSize: 11, color: "#888" }}>{p.obra} • {p.data} • {p.enc}</div>
          </div>
        ))}
      </div>
      <KMFooter />
    </div>
  );

  if (step === "foto") return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Foto da Entrega" sub={pedidoSel?.material} onBack={() => setStep("novo")} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📦</div>
          <div style={{ fontWeight: 700, color: NAVY }}>{pedidoSel?.material}</div>
          <div style={{ fontSize: 13, color: "#666" }}>{pedidoSel?.qtd}</div>
        </div>
        <div style={{ background: "#fff8e1", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#7b5800", marginBottom: 12 }}>
          ⚠️ <b>Validação Visual Obrigatória</b><br/>Tire foto do material recebido como comprovação.
        </div>
        <label style={{ ...bigBtn(BLUE), display: "block", textAlign: "center" }}>
          📷 Tirar Foto
          <input type="file" accept="image/*" capture="environment" onChange={handleFoto} style={{ display: "none" }} />
        </label>
      </div>
      <KMFooter />
    </div>
  );

  if (step === "confirmar") return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Validar Recebimento" sub={pedidoSel?.material} onBack={() => setStep("foto")} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {foto && <img src={foto} alt="" style={{ width: "100%", borderRadius: 12, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }} />}

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>✓ Conformidade da Entrega</div>
          {[
            { v: "Conforme",        l: "✅ Conforme — tudo correto", c: GREEN },
            { v: "Divergência",     l: "⚠️ Divergência — quantidade ou qualidade",   c: ORANGE },
            { v: "Não Conforme",    l: "❌ Não Conforme — material errado",          c: RED },
          ].map(o => (
            <button key={o.v} onClick={() => setConformidade(o.v)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `2px solid ${conformidade === o.v ? o.c : "#dde2ef"}`, background: conformidade === o.v ? o.c : "#fff", color: conformidade === o.v ? "#fff" : "#666", fontWeight: 700, cursor: "pointer", fontSize: 13, marginBottom: 8, textAlign: "left" }}>
              {o.l}
            </button>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <label style={labelS}>Observações</label>
          <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} placeholder={conformidade === "Conforme" ? "Ex: material em ordem" : "Descreva a divergência ou problema..."} style={{ ...inputS, resize: "none", marginBottom: 0 }} />
        </div>

        <Btn label="✓ CONFIRMAR RECEBIMENTO" color={conformidade === "Conforme" ? GREEN : ORANGE} onClick={confirmar} />
      </div>
      <KMFooter />
    </div>
  );

  // Lista
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Recebimento" sub="Validação de entregas" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <Btn label="➕ Novo Recebimento" color={GREEN} onClick={() => setStep("novo")} style={{ marginBottom: 14 }} />

        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, fontSize: 13 }}>📜 Recebimentos recentes</div>
        {meusReceb.length === 0 && <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", color: "#aaa" }}>Nenhum recebimento ainda.</div>}
        {meusReceb.map(r => {
          const cor = r.conformidade === "Conforme" ? GREEN : r.conformidade === "Divergência" ? ORANGE : RED;
          const obra = obras.find(o => o.id === r.obraId);
          return (
            <div key={r.id} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${cor}` }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                {r.foto && <img src={r.foto} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover" }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{r.material} — {r.qtd}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{obra?.nome} • {r.data}</div>
                  <Badge label={r.conformidade} color={cor} small />
                  {r.obs && <div style={{ fontSize: 11, color: "#666", marginTop: 4, fontStyle: "italic" }}>{r.obs}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   FOLHA QUINZENAL (1ª: 1-15 / 2ª: 16-fim)
════════════════════════════════════ */
