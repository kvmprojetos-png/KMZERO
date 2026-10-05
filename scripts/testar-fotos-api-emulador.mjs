#!/usr/bin/env node
// Ensaio Admin Storage + Firestore real, somente emuladores, sem credenciais.
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { tratarFoto } from "../api/foto.js";
import { tratarSeguranca } from "../api/seguranca.js";
import { BUCKET_FOTOS } from "../src/lib/fotoCaminho.js";

for (const [key, value] of Object.entries({ FIRESTORE_EMULATOR_HOST: "127.0.0.1:8180", FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9299" })) {
  if (process.env[key] !== value) throw new Error(`${key} precisa apontar ao emulador local. Nenhum acesso remoto permitido.`);
}
if (process.env.STORAGE_EMULATOR_HOST && process.env.STORAGE_EMULATOR_HOST !== "http://127.0.0.1:9299") throw new Error("Storage remoto recusado.");
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== "demo-kmzero-security") throw new Error("Projeto remoto recusado.");
const projectId = "demo-kmzero-security";
const app = initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` }, "fotos-api-demo");
const db = getFirestore(app), bucket = getStorage(app).bucket();
const empresaId = "foto-empresa-demo", uid = "foto-dono-demo";
const fotoId = "foto-nova", legadoId = "foto-legada";
const path = `empresas/${empresaId}/fotosObras/${fotoId}.jpg`;
const legadoPath = `empresas/${empresaId}/fotosObras/${legadoId}.jpg`;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1QAAAABJRU5ErkJggg==", "base64");
const admin = { db, bucket, auth: { async verifyIdToken(_token, checkRevoked) { assert.equal(checkRevoked, true); return { uid }; } } };
const req = (method, body, query) => ({ method, headers: { authorization: "Bearer fake.fake.fake" }, body, query });
const res = () => ({ headers: {}, statusCode: 200, setHeader(k,v) { this.headers[k] = v; }, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; }, send(v) { this.body = v; return this; } });
let passou = 0;
const check = async (nome, fn) => { await fn(); passou++; console.log(`OK fotos/API ${nome}`); };
try {
  await db.doc(`empresas/${empresaId}`).set({ gestorUid: uid, nome: "Empresa fictícia" });
  await db.doc(`usuarios/${uid}`).set({ empresaId, perfil: "gestor", ativo: true, nome: "Dono fictício" });
  await db.doc(`empresas/${empresaId}/obras/7`).set({ id: 7, nome: "Obra fictícia", clienteDoc: "DADO-FICTICIO" });
  await db.doc(`empresas/${empresaId}/trabalhadores/1`).set({ id: 1, nome: "Pessoa fictícia", obraId: 7, salario: 5000, cpf: "CPF-FICTICIO" });
  await db.doc(`empresas/${empresaId}/presencas/ponto-1`).set({ trabId: 1, status: "Presente" });
  await db.doc(`empresas/${empresaId}/avisos/folha-1`).set({ de: "sistema", tipo: "folha", para: { tipo: "gestores" } });
  await check("upload Admin cria objeto privado e referência sem token", async () => {
    const r = res();
    await tratarFoto(admin, req("POST", { empresaId, foto: { id: fotoId, obraId: 7, foto: `data:image/png;base64,${PNG.toString("base64")}` } }), r);
    assert.equal(r.statusCode, 200, JSON.stringify(r.body));
    const [m] = await bucket.file(path).getMetadata();
    assert.ok(!m.metadata?.firebaseStorageDownloadTokens);
    const registro = (await db.doc(`empresas/${empresaId}/fotosObras/${fotoId}`).get()).data();
    assert.equal(registro.fotoPath, path); assert.equal(registro.fotoUrl, undefined);
  });
  await check("download real com range preserva bytes e no-store", async () => {
    const r = res(); await tratarFoto(admin, req("GET", null, { empresaId, fotoId }), r);
    assert.equal(r.statusCode, 200, JSON.stringify(r.body)); assert.deepEqual(r.body, PNG); assert.ok(r.headers["Cache-Control"].includes("no-store"));
  });
  // Documento e token legados fictícios; o link não aponta para nenhuma produção.
  await bucket.file(legadoPath).save(PNG, { resumable: false, metadata: { contentType: "image/png", metadata: { firebaseStorageDownloadTokens: "token-apenas-emulador" } } });
  await db.doc(`empresas/${empresaId}/fotosObras/${legadoId}`).set({ id: legadoId, obraId: 7,
    fotoUrl: `https://firebasestorage.googleapis.com/v0/b/${BUCKET_FOTOS}/o/${encodeURIComponent(legadoPath)}?alt=media&token=token-apenas-emulador` });
  const linkLocal = `http://127.0.0.1:9299/v0/b/${bucket.name}/o/${encodeURIComponent(legadoPath)}?alt=media&token=token-apenas-emulador`;
  await check("token legado fictício era acessível antes da revogação", async () => assert.equal((await fetch(linkLocal)).status, 200));
  const b = res(); await tratarSeguranca(admin, req("POST", { empresaId, acao: "backup" }), b);
  assert.equal(b.statusCode, 200, JSON.stringify(b.body)); assert.equal(b.body.verificado, true);
  let ultimo;
  for (let i = 0; i < 30; i++) {
    ultimo = res(); await tratarSeguranca(admin, req("POST", { empresaId, acao: "migrar", backupId: b.body.backupId }), ultimo);
    assert.equal(ultimo.statusCode, 200, JSON.stringify(ultimo.body)); assert.equal(ultimo.body.ok, true, JSON.stringify(ultimo.body));
    if (ultimo.body.concluido) break;
  }
  await check("backup verificado e sete etapas concluem com marcador privado", async () => {
    assert.equal(ultimo.body.concluido, true); const e = (await db.doc(`empresas/${empresaId}/_seguranca/estado`).get()).data();
    assert.equal(e.status, "concluido"); assert.equal(e.versao, 1); assert.equal(e.trava, null);
  });
  await check("migração preserva cadastro e remove dados privados da projeção", async () => {
    assert.equal((await db.doc(`empresas/${empresaId}/trabalhadores/1`).get()).data().salario, 5000);
    const campo = (await db.doc(`empresas/${empresaId}/trabalhadoresCampo/1`).get()).data();
    assert.equal(campo.salario, undefined); assert.equal(campo.cpf, undefined); assert.equal(campo.obraId, 7);
    assert.equal((await db.doc(`empresas/${empresaId}/presencas/ponto-1`).get()).data().obraId, undefined);
    assert.equal(ultimo.body.estado.totais.presencas.semVinculo, 1);
    assert.deepEqual((await db.doc(`empresas/${empresaId}/avisos/folha-1`).get()).data().para, { tipo: "area", area: "equipe" });
  });
  await check("revogação real remove token e nega o link antigo anônimo", async () => {
    const [m] = await bucket.file(legadoPath).getMetadata(); assert.ok(!m.metadata?.firebaseStorageDownloadTokens);
    const statusAntigo = (await fetch(linkLocal)).status;
    assert.ok([401, 403].includes(statusAntigo), `Link antigo retornou ${statusAntigo}; esperado 401/403.`);
    const registro = (await db.doc(`empresas/${empresaId}/fotosObras/${legadoId}`).get()).data(); assert.equal(registro.fotoUrl, undefined); assert.equal(registro.fotoPath, legadoPath);
  });
  await check("foto legada permanece legível pela API após revogar URL", async () => {
    const r = res(); await tratarFoto(admin, req("GET", null, { empresaId, fotoId: legadoId }), r); assert.equal(r.statusCode, 200); assert.deepEqual(r.body, PNG);
  });
  await check("desativação de perfil impede nova leitura autenticada", async () => {
    await db.doc(`usuarios/${uid}`).update({ ativo: false });
    const r = res(); await tratarFoto(admin, req("GET", null, { empresaId, fotoId }), r); assert.equal(r.statusCode, 403);
  });
  console.log(JSON.stringify({ resultado: "aprovado", testes: passou, projeto: projectId, dados: "fictícios; APIs com Storage/Firestore locais" }));
} finally { await db.terminate(); await deleteApp(app); }
