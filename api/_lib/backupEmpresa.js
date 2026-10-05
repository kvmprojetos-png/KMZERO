import { createHash, randomUUID } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { Timestamp, GeoPoint, DocumentReference } from "firebase-admin/firestore";

const VERSAO = "kmzero-firestore-v1";
const MAX_DOCUMENTOS = 10000;
const MAX_BYTES = 32 * 1024 * 1024;
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const idValido = id => typeof id === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(id);

/* Todas as estruturas têm uma tag, inclusive mapas. Portanto um documento que
   contém {tipo:"timestamp"} nunca é confundido com metadado do serializador. */
export function codificarValorFirestore(valor) {
  if (valor === null) return ["null"];
  if (typeof valor === "boolean") return ["boolean", valor];
  if (typeof valor === "string") return ["string", valor];
  if (typeof valor === "number") return ["number", Number.isNaN(valor) ? "NaN" : valor === Infinity ? "+Infinity" : valor === -Infinity ? "-Infinity" : Object.is(valor, -0) ? "-0" : valor];
  if (valor instanceof Timestamp) return ["timestamp", valor.seconds, valor.nanoseconds];
  if (valor instanceof Date) return codificarValorFirestore(Timestamp.fromDate(valor));
  if (valor instanceof GeoPoint) return ["geopoint", valor.latitude, valor.longitude];
  if (valor instanceof DocumentReference) return ["reference", valor.path];
  if (Buffer.isBuffer(valor) || valor instanceof Uint8Array) return ["bytes", Buffer.from(valor).toString("base64")];
  if (Array.isArray(valor)) return ["array", valor.map(codificarValorFirestore)];
  if (valor && typeof valor === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(valor))) {
    return ["map", Object.keys(valor).sort().map(k => [k, codificarValorFirestore(valor[k])])];
  }
  throw new Error("O backup encontrou um tipo Firestore não suportado; nenhuma migração deve ser iniciada.");
}

export function decodificarValorFirestore(valor, db) {
  if (!Array.isArray(valor)) throw new Error("Valor inválido no backup.");
  const [tipo, a, b] = valor;
  switch (tipo) {
    case "null": return null;
    case "boolean": if (typeof a === "boolean") return a; break;
    case "string": if (typeof a === "string") return a; break;
    case "number":
      if (typeof a === "number") return a;
      if (a === "NaN") return NaN;
      if (a === "+Infinity") return Infinity;
      if (a === "-Infinity") return -Infinity;
      if (a === "-0") return -0;
      break;
    case "timestamp": return new Timestamp(a, b);
    case "geopoint": return new GeoPoint(a, b);
    case "bytes": if (typeof a === "string" && Buffer.from(a, "base64").toString("base64") === a) return Buffer.from(a, "base64"); break;
    case "reference": if (typeof a === "string" && a.split("/").length % 2 === 0) return db.doc(a); break;
    case "array": if (Array.isArray(a)) return a.map(v => decodificarValorFirestore(v, db)); break;
    case "map": {
      if (!Array.isArray(a)) break;
      const saida = {};
      for (const par of a) {
        if (!Array.isArray(par) || par.length !== 2 || typeof par[0] !== "string" || Object.hasOwn(saida, par[0])) throw new Error("Mapa inválido no backup.");
        // defineProperty preserva a chave __proto__ como dado, sem mudar protótipo.
        Object.defineProperty(saida, par[0], { value: decodificarValorFirestore(par[1], db), enumerable: true, writable: true, configurable: true });
      }
      return saida;
    }
  }
  throw new Error("Valor inválido no backup.");
}

async function confirmarDono(db, empresaId, uid) {
  if (!idValido(empresaId) || !idValido(uid)) throw new Error("Identificação inválida para backup.");
  const [empresa, perfil] = await Promise.all([db.doc(`empresas/${empresaId}`).get(), db.doc(`usuarios/${uid}`).get()]);
  if (!empresa.exists || empresa.data()?.gestorUid !== uid || !perfil.exists || perfil.data()?.empresaId !== empresaId || perfil.data()?.ativo === false) {
    throw Object.assign(new Error("Somente o dono ativo pode gerenciar o backup da empresa."), { code: "permission-denied" });
  }
  return empresa;
}

