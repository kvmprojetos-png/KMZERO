import { getApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { criarContaSecundaria, emailParaAuth, usuarioAtual } from "../firebase.js";

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
    return true;
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

export async function buscarEmpresaIdDoUsuario(firebaseUid) {
  const fb = cloudRefs();
  if (!fb) return null;
  try {
    const snap = await getDoc(doc(fb.db, "usuarios", firebaseUid));
    if (snap.exists()) return snap.data().empresaId;
    return null;
  } catch (e) {
    console.error("buscarEmpresaIdDoUsuario:", e);
    return null;
  }
}

export async function registrarEmpresa(dadosEmpresa, firebaseUid, nomeGestor, emailGestor) {
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
        email: emailGestor,
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

export async function registrarUsuarioEmpresa(firebaseUid, empresaId, nome, email, perfil) {
  const fb = cloudRefs();
  if (!fb) return false;
  try {
    await setDoc(doc(fb.db, "usuarios", firebaseUid), {
      empresaId, nome, email, perfil,
      criadoEm: Date.now(),
    });
    return true;
  } catch (e) {
    console.error("registrarUsuarioEmpresa:", e);
    return false;
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

/* Gestor cria o acesso de um lançador: conta no Firebase Auth + perfil em usuarios/{uid}.
   A partir daí a pessoa entra em QUALQUER celular com e-mail e senha. */
export async function criarAcessoLancador({ email, senha, nome, cargo, obraId, perfil, tel }) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return { ok: false, erro: "Empresa nao identificada. Saia e entre novamente como gestor." };
  const emailAuth = emailParaAuth(email);
  const conta = await criarContaSecundaria(emailAuth, senha);
  if (!conta.ok) return conta;

  // A conta já existia: garante que não estamos sobrescrevendo o perfil de outra pessoa
  if (conta.jaExistia) {
    const eu = usuarioAtual();
    if (eu && eu.uid === conta.uid) {
      return { ok: false, erro: "Esse e-mail e senha sao os da SUA conta de gestor. Crie o acesso da equipe com outro e-mail." };
    }
    let existente = null;
    try {
      const snap = await getDoc(doc(fb.db, "usuarios", conta.uid));
      existente = snap.exists() ? snap.data() : null;
    } catch (e) {
      // Sem permissão de leitura = perfil de outra empresa
      return { ok: false, erro: "Este login ja pertence a outra empresa. Use outro e-mail." };
    }
    if (existente && (existente.empresaId !== _empresaId || existente.perfil === "gestor")) {
      return { ok: false, erro: "Este login ja pertence a outra conta ou empresa. Use outro e-mail." };
    }
  }

  try {
    await setDoc(doc(fb.db, "usuarios", conta.uid), semUndefined({
      empresaId: _empresaId,
      nome, email: emailAuth,
      cargo: cargo || "Encarregado",
      obraId: obraId ?? null,
      perfil: perfil || "encarregado",
      tel: tel || "",
      ativo: true,
      criadoEm: Date.now(),
    }), { merge: true });
    return { ok: true, uid: conta.uid, emailAuth, jaExistia: conta.jaExistia };
  } catch (e) {
    console.error("criarAcessoLancador (perfil):", e);
    return {
      ok: false, uid: conta.uid, codigo: e.code,
      erro: e.code === "permission-denied"
        ? "A conta foi criada, mas o perfil nao pode ser gravado: publique as regras do Firebase (npm run firebase:deploy-regras) e salve de novo."
        : "A conta foi criada, mas o perfil nao pode ser gravado na nuvem. Tente novamente.",
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
