import { getApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, deleteDoc, onSnapshot, query, where } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { usuarioAtual } from "../firebase.js";

let _empresaId = null;

export function setEmpresaId(id) { _empresaId = id; }
export function getEmpresaId() { return _empresaId; }

/* ── Modo demonstração (/app/?demo=1) ──────────────────────────────────────
   Interruptor único da nuvem: com _modoDemo ligado, cloudRefs() devolve null e
   TODAS as funções de nuvem deste arquivo (e de avisos.js, que usa cloudRefs)
   saem no "if (!fb) return" — nada sobe nem desce do Firestore/Storage.
   _empresaId continua "demo" só para dar o prefixo demo_ no localStorage e
   demo_files no IndexedDB (fileStore.js): variáveis separadas, defesas separadas. */
let _modoDemo = false;
export function setModoDemo(v) { _modoDemo = !!v; }
export function emModoDemo() { return _modoDemo; }

let _fb = null;
export function cloudRefs() {
  if (_modoDemo) return null; // demo: sem nuvem, antes do cache
  if (_fb) return _fb;
  try {
    const app = getApp();
    _fb = { db: getFirestore(app), st: getStorage(app) };
  } catch (e) {
    console.warn("Firebase não inicializado — sync desativada:", e);
    _fb = null;
  }
  return _fb;
}

export async function enviarFotoNuvem(f) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return false;
  try {
    const id = String(f.id);
    const r = storageRef(fb.st, `empresas/${_empresaId}/fotosObras/${id}.jpg`);
    await uploadString(r, f.foto, "data_url");
    const url = await getDownloadURL(r);
    const { foto, ...meta } = f;
    await setDoc(doc(fb.db, "empresas", _empresaId, "fotosObras", id), {
      ...meta, id, fotoUrl: url, criadoEm: Date.now(),
    });
    return url; // URL de download: quem chamou troca o base64 pela URL
  } catch (e) {
    console.error("enviarFotoNuvem:", e);
    return false;
  }
}

export function observarFotosNuvem(callback) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return () => {};
  try {
    return onSnapshot(
      collection(fb.db, "empresas", _empresaId, "fotosObras"),
      snap => callback(snap.docs.map(d => { const x = d.data(); return { ...x, foto: x.fotoUrl }; })),
      e => console.error("observarFotosNuvem:", e)
    );
  } catch (e) { console.error(e); return () => {}; }
}

export const semUndefined = (o) => JSON.parse(JSON.stringify(o));

/* ── Áreas do escritório: campo "acessos" em usuarios/{uid} e convites/{email} ──
   Só vale para perfil "gestor" (escritório); o encarregado ignora e grava null.
     null (ou campo ausente) = acesso total — é o caso de todo gestor antigo;
     ["visao", "financeiro", ...] = só esses grupos do menu (ids de GRUPOS_MENU em
       src/components/menuGrupos.js; "dev" nunca entra).
   Lista vazia [] NÃO é "tudo": o app a lê como "só Visão geral" (a área fixa, que a
   tela sempre grava junto). Para "tudo" use null, nunca undefined: semUndefined apaga
   a chave e, com merge, a lista antiga ficaria gravada. Valor estranho (texto, número)
   vira [] — errar para menos acesso, nunca para mais. As regras do Firestore conferem
   o formato, não deixam ninguém mudar as PRÓPRIAS áreas e só deixam quem administra
   os acessos (Tudo ou área Sistema) mudar as dos outros. (menuGrupos.js tem
   normalizarAcessos, que é outra coisa: põe na ordem do menu, descarta área
   desconhecida e acrescenta a Visão geral, para a tela.) */
export function acessosParaNuvem(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Set) v = [...v];
  if (!Array.isArray(v)) { console.warn("acessosParaNuvem: valor inesperado, gravando sem áreas:", v); return []; }
  const vistos = new Set();
  return v.filter(x => typeof x === "string" && x !== "" && x !== "dev" && !vistos.has(x) && vistos.add(x));
}

/* Lê as áreas de um perfil/convite vindo da nuvem: lista (sem repetição) ou null = tudo */
export const lerAcessos = p => acessosParaNuvem(p ? p.acessos : null);

/* ── Anexos base64 (data:...) NÃO sobem para o Firestore (limite de 1 MB por doc) ── */
export const ehDataUrl = v => typeof v === "string" && v.startsWith("data:");

