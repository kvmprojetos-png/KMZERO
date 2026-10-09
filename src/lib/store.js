import { getApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, deleteDoc, onSnapshot, query, where, or, getCountFromServer, writeBatch } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { usuarioAtual } from "../firebase.js";
import { normId, normalizarColecao } from "./ids.js";
import { enviarFotoPrivada, carregarFotoPrivada } from "./fotosSeguras.js";
import { normalizarFotoLocalPrivada } from "./fotoCaminho.js";
import { criarLeituraFotos, manterFotoNoAparelho } from "./fotosNuvemLeitura.js";
import { politicaColecao, temAreaDados, administraPessoas, variantesId, trabalhadorCampo, obraCampo, perfilCampo, filtrarCachePermitido } from "./permissoesDados.js";

let _empresaId = null;
let _perfilDados = null;
let _persistenciaSuspensa = false;
export function suspenderPersistencia(v) { _persistenciaSuspensa = !!v; }
export function setPerfilDados(perfil) { _perfilDados = perfil; }
export function getPerfilDados() { return _perfilDados; }
export function consultaPermitida(fb, colecao) {
  const p = politicaColecao(_perfilDados, colecao);
  if (!p.leitura) return null;
  const base = collection(fb.db, 'empresas', _empresaId, p.colecao);
  if (!p.escopo) return base;
  if (p.escopo === 'participantes') {
    const uid = _perfilDados.firebaseUid || _perfilDados.id;
    return query(base, or(where('de','==',uid),where('para','==',uid)));
  }
  const ids = variantesId(_perfilDados.obraId);
  if (!ids.length) return null;
  if (p.escopo === 'movPessoal') return query(base,or(where('obraOrigem','in',ids),where('obraDestino','in',ids)));
  if (p.escopo === 'movEquip') return query(base,or(where('obraOrigemId','in',ids),where('obraDestinoId','in',ids)));
  return query(base,where(p.escopo,'in',ids));
}

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
    return await enviarFotoPrivada(usuarioAtual(), _empresaId, f);
  } catch (e) {
    console.error("enviarFotoNuvem:", e.status || "falha-upload");
    return false;
  }
}

