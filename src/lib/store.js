import { getApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, deleteDoc, onSnapshot, query, where } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { usuarioAtual } from "../firebase.js";

let _empresaId = null;

export function setEmpresaId(id) { _empresaId = id; }
export function getEmpresaId() { return _empresaId; }

let _fb = null;
export function cloudRefs() {
  if (_fb) return _fb;
  try {
    const app = getApp();
    _fb = { db: getFirestore(app), st: getStorage(app) };
  } catch (e) {
    console.warn("Firebase não inicializado — sync desativada:", e);
    _fb = null;
  }
  return _fb;
}

export async function enviarFotoNuvem(f) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return false;
  try {
    const id = String(f.id);
    const r = storageRef(fb.st, `empresas/${_empresaId}/fotosObras/${id}.jpg`);
    await uploadString(r, f.foto, "data_url");
    const url = await getDownloadURL(r);
    const { foto, ...meta } = f;
    await setDoc(doc(fb.db, "empresas", _empresaId, "fotosObras", id), {
      ...meta, id, fotoUrl: url, criadoEm: Date.now(),
    });
    return url; // URL de download: quem chamou troca o base64 pela URL
  } catch (e) {
    console.error("enviarFotoNuvem:", e);
    return false;
  }
}

export function observarFotosNuvem(callback) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return () => {};
  try {
    return onSnapshot(
      collection(fb.db, "empresas", _empresaId, "fotosObras"),
      snap => callback(snap.docs.map(d => { const x = d.data(); return { ...x, foto: x.fotoUrl }; })),
      e => console.error("observarFotosNuvem:", e)
    );
  } catch (e) { console.error(e); return () => {}; }
}

export const semUndefined = (o) => JSON.parse(JSON.stringify(o));

/* ── Anexos base64 (data:...) NÃO sobem para o Firestore (limite de 1 MB por doc) ── */
export const ehDataUrl = v => typeof v === "string" && v.startsWith("data:");

export function temDataUrl(v) {
  if (ehDataUrl(v)) return true;
  if (Array.isArray(v)) return v.some(temDataUrl);
  if (v && typeof v === "object") return Object.values(v).some(temDataUrl);
  return false;
}

/* Cópia do objeto sem nenhuma string base64 (campos removidos; em arrays viram null) */
export function semDataUrl(v) {
  if (ehDataUrl(v)) return undefined;
  if (Array.isArray(v)) return v.map(x => { const y = semDataUrl(x); return y === undefined ? null : y; });
  if (v && typeof v === "object") {
    const o = {};
    Object.entries(v).forEach(([k, x]) => { const y = semDataUrl(x); if (y !== undefined) o[k] = y; });
    return o;
  }
  return v;
}

/* Ao receber um doc da nuvem, mantém os anexos (base64) que só existem neste aparelho */
export function mesclarAnexosLocais(docNuvem, docLocal) {
  if (!docLocal || typeof docLocal !== "object") return docNuvem;
  const r = { ...docNuvem };
  Object.entries(docLocal).forEach(([k, v]) => {
    if (!temDataUrl(v)) return;
    const n = docNuvem[k];
    if (n === undefined || n === null) { r[k] = v; return; }
    if (Array.isArray(v) && Array.isArray(n) && v.length === n.length) { r[k] = v; return; }
    if (typeof v === "object" && !Array.isArray(v) && typeof n === "object" && !Array.isArray(n)) r[k] = mesclarAnexosLocais(n, v);
  });
  return r;
}

/* JSON com chaves em ordem — o Firestore devolve os campos em ordem alfabética,
   então comparar JSON.stringify "cru" daria falso positivo de mudança. */
export function jsonEstavel(v) {
  if (Array.isArray(v)) return "[" + v.map(jsonEstavel).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + jsonEstavel(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}

export async function enviarDocNuvem(colecao, id, dados) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return false;
  try {
    await setDoc(doc(fb.db, "empresas", _empresaId, colecao, String(id)), semUndefined(dados));
    return true;
  } catch (e) {
    console.error("enviarDocNuvem", colecao, e);
    return false;
  }
}

export async function removerDocNuvem(colecao, id) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return false;
  try { await deleteDoc(doc(fb.db, "empresas", _empresaId, colecao, String(id))); return true; }
  catch (e) { console.error("removerDocNuvem", colecao, e); return false; }
}

