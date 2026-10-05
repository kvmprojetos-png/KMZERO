#!/usr/bin/env node
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore, Timestamp, GeoPoint } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { criarBackupEmpresa, carregarBackupEmpresa, verificarBackupEmpresa, restaurarSnapshotEmpresa } from "../api/_lib/backupEmpresa.js";

for (const [nome, esperado] of Object.entries({ FIRESTORE_EMULATOR_HOST: "127.0.0.1:8180", FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9299" })) {
  if (process.env[nome] !== esperado) throw new Error(`${nome} deve apontar ao emulador local ${esperado}. Nenhum acesso remoto permitido.`);
}
if (process.env.GCLOUD_PROJECT && !process.env.GCLOUD_PROJECT.startsWith("demo-")) throw new Error("Este ensaio só usa projeto demo.");
if (process.env.STORAGE_EMULATOR_HOST && process.env.STORAGE_EMULATOR_HOST !== "http://127.0.0.1:9299") throw new Error("STORAGE_EMULATOR_HOST não pode redirecionar o ensaio para outro servidor.");
const projectId = "demo-kmzero-security";
const app = initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` }, "backup-restore-demo");
const db = getFirestore(app);
const bucket = getStorage(app).bucket();
const empresaId = "backup-empresa-demo";
const uid = "backup-dono-demo";
const opts = { db, bucket, empresaId, uid };
let passou = 0;
const check = async (nome, fn) => { await fn(); passou++; console.log(`OK backup ${nome}`); };

try {
  const original = { nome: "Obra fictícia", data: new Timestamp(1700000000, 123456789), ponto: new GeoPoint(-19.1, -40.2), arquivo: Buffer.from([1, 2, 255]), referencia: db.doc(`empresas/${empresaId}`), mapa: { tipo: "timestamp" } };
  await db.doc(`empresas/${empresaId}`).set({ gestorUid: uid, nome: "EMPRESA APENAS DE TESTE" });
  await db.doc(`usuarios/${uid}`).set({ empresaId, ativo: true, perfil: "gestor" });
  await db.doc("convites/teste-backup@example.test").set({ empresaId, ativo: true });
  await db.doc(`empresas/${empresaId}/obras/obra-demo`).set(original);
  // Firestore persiste Timestamp com precisão de microssegundos. A referência
  // de restauração é o valor efetivamente salvo, não os nanos descartados pelo
  // próprio servidor antes de existir qualquer backup.
  const persistido = (await db.doc(`empresas/${empresaId}/obras/obra-demo`).get()).data();
  await db.doc(`empresas/${empresaId}/obras/obra-demo/etapas/etapa-demo`).set({ status: "planejada" });
  await db.doc(`empresas/${empresaId}/pais/sem-documento/filhos/neto-demo`).set({ preservado: true });
  const foto = bucket.file(`empresas/${empresaId}/fotosObras/foto-demo.jpg`);
  await foto.save(Buffer.from([255, 216, 255, 217]), { resumable: false, metadata: { contentType: "image/jpeg", metadata: { firebaseStorageDownloadTokens: "token-ficticio-apenas-emulador" } } });
  const manifesto = await criarBackupEmpresa(opts);
  await check("objeto gzip escrito e relido com hash verificado", async () => {
    assert.equal(manifesto.verificado, true);
    assert.ok(manifesto.contagens.documentos >= 6);
    assert.equal(manifesto.contagens.fotosMetadata, 1);
    const verificado = await verificarBackupEmpresa({ ...opts, backupId: manifesto.id });
    assert.equal(verificado.sha256, manifesto.sha256);
    assert.equal(verificado.snapshot, undefined);
  });
  const { snapshot } = await carregarBackupEmpresa({ ...opts, backupId: manifesto.id });
  await check("coleções aninhadas e descendente de pai ausente preservados", async () => {
    assert.ok(snapshot.documentos.some(d => d.path === `empresas/${empresaId}/obras/obra-demo/etapas/etapa-demo`));
    assert.ok(snapshot.documentos.some(d => d.path === `empresas/${empresaId}/pais/sem-documento/filhos/neto-demo`));
    assert.ok(snapshot.documentos.some(d => d.path === `usuarios/${uid}`));
    assert.ok(snapshot.documentos.some(d => d.path === "convites/teste-backup@example.test"));
  });
  await db.doc(`empresas/${empresaId}/obras/obra-demo`).set({ nome: "ALTERADA PARA ENSAIO" });
  await check("dry-run não restaura nem muda dados", async () => {
    const plano = await restaurarSnapshotEmpresa({ db, snapshot, empresaId });
    assert.equal(plano.aplicar, false);
    assert.equal((await db.doc(`empresas/${empresaId}/obras/obra-demo`).get()).data().nome, "ALTERADA PARA ENSAIO");
  });
  await db.doc(`empresas/${empresaId}/obras/extra-demo`).set({ preservar: true });
  await foto.setMetadata({ cacheControl: "private, no-store", metadata: { firebaseStorageDownloadTokens: "token-posterior-apenas-emulador" } });
  const [metadataPosterior] = await foto.getMetadata();
  await restaurarSnapshotEmpresa({ db, snapshot, empresaId, aplicar: true });
  await check("restauração real recupera Timestamp GeoPoint Bytes e DocumentReference", async () => {
    const dados = (await db.doc(`empresas/${empresaId}/obras/obra-demo`).get()).data();
    assert.equal(dados.nome, original.nome);
    assert.ok(dados.data.isEqual(persistido.data));
    assert.ok(dados.ponto.isEqual(persistido.ponto));
    assert.deepEqual(dados.arquivo, persistido.arquivo);
    assert.equal(dados.referencia.path, persistido.referencia.path);
    assert.deepEqual(dados.mapa, { tipo: "timestamp" });
  });
  await check("restauração não apaga registros extras nem altera metadados posteriores das fotos", async () => {
    assert.ok((await db.doc(`empresas/${empresaId}/obras/extra-demo`).get()).exists);
    const [meta] = await foto.getMetadata();
    assert.equal(meta.metadata?.firebaseStorageDownloadTokens, metadataPosterior.metadata?.firebaseStorageDownloadTokens);
    assert.equal(meta.cacheControl, metadataPosterior.cacheControl);
  });
  await check("snapshot de outra empresa é recusado sem escrever", async () => {
    await assert.rejects(restaurarSnapshotEmpresa({ db, snapshot, empresaId: "outra-empresa-demo", aplicar: true }), /inválido/);
    assert.equal((await db.doc("empresas/outra-empresa-demo").get()).exists, false);
  });
  await check("adulteração do arquivo impede verificação", async () => {
    await bucket.file(manifesto.path).save(Buffer.from("ALTERACAO FICTICIA"), { resumable: false });
    await assert.rejects(verificarBackupEmpresa({ ...opts, backupId: manifesto.id }), /integridade/);
  });
  console.log(JSON.stringify({ resultado: "aprovado", testes: passou, projeto: projectId, dados: "somente fictícios em emuladores locais" }));
} finally {
  await db.terminate();
  await deleteApp(app);
}