export function observarFotosNuvem(callback) {
  const fb = cloudRefs();
  const empresaId = _empresaId, pessoa = usuarioAtual();
  if (!fb || !empresaId || !pessoa) return () => {};
  const consulta = consultaPermitida(fb, "fotosObras");
  if (!consulta) return () => {};
  let parar = () => {};
  // Metadados ainda são ao vivo; os bytes sempre passam pela API autenticada.
  // O cache do leitor pertence a este listener e é descartado ao sair/trocar conta.
  // Regras de ordem, paralelismo e emissão progressiva: fotosNuvemLeitura.js.
  // Encarregado: fotos de meses anteriores não descem para o celular (a nuvem não muda).
  const perfil = _perfilDados?.perfil;
  const leitor = criarLeituraFotos({ empresaId, callback,
    manterFoto: registro => manterFotoNoAparelho(registro, perfil),
    carregarFoto: (registro, opcoes) => carregarFotoPrivada(pessoa, empresaId, registro, opcoes) });
  const aoReconectar = () => { leitor.aoReconectar(); };
  try {
    parar = onSnapshot(consulta, { includeMetadataChanges: true }, snap => { leitor.aoSnapshot(snap); },
      e => console.error("observarFotosNuvem:", e.code || "falha-listener"));
    if (typeof window !== "undefined") window.addEventListener("online", aoReconectar);
  } catch (e) { console.error("observarFotosNuvem:", e.code || "falha-listener"); }
  return () => { leitor.encerrar(); parar();
    if (typeof window !== "undefined") window.removeEventListener("online", aoReconectar); };
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

/* ── RDOs entre aparelhos ──────────────────────────────────────────────────
   O fechamento do encarregado regrava o RDO do dia no MESMO id (um RDO por obra por dia), e
   o escritório edita RDOs: o id que um aparelho já tem precisa ser trocado pela versão nova.
   Versão = última regravação (atualizadoEm); sem ela, a emissão (ts) ou o id. */
export const versaoRdo = r => Number(r?.atualizadoEm) || Number(r?.ts) || Number(r?.id) || 0;

/* Junta à lista local (estado do app) os RDOs que vieram da nuvem:
   - id que este aparelho não tem → entra;
   - id que ele já tem → troca SÓ quando a versão da nuvem é mais nova (o eco da própria gravação,
     de mesma versão, não mexe; uma edição local ainda não enviada, mais nova, também não);
   - as fotos do RDO não vão para a nuvem (só a galeria): na troca ficam as deste aparelho;
   - RDO que só existe aqui fica como está.
   Sem nada novo, devolve a MESMA lista (o React não re-renderiza). Mais novo primeiro (id). */
export function mesclarRdosDaNuvem(loc, nuvem) {
  const lista = Array.isArray(loc) ? loc : [];
  const locPorId = new Map(lista.filter(r => r && r.id !== undefined && r.id !== null).map(r => [String(r.id), r]));
  const novos = [];
  const maisNovos = [];
  (Array.isArray(nuvem) ? nuvem : []).forEach(n => {
    if (!n || n.id === undefined || n.id === null) return;
    const l = locPorId.get(String(n.id));
    if (!l) novos.push(n);
    else if (versaoRdo(n) > versaoRdo(l)) maisNovos.push(n);
  });
  if (!novos.length && !maisNovos.length) return loc;
  const trocar = new Map(normalizarColecao("rdos", maisNovos).map(n => [String(n.id), n]));
  const atualizados = !trocar.size ? lista : lista.map(l => {
    const n = l && trocar.get(String(l.id));
    if (!n) return l;
    return Array.isArray(l.fotos) && l.fotos.length ? { ...n, fotos: l.fotos } : n;
  });
  return [...normalizarColecao("rdos", novos), ...atualizados].sort((a, b) => (Number(b?.id) || 0) - (Number(a?.id) || 0));
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
  if (!politicaColecao(_perfilDados, colecao).escrita) return false;
  try {
    const alvo = doc(fb.db, "empresas", _empresaId, colecao, String(id));
    const lote = writeBatch(fb.db);
    lote.set(alvo, semUndefined(dados));
    if (colecao === 'trabalhadores') lote.set(doc(fb.db,'empresas',_empresaId,'trabalhadoresCampo',String(id)), trabalhadorCampo(dados));
    if (colecao === 'obras' && temAreaDados(_perfilDados,'obras')) lote.set(doc(fb.db,'empresas',_empresaId,'obrasCampo',String(id)), obraCampo(dados));
    await lote.commit();
    return true;
  } catch (e) {
    console.error("enviarDocNuvem", colecao, e);
    return false;
  }
}

export async function removerDocNuvem(colecao, id) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return false;
  if (!politicaColecao(_perfilDados, colecao).escrita) return false;
  try {
    const lote = writeBatch(fb.db);
    lote.delete(doc(fb.db, "empresas", _empresaId, colecao, String(id)));
    if (colecao === 'trabalhadores') lote.delete(doc(fb.db,'empresas',_empresaId,'trabalhadoresCampo',String(id)));
    if (colecao === 'obras') lote.delete(doc(fb.db,'empresas',_empresaId,'obrasCampo',String(id)));
    await lote.commit(); return true;
  }
  catch (e) { console.error("removerDocNuvem", colecao, e); return false; }
}

/* callback(docs, meta) — meta.fromCache = true quando a resposta veio do cache local
   (sem internet), e não do servidor. Quem consome decide o que confiar. */