/* callback(docs, meta) — meta.fromCache = true quando a resposta veio do cache local
   (sem internet), e não do servidor. Quem consome decide o que confiar. */
export function observarColecaoNuvem(colecao, callback, onErro) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return () => {};
  try {
    return onSnapshot(
      collection(fb.db, "empresas", _empresaId, colecao),
      { includeMetadataChanges: false },
      snap => callback(snap.docs.map(d => d.data()), { fromCache: snap.metadata.fromCache, hasPendingWrites: snap.metadata.hasPendingWrites }),
      e => { console.error("observarColecaoNuvem", colecao, e); if (onErro) onErro(e); }
    );
  } catch (e) { console.error(e); return () => {}; }
}

/* Aplica sobre o registro local o que está no perfil da nuvem (usuarios/{uid}) — a nuvem manda */
export const aplicarPerfilNuvem = (u, p) => !p ? u : ({
  ...u,
  nome: p.nome || u.nome || "Equipe",
  perfil: p.perfil || u.perfil || "encarregado",
  cargo: p.cargo || u.cargo || "Encarregado",
  obraId: (p.obraId !== undefined && p.obraId !== null) ? p.obraId : (u.obraId ?? null),
  tel: p.tel || u.tel || "",
});

/* ── Funções multi-tenant ── */

export async function registrarEmpresa(dadosEmpresa, firebaseUid, nomeGestor, emailGestor, fotoGestor = "") {
  const fb = cloudRefs();
  if (!fb) return null;
  try {
    const empresaRef = doc(collection(fb.db, "empresas"));
    const empresaId = empresaRef.id;
    await setDoc(empresaRef, {
      ...semUndefined(dadosEmpresa),
      criadoEm: Date.now(),
      gestorUid: firebaseUid,
    });
    try {
      await setDoc(doc(fb.db, "usuarios", firebaseUid), {
        empresaId,
        nome: nomeGestor,
        email: String(emailGestor || "").trim().toLowerCase(),
        foto: fotoGestor || "",
        perfil: "gestor",
        ativo: true,
        criadoEm: Date.now(),
      });
    } catch (e) {
      // Não deixa empresa órfã se o perfil não pôde ser gravado
      try { await deleteDoc(empresaRef); } catch {}
      throw e;
    }
    return empresaId;
  } catch (e) {
    console.error("registrarEmpresa:", e);
    return null;
  }
}

/* Perfil completo do login (usuarios/{uid}): empresaId, perfil, nome, obraId, ativo... */
export async function carregarPerfilNuvem(firebaseUid) {
  const fb = cloudRefs();
  if (!fb) return { ok: false, erro: "Firebase nao inicializado." };
  try {
    const snap = await getDoc(doc(fb.db, "usuarios", firebaseUid));
    return { ok: true, perfil: snap.exists() ? snap.data() : null };
  } catch (e) {
    console.error("carregarPerfilNuvem:", e);
    const negado = e.code === "permission-denied";
    return {
      ok: false, codigo: e.code,
      erro: negado
        ? "Sem permissao para ler seu perfil na nuvem. As regras do Firebase precisam ser publicadas (npm run firebase:deploy-regras)."
        : "Nao foi possivel consultar seu perfil na nuvem. Verifique a conexao.",
    };
  }
}

export async function atualizarPerfilNuvem(firebaseUid, dados) {
  const fb = cloudRefs();
  if (!fb || !firebaseUid) return false;
  try {
    await setDoc(doc(fb.db, "usuarios", firebaseUid), semUndefined(dados), { merge: true });
    return true;
  } catch (e) { console.error("atualizarPerfilNuvem:", e); return false; }
}

/* ativo=false bloqueia a pessoa em todos os aparelhos (as regras checam o campo) */
export async function definirAcessoAtivo(firebaseUid, ativo) {
  return atualizarPerfilNuvem(firebaseUid, { ativo: !!ativo, atualizadoEm: Date.now() });
}

/* ── Convites e equipe (login só com Google) ──────────────────────────────
   O gestor não cria conta para ninguém: registra o Gmail da pessoa em
   convites/{email}. Quando ela entra com o Google pela 1ª vez, o app lê o
   convite e cria usuarios/{uid} (as regras conferem e-mail verificado). */
export const emailChave = e => String(e || "").trim().toLowerCase();

