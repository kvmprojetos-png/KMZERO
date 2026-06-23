import { carimbarFoto } from "./suprimentos.jsx";
import { CATEGORIAS_ANEXO_GESTOR, CATEGORIAS_ANEXO_ENCARREGADO } from "./sistema.jsx";
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

export function TelaFotos({ obra, usuario, onBack, onSalvar, totalFotosObra = 0 }) {
  const [fotos, setFotos] = useState([]);
  const [legenda, setLegenda] = useState("");
  const [ok, setOk] = useState(false);

  const handleArquivo = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => {
      if (fotos.length >= 5) return;
      const reader = new FileReader();
      reader.onload = ev => setFotos(fs => fs.length < 5 ? [...fs, ev.target.result] : fs);
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };

  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setEnviando(true);
    try {
      const agora = Date.now();
      const dataAtual = new Date().toLocaleDateString("pt-BR");
      const horaAtual = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const autorNome = usuario?.nome || "Encarregado";

      // Carimba cada foto antes de salvar
      for (let i = 0; i < fotos.length; i++) {
        const numeroSequencial = totalFotosObra + i + 1;
        const fotoCarimbada = await carimbarFoto(fotos[i], {
          numero: numeroSequencial,
          obra: obra.nome,
          autor: autorNome,
          data: dataAtual,
          hora: horaAtual,
        });

        onSalvar({
          id: agora + i,
          numero: numeroSequencial,
          obraId: obra.id,
          obraNome: obra.nome,
          foto: fotoCarimbada,
          legenda,
          autor: autorNome,
          data: dataAtual,
          hora: horaAtual,
        });
      }
      setOk(true);
    } catch (e) {
      alert("⚠️ Erro ao processar fotos: " + e.message);
    }
    setEnviando(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Enviar Fotos" sub={obra.nome} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {ok ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 64 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: GREEN, marginTop: 12 }}>{fotos.length} foto(s) enviada(s)!</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Salvas na galeria da obra. Você e o gestor podem acessá-las depois.</div>
            <Btn label="📷 Mais Fotos" color={BLUE} onClick={() => { setOk(false); setFotos([]); setLegenda(""); }} style={{ marginTop: 24 }} />
            <Btn label="Voltar" color="#eee" text={NAVY} onClick={onBack} style={{ marginTop: 8 }} />
          </div>
        ) : (
          <>
            <label style={{ ...bigBtn(BLUE), display: "block", textAlign: "center", marginBottom: 8 }}>
              📷  Tirar Foto
              <input type="file" accept="image/*" capture="environment" multiple onChange={handleArquivo} style={{ display: "none" }} />
            </label>
            <label style={{ ...bigBtn("#475569"), display: "block", textAlign: "center", marginBottom: 8 }}>
              🖼️  Escolher da Galeria
              <input type="file" accept="image/*" multiple onChange={handleArquivo} style={{ display: "none" }} />
            </label>
            <div style={{ fontSize: 12, color: "#999", textAlign: "center", margin: "8px 0" }}>{fotos.length}/5 fotos</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
              {fotos.map((f, i) => (
                <div key={i} style={{ background: "#dde6f5", borderRadius: 10, height: 90, position: "relative", overflow: "hidden" }}>
                  <img src={f} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button onClick={() => setFotos(fs => fs.filter((_, j) => j !== i))} style={{ position: "absolute", top: 4, right: 4, background: RED, color: "#fff", border: "none", borderRadius: 10, width: 22, height: 22, fontSize: 12, cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>✕</button>
                </div>
              ))}
            </div>
            {fotos.length > 0 && (
              <>
                <label style={labelS}>📝 Legenda (opcional, vale pra todas)</label>
                <input value={legenda} onChange={e => setLegenda(e.target.value)} placeholder="Ex: Concretagem da viga V1, sondagem do solo..." style={inputS} />
              </>
            )}
            {fotos.length > 0 && (
              <div style={{ background: "#f0f7ff", borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 11, color: "#0c4a6e" }}>
                💡 As fotos serão <b>carimbadas automaticamente</b> com data, hora, obra, número e autor.
              </div>
            )}
            <Btn label={enviando ? "⏳ Carimbando..." : "📤 Enviar"} color={fotos.length > 0 && !enviando ? GREEN : "#ccc"} disabled={fotos.length === 0 || enviando} onClick={enviar} />
          </>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   FORNECEDORES — CRUD simples
════════════════════════════════════ */
export const CATEGORIAS_FORNECEDOR = [
  "Material de construção",
  "Concreto / Argamassa",
  "Aço / Ferragem",
  "Madeira",
  "Tubos e conexões",
  "Elétrica",
  "Hidráulica",
  "Tintas",
  "Cerâmica / Pisos",
  "Areia / Brita / Solo",
  "Locação de equipamentos",
  "Frete / Transporte",
  "Combustível",
  "Alimentação",
  "Manutenção / Serviços",
  "Outros",
];


export function TelaGaleria({ obras, fotos = [], usuario, onBack, onRemover }) {
  const isGestor = usuario && usuario.perfil === "gestor";
  const [filtroObra, setFiltroObra] = useState("todas");
  const [filtroData, setFiltroData] = useState("");
  const [fotoExpandida, setFotoExpandida] = useState(null);

  const fotosFiltradas = fotos
    .filter(f => filtroObra === "todas" || String(f.obraId) === String(filtroObra))
    .filter(f => !filtroData || f.data === filtroData)
    .sort((a, b) => b.id - a.id);

  // agrupar por data
  const porData = {};
  fotosFiltradas.forEach(f => {
    if (!porData[f.data]) porData[f.data] = [];
    porData[f.data].push(f);
  });
  const datasOrdenadas = Object.keys(porData).sort((a, b) => {
    const [da, ma, ya] = a.split("/");
    const [db, mb, yb] = b.split("/");
    return new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da);
  });

  const baixarFoto = (foto) => {
    const link = document.createElement("a");
    link.href = foto.foto;
    link.download = `${foto.obraNome.replace(/[^a-z0-9]/gi, "_")}-${foto.data.replace(/\//g, "-")}-${foto.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Galeria de Fotos" sub={`${fotos.length} foto(s) total`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* KPI */}
        <div style={{ background: `linear-gradient(135deg,${BLUE},#0d4f8c)`, color: "#fff", borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>📷 Total de fotos</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{fotosFiltradas.length}</div>
          <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>
            {datasOrdenadas.length} {datasOrdenadas.length === 1 ? "dia com registro" : "dias com registro"}
          </div>
        </div>

        {/* Filtros */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <label style={labelS}>🏗️ Obra</label>
          <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={selS}>
            <option value="todas">Todas as obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
          <label style={labelS}>📅 Data específica (opcional)</label>
          <input value={filtroData} onChange={e => setFiltroData(e.target.value)} placeholder="DD/MM/AAAA" style={{ ...inputS, marginBottom: 0 }} />
        </div>

        {/* Lista por data */}
        {fotosFiltradas.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 30, textAlign: "center", color: "#aaa" }}>
            📷 Nenhuma foto neste filtro.
          </div>
        ) : (
          datasOrdenadas.map(data => (
            <div key={data} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 6, padding: "0 4px" }}>
                📅 {data} ({porData[data].length} foto{porData[data].length === 1 ? "" : "s"})
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {porData[data].map(f => (
                  <div key={f.id} onClick={() => setFotoExpandida(f)} style={{ position: "relative", aspectRatio: "1", background: "#ddd", borderRadius: 8, overflow: "hidden", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                    <img src={f.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {f.numero && (
                      <div style={{ position: "absolute", top: 4, left: 4, background: "rgba(15,33,81,0.9)", color: "#f5a623", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 800 }}>#{String(f.numero).padStart(3, "0")}</div>
                    )}
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.7))", padding: "8px 4px 4px", color: "#fff" }}>
                      <div style={{ fontSize: 8, opacity: 0.85 }}>{f.hora}</div>
                      {filtroObra === "todas" && (
                        <div style={{ fontSize: 8, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.obraNome.substring(0, 18)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      <KMFooter />

      {/* MODAL FOTO EXPANDIDA */}
      {fotoExpandida && (
        <div onClick={() => setFotoExpandida(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 9999, display: "flex", flexDirection: "column", padding: 14 }}>
          <div onClick={e => e.stopPropagation()} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <div style={{ flex: 1, color: "#fff" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {fotoExpandida.numero && <span style={{ background: "#f5a623", color: "#0f2151", padding: "2px 8px", borderRadius: 4, fontSize: 11, marginRight: 8, fontWeight: 900 }}>#{String(fotoExpandida.numero).padStart(3, "0")}</span>}
                  {fotoExpandida.obraNome}
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>📅 {fotoExpandida.data} • 🕐 {fotoExpandida.hora} • 👷 {fotoExpandida.autor}</div>
              </div>
              <button onClick={() => setFotoExpandida(null)} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 18, width: 36, height: 36, fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={fotoExpandida.foto} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
            </div>
            {fotoExpandida.legenda && (
              <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: 10, marginTop: 10, color: "#fff", fontSize: 12, textAlign: "center" }}>
                📝 {fotoExpandida.legenda}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => baixarFoto(fotoExpandida)} style={{ flex: 1, background: BLUE, color: "#fff", border: "none", borderRadius: 10, padding: 12, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>📥 Baixar</button>
              {isGestor && <button onClick={() => { confirmar("Excluir esta foto da galeria?", () => { onRemover(fotoExpandida.id); setFotoExpandida(null); }) }} style={{ background: RED, color: "#fff", border: "none", borderRadius: 10, padding: "12px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>🗑️</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════
   EQUIP SOLO
════════════════════════════════════ */

export function TelaMensagens({ usuario, usuarios, mensagens, onBack, onEnviar, onMarcarLida }) {
  const [composicao, setComposicao] = useState(false);
  const [destinatario, setDestinatario] = useState("");
  const [texto, setTexto] = useState("");
  const isGestor = usuario.perfil === "gestor";
  const minhasMsgs = mensagens
    .filter(m => m.para === usuario.id || m.de === usuario.id)
    .sort((a, b) => b.ts - a.ts);

  useEffect(() => {
    mensagens.forEach(m => { if (m.para === usuario.id && !m.lida) onMarcarLida(m.id); });
  }, []);

  const enviar = () => {
    if (!destinatario || !texto.trim()) return;
    onEnviar({ id: Date.now(), de: usuario.id, para: destinatario, texto: texto.trim(), ts: Date.now(), lida: false });
    setTexto(""); setDestinatario(""); setComposicao(false);
  };

  const contatos = isGestor
    ? usuarios.filter(u => u.perfil === "encarregado")
    : usuarios.filter(u => u.perfil === "gestor");

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Mensagens" sub={isGestor ? "Comunique-se com encarregados" : "Avisos do gestor"} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {composicao ? (
          <>
            <label style={labelS}>Para</label>
            <select value={destinatario} onChange={e => setDestinatario(e.target.value)} style={selS}>
              <option value="">Selecione</option>
              {contatos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <label style={labelS}>Mensagem</label>
            <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={5} placeholder="Escreva sua mensagem..." style={{ ...inputS, resize: "none", fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setComposicao(false)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "#eee", color: NAVY, fontWeight: 800, cursor: "pointer" }}>Cancelar</button>
              <button onClick={enviar} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: destinatario && texto.trim() ? GREEN : "#ccc", color: "#fff", fontWeight: 800, cursor: "pointer" }}>📤 Enviar</button>
            </div>
          </>
        ) : (
          <>
            {isGestor && <Btn label="✏️ Nova Mensagem" color={NAVY} onClick={() => setComposicao(true)} style={{ marginBottom: 12 }} />}
            {minhasMsgs.length === 0 && <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", color: "#aaa" }}>📭 Nenhuma mensagem.</div>}
            {minhasMsgs.map(m => {
              const enviada = m.de === usuario.id;
              const outro = usuarios.find(u => u.id === (enviada ? m.para : m.de));
              return (
                <div key={m.id} style={{ background: enviada ? "#dde6f5" : "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, marginLeft: enviada ? 30 : 0, marginRight: enviada ? 0 : 30, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
                    {enviada ? `Para: ${outro?.nome}` : `De: ${outro?.nome}`} • {new Date(m.ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div style={{ fontSize: 14, color: NAVY }}>{m.texto}</div>
                </div>
              );
            })}
          </>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   CALENDÁRIO DE PRESENÇAS
════════════════════════════════════ */

export function TelaLinks({ links, onBack, onAdd, onRemover }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nome: "", url: "", icon: "🔗", cat: "Geral" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Agrupar por categoria
  const grupos = {};
  links.forEach(l => { (grupos[l.cat] = grupos[l.cat] || []).push(l); });

  const ICONS = ["🔗", "🧮", "📐", "💰", "📜", "📊", "💬", "🗺️", "🏛️", "📋", "📞", "📧", "🌐", "⚙️", "📚"];
  const CATEGORIAS = ["Cálculos", "Materiais", "Normas", "Comunicação", "Documentos", "Fornecedores", "Geral"];

  const salvar = () => {
    if (!form.nome || !form.url) return;
    let url = form.url.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    onAdd({ id: Date.now(), ...form, url });
    setForm({ nome: "", url: "", icon: "🔗", cat: "Geral" });
    setModal(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Links Úteis" sub="Atalhos para ferramentas externas" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {Object.keys(grupos).length === 0 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 30, textAlign: "center", color: "#aaa" }}>
            🔗 Nenhum link cadastrado.<br /><span style={{ fontSize: 11 }}>Toque em "Adicionar" para começar.</span>
          </div>
        )}
        {Object.entries(grupos).map(([cat, itens]) => (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>{cat}</div>
            {itens.map(l => (
              <a key={l.id} href={l.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <div style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 6, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer" }}>
                  <div style={{ fontSize: 26, marginRight: 12 }}>{l.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{l.nome}</div>
                    <div style={{ fontSize: 10, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.url}</div>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); confirmar(`Remover "${l.nome}"?`, () => { onRemover(l.id); }); }} style={{ background: "#fee2e2", border: "2px solid #d63b3b", color: "#d63b3b", cursor: "pointer", fontSize: 16, marginRight: 4, padding: "6px 10px", borderRadius: 8, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>
                  <span style={{ color: BLUE, fontSize: 16 }}>↗</span>
                </div>
              </a>
            ))}
          </div>
        ))}

        <Btn label="➕ Adicionar Link" color={NAVY} onClick={() => setModal(true)} style={{ marginTop: 8 }} />
      </div>
      <KMFooter />

      <Modal show={modal} title="Novo Link" onClose={() => setModal(false)}>
        <label style={labelS}>Nome</label>
        <input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: Cotação Concreto Fácil" style={inputS} />
        <label style={labelS}>URL (link)</label>
        <input value={form.url} onChange={e => set("url", e.target.value)} placeholder="https://exemplo.com.br" style={inputS} />
        <label style={labelS}>Categoria</label>
        <select value={form.cat} onChange={e => set("cat", e.target.value)} style={selS}>
          {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
        </select>
        <label style={labelS}>Ícone</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {ICONS.map(i => (
            <button key={i} onClick={() => set("icon", i)} style={{ width: 40, height: 40, fontSize: 20, border: form.icon === i ? `2px solid ${NAVY}` : "1px solid #ddd", borderRadius: 8, background: form.icon === i ? "#dde6f5" : "#fff", cursor: "pointer" }}>{i}</button>
          ))}
        </div>
        <Btn label="✓ ADICIONAR" color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   CONTATOS — Lista telefônica rápida
════════════════════════════════════ */

export function TelaAnexosObra({ obra, usuario, onBack }) {
  const isGestor = usuario && usuario.perfil === "gestor";
  const categorias = isGestor
    ? [...CATEGORIAS_ANEXO_GESTOR, ...CATEGORIAS_ANEXO_ENCARREGADO]
    : CATEGORIAS_ANEXO_ENCARREGADO;

  const [arquivos, setArquivos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroCat, setFiltroCat] = useState("todas");
  const [modalUpload, setModalUpload] = useState(false);
  const [categoriaUpload, setCategoriaUpload] = useState(categorias[0]?.id || "");
  const [descricaoUpload, setDescricaoUpload] = useState("");
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, fase: "" });
  const [quotaInfo, setQuotaInfo] = useState(null);
  const [visualizando, setVisualizando] = useState(null);

  const carregarArquivos = async () => {
    setCarregando(true);
    try {
      const lista = await fileStore.listByObra(obra.id);
      lista.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
      setArquivos(lista);
      const q = await fileStore.getQuotaInfo();
      setQuotaInfo(q);
    } catch (e) {
      console.error("Erro ao carregar anexos:", e);
      alert("Não foi possível carregar os anexos. " + (e.message || ""));
    }
    setCarregando(false);
  };

  useEffect(() => { carregarArquivos(); }, [obra.id]);

  const onSelecionarArquivo = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      alert("⚠️ Arquivo muito grande.\n\nTamanho máximo: 25 MB\nTamanho do arquivo: " + formatarTamanhoBytes(file.size));
      e.target.value = "";
      return;
    }
    setArquivoSelecionado(file);
    if (!descricaoUpload) setDescricaoUpload(file.name.replace(/\.[^.]+$/, ""));
  };

  const fazerUpload = async () => {
    if (!arquivoSelecionado) {
      alert("Selecione um arquivo primeiro.");
      return;
    }
    if (!categoriaUpload) {
      alert("Escolha uma categoria.");
      return;
    }

    try {
      setProgresso({ atual: 30, total: 100, fase: "Lendo arquivo..." });
      const base64 = await lerArquivoComoBase64(arquivoSelecionado);

      setProgresso({ atual: 70, total: 100, fase: "Salvando..." });
      const novoAnexo = {
        id: Date.now() + "_" + Math.random().toString(36).substring(2, 9),
        obraId: obra.id,
        obraNome: obra.nome,
        categoria: categoriaUpload,
        descricao: descricaoUpload.trim() || arquivoSelecionado.name,
        nomeOriginal: arquivoSelecionado.name,
        tamanho: arquivoSelecionado.size,
        mime: arquivoSelecionado.type || "application/octet-stream",
        conteudoBase64: base64,
        uploadedBy: usuario ? usuario.nome : "Desconhecido",
        uploadedByPerfil: usuario ? usuario.perfil : "encarregado",
        uploadedAt: Date.now(),
      };

      await fileStore.save(novoAnexo);

      setProgresso({ atual: 100, total: 100, fase: "Concluído!" });
      setTimeout(() => {
        setProgresso({ atual: 0, total: 0, fase: "" });
        setModalUpload(false);
        setArquivoSelecionado(null);
        setDescricaoUpload("");
        setCategoriaUpload(categorias[0]?.id || "");
        carregarArquivos();
      }, 400);
    } catch (e) {
      console.error("Erro no upload:", e);
      setProgresso({ atual: 0, total: 0, fase: "" });
      if (e.name === "QuotaExceededError" || (e.message && e.message.includes("quota"))) {
        alert("❌ Armazenamento cheio.\n\nApague arquivos antigos para liberar espaço.");
      } else {
        alert("❌ Erro ao salvar: " + (e.message || e));
      }
    }
  };

  const baixarArquivo = (anexo) => {
    try {
      const link = document.createElement("a");
      link.href = anexo.conteudoBase64;
      link.download = anexo.nomeOriginal || "arquivo";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("Erro ao baixar: " + (e.message || e));
    }
  };

  const visualizarArquivo = (anexo) => {
    const ehImagem = (anexo.mime || "").startsWith("image/");
    const ehPdf = anexo.mime === "application/pdf";
    if (ehImagem || ehPdf) {
      setVisualizando(anexo);
    } else {
      baixarArquivo(anexo);
    }
  };

  const excluirArquivo = async (anexo) => {
    const podeExcluir = isGestor || (anexo.uploadedBy === (usuario && usuario.nome));
    if (!podeExcluir) {
      alert("Você só pode excluir anexos que você mesmo enviou.");
      return;
    }
    if (!confirm("Excluir o arquivo \"" + anexo.descricao + "\"?\n\nEsta ação não pode ser desfeita.")) return;
    try {
      await fileStore.delete(anexo.id);
      carregarArquivos();
    } catch (e) {
      alert("Erro ao excluir: " + (e.message || e));
    }
  };

  const arquivosFiltrados = filtroCat === "todas"
    ? arquivos
    : arquivos.filter(a => a.categoria === filtroCat);

  const totalTamanho = arquivos.reduce((s, a) => s + (a.tamanho || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="📎 Anexos da Obra" sub={obra.nome} onBack={onBack} />

      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>📊 Resumo</div>
            {quotaInfo && quotaInfo.total > 0 && (
              <div style={{ fontSize: 10, color: "#888" }}>
                {formatarTamanhoBytes(quotaInfo.usado)} de {formatarTamanhoBytes(quotaInfo.total)} ({quotaInfo.percentual.toFixed(1)}%)
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
            <div><b style={{ color: NAVY }}>{arquivos.length}</b> arquivo(s)</div>
            <div style={{ color: "#666" }}>•</div>
            <div><b style={{ color: NAVY }}>{formatarTamanhoBytes(totalTamanho)}</b> nesta obra</div>
          </div>
        </div>

        <button
          onClick={() => setModalUpload(true)}
          style={{
            width: "100%", padding: 14, background: NAVY, color: "#fff",
            border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14,
            cursor: "pointer", marginBottom: 12, boxShadow: "0 3px 10px rgba(15,33,81,0.25)"
          }}
        >
          ⬆️ ANEXAR NOVO ARQUIVO
        </button>

        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 4 }}>
          <button
            onClick={() => setFiltroCat("todas")}
            style={{
              padding: "8px 14px", borderRadius: 20,
              background: filtroCat === "todas" ? NAVY : "#fff",
              color: filtroCat === "todas" ? "#fff" : NAVY,
              fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
              border: filtroCat === "todas" ? "none" : "1px solid #e5e7eb",
            }}
          >
            Todas ({arquivos.length})
          </button>
          {categorias.map(c => {
            const qtd = arquivos.filter(a => a.categoria === c.id).length;
            if (qtd === 0 && filtroCat !== c.id) return null;
            return (
              <button
                key={c.id}
                onClick={() => setFiltroCat(c.id)}
                style={{
                  padding: "8px 14px", borderRadius: 20,
                  background: filtroCat === c.id ? c.cor : "#fff",
                  color: filtroCat === c.id ? "#fff" : c.cor,
                  fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
                  border: filtroCat === c.id ? "none" : "1px solid " + c.cor + "55",
                }}
              >
                {c.icon} {c.label} ({qtd})
              </button>
            );
          })}
        </div>

        {carregando ? (
          <div style={{ textAlign: "center", padding: 40, color: "#888" }}>Carregando anexos...</div>
        ) : arquivosFiltrados.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 13 }}>
              {arquivos.length === 0
                ? "Nenhum arquivo anexado ainda."
                : "Nenhum arquivo nesta categoria."}
            </div>
          </div>
        ) : (
          arquivosFiltrados.map(a => {
            const cat = categorias.find(c => c.id === a.categoria) || { label: "Outros", icon: "📄", cor: "#6b7280" };
            const podeExcluir = isGestor || (a.uploadedBy === (usuario && usuario.nome));
            return (
              <div key={a.id} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, border: "1px solid #e5e7eb", borderLeft: "4px solid " + cat.cor }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ fontSize: 32 }}>{iconePorTipoArquivo(a.mime, a.nomeOriginal)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: NAVY, fontSize: 13, marginBottom: 3, wordBreak: "break-word" }}>
                      {a.descricao}
                    </div>
                    <div style={{ fontSize: 10, color: "#666", marginBottom: 3, wordBreak: "break-word" }}>
                      📄 {a.nomeOriginal} • {formatarTamanhoBytes(a.tamanho)}
                    </div>
                    <div style={{ fontSize: 10, color: "#888", marginBottom: 6 }}>
                      <span style={{ background: cat.cor + "22", color: cat.cor, padding: "2px 6px", borderRadius: 4, fontWeight: 700, marginRight: 6 }}>
                        {cat.icon} {cat.label}
                      </span>
                      por {a.uploadedBy} • {new Date(a.uploadedAt).toLocaleDateString("pt-BR")}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => visualizarArquivo(a)}
                        style={{ flex: 1, padding: "6px 8px", background: "#eff6ff", color: BLUE, border: "1px solid " + BLUE + "55", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                      >
                        👁️ Ver
                      </button>
                      <button
                        onClick={() => baixarArquivo(a)}
                        style={{ flex: 1, padding: "6px 8px", background: "#dcfce7", color: "#15803d", border: "1px solid #16a34a55", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                      >
                        ⬇️ Baixar
                      </button>
                      {podeExcluir && (
                        <button
                          onClick={() => excluirArquivo(a)}
                          style={{ padding: "6px 10px", background: "#fee2e2", color: RED, border: "1px solid " + RED + "55", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal show={modalUpload} title="⬆️ Anexar Arquivo" onClose={() => { if (!progresso.fase) { setModalUpload(false); setArquivoSelecionado(null); setDescricaoUpload(""); } }}>
        {progresso.fase ? (
          <div style={{ padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⬆️</div>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10 }}>{progresso.fase}</div>
            <div style={{ background: "#e5e7eb", borderRadius: 8, height: 10, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ background: NAVY, height: "100%", width: progresso.atual + "%", transition: "width 0.3s" }}></div>
            </div>
            <div style={{ fontSize: 11, color: "#666" }}>{progresso.atual}%</div>
          </div>
        ) : (
          <>
            <label style={labelS}>Categoria</label>
            <select value={categoriaUpload} onChange={e => setCategoriaUpload(e.target.value)} style={selS}>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>

            <label style={labelS}>Descrição (opcional)</label>
            <input
              value={descricaoUpload}
              onChange={e => setDescricaoUpload(e.target.value)}
              placeholder="Ex: Projeto arquitetônico revisão 02"
              style={inputS}
            />

            <label style={labelS}>Arquivo (máx. 25 MB)</label>
            <input
              type="file"
              onChange={onSelecionarArquivo}
              accept={isGestor
                ? ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.gif,.zip,.rar,.dwg,.dxf,.txt,.csv"
                : ".pdf,.jpg,.jpeg,.png,.webp,.gif"}
              style={{ ...inputS, padding: 8 }}
            />

            {arquivoSelecionado && (
              <div style={{ background: "#eff6ff", borderRadius: 8, padding: 10, marginTop: 6, marginBottom: 10, fontSize: 12, color: "#1e40af" }}>
                <div style={{ fontWeight: 700 }}>{iconePorTipoArquivo(arquivoSelecionado.type, arquivoSelecionado.name)} {arquivoSelecionado.name}</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>{formatarTamanhoBytes(arquivoSelecionado.size)}</div>
              </div>
            )}

            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button onClick={() => { setModalUpload(false); setArquivoSelecionado(null); setDescricaoUpload(""); }} style={{ flex: 1, padding: 11, borderRadius: 8, border: "none", background: "#eee", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Cancelar</button>
              <button onClick={fazerUpload} disabled={!arquivoSelecionado} style={{ flex: 2, padding: 11, borderRadius: 8, border: "none", background: arquivoSelecionado ? NAVY : "#9ca3af", color: "#fff", fontWeight: 700, cursor: arquivoSelecionado ? "pointer" : "not-allowed", fontSize: 12 }}>⬆️ Anexar</button>
            </div>
          </>
        )}
      </Modal>

      {visualizando && (
        <div
          onClick={() => setVisualizando(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 99999,
            display: "flex", flexDirection: "column", padding: 0,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: "#0f2151", padding: "10px 14px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {iconePorTipoArquivo(visualizando.mime, visualizando.nomeOriginal)} {visualizando.descricao}
            </div>
            <button onClick={() => setVisualizando(null)} style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 16, width: 32, height: 32, fontSize: 16, cursor: "pointer", marginLeft: 8 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {(visualizando.mime || "").startsWith("image/") ? (
              <img src={visualizando.conteudoBase64} alt={visualizando.descricao} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            ) : (
              <iframe
                src={visualizando.conteudoBase64}
                style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
                title={visualizando.descricao}
              />
            )}
          </div>
        </div>
      )}

      <KMFooter />
    </div>
  );
}