export function observarColecaoNuvem(colecao, callback, onErro) {
  const fb = cloudRefs();
  if (!fb || !_empresaId) return () => {};
  try {
    const consulta = consultaPermitida(fb, colecao);
    // Sem consulta possível (ex.: encarregado ainda sem obra) não é resposta do servidor:
    // fromCache:true para nenhum consumidor tratar a lista vazia como remoção.
    if (!consulta) { callback([], { fromCache:true, hasPendingWrites:false }); return () => {}; }
    return onSnapshot(
      consulta,
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
  obraId: normId(p.obraId),
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
    // Empresa e perfil nascem juntos. Se o perfil for recusado, nada é gravado;
    // não há exclusão de empresa que deixe subcoleções com um ID reutilizável.
    const lote = writeBatch(fb.db);
    lote.set(empresaRef, {
      ...semUndefined(dadosEmpresa),
      criadoEm: Date.now(),
      gestorUid: firebaseUid,
    });
    lote.set(doc(fb.db, "usuarios", firebaseUid), {
      empresaId,
      nome: nomeGestor,
      email: String(emailGestor || "").trim().toLowerCase(),
      foto: fotoGestor || "",
      perfil: "gestor",
      acessos: null, // dono da empresa: acesso total
      ativo: true,
      criadoEm: Date.now(),
    });
    lote.set(doc(fb.db,'empresas',empresaId,'perfisCampo',firebaseUid),perfilCampo({nome:nomeGestor,perfil:'gestor',ativo:true},firebaseUid));
    await lote.commit();
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
    const perfilRef = doc(fb.db,'usuarios',firebaseUid);
    const anterior = await getDoc(perfilRef);
    if (!anterior.exists()) return false;
    const completo = {...anterior.data(),...semUndefined(d)};
    const lote = writeBatch(fb.db);
    lote.set(perfilRef,semUndefined(d),{merge:true});
    lote.set(doc(fb.db,'empresas',completo.empresaId,'perfisCampo',firebaseUid),perfilCampo(completo,firebaseUid));
    await lote.commit();
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
    obraId: normId(convite.obraId),
    tel: convite.tel || "",
    // Áreas do escritório: cópia exata do convite (as regras exigem que seja igual)
    acessos: Array.isArray(convite.acessos) ? convite.acessos : null,
    ativo: true,
    criadoEm: Date.now(),
  });
  try {
    try {
      const lote = writeBatch(fb.db);
      lote.set(doc(fb.db,'usuarios',userGoogle.uid),perfil);
      lote.set(doc(fb.db,'empresas',perfil.empresaId,'perfisCampo',userGoogle.uid),perfilCampo(perfil,userGoogle.uid));
      await lote.commit();
    } catch (e) {
      if (!e || e.code !== "permission-denied") throw e;
      // Regras anteriores à proteção por função conferem a empresa pelo perfil JÁ gravado
      // e recusam o lote. Em duas etapas cada gravação passa sozinha: primeiro o perfil
      // (regra do convite), depois o espelho de campo, que a migração refaz se faltar.
      await setDoc(doc(fb.db,'usuarios',userGoogle.uid),perfil);
      try { await setDoc(doc(fb.db,'empresas',perfil.empresaId,'perfisCampo',userGoogle.uid),perfilCampo(perfil,userGoogle.uid)); }
      catch (e2) { console.warn("aceitarConvite: espelho de campo fica para a migração", e2?.code); }
    }
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
      obraId: normId(obraId),
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
    // O convite é um por e-mail (convites/{email}): se outra empresa já convidou este e-mail,
    // as regras recusam (só a empresa dona do convite o altera)
    if (e && e.code === "permission-denied") return { ok: false, codigo: e.code, erro: "A nuvem recusou o convite. Se este e-mail já foi convidado por outra empresa no KMZERO, ela precisa cancelar o convite antes (ou fale com o suporte)." };
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
  if (!administraPessoas(_perfilDados)) return onSnapshot(collection(fb.db,'empresas',_empresaId,'perfisCampo'), snap => callback(snap.docs.map(d => ({...d.data(),id:d.id,firebaseUid:d.id}))), e => onErro?.(e));
  const q = query(collection(fb.db, "usuarios"), where("empresaId", "==", _empresaId));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({
      id: d.id, firebaseUid: d.id,
      nome: d.data().nome || "", email: d.data().email || "", foto: d.data().foto || "",
      perfil: d.data().perfil || "encarregado", cargo: d.data().cargo || "",
      obraId: normId(d.data().obraId), tel: d.data().tel || "",
      acessos: lerAcessos(d.data()),
      ativo: d.data().ativo !== false,
    })));
  }, e => { console.warn("observarEquipeNuvem:", e); onErro && onErro(e); });
}

/* Convites pendentes da empresa — so o gestor */
export function observarConvitesNuvem(callback, onErro) {
  const fb = cloudRefs();
  if (!fb || !_empresaId || !administraPessoas(_perfilDados)) return () => {};
  const q = query(collection(fb.db, "convites"), where("empresaId", "==", _empresaId));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({
      id: "convite:" + d.id, convite: true,
      nome: d.data().nome || "", email: d.data().email || d.id,
      perfil: d.data().perfil || "encarregado", cargo: d.data().cargo || "",
      obraId: normId(d.data().obraId), tel: d.data().tel || "",
      acessos: lerAcessos(d.data()),
    })));
  }, e => { console.warn("observarConvitesNuvem:", e); onErro && onErro(e); });
}

