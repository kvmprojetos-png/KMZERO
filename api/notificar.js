/* POST /api/notificar  { empresaId, avisoId }   Authorization: Bearer <ID token do Firebase>
   O app grava o aviso no Firestore e chama esta rota para ele tocar nos celulares.
   Segurança: só quem é da empresa e escreveu o aviso pode disparar; encarregado só
   dispara para gestores ou para uma pessoa; cada aviso só é disparado uma vez. */
import { firebaseAdmin } from "./_lib/firebaseAdmin.js";
import { enviarPush } from "./_lib/enviarAviso.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST." });
  let admin;
  try { admin = firebaseAdmin(); }
  catch (e) { return res.status(503).json({ erro: "Notificações ainda não configuradas no servidor.", detalhe: e.message }); }
  return tratarNotificar(admin, req, res);
}

// Separado do handler para poder ser testado com um Firestore de mentira
export async function tratarNotificar({ db, auth, mensageiro }, req, res) {
  try {
    const idToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!idToken) return res.status(401).json({ erro: "Sem login." });
    const eu = await auth.verifyIdToken(idToken);

    const { empresaId, avisoId } = req.body || {};
    if (!empresaId || !avisoId) return res.status(400).json({ erro: "Faltam empresaId/avisoId." });

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
    console.error("notificar:", e);
    const semLogin = /id token|auth\//i.test(String(e.message || e.code || ""));
    return res.status(semLogin ? 401 : 500).json({ erro: semLogin ? "Login expirado. Entre de novo." : "Falha ao enviar.", detalhe: String(e.message || e) });
  }
}