export function temDataUrl(v) {
  if (ehDataUrl(v)) return true;
  if (Array.isArray(v)) return v.some(temDataUrl);
  if (v && typeof v === "object") return Object.values(v).some(temDataUrl);
  return false;
}

/* Cópia do objeto sem nenhuma string base64 (campos removidos; em arrays viram null) */
export function semDataUrl(v) {
  if (ehDataUrl(v)) return undefined;
  if (Array.isArray(v)) return v.map(x => { const y = semDataUrl(x); return y === undefined ? null : y; });
  if (v && typeof v === "object") {
    const o = {};
    Object.entries(v).forEach(([k, x]) => { const y = semDataUrl(x); if (y !== undefined) o[k] = y; });
    return o;
  }
  return v;
}

/* Ao receber um doc da nuvem, mantém os anexos (base64) que só existem neste aparelho */
export function mesclarAnexosLocais(docNuvem, docLocal) {
  if (!docLocal || typeof docLocal !== "object") return docNuvem;
  const r = { ...docNuvem };
  Object.entries(docLocal).forEach(([k, v]) => {
    if (!temDataUrl(v)) return;
    const n = docNuvem[k];
    if (n === undefined || n === null) { r[k] = v; return; }
    if (Array.isArray(v) && Array.isArray(n) && v.length === n.length) { r[k] = v; return; }
    if (typeof v === "object" && !Array.isArray(v) && typeof n === "object" && !Array.isArray(n)) r[k] = mesclarAnexosLocais(n, v);
  });
  return r;
}

/* JSON com chaves em ordem — o Firestore devolve os campos em ordem alfabética,
   então comparar JSON.stringify "cru" daria falso positivo de mudança. */
export function jsonEstavel(v) {
  if (Array.isArray(v)) return "[" + v.map(jsonEstavel).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + jsonEstavel(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}

export async function enviarDocNuvem(colecao, id, dados) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return false;
  try {
    await setDoc(doc(fb.db, "empresas", _empresaId, colecao, String(id)), semUndefined(dados));
    return true;
  } catch (e) {
    console.error("enviarDocNuvem", colecao, e);
    return false;
  }
}

export async function removerDocNuvem(colecao, id) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return false;
  try { await deleteDoc(doc(fb.db, "empresas", _empresaId, colecao, String(id))); return true; }
  catch (e) { console.error("removerDocNuvem", colecao, e); return false; }
}

/* callback(docs, meta) — meta.fromCache = true quando a resposta veio do cache local
   (sem internet), e não do servidor. Quem consome decide o que confiar. */
export function observarColecaoNuvem(colecao, callback, onErro) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return () => {};
  try {
    return onSnapshot(
      collection(fb.db, "empresas", _empresaId, colecao),
      { includeMetadataChanges: false },
      snap => callback(snap.docs.map(d => d.data()), { fromCache: snap.metadata.fromCache, hasPendingWrites: snap.metadata.hasPendingWrites }),
      e => { console.error("observarColecaoNuvem", colecao, e); if (onErro) onErro(e); }
    );
  } catch (e) { console.error(e); return () => {}; }
}

/* Aplica sobre o registro local o que está no perfil da nuvem (usuarios/{uid}) — a nuvem manda */
export const aplicarPerfilNuvem = (u, p) => !p ? u : ({
  ...u,
  nome: p.nome || u.nome || "Equipe",
  perfil: p.perfil || u.perfil || "encarregado",
  cargo: p.cargo || u.cargo || "Encarregado",
  obraId: (p.obraId !== undefined && p.obraId !== null) ? p.obraId : (u.obraId ?? null),
  tel: p.tel || u.tel || "",
  acessos: lerAcessos(p), // áreas do escritório (null = tudo)
});

/* ── Funções multi-tenant ── */

