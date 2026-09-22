#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
   Teste ponta a ponta do Firebase do KMZERO (Auth + Firestore + Storage)

   Cria contas TEMPORÁRIAS (gestor, lançador e um intruso de outra empresa),
   simula o cadastro da empresa, a criação do acesso do lançador, a leitura dos
   dados e confere que o intruso NÃO enxerga nada. No final apaga tudo.

   Uso:   npm run firebase:testar
   Sai com código 1 se alguma verificação falhar.
   ───────────────────────────────────────────────────────────────────────────── */

const KEY = "AIzaSyDzyxMJHHktgj8NLg4Rg_FaYv6KevBhtkE";
const PROJETO = "kmzero-aca24";
const BUCKET = `${PROJETO}.firebasestorage.app`;
const FS = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents`;
const ST = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o`;

const marca = Date.now();
const resultados = [];
let falhas = 0;

function registrar(nome, esperado, obtido, detalhe = "") {
  const ok = esperado === obtido;
  if (!ok) falhas++;
  resultados.push({ ok, nome, esperado, obtido, detalhe });
  console.log(`${ok ? "✅" : "❌"} ${nome}  (esperado ${esperado}, obteve ${obtido})${detalhe ? "  " + detalhe : ""}`);
}

async function http(metodo, url, { token, corpo, tipo = "application/json" } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (corpo !== undefined) headers["Content-Type"] = tipo;
  const r = await fetch(url, { method: metodo, headers, body: corpo === undefined ? undefined : (typeof corpo === "string" ? corpo : JSON.stringify(corpo)) });
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, json };
}

