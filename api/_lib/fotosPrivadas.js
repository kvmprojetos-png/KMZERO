import { createHash } from "node:crypto";
import { FieldValue, FieldPath } from "firebase-admin/firestore";
import { caminhoFoto, referenciaFoto, idFotoValido, MAX_UPLOAD_FOTO_BYTES } from "../../src/lib/fotoCaminho.js";

export const MIME_FOTOS = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/avif"]);
export const CACHE_FOTOS = "private, no-store, max-age=0";

// Em GCS o PATCH com null remove a chave. Algumas versões do emulador Firebase
// mantêm tokens num campo interno separado. Se a releitura detectar isso, copy/
// rewrite atômico para o MESMO caminho recria a versão sem tokens, no servidor.
// Nunca baixa os pixels nem apaga o objeto. Usa geração fixa e confere checksum.
async function revogarTokensFoto(bucket, file, metadata) {
  await file.setMetadata({ cacheControl: CACHE_FOTOS, metadata: { firebaseStorageDownloadTokens: null } }, { ifMetagenerationMatch: metadata.metageneration });
  let [depois] = await file.getMetadata();
  if (depois.metadata?.firebaseStorageDownloadTokens) {
    if (!depois.generation || !depois.crc32c || !depois.size || depois.temporaryHold || depois.eventBasedHold || depois.retention) {
      throw Object.assign(new Error("Objeto exige revisão antes de regravação"), { code: "token-presente" });
    }
    const origem = bucket.file(file.name, { generation: depois.generation });
    const anterior = depois;
    const opcoes = { cacheControl: CACHE_FOTOS, metadata: { ...depois.metadata, firebaseStorageDownloadTokens: "" },
      preconditionOpts: { ifGenerationMatch: depois.generation } };
    for (const campo of ["contentType", "contentDisposition", "contentEncoding", "contentLanguage"]) if (depois[campo] !== undefined) opcoes[campo] = depois[campo];
    await origem.copy(file, opcoes);
    [depois] = await file.getMetadata();
    if (String(depois.size) !== String(anterior.size) || depois.crc32c !== anterior.crc32c
      || (anterior.md5Hash && depois.md5Hash !== anterior.md5Hash)) {
      throw Object.assign(new Error("Integridade divergente"), { code: "integridade-foto" });
    }
  }
  if (depois.metadata?.firebaseStorageDownloadTokens) throw Object.assign(new Error("Token não removido"), { code: "token-presente" });
}

export function podeAcessarFoto(perfil, empresaId, obraId) {
  if (!perfil || perfil.ativo === false || perfil.empresaId !== empresaId) return false;
  if (perfil.perfil === "gestor") return perfil.acessos == null
    || (Array.isArray(perfil.acessos) && perfil.acessos.includes("campo"));
  return perfil.perfil === "encarregado" && perfil.obraId != null && perfil.obraId !== ""
    && obraId != null && String(perfil.obraId) === String(obraId);
}

// Confere a assinatura binária, além do MIME fornecido. Nunca aceita SVG/HTML.
export function mimeRaster(bytes) {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) return "image/gif";
  if (bytes.length >= 14 && bytes.toString("ascii", 0, 2) === "BM") return "image/bmp";
  if (bytes.length >= 16 && bytes.toString("ascii", 4, 8) === "ftyp"
    && ["avif", "avis"].includes(bytes.toString("ascii", 8, 12))) return "image/avif";
  return "";
}

