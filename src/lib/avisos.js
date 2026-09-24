/* Avisos (notificações) no app: Firestore + Firebase Cloud Messaging.
   Coleções em empresas/{empresaId}/:
     avisos/{id}          o aviso (ver avisosRegras.js)
     avisosLeitura/{uid}  { ultimaLeitura } — até quando a pessoa já viu
     pushTokens/{hash}    um doc por aparelho com notificação ligada { uid, token }
   O disparo para os celulares é feito pelo servidor (api/notificar.js). */
import { doc, setDoc, deleteDoc, onSnapshot, collection, query, where } from "firebase/firestore";
import { cloudRefs, getEmpresaId, semUndefined } from "./store.js";
import { auth, firebaseApp } from "../firebase.js";

const DIAS_NA_TELA = 45; // avisos mais velhos que isso não descem para o aparelho
const VAPID = import.meta.env.VITE_FCM_VAPID_KEY || "";
const CHAVE_TOKEN_LOCAL = "_kmzero_push_token";

const refEmpresa = (...caminho) => {
  const fb = cloudRefs(); const eid = getEmpresaId();
  return fb && eid ? doc(fb.db, "empresas", eid, ...caminho) : null;
};

export function observarAvisosNuvem(callback) {
  const fb = cloudRefs(); const eid = getEmpresaId();
  if (!fb || !eid) return () => {};
  const desde = Date.now() - DIAS_NA_TELA * 86400000;
  const q = query(collection(fb.db, "empresas", eid, "avisos"), where("criadoEm", ">=", desde));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ ...d.data(), id: d.id }))), e => console.warn("observarAvisosNuvem:", e));
}

export function observarLeituraAvisos(uid, callback) {
  const ref = uid && refEmpresa("avisosLeitura", String(uid));
  if (!ref) return () => {};
  return onSnapshot(ref, s => callback(Number(s.data()?.ultimaLeitura) || 0), e => console.warn("observarLeituraAvisos:", e));
}

export function marcarAvisosLidos(uid, quando = Date.now()) {
  const ref = uid && refEmpresa("avisosLeitura", String(uid));
  if (ref) setDoc(ref, { uid: String(uid), ultimaLeitura: quando }).catch(e => console.warn("marcarAvisosLidos:", e));
}

/* Grava o aviso e pede ao servidor para tocar nos celulares.
   Sem internet: o Firestore guarda na fila; quando subir, o app (se aberto) dispara,
   e se o app fechar antes, o servidor dispara na verificação da noite. */
export async function publicarAviso(aviso) {
  const ref = refEmpresa("avisos", String(aviso.id));
  if (!ref) return { ok: false, erro: "Sem conexão com a nuvem." };
  // Sem sinal o setDoc só termina quando a internet volta: não deixa a tela travada
  // em "Enviando…" — responde em 8 s e dispara sozinho quando a gravação subir.
  const gravado = setDoc(ref, semUndefined(aviso)).then(() => true);
  const aTempo = await Promise.race([gravado, new Promise(r => setTimeout(() => r(false), 8000))]);
  if (!aTempo) {
    gravado.then(() => dispararPush(aviso.id)).catch(() => {});
    return { ok: false, erro: "Sem internet agora — o aviso sai assim que a conexão voltar." };
  }
  return dispararPush(aviso.id);
}

export async function dispararPush(avisoId) {
  try {
    const u = auth.currentUser;
    if (!u) return { ok: false, erro: "Sem login." };
    const idToken = await u.getIdToken();
    const r = await fetch("/api/notificar", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ empresaId: getEmpresaId(), avisoId: String(avisoId) }),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, ...j } : { ok: false, erro: j.erro || `Erro ${r.status}` };
  } catch (e) {
    return { ok: false, erro: "Sem internet agora — o aviso toca nos celulares quando a conexão voltar." };
  }
}

/* ── Notificação neste aparelho ── */
const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent || "");
const instalado = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