export async function registrarEmpresa(dadosEmpresa, firebaseUid, nomeGestor, emailGestor, fotoGestor = "") {
  const fb = cloudRefs();
  if (!fb) return null;
  try {
    const empresaRef = doc(collection(fb.db, "empresas"));
    const empresaId = empresaRef.id;
    await setDoc(empresaRef, {
      ...semUndefined(dadosEmpresa),
      criadoEm: Date.now(),
      gestorUid: firebaseUid,
    });
    try {
      await setDoc(doc(fb.db, "usuarios", firebaseUid), {
        empresaId,
        nome: nomeGestor,
        email: String(emailGestor || "").trim().toLowerCase(),
        foto: fotoGestor || "",
        perfil: "gestor",
        acessos: null, // dono da empresa: acesso total
        ativo: true,
        criadoEm: Date.now(),
      });
    } catch (e) {
      // Não deixa empresa órfã se o perfil não pôde ser gravado
      try { await deleteDoc(empresaRef); } catch {}
      throw e;
    }
    return empresaId;
  } catch (e) {
    console.error("registrarEmpresa:", e);
    return null;
  }
}

/* Perfil completo do login (usuarios/{uid}): empresaId, perfil, nome, obraId, ativo... */
/* Cadastro feito em "Criar minha empresa" (empresas/{empresaId}). O app usa esses
   dados como ponto de partida da tela Empresa: nome no menu, cabeçalho dos PDFs. */
export async function carregarCadastroEmpresa() {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return null;
  try {
    const snap = await getDoc(doc(fb.db, "empresas", _empresaId));
    if (!snap.exists()) return null;
    const { gestorUid, criadoEm, ...dados } = snap.data();
    return dados;
  } catch (e) {
    console.warn("carregarCadastroEmpresa:", e);
    return null;
  }
}

/* uid do dono da empresa (quem a criou: empresas/{id}.gestorUid), ou null. A tela Usuários
   e acessos trava o cartão dele: ninguém limita, rebaixa nem desativa o dono (as regras
   também recusam). */
export async function carregarDonoEmpresa() {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return null;
  try {
    const snap = await getDoc(doc(fb.db, "empresas", _empresaId));
    return snap.exists() ? (snap.data().gestorUid || null) : null;
  } catch (e) {
    console.warn("carregarDonoEmpresa:", e);
    return null;
  }
}

/* O dono nunca fica trancado para fora: se o perfil dele aparecer limitado (áreas) ou
   rebaixado, volta para escritório com acesso total. As regras só deixam o próprio dono
   fazer isso (donoSeRestaurando). Devolve o perfil corrigido, ou null se não é o dono
   ou não deu para gravar (sem internet: tenta de novo na próxima abertura). */
export async function restaurarDonoNuvem(firebaseUid, perfilNuvem) {
  const fb = cloudRefs();
  if (!fb || !firebaseUid || !perfilNuvem?.empresaId) return null;
  try {
    const emp = await getDoc(doc(fb.db, "empresas", perfilNuvem.empresaId));
    if (!emp.exists() || emp.data().gestorUid !== firebaseUid) return null;
    const correcao = { perfil: "gestor", acessos: null, atualizadoEm: Date.now() };
    await setDoc(doc(fb.db, "usuarios", firebaseUid), correcao, { merge: true });
    return { ...perfilNuvem, ...correcao };
  } catch (e) {
    console.warn("restaurarDonoNuvem:", e);
    return null;
  }
}

export async function carregarPerfilNuvem(firebaseUid) {
  const fb = cloudRefs();
  if (!fb) return { ok: false, erro: "Firebase não inicializado." };
  try {
    const snap = await getDoc(doc(fb.db, "usuarios", firebaseUid));
    return { ok: true, perfil: snap.exists() ? snap.data() : null };
  } catch (e) {
    console.error("carregarPerfilNuvem:", e);
    return { ok: false, codigo: e.code, erro: mensagemNuvem(e, "Não foi possível consultar seu perfil na nuvem. Verifique a conexão.") };
  }
}

/* Mensagem humana para erro da nuvem. permission-denied quase sempre é regra do
   Firestore não publicada — instrução de console vai para console.warn, e quem
   está tentando entrar só vê "avise o suporte" (a tela mostra o código junto). */
export function mensagemNuvem(e, generica) {
  if (e && e.code === "permission-denied") {
    console.warn("[KMZERO] permission-denied: as regras do Firebase precisam estar publicadas (npm run firebase:deploy-regras) e a conta Google deve ser a mesma do cadastro/convite.");
    return "A nuvem recusou o acesso. Avise o suporte.";
  }
  return generica;
}

/* dados.acessos: lista de grupos, ou null para "tudo". Se não vier (undefined), as
   áreas gravadas ficam como estão (merge). Encarregado não usa áreas: grava null. */
