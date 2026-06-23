import { getApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";

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

export function observarColecaoNuvem(colecao, callback) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return () => {};
  try {
    return onSnapshot(
      collection(fb.db, "empresas", _empresaId, colecao),
      snap => callback(snap.docs.map(d => d.data())),
      e => console.error("observarColecaoNuvem", colecao, e)
    );
  } catch (e) { console.error(e); return () => {}; }
}

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
    await setDoc(doc(fb.db, "usuarios", firebaseUid), {
      empresaId,
      nome: nomeGestor,
      email: emailGestor,
      perfil: "gestor",
      criadoEm: Date.now(),
    });
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

/* ── localStorage com prefixo dinâmico ── */

function storePrefix() {
  return _empresaId ? _empresaId + "_" : "kmzero_";
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