export async function buscarConvite(email) {
  const fb = cloudRefs();
  if (!fb) return { ok: false, erro: "Firebase nao inicializado." };
  try {
    const snap = await getDoc(doc(fb.db, "convites", emailChave(email)));
    return { ok: true, convite: snap.exists() ? snap.data() : null };
  } catch (e) {
    console.error("buscarConvite:", e);
    return { ok: false, codigo: e.code, erro: e.code === "permission-denied"
      ? "Sem permissao para ler o convite. As regras do Firebase precisam ser publicadas (npm run firebase:deploy-regras)."
      : "Nao foi possivel consultar o convite. Verifique a conexao." };
  }
}

/* Cria o perfil da pessoa convidada (chamado no 1º login com Google) */
export async function aceitarConvite(userGoogle, convite) {
  const fb = cloudRefs();
  if (!fb) return { ok: false, erro: "Firebase nao inicializado." };
  const perfil = semUndefined({
    empresaId: convite.empresaId,
    email: emailChave(userGoogle.email),
    nome: convite.nome || userGoogle.nome || "Equipe",
    foto: userGoogle.foto || "",
    perfil: convite.perfil || "encarregado",
    cargo: convite.cargo || (convite.perfil === "gestor" ? "Gestor" : "Encarregado"),
    obraId: convite.obraId ?? null,
    tel: convite.tel || "",
    ativo: true,
    criadoEm: Date.now(),
  });
  try {
    await setDoc(doc(fb.db, "usuarios", userGoogle.uid), perfil);
    return { ok: true, perfil };
  } catch (e) {
    console.error("aceitarConvite:", e);
    return { ok: false, codigo: e.code, erro: e.code === "permission-denied"
      ? "O convite existe, mas a nuvem recusou criar seu perfil. Confira se entrou com a MESMA conta Google do convite e se as regras do Firebase estao publicadas."
      : "Nao foi possivel concluir seu acesso. Verifique a conexao e tente de novo." };
  }
}

/* Gestor registra/atualiza o convite de um Gmail (a chave e o e-mail em minusculas) */
export async function criarConvite({ email, nome, cargo, obraId, perfil, tel, empresaNome }) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return { ok: false, erro: "Empresa nao identificada. Saia e entre novamente como gestor." };
  const chave = emailChave(email);
  if (!chave.includes("@")) return { ok: false, erro: "Informe um e-mail valido (Gmail)." };
  const eu = usuarioAtual();
  try {
    await setDoc(doc(fb.db, "convites", chave), semUndefined({
      email: chave,
      empresaId: _empresaId,
      empresaNome: empresaNome || "",
      nome: nome || "",
      cargo: cargo || "Encarregado",
      obraId: obraId ?? null,
      perfil: perfil === "gestor" ? "gestor" : "encarregado",
      tel: tel || "",
      criadoPor: eu ? eu.uid : null,
      criadoEm: Date.now(),
    }), { merge: true });
    return { ok: true, email: chave };
  } catch (e) {
    console.error("criarConvite:", e);
    return { ok: false, codigo: e.code, erro: e.code === "permission-denied"
      ? "A nuvem recusou o convite: publique as regras do Firebase (npm run firebase:deploy-regras) e tente de novo."
      : "Nao foi possivel salvar o convite. Verifique a conexao." };
  }
}

export async function removerConvite(email) {
  const fb = cloudRefs();
  if (!fb) return { ok: false, erro: "Firebase nao inicializado." };
  try {
    await deleteDoc(doc(fb.db, "convites", emailChave(email)));
    return { ok: true };
  } catch (e) {
    console.error("removerConvite:", e);
    return { ok: false, erro: "Nao foi possivel cancelar o convite. Verifique a conexao." };
  }
}

/* Equipe da empresa (perfis em usuarios/) — qualquer usuario ativo pode ver */
export function observarEquipeNuvem(callback, onErro) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return () => {};
  const q = query(collection(fb.db, "usuarios"), where("empresaId", "==", _empresaId));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({
      id: d.id, firebaseUid: d.id,
      nome: d.data().nome || "", email: d.data().email || "", foto: d.data().foto || "",
      perfil: d.data().perfil || "encarregado", cargo: d.data().cargo || "",
      obraId: d.data().obraId ?? null, tel: d.data().tel || "",
      ativo: d.data().ativo !== false,
    })));
  }, e => { console.warn("observarEquipeNuvem:", e); onErro && onErro(e); });
}

