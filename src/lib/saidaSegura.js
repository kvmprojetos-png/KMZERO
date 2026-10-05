/* Saída com cópia verificável e limpeza do aparelho. Este módulo não envia
   backups para lugar algum e nunca interpreta o clique em baixar como prova de
   que o arquivo foi salvo: a confirmação pertence à pessoa, na interface. */
import { filtrarCachePermitido } from "./permissoesDados.js";
export const CHAVE_LIMPEZA_PENDENTE = "_kmzero_limpeza_pendente";
const NOME_TRAVA = "kmzero-cache-sessao-v2";
const META_BACKUP = "kmzero-saida-v1";
let liberarCompartilhada = null;
let compartilhadaFinalizada = null;

function storagePadrao() { return globalThis.localStorage; }
function validarEmpresa(empresaId) {
  if (typeof empresaId !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(empresaId) || empresaId === "demo") {
    throw new Error("Empresa inválida para a saída segura.");
  }
  return empresaId;
}
function serializarEstavel(valor) {
  if (Array.isArray(valor)) return `[${valor.map(serializarEstavel).join(",")}]`;
  if (valor && typeof valor === "object") return `{${Object.keys(valor).sort().map(k => `${JSON.stringify(k)}:${serializarEstavel(valor[k])}`).join(",")}}`;
  return JSON.stringify(valor);
}
async function assinatura(valor) {
  const bytes = new TextEncoder().encode(serializarEstavel(valor));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function lerChavesEmpresa(empresaId, storage) {
  const prefixo = `${validarEmpresa(empresaId)}_`;
  const dados = {};
  for (let i = 0; i < storage.length; i++) {
    const chave = storage.key(i);
    if (chave?.startsWith(prefixo)) dados[chave] = storage.getItem(chave);
  }
  return dados;
}
async function lerEstado(empresaId, opcoes) {
  const storage = opcoes.storage || storagePadrao();
  const lerAnexos = opcoes.lerAnexos || (async id => (await import("./fileStore.js")).listarAnexosLocais(id));
  const anexos = await lerAnexos(empresaId); // Falha de leitura não significa banco vazio.
  return { dados: lerChavesEmpresa(empresaId, storage), anexos };
}

export function donoCacheLocal(empresaId, storage = storagePadrao()) {
  return storage.getItem(`${validarEmpresa(empresaId)}__donoCacheUid`) || null;
}
export function marcarDonoCacheLocal(empresaId, uid, storage = storagePadrao()) {
  if (!uid || typeof uid !== "string") throw new Error("Sessão sem identificação.");
  storage.setItem(`${validarEmpresa(empresaId)}__donoCacheUid`, uid);
}

/* Não apaga automaticamente valores removidos pelas novas permissões: eles
   podem conter edições offline ainda únicas. O coordenador só aplica depois
   de resguardar a cópia anterior por um fluxo autorizado de recuperação. */
export function higienizarCachePermissoes(perfil, { empresaId = perfil?.empresaId, storage = storagePadrao(), aplicar = false, copiaAnteriorConfirmada = false } = {}) {
  const estado = lerChavesEmpresa(empresaId, storage);
  const prefixo = `${empresaId}_`;
  const valores = {};
  for (const [chave, bruto] of Object.entries(estado)) {
    const nome = chave.slice(prefixo.length);
    if (nome.startsWith("_") || nome === "usuarioLogado") continue;
    try { valores[nome] = JSON.parse(bruto); }
    catch { throw new Error("Cache local inválido. Preserve os dados antes de alterar suas permissões."); }
  }
  const trabalhadores = filtrarCachePermitido(perfil, "trabalhadores", valores.trabalhadores || []) || [];
  const permitidos = {};
  const chavesRestritas = [];
  for (const [nome, valor] of Object.entries(valores)) {
    permitidos[nome] = filtrarCachePermitido(perfil, nome, valor, trabalhadores);
    if (serializarEstavel(permitidos[nome]) !== serializarEstavel(valor)) chavesRestritas.push(nome);
  }
  if (aplicar && chavesRestritas.length && !copiaAnteriorConfirmada) throw new Error("É necessário resguardar os dados anteriores com uma pessoa autorizada antes de remover conteúdo do cache.");
  if (aplicar) for (const nome of chavesRestritas) storage.setItem(prefixo + nome, JSON.stringify(permitidos[nome]));
  return { ok: chavesRestritas.length === 0 || aplicar, chavesRestritas, permitidos, aplicado: aplicar };
}

/* Chamar no boot de toda aba, antes de liberar edição. Navegadores sem Web
   Locks não recebem uma limpeza otimista: a saída informa a limitação. */
export async function registrarAbaProtegida(locks = globalThis.navigator?.locks) {
  if (!locks) return false;
  if (compartilhadaFinalizada) return true;
  let iniciou;
  const pronta = new Promise(resolve => { iniciou = resolve; });
  compartilhadaFinalizada = locks.request(NOME_TRAVA, { mode: "shared" }, async () => {
    await new Promise(resolve => { liberarCompartilhada = resolve; iniciou(); });
  });
  compartilhadaFinalizada.catch(() => iniciou());
  await pronta;
  return !!liberarCompartilhada;
}
async function comTravaExclusiva(operacao) {
  const locks = globalThis.navigator?.locks;
  if (!locks) throw new Error("Este navegador não permite limpar os dados com segurança entre abas. Use uma versão atual do Chrome, Edge, Firefox ou Safari.");
  if (liberarCompartilhada) liberarCompartilhada();
  await compartilhadaFinalizada;
  liberarCompartilhada = null;
  compartilhadaFinalizada = null;
  let concluiu = false;
  try {
    return await locks.request(NOME_TRAVA, { mode: "exclusive", ifAvailable: true }, async lock => {
      if (!lock) throw new Error("Feche as outras abas ou janelas do KMZERO antes de sair e limpar os dados deste aparelho.");
      const resultado = await operacao();
      concluiu = resultado?.ok === true;
      return resultado;
    });
  } finally { if (!concluiu) await registrarAbaProtegida(locks); }
}

export async function prepararSaida({ empresaId, uid, perfil, ...opcoes }) {
  validarEmpresa(empresaId);
  if (!uid || typeof uid !== "string") throw new Error("Sessão sem identificação.");
  const storage = opcoes.storage || storagePadrao();
  const dono = donoCacheLocal(empresaId, storage);
  if (dono && dono !== uid) throw new Error("Os dados locais pertencem a outra sessão. Não é permitido exportá-los nesta conta.");
  if (!perfil || perfil.ativo === false || (perfil.firebaseUid || perfil.id) !== uid || perfil.empresaId !== empresaId) throw new Error("Confirme seu acesso à empresa antes de preparar o backup de saída.");
  const higiene = higienizarCachePermissoes(perfil, { empresaId, storage });
  if (!higiene.ok) throw new Error("O aparelho guarda dados de permissões anteriores. Uma pessoa autorizada precisa resguardá-los antes da limpeza; este acesso não pode exportá-los.");
  const estado = await lerEstado(empresaId, opcoes);
  if (estado.anexos.length && !(perfil.perfil === "gestor" && perfil.acessos == null)) {
    throw new Error("Há anexos locais cuja permissão individual não pode ser confirmada. O gestor com acesso completo precisa resguardá-los antes da limpeza. Nenhum arquivo foi apagado.");
  }
  return montarPlano(empresaId, uid, estado);
}

async function montarPlano(empresaId, uid, estado) {
  const dados = {};
  const prefixo = `${empresaId}_`;
  for (const [chave, bruto] of Object.entries(estado.dados)) {
    const nome = chave.slice(prefixo.length);
    if (nome.startsWith("_") || nome === "usuarioLogado") continue;
    try { dados[nome === "rdos" ? "rdosEmitidos" : nome] = JSON.parse(bruto); }
    catch { throw new Error("Um registro local não pôde ser lido. A saída foi interrompida para preservar os dados."); }
  }
  // Mantém compatibilidade com o importador de Backup & Restaurar.
  dados.obras ||= [];
  dados.trabalhadores ||= [];
  const requerBackup = Object.keys(estado.dados).some(k => !k.slice(prefixo.length).startsWith("_") && !k.endsWith("_usuarioLogado")) || estado.anexos.length > 0;
  const backup = { ...dados, anexosLocais: structuredClone(estado.anexos), _kmzeroBackup: { tipo: META_BACKUP, empresaId, uid, criadoEm: new Date().toISOString() } };
  return { empresaId, uid, backup, requerBackup, assinatura: await assinatura(estado), totalAnexos: estado.anexos.length };
}

/* Recuperação administrativa distinta da exportação do perfil comum: só o
   proprietário ativo, confirmado no SERVIDOR, pode preservar o cache legado
   integral da empresa. Perfil restrito não recebe esta exceção por ser gestor. */
export async function prepararRecuperacaoDono({ empresaId, uid, perfil, ...opcoes }) {
  validarEmpresa(empresaId);
  const confirmar = opcoes.confirmarDono || (async (eid, id) => (await import("../firebase.js")).confirmarDonoNoServidor(eid, id));
  if (!perfil || perfil.empresaId !== empresaId || (perfil.firebaseUid || perfil.id) !== uid || perfil.ativo === false || !(await confirmar(empresaId, uid))) {
    throw new Error("A recuperação integral exige confirmação do proprietário ativo no servidor.");
  }
  const donoAnterior = donoCacheLocal(empresaId, opcoes.storage || storagePadrao());
  if (donoAnterior && donoAnterior !== uid) throw new Error("Este cache foi aberto por outra conta. A recuperação precisa de revisão do responsável antes de continuar.");
  const plano = await montarPlano(empresaId, uid, await lerEstado(empresaId, opcoes));
  plano.recuperacaoDono = true;
  plano.perfil = structuredClone(perfil);
  plano.backup._kmzeroBackup.finalidade = "recuperacao-proprietario";
  return plano;
}

export async function concluirRecuperacaoDono({ plano, backupConfirmado = false, ...opcoes }) {
  try {
    if (!plano?.recuperacaoDono || !backupConfirmado) throw new Error("Baixe a cópia integral e confirme que o arquivo foi salvo antes de recuperar o acesso.");
    const confirmar = opcoes.confirmarDono || (async (eid, id) => (await import("../firebase.js")).confirmarDonoNoServidor(eid, id));
    return await (opcoes.comTrava || comTravaExclusiva)(async () => {
      if (!(await confirmar(plano.empresaId, plano.uid))) throw new Error("O servidor não confirmou o proprietário ativo. Nenhum dado local foi removido.");
      const estado = await lerEstado(plano.empresaId, opcoes);
      if (await assinatura(estado) !== plano.assinatura) throw new Error("O cache mudou depois da cópia. Prepare e salve um novo backup antes de recuperar o acesso.");
      higienizarCachePermissoes(plano.perfil, { empresaId: plano.empresaId, storage: opcoes.storage || storagePadrao(), aplicar: true, copiaAnteriorConfirmada: true });
      // Anexos ficam intocados. A saída protegida pode removê-los posteriormente
      // com sua própria confirmação. Somente as chaves filtradas são atualizadas.
      return { ok: true, recarregar: true };
    });
  } catch (e) { return { ok: false, erro: e?.message || "Não foi possível recuperar o cache." }; }
}

export function baixarBackupSaida(plano) {
  if (!plano?.backup || plano.backup._kmzeroBackup?.tipo !== META_BACKUP) throw new Error("Backup inválido.");
  const blob = new Blob([JSON.stringify(plano.backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kmzero-saida-${plano.empresaId}-${new Date().toISOString().slice(0, 10)}.json`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // O navegador pode começar o download depois do handler do clique.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function lerLimpezaPendente(storage = storagePadrao()) {
  const bruto = storage.getItem(CHAVE_LIMPEZA_PENDENTE);
  if (!bruto) return null;
  const p = JSON.parse(bruto);
  validarEmpresa(p.empresaId);
  if (!p.uid || p.backupConfirmado !== true) throw new Error("A limpeza anterior precisa ser conferida antes de abrir os dados.");
  return p;
}
function limparLocal(empresaId, storage) {
  for (const chave of Object.keys(lerChavesEmpresa(empresaId, storage))) storage.removeItem(chave);
  for (const chave of ["_kmzero_sessao", "_kmzero_empresaId", "_kmzero_push_token", CHAVE_LIMPEZA_PENDENTE]) storage.removeItem(chave);
}

/* O integrador congela edição/sync do React antes de preparar. A confirmação de
   gravações e o hash são refeitos no instante da limpeza. Um arquivo baixado
   antes de nova alteração não pode autorizar a exclusão dessa alteração. */
export async function executarSaida({ plano, backupConfirmado = false, ...opcoes }) {
  const storage = opcoes.storage || storagePadrao();
  const trava = opcoes.comTrava || comTravaExclusiva;
  let cacheEncerrado = false;
  let saiu = false;
  try {
    if (!plano?.empresaId || !plano?.uid) throw new Error("Prepare a saída novamente.");
    if (plano.requerBackup && !backupConfirmado) throw new Error("Baixe o backup e confirme que o arquivo foi salvo antes de sair.");
    if (opcoes.online === false || (opcoes.online === undefined && globalThis.navigator?.onLine === false)) throw new Error("Aguarde a conexão para sincronizar os dados antes de sair.");
    const fb = opcoes.firebase || await import("../firebase.js");
    return await trava(async () => {
      if (fb.usuarioAtual()?.uid !== plano.uid) throw new Error("A conta mudou. Prepare a saída novamente com a conta correta.");
      await (opcoes.aguardarSincronizacao || fb.aguardarGravacoesFirebase)();
      const atual = await lerEstado(plano.empresaId, opcoes);
      if (await assinatura(atual) !== plano.assinatura) throw new Error("Os dados mudaram depois do backup. Prepare a saída e baixe uma nova cópia para não perder alterações.");
      if (fb.usuarioAtual()?.uid !== plano.uid) throw new Error("A conta mudou durante a sincronização. Nenhum dado local foi apagado.");
      // Só persiste autorização de limpeza depois de todas as pré-condições.
      storage.setItem(CHAVE_LIMPEZA_PENDENTE, JSON.stringify({ empresaId: plano.empresaId, uid: plano.uid, backupConfirmado: true, criadoEm: new Date().toISOString() }));
      cacheEncerrado = true;
      await fb.limparCacheFirestoreParaSaida();
      const resultado = await fb.logoutFirebase();
      if (!resultado?.ok) throw new Error("Não foi possível encerrar a sessão. Recarregue o app e tente novamente.");
      saiu = true;
      const apagarAnexos = opcoes.apagarAnexos || (async id => (await import("./fileStore.js")).apagarBancoAnexos(id));
      await apagarAnexos(plano.empresaId);
      limparLocal(plano.empresaId, storage);
      return { ok: true };
    });
  } catch (e) {
    // Falhou antes de sair: não deixar uma autorização antiga apagar mudanças
    // futuras. Falhou depois: o boot termina a limpeza já autorizada antes de
    // permitir outro login. O backup confirmado preserva os anexos.
    if (!saiu) storage.removeItem(CHAVE_LIMPEZA_PENDENTE);
    return { ok: false, erro: e?.message || "Não foi possível concluir a saída segura.", recarregar: cacheEncerrado || !!e?.recarregar, limpezaPendente: saiu };
  }
}

export async function concluirLimpezaPendente(opcoes = {}) {
  const storage = opcoes.storage || storagePadrao();
  const pendente = lerLimpezaPendente(storage);
  if (!pendente) return { ok: true, limpou: false };
  const fb = opcoes.firebase || await import("../firebase.js");
  if (fb.usuarioAtual()) throw new Error("Há uma limpeza de saída incompleta. Encerre a sessão antes de abrir outra conta.");
  const apagarAnexos = opcoes.apagarAnexos || (async id => (await import("./fileStore.js")).apagarBancoAnexos(id));
  await (opcoes.comTrava || comTravaExclusiva)(async () => {
    await fb.limparCacheFirestoreParaSaida();
    await apagarAnexos(pendente.empresaId);
    limparLocal(pendente.empresaId, storage);
    return { ok: true };
  });
  return { ok: true, limpou: true, recarregar: true };
}
