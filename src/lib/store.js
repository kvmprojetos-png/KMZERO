import { getApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";

export const EMPRESA_ID = "kmzero"; // mono-empresa por ora; vira {empresaId} na migração multi-tenant

let _fb = null;
export function cloudRefs() {
  if (_fb) return _fb;
  try {
    const app = getApp();
    _fb = { db: getFirestore(app), st: getStorage(app) };
  } catch (e) {
    console.warn("Firebase não inicializado — sync de fotos desativada:", e);
    _fb = null;
  }
  return _fb;
}

export async function enviarFotoNuvem(f) {
  const fb = cloudRefs();
  if (!fb) return false;
  try {
    const id = String(f.id);
    const r = storageRef(fb.st, `empresas/${EMPRESA_ID}/fotosObras/${id}.jpg`);
    await uploadString(r, f.foto, "data_url");
    const url = await getDownloadURL(r);
    const { foto, ...meta } = f; // não grava base64 no Firestore (limite 1MB/doc)
    await setDoc(doc(fb.db, "empresas", EMPRESA_ID, "fotosObras", id), {
      ...meta, id, fotoUrl: url, criadoEm: Date.now(),
    });
    return true;
  } catch (e) {
    console.error("enviarFotoNuvem:", e);
    return false; // offline ou regra negada: foto continua salva local
  }
}

export function observarFotosNuvem(callback) {
  const fb = cloudRefs();
  if (!fb) return () => {};
  try {
    return onSnapshot(
      collection(fb.db, "empresas", EMPRESA_ID, "fotosObras"),
      snap => callback(snap.docs.map(d => { const x = d.data(); return { ...x, foto: x.fotoUrl }; })),
      e => console.error("observarFotosNuvem:", e)
    );
  } catch (e) { console.error(e); return () => {}; }
}

/* ── Sync genérica de coleções (pedidos, presenças, ...) ── */
export const semUndefined = (o) => JSON.parse(JSON.stringify(o)); // Firestore rejeita undefined

export async function enviarDocNuvem(colecao, id, dados) {
  const fb = cloudRefs();
  if (!fb) return false;
  try {
    await setDoc(doc(fb.db, "empresas", EMPRESA_ID, colecao, String(id)), semUndefined(dados));
    return true;
  } catch (e) {
    console.error("enviarDocNuvem", colecao, e);
    return false; // offline: dado continua salvo local
  }
}

export async function removerDocNuvem(colecao, id) {
  const fb = cloudRefs();
  if (!fb) return false;
  try { await deleteDoc(doc(fb.db, "empresas", EMPRESA_ID, colecao, String(id))); return true; }
  catch (e) { console.error("removerDocNuvem", colecao, e); return false; }
}

export function observarColecaoNuvem(colecao, callback) {
  const fb = cloudRefs();
  if (!fb) return () => {};
  try {
    return onSnapshot(
      collection(fb.db, "empresas", EMPRESA_ID, colecao),
      snap => callback(snap.docs.map(d => d.data())),
      e => console.error("observarColecaoNuvem", colecao, e)
    );
  } catch (e) { console.error(e); return () => {}; }
}


export const store = {
  async get(key) {
    try {
      // Tenta localStorage primeiro (Vercel/produção)
      const v = localStorage.getItem("kmzero_" + key);
      if (v) return JSON.parse(v);
      // Fallback pra storage do Claude.ai (durante desenvolvimento)
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
      // Salva no localStorage (Vercel/produção)
      localStorage.setItem("kmzero_" + key, json);
      // Espelha no storage do Claude.ai se disponível
      if (typeof window !== "undefined" && window.storage && window.storage.set) {
        try { await window.storage.set(key, json); } catch {}
      }
    } catch (e) {
      console.warn("store.set error:", e);
      // localStorage cheio? Tenta limpar e salvar
      if (e.name === "QuotaExceededError") {
        alert("⚠️ Armazenamento cheio! Faça backup e limpe dados antigos.");
      }
    }
  },
  async clear() {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith("kmzero_"));
      keys.forEach(k => localStorage.removeItem(k));
    } catch (e) { console.warn(e); }
  }
};

/* ════════════════════════════════════════════════════
   FILE STORE — Armazenamento de arquivos via IndexedDB
   Preparado para migração futura ao Firebase/Supabase Storage
══════════════════════════════════════════════════════ */
