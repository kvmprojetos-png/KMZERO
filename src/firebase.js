import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

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
auth.languageCode = "pt-BR";

/* Firestore com cache persistente (IndexedDB): o app é offline-first, então
   (1) sem internet a nuvem responde com os dados já baixados, não com vazio, e
   (2) gravações feitas sem sinal ficam na fila e sobem quando a conexão volta,
   mesmo que o app seja fechado no meio. */
let db;
try {
     db = initializeFirestore(firebaseApp, {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
     });
} catch (e) {
     console.warn("Firestore sem cache persistente (usando memoria):", e);
     db = getFirestore(firebaseApp);
}

/* ── Login: só "Entrar com Google" ────────────────────────────────────────
   Uma conta por pessoa, sem senha no app. O Firebase guarda a sessão no
   aparelho, então depois do primeiro login o app abre direto, mesmo sem sinal. */
const provedorGoogle = new GoogleAuthProvider();
provedorGoogle.setCustomParameters({ prompt: "select_account" });

function resumoUsuario(u) {
     return {
            uid: u.uid,
            email: String(u.email || "").trim().toLowerCase(),
            nome: u.displayName || "",
            foto: u.photoURL || "",
            emailVerificado: !!u.emailVerified,
     };
}

/* Marca "a página saiu para o Google" antes do redirecionamento. Na volta,
   resultadoRedirecionamento() lê e apaga a marca: se o Google não devolveu
   ninguém, a tela de entrada consegue dizer isso em vez de ficar muda. */
const CHAVE_REDIRECT = "_kmzero_redirect";
function marcarRedirect() { try { sessionStorage.setItem(CHAVE_REDIRECT, "1"); } catch {} }
function lerEApagarRedirect() {
     try {
            const v = sessionStorage.getItem(CHAVE_REDIRECT) === "1";
            sessionStorage.removeItem(CHAVE_REDIRECT);
            return v;
     } catch { return false; }
}

/* Abre a janela do Google. Onde a janela é bloqueada (alguns celulares e o app
   instalado), cai para o redirecionamento: a página sai, o Google devolve e o
   app termina o login em resultadoRedirecionamento(). */
export async function entrarComGoogle() {
     try {
            const cred = await signInWithPopup(auth, provedorGoogle);
            return { ok: true, user: resumoUsuario(cred.user) };
     } catch (e) {
            const codigo = e && e.code;
            if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"].includes(codigo)) {
                     try {
                            marcarRedirect();
                            await signInWithRedirect(auth, provedorGoogle);
                            return { ok: true, redirecionando: true, codigo };
                     } catch (e2) {
                            return { ok: false, erro: traduzErroFirebase(e2.code), codigo: e2.code };
                     }
            }
            if (codigo === "auth/popup-closed-by-user" || codigo === "auth/cancelled-popup-request") {
                     return { ok: false, cancelado: true, erro: "Login cancelado.", codigo };
            }
            return { ok: false, erro: traduzErroFirebase(codigo), codigo };
     }
}

/* Chamar uma vez ao abrir o app: devolve o usuário se a página acabou de voltar
   de um login por redirecionamento; senão null. Quando a página SAIU para o
   Google (marca gravada) e voltou sem usuário, devolve { semUsuario: true }
   para a tela avisar — desde que aguardarSessao() também não encontre ninguém. */
export async function resultadoRedirecionamento() {
     const saiuParaGoogle = lerEApagarRedirect();
     try {
            const r = await getRedirectResult(auth);
            if (r && r.user) return resumoUsuario(r.user);
            return saiuParaGoogle ? { semUsuario: true, codigo: "redirect-sem-usuario" } : null;
     } catch (e) {
            console.warn("getRedirectResult:", e);
            return { erro: traduzErroFirebase(e.code), codigo: e.code };
     }
}

/* Espera o Firebase restaurar a sessão gravada no aparelho (resolve uma vez). */
export function aguardarSessao() {
     return new Promise(resolve => {
            const parar = onAuthStateChanged(auth, u => { parar(); resolve(u ? resumoUsuario(u) : null); }, () => { parar(); resolve(null); });
     });
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
     return onAuthStateChanged(auth, u => callback(u ? resumoUsuario(u) : null));
}

export function usuarioAtual() {
     return auth.currentUser;
}

/* Mensagens para a pessoa (a tela de entrada mostra por código em AvisoEntrada;
   estas são o texto de reserva). O que é instrução de console do Firebase vai
   para console.warn — quem resolve é o suporte, não quem está tentando entrar. */
const INSTRUCOES_CONSOLE = {
     "auth/unauthorized-domain": "Libere este endereço no Firebase: Authentication → Settings → Authorized domains.",
     "auth/operation-not-allowed": "Ative o login com Google no Firebase: Authentication → Sign-in method → Google.",
};
export function traduzErroFirebase(codigo) {
     const traducoes = {
            "auth/unauthorized-domain": "O KMZERO ainda não está liberado para este endereço. Avise o suporte.",
            "auth/operation-not-allowed": "O KMZERO ainda não está liberado para este endereço. Avise o suporte.",
            "auth/user-disabled": "Esta conta Google foi desativada. Fale com o suporte.",
            "auth/account-exists-with-different-credential": "Este e-mail já entrou de outra forma. Use a mesma conta Google de antes.",
            "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
            "auth/network-request-failed": "Você está sem internet. O primeiro acesso precisa de sinal; depois o app abre offline.",
            "auth/internal-error": "O Google não respondeu. Tente de novo.",
     };
     if (INSTRUCOES_CONSOLE[codigo]) console.warn(`[KMZERO] ${codigo}: ${INSTRUCOES_CONSOLE[codigo]}`);
     return traducoes[codigo] || "Não foi possível entrar. Tente de novo; se continuar, fale com o suporte.";
}

export { auth, firebaseApp, db, firebaseConfig };