export async function atualizarPerfilNuvem(firebaseUid, dados) {
  const fb = cloudRefs();
  if (!fb || !firebaseUid) return false;
  const d = { ...dados };
  if (d.acessos !== undefined) d.acessos = acessosParaNuvem(d.acessos);
  if (d.perfil === "encarregado") d.acessos = null;
  try {
    await setDoc(doc(fb.db, "usuarios", firebaseUid), semUndefined(d), { merge: true });
  } catch (e) { console.error("atualizarPerfilNuvem:", e); return false; }
  if (d.acessos !== undefined || d.perfil || d.ativo !== undefined) alinharConviteAoPerfil(fb, firebaseUid); // em segundo plano
  return true;
}

/* O convite que trouxe a pessoa continua em convites/{email} depois do 1º login. Quando o
   gestor muda o tipo, as áreas ou o ativo do PERFIL, o convite acompanha: se o perfil for
   refeito a partir dele (as regras deixam), nunca volta com mais acesso do que o gestor
   deixou, e quem foi desativado não volta (convite com ativo: false não vale nas regras).
   Melhor esforço: sem convite, convite de outra empresa, sem internet ou sem permissão
   (só quem administra os acessos grava convites; o gestor que desliga alguém pela tela
   Equipe não grava), não faz nada — as regras também não deixam quem foi desativado
   apagar o próprio perfil para refazê-lo. */
async function alinharConviteAoPerfil(fb, firebaseUid) {
  try {
    const p = await getDoc(doc(fb.db, "usuarios", firebaseUid));
    if (!p.exists()) return;
    const email = emailChave(p.data().email);
    if (!email.includes("@")) return;
    const ref = doc(fb.db, "convites", email);
    const c = await getDoc(ref);
    if (!c.exists() || c.data().empresaId !== p.data().empresaId) return;
    const perfil = p.data().perfil === "gestor" ? "gestor" : "encarregado";
    await setDoc(ref, { perfil, acessos: perfil === "gestor" ? lerAcessos(p.data()) : null, ativo: p.data().ativo !== false, atualizadoEm: Date.now() }, { merge: true });
  } catch (e) {
    // convite inexistente ou de outra empresa: as regras recusam a leitura (permission-denied) — normal
    if (!e || e.code !== "permission-denied") console.warn("alinharConviteAoPerfil:", e);
  }
}

/* ativo=false bloqueia a pessoa em todos os aparelhos (as regras checam o campo); o convite
   dela acompanha (alinharConviteAoPerfil), para ela não se refazer ativa por ele */
export async function definirAcessoAtivo(firebaseUid, ativo) {
  return atualizarPerfilNuvem(firebaseUid, { ativo: !!ativo, atualizadoEm: Date.now() });
}

/* ── Convites e equipe (login só com Google) ──────────────────────────────
   O gestor não cria conta para ninguém: registra o Gmail da pessoa em
   convites/{email}. Quando ela entra com o Google pela 1ª vez, o app lê o
   convite e cria usuarios/{uid} (as regras conferem e-mail verificado). */
export const emailChave = e => String(e || "").trim().toLowerCase();

export async function buscarConvite(email) {
  const fb = cloudRefs();
  if (!fb) return { ok: false, erro: "Firebase não inicializado." };
  try {
    const snap = await getDoc(doc(fb.db, "convites", emailChave(email)));
    return { ok: true, convite: snap.exists() ? snap.data() : null };
  } catch (e) {
    console.error("buscarConvite:", e);
    return { ok: false, codigo: e.code, erro: mensagemNuvem(e, "Não foi possível consultar o seu cadastro. Verifique a conexão.") };
  }
}