/* Usuário da sessão (o que o app guarda e usa) a partir da conta Google + perfil da nuvem */
export function observarMeuPerfil(callback, onErro) {
  const fb = cloudRefs(), uid = usuarioAtual()?.uid;
  if (!fb || !uid) return () => {};
  return onSnapshot(doc(fb.db,'usuarios',uid), snap => callback(snap.exists() ? snap.data() : null), e => onErro?.(e));
}
export const montarUsuarioLogin = (userGoogle, perfil) => ({
  id: userGoogle.uid,
  firebaseUid: userGoogle.uid,
  email: emailChave(userGoogle.email),
  foto: userGoogle.foto || perfil.foto || "",
  nome: perfil.nome || userGoogle.nome || "Equipe",
  perfil: perfil.perfil || "encarregado",
  cargo: perfil.cargo || (perfil.perfil === "gestor" ? "Gestor" : "Encarregado"),
  obraId: normId(perfil.obraId),
  tel: perfil.tel || "",
  acessos: lerAcessos(perfil), // áreas do escritório (null = tudo)
  empresaId: perfil.empresaId,
  ativo: perfil.ativo !== false,
  ultimoLogin: Date.now(),
});

/* Conta Google cujo e-mail não foi confirmado: as regras não deixam o convite virar perfil
   (emailVerificado). Só o false explícito conta (sessão antiga pode não trazer o campo). */
const erroEmailNaoVerificado = email => ({
  tipo: "erro", codigo: "email-nao-verificado", email: emailChave(email),
  erro: `A conta Google ${emailChave(email)} ainda não confirmou o e-mail. Abra a mensagem de confirmação que o Google mandou (ou use uma conta Gmail) e entre de novo.`,
});

/* Apaga o PRÓPRIO perfil (as regras deixam enquanto ativo). Melhor esforço: true se apagou. */
async function apagarPerfilProprio(uid) {
  const fb = cloudRefs();
  if (!fb || !uid) return false;
  try { await deleteDoc(doc(fb.db, "usuarios", uid)); return true; }
  catch (e) { console.warn("apagarPerfilProprio:", e); return false; }
}

/* ── Convite de OUTRA empresa para quem já tem perfil de escritório ──────────
   Quem entrou ANTES de ser convidado e tocou em "criar minha empresa" ficou com perfil
   próprio (empresa vazia), e o login nunca mais olhava o convite. Agora, se o perfil é de
   escritório e existe convite para o mesmo e-mail de OUTRA empresa, o app pergunta se a
   pessoa quer entrar nela. "Continuar na minha empresa" fica guardado POR CONVITE neste
   aparelho (empresa + data do convite): não pergunta de novo; um convite refeito pergunta. */
const CHAVE_ESCOLHA_CONVITE = "_kmzero_convite_continuar:";
const idEscolhaConvite = (email, convite) => `${CHAVE_ESCOLHA_CONVITE}${emailChave(email)}|${convite?.empresaId || ""}|${convite?.criadoEm || 0}`;
export function conviteJaRecusado(email, convite) {
  try { return localStorage.getItem(idEscolhaConvite(email, convite)) === "1"; } catch { return false; }
}
export function guardarRecusaConvite(email, convite) {
  try { localStorage.setItem(idEscolhaConvite(email, convite), "1"); } catch {}
}

/* A troca de empresa só vale para quem tem como voltar e nada a perder: o DONO (administrador,
   empresas/{id}.gestorUid) de uma empresa VAZIA (sem obras nem trabalhadores). É o caso real de
   quem entrou antes do convite e tocou em "criar minha empresa". Se a troca falhar no meio, as
   regras deixam o dono refazer o perfil antigo (caminho (a)).
   - Quem NÃO é dono não teria como voltar: o convite que o trouxe já não existe (um convite por
     e-mail) e o caminho (a) é só do dono. Pelo app ele não troca (desativar em Usuários e acessos
     não apaga o perfil, e o desativado não chega ao convite novo): a troca dele é com o suporte.
   - O administrador de uma empresa COM dados nunca a perde por um toque: o dono é protegido.
   Melhor esforço: o que não deu para conferir (sem internet, sem permissão) conta como "não".
   Devolve { ok: true } ou { ok: false, motivo, erro }. */