/* Convites pendentes da empresa — so o gestor */
export function observarConvitesNuvem(callback, onErro) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return () => {};
  const q = query(collection(fb.db, "convites"), where("empresaId", "==", _empresaId));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({
      id: "convite:" + d.id, convite: true,
      nome: d.data().nome || "", email: d.data().email || d.id,
      perfil: d.data().perfil || "encarregado", cargo: d.data().cargo || "",
      obraId: d.data().obraId ?? null, tel: d.data().tel || "",
    })));
  }, e => { console.warn("observarConvitesNuvem:", e); onErro && onErro(e); });
}

/* Decide o que fazer depois de "Entrar com Google":
   - perfil existe e ativo → { tipo: "perfil", usuario }
   - sem perfil, com convite → cria o perfil → { tipo: "perfil", usuario }
   - sem perfil e sem convite → { tipo: "sem_convite" }
   - desativado / erro → { tipo: "erro", erro } */
export async function resolverEntradaGoogle(userGoogle) {
  const p = await carregarPerfilNuvem(userGoogle.uid);
  if (!p.ok) return { tipo: "erro", erro: p.erro };
  const montar = perfil => ({
    id: userGoogle.uid,
    firebaseUid: userGoogle.uid,
    email: emailChave(userGoogle.email),
    foto: userGoogle.foto || perfil.foto || "",
    nome: perfil.nome || userGoogle.nome || "Equipe",
    perfil: perfil.perfil || "encarregado",
    cargo: perfil.cargo || (perfil.perfil === "gestor" ? "Gestor" : "Encarregado"),
    obraId: perfil.obraId ?? null,
    tel: perfil.tel || "",
    empresaId: perfil.empresaId,
    ultimoLogin: Date.now(),
  });
  if (p.perfil) {
    if (p.perfil.ativo === false) return { tipo: "erro", desativado: true, erro: "Seu acesso foi desativado pelo gestor da empresa." };
    if (!p.perfil.empresaId) return { tipo: "sem_convite" };
    return { tipo: "perfil", usuario: montar(p.perfil) };
  }
  const c = await buscarConvite(userGoogle.email);
  if (!c.ok) return { tipo: "erro", erro: c.erro };
  if (!c.convite) return { tipo: "sem_convite" };
  const a = await aceitarConvite(userGoogle, c.convite);
  if (!a.ok) return { tipo: "erro", erro: a.erro };
  return { tipo: "perfil", usuario: montar(a.perfil) };
}

/* ── localStorage com prefixo dinâmico ── */

function storePrefix() {
  return _empresaId ? _empresaId + "_" : "kmzero_";
}

/* Ids já vistos na nuvem por coleção (para aplicar remoções feitas em outro aparelho
   enquanto este estava fechado). Fica no localStorage da empresa. */
export function lerIdsSync(colecao) {
  try {
    const v = localStorage.getItem(storePrefix() + "_syncIds_" + colecao);
    const arr = v ? JSON.parse(v) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
export function salvarIdsSync(colecao, ids) {
  try { localStorage.setItem(storePrefix() + "_syncIds_" + colecao, JSON.stringify(ids)); } catch {}
}

export const store = {
  async get(key) {
    try {
      const v = localStorage.getItem(storePrefix() + key);
      if (v) return JSON.parse(v);
      if (typeof window !== "undefined" && window.storage && window.storage.get) {
        const r = await window.storage.get(key);
        return r ? JSON.parse(r.value) : null;
      }
      return null;
    } catch (e) { console.warn("store.get error:", e); return null; }
  },
  async set(key, val) {
    try {
      const json = JSON.stringify(val);
      localStorage.setItem(storePrefix() + key, json);
      if (typeof window !== "undefined" && window.storage && window.storage.set) {
        try { await window.storage.set(key, json); } catch {}
      }
    } catch (e) {
      console.warn("store.set error:", e);
      if (e.name === "QuotaExceededError") {
        alert("Armazenamento cheio! Faça backup e limpe dados antigos.");
      }
    }
  },
  async clear() {
    try {
      const prefix = storePrefix();
      const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
      keys.forEach(k => localStorage.removeItem(k));
    } catch (e) { console.warn(e); }
  }
};
