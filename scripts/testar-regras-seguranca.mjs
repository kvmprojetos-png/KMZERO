#!/usr/bin/env node
// Somente emuladores locais, projeto demo, dados fictícios. Nunca usa o Firebase real.
// firebase emulators:exec --project demo-kmzero-security --config firebase.security-tests.json --only firestore,storage "node scripts/testar-regras-seguranca.mjs"
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, getDocs, collection, query, where, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { ref, uploadBytes, getBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { testarRbac } from "./testar-rbac-cenarios.mjs";

for (const [key, expected] of Object.entries({ FIRESTORE_EMULATOR_HOST: "127.0.0.1:8180", FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9299" })) {
  if (process.env[key] !== expected) throw new Error(`${key} precisa ser ${expected}. Nenhum acesso remoto permitido.`);
}
const rulesRoot = process.env.KM_SECURITY_RULES_DIR || process.cwd();
const env = await initializeTestEnvironment({
  projectId: "demo-kmzero-security",
  firestore: { host: "127.0.0.1", port: 8180, rules: await readFile(resolve(rulesRoot, "firestore.rules"), "utf8") },
  storage: { host: "127.0.0.1", port: 9299, rules: await readFile(resolve(rulesRoot, "storage.rules"), "utf8") },
});
let passed = 0;
let failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`OK ${name}`); }
  catch (e) { failed++; console.error(`FALHOU ${name}: ${e.message}`); }
}
const token = uid => ({ uid, token: `token-ficticio-${uid}`, nome: "Teste", aparelho: "teste", atualizadoEm: 1000 });
const aviso = (id, de, tipo = "gestores") => ({ id, de, deNome: "Teste", criadoEm: 1000, titulo: "Teste", texto: "Dados fictícios", tipo: "manual", para: { tipo } });
const ctx = uid => env.authenticatedContext(uid, { email: `${uid}@example.test`, email_verified: true });
const owner = ctx("gestor");
const campo = ctx("campo");
const externo = ctx("externo");
const desligado = ctx("desligado");
const anon = env.unauthenticatedContext();
const db = campo.firestore();
const path = (col, id) => `empresas/empresa-a/${col}/${id}`;
const target = (col, id) => doc(db, path(col, id));
try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async admin => {
    const ad = admin.firestore();
    await Promise.all([
      setDoc(doc(ad, "empresas/empresa-a"), { gestorUid: "gestor" }),
      setDoc(doc(ad, "empresas/empresa-b"), { gestorUid: "externo" }),
      ...[ ["gestor", "empresa-a", "gestor", true], ["campo", "empresa-a", "encarregado", true], ["externo", "empresa-b", "gestor", true], ["desligado", "empresa-a", "encarregado", false] ]
        .map(([uid, empresaId, perfil, ativo]) => setDoc(doc(ad, "usuarios", uid), { empresaId, perfil, ativo, obraId: 101, email: `${uid}@example.test` })),
      setDoc(doc(ad, path("pushTokens", "gestor-token")), token("gestor")),
      setDoc(doc(ad, path("avisos", "enviado")), { ...aviso("enviado", "campo"), push: { disparadoEm: 1000 } }),
      setDoc(doc(ad, path("avisosLeitura", "gestor")), { uid: "gestor", ultimaLeitura: 1000 }),
      setDoc(doc(ad, path("avisosEnviados", "pagamento-teste")), { enviadoEm: 1000 }),
      setDoc(doc(ad, path("obras", "obra1")), { nome: "Obra fictícia" }),
      setDoc(doc(ad, path("obrasCampo", "101")), { id: 101, nome: "Obra fictícia" }),
    ]);
  });
  await check("campo registra seu aparelho", () => assertSucceeds(setDoc(target("pushTokens", "campo-token"), token("campo"))));
  await check("campo renova seu aparelho", () => assertSucceeds(updateDoc(target("pushTokens", "campo-token"), { atualizadoEm: 2000 })));
  await check("campo lê seu token", () => assertSucceeds(getDoc(target("pushTokens", "campo-token"))));
  await check("campo não registra token como gestor", () => assertFails(setDoc(target("pushTokens", "forjado"), token("gestor"))));
  await check("campo não troca dono do token", () => assertFails(updateDoc(target("pushTokens", "campo-token"), { uid: "gestor" })));
  await check("campo não toma token do gestor", () => assertFails(setDoc(target("pushTokens", "gestor-token"), token("campo"))));
  await check("campo não lê token do gestor", () => assertFails(getDoc(target("pushTokens", "gestor-token"))));
  await check("gestor não lista tokens privados", () => assertFails(getDocs(collection(owner.firestore(), path("pushTokens", "").slice(0, -1)))));
  await check("campo não exclui token alheio", () => assertFails(deleteDoc(target("pushTokens", "gestor-token"))));
  await check("anônimo não registra token", () => assertFails(setDoc(doc(anon.firestore(), path("pushTokens", "anon")), token("anon"))));
  await check("outra empresa não registra token", () => assertFails(setDoc(doc(externo.firestore(), path("pushTokens", "externo")), token("externo"))));
  await check("desativado não registra token", () => assertFails(setDoc(doc(desligado.firestore(), path("pushTokens", "desligado")), token("desligado"))));
  await check("campo exclui seu aparelho", () => assertSucceeds(deleteDoc(target("pushTokens", "campo-token"))));

  await check("campo publica aviso para gestores", () => assertSucceeds(setDoc(target("avisos", "manual-campo"), aviso("manual-campo", "campo"))));
  await check("gestor publica aviso geral", () => assertSucceeds(setDoc(doc(owner.firestore(), path("avisos", "manual-gestor")), aviso("manual-gestor", "gestor", "todos"))));
  await check("campo publica teste do seu aparelho", () => assertSucceeds(setDoc(target("avisos", "teste"), { ...aviso("teste", "campo", "pessoa"), tipo: "teste", para: { tipo: "pessoa", uid: "campo" } })));
  await check("campo não falsifica autor", () => assertFails(setDoc(target("avisos", "forjado"), aviso("forjado", "gestor"))));
  await check("campo não anuncia para todos", () => assertFails(setDoc(target("avisos", "todos"), aviso("todos", "campo", "todos"))));
  await check("cliente não insere estado de push", () => assertFails(setDoc(target("avisos", "push-forjado"), { ...aviso("push-forjado", "campo"), push: { disparadoEm: 0 } })));
  await check("cliente não altera aviso publicado", () => assertFails(updateDoc(target("avisos", "manual-campo"), { texto: "Alterado" })));
  await check("cliente não apaga confirmação para reenviar push", () => assertFails(updateDoc(target("avisos", "enviado"), { push: {} })));
  await check("cliente não apaga aviso para recriar", () => assertFails(deleteDoc(target("avisos", "enviado"))));
  await check("cliente não limpa idempotência do cron", () => assertFails(deleteDoc(target("avisosEnviados", "pagamento-teste"))));
  await check("cliente não forja idempotência do cron", () => assertFails(setDoc(target("avisosEnviados", "forjado"), { enviadoEm: 1000 })));
  await check("consulta legítima de avisos próprios continua permitida", () => assertSucceeds(getDocs(query(collection(db, "empresas/empresa-a/avisos"), where("de", "==", "campo")))));
  await check("consulta ampla não lê avisos de outros destinatários", () => assertFails(getDocs(query(collection(db, "empresas/empresa-a/avisos"), where("criadoEm", ">=", 0)))));

  await check("campo marca seus avisos lidos", () => assertSucceeds(setDoc(target("avisosLeitura", "campo"), { uid: "campo", ultimaLeitura: 2000 })));
  await check("campo lê sua marca de leitura", () => assertSucceeds(getDoc(target("avisosLeitura", "campo"))));
  await check("campo não marca leitura alheia", () => assertFails(setDoc(target("avisosLeitura", "gestor"), { uid: "gestor", ultimaLeitura: 3000 })));
  await check("campo não lê marca alheia", () => assertFails(getDoc(target("avisosLeitura", "gestor"))));
  await check("campo lê o diretório mínimo de obras", () => assertSucceeds(getDoc(target("obrasCampo", "101"))));
  await check("campo não lê contrato completo da obra", () => assertFails(getDoc(target("obras", "obra1"))));
  await check("isolamento entre empresas permanece", () => assertFails(getDoc(doc(externo.firestore(), path("obras", "obra1")))));
  await check("campo não se promove a gestor", () => assertFails(updateDoc(doc(db, "usuarios/campo"), { perfil: "gestor" })));
  await check("dono não deixa dados órfãos apagando somente a empresa", () => assertFails(deleteDoc(doc(owner.firestore(), "empresas/empresa-a"))));
  await check("outro login não reivindica empresa com dados existentes", () => assertFails(setDoc(doc(externo.firestore(), "empresas/empresa-a"), { gestorUid: "externo" })));
  await check("negativa de exclusão preserva dados da empresa", () => assertSucceeds(getDoc(doc(owner.firestore(), path("obras", "obra1")))));
  await check("novo cadastro grava empresa e perfil no mesmo batch", async () => {
    const novo = ctx("novo-dono").firestore();
    const batch = writeBatch(novo);
    batch.set(doc(novo, "empresas/empresa-nova"), { gestorUid: "novo-dono" });
    batch.set(doc(novo, "usuarios/novo-dono"), { empresaId: "empresa-nova", perfil: "gestor", ativo: true, email: "novo-dono@example.test", acessos: null });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(doc(novo, "empresas/empresa-nova")));
  });
  await check("falha de perfil desfaz cadastro inteiro sem deixar parent órfão", async () => {
    const novo = ctx("cadastro-invalido").firestore();
    const batch = writeBatch(novo);
    batch.set(doc(novo, "empresas/empresa-invalida"), { gestorUid: "cadastro-invalido" });
    batch.set(doc(novo, "usuarios/cadastro-invalido"), { empresaId: "empresa-invalida", perfil: "gestor", ativo: true, email: "outra-pessoa@example.test" });
    await assertFails(batch.commit());
    await env.withSecurityRulesDisabled(async admin => {
      if ((await getDoc(doc(admin.firestore(), "empresas/empresa-invalida"))).exists()) throw new Error("O batch deixou uma empresa sem perfil.");
    });
  });

  // Compatibilidade com o app já publicado e perfis/convites anteriores ao campo acessos.
  await env.withSecurityRulesDisabled(async admin => {
    const ad = admin.firestore();
    await Promise.all([
      setDoc(doc(ad, "empresas/empresa-legada"), { gestorUid: "dono-legado" }),
      setDoc(doc(ad, "usuarios/dono-legado"), { empresaId: "empresa-legada", perfil: "gestor", nome: "Dono legado" }),
      setDoc(doc(ad, "usuarios/campo-legado"), { empresaId: "empresa-legada", perfil: "encarregado", nome: "Campo legado" }),
      setDoc(doc(ad, "usuarios/restrito"), { empresaId: "empresa-a", perfil: "gestor", ativo: true, email: "restrito@example.test", acessos: ["visao", "equipe"] }),
      setDoc(doc(ad, "usuarios/admin-sistema"), { empresaId: "empresa-a", perfil: "gestor", ativo: true, email: "admin-sistema@example.test", acessos: ["visao", "sistema"] }),
      setDoc(doc(ad, "convites/convidado-legado@example.test"), { empresaId: "empresa-legada", perfil: "encarregado", email: "convidado-legado@example.test" }),
      setDoc(doc(ad, "convites/convidado-restrito@example.test"), { empresaId: "empresa-a", perfil: "gestor", email: "convidado-restrito@example.test", acessos: ["visao", "equipe"], ativo: true }),
      setDoc(doc(ad, "convites/convite-desligado@example.test"), { empresaId: "empresa-a", perfil: "encarregado", email: "convite-desligado@example.test", ativo: false }),
      setDoc(doc(ad, "convites/email-nao-verificado@example.test"), { empresaId: "empresa-a", perfil: "encarregado", email: "email-nao-verificado@example.test" }),
    ]);
  });
  await check("cadastro sequencial do app atual continua permitido", async () => {
    const antigo = ctx("dono-sequencial").firestore();
    await assertSucceeds(setDoc(doc(antigo, "empresas/empresa-sequencial"), { gestorUid: "dono-sequencial", criadoEm: 1000 }));
    await assertSucceeds(setDoc(doc(antigo, "usuarios/dono-sequencial"), { empresaId: "empresa-sequencial", perfil: "gestor", ativo: true, email: "dono-sequencial@example.test", acessos: null }));
    await assertSucceeds(getDoc(doc(antigo, "empresas/empresa-sequencial")));
  });
  await check("perfil legado sem email/acessos segue acessível no login", () => assertSucceeds(getDoc(doc(ctx("campo-legado").firestore(), "usuarios/campo-legado"))));
  await check("perfil legado pode atualizar dados simples por merge", () => assertSucceeds(setDoc(doc(ctx("campo-legado").firestore(), "usuarios/campo-legado"), { nome: "Nome atualizado" }, { merge: true })));
  await check("gestor legado sem acessos conserva administração", () => assertSucceeds(setDoc(doc(ctx("dono-legado").firestore(), "convites/novo-legado@example.test"), { empresaId: "empresa-legada", email: "novo-legado@example.test", perfil: "encarregado", acessos: null, ativo: true })));
  await check("convite legado sem ativo/acessos continua aceito", () => assertSucceeds(setDoc(doc(ctx("convidado-legado").firestore(), "usuarios/convidado-legado"), { empresaId: "empresa-legada", perfil: "encarregado", email: "convidado-legado@example.test", ativo: true, acessos: null })));
  await check("convite restrito copia áreas exatamente", () => assertSucceeds(setDoc(doc(ctx("convidado-restrito").firestore(), "usuarios/convidado-restrito"), { empresaId: "empresa-a", perfil: "gestor", email: "convidado-restrito@example.test", ativo: true, acessos: ["visao", "equipe"] })));
  await check("gestor restrito não muda suas próprias áreas", () => assertFails(updateDoc(doc(ctx("restrito").firestore(), "usuarios/restrito"), { acessos: null })));
  await check("gestor restrito não cria convite administrativo", () => assertFails(setDoc(doc(ctx("restrito").firestore(), "convites/sem-permissao@example.test"), { empresaId: "empresa-a", email: "sem-permissao@example.test", perfil: "gestor", acessos: null })));
  await check("gestor com Sistema pode convidar", () => assertSucceeds(setDoc(doc(ctx("admin-sistema").firestore(), "convites/admin-convidado@example.test"), { empresaId: "empresa-a", email: "admin-convidado@example.test", perfil: "gestor", acessos: ["visao", "equipe"] })));
  await check("administrador não limita nem desativa o dono", () => assertFails(updateDoc(doc(ctx("admin-sistema").firestore(), "usuarios/gestor"), { ativo: false, acessos: ["visao"] })));
  await check("perfil desativado não se apaga para recuperar convite", () => assertFails(deleteDoc(doc(desligado.firestore(), "usuarios/desligado"))));
  await check("convite desativado não cria novo perfil", () => assertFails(setDoc(doc(ctx("convite-desligado").firestore(), "usuarios/convite-desligado"), { empresaId: "empresa-a", perfil: "encarregado", email: "convite-desligado@example.test", ativo: true, acessos: null })));
  await check("convite exige email verificado", () => assertFails(setDoc(doc(env.authenticatedContext("email-nao-verificado", { email: "email-nao-verificado@example.test", email_verified: false }).firestore(), "usuarios/email-nao-verificado"), { empresaId: "empresa-a", perfil: "encarregado", email: "email-nao-verificado@example.test", ativo: true, acessos: null })));
  await check("gestor restrito ainda pode desligar campo pela tela Equipe", () => assertSucceeds(updateDoc(doc(ctx("restrito").firestore(), "usuarios/campo"), { ativo: false })));
  await env.withSecurityRulesDisabled(async admin => { await updateDoc(doc(admin.firestore(), "usuarios/campo"), { ativo: true }); });

  const object = "empresas/empresa-a/fotosObras/foto.jpg";
  const bytes = new Uint8Array([255, 216, 255, 217]);
  await env.withSecurityRulesDisabled(async admin => { await uploadBytes(ref(admin.storage(), object), bytes, { contentType: "image/jpeg" }); });
  await check("campo não cria JPEG direto nem download token", () => assertFails(uploadBytes(ref(campo.storage(), object), bytes, { contentType: "image/jpeg" })));
  await check("campo não cria PNG direto nem download token", () => assertFails(uploadBytes(ref(campo.storage(), object + ".png"), bytes, { contentType: "image/png" })));
  await check("campo usa API privada, SDK direto não baixa foto", () => assertFails(getBytes(ref(campo.storage(), object))));
  await check("SVG ativo não pode ser enviado", () => assertFails(uploadBytes(ref(campo.storage(), object + ".svg"), bytes, { contentType: "image/svg+xml" })));
  await check("HTML não pode ser enviado", () => assertFails(uploadBytes(ref(campo.storage(), object + ".html"), bytes, { contentType: "text/html" })));
  await check("caminho arbitrário não recebe upload", () => assertFails(uploadBytes(ref(campo.storage(), "empresas/empresa-a/outros/foto.jpg"), bytes, { contentType: "image/jpeg" })));
  await check("arquivo acima do limite é negado", () => assertFails(uploadBytes(ref(campo.storage(), object + ".grande"), new Uint8Array(10 * 1024 * 1024), { contentType: "image/jpeg" })));
  await check("outra empresa não baixa foto", () => assertFails(getBytes(ref(externo.storage(), object))));
  await check("anônimo não baixa foto pela API autenticada", () => assertFails(getBytes(ref(anon.storage(), object))));
  await check("campo desativado não baixa foto pela API autenticada", () => assertFails(getBytes(ref(desligado.storage(), object))));
  await check("campo não exclui foto", () => assertFails(deleteObject(ref(campo.storage(), object))));
  await check("gestor também usa API privada e não exclui direto", () => assertFails(deleteObject(ref(owner.storage(), object))));
  await check("gestor não recebe URL portadora por getDownloadURL", () => assertFails(getDownloadURL(ref(owner.storage(), object))));
  await testarRbac(env, check);
} finally {
  await env.cleanup();
}
console.log(`${passed}/${passed + failed} verificações passaram. Apenas emuladores locais; regras em produção não verificadas.`);
process.exitCode = failed ? 1 : 0;
