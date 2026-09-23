import { useState, useEffect } from "react";
import { NAVY, GOLD, GREEN, RED, ORANGE, LIGHT, labelS, inputS, selS, T } from "../theme.js";
import { KMHeader, KMFooter, EmptyState } from "../components/ui.jsx";
import { TIPOS_AVISO, descreverPara, uidDe } from "../lib/avisosRegras.js";
import { situacaoNotificacoes, ativarNotificacoes, desligarNotificacoes } from "../lib/avisos.js";

/* Avisos: lista do que chegou para a pessoa + (gestor) escrever aviso para todos,
   gestores/diretores, encarregados, uma obra ou uma pessoa. O encarregado só
   escreve para o escritório (gestores). */

const quandoFoi = ms => {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const TEXTO_SITUACAO = {
  ligada:       { cor: GREEN,  txt: "✅ Notificações ligadas neste aparelho." },
  desligada:    { cor: ORANGE, txt: "🔕 Neste aparelho as notificações estão desligadas." },
  bloqueada:    { cor: RED,    txt: "⛔ O navegador bloqueou as notificações do KMZERO. Toque no cadeado ao lado do endereço → Notificações → Permitir." },
  instalar_ios: { cor: ORANGE, txt: "📱 No iPhone, as notificações só chegam com o app instalado: toque em Compartilhar → \"Adicionar à Tela de Início\" e abra o KMZERO pelo ícone." },
  sem_suporte:  { cor: RED,    txt: "Este navegador não recebe notificações. Use o Chrome (Android/PC) ou o app instalado (iPhone)." },
  sem_config:   { cor: "#888", txt: "As notificações no celular ainda não foram configuradas no servidor. Os avisos aparecem aqui no app normalmente." },
};

export function TelaAvisos({ usuario, usuarios = [], obras = [], avisos = [], ultimaLeitura = 0, onEnviar, onMarcarLidos, onNav, onBack }) {
  const gestor = usuario?.perfil === "gestor";
  const eu = uidDe(usuario);
  // "Novo" = chegou depois da última vez que a pessoa abriu esta tela (congelado ao abrir)
  const [leituraAoAbrir] = useState(ultimaLeitura);
  useEffect(() => { onMarcarLidos && onMarcarLidos(); }, [avisos.length]);

  const [situacao, setSituacao] = useState(situacaoNotificacoes());
  const [ligando, setLigando] = useState(false);
  const [msgAparelho, setMsgAparelho] = useState("");
  const ligar = async () => {
    setLigando(true); setMsgAparelho("");
    const r = await ativarNotificacoes(usuario);
    setLigando(false); setSituacao(situacaoNotificacoes());
    setMsgAparelho(r.ok ? "Pronto! Toque em \"Testar\" para ver chegar." : r.erro);
  };
  const desligar = async () => { await desligarNotificacoes(); setSituacao(situacaoNotificacoes()); setMsgAparelho("Desligadas neste aparelho."); };
  const testar = async () => {
    setMsgAparelho("Enviando teste…");
    const r = await onEnviar({ tipo: "teste", titulo: "🔔 Teste do KMZERO", texto: "Se você está vendo isto, as notificações estão funcionando neste aparelho.", para: { tipo: "pessoa", uid: eu } });
    setMsgAparelho(r.ok ? (r.aparelhos ? `Teste enviado para ${r.aparelhos} aparelho(s).` : "Teste gravado, mas nenhum aparelho seu está com notificação ligada.") : r.erro);
  };

  const [escrevendo, setEscrevendo] = useState(false);
  const [paraTipo, setParaTipo] = useState(gestor ? "todos" : "gestores");
  const [paraObra, setParaObra] = useState(obras[0]?.id ?? "");
  const [paraPessoa, setParaPessoa] = useState("");
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState("");
  const pessoas = usuarios.filter(u => u.ativo !== false && uidDe(u) !== eu && !u.convite);

  const enviar = async () => {
    if (!titulo.trim()) return setResultado("Escreva o título do aviso.");
    const para = !gestor ? { tipo: "gestores" }
      : paraTipo === "obra" ? { tipo: "obra", obraId: paraObra }
      : paraTipo === "pessoa" ? { tipo: "pessoa", uid: paraPessoa }
      : { tipo: paraTipo };
    if (para.tipo === "pessoa" && !para.uid) return setResultado("Escolha a pessoa.");
    setEnviando(true); setResultado("");
    const r = await onEnviar({ tipo: "manual", titulo: titulo.trim(), texto: texto.trim(), para });
    setEnviando(false);
    if (r.ok) {
      setResultado(r.aparelhos !== undefined ? `✅ Enviado: ${r.pessoas || 0} pessoa(s), tocou em ${r.aparelhos} aparelho(s).` : "✅ Aviso publicado.");
      setTitulo(""); setTexto(""); setEscrevendo(false);
    } else setResultado("⚠️ Aviso publicado no app. " + r.erro);
  };

  const card = { background: T.superficie, borderRadius: 14, padding: 14, boxShadow: T.sombra, marginBottom: 12 };
  const btn = (bg, cor = "#fff") => ({ background: bg, color: cor, border: "none", borderRadius: 10, padding: "10px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" });
  const sit = TEXTO_SITUACAO[situacao];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Avisos" sub="Notificações da equipe" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: T.fundo, padding: 14 }}>
        <div style={{ maxWidth: 720 }}>
          {/* Este aparelho */}
          <div style={{ ...card, borderLeft: `4px solid ${sit.cor}` }}>
            <div style={{ fontSize: 13, color: T.titulo, lineHeight: 1.45 }}>{sit.txt}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {situacao === "desligada" && <button onClick={ligar} disabled={ligando} style={btn(NAVY)}>{ligando ? "Ligando…" : "🔔 Ativar notificações"}</button>}
              {situacao === "ligada" && <button onClick={testar} style={btn(NAVY)}>Testar</button>}
              {situacao === "ligada" && <button onClick={desligar} style={btn("#eee", NAVY)}>Desligar neste aparelho</button>}
            </div>
            {msgAparelho && <div style={{ fontSize: 12, color: T.texto2, marginTop: 8 }}>{msgAparelho}</div>}
          </div>

          {/* Escrever */}
          {!escrevendo ? (
            <button onClick={() => { setEscrevendo(true); setResultado(""); }} style={{ ...btn(GOLD, NAVY), width: "100%", marginBottom: 12, padding: "12px 14px" }}>
              {gestor ? "✏️ Novo aviso" : "✏️ Avisar o escritório"}
            </button>
          ) : (
            <div style={card}>
              {gestor ? (
                <>
                  <label style={labelS}>Para quem</label>
                  <select value={paraTipo} onChange={e => setParaTipo(e.target.value)} style={selS}>
                    <option value="todos">Todos</option>
                    <option value="gestores">Gestores e diretores</option>
                    <option value="encarregados">Encarregados</option>
                    <option value="obra">Uma obra</option>
                    <option value="pessoa">Uma pessoa</option>
                  </select>
                  {paraTipo === "obra" && (
                    <select value={paraObra} onChange={e => setParaObra(e.target.value)} style={selS}>
                      {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                  )}
                  {paraTipo === "pessoa" && (
                    <select value={paraPessoa} onChange={e => setParaPessoa(e.target.value)} style={selS}>
                      <option value="">Escolha…</option>
                      {pessoas.map(u => <option key={uidDe(u)} value={uidDe(u)}>{u.nome} ({u.perfil === "gestor" ? "gestor" : "encarregado"})</option>)}
                    </select>
                  )}
                </>
              ) : <div style={{ fontSize: 12, color: T.texto2, marginBottom: 8 }}>Vai para os gestores e diretores.</div>}
              <label style={labelS}>Título</label>
              <input value={titulo} onChange={e => setTitulo(e.target.value.slice(0, 80))} placeholder="Ex.: Reunião amanhã às 7h no canteiro" style={inputS} />
              <label style={labelS}>Mensagem (opcional)</label>
              <textarea value={texto} onChange={e => setTexto(e.target.value.slice(0, 500))} rows={3} placeholder="Detalhes do aviso" style={{ ...inputS, fontFamily: "inherit", resize: "vertical" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={enviar} disabled={enviando} style={{ ...btn(NAVY), flex: 1 }}>{enviando ? "Enviando…" : "Enviar aviso"}</button>
                <button onClick={() => setEscrevendo(false)} style={btn("#eee", NAVY)}>Cancelar</button>
              </div>
            </div>
          )}
          {resultado && <div style={{ fontSize: 12, color: T.titulo, margin: "-4px 0 12px" }}>{resultado}</div>}

          {/* Lista */}
          {avisos.length === 0 && <EmptyState icon="🔔" titulo="Nenhum aviso ainda" subtitulo="Os avisos da equipe e os alertas automáticos aparecem aqui." />}
          {avisos.map(a => {
            const tipo = TIPOS_AVISO[a.tipo] || TIPOS_AVISO.manual;
            const novo = a.criadoEm > leituraAoAbrir && a.de !== eu;
            return (
              <div key={a.id} style={{ ...card, borderLeft: `4px solid ${novo ? GOLD : "transparent"}` }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 20, lineHeight: 1 }}>{tipo.icone}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: NAVY, fontSize: 14 }}>{a.titulo}{novo && <span style={{ marginLeft: 6, fontSize: 10, background: GOLD, color: NAVY, borderRadius: 6, padding: "1px 6px" }}>NOVO</span>}</div>
                    {a.texto && <div style={{ fontSize: 13, color: T.texto, whiteSpace: "pre-wrap", marginTop: 4, lineHeight: 1.45 }}>{a.texto}</div>}
                    <div style={{ fontSize: 11, color: T.texto2, marginTop: 6 }}>
                      {a.de === eu ? "Você" : a.deNome || "KMZERO"} → {descreverPara(a.para, { obras, usuarios })} · {quandoFoi(a.criadoEm)}
                      {a.de === eu && a.push?.aparelhos !== undefined && ` · tocou em ${a.push.aparelhos} aparelho(s)`}
                    </div>
                    {a.navegarPara && onNav && <button onClick={() => onNav(a.navegarPara)} style={{ ...btn(LIGHT, NAVY), marginTop: 8, padding: "6px 10px", fontSize: 12 }}>Abrir →</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <KMFooter />
    </div>
  );
}

// Sininho do cabeçalho (celular): abre os Avisos e mostra quantos não foram vistos
export function SinoAvisos({ n = 0, onClick }) {
  return (
    <button onClick={onClick} aria-label={n ? `${n} aviso(s) novo(s)` : "Avisos"} style={{ position: "relative", background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 18, width: 36, height: 36, cursor: "pointer", fontSize: 16, flexShrink: 0 }}>
      🔔
      {n > 0 && <span style={{ position: "absolute", top: -2, right: -2, background: RED, color: "#fff", borderRadius: 10, padding: "1px 5px", fontSize: 9, fontWeight: 800 }}>{n > 99 ? "99+" : n}</span>}
    </button>
  );
}
