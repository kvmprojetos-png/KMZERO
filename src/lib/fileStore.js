import { getEmpresaId } from "./store.js";

export const FILE_DB_VERSION = 1;
export const FILE_STORE_NAME = "anexos";

export function getFileDBName() {
  const eid = getEmpresaId();
  return eid ? `${eid}_files` : "kmzero_files";
}

let _dbInstance = null;
let _dbName = null;

export function openFileDB(empresaId) {
  const dbName = empresaId ? `${empresaId}_files` : getFileDBName();
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
    req.onsuccess = () => {
      _dbInstance = req.result;
      // Uma limpeza em outra aba deve conseguir fechar esta conexão. Nenhum
      // dado é removido por este evento; a guarda de logout coordena a operação.
      req.result.onversionchange = () => {
        req.result.close();
        if (_dbInstance === req.result) { _dbInstance = null; _dbName = null; }
      };
      resolve(req.result);
    };
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

export async function listarAnexosLocais(empresaId) {
  const db = await openFileDB(empresaId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction([FILE_STORE_NAME], "readonly");
    const req = tx.objectStore(FILE_STORE_NAME).getAll();
    let anexos = [];
    req.onsuccess = () => { anexos = req.result || []; };
    tx.oncomplete = () => resolve(anexos);
    tx.onerror = tx.onabort = () => reject(tx.error || new Error("Não foi possível ler todos os anexos para o backup."));
  });
}

export function fecharBancoAnexos() {
  if (_dbInstance) _dbInstance.close();
  _dbInstance = null;
  _dbName = null;
}

export function apagarBancoAnexos(empresaId) {
  if (!empresaId || empresaId === "demo") throw new Error("Empresa inválida para a limpeza de saída.");
  fecharBancoAnexos();
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(`${empresaId}_files`);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error("Não foi possível apagar os anexos deste aparelho."));
    req.onblocked = () => reject(new Error("Feche as outras abas do KMZERO para limpar os anexos deste aparelho."));
  });
}

/* Restaura numa única transação: conflito de id nunca sobrescreve um arquivo
   diferente. Os ids originais são preservados para manter as referências. */
export async function restaurarAnexosLocais(anexos, empresaId) {
  if (!Array.isArray(anexos)) throw new Error("Lista de anexos inválida no backup.");
  if (!anexos.length) return 0;
  const ids = new Set();
  for (const a of anexos) {
    if (!a || typeof a.id !== "string" || !a.id || ids.has(a.id) || typeof a.conteudoBase64 !== "string" || !a.conteudoBase64.startsWith("data:")) {
      throw new Error("Um anexo do backup está inválido ou repetido. Nenhum anexo foi restaurado.");
    }
    ids.add(a.id);
  }
  const db = await openFileDB(empresaId);
  const estavel = v => Array.isArray(v) ? v.map(estavel) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, estavel(v[k])])) : v;
  return new Promise((resolve, reject) => {
    const tx = db.transaction([FILE_STORE_NAME], "readwrite");
    const os = tx.objectStore(FILE_STORE_NAME);
    const req = os.getAll();
    let novos = 0;
    let erro = null;
    req.onsuccess = () => {
      const existentes = new Map((req.result || []).map(a => [a.id, a]));
      for (const a of anexos) {
        const anterior = existentes.get(a.id);
        if (anterior && JSON.stringify(estavel(anterior)) !== JSON.stringify(estavel(a))) {
          erro = new Error(`O anexo ${a.nomeOriginal || a.id} já existe com conteúdo diferente. Nenhum anexo foi restaurado; preserve os dois backups e confira o conflito.`);
          tx.abort();
          return;
        }
      }
      for (const a of anexos) if (!existentes.has(a.id)) { os.put(a); novos++; }
    };
    tx.oncomplete = () => resolve(novos);
    tx.onerror = tx.onabort = () => reject(erro || tx.error || new Error("Não foi possível restaurar os anexos. O backup original foi preservado."));
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
        tx.oncomplete = () => resolve(arquivo);
        tx.onerror = tx.onabort = () => reject(tx.error || req.error || new Error("Não foi possível salvar o anexo."));
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
