import { useState, useEffect } from "react";
import { entrarComGoogle } from "../firebase.js";
import { NAVY, GOLD, GREEN, RED, BLUE, LIGHT, labelS, inputS, selS, T, ESCURO, DEFAULT_FONT, DISPLAY_FONT } from "../theme.js";
import { criarConvite, removerConvite, atualizarPerfilNuvem, definirAcessoAtivo } from "../lib/store.js";
import { Btn, KMHeader, KMFooter, Modal, LogoKM, AvatarUsuario } from "../components/ui.jsx";
import { Icone } from "../components/Icones.jsx";
import { useTema, OPCOES_TEMA } from "../lib/useTema.js";
import { useModoEscritorio } from "../lib/useLargura.js";
import { GRUPOS_MENU, AREAS_ACESSO, AREA_FIXA, PRESETS_ACESSOS, normalizarAcessos, presetDosAcessos, resumoAcessos } from "../components/menuGrupos.js";

// Versão do package.json (define do Vite); vazio se o build não injetar
const VERSAO_APP = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "";

/* ════════════════════════════════════════════════════════════════════════
   ENTRADA — "engenharia à noite": paleta ESCURO fixa nos dois temas, malha de
   planta e brilho teal (os mesmos da vitrine), LogoKM, ouro só na ação.
   A moldura (MolduraEntrada) é a mesma para Entrar, Primeiro acesso e Registro:
   no PC (>= 1024 px) painel dividido 58/42, no celular uma coluna.
════════════════════════════════════════════════════════════════════════ */
export const WHATSAPP_KM = "5528999258172";
export const TELEFONE_KM = "(28) 99925-8172";
export const linkSuporte = texto => `https://wa.me/${WHATSAPP_KM}?text=${encodeURIComponent(texto)}`;

const ARGUMENTOS = [
  { icone: "camera", texto: "Presença, fotos carimbadas e RDO em PDF no canteiro", curto: "Fotos e RDO no canteiro" },
  { icone: "trending-up", texto: "Folha por ciclo, pedidos com aprovação, cronograma e curva S no escritório", curto: "Folha e pedidos no escritório" },
  { icone: "shield-check", texto: "Funciona sem sinal · dados separados por empresa", curto: "Funciona sem sinal" },
];

/* CSS da entrada numa constante de módulo, injetada UMA vez no <head> (como o menu).
   Cores fixas de propósito: a entrada é sempre escura, não segue o tema. */
const CSS_ENTRADA = `
.km-entrada-tela { position: relative; flex: 1; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; overflow: hidden; color: ${ESCURO.texto}; background: linear-gradient(160deg, #081a21 0%, #052f3d 55%, #0b7285 140%); }
.km-entrada-tela::before { content: ""; position: absolute; inset: 0; pointer-events: none; background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 32px), repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 32px); }
.km-entrada-tela::after { content: ""; position: absolute; top: -220px; right: -180px; width: 720px; height: 620px; pointer-events: none; background: radial-gradient(closest-side, rgba(11,114,133,0.38), rgba(11,114,133,0)); }
.km-entrada-miolo { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; }
.km-entrada-coluna { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 28px 16px 12px; }
.km-entrada-painel { flex: 1; width: 100%; max-width: 1180px; margin: 0 auto; box-sizing: border-box; padding: 48px 40px 32px; display: grid; grid-template-columns: 58fr 42fr; gap: 56px; align-items: center; }
.km-entrada-painel > * { min-width: 0; }
.km-entrada-cartao { width: 100%; max-width: 420px; box-sizing: border-box; background: ${ESCURO.cartao}; border: 1px solid ${ESCURO.borda}; border-radius: 20px; padding: 24px 20px; box-shadow: var(--km-sombra2, 0 20px 60px rgba(0,0,0,0.5)); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
.km-entrada-painel .km-entrada-cartao { padding: 28px; }
.km-entrada-titulo { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.01em; color: ${ESCURO.texto}; }
.km-entrada-sub { margin: 6px 0 18px; font-size: 13px; line-height: 1.55; color: ${ESCURO.texto2}; }
.km-entrada-sub b { color: ${ESCURO.texto}; font-weight: 700; }
.km-entrada-ajuda { font-size: 12px; line-height: 1.6; color: ${ESCURO.texto2}; margin-top: 18px; }
.km-entrada-ajuda p { margin: 0 0 8px; }
.km-entrada-ajuda p:last-child { margin-bottom: 0; }
.km-entrada-ajuda b { color: ${ESCURO.texto}; }
.km-entrada-headline { font-family: ${DISPLAY_FONT}; font-size: clamp(34px, 3.6vw, 50px); font-weight: 800; line-height: 1.04; letter-spacing: -0.02em; color: ${ESCURO.texto}; margin: 28px 0 22px; }
.km-entrada-args { list-style: none; margin: 0; padding: 0; }
.km-entrada-arg { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 14px; font-size: 15px; line-height: 1.5; color: rgba(247,251,252,0.82); }
.km-entrada-arg-ico { width: 36px; height: 36px; flex: none; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid ${ESCURO.borda}; display: inline-flex; align-items: center; justify-content: center; color: ${ESCURO.texto}; }
.km-entrada-assina { margin-top: 26px; font-size: 13px; color: ${ESCURO.texto2}; }
.km-entrada-selos { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 8px; max-width: 420px; }
.km-entrada-selos li { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: rgba(247,251,252,0.72); padding: 5px 10px; border-radius: 999px; border: 1px solid ${ESCURO.borda}; background: rgba(255,255,255,0.04); }
.km-entrada-rodape { position: relative; z-index: 1; padding: 12px 16px; padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px)); text-align: center; font-size: 12px; line-height: 1.7; color: rgba(247,251,252,0.55); }
.km-entrada-rodape a { color: rgba(247,251,252,0.78); text-decoration: none; border-bottom: 1px solid rgba(247,251,252,0.25); }
.km-entrada-rodape a:hover { color: ${ESCURO.texto}; border-bottom-color: ${ESCURO.texto}; }
.km-entrada-link { display: inline-block; background: none; border: none; padding: 4px 0; font-family: inherit; font-size: 12px; color: ${ESCURO.texto2}; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.km-entrada-link:hover { color: ${ESCURO.texto}; }
.km-entrada-google { width: 100%; min-height: 48px; border: none; border-radius: 12px; background: #fff; color: #1f1f1f; font-family: inherit; font-size: 15px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 12px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.25); transition: transform 120ms ease, box-shadow 120ms ease; }
.km-entrada-google:hover:not(:disabled) { box-shadow: 0 6px 18px rgba(0,0,0,0.35); transform: translateY(-1px); }
.km-entrada-google:disabled { cursor: default; opacity: 0.88; }
.km-entrada-google:focus-visible, .km-entrada-btn:focus-visible, .km-entrada-link:focus-visible, .km-entrada-input:focus-visible, .km-entrada-secao:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
.km-entrada-spinner { width: 16px; height: 16px; flex: none; box-sizing: border-box; border-radius: 50%; border: 2px solid rgba(31,31,31,0.2); border-top-color: #1f1f1f; animation: kmEntradaGira 0.8s linear infinite; }
.km-entrada-btn { width: 100%; min-height: 48px; box-sizing: border-box; border-radius: 12px; padding: 10px 16px; font-family: inherit; font-size: 14px; font-weight: 700; line-height: 1.3; text-align: center; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; transition: background 120ms ease, border-color 120ms ease, color 120ms ease; }
.km-entrada-btn + .km-entrada-btn { margin-top: 10px; }
.km-entrada-btn-ouro { background: ${GOLD}; color: ${NAVY}; border: none; font-weight: 800; }
.km-entrada-btn-ouro:hover:not(:disabled) { background: #ffc554; }
.km-entrada-btn-contorno { background: transparent; color: ${ESCURO.texto}; border: 1.5px solid rgba(255,255,255,0.35); }
.km-entrada-btn-contorno:hover:not(:disabled) { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.6); }
.km-entrada-btn-texto { background: transparent; border: none; color: ${ESCURO.texto2}; min-height: 40px; font-weight: 600; }
.km-entrada-btn-texto:hover:not(:disabled) { color: ${ESCURO.texto}; }
.km-entrada-btn:disabled { cursor: default; opacity: 0.6; }
.km-entrada-btn-mini { width: auto; min-height: 32px; font-size: 12px; padding: 6px 12px; border-radius: 8px; }
.km-entrada-btn-mini + .km-entrada-btn-mini { margin-top: 0; }
.km-entrada-aviso { border-radius: 12px; padding: 12px 14px; font-size: 13px; line-height: 1.55; margin-top: 14px; border: 1px solid; }
.km-entrada-aviso[data-tom="erro"] { background: rgba(239,71,111,0.14); border-color: rgba(239,71,111,0.45); color: #ffc2d1; }
.km-entrada-aviso[data-tom="aviso"] { background: rgba(255,159,28,0.14); border-color: rgba(255,159,28,0.5); color: #ffd9a8; }
.km-entrada-aviso[data-tom="info"] { background: rgba(11,114,133,0.3); border-color: rgba(63,193,214,0.45); color: #d5f3f8; }
.km-entrada-aviso code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; background: rgba(0,0,0,0.25); padding: 2px 6px; border-radius: 6px; white-space: nowrap; }
.km-entrada-acoes { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.km-entrada-aviso .km-entrada-btn-contorno { color: #fff; border-color: rgba(255,255,255,0.4); }
.km-entrada-email { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 16px; padding: 12px 14px; border-radius: 12px; background: rgba(0,0,0,0.22); border: 1px solid ${ESCURO.borda}; }
.km-entrada-email strong { flex: 1 1 160px; min-width: 0; font-size: 14px; font-weight: 700; color: ${ESCURO.texto}; word-break: break-all; }
.km-entrada-email .km-entrada-acoes { margin-top: 0; }
.km-entrada-label { display: block; font-size: 12px; font-weight: 600; color: rgba(247,251,252,0.78); margin-bottom: 6px; }
.km-entrada-input { width: 100%; box-sizing: border-box; min-height: 46px; padding: 12px 14px; border-radius: 12px; border: 1.5px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.08); color: ${ESCURO.texto}; font-family: inherit; font-size: 15px; margin-bottom: 12px; outline: none; }
.km-entrada-input::placeholder { color: rgba(247,251,252,0.45); }
.km-entrada-input:focus { border-color: rgba(255,184,48,0.7); background: rgba(255,255,255,0.1); }
.km-entrada-secao { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; background: transparent; border: none; border-top: 1px solid ${ESCURO.borda}; color: rgba(247,251,252,0.78); font-family: inherit; font-size: 13px; font-weight: 700; padding: 12px 0; margin: 4px 0 6px; cursor: pointer; text-align: left; }
.km-entrada-secao:hover { color: ${ESCURO.texto}; }
.km-entrada-secao-corpo { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 150ms ease; }
.km-entrada-secao-corpo[data-aberta="1"] { grid-template-rows: 1fr; }
.km-entrada-secao-corpo > div { overflow: hidden; min-height: 0; }
.km-entrada-secao-corpo[data-aberta="0"] > div { visibility: hidden; }
.km-entrada-nota { font-size: 11px; line-height: 1.5; color: ${ESCURO.texto2}; margin-top: 16px; text-align: center; }
@keyframes kmEntradaGira { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .km-entrada-google, .km-entrada-btn, .km-entrada-secao-corpo { transition: none !important; }
  .km-entrada-spinner { animation-duration: 1.6s; }
}
`;