export async function capturarSnapshotEmpresa({ db, bucket, empresaId, uid }) {
  const empresa = await confirmarDono(db, empresaId, uid);
  const documentos = [];
  const vistos = new Set();
  const inicio = new Date().toISOString();
  let tamanho = 0;
  async function percorrer(iniciais) {
    let fila = iniciais.map(snap => ({ ref: snap.ref, snap }));
    while (fila.length) {
      const proxima = [];
      // Oito leituras independentes por vez, com teto global mesmo em árvores
      // aninhadas. Não serializar duas viagens de rede para cada presença.
      for (let i = 0; i < fila.length; i += 8) {
        await Promise.all(fila.slice(i, i + 8).map(async ({ ref, snap: pronto }) => {
          if (vistos.has(ref.path)) return;
          vistos.add(ref.path);
          const snap = pronto || await ref.get();
          if (snap.exists) {
            if (documentos.length >= MAX_DOCUMENTOS) throw new Error("Empresa excede o limite deste backup. Use uma exportação administrada antes de continuar.");
            const registro = { path: ref.path, data: codificarValorFirestore(snap.data()), updateTime: snap.updateTime ? codificarValorFirestore(snap.updateTime) : null };
            tamanho += Buffer.byteLength(JSON.stringify(registro));
            if (tamanho > MAX_BYTES) throw new Error("Empresa excede o tamanho seguro deste backup. Nenhuma migração foi iniciada.");
            documentos.push(registro);
          }
          // Referências de pais ausentes também podem ter descendentes. Nunca
          // encerrar a busca apenas porque o documento do pai foi apagado.
          const colecoes = await ref.listCollections();
          for (const colecao of colecoes.sort((a, b) => a.id.localeCompare(b.id))) {
            if (ref.path === `empresas/${empresaId}` && colecao.id === "_backups") continue;
            for (const filho of await colecao.listDocuments()) proxima.push({ ref: filho });
          }
        }));
      }
      fila = proxima;
    }
  }
  await percorrer([empresa]);
  for (const nome of ["usuarios", "convites"]) {
    const encontrados = await db.collection(nome).where("empresaId", "==", empresaId).get();
    await percorrer(encontrados.docs);
  }
  const fotos = [];
  let pageToken;
  do {
    const [arquivos, proxima] = await bucket.getFiles({ prefix: `empresas/${empresaId}/fotosObras/`, autoPaginate: false, maxResults: 1000, ...(pageToken ? { pageToken } : {}) });
    for (const arquivo of arquivos) {
      if (!arquivo.name.startsWith(`empresas/${empresaId}/fotosObras/`)) throw new Error("Objeto fora da empresa no backup.");
      const [metadata] = await arquivo.getMetadata();
      tamanho += Buffer.byteLength(JSON.stringify(metadata));
      if (tamanho > MAX_BYTES) throw new Error("Os metadados das fotos excedem o tamanho seguro do backup.");
      fotos.push({ path: arquivo.name, metadata });
      if (fotos.length > MAX_DOCUMENTOS) throw new Error("Quantidade de fotos excede o limite seguro do backup.");
    }
    pageToken = proxima?.pageToken;
  } while (pageToken);
  documentos.sort((a, b) => a.path.localeCompare(b.path));
  fotos.sort((a, b) => a.path.localeCompare(b.path));
  return { versao: VERSAO, empresaId, ownerUid: uid, iniciadoEm: inicio, concluidoEm: new Date().toISOString(), documentos, fotos,
    escopo: "Firestore e metadados das fotos; leitura paralela limitada e não transacional, bytes das fotos não duplicados" };
}

function resumoManifesto(m) {
  return { id: m.id, empresaId: m.empresaId, ownerUid: m.ownerUid, path: m.path, sha256: m.sha256,
    criadoEm: m.criadoEm, contagens: m.contagens, tamanhoBytes: m.tamanhoBytes, verificado: m.verificado === true,
    escopo: m.escopo };
}

export async function criarBackupEmpresa({ db, bucket, empresaId, uid }) {
  const snapshot = await capturarSnapshotEmpresa({ db, bucket, empresaId, uid });
  const json = Buffer.from(JSON.stringify(snapshot));
  if (json.length > MAX_BYTES) throw new Error("Backup acima do limite seguro. Nenhuma migração deve ser iniciada.");
  const bytes = gzipSync(json);
  const hash = sha256(bytes);
  const id = `${Date.now()}-${randomUUID()}`;
  const path = `_backups/${empresaId}/${id}.json.gz`;
  const arquivo = bucket.file(path);
  await arquivo.save(bytes, { resumable: false, validation: "crc32c", preconditionOpts: { ifGenerationMatch: 0 },
    metadata: { contentType: "application/gzip", cacheControl: "private, no-store, max-age=0", metadata: { sha256: hash, empresaId, versao: VERSAO } } });
  const [lido] = await arquivo.download();
  if (sha256(lido) !== hash) throw new Error("A cópia do backup não passou na verificação de integridade.");
  // Verifica conteúdo decodificado também, antes do manifesto habilitar migração.
  const relido = JSON.parse(gunzipSync(lido, { maxOutputLength: MAX_BYTES }));
  if (relido.versao !== VERSAO || relido.empresaId !== empresaId || relido.ownerUid !== uid || relido.documentos.length !== snapshot.documentos.length) throw new Error("Backup relido incompatível.");
  const manifesto = { id, empresaId, ownerUid: uid, path, sha256: hash, criadoEm: new Date().toISOString(),
    contagens: { documentos: snapshot.documentos.length, fotosMetadata: snapshot.fotos.length }, tamanhoBytes: bytes.length,
    verificado: true, escopo: snapshot.escopo };
  await db.doc(`empresas/${empresaId}/_backups/${id}`).create(manifesto);
  return resumoManifesto(manifesto);
}

