import { getEmpresaId } from "./store.js";

export const FILE_DB_VERSION = 1;
export const FILE_STORE_NAME = "anexos";

export function getFileDBName() {
  const eid = getEmpresaId();
  return eid ? `${eid}_files` : "kmzero_files";
}

let _dbInstance = null;
let _dbName = null;

export function openFileDB() {
  const dbName = getFileDBName();
  if (_dbInstance && _dbName === dbName) return Promise.resolve(_dbInstance);
  if (_dbInstance) { try { _dbInstance.close(); } catch(e) {} _dbInstance = null; }
  _dbName = dbName;
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB não disponível neste navegador"));
      return;
    }
    const req = indexedDB.open(dbName, FILE_DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { _dbInstance = req.result; resolve(req.result); };
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(FILE_STORE_NAME)) {
        const os = db.createObjectStore(FILE_STORE_NAME, { keyPath: "id" });
        os.createIndex("obraId", "obraId", { unique: false });
        os.createIndex("uploadedAt", "uploadedAt", { unique: false });
      }
    };
  });
}

export const fileStore = {
  async save(arquivo) {
    try {
      const db = await openFileDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([FILE_STORE_NAME], "readwrite");
        const os = tx.objectStore(FILE_STORE_NAME);
        const req = os.put(arquivo);
        req.onsuccess = () => resolve(arquivo);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { console.error("fileStore.save:", e); throw e; }
  },

  async get(id) {
    try {
      const db = await openFileDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([FILE_STORE_NAME], "readonly");
        const os = tx.objectStore(FILE_STORE_NAME);
        const req = os.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { console.error("fileStore.get:", e); return null; }
  },

  async listByObra(obraId) {
    try {
      const db = await openFileDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([FILE_STORE_NAME], "readonly");
        const os = tx.objectStore(FILE_STORE_NAME);
        const idx = os.index("obraId");
        const req = idx.getAll(obraId);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { console.error("fileStore.listByObra:", e); return []; }
  },

  async delete(id) {
    try {
      const db = await openFileDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([FILE_STORE_NAME], "readwrite");
        const os = tx.objectStore(FILE_STORE_NAME);
        const req = os.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { console.error("fileStore.delete:", e); return false; }
  },

  async getQuotaInfo() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        return {
          usado: est.usage || 0,
          total: est.quota || 0,
          percentual: est.quota ? (est.usage / est.quota * 100) : 0,
        };
      }
      return null;
    } catch { return null; }
  },
};

export function lerArquivoComoBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function formatarTamanhoBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function iconePorTipoArquivo(mime, nome) {
  const n = (nome || "").toLowerCase();
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp)$/.test(n)) return "\u{1F5BC}️";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "\u{1F4D5}";
  if (m.includes("spreadsheet") || m.includes("excel") || /\.(xlsx|xls|csv|ods)$/.test(n)) return "\u{1F4CA}";
  if (m.includes("word") || m.includes("document") || /\.(docx|doc|odt|rtf)$/.test(n)) return "\u{1F4DD}";
  if (m.includes("presentation") || /\.(pptx|ppt|odp)$/.test(n)) return "\u{1F4C8}";
  if (m.startsWith("video/") || /\.(mp4|mov|avi|mkv|webm)$/.test(n)) return "\u{1F3AC}";
  if (m.startsWith("audio/") || /\.(mp3|wav|m4a|ogg)$/.test(n)) return "\u{1F3B5}";
  if (/\.(zip|rar|7z|tar|gz)$/.test(n)) return "\u{1F5DC}️";
  if (/\.(dwg|dxf|rvt|ifc)$/.test(n)) return "\u{1F4D0}";
  return "\u{1F4C4}";
}