let cssEntradaInjetado = false;
function injetarCSSEntrada() {
  if (cssEntradaInjetado || typeof document === "undefined") return;
  cssEntradaInjetado = true;
  if (document.getElementById("km-entrada-css")) return;
  const s = document.createElement("style");
  s.id = "km-entrada-css";
  s.textContent = CSS_ENTRADA;
  document.head.appendChild(s);
}

function RodapeEntrada() {
  return (
    <footer className="km-entrada-rodape">
      KMZERO Obras · KM Consultoria · Alegre/ES ·{" "}
      <a href={linkSuporte("Olá, KM! Preciso de ajuda para entrar no KMZERO.")} target="_blank" rel="noopener noreferrer" style={{ whiteSpace: "nowrap" }}>Suporte {TELEFONE_KM}</a> ·{" "}
      <a href="/?site">Conhecer o KMZERO</a>
      {VERSAO_APP && <> · v{VERSAO_APP}</>}
    </footer>
  );
}

/* Moldura das telas de entrada. O painel dividido depende SÓ da largura
   (useModoEscritorio): aqui não há sessão nem contexto de escritório — é a
   página pública do app, e o KMZeroApp usa o mesmo hook para tirar a coluna de
   420 px nessas três telas. */
export function MolduraEntrada({ children }) {
  injetarCSSEntrada();
  const pc = useModoEscritorio();
  return (
    <div className="km-entrada-tela" style={{ fontFamily: DEFAULT_FONT }}>
      <div className="km-entrada-miolo">
        {pc ? (
          <div className="km-entrada-painel">
            <div>
              <LogoKM tamanho={64} />
              <div className="km-entrada-headline">A obra no celular.<br />O escritório na hora.</div>
              <ul className="km-entrada-args">
                {ARGUMENTOS.map(a => (
                  <li key={a.icone} className="km-entrada-arg">
                    <span className="km-entrada-arg-ico" aria-hidden="true"><Icone nome={a.icone} tamanho={18} /></span>
                    <span>{a.texto}</span>
                  </li>
                ))}
              </ul>
              <div className="km-entrada-assina">KM Consultoria · Eng. Kleber Vieira Martins, CREA-ES · Alegre/ES</div>
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div className="km-entrada-cartao">{children}</div>
            </div>
          </div>
        ) : (
          <div className="km-entrada-coluna">
            <LogoKM tamanho={44} style={{ alignItems: "center", marginBottom: 18 }} />
            <div className="km-entrada-cartao">{children}</div>
            <ul className="km-entrada-selos" aria-label="O que o KMZERO faz">
              {ARGUMENTOS.map(a => (
                <li key={a.icone}><Icone nome={a.icone} tamanho={13} /> {a.curto}</li>
              ))}
            </ul>
          </div>
        )}
        <RodapeEntrada />
      </div>
    </div>
  );
}

