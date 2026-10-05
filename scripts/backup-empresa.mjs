#!/usr/bin/env node
// Default: somente leitura/dry-run. Nunca mostra conteúdo do backup no terminal.
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { firebaseAdmin } from "../api/_lib/firebaseAdmin.js";
import { capturarSnapshotEmpresa, criarBackupEmpresa, carregarBackupEmpresa, restaurarSnapshotEmpresa } from "../api/_lib/backupEmpresa.js";

const args = process.argv.slice(2);
const modo = args[0];
const valor = chave => { const i = args.indexOf(chave); return i < 0 ? null : args[i + 1]; };
const empresaId = valor("--empresa");
const uid = valor("--uid");
const aplicar = args.includes("--aplicar");
const projectId = process.env.GCLOUD_PROJECT || "";
const emulador = projectId.startsWith("demo-") && /^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || "");
if (!["criar", "verificar", "restaurar"].includes(modo) || !empresaId) {
  console.error("Uso: node scripts/backup-empresa.mjs criar|verificar|restaurar --empresa ID --uid UID [--bucket NOME] [--backup-id ID|--arquivo snapshot.json.gz] [--aplicar]");
  process.exitCode = 2;
} else {
  try {
    // Evita que uma variável de emulador malformada redirecione as operações.
    if (process.env.FIRESTORE_EMULATOR_HOST && !emulador) throw new Error("Emulador exige projeto demo-* e host local 127.0.0.1.");
    if (emulador && nomeHostStorageInvalido()) throw new Error("Storage do ensaio precisa apontar somente ao emulador local.");
    const app = emulador ? initializeApp({ projectId, storageBucket: valor("--bucket") || `${projectId}.appspot.com` }) : null;
    const db = emulador ? getFirestore(app) : firebaseAdmin().db;
    const nomeBucket = valor("--bucket");
    if (!nomeBucket && modo !== "restaurar") throw new Error("Informe --bucket com o nome exato do bucket da empresa.");
    const bucket = nomeBucket ? getStorage(app || undefined).bucket(nomeBucket) : null;
    if (modo === "criar") {
      if (!uid || !bucket) throw new Error("Criar backup exige --uid e --bucket.");
      const resultado = aplicar
        ? await criarBackupEmpresa({ db, bucket, empresaId, uid })
        : await capturarSnapshotEmpresa({ db, bucket, empresaId, uid }).then(s => ({ dryRun: true, empresaId, documentos: s.documentos.length, fotosMetadata: s.fotos.length, escopo: s.escopo }));
      console.log(JSON.stringify(resultado, null, 2));
    } else if (modo === "verificar") {
      const { manifesto } = await carregarBackupEmpresa({ db, bucket, empresaId, uid, backupId: valor("--backup-id") });
      console.log(JSON.stringify(manifesto, null, 2));
    } else {
      // Restauração real requer procedimento próprio/revisão da versão atual.
      // Este comando só aplica em emulador para ensaiar a recuperação sem risco.
      if (aplicar && !emulador) throw new Error("Restauração aplicada é permitida aqui somente no emulador demo local. Em produção este comando é apenas dry-run.");
      let snapshot;
      const arquivo = valor("--arquivo");
      if (arquivo) {
        const bytes = await readFile(arquivo);
        snapshot = JSON.parse(arquivo.endsWith(".gz") ? gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 }) : bytes.toString("utf8"));
      } else {
        ({ snapshot } = await carregarBackupEmpresa({ db, bucket, empresaId, uid, backupId: valor("--backup-id") }));
      }
      console.log(JSON.stringify(await restaurarSnapshotEmpresa({ db, snapshot, empresaId, aplicar }), null, 2));
    }
    await db.terminate();
  } catch (erro) {
    console.error(erro.message || "Falha no procedimento de backup.");
    process.exitCode = 1;
  }
}

function nomeHostStorageInvalido() {
  const fb = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const gcs = process.env.STORAGE_EMULATOR_HOST;
  return (!fb && !gcs) || (fb && !/^127\.0\.0\.1:\d+$/.test(fb)) || (gcs && !/^http:\/\/127\.0\.0\.1:\d+$/.test(gcs));
}
