import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, updatePassword as fbUpdatePassword } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
     apiKey: "AIzaSyDzyxMJHHktgj8NLg4Rg_FaYv6KevBhtkE",
     authDomain: "kmzero-aca24.firebaseapp.com",
     projectId: "kmzero-aca24",
     storageBucket: "kmzero-aca24.firebasestorage.app",
     messagingSenderId: "448320016035",
     appId: "1:448320016035:web:bb1dc84259741d178eb916",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

export async function loginFirebase(email, senha) {
     try {
            const cred = await signInWithEmailAndPassword(auth, email, senha);
            return { ok: true, user: cred.user };
     } catch (e) {
            const msg = traduzErroFirebase(e.code);
            return { ok: false, erro: msg, codigo: e.code };
     }
}

export async function logoutFirebase() {
     try {
            await signOut(auth);
            return { ok: true };
     } catch (e) {
            return { ok: false, erro: e.message };
     }
}

export function observarAutenticacao(callback) {
     return onAuthStateChanged(auth, callback);
}

export async function recuperarSenha(email) {
     try {
            await sendPasswordResetEmail(auth, email);
            return { ok: true };
     } catch (e) {
            const msg = traduzErroFirebase(e.code);
            return { ok: false, erro: msg };
     }
}

export async function atualizarSenha(novaSenha) {
     try {
            if (!auth.currentUser) {
                     return { ok: false, erro: "Nenhum usuario logado." };
            }
            await fbUpdatePassword(auth.currentUser, novaSenha);
            return { ok: true };
     } catch (e) {
            const msg = traduzErroFirebase(e.code);
            return { ok: false, erro: msg };
     }
}

export function usuarioAtual() {
     return auth.currentUser;
}

function traduzErroFirebase(codigo) {
     const traducoes = {
            "auth/invalid-email": "Email invalido. Verifique o formato.",
            "auth/user-disabled": "Esta conta foi desativada. Procure o gestor.",
            "auth/user-not-found": "Email nao cadastrado.",
            "auth/wrong-password": "Senha incorreta.",
            "auth/invalid-credential": "Email ou senha incorretos.",
            "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos.",
            "auth/network-request-failed": "Sem conexao. Verifique a internet.",
            "auth/weak-password": "Senha muito fraca. Use pelo menos 6 caracteres.",
            "auth/email-already-in-use": "Este email ja esta cadastrado.",
            "auth/requires-recent-login": "Por seguranca, faca login novamente para realizar esta operacao.",
     };
     return traducoes[codigo] || "Nao foi possivel concluir a operacao.";
}

export async function criarContaFirebase(email, senha) {
     try {
            const cred = await createUserWithEmailAndPassword(auth, email, senha);
            return { ok: true, user: cred.user };
     } catch (e) {
            const msg = traduzErroFirebase(e.code);
            return { ok: false, erro: msg, codigo: e.code };
     }
}

export { auth, firebaseApp, db };