function IconeGoogle() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.8-6.8C35.7 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.3 0 20 0 24s.9 7.7 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.7-2 15.4-5.6l-7.5-5.8c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.6-4-13.5-9.7l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/* Botão único da entrada: branco 48 px com o G oficial (padrão Google, nada de ouro).
   Carregando = spinner no lugar do G + "Abrindo o Google…" + aria-busy. */
function BotaoGoogle({ carregando, onClick }) {
  return (
    <button type="button" className="km-entrada-google" onClick={onClick} disabled={carregando} aria-busy={carregando || undefined}>
      {carregando ? <span className="km-entrada-spinner" aria-hidden="true" /> : <IconeGoogle />}
      {carregando ? "Abrindo o Google…" : "Entrar com o Google"}
    </button>
  );
}

/* ── AvisoEntrada ──
   Todo erro/aviso da entrada passa por aqui (role="alert"; nunca alert()).
   `aviso` = string | { codigo, mensagem, email, tom, suporte }. O código decide o
   texto humano; `mensagem` é o texto de reserva (traduzErroFirebase / store.js). */
export function normalizarAviso(x) {
  if (!x) return null;
  if (typeof x === "string") return { codigo: "", mensagem: x };
  return { codigo: x.codigo || "", mensagem: x.mensagem || x.erro || "", email: x.email || "", tom: x.tom, suporte: x.suporte };
}

const TEXTO_GENERICO = "Não foi possível entrar. Tente de novo; se continuar, fale com o suporte.";

function detalharAviso(aviso) {
  const { codigo = "", mensagem = "", email = "" } = aviso;
  const d = { tom: "erro", texto: mensagem || TEXTO_GENERICO, mostrarCodigo: !!codigo, suporte: true, outraConta: false, gestor: false };
  switch (codigo) {
    case "sem-internet":
    case "auth/network-request-failed":
      Object.assign(d, { tom: "aviso", texto: "Você está sem internet. O primeiro acesso precisa de sinal; depois o app abre offline.", mostrarCodigo: false, suporte: false });
      break;
    case "redirecionando":
      Object.assign(d, { tom: "info", texto: "Abrindo o Google em outra página…", mostrarCodigo: false, suporte: false });
      break;
    case "auth/unauthorized-domain":
    case "auth/operation-not-allowed":
      Object.assign(d, { texto: "O KMZERO ainda não está liberado para este endereço. Avise o suporte." });
      break;
    case "acesso-desativado":
      Object.assign(d, { texto: `O acesso de ${email || "sua conta"} foi desativado pelo gestor da empresa.`, mostrarCodigo: false, suporte: false, outraConta: true, gestor: true });
      break;
    case "permission-denied":
      Object.assign(d, { texto: "A nuvem recusou o acesso. Avise o suporte." });
      break;
    case "redirect-sem-usuario":
      Object.assign(d, { texto: "O Google não devolveu a conta. Tente de novo ou use outro navegador.", mostrarCodigo: false, suporte: false });
      break;
    case "auth/too-many-requests":
    case "auth/internal-error":
    case "auth/account-exists-with-different-credential":
      Object.assign(d, { mostrarCodigo: false, suporte: false });
      break;
    case "sem-cadastro":
    case "validacao":
      Object.assign(d, { tom: "aviso", mostrarCodigo: false, suporte: false });
      break;
    default:
      break;
  }
  if (aviso.tom) d.tom = aviso.tom;
  if (aviso.suporte !== undefined) d.suporte = aviso.suporte;
  return d;
}