// ── Firebase Auth (REST) ──
async function criarConta(email, senha) {
  const r = await http("POST", `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { corpo: { email, password: senha, returnSecureToken: true } });
  if (r.status !== 200) throw new Error(`signUp ${email}: ${r.status} ${JSON.stringify(r.json)}`);
  return { uid: r.json.localId, token: r.json.idToken };
}
async function apagarConta(token) {
  return http("POST", `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${KEY}`, { corpo: { idToken: token } });
}

// ── Firestore (REST) — helpers de campos ──
const campos = obj => ({ fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === "number" ? { integerValue: String(v) } : typeof v === "boolean" ? { booleanValue: v } : v === null ? { nullValue: null } : { stringValue: String(v) }])) });
const gravar = (token, caminho, obj) => http("PATCH", `${FS}/${caminho}`, { token, corpo: campos(obj) });
const ler = (token, caminho) => http("GET", `${FS}/${caminho}`, { token });
const apagar = (token, caminho) => http("DELETE", `${FS}/${caminho}`, { token });

(async () => {
  console.log(`\n🧪 KMZERO — teste do Firebase (${PROJETO})  marca ${marca}\n`);

  const senha = `Teste-${marca}!`;
  const gestor = await criarConta(`teste-gestor-${marca}@example.com`, senha);
  const lancador = await criarConta(`teste-lancador-${marca}@example.com`, senha);
  const intruso = await criarConta(`teste-intruso-${marca}@example.com`, senha);
  const eid = `empresa-teste-${marca}`;
  const eidIntruso = `empresa-intruso-${marca}`;
  let uploadOk = false;

  try {
    // 1. Cadastro do gestor (mesma ordem do app: empresa → perfil)
    let r = await gravar(gestor.token, `empresas/${eid}`, { razaoSocial: "Empresa Teste KMZERO", gestorUid: gestor.uid, criadoEm: marca });
    registrar("Gestor cria a própria empresa", 200, r.status);
    r = await gravar(gestor.token, `usuarios/${gestor.uid}`, { empresaId: eid, nome: "Gestor Teste", perfil: "gestor", ativo: true });
    registrar("Gestor grava o próprio perfil (usuarios/{uid})", 200, r.status, r.status === 403 ? "← REGRAS AINDA NÃO PUBLICADAS" : "");
    r = await ler(gestor.token, `usuarios/${gestor.uid}`);
    registrar("Gestor lê o próprio perfil (login)", 200, r.status);

    // 2. Dados da empresa
    r = await gravar(gestor.token, `empresas/${eid}/obras/1`, { id: 1, nome: "Obra Teste" });
    registrar("Gestor grava uma obra", 200, r.status);
    r = await ler(gestor.token, `empresas/${eid}/obras/1`);
    registrar("Gestor lê a obra", 200, r.status);

    // 3. Gestor cria o acesso do lançador (perfil na nuvem)
    r = await gravar(gestor.token, `usuarios/${lancador.uid}`, { empresaId: eid, nome: "Lançador Teste", perfil: "encarregado", obraId: 1, ativo: true });
    registrar("Gestor cria o perfil do lançador", 200, r.status);
    r = await gravar(gestor.token, `empresas/${eid}/acessos/1`, { id: 1, nome: "Lançador Teste", perfil: "encarregado" });
    registrar("Gestor grava a lista de acessos", 200, r.status);

    // 4. Lançador em outro aparelho: lê o próprio perfil e os dados da empresa
    r = await ler(lancador.token, `usuarios/${lancador.uid}`);
    registrar("Lançador lê o próprio perfil (primeiro acesso)", 200, r.status);
    r = await ler(lancador.token, `empresas/${eid}/obras/1`);
    registrar("Lançador lê a obra da empresa", 200, r.status);
    r = await gravar(lancador.token, `empresas/${eid}/presencas/2026-01-01_1`, { data: "2026-01-01", trabId: 1, status: "P" });
    registrar("Lançador grava presença", 200, r.status);
    r = await ler(lancador.token, `empresas/${eid}/acessos/1`);
    registrar("Lançador NÃO lê a lista de acessos (só gestor)", 403, r.status);
    r = await gravar(lancador.token, `usuarios/${lancador.uid}`, { empresaId: eid, nome: "Hacker", perfil: "gestor", ativo: true });
    registrar("Lançador NÃO consegue se promover a gestor", 403, r.status);

    // 5. Intruso (conta de outra empresa) não enxerga nada
    await gravar(intruso.token, `empresas/${eidIntruso}`, { razaoSocial: "Intruso", gestorUid: intruso.uid });
    await gravar(intruso.token, `usuarios/${intruso.uid}`, { empresaId: eidIntruso, nome: "Intruso", perfil: "gestor", ativo: true });
    r = await ler(intruso.token, `empresas/${eid}/obras/1`);
    registrar("Intruso NÃO lê obra de outra empresa", 403, r.status);
    r = await gravar(intruso.token, `empresas/${eid}/obras/99`, { id: 99, nome: "Invasão" });
    registrar("Intruso NÃO grava em outra empresa", 403, r.status);
    r = await gravar(intruso.token, `usuarios/${intruso.uid}`, { empresaId: eid, nome: "Intruso", perfil: "gestor", ativo: true });
    registrar("Intruso NÃO troca seu perfil para outra empresa", 403, r.status);
    r = await ler(intruso.token, `usuarios/${gestor.uid}`);
    registrar("Intruso NÃO lê perfil de outra empresa", 403, r.status);

    // 6. Storage (foto de obra)
    r = await http("POST", `${ST}?uploadType=media&name=${encodeURIComponent(`empresas/${eid}/fotosObras/teste.jpg`)}`, { token: lancador.token, corpo: "fake-jpeg-bytes", tipo: "image/jpeg" });
    registrar("Lançador envia foto para o Storage", 200, r.status);
    uploadOk = r.status === 200;
    r = await http("POST", `${ST}?uploadType=media&name=${encodeURIComponent(`empresas/${eid}/fotosObras/arquivo.exe`)}`, { token: lancador.token, corpo: "MZ", tipo: "application/octet-stream" });
    registrar("Storage recusa arquivo que não é imagem", 403, r.status);

    // 7. Gestor desativa o lançador → perde acesso
    r = await gravar(gestor.token, `usuarios/${lancador.uid}`, { empresaId: eid, nome: "Lançador Teste", perfil: "encarregado", obraId: 1, ativo: false });
    registrar("Gestor desativa o lançador", 200, r.status);
    r = await ler(lancador.token, `empresas/${eid}/obras/1`);
    registrar("Lançador desativado NÃO lê mais a empresa", 403, r.status);
  } catch (e) {
    console.error("💥 Erro inesperado:", e);
    falhas++;
  } finally {
    console.log("\n🧹 Limpando dados de teste...");
    if (uploadOk) await http("DELETE", `${ST}/${encodeURIComponent(`empresas/${eid}/fotosObras/teste.jpg`)}`, { token: lancador.token });
    await apagar(lancador.token, `empresas/${eid}/presencas/2026-01-01_1`);
    await apagar(gestor.token, `empresas/${eid}/obras/1`);
    await apagar(gestor.token, `empresas/${eid}/acessos/1`);
    await apagar(gestor.token, `usuarios/${lancador.uid}`);
    await apagar(gestor.token, `empresas/${eid}`);
    await apagar(gestor.token, `usuarios/${gestor.uid}`);
    await apagar(intruso.token, `empresas/${eidIntruso}`);
    await apagar(intruso.token, `usuarios/${intruso.uid}`);
    await apagarConta(gestor.token);
    await apagarConta(lancador.token);
    await apagarConta(intruso.token);
    console.log("   contas e documentos temporários apagados.");
  }

  const total = resultados.length;
  console.log(`\n${falhas === 0 ? "🎉" : "⚠️"} ${total - falhas}/${total} verificações OK${falhas ? ` — ${falhas} falharam` : ""}.`);
  if (falhas && resultados.some(x => !x.ok && x.detalhe.includes("REGRAS"))) {
    console.log("\n👉 Publique as regras:  npm run firebase:login   e depois   npm run firebase:deploy-regras\n");
  }
  process.exit(falhas ? 1 : 0);
})();
