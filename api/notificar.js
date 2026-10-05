/* POST /api/notificar  { empresaId, avisoId }   Authorization: Bearer <ID token do Firebase>
   O app grava o aviso no Firestore e chama esta rota para ele tocar nos celulares.
   Segurança: só quem é da empresa e escreveu o aviso pode disparar; encarregado só
   dispara para gestores ou para uma pessoa; cada aviso só é disparado uma vez. */
import { firebaseAdmin } from "./_lib/firebaseAdmin.js";
import { enviarPush } from "./_lib/enviarAviso.js";

const ERROS_LOGIN = new Set([
  "auth/argument-error", "auth/invalid-id-token", "auth/id-token-expired",
  "auth/id-token-revoked", "auth/user-disabled", "auth/user-not-found",
]);
const idDocumentoValido = valor => typeof valor === "string" && valor.length > 0
  && Buffer.byteLength(valor, "utf8") <= 1500
  && !/[\/\u0000-\u001f\u007f]/.test(valor)
  && valor !== "." && valor !== ".." && !/^__.*__$/.test(valor);

function validarPedido(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ erro: "Use POST." });
    return null;
  }
  const authorization = req.headers?.authorization;
  const bearer = typeof authorization === "string" && authorization.length <= 16384
    ? /^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authorization) : null;
  if (!bearer) {
    res.status(401).json({ erro: "Sem login." });
    return null;
  }
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)
    || !idDocumentoValido(body.empresaId) || !idDocumentoValido(body.avisoId)) {
    res.status(400).json({ erro: "empresaId e avisoId devem ser identificadores válidos." });
    return null;
  }
  return { idToken: bearer[1], empresaId: body.empresaId, avisoId: body.avisoId };
}

export default async function handler(req, res) {
  // Rejeita entradas inválidas antes de inicializar credenciais e serviços.
  if (!validarPedido(req, res)) return;
  let admin;
  try { admin = firebaseAdmin(); }
  catch (e) {
    console.error("notificar: configuração indisponível", e.code || "falha-interna");
    return res.status(503).json({ erro: "Notificações indisponíveis no servidor." });
  }
  return tratarNotificar(admin, req, res);
}

// Separado do handler para poder ser testado com um Firestore de mentira
export async function tratarNotificar({ db, auth, mensageiro }, req, res) {
  const pedido = validarPedido(req, res);
  if (!pedido) return;
  try {
    const { idToken, empresaId, avisoId } = pedido;
    // Também recusa sessões revogadas e contas desativadas no Firebase Auth.
    const eu = await auth.verifyIdToken(idToken, true);

    const perfil = (await db.collection("usuarios").doc(eu.uid).get()).data();
    if (!perfil || perfil.ativo === false || perfil.empresaId !== empresaId) return res.status(403).json({ erro: "Sem acesso a esta empresa." });

    const ref = db.collection("empresas").doc(empresaId).collection("avisos").doc(String(avisoId));
    // Transação: marca "disparado" antes de enviar, para dois cliques não mandarem em dobro
    const aviso = await db.runTransaction(async tx => {
      const s = await tx.get(ref);
      if (!s.exists) return { erro: 404 };
      const a = s.data();
      if (a.de !== eu.uid) return { erro: 403 };
      if (perfil.perfil !== "gestor" && !["gestores", "pessoa"].includes(a.para?.tipo)) return { erro: 403 };
      if (a.push?.disparadoEm) return { erro: 409 };
      tx.update(ref, { "push.disparadoEm": Date.now() });
      return { ...a, id: String(avisoId) };
    });
    if (aviso.erro === 404) return res.status(404).json({ erro: "Aviso não encontrado." });
    if (aviso.erro === 403) return res.status(403).json({ erro: "Você não pode disparar este aviso." });
    if (aviso.erro === 409) return res.status(200).json({ ok: true, jaEnviado: true });

    const r = await enviarPush(db, mensageiro, empresaId, aviso, { excetoUid: aviso.tipo === "teste" ? null : eu.uid });
    await ref.update({ "push.pessoas": r.pessoas, "push.aparelhos": r.aparelhos });
    return res.status(200).json({ ok: true, ...r });
  } catch (e) {
    const semLogin = ERROS_LOGIN.has(e.code);
    if (!semLogin) console.error("notificar:", e.code || "falha-interna");
    return res.status(semLogin ? 401 : 500).json({ erro: semLogin ? "Login expirado. Entre de novo." : "Falha ao enviar." });
  }
}