export async function podeTrocarDeEmpresa(uid, empresaId) {
  const fb = cloudRefs();
  const semConferir = { ok: false, motivo: "sem-conferir", erro: "Não foi possível conferir a sua empresa atual. Verifique a conexão e tente de novo. Você continua na sua empresa." };
  if (!fb || !uid || !empresaId) return semConferir;
  try {
    const emp = await getDoc(doc(fb.db, "empresas", String(empresaId)));
    if (!emp.exists() || emp.data().gestorUid !== uid) {
      return { ok: false, motivo: "nao-dono", erro: "Esta conta faz parte de uma empresa que ela não administra: a troca não é feita pelo app, porque não haveria como voltar se algo falhasse. Fale com o suporte da KM para mudar de empresa. Nada mudou: você continua na sua empresa." };
    }
  } catch (e) { console.warn("podeTrocarDeEmpresa:", e); return semConferir; }
  const contagem = {};
  for (const col of ["obras", "trabalhadores"]) {
    try { contagem[col] = (await getCountFromServer(collection(fb.db, "empresas", String(empresaId), col))).data().count; }
    catch (e) { console.warn("podeTrocarDeEmpresa:", col, e); return semConferir; }
  }
  if (contagem.obras > 0 || contagem.trabalhadores > 0) {
    return { ok: false, motivo: "com-dados", erro: "Esta conta é a administradora de uma empresa com obras ou trabalhadores cadastrados: ela não troca de empresa pelo app (os dados ficariam sem administrador). Fale com o suporte da KM." };
  }
  return { ok: true };
}

/* Convite para este e-mail de OUTRA empresa que não a do perfil (ou null). Só para perfil
   de escritório ativo e só quando a troca é segura (podeTrocarDeEmpresa: dono de empresa
   vazia). Melhor esforço: sem internet, sem convite, convite desligado, já recusado neste
   aparelho ou troca não permitida → null, e a pessoa entra como sempre. As leituras extras
   (empresa e contagens) só acontecem quando existe convite de outra empresa. */
export async function conviteDeOutraEmpresa(email, perfil, uid) {
  if (!perfil || perfil.perfil !== "gestor" || !perfil.empresaId || perfil.ativo === false || !uid) return null;
  if (!emailChave(email).includes("@")) return null;
  const c = await buscarConvite(email);
  if (!c.ok || !c.convite) return null;
  const cv = c.convite;
  if (!cv.empresaId || String(cv.empresaId) === String(perfil.empresaId) || cv.ativo === false) return null;
  if (conviteJaRecusado(email, cv)) return null;
  if (!(await podeTrocarDeEmpresa(uid, perfil.empresaId)).ok) return null;
  return cv;
}

/* Nome e tamanho da empresa atual da pessoa (para avisar o que fica para trás na troca).
   Melhor esforço: o que não deu para ler volta "" / null. */
export async function resumoEmpresaParaTroca(empresaId) {
  const r = { nome: "", obras: null, trabalhadores: null };
  const fb = cloudRefs();
  if (!fb || !empresaId) return r;
  try {
    const s = await getDoc(doc(fb.db, "empresas", empresaId));
    if (s.exists()) r.nome = s.data().nomeFantasia || s.data().razaoSocial || "";
  } catch (e) { console.warn("resumoEmpresaParaTroca:", e); }
  for (const col of ["obras", "trabalhadores"]) {
    try { r[col] = (await getCountFromServer(collection(fb.db, "empresas", empresaId, col))).data().count; }
    catch (e) { console.warn("resumoEmpresaParaTroca:", col, e); }
  }
  return r;
}

/* Mesmo convite que a pessoa viu na pergunta (empresa, tipo de acesso e áreas)? */
const mesmoConvite = (a, b) => !!a && !!b
  && String(a.empresaId) === String(b.empresaId)
  && (a.perfil || "encarregado") === (b.perfil || "encarregado")
  && JSON.stringify(Array.isArray(a.acessos) ? a.acessos : null) === JSON.stringify(Array.isArray(b.acessos) ? b.acessos : null);

