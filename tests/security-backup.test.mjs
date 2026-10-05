import test, { after } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore, Timestamp, GeoPoint } from "firebase-admin/firestore";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { codificarValorFirestore, decodificarValorFirestore, restaurarSnapshotEmpresa, verificarBackupEmpresa } from "../api/_lib/backupEmpresa.js";

const app = initializeApp({ projectId: "demo-kmzero-backup-unit" }, "backup-unit");
const dbTipos = getFirestore(app);
after(async () => { await dbTipos.terminate(); await deleteApp(app); });

test("backup preserva tipos usados pelo app, inclusive nanos, bytes e referência", () => {
  const origem = { nulo: null, flag: false, texto: "áçõ", nan: NaN, infinito: Infinity, menos: -Infinity, negativo: -0,
    timestamp: new Timestamp(1700000000, 123456789), local: new GeoPoint(-19.186, -40.105), bytes: Buffer.from([0, 255, 3]),
    ref: dbTipos.doc("empresas/e/obras/a"), itens: [{ valor: 12.3 }] };
  const copia = decodificarValorFirestore(JSON.parse(JSON.stringify(codificarValorFirestore(origem))), dbTipos);
  assert.equal(copia.nulo, null);
  assert.equal(copia.flag, false);
  assert.equal(copia.texto, "áçõ");
  assert.ok(Number.isNaN(copia.nan));
  assert.equal(copia.infinito, Infinity);
  assert.equal(copia.menos, -Infinity);
  assert.ok(Object.is(copia.negativo, -0));
  assert.ok(copia.timestamp.isEqual(origem.timestamp));
  assert.ok(copia.local.isEqual(origem.local));
  assert.deepEqual(copia.bytes, origem.bytes);
  assert.equal(copia.ref.path, "empresas/e/obras/a");
  assert.deepEqual(copia.itens, origem.itens);
});

test("campos parecidos com tags e __proto__ continuam dados comuns", () => {
  const origem = JSON.parse('{"__proto__":{"admin":true},"tipo":"timestamp","data":["timestamp",1,2]}');
  const copia = decodificarValorFirestore(codificarValorFirestore(origem), dbTipos);
  assert.equal(Object.getPrototypeOf(copia), Object.prototype);
  assert.equal(Object.hasOwn(copia, "__proto__"), true);
  assert.equal(copia.__proto__.admin, true);
  assert.equal({}.admin, undefined);
  assert.deepEqual(copia.data, ["timestamp", 1, 2]);
});

test("tipos não reconhecidos falham sem converter silenciosamente", () => {
  assert.throws(() => codificarValorFirestore(new Map([["a", 1]])), /não suportado/);
  assert.throws(() => codificarValorFirestore(undefined), /não suportado/);
  assert.throws(() => decodificarValorFirestore(["unknown", "dado"], dbTipos), /inválido/);
});

const registro = (path, data) => ({ path, data: codificarValorFirestore(data) });
function snapshot() { return { versao: "kmzero-firestore-v1", empresaId: "empresaA", ownerUid: "pessoaA", documentos: [registro("empresas/empresaA", { gestorUid: "pessoaA" }), registro("usuarios/pessoaA", { empresaId: "empresaA" })], fotos: [] }; }

test("restauração default é dry-run e não abre lote de escrita", async () => {
  const s = snapshot();
  let escritas = 0;
  const db = { doc: p => ({ path: p }), batch: () => { escritas++; throw new Error("não deve gravar"); } };
  const p = await restaurarSnapshotEmpresa({ db, snapshot: s, empresaId: "empresaA" });
  assert.equal(p.aplicar, false);
  assert.equal(p.documentos, 2);
  assert.equal(escritas, 0);
});

test("caminho de outra empresa aborta antes de qualquer escrita", async () => {
  const s = snapshot();
  s.documentos.push(registro("empresas/empresaB", { segredo: true }));
  let escritas = 0;
  await assert.rejects(restaurarSnapshotEmpresa({ db: { batch: () => { escritas++; } }, snapshot: s, empresaId: "empresaA", aplicar: true }), /fora do escopo/);
  assert.equal(escritas, 0);
});

test("perfil com empresa divergente e manifesto injetado são recusados", async () => {
  const s = snapshot();
  s.documentos[1] = registro("usuarios/pessoaA", { empresaId: "empresaB" });
  await assert.rejects(restaurarSnapshotEmpresa({ db: {}, snapshot: s, empresaId: "empresaA" }), /fora da empresa/);
  s.documentos[1] = registro("empresas/empresaA/_backups/falso", { verificado: true });
  await assert.rejects(restaurarSnapshotEmpresa({ db: {}, snapshot: s, empresaId: "empresaA" }), /Manifestos/);
});

test("subcoleção de perfil estranho não pode entrar sem seu vínculo da empresa", async () => {
  const s = snapshot();
  s.documentos.push(registro("usuarios/outraPessoa/anotacoes/privada", { segredo: true }));
  await assert.rejects(restaurarSnapshotEmpresa({ db: {}, snapshot: s, empresaId: "empresaA" }), /sem vínculo/);
});

function ambienteManifesto() {
  const bytes = gzipSync(Buffer.from(JSON.stringify(snapshot())));
  const manifesto = { id: "b1", empresaId: "empresaA", ownerUid: "pessoaA", path: "_backups/empresaA/b1.json.gz", sha256: createHash("sha256").update(bytes).digest("hex"), verificado: true, contagens: { documentos: 2, fotosMetadata: 0 } };
  const documentos = new Map([
    ["empresas/empresaA", { gestorUid: "pessoaA" }], ["usuarios/pessoaA", { empresaId: "empresaA", ativo: true }],
    ["empresas/empresaA/_backups/b1", manifesto],
  ]);
  let corpo = bytes;
  const db = { doc: path => ({ get: async () => ({ exists: documentos.has(path), data: () => documentos.get(path) }) }) };
  const bucket = { file: path => { assert.equal(path, manifesto.path); return { getMetadata: async () => [{ size: String(corpo.length) }], download: async () => [corpo] }; } };
  return { db, bucket, manifesto, documentos, tamper: () => { corpo = Buffer.from("alterado"); }, opcoes: { db, bucket, empresaId: "empresaA", uid: "pessoaA", backupId: "b1" } };
}

test("verificação usa manifesto privado e hash do objeto, retorna só resumo", async () => {
  const a = ambienteManifesto();
  const m = await verificarBackupEmpresa(a.opcoes);
  assert.equal(m.verificado, true);
  assert.equal(m.sha256, a.manifesto.sha256);
  assert.equal(m.documentos, undefined);
  assert.equal(m.fotos, undefined);
  assert.equal(m.snapshot, undefined);
});

test("objeto de backup adulterado nunca autoriza migração", async () => {
  const a = ambienteManifesto();
  a.tamper();
  await assert.rejects(verificarBackupEmpresa(a.opcoes), /integridade/);
});

test("manifesto ausente, não verificado ou de outro dono falha fechado", async () => {
  for (const mudar of [a => a.documentos.delete("empresas/empresaA/_backups/b1"), a => { a.manifesto.verificado = false; }, a => { a.manifesto.ownerUid = "outraPessoa"; }]) {
    const a = ambienteManifesto();
    mudar(a);
    await assert.rejects(verificarBackupEmpresa(a.opcoes), /manifesto/);
  }
});

test("dono removido ou desativado não consegue verificar nem baixar backup", async () => {
  const a = ambienteManifesto();
  a.documentos.get("usuarios/pessoaA").ativo = false;
  await assert.rejects(verificarBackupEmpresa(a.opcoes), /dono ativo/);
});
