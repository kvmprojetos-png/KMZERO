/* Acesso de servidor ao Firebase (Vercel). A chave da conta de serviço fica SÓ na
   variável de ambiente FIREBASE_SERVICE_ACCOUNT do Vercel (JSON inteiro) — nunca no
   código nem no GitHub. Pastas/arquivos com "_" em api/ não viram rotas públicas. */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";

export function firebaseAdmin() {
  if (!getApps().length) {
    const bruto = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!bruto) throw new Error("Falta a variável FIREBASE_SERVICE_ACCOUNT no Vercel.");
    const conta = JSON.parse(bruto);
    if (conta.private_key) conta.private_key = conta.private_key.replace(/\\n/g, "\n");
    initializeApp({ credential: cert(conta) });
  }
  return { db: getFirestore(), auth: getAuth(), mensageiro: getMessaging() };
}