/* "Entrar na empresa que me convidou": apaga o PRÓPRIO perfil e cria o novo pelo convite
   (as regras só criam perfil onde não existe). A empresa antiga NÃO é apagada.
   Antes de apagar qualquer coisa, confere tudo de novo na nuvem:
   - o convite RELIDO agora (pode ter sido desligado, cancelado ou refeito depois da pergunta)
     tem de ser o mesmo que a pessoa aceitou; é ele (e não a cópia da pergunta) que vira perfil;
   - quem troca tem de poder voltar (podeTrocarDeEmpresa: dono de empresa vazia).
   Se o perfil novo não puder ser criado, refaz o antigo como dono (caminho (a) das regras),
   para a pessoa não ficar sem nenhum. */
export async function trocarParaConvite(userGoogle, convite) {
  const fb = cloudRefs();
  if (!fb) return { ok: false, erro: "Firebase não inicializado." };
  const email = emailChave(userGoogle?.email);
  if (userGoogle.emailVerificado === false) { const e = erroEmailNaoVerificado(email); return { ok: false, codigo: e.codigo, erro: e.erro }; }
  const c = await buscarConvite(email);
  if (!c.ok) return { ok: false, codigo: c.codigo, erro: c.erro };
  const cv = c.convite;
  if (!cv || cv.ativo === false || !cv.empresaId) {
    return { ok: false, codigo: "convite-indisponivel", erro: "Este convite não está mais disponível (foi cancelado ou desligado pela empresa que convidou). Nada mudou: você continua na sua empresa." };
  }
  if (convite && !mesmoConvite(cv, convite)) {
    return { ok: false, codigo: "convite-mudou", erro: "O convite mudou depois da pergunta (empresa, tipo de acesso ou áreas). Nada mudou: saia e entre de novo para ver o convite atualizado." };
  }
  const atual = await carregarPerfilNuvem(userGoogle.uid);
  if (!atual.ok) return { ok: false, codigo: atual.codigo, erro: atual.erro };
  const antigo = atual.perfil;
  if (antigo && antigo.ativo === false) {
    return { ok: false, codigo: "acesso-desativado", erro: `O acesso de ${email} foi desativado pelo gestor da empresa.` };
  }
  if (antigo && antigo.empresaId && String(antigo.empresaId) === String(cv.empresaId)) {
    return { ok: true, usuario: montarUsuarioLogin(userGoogle, antigo) }; // já está na empresa do convite
  }
  if (antigo && antigo.empresaId) {
    const pode = await podeTrocarDeEmpresa(userGoogle.uid, antigo.empresaId);
    if (!pode.ok) return { ok: false, codigo: "troca-" + pode.motivo, erro: pode.erro };
  }
  if (antigo) {
    try { await deleteDoc(doc(fb.db, "usuarios", userGoogle.uid)); }
    catch (e) {
      console.error("trocarParaConvite:", e);
      return { ok: false, codigo: e.code, erro: mensagemNuvem(e, "Não foi possível trocar de empresa. Verifique a conexão e tente de novo.") };
    }
  }
  const a = await aceitarConvite(userGoogle, cv);
  if (a.ok) return { ok: true, usuario: montarUsuarioLogin(userGoogle, a.perfil) };
  if (antigo && antigo.empresaId) {
    // Só o dono chega aqui (podeTrocarDeEmpresa): refaz o perfil dele, com acesso total
    const volta = { ...antigo, perfil: "gestor", acessos: null, email, ativo: true, atualizadoEm: Date.now() };
    try { await setDoc(doc(fb.db, "usuarios", userGoogle.uid), semUndefined(volta)); }
    catch (e) {
      console.warn("trocarParaConvite: o perfil antigo não voltou:", e);
      return { ok: false, codigo: a.codigo, erro: `${a.erro || "Não foi possível entrar na empresa do convite."} Saia e entre de novo com o Google.` };
    }
    return { ok: false, codigo: a.codigo, erro: `${a.erro || "Não foi possível entrar na empresa do convite."} Você continua na sua empresa.` };
  }
  return { ok: false, codigo: a.codigo, erro: a.erro };
}