export function lerUploadFoto(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { empresaId, foto } = body;
  if (!idFotoValido(empresaId) || !foto || typeof foto !== "object" || Array.isArray(foto)
    || !["string", "number"].includes(typeof foto.id) || !["string", "number"].includes(typeof foto.obraId)
    || (typeof foto.id === "number" && !Number.isSafeInteger(foto.id))
    || (typeof foto.obraId === "number" && !Number.isSafeInteger(foto.obraId))
    || !idFotoValido(String(foto.id ?? "")) || !idFotoValido(String(foto.obraId ?? ""))) return null;
  if (typeof foto.foto !== "string" || foto.foto.length > MAX_UPLOAD_FOTO_BYTES * 4 / 3 + 100) return null;
  const partes = /^data:(image\/(?:jpeg|png|webp|gif|bmp|avif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(foto.foto);
  if (!partes) return null;
  const bytes = Buffer.from(partes[2], "base64");
  if (!bytes.length || bytes.length > MAX_UPLOAD_FOTO_BYTES || bytes.toString("base64") !== partes[2]
    || mimeRaster(bytes) !== partes[1]) return null;
  const meta = { id: String(foto.id), obraId: foto.obraId };
  for (const k of ["obraNome", "legenda", "autor", "data", "hora", "origemRDO"]) {
    if (foto[k] !== undefined) {
      if (!["string", "number"].includes(typeof foto[k]) || String(foto[k]).length > 2000) return null;
      meta[k] = foto[k];
    }
  }
  if (Number.isSafeInteger(foto.numero) && foto.numero >= 0) meta.numero = foto.numero;
  if (foto.origemDiario === true) meta.origemDiario = true;
  return { empresaId, meta, bytes, mime: partes[1], hash: createHash("sha256").update(bytes).digest("hex") };
}

/** Revoga links antigos sem baixar/expor os pixels. Chame SOMENTE após autenticar
 * o dono e criar seu backup. Duas etapas paginadas; repetição é segura. Em dry-run
 * não há nenhuma escrita. Nunca devolve tokens, URLs antigas ou dados cadastrais.
 */
export async function migrarFotosDaEmpresa({ db, bucket, empresaId, aplicar = false,
  etapa = "objetos", cursor = null, limite = 25 }) {
  if (!idFotoValido(empresaId) || !["objetos", "documentos"].includes(etapa)
    || !Number.isInteger(limite) || limite < 1 || limite > 50
    || (cursor !== null && (typeof cursor !== "string" || cursor.length > 4096))) throw new Error("Migração inválida.");
  const resultado = { etapa, aplicar, examinados: 0, alterados: 0, falhas: [], cursor: null, proximaEtapa: etapa, concluido: false };
  if (etapa === "objetos") {
    const prefix = `empresas/${empresaId}/fotosObras/`;
    const [files, proxima] = await bucket.getFiles({ prefix, maxResults: limite, autoPaginate: false, ...(cursor ? { pageToken: cursor } : {}) });
    for (const file of files) {
      // Defesa extra: a implementação do bucket também deve respeitar o prefixo.
      if (!file.name.startsWith(prefix) || file.name.slice(prefix.length).includes("/")) continue;
      resultado.examinados++;
      try {
        const [m] = await file.getMetadata();
        const precisa = !!m.metadata?.firebaseStorageDownloadTokens || m.cacheControl !== CACHE_FOTOS;
        if (precisa) {
          if (aplicar) {
            await revogarTokensFoto(bucket, file, m);
          }
          resultado.alterados++;
        }
      } catch (e) { resultado.falhas.push({ id: file.name.slice(prefix.length), codigo: String(e.code || "falha-migracao") }); }
    }
    resultado.cursor = proxima?.pageToken || null;
    if (!resultado.cursor) resultado.proximaEtapa = "documentos";
  } else {
    let consulta = db.collection("empresas").doc(empresaId).collection("fotosObras").orderBy(FieldPath.documentId()).limit(limite);
    if (cursor) consulta = consulta.startAfter(cursor);
    const snap = await consulta.get();
    for (const doc of snap.docs) {
      resultado.examinados++;
      try {
        const dados = { ...doc.data(), id: doc.id };
        const path = referenciaFoto(dados, empresaId)
          || (!dados.fotoPath && !dados.fotoUrl && !dados.foto ? caminhoFoto(empresaId, doc.id) : "");
        if (!path) throw Object.assign(new Error("Referência incompatível"), { code: "referencia-incompativel" });
        // Nunca remove uma referência sem antes confirmar que o objeto existe.
        const [m] = await bucket.file(path).getMetadata();
        if (aplicar && m.metadata?.firebaseStorageDownloadTokens) throw Object.assign(new Error("Revogação pendente"), { code: "revogacao-pendente" });
        if (dados.fotoPath !== path || dados.fotoUrl || dados.foto) {
          if (aplicar) await doc.ref.update({ fotoPath: path, fotoUrl: FieldValue.delete(), foto: FieldValue.delete(), acessoFoto: "autenticado" }, { lastUpdateTime: doc.updateTime });
          resultado.alterados++;
        }
      } catch (e) { resultado.falhas.push({ id: doc.id, codigo: String(e.code || "falha-migracao") }); }
    }
    resultado.cursor = snap.docs.length === limite ? snap.docs.at(-1).id : null;
    resultado.concluido = !resultado.cursor && !resultado.falhas.length;
    if (resultado.concluido) resultado.proximaEtapa = null;
  }
  return resultado;
}
