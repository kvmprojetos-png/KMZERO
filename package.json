/* ════════════════════════════════════════════════════
   FIREBASE — Módulo de configuração e autenticação
   Centraliza toda a comunicação com o Firebase para
   facilitar manutenção e migração futura.
══════════════════════════════════════════════════════ */

import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword as fbUpdatePassword,
} from "firebase/auth";

// ───────────────────────────────────────────────
// Configuração do projeto Firebase KMZero
// ───────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDzyxMJHHktgj8NLg4Rg_FaYv6KevBhtkE",
  authDomain: "kmzero-aca24.firebaseapp.com",
  projectId: "kmzero-aca24",
  storageBucket: "kmzero-aca24.firebasestorage.app",
  messagingSenderId: "448320016035",
  appId: "1:448320016035:web:bb1dc84259741d178eb916",
};

// Inicializa o Firebase uma única vez no carregamento da página
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

// ───────────────────────────────────────────────
// Funções públicas usadas pelo aplicativo
// ───────────────────────────────────────────────

/**
 * Faz login com email e senha.
 * Retorna { ok: true, user } se sucesso, ou { ok: false, erro } se falhar.
 */
export async function loginFirebase(email, senha) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, senha);
    return { ok: true, user: cred.user };
  } catch (e) {
    const msg = traduzErroFirebase(e.code);
    return { ok: false, erro: msg, codigo: e.code };
  }
}

/**
 * Faz logout do usuário atual.
 */
export async function logoutFirebase() {
  try {
    await signOut(auth);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

/**
 * Observa mudanças de estado de autenticação.
 * O callback recebe o usuário (ou null se não há login).
 * Retorna função para cancelar o observador.
 */
export function observarAutenticacao(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Solicita email de redefinição de senha.
 */
export async function recuperarSenha(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { ok: true };
  } catch (e) {
    const msg = traduzErroFirebase(e.code);
    return { ok: false, erro: msg };
  }
}

/**
 * Atualiza a senha do usuário logado.
 */
export async function atualizarSenha(novaSenha) {
  try {
    if (!auth.currentUser) {
      return { ok: false, erro: "Nenhum usuário logado." };
    }
    await fbUpdatePassword(auth.currentUser, novaSenha);
    return { ok: true };
  } catch (e) {
    const msg = traduzErroFirebase(e.code);
    return { ok: false, erro: msg };
  }
}

/**
 * Retorna o usuário atualmente logado (ou null).
 */
export function usuarioAtual() {
  return auth.currentUser;
}

// ───────────────────────────────────────────────
// Tradução de erros do Firebase para português
// ───────────────────────────────────────────────
function traduzErroFirebase(codigo) {
  const traducoes = {
    "auth/invalid-email": "Email inválido. Verifique o formato.",
    "auth/user-disabled": "Esta conta foi desativada. Procure o gestor.",
    "auth/user-not-found": "Email não cadastrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "Email ou senha incorretos.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos.",
    "auth/network-request-failed": "Sem conexão. Verifique a internet.",
    "auth/weak-password": "Senha muito fraca. Use pelo menos 6 caracteres.",
    "auth/email-already-in-use": "Este email já está cadastrado.",
    "auth/requires-recent-login": "Por segurança, faça login novamente para realizar esta operação.",
  };
  return traducoes[codigo] || "Não foi possível concluir a operação.";
}

export { auth, firebaseApp };
