import { getStorage } from "firebase-admin/storage";
import { firebaseAdmin } from "./_lib/firebaseAdmin.js";
import { CACHE_FOTOS, MIME_FOTOS, lerUploadFoto, podeAcessarFoto } from "./_lib/fotosPrivadas.js";
import { BUCKET_FOTOS, caminhoFoto, idFotoValido, MAX_FOTO_BYTES, PARTE_FOTO_BYTES } from "../src/lib/fotoCaminho.js";

const ERROS_LOGIN = new Set(["auth/argument-error", "auth/invalid-id-token", "auth/id-token-expired", "auth/id-token-revoked", "auth/user-disabled", "auth/user-not-found"]);

function pedidoFoto(req, res) {
  res.setHeader("Cache-Control", CACHE_FOTOS);
  res.setHeader("Vary", "Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST"); res.status(405).json({ erro: "Use GET ou POST." }); return null;
  }
  const h = req.headers?.authorization;
  const token = typeof h === "string" && h.length <= 16384 ? /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(h)?.[1] : null;
  if (!token) { res.status(401).json({ erro: "Sem login." }); return null; }
  if (req.method === "POST") {
    if (Number(req.headers?.["content-length"] || 0) > 4.3 * 1024 * 1024) { res.status(413).json({ erro: "Foto muito grande." }); return null; }
    const upload = lerUploadFoto(req.body);
    if (!upload) { res.status(400).json({ erro: "Foto inválida. Use uma imagem de até 3 MB." }); return null; }
    return { token, ...upload, fotoId: upload.meta.id };
  }
  const { empresaId, fotoId, parte = "0" } = req.query || {};
  if (!idFotoValido(empresaId) || !idFotoValido(fotoId) || typeof parte !== "string" || !/^\d{1,2}$/.test(parte) || Number(parte) > 9) {
    res.status(400).json({ erro: "Foto inválida." }); return null;
  }
  return { token, empresaId, fotoId, parte: Number(parte) };
}

export default async function handler(req, res) {
  if (!pedidoFoto(req, res)) return;
  let admin;
  try { admin = { ...firebaseAdmin(), bucket: getStorage().bucket(BUCKET_FOTOS) }; }
  catch (e) { console.error("foto: configuração indisponível", e.code || "falha-interna"); return res.status(503).json({ erro: "Fotos indisponíveis no servidor." }); }
  return tratarFoto(admin, req, res);
}

export async function tratarFoto({ db, auth, bucket }, req, res) {
  const p = pedidoFoto(req, res);
  if (!p) return;
  try {
    const eu = await auth.verifyIdToken(p.token, true);
    const perfil = (await db.collection("usuarios").doc(eu.uid).get()).data();
    if (!perfil || perfil.ativo === false || perfil.empresaId !== p.empresaId) return res.status(403).json({ erro: "Sem acesso à foto." });
    const fotoRef = db.collection("empresas").doc(p.empresaId).collection("fotosObras").doc(p.fotoId);
    const anterior = await fotoRef.get();
    const registro = req.method === "POST" ? p.meta : anterior.data();
    if (!registro && req.method === "GET") return res.status(404).json({ erro: "Foto não encontrada." });
    if (!podeAcessarFoto(perfil, p.empresaId, registro?.obraId)) return res.status(403).json({ erro: "Sem acesso à foto." });
    const path = caminhoFoto(p.empresaId, p.fotoId);
    const file = bucket.file(path);
    if (req.method === "POST") {
      if (anterior.exists && (anterior.data().autorUid !== eu.uid || anterior.data().fotoHash !== p.hash)) {
        return res.status(409).json({ erro: "Já existe uma foto com este identificador." });
      }
      const obra = await db.collection("empresas").doc(p.empresaId).collection("obras").doc(String(p.meta.obraId)).get();
      if (!obra.exists) return res.status(400).json({ erro: "Obra não encontrada." });
      try {
        // GCS Admin save não cria Firebase downloadTokens; objeto novo, privado.
        // precondition evita que concorrência/collision sobrescreva outra foto.
        await file.save(p.bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 },
          metadata: { contentType: p.mime, cacheControl: CACHE_FOTOS, metadata: { autorUid: eu.uid, fotoHash: p.hash } } });
      } catch (e) {
        if (Number(e.code) !== 412) throw e;
        const [m] = await file.getMetadata();
        if (m.metadata?.autorUid !== eu.uid || m.metadata?.fotoHash !== p.hash) return res.status(409).json({ erro: "Já existe uma foto com este identificador." });
      }
      if (!anterior.exists) {
        try {
          await fotoRef.create({ ...p.meta, autor: perfil.nome || p.meta.autor || "", fotoPath: path,
            autorUid: eu.uid, fotoHash: p.hash, acessoFoto: "autenticado", criadoEm: Date.now() });
        } catch (e) {
          if (![6, 409].includes(Number(e.code))) throw e;
          const existente = (await fotoRef.get()).data();
          if (existente?.autorUid !== eu.uid || existente?.fotoHash !== p.hash) return res.status(409).json({ erro: "Já existe uma foto com este identificador." });
        }
      }
      return res.status(200).json({ ok: true, fotoPath: path });
    }
    const [meta] = await file.getMetadata();
    const tamanho = Number(meta.size);
    if (!MIME_FOTOS.has(meta.contentType) || !Number.isSafeInteger(tamanho) || tamanho < 1 || tamanho >= MAX_FOTO_BYTES) {
      return res.status(415).json({ erro: "Arquivo de foto inválido." });
    }
    const inicio = p.parte * PARTE_FOTO_BYTES;
    if (inicio >= tamanho) return res.status(416).json({ erro: "Parte de foto inválida." });
    const fim = Math.min(tamanho - 1, inicio + PARTE_FOTO_BYTES - 1);
    // Partes de até 1 MB também preservam fotos antigas de 3–10 MB sem ultrapassar
    // o limite de resposta da Vercel. Toda parte revalida login e acesso à obra.
    const arquivoDaVersao = meta.generation ? bucket.file(path, { generation: meta.generation }) : file;
    const [bytes] = await arquivoDaVersao.download({ start: inicio, end: fim, validation: false });
    if (bytes.length !== fim - inicio + 1) throw new Error("Tamanho inesperado");
    res.setHeader("Content-Type", meta.contentType);
    res.setHeader("Content-Length", bytes.length);
    res.setHeader("Content-Disposition", 'inline; filename="foto"');
    res.setHeader("X-KM-Foto-Partes", Math.ceil(tamanho / PARTE_FOTO_BYTES));
    res.setHeader("X-KM-Foto-Tamanho", tamanho);
    res.setHeader("X-KM-Foto-Versao", String(meta.generation || ""));
    return res.status(200).send(bytes);
  } catch (e) {
    if (ERROS_LOGIN.has(e.code)) return res.status(401).json({ erro: "Login expirado. Entre de novo." });
    if (Number(e.code) === 404) return res.status(404).json({ erro: "Foto não encontrada." });
    console.error("foto:", e.code || "falha-interna");
    return res.status(500).json({ erro: "Não foi possível acessar a foto." });
  }
}