/* Cria o perfil da pessoa convidada (chamado no 1º login com Google) */
export async function aceitarConvite(userGoogle, convite) {
  const fb = cloudRefs();
  if (!fb) return { ok: false, erro: "Firebase não inicializado." };
  const perfil = semUndefined({
    empresaId: convite.empresaId,
    email: emailChave(userGoogle.email),
    nome: convite.nome || userGoogle.nome || "Equipe",
    foto: userGoogle.foto || "",
    perfil: convite.perfil || "encarregado",
    cargo: convite.cargo || (convite.perfil === "gestor" ? "Gestor" : "Encarregado"),
    obraId: convite.obraId ?? null,
    tel: convite.tel || "",
    // Áreas do escritório: cópia exata do convite (as regras exigem que seja igual)
    acessos: Array.isArray(convite.acessos) ? convite.acessos : null,
    ativo: true,
    criadoEm: Date.now(),
  });
  try {
    await setDoc(doc(fb.db, "usuarios", userGoogle.uid), perfil);
    return { ok: true, perfil };
  } catch (e) {
    console.error("aceitarConvite:", e);
    return { ok: false, codigo: e.code, erro: mensagemNuvem(e, "Não foi possível concluir seu acesso. Verifique a conexão e tente de novo.") };
  }
}

/* Gestor registra/atualiza o convite de um Gmail (a chave e o e-mail em minusculas).
   acessos: áreas do escritório para perfil "gestor" (null = tudo); vão para o perfil
   no 1º login. Encarregado grava null. Convidar libera a entrada (ativo: true); a tela
   só chama isto para convite novo ou pendente (quem já tem perfil é editado no perfil). */
export async function criarConvite({ email, nome, cargo, obraId, perfil, tel, empresaNome, acessos = null }) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return { ok: false, erro: "Empresa não identificada. Saia e entre novamente como gestor." };
  const chave = emailChave(email);
  if (!chave.includes("@")) return { ok: false, erro: "Informe um e-mail válido (Gmail)." };
  const eu = usuarioAtual();
  try {
    await setDoc(doc(fb.db, "convites", chave), semUndefined({
      email: chave,
      empresaId: _empresaId,
      empresaNome: empresaNome || "",
      nome: nome || "",
      cargo: cargo || "Encarregado",
      obraId: obraId ?? null,
      perfil: perfil === "gestor" ? "gestor" : "encarregado",
      acessos: perfil === "gestor" ? acessosParaNuvem(acessos) : null,
      ativo: true,
      tel: tel || "",
      criadoPor: eu ? eu.uid : null,
      criadoEm: Date.now(),
    }), { merge: true });
    return { ok: true, email: chave };
  } catch (e) {
    console.error("criarConvite:", e);
    return { ok: false, codigo: e.code, erro: mensagemNuvem(e, "Não foi possível salvar o acesso. Verifique a conexão.") };
  }
}

export async function removerConvite(email) {
  const fb = cloudRefs();
  if (!fb) return { ok: false, erro: "Firebase não inicializado." };
  try {
    await deleteDoc(doc(fb.db, "convites", emailChave(email)));
    return { ok: true };
  } catch (e) {
    console.error("removerConvite:", e);
    return { ok: false, erro: "Não foi possível cancelar o convite. Verifique a conexão." };
  }
}

/* Equipe da empresa (perfis em usuarios/) — qualquer usuario ativo pode ver */
export function observarEquipeNuvem(callback, onErro) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return () => {};
  const q = query(collection(fb.db, "usuarios"), where("empresaId", "==", _empresaId));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({
      id: d.id, firebaseUid: d.id,
      nome: d.data().nome || "", email: d.data().email || "", foto: d.data().foto || "",
      perfil: d.data().perfil || "encarregado", cargo: d.data().cargo || "",
      obraId: d.data().obraId ?? null, tel: d.data().tel || "",
      acessos: lerAcessos(d.data()),
      ativo: d.data().ativo !== false,
    })));
  }, e => { console.warn("observarEquipeNuvem:", e); onErro && onErro(e); });
}

/* Convites pendentes da empresa — so o gestor */
export function observarConvitesNuvem(callback, onErro) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return () => {};
  const q = query(collection(fb.db, "convites"), where("empresaId", "==", _empresaId));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({
      id: "convite:" + d.id, convite: true,
      nome: d.data().nome || "", email: d.data().email || d.id,
      perfil: d.data().perfil || "encarregado", cargo: d.data().cargo || "",
      obraId: d.data().obraId ?? null, tel: d.data().tel || "",
      acessos: lerAcessos(d.data()),
    })));
  }, e => { console.warn("observarConvitesNuvem:", e); onErro && onErro(e); });
}

