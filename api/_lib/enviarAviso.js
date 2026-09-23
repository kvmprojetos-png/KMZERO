/* Entrega um aviso no celular de quem deve recebê-lo (Firebase Cloud Messaging).
   Quem recebe sai das regras de avisosRegras.js aplicadas aos perfis usuarios/{uid};
   os aparelhos estão em empresas/{empresaId}/pushTokens (um doc por aparelho). */
import { avisoEhPara } from "../../src/lib/avisosRegras.js";

const TOKEN_MORTO = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

export async function destinatarios(db, empresaId, aviso, { excetoUid } = {}) {
  const snap = await db.collection("usuarios").where("empresaId", "==", empresaId).get();
  return snap.docs
    .map(d => ({ firebaseUid: d.id, ...d.data() }))
    .filter(u => u.ativo !== false && u.firebaseUid !== excetoUid && avisoEhPara(aviso, u))
    .map(u => u.firebaseUid);
}

export async function enviarPush(db, mensageiro, empresaId, aviso, opcoes = {}) {
  const uids = new Set(await destinatarios(db, empresaId, aviso, opcoes));
  if (!uids.size) return { pessoas: 0, aparelhos: 0 };
  const toks = await db.collection("empresas").doc(empresaId).collection("pushTokens").get();
  const lista = toks.docs.filter(d => uids.has(d.data().uid) && d.data().token).map(d => ({ ref: d.ref, token: d.data().token }));
  if (!lista.length) return { pessoas: uids.size, aparelhos: 0 };

  // Só "data" (sem "notification"): quem desenha a notificação é o nosso service worker
  // (public/push-sw.js), igual em Android, PC e iPhone. Todos os valores têm de ser texto.
  const data = {
    titulo: String(aviso.titulo || "KMZERO").slice(0, 120),
    texto: String(aviso.texto || "").slice(0, 400),
    url: `/app/?aviso=${encodeURIComponent(aviso.id)}`,
    tag: `aviso-${aviso.id}`,
  };
  let aparelhos = 0;
  for (let i = 0; i < lista.length; i += 500) {
    const lote = lista.slice(i, i + 500);
    const r = await mensageiro.sendEachForMulticast({
      tokens: lote.map(x => x.token),
      webpush: { headers: { Urgency: "high", TTL: "86400" }, data },
    });
    r.responses.forEach((res, j) => {
      if (res.success) aparelhos++;
      else if (TOKEN_MORTO.has(res.error?.code)) lote[j].ref.delete().catch(() => {}); // app desinstalado / permissão tirada
    });
  }
  return { pessoas: uids.size, aparelhos };
}