/* Decide o que fazer depois de "Entrar com Google":
   - perfil existe e ativo → { tipo: "perfil", usuario }
   - perfil de escritório + convite de OUTRA empresa → { tipo: "convite_outra_empresa", usuario, convite }
     (a tela pergunta: entrar na empresa do convite ou continuar na própria)
   - sem perfil, com convite → cria o perfil → { tipo: "perfil", usuario }
   - sem perfil e sem convite → { tipo: "sem_convite" }
   - desativado / erro → { tipo: "erro", erro, codigo, email } */
export async function resolverEntradaGoogle(userGoogle) {
  const email = emailChave(userGoogle.email);
  const p = await carregarPerfilNuvem(userGoogle.uid);
  if (!p.ok) return { tipo: "erro", erro: p.erro, codigo: p.codigo, email };
  const montar = perfil => montarUsuarioLogin(userGoogle, perfil);
  const desativado = { tipo: "erro", desativado: true, codigo: "acesso-desativado", email, erro: `O acesso de ${email} foi desativado pelo gestor da empresa.` };
  if (p.perfil) {
    if (p.perfil.ativo === false) return desativado;
    if (p.perfil.empresaId) {
      // Dono da empresa limitado ou rebaixado (app ou regra antigos): entra já com acesso total.
      // Para os outros, restaurarDonoNuvem só confere o dono e devolve null (nada é gravado).
      let perfil = p.perfil;
      if (perfil.perfil !== "gestor" || lerAcessos(perfil) !== null) perfil = (await restaurarDonoNuvem(userGoogle.uid, perfil)) || perfil;
      const convite = await conviteDeOutraEmpresa(email, perfil, userGoogle.uid);
      if (convite) return { tipo: "convite_outra_empresa", usuario: montar(perfil), convite };
      return { tipo: "perfil", usuario: montar(perfil) };
    }
    // Perfil sem empresa (sobra de versão antiga): não abre nada e travaria o convite e o
    // cadastro da empresa (as regras só criam perfil onde não existe). Sai do caminho.
    await apagarPerfilProprio(userGoogle.uid);
  }
  const c = await buscarConvite(email);
  if (!c.ok) return { tipo: "erro", erro: c.erro, codigo: c.codigo, email };
  if (!c.convite) return { tipo: "sem_convite" };
  // Convite desligado (a pessoa foi desativada e o perfil dela sumiu): as regras recusariam o perfil
  if (c.convite.ativo === false) return desativado;
  if (userGoogle.emailVerificado === false) return erroEmailNaoVerificado(email);
  const a = await aceitarConvite(userGoogle, c.convite);
  if (!a.ok) return { tipo: "erro", erro: a.erro, codigo: a.codigo, email };
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
  if (_persistenciaSuspensa) return;
  try { localStorage.setItem(storePrefix() + "_syncIds_" + colecao, JSON.stringify(ids)); } catch {}
}

export const store = {
  async get(key) {
    try {
      const v = localStorage.getItem(storePrefix() + key);
      if (v) {
        const valor = JSON.parse(v);
        if (_modoDemo || key === 'usuarioLogado' || key.startsWith('_')) return valor;
        const trabalhadores = key === 'historico' ? (await this.get('trabalhadores') || []) : [];
        const permitido = filtrarCachePermitido(_perfilDados,key,valor,trabalhadores);
        return key === "fotosObras" && Array.isArray(permitido)
          ? permitido.map(f => normalizarFotoLocalPrivada(f, _empresaId)).filter(Boolean) : permitido;
      }
      if (_modoDemo && typeof window !== "undefined" && window.storage && window.storage.get) {
        const r = await window.storage.get(key);
        return r ? JSON.parse(r.value) : null;
      }
      return null;
    } catch (e) { console.warn("store.get error:", e); return null; }
  },
  async set(key, val) {
    if (_persistenciaSuspensa || (!_modoDemo && !_perfilDados && key !== 'usuarioLogado')) return;
    try {
      if (key === 'fotosObras' && Array.isArray(val)) val = val.map(f => {
        if (!f.fotoPath) return f;
        const {foto, fotoUrl, ...meta} = f;
        return meta;
      });
      const json = JSON.stringify(val);
      localStorage.setItem(storePrefix() + key, json);
      if (_modoDemo && typeof window !== "undefined" && window.storage && window.storage.set) {
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