// Situação para a tela: "ligada" | "desligada" | "bloqueada" | "instalar_ios" | "sem_suporte" | "sem_config"
export function situacaoNotificacoes() {
  if (!VAPID) return "sem_config";
  if (ehIOS() && !instalado()) return "instalar_ios"; // iPhone só recebe com o app na Tela de Início
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "sem_suporte";
  if (Notification.permission === "denied") return "bloqueada";
  if (Notification.permission === "granted" && lerLocal(CHAVE_TOKEN_LOCAL)) return "ligada";
  return "desligada";
}

function lerLocal(k) { try { return localStorage.getItem(k) || ""; } catch { return ""; } }
function gravarLocal(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} }

async function hash(texto) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

async function obterToken() {
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) throw new Error("Este navegador não recebe notificações.");
  const registro = await navigator.serviceWorker.ready;
  return getToken(getMessaging(firebaseApp), { vapidKey: VAPID, serviceWorkerRegistration: registro });
}

async function salvarToken(usuario, token) {
  const ref = refEmpresa("pushTokens", await hash(token));
  if (!ref) throw new Error("Sem empresa carregada.");
  await setDoc(ref, semUndefined({
    uid: String(usuario.firebaseUid || usuario.id), nome: usuario.nome || "", token,
    aparelho: (navigator.userAgentData?.platform || navigator.platform || "") + (instalado() ? " (app)" : " (navegador)"),
    atualizadoEm: Date.now(),
  }));
  gravarLocal(CHAVE_TOKEN_LOCAL, token);
}

// Botão "Ativar notificações" (tem de vir de um toque: o navegador exige)
export async function ativarNotificacoes(usuario) {
  const s = situacaoNotificacoes();
  if (s === "sem_config") return { ok: false, erro: "Notificações ainda não configuradas (falta a chave do Firebase no Vercel)." };
  if (s === "instalar_ios") return { ok: false, erro: "No iPhone: toque em Compartilhar → \"Adicionar à Tela de Início\" e abra o KMZERO por lá." };
  if (s === "sem_suporte") return { ok: false, erro: "Este navegador não recebe notificações. Use o Chrome." };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, erro: "Permissão negada. Libere as notificações do site nas configurações do navegador." };
  try {
    const token = await obterToken();
    if (!token) return { ok: false, erro: "Não foi possível registrar este aparelho." };
    await salvarToken(usuario, token);
    return { ok: true };
  } catch (e) {
    console.error("ativarNotificacoes:", e);
    return { ok: false, erro: "Não foi possível ligar as notificações: " + (e.message || e) };
  }
}

// Ao abrir o app: se já estava ligada, renova o token em silêncio (ele muda às vezes)
export async function renovarNotificacoes(usuario) {
  if (!usuario || situacaoNotificacoes() !== "ligada") return;
  try {
    const token = await obterToken();
    if (token && token !== lerLocal(CHAVE_TOKEN_LOCAL)) {
      const antigo = lerLocal(CHAVE_TOKEN_LOCAL);
      if (antigo) { const r = refEmpresa("pushTokens", await hash(antigo)); if (r) deleteDoc(r).catch(() => {}); }
    }
    if (token) await salvarToken(usuario, token);
  } catch (e) { console.warn("renovarNotificacoes:", e); }
}

// Sair da conta / "desligar neste aparelho": o celular para de receber os avisos desta pessoa
export async function desligarNotificacoes() {
  const token = lerLocal(CHAVE_TOKEN_LOCAL);
  gravarLocal(CHAVE_TOKEN_LOCAL, "");
  if (!token) return;
  try { const r = refEmpresa("pushTokens", await hash(token)); if (r) await deleteDoc(r); } catch (e) { console.warn(e); }
  try { const { getMessaging, deleteToken } = await import("firebase/messaging"); await deleteToken(getMessaging(firebaseApp)); } catch {}
}