export function AvisoEntrada({ aviso, onOutraConta }) {
  const a = normalizarAviso(aviso);
  if (!a) return null;
  const d = detalharAviso(a);
  const codigo = a.codigo || "desconhecido";
  const temAcoes = d.suporte || d.outraConta || d.gestor;
  return (
    <div className="km-entrada-aviso" role="alert" data-tom={d.tom}>
      <div>{d.texto}{d.mostrarCodigo && <> <code>{a.codigo}</code></>}</div>
      {temAcoes && (
        <div className="km-entrada-acoes">
          {d.outraConta && onOutraConta && (
            <button type="button" className="km-entrada-btn km-entrada-btn-contorno km-entrada-btn-mini" onClick={onOutraConta}>Entrar com outra conta</button>
          )}
          {d.gestor && (
            <a className="km-entrada-btn km-entrada-btn-contorno km-entrada-btn-mini" href={`https://wa.me/?text=${encodeURIComponent(`Meu acesso ao KMZERO foi desativado (${a.email || "meu e-mail"}). Pode reativar?`)}`} target="_blank" rel="noopener noreferrer">Falar com o gestor</a>
          )}
          {d.suporte && (
            <a className="km-entrada-btn km-entrada-btn-contorno km-entrada-btn-mini" href={linkSuporte(`KMZERO erro ${codigo}`)} target="_blank" rel="noopener noreferrer">Falar com o suporte</a>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ENTRAR — uma tela só: "Entrar com o Google".
   O app decide sozinho o que fazer depois (onGoogle): gestor, equipe,
   convite pendente ou primeiro acesso.
════════════════════════════════════════════════════════════════════════ */
export function TelaEntrar({ onGoogle, erroInicial = "" }) {
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState(() => normalizarAviso(erroInicial));
  const [semInternet, setSemInternet] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);

  // Erro que chega depois (volta do redirect, acesso desativado conferido em segundo plano)
  useEffect(() => { if (erroInicial) setAviso(normalizarAviso(erroInicial)); }, [erroInicial]);
  useEffect(() => {
    const on = () => setSemInternet(false);
    const off = () => setSemInternet(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const entrar = async () => {
    if (carregando) return;
    setAviso(null);
    setCarregando(true);
    const r = await entrarComGoogle();
    if (!r.ok) {
      setCarregando(false);
      if (!r.cancelado) setAviso({ codigo: r.codigo || "", mensagem: r.erro || "" });
      return;
    }
    if (r.redirecionando) { setAviso({ codigo: "redirecionando" }); return; } // a página vai sair para o Google e voltar
    const fim = await onGoogle(r.user);
    setCarregando(false);
    if (fim && !fim.ok && (fim.erro || fim.codigo)) setAviso({ codigo: fim.codigo || "", mensagem: fim.erro || "", email: fim.email || "" });
  };

  // Sem internet (antes do clique) só avisa; o botão continua ativo porque navigator.onLine erra às vezes
  const avisoVisivel = aviso || (semInternet ? { codigo: "sem-internet" } : null);

  return (
    <MolduraEntrada>
      <h1 className="km-entrada-titulo">Entrar no KMZERO</h1>
      <p className="km-entrada-sub">Use sua conta Google. Não existe senha do KMZERO para decorar.</p>

      <BotaoGoogle carregando={carregando} onClick={entrar} />
      <AvisoEntrada aviso={avisoVisivel} onOutraConta={entrar} />

      <div className="km-entrada-ajuda">
        <p><b>Primeira vez?</b> Entre com o Google. Se o seu e-mail ainda não estiver em nenhuma empresa, você poderá criar a sua.</p>
        <p><b>Faz parte de uma equipe?</b> O gestor cadastra o seu e-mail em Sistema → Usuários e acessos. Entre com esse mesmo e-mail (Gmail ou e-mail da empresa no Google).</p>
      </div>
      <div style={{ marginTop: 14, textAlign: "center" }}>
        <a className="km-entrada-link" href="/app/?demo=1">Só quero ver como funciona → demonstração</a>
      </div>
    </MolduraEntrada>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   PRIMEIRO ACESSO — entrou com o Google, mas o e-mail ainda não está em
   nenhuma empresa nem tem convite. Hierarquia: criar empresa (ouro) >
   verificar de novo (contorno) > sair (texto).
════════════════════════════════════════════════════════════════════════ */
export function TelaPrimeiroAcesso({ usuarioGoogle, onCriarEmpresa, onVerificar, onSair }) {
  const [verificando, setVerificando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const email = usuarioGoogle?.email || "";
  const primeiroNome = String(usuarioGoogle?.nome || "").trim().split(/\s+/)[0] || "";

  const verificar = async () => {
    if (verificando) return;
    setAviso(null);
    setVerificando(true);
    const r = await onVerificar();
    setVerificando(false);
    if (r && r.semConvite) setAviso({ codigo: "sem-cadastro", mensagem: `Ainda não há cadastro para ${email}. Peça ao gestor para conferir se cadastrou exatamente este e-mail.` });
    else if (r && !r.ok && (r.erro || r.codigo)) setAviso({ codigo: r.codigo || "", mensagem: r.erro || "", email: r.email || email });
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // sem clipboard (http antigo / iframe): o e-mail está visível para copiar à mão
    }
  };
  const linkGestor = `https://wa.me/?text=${encodeURIComponent(`Cadastre meu e-mail no KMZERO: ${email}`)}`;

  return (
    <MolduraEntrada>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <AvatarUsuario usuario={usuarioGoogle} tamanho={44} />
        <div style={{ minWidth: 0 }}>
          <h1 className="km-entrada-titulo" style={{ fontSize: 20, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{primeiroNome ? `Olá, ${primeiroNome}` : "Olá"}</h1>
          <div style={{ fontSize: 12, color: ESCURO.texto2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
        </div>
      </div>
      <p className="km-entrada-sub">O e-mail <b>{email}</b> ainda não está em nenhuma empresa do KMZERO.</p>

      <button type="button" className="km-entrada-btn km-entrada-btn-ouro" onClick={onCriarEmpresa}>
        Sou o gestor — criar minha empresa
      </button>
      <button type="button" className="km-entrada-btn km-entrada-btn-contorno" onClick={verificar} disabled={verificando} aria-busy={verificando || undefined}>
        {verificando ? "Verificando…" : "Fui cadastrado por uma empresa — verificar de novo"}
      </button>
      <button type="button" className="km-entrada-btn km-entrada-btn-texto" onClick={onSair} disabled={verificando}>
        Sair e usar outra conta
      </button>

      <AvisoEntrada aviso={aviso} onOutraConta={onSair} />

      <div className="km-entrada-email">
        <strong>{email}</strong>
        <div className="km-entrada-acoes">
          <button type="button" className="km-entrada-btn km-entrada-btn-contorno km-entrada-btn-mini" onClick={copiar} aria-live="polite">{copiado ? "Copiado" : "Copiar"}</button>
          <a className="km-entrada-btn km-entrada-btn-contorno km-entrada-btn-mini" href={linkGestor} target="_blank" rel="noopener noreferrer">Mandar para o gestor</a>
        </div>
      </div>

      <div className="km-entrada-nota">Em fase de lançamento · Fale com a KM: <span style={{ whiteSpace: "nowrap" }}>{TELEFONE_KM}</span></div>
    </MolduraEntrada>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ACESSOS DO APP — o gestor cadastra o Gmail de cada pessoa (convite).
   Quando a pessoa entra com esse Gmail, o convite vira perfil.
════════════════════════════════════════════════════════════════════════ */
const CARGOS_ACESSO = ["Encarregado", "Apontador", "Mestre de Obras", "Técnico", "Supervisor", "Engenheiro", "Administrativo", "Outro"];

/* ── Áreas do escritório ──
   Perfil "gestor" = escritório. O campo `acessos` do perfil/convite limita o que a
   pessoa abre: ids de GRUPO do menu; ausente/null = Tudo (os gestores de antes seguem
   iguais). O encarregado ignora o campo. Pacotes, normalização e resumo vêm de
   menuGrupos.js (fonte única: menu, guarda de navegação e &acessos= da demo usam os
   mesmos). Caixas e nomes saem de GRUPOS_MENU: grupo novo no menu aparece aqui sozinho. */
const GRUPOS_ACESSO = GRUPOS_MENU.filter(g => AREAS_ACESSO.includes(g.id));
const TITULO_AREA = Object.fromEntries(GRUPOS_ACESSO.map(g => [g.id, g.titulo]));
// Texto só para leitor de tela (o .km-sr-only vem do CSS do menu, que não existe no celular)
const SO_LEITOR = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 };
const NOTA_PRESET = { financeiro: "Equipe e Suprimentos entram porque folha, adiantamentos e pedidos são custo." };

// O que vai para a nuvem: null = Tudo (também com todas marcadas, para um grupo novo entrar sozinho)
const acessosParaGravar = acessos => {
  const a = normalizarAcessos(acessos);
  return !a || a.length === AREAS_ACESSO.length ? null : a;
};

// "Visão geral, Financeiro e Equipe" (null = todas)
const nomesDasAreas = acessos => {
  const nomes = (acessosParaGravar(acessos) || AREAS_ACESSO).map(id => TITULO_AREA[id]);
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : (nomes[0] || "");
};

// Opção marcada na tela para estas áreas: id do pacote pronto ou "personalizado"
const presetDaTela = acessos => acessosParaGravar(acessos) === null ? "tudo" : (presetDosAcessos(acessos)?.id || "personalizado");

const OPCOES_AREAS = [...PRESETS_ACESSOS, { id: "personalizado", titulo: "Personalizado" }];
const detalheOpcao = p =>
  p.id === "tudo" ? "Todas as áreas, inclusive Sistema (empresa, usuários e backup)."
  : p.id === "personalizado" ? "Você marca as áreas uma a uma."
  : `${nomesDasAreas(p.acessos)}.`;

/* `demo`: modo demonstração — a lista é ilustrativa (sem nuvem não há convite nem
   perfil para gravar). Adicionar e Editar abrem o formulário de verdade, mas o salvar só
   SIMULA (mostra como o acesso ficaria e fecha, sem chamar a nuvem); desativar some.
   `donoUid`: uid de quem criou a empresa (empresas/{id}.gestorUid; na demo, o visitante).
   O cartão do dono e o da própria pessoa ficam com tipo e áreas travados: ninguém limita,
   rebaixa nem desativa o dono, e ninguém mexe no próprio acesso (as regras também recusam). */
export function TelaAcessosApp({ usuario, usuarios = [], obras = [], empresa, demo = false, donoUid = null, onBack }) {
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  // acessos: null = Tudo; preset: atalho marcado na tela (só vale para o escritório)
  const formVazio = { nome: "", email: "", cargo: "Encarregado", obraId: "", perfil: "encarregado", tel: "", acessos: null, preset: "tudo" };
  const [form, setForm] = useState(formVazio);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const meuUid = usuario?.firebaseUid || usuario?.id;
  const meuEmail = (usuario?.email || "").toLowerCase();
  // A pessoa não aparece na própria lista (nem o convite do próprio e-mail): ninguém mexe no próprio acesso
  const lista = usuarios.filter(u => !(u.firebaseUid && u.firebaseUid === meuUid) && !(u.convite && meuEmail && (u.email || "").toLowerCase() === meuEmail));
  const ehDono = u => !!u && !!donoUid && !u.convite && (u.firebaseUid || u.id) === donoUid;
  const ehEu = u => !!u && !!meuUid && !u.convite && (u.firebaseUid || u.id) === meuUid;
  const travado = u => ehDono(u) || ehEu(u); // tipo e áreas não mudam (ver o comentário acima)
  // Convite de quem já entrou: o perfil com o mesmo e-mail é o que vale
  const perfilDoEmail = email => usuarios.find(u => u.firebaseUid && email && (u.email || "").toLowerCase() === String(email).toLowerCase());
  const editandoTravado = !!editando && travado(editando.firebaseUid ? editando : (perfilDoEmail(editando.email) || editando));

  const abrirNovo = () => { setEditando(null); setForm(formVazio); setModal(true); };
  const abrirEdicao = (u0) => {
    // Convite de quem já entrou: abre (e grava) o PERFIL, que é o que vale — nunca as áreas velhas do convite
    const u = (!u0.firebaseUid && u0.convite && perfilDoEmail(u0.email)) || u0;
    setEditando(u);
    setForm({ nome: u.nome || "", email: u.email || "", cargo: u.cargo || "Encarregado", obraId: u.obraId ?? "", perfil: u.perfil || "encarregado", tel: u.tel || "", acessos: acessosParaGravar(u.acessos), preset: presetDaTela(u.acessos) });
    setModal(true);
  };
  // Atalho copia as áreas dele; Personalizado parte do que já estava marcado (Tudo = todas marcadas).
  // A Visão geral (AREA_FIXA, o Painel) vem sempre: no celular é por ela que se chega às outras áreas.
  const escolherPreset = (id) => setForm(f => {
    if (id === "personalizado") return { ...f, preset: id, acessos: f.acessos === null ? [...AREAS_ACESSO] : normalizarAcessos(f.acessos) };
    const p = PRESETS_ACESSOS.find(x => x.id === id);
    return { ...f, preset: id, acessos: p.acessos ? normalizarAcessos(p.acessos) : null };
  });
  const alternarArea = (id) => setForm(f => {
    if (id === AREA_FIXA) return f; // travada (ver acima)
    const atual = f.acessos === null ? AREAS_ACESSO : f.acessos;
    const novo = atual.includes(id) ? atual.filter(x => x !== id) : [...atual, id];
    return { ...f, acessos: normalizarAcessos(novo) };
  });

  const salvar = async () => {
    if (salvando) return;
    const emailNorm = form.email.trim().toLowerCase();
    if (!form.nome.trim()) { alert("⚠️ Informe o nome"); return; }
    if (!editando && (!emailNorm.includes("@") || emailNorm.length < 6)) { alert("⚠️ Informe o Gmail da pessoa (é com ele que ela vai entrar)."); return; }
    if (form.perfil !== "gestor" && form.obraId === "") { alert("⚠️ Selecione a obra deste acesso.\n\nSem obra vinculada, o encarregado não vê a equipe nem os pedidos certos."); return; }
    const ehGestor = form.perfil === "gestor";
    if (ehGestor && Array.isArray(form.acessos) && form.acessos.length === 0) { alert("⚠️ Marque pelo menos uma área do escritório para este acesso."); return; }
    const obraId = form.obraId === "" ? null : (isNaN(Number(form.obraId)) ? form.obraId : Number(form.obraId));
    // acessos: null = Tudo (e sempre null na equipe de campo, que não usa o campo)
    const acessos = ehGestor ? acessosParaGravar(form.acessos) : null;
    const areasTxt = ehGestor && !editandoTravado ? `\nEscritório · ${resumoAcessos(acessos)}` : "";
    const dados = { nome: form.nome.trim(), cargo: form.cargo, obraId, perfil: form.perfil, tel: form.tel.trim(), acessos };
    // Dono ou a própria pessoa: grava só nome, cargo, obra e telefone (tipo e áreas ficam como estão)
    if (editandoTravado) { delete dados.perfil; delete dados.acessos; }

    // Demonstração: nada vai para a nuvem; mostra como o acesso ficaria e fecha
    if (demo) {
      const obraNome = obras.find(o => String(o.id) === String(obraId))?.nome;
      const resumo = editandoTravado && ehDono(editando) ? "Dono da empresa · acesso total"
        : ehGestor ? `Escritório · ${resumoAcessos(acessos)}`
        : `Equipe de campo${obraNome ? " · " + obraNome : ""}`;
      alert(`Na demonstração nada é gravado. Na sua empresa, este acesso ficaria: ${resumo}`);
      setModal(false);
      return;
    }

    // Convite de quem já entrou (há perfil com o mesmo e-mail): grava no PERFIL, que é o que vale;
    // atualizarPerfilNuvem leva o tipo e as áreas também para o convite (alinha os dois)
    const uidPerfil = editando ? (editando.firebaseUid || perfilDoEmail(editando.email)?.firebaseUid || null) : null;

    setSalvando(true);
    try {
      if (uidPerfil) {
        // Já entrou pelo menos uma vez: edita o perfil da nuvem
        const ok = await atualizarPerfilNuvem(uidPerfil, dados);
        if (!ok) { alert("❌ Não deu para atualizar o perfil na nuvem. Verifique a conexão e tente de novo."); return; }
        alert(`✅ Acesso atualizado!\n\n${dados.nome}${areasTxt}${obraId !== null ? "\n🏗️ " + (obras.find(o => String(o.id) === String(obraId))?.nome || "") : ""}`);
      } else {
        // Convite novo ou convite ainda pendente (a chave é o e-mail)
        if (!editando && usuarios.some(u => (u.email || "").toLowerCase() === emailNorm)) { alert("⚠️ Já existe um acesso ou convite com esse e-mail."); return; }
        const r = await criarConvite({ email: editando ? editando.email : emailNorm, ...dados, empresaNome: empresa?.nomeFantasia || empresa?.razaoSocial || "" });
        if (!r.ok) { alert("❌ Não foi possível salvar o convite:\n\n" + r.erro); return; }
        alert(`✅ Convite registrado!\n\n👤 ${dados.nome}\n📧 ${editando ? editando.email : emailNorm}${areasTxt}\n\nNo celular da pessoa: abrir o app → "Entrar com Google" com este Gmail. Ela entra direto na sua empresa.`);
      }
      setModal(false);
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (u) => {
    if (u.convite) {
      if (!confirm(`Cancelar o convite de "${u.nome}" (${u.email})?`)) return;
      const r = await removerConvite(u.email);
      if (!r.ok) alert("❌ Não foi possível cancelar: " + r.erro);
      return;
    }
    if (!confirm(`Desativar o acesso de "${u.nome}"?\n\nEla não consegue mais entrar em nenhum aparelho. Você pode reativar depois.`)) return;
    const ok = await definirAcessoAtivo(u.firebaseUid, false);
    if (!ok) alert("❌ Não foi possível desativar. Verifique a conexão.");
  };
  const reativar = async (u) => {
    const ok = await definirAcessoAtivo(u.firebaseUid, true);
    if (!ok) alert("❌ Não foi possível reativar. Verifique a conexão.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Usuários e acessos" sub="Quem entra na sua empresa" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: T.fundo, padding: 14 }}>
        <div style={{ background: T.infoFundo, borderRadius: 12, padding: 12, marginBottom: 12, border: `1px solid ${T.infoBorda}`, fontSize: 11, color: T.infoTexto, lineHeight: 1.6 }}>
          Cadastre o <b>Gmail</b> de cada pessoa. Ela entra no app com "Entrar com Google" usando esse Gmail e já cai na sua empresa, na obra escolhida. Sem senha para passar.
          {" "}Para quem é do escritório, escolha as <b>áreas</b> que a pessoa abre (ex.: só o Financeiro).
        </div>

        {demo && (
          <div style={{ background: T.avisoFundo, borderRadius: 12, padding: 12, marginBottom: 12, border: `1px solid ${T.avisoBorda}`, fontSize: 12, color: T.avisoTexto, lineHeight: 1.6, fontWeight: 600 }}>
            Na demonstração os acessos são ilustrativos: dá para abrir e preencher, mas nada é gravado. Na sua empresa, cada pessoa entra com o próprio Gmail.
          </div>
        )}
        <Btn label="➕ ADICIONAR ACESSO" color={GREEN} onClick={abrirNovo} />

        {lista.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: T.texto2, fontSize: 13 }}>Nenhum acesso cadastrado ainda.</div>
        ) : (
          lista.map(u => {
            const obra = obras.find(o => String(o.id) === String(u.obraId));
            const iniciais = (u.nome || "?").split(" ").filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join("");
            const inativo = u.ativo === false;
            const cor = u.convite ? "#b45309" : inativo ? "#9ca3af" : u.perfil === "gestor" ? GOLD : BLUE;
            const dono = ehDono(u);
            const fixo = travado(u); // dono ou a própria pessoa: sem desativar, tipo e áreas travados
            const tipoTxt = dono ? "👔 Dono da empresa · acesso total"
              : u.perfil === "gestor" ? `👔 Gestor · ${ehEu(u) ? "você" : resumoAcessos(u.acessos)}`
              : `👷 ${u.cargo || "Encarregado"}`;
            return (
              <div key={u.id} style={{ background: T.superficie, borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: T.sombra, borderLeft: `4px solid ${cor}`, opacity: inativo ? 0.75 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  {u.foto
                    ? <img src={u.foto} alt="" referrerPolicy="no-referrer" style={{ width: 42, height: 42, borderRadius: 21, objectFit: "cover", flexShrink: 0 }} />
                    : <div style={{ width: 42, height: 42, borderRadius: 21, background: cor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{iniciais}</div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.titulo, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.nome}</div>
                    <div title={u.perfil === "gestor" ? `Áreas: ${dono ? nomesDasAreas(null) : nomesDasAreas(u.acessos)}` : undefined} style={{ fontSize: 10, color: T.texto2, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {tipoTxt}{obra ? ` · ${obra.nome}` : u.perfil === "gestor" ? "" : " · sem obra"}
                    </div>
                  </div>
                </div>
                <div style={{ background: T.superficie2, borderRadius: 8, padding: 8, marginBottom: 8, fontSize: 10, color: T.texto2 }}>
                  📧 {demo ? "exemplo (sem e-mail na demonstração)" : u.email}<br />
                  {u.perfil === "gestor" && !dono && acessosParaGravar(u.acessos) !== null && <>Abre: {nomesDasAreas(u.acessos)}<br /></>}
                  {demo
                    ? <span style={{ color: T.texto2 }}>Acesso ilustrativo</span>
                    : u.convite
                    ? <span style={{ color: "#b45309" }}>⏳ Convite pendente — ainda não entrou com este Gmail</span>
                    : inativo
                      ? <span style={{ color: T.texto2 }}>⛔ Acesso desativado</span>
                      : <span style={{ color: T.sucessoTexto }}>☁️ Ativo — entra em qualquer celular com o Google</span>}
                </div>
                {/* Na demo: só Editar (o salvar simula). Dono e a própria pessoa: sem Desativar */}
                <div style={{ display: "flex", gap: 6 }}>
                  {inativo && !demo
                    ? <button onClick={() => reativar(u)} style={{ flex: 1, background: GREEN, color: "#fff", border: "none", borderRadius: 8, padding: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✅ Reativar</button>
                    : <button onClick={() => abrirEdicao(u)} style={{ flex: 1, background: BLUE, color: "#fff", border: "none", borderRadius: 8, padding: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️ Editar</button>}
                  {!inativo && !demo && !fixo && <button onClick={() => remover(u)} style={{ background: T.erroFundo, color: RED, border: `2px solid ${RED}`, borderRadius: 8, padding: "8px 14px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{u.convite ? "✖ Cancelar" : "⛔ Desativar"}</button>}
                </div>
              </div>
            );
          })
        )}
      </div>
      <KMFooter />

      <Modal show={modal} title={editando ? "Editar acesso" : "Novo acesso"} onClose={() => setModal(false)}>
        <label style={labelS}>📧 Gmail da pessoa (é o login dela)</label>
        <input value={form.email} onChange={e => set("email", e.target.value)} type="email" placeholder="exemplo@gmail.com" autoComplete="off" disabled={!!editando} style={{ ...inputS, opacity: editando ? 0.6 : 1 }} />

        <label style={labelS}>👤 Nome completo</label>
        <input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Nome da pessoa" style={inputS} />

        <label style={labelS}>🔑 Tipo de acesso</label>
        <select value={form.perfil} onChange={e => set("perfil", e.target.value)} disabled={editandoTravado} style={{ ...selS, marginBottom: 6, opacity: editandoTravado ? 0.6 : 1 }}>
          <option value="encarregado">Equipe de campo (encarregado / apontador)</option>
          <option value="gestor">Escritório (gestor)</option>
        </select>
        <div style={{ fontSize: 11, color: T.texto2, lineHeight: 1.5, marginBottom: 12 }}>
          {editandoTravado
            ? "Aqui dá para mudar nome e telefone. O tipo de acesso e as áreas deste cartão não mudam."
            : form.perfil === "gestor"
            ? "Usa o sistema do escritório. As áreas abaixo definem o que a pessoa vê no menu e consegue abrir."
            : "Usa o app no canteiro e lança só na obra escolhida abaixo."}
        </div>

        {/* Dono da empresa (acesso total, sempre) ou a própria pessoa (ninguém muda o próprio acesso) */}
        {editandoTravado && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: T.superficie2, border: `1px solid ${T.borda}`, borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
            <Icone nome="lock" tamanho={16} cor={T.texto2} style={{ flex: "none", marginTop: 1 }} />
            <div style={{ fontSize: 12, color: T.texto, lineHeight: 1.5 }}>
              {ehDono(editando) || ehDono(perfilDoEmail(editando?.email))
                ? <><b>Dono da empresa · acesso total.</b> Quem criou a empresa sempre abre tudo: ninguém limita, rebaixa nem desativa o dono.</>
                : <><b>Este é o seu acesso.</b> Ninguém muda o próprio acesso: peça a outra pessoa que cuide de Sistema.</>}
            </div>
          </div>
        )}

        {form.perfil === "gestor" && !editandoTravado && (
          <>
            <label style={labelS} id="km-areas-rotulo">🗂️ Áreas do escritório</label>
            <div role="radiogroup" aria-labelledby="km-areas-rotulo" style={{ display: "grid", gap: 6, marginBottom: 12 }}>
              {OPCOES_AREAS.map(p => {
                const ativo = form.preset === p.id;
                return (
                  <button key={p.id} type="button" role="radio" aria-checked={ativo} onClick={() => escolherPreset(p.id)}
                    style={{ display: "flex", alignItems: "flex-start", gap: 10, width: "100%", boxSizing: "border-box", textAlign: "left", padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${ativo ? GOLD : T.inputBorda}`, background: ativo ? "rgba(255,184,48,0.12)" : T.inputFundo, color: T.texto, cursor: "pointer", fontFamily: "inherit" }}>
                    <span aria-hidden="true" style={{ width: 18, height: 18, flex: "none", marginTop: 1, boxSizing: "border-box", borderRadius: "50%", border: `2px solid ${ativo ? GOLD : T.texto3}`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      {ativo && <span style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD }} />}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.titulo }}>{p.titulo}</span>
                      <span style={{ display: "block", fontSize: 11, color: T.texto2, lineHeight: 1.45, marginTop: 1 }}>{detalheOpcao(p)}</span>
                      {ativo && NOTA_PRESET[p.id] && <span style={{ display: "block", fontSize: 11, color: T.texto2, lineHeight: 1.45, marginTop: 4, fontStyle: "italic" }}>{NOTA_PRESET[p.id]}</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            {form.preset === "personalizado" && (
              <fieldset style={{ border: `1px solid ${T.borda}`, borderRadius: 12, padding: "2px 12px", margin: "0 0 12px", background: T.superficie }}>
                <legend style={SO_LEITOR}>Marque as áreas que a pessoa abre</legend>
                {GRUPOS_ACESSO.map((g, i) => {
                  const fixa = g.id === AREA_FIXA; // Visão geral: sempre marcada (o Painel)
                  const marcado = fixa || (form.acessos === null ? AREAS_ACESSO : form.acessos).includes(g.id);
                  return (
                    <label key={g.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderTop: i ? `1px solid ${T.borda}` : "none", cursor: fixa ? "default" : "pointer" }}>
                      <input type="checkbox" checked={marcado} disabled={fixa} onChange={() => alternarArea(g.id)} style={{ width: 18, height: 18, margin: "1px 0 0", flex: "none", accentColor: GOLD, cursor: fixa ? "default" : "pointer" }} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.titulo }}>{g.titulo}{fixa && <span style={{ fontWeight: 600, color: T.texto2 }}> · sempre</span>}</span>
                        {/* Ajuda e Links úteis (livre) abrem para todo o escritório: não entram na lista da área */}
                        <span style={{ display: "block", fontSize: 11, color: T.texto2, lineHeight: 1.45 }}>{g.itens.filter(it => !it.livre).map(it => it.label).join(", ")}</span>
                        {fixa && <span style={{ display: "block", fontSize: 11, color: T.texto2, lineHeight: 1.45, marginTop: 2, fontStyle: "italic" }}>O Painel é a porta de entrada no celular.</span>}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            )}

            {/* Aviso honesto: as áreas escondem telas e menus, não trancam os dados da empresa */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: T.avisoFundo, border: `1px solid ${T.avisoBorda}`, borderRadius: 10, padding: "8px 10px", marginBottom: 12, fontSize: 11, color: T.avisoTexto, lineHeight: 1.5 }}>
              <Icone nome="info" tamanho={15} cor={T.avisoTexto} style={{ flex: "none", marginTop: 1 }} />
              <span>As áreas definem o que a pessoa abre no sistema. Dê acesso de escritório só a quem é de confiança.</span>
            </div>
          </>
        )}

        {form.perfil !== "gestor" && (
          <>
            <label style={labelS}>👷 Cargo / função</label>
            <select value={form.cargo} onChange={e => set("cargo", e.target.value)} style={selS}>
              {CARGOS_ACESSO.map(c => <option key={c}>{c}</option>)}
            </select>

            <label style={labelS}>🏗️ Obra em que vai lançar</label>
            <select value={form.obraId} onChange={e => set("obraId", e.target.value)} style={selS}>
              <option value="">Selecione a obra</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </>
        )}

        <label style={labelS}>📞 Telefone (opcional)</label>
        <input value={form.tel} onChange={e => set("tel", e.target.value)} placeholder="(28) 9 9999-9999" style={inputS} />

        <Btn label={salvando ? "⏳ SALVANDO..." : editando ? "💾 SALVAR" : "➕ CADASTRAR ACESSO"} color={GREEN} onClick={salvar} disabled={salvando} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   MINHA CONTA — conta Google, empresa e sair
════════════════════════════════════════════════════════════════════════ */
/* `demo`: modo demonstração — badge "Modo demonstração", sem linha de e-mail (o visitante
   não tem conta) e o botão vira "Sair da demonstração" (onLogout apaga os dados demo_*). */
export function TelaMinhaConta({ usuario, empresa, demo = false, onBack, onLogout }) {
  const [modalSair, setModalSair] = useState(false);
  const { preferencia, setPreferencia } = useTema(); // mesmo alternador do menu lateral (grava _kmzero_tema)
  const ehGestor = usuario?.perfil === "gestor";
  const minhasAreas = ehGestor ? acessosParaGravar(usuario?.acessos) : null; // null = tudo

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Minha Conta" sub={demo ? "Visitante da demonstração" : "Conta Google e empresa"} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: T.fundo, padding: 14 }}>

        <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1e3a8a 100%)`, color: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: "0 4px 16px rgba(15,33,81,0.25)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            {usuario?.foto
              ? <img src={usuario.foto} alt="" referrerPolicy="no-referrer" style={{ width: 54, height: 54, borderRadius: 27, objectFit: "cover" }} />
              : <div style={{ width: 54, height: 54, borderRadius: 27, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>👤</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{usuario?.nome || "—"}</div>
              {!demo && <div style={{ fontSize: 11, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{usuario?.email || "—"}</div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {demo
              ? <div style={{ background: GOLD, color: NAVY, borderRadius: 14, padding: "4px 10px", fontSize: 11, fontWeight: 800 }}>Modo demonstração</div>
              : <div style={{ background: "rgba(34,197,94,0.25)", border: "1px solid rgba(34,197,94,0.5)", borderRadius: 14, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>🔒 Conta Google</div>}
            <div style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 14, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
              {ehGestor ? `👔 Gestor · ${resumoAcessos(minhasAreas)}` : `👷 ${usuario?.cargo || "Equipe"}`}
            </div>
          </div>
        </div>

        {/* O que esta conta abre (só leitura: quem muda é quem cuida de Sistema → Usuários e acessos) */}
        <div style={{ background: T.superficie, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: T.sombra }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.titulo, marginBottom: 4 }}>🗂️ Suas áreas</div>
          {!ehGestor ? (
            <div style={{ fontSize: 12, color: T.texto, lineHeight: 1.6 }}>
              <b>Equipe de campo.</b> Você lança na obra em que o gestor vinculou você.
            </div>
          ) : minhasAreas === null ? (
            <div style={{ fontSize: 12, color: T.texto, lineHeight: 1.6 }}>
              <b>Escritório · acesso total.</b> Todas as áreas do menu, inclusive Sistema (empresa, usuários e backup).
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: T.texto, lineHeight: 1.6, marginBottom: 8 }}>
                <b>Escritório · {resumoAcessos(minhasAreas)}.</b> {minhasAreas.length ? "Você abre:" : "Nenhuma área liberada ainda."}
              </div>
              {minhasAreas.length > 0 && (
                <ul aria-label="Áreas liberadas" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {minhasAreas.map(id => (
                    <li key={id} style={{ fontSize: 11, fontWeight: 700, color: T.texto, background: T.superficie2, border: `1px solid ${T.borda}`, borderRadius: 999, padding: "4px 10px" }}>{TITULO_AREA[id]}</li>
                  ))}
                </ul>
              )}
              <div style={{ fontSize: 11, color: T.texto2, lineHeight: 1.5, marginTop: 10 }}>
                Precisa de outra área? Peça a quem cuida de Sistema → Usuários e acessos.
              </div>
            </>
          )}
        </div>

        <div style={{ background: T.superficie, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: T.sombra }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.titulo, marginBottom: 8 }}>🏢 Empresa vinculada</div>
          <div style={{ fontSize: 12, color: T.texto, lineHeight: 1.6 }}>
            <div><b>Razão social:</b> {empresa?.razaoSocial || "—"}</div>
            {empresa?.nomeFantasia && <div><b>Nome fantasia:</b> {empresa.nomeFantasia}</div>}
            <div><b>CNPJ:</b> {empresa?.cnpj || "—"}</div>
            {empresa?.endereco && <div style={{ marginTop: 4 }}><b>📍</b> {empresa.endereco}</div>}
          </div>
        </div>

        {/* Aparência: Claro / Escuro / Automático (escuro no computador, claro no celular) */}
        <div style={{ background: T.superficie, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: T.sombra }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.titulo, marginBottom: 4 }}>🎨 Aparência</div>
          <div style={{ fontSize: 11, color: T.texto2, marginBottom: 10, lineHeight: 1.5 }}>
            Automático = escuro no computador e claro no celular (sol no canteiro). Vale para este aparelho.
          </div>
          <div role="radiogroup" aria-label="Tema" style={{ display: "flex", gap: 4, background: T.superficie2, borderRadius: 10, padding: 3 }}>
            {OPCOES_TEMA.map(o => {
              const ativo = preferencia === o.valor;
              return (
                <button key={o.valor} type="button" role="radio" aria-checked={ativo} title={o.dica} onClick={() => setPreferencia(o.valor)}
                  style={{ flex: 1, minHeight: 36, border: "none", borderRadius: 8, background: ativo ? GOLD : "transparent", color: ativo ? NAVY : T.texto, fontWeight: ativo ? 800 : 600, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
                  <Icone nome={o.icone} tamanho={15} />{o.rotulo}
                </button>
              );
            })}
          </div>
        </div>

        {demo ? (
          <div style={{ background: T.superficie, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: T.sombra }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.titulo, marginBottom: 4 }}>Sair da demonstração</div>
            <div style={{ fontSize: 11, color: T.texto2, marginBottom: 10, lineHeight: 1.5 }}>
              Os dados de exemplo deste navegador são apagados e você volta para a página inicial. Nada foi enviado para a nuvem.
            </div>
            <button onClick={() => onLogout && onLogout(true)} className="km-btn-danger" style={{ width: "100%", padding: 12, background: T.superficie, color: RED, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Sair da demonstração
            </button>
          </div>
        ) : (
          <div style={{ background: T.superficie, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: T.sombra }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.titulo, marginBottom: 4 }}>🚪 Sair desta conta</div>
            <div style={{ fontSize: 11, color: T.texto2, marginBottom: 10, lineHeight: 1.5 }}>
              Para entrar de novo neste aparelho você vai precisar de internet e da mesma conta Google.
            </div>
            <button onClick={() => setModalSair(true)} className="km-btn-danger" style={{ width: "100%", padding: 12, background: T.superficie, color: RED, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              🚪 Sair da conta
            </button>
          </div>
        )}

        {!demo && (
          <div style={{ background: "#f0f9ff", border: `1px solid ${T.infoBorda}`, borderRadius: 10, padding: 12, fontSize: 11, color: "#075985", lineHeight: 1.5 }}>
            💡 A senha é a da sua conta Google e fica só no Google. Para trocar, use as configurações da sua conta Google (myaccount.google.com).
          </div>
        )}

        {VERSAO_APP && <div style={{ textAlign: "center", fontSize: 11, color: T.texto3, marginTop: 14 }}>KMZERO v{VERSAO_APP}</div>}
      </div>
      <KMFooter />

      <Modal show={modalSair} title="🚪 Sair da conta?" onClose={() => setModalSair(false)}>
        <div style={{ fontSize: 13, color: T.texto, lineHeight: 1.6, marginBottom: 14 }}>
          Você vai precisar de internet para entrar de novo com o Google. Confirma?
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setModalSair(false)} style={{ flex: 1, padding: 12, background: T.superficie2, color: T.titulo, border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => { setModalSair(false); onLogout && onLogout(true); }} className="km-btn-danger" style={{ flex: 1, padding: 12, background: RED, color: "#fff", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>🚪 Sair</button>
        </div>
      </Modal>
    </div>
  );
}
