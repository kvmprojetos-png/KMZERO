// Identificadores de fotos, compartilhados entre cliente, API e migração.
// URLs antigas são apenas interpretadas; nunca acessadas com seu token público.
export const BUCKET_FOTOS = "kmzero-aca24.firebasestorage.app";
export const MAX_FOTO_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_FOTO_BYTES = 3 * 1024 * 1024;
export const PARTE_FOTO_BYTES = 1024 * 1024;

export function idFotoValido(v) {
  return typeof v === "string" && v.length > 0 && v.length <= 200
    && !/[\/\\\u0000-\u001f\u007f]/.test(v) && v !== "." && v !== ".."
    && !/^__.*__$/.test(v);
}

export function caminhoFoto(empresaId, fotoId) {
  if (!idFotoValido(empresaId) || !idFotoValido(fotoId)) return "";
  return `empresas/${empresaId}/fotosObras/${fotoId}.jpg`;
}

export function caminhoFotoLegada(valor, empresaId, fotoId) {
  const esperado = caminhoFoto(empresaId, fotoId);
  if (!esperado || typeof valor !== "string") return "";
  if (valor === esperado) return esperado;
  try {
    const url = new URL(valor);
    if (url.protocol !== "https:" || url.hostname !== "firebasestorage.googleapis.com"
      || url.port || url.username || url.password) return "";
    const prefixo = `/v0/b/${BUCKET_FOTOS}/o/`;
    if (!url.pathname.startsWith(prefixo)) return "";
    return decodeURIComponent(url.pathname.slice(prefixo.length)) === esperado ? esperado : "";
  } catch { return ""; }
}

export function referenciaFoto(registro, empresaId) {
  if (!registro || registro.id === undefined || registro.id === null) return "";
  const id = String(registro.id);
  return caminhoFotoLegada(registro.fotoPath, empresaId, id)
    || caminhoFotoLegada(registro.fotoUrl, empresaId, id)
    || caminhoFotoLegada(registro.foto, empresaId, id);
}

// Entrada do cache/backup: referências antigas viram caminho privado; URLs nunca
// voltam para IMG/PDF. Só preservar raster/base64 ainda sem envio confirmado.
export function normalizarFotoLocalPrivada(registro, empresaId) {
  if (!registro || typeof registro !== "object" || Array.isArray(registro)) return null;
  const { fotoUrl: _url, foto: original, ...meta } = registro;
  const path = referenciaFoto(registro, empresaId);
  if (path) return { ...meta, fotoPath: path, acessoFoto: "autenticado" };
  const pendente = !registro.fotoPath && typeof original === "string"
    && /^data:image\/(?:jpeg|png|webp|gif|bmp|avif);base64,[A-Za-z0-9+/]+={0,2}$/.test(original);
  return pendente ? { ...meta, foto: original } : { ...meta, fotoIndisponivel: true };
}
