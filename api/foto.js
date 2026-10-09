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

// uid do payload do JWT, lido SEM verificar: serve só para adiantar a leitura do
// perfil em paralelo com verifyIdToken. Só é usado se bater com o uid verificado.
// Só "parece válido" o token com forma de login Firebase DESTE projeto e ainda no prazo;
// qualquer outro (lixo, outro projeto, vencido) é recusado por verifyIdToken ANTES de
// qualquer leitura, para pedido anônimo não gerar leituras nem diferença de tempo.
const PROJETO_FIREBASE = BUCKET_FOTOS.split(".")[0];
function uidNaoVerificado(token) {
  try {
    const [cab, corpo] = token.split(".").slice(0, 2).map(p => JSON.parse(Buffer.from(p, "base64url").toString("utf8")));
    if (cab?.alg !== "RS256" || typeof cab?.kid !== "string" || !cab.kid) return null;
    if (corpo?.aud !== PROJETO_FIREBASE || corpo?.iss !== `https://securetoken.google.com/${PROJETO_FIREBASE}`) return null;
    if (!Number.isFinite(corpo?.exp) || corpo.exp * 1000 <= Date.now()) return null;
    const uid = corpo?.user_id ?? corpo?.sub;
    return idFotoValido(uid) && uid.length <= 128 ? uid : null;
  } catch { return null; }
}

// GET: as quatro leituras ao Google saem juntas (eram cinco em série), mas são
// avaliadas na mesma ordem de antes — login, perfil, registro, acesso à obra e só
// então os metadados do objeto. Nenhum byte é baixado antes de tudo passar.
async function lerFoto({ db, auth, bucket }, p, res) {
  const uidLido = uidNaoVerificado(p.token);
  const lerPerfil = async uid => (await db.collection("usuarios").doc(uid).get()).data();
  const fotoRef = db.collection("empresas").doc(p.empresaId).collection("fotosObras").doc(p.fotoId);
  const path = caminhoFoto(p.empresaId, p.fotoId);
  const file = bucket.file(path);
  const verificacao = auth.verifyIdToken(p.token, true);
  if (!uidLido) await verificacao; // token sem forma válida: lança (→ 401) antes de qualquer leitura
  const [rEu, rPerfil, rRegistro, rMeta] = await Promise.allSettled([
    verificacao,
    uidLido ? lerPerfil(uidLido) : Promise.resolve(undefined),
    fotoRef.get(),
    file.getMetadata(),
  ]);
  if (rEu.status === "rejected") throw rEu.reason;
  const eu = rEu.value;
  let perfil;
  if (uidLido && eu.uid === uidLido) {
    if (rPerfil.status === "rejected") throw rPerfil.reason;
    perfil = rPerfil.value;
  } else perfil = await lerPerfil(eu.uid); // payload adulterado ou ilegível: relê pelo uid verificado
  if (!perfil || perfil.ativo === false || perfil.empresaId !== p.empresaId) return res.status(403).json({ erro: "Sem acesso à foto." });
  if (rRegistro.status === "rejected") throw rRegistro.reason;
  const registro = rRegistro.value.data();
  if (!registro) return res.status(404).json({ erro: "Foto não encontrada." });
  if (!podeAcessarFoto(perfil, p.empresaId, registro?.obraId)) return res.status(403).json({ erro: "Sem acesso à foto." });
  if (rMeta.status === "rejected") throw rMeta.reason; // 404 do objeto só depois de todas as checagens de acesso
  const [meta] = rMeta.value;
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
}

export async function tratarFoto({ db, auth, bucket }, req, res) {
  const p = pedidoFoto(req, res);
  if (!p) return;
  try {
    if (req.method === "GET") return await lerFoto({ db, auth, bucket }, p, res);
    const eu = await auth.verifyIdToken(p.token, true);
    const perfil = (await db.collection("usuarios").doc(eu.uid).get()).data();
    if (!perfil || perfil.ativo === false || perfil.empresaId !== p.empresaId) return res.status(403).json({ erro: "Sem acesso à foto." });
    const fotoRef = db.collection("empresas").doc(p.empresaId).collection("fotosObras").doc(p.fotoId);
    const anterior = await fotoRef.get();
    const registro = p.meta;
    if (!podeAcessarFoto(perfil, p.empresaId, registro?.obraId)) return res.status(403).json({ erro: "Sem acesso à foto." });
    const path = caminhoFoto(p.empresaId, p.fotoId);
    const file = bucket.file(path);
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
  } catch (e) {
    if (ERROS_LOGIN.has(e.code)) return res.status(401).json({ erro: "Login expirado. Entre de novo." });
    if (Number(e.code) === 404) return res.status(404).json({ erro: "Foto não encontrada." });
    console.error("foto:", e.code || "falha-interna");
    return res.status(500).json({ erro: "Não foi possível acessar a foto." });
  }
}