/* Decide o que fazer depois de "Entrar com Google":
   - perfil existe e ativo → { tipo: "perfil", usuario }
   - sem perfil, com convite → cria o perfil → { tipo: "perfil", usuario }
   - sem perfil e sem convite → { tipo: "sem_convite" }
   - desativado / erro → { tipo: "erro", erro } */
export async function resolverEntradaGoogle(userGoogle) {
  const p = await carregarPerfilNuvem(userGoogle.uid);
  if (!p.ok) return { tipo: "erro", erro: p.erro, codigo: p.codigo };
  const montar = perfil => ({
    id: userGoogle.uid,
    firebaseUid: userGoogle.uid,
    email: emailChave(userGoogle.email),
    foto: userGoogle.foto || perfil.foto || "",
    nome: perfil.nome || userGoogle.nome || "Equipe",
    perfil: perfil.perfil || "encarregado",
    cargo: perfil.cargo || (perfil.perfil === "gestor" ? "Gestor" : "Encarregado"),
    obraId: perfil.obraId ?? null,
    tel: perfil.tel || "",
    acessos: lerAcessos(perfil), // áreas do escritório (null = tudo)
    empresaId: perfil.empresaId,
    ultimoLogin: Date.now(),
  });
  const desativado = { tipo: "erro", desativado: true, codigo: "acesso-desativado", email: emailChave(userGoogle.email), erro: `O acesso de ${emailChave(userGoogle.email)} foi desativado pelo gestor da empresa.` };
  if (p.perfil) {
    if (p.perfil.ativo === false) return desativado;
    if (!p.perfil.empresaId) return { tipo: "sem_convite" };
    // Dono da empresa limitado ou rebaixado (app ou regra antigos): entra já com acesso total.
    // Para os outros, restaurarDonoNuvem só confere o dono e devolve null (nada é gravado).
    let perfil = p.perfil;
    if (perfil.perfil !== "gestor" || lerAcessos(perfil) !== null) perfil = (await restaurarDonoNuvem(userGoogle.uid, perfil)) || perfil;
    return { tipo: "perfil", usuario: montar(perfil) };
  }
  const c = await buscarConvite(userGoogle.email);
  if (!c.ok) return { tipo: "erro", erro: c.erro, codigo: c.codigo };
  if (!c.convite) return { tipo: "sem_convite" };
  // Convite desligado (a pessoa foi desativada e o perfil dela sumiu): as regras recusariam o perfil
  if (c.convite.ativo === false) return desativado;
  const a = await aceitarConvite(userGoogle, c.convite);
  if (!a.ok) return { tipo: "erro", erro: a.erro, codigo: a.codigo };
  return { tipo: "perfil", usuario: montar(a.perfil) };
}

/* ── localStorage com prefixo dinâmico ── */

function storePrefix() {
  return _empresaId ? _empresaId + "_" : "kmzero_";
}

/* Ids já vistos na nuvem por coleção (para aplicar remoções feitas em outro aparelho
   enquanto este estava fechado). Fica no localStorage da empresa. */
export function lerIdsSync(colecao) {
  try {
    const v = localStorage.getItem(storePrefix() + "_syncIds_" + colecao);
    const arr = v ? JSON.parse(v) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
export function salvarIdsSync(colecao, ids) {
  try { localStorage.setItem(storePrefix() + "_syncIds_" + colecao, JSON.stringify(ids)); } catch {}
}

export const store = {
  async get(key) {
    try {
      const v = localStorage.getItem(storePrefix() + key);
      if (v) return JSON.parse(v);
      if (typeof window !== "undefined" && window.storage && window.storage.get) {
        const r = await window.storage.get(key);
        return r ? JSON.parse(r.value) : null;
      }
      return null;
    } catch (e) { console.warn("store.get error:", e); return null; }
  },
  async set(key, val) {
    try {
      const json = JSON.stringify(val);
      localStorage.setItem(storePrefix() + key, json);
      if (typeof window !== "undefined" && window.storage && window.storage.set) {
        try { await window.storage.set(key, json); } catch {}
      }
    } catch (e) {
      console.warn("store.set error:", e);
      if (e.name === "QuotaExceededError") {
        alert("Armazenamento cheio! Faça backup e limpe dados antigos.");
      }
    }
  },
  async clear() {
    try {
      const prefix = storePrefix();
      const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
      keys.forEach(k => localStorage.removeItem(k));
    } catch (e) { console.warn(e); }
  }
};