export async function carregarBackupEmpresa({ db, bucket, empresaId, uid, backupId }) {
  await confirmarDono(db, empresaId, uid);
  if (!idValido(backupId)) throw new Error("Identificador de backup inválido.");
  const salvo = await db.doc(`empresas/${empresaId}/_backups/${backupId}`).get();
  const m = salvo.exists ? salvo.data() : null;
  const path = `_backups/${empresaId}/${backupId}.json.gz`;
  if (!m || m.verificado !== true || m.empresaId !== empresaId || m.ownerUid !== uid || m.id !== backupId || m.path !== path || !/^[a-f0-9]{64}$/.test(m.sha256)) {
    throw new Error("O backup não tem um manifesto verificado para este dono e empresa.");
  }
  const arquivo = bucket.file(path);
  const [metadata] = await arquivo.getMetadata();
  if (Number(metadata.size) > MAX_BYTES) throw new Error("Backup excede o limite de leitura.");
  const [bytes] = await arquivo.download();
  if (bytes.length > MAX_BYTES || sha256(bytes) !== m.sha256) throw new Error("A integridade do backup não pôde ser confirmada.");
  const snapshot = JSON.parse(gunzipSync(bytes, { maxOutputLength: MAX_BYTES }));
  if (snapshot.versao !== VERSAO || snapshot.empresaId !== empresaId || snapshot.ownerUid !== uid || !Array.isArray(snapshot.documentos) || !Array.isArray(snapshot.fotos)
    || snapshot.documentos.length !== m.contagens?.documentos || snapshot.fotos.length !== m.contagens?.fotosMetadata) throw new Error("Conteúdo do backup incompatível com o manifesto.");
  return { manifesto: resumoManifesto(m), snapshot };
}

export async function verificarBackupEmpresa(opcoes) {
  const { manifesto } = await carregarBackupEmpresa(opcoes);
  return manifesto; // Nenhum dado de documentos ou token de foto sai por aqui.
}

/* Restauração é uma operação separada e administrada. A função prepara todo o
   lote antes de escrever. Default dry-run. Não remove documentos extras. */
export async function restaurarSnapshotEmpresa({ db, snapshot, empresaId, aplicar = false }) {
  if (!idValido(empresaId) || snapshot?.versao !== VERSAO || snapshot.empresaId !== empresaId || !Array.isArray(snapshot.documentos) || snapshot.documentos.length > MAX_DOCUMENTOS) throw new Error("Snapshot inválido para restauração.");
  const paths = new Set();
  const preparados = snapshot.documentos.map(registro => {
    const path = registro?.path;
    if (typeof path !== "string" || path.split("/").length % 2 !== 0 || paths.has(path) || !(path === `empresas/${empresaId}` || path.startsWith(`empresas/${empresaId}/`) || /^(usuarios|convites)\/[^/]+(?:\/[^/]+\/[^/]+)*$/.test(path))) throw new Error("Caminho fora do escopo ou repetido no backup.");
    if (path.startsWith(`empresas/${empresaId}/_backups/`)) throw new Error("Manifestos de backup não podem ser restaurados por este fluxo.");
    paths.add(path);
    const data = decodificarValorFirestore(registro.data, db);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Documento inválido no backup.");
    if (/^(usuarios|convites)\/[^/]+$/.test(path) && data.empresaId !== empresaId) throw new Error("Perfil ou convite fora da empresa.");
    return { path, data };
  });
  if (!paths.has(`empresas/${empresaId}`)) throw new Error("Snapshot sem cadastro da empresa.");
  for (const r of preparados) {
    if (/^(usuarios|convites)\//.test(r.path)) {
      const raiz = r.path.split("/").slice(0, 2).join("/");
      if (!preparados.some(p => p.path === raiz && p.data.empresaId === empresaId)) throw new Error("Subcoleção de perfil ou convite sem vínculo confirmado com a empresa.");
    }
  }
  const plano = { empresaId, aplicar, documentos: preparados.length, lotes: Math.ceil(preparados.length / 400), excluiDocumentos: false, restauraTokensFotos: false };
  if (!aplicar) return plano;
  for (let i = 0; i < preparados.length; i += 400) {
    const lote = db.batch();
    for (const r of preparados.slice(i, i + 400)) lote.set(db.doc(r.path), r.data);
    await lote.commit();
  }
  return { ...plano, restaurados: preparados.length };
}
