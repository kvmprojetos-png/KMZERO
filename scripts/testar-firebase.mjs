#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
   Teste ponta a ponta do Firebase do KMZERO (Auth + Firestore + Storage)

   Cria contas TEMPORÁRIAS (gestor, lançador, uma pessoa convidada e um intruso
   de outra empresa), simula o cadastro da empresa, o convite por e-mail, o
   perfil do lançador, a leitura dos dados e confere que o intruso NÃO enxerga
   nada. No final apaga tudo e avisa se algo não pôde ser apagado.

   O app entra só com Google; este script usa contas e-mail/senha criadas pela
   API só para testar as REGRAS. Por isso o provedor "E-mail/senha" precisa
   continuar ativado no Firebase (o app não o oferece na tela).

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
const objStorage = nome => `${ST}?uploadType=media&name=${encodeURIComponent(nome)}`;
const urlStorage = nome => `${ST}/${encodeURIComponent(nome)}`;

(async () => {
  console.log(`\n🧪 KMZERO — teste do Firebase (${PROJETO})  marca ${marca}\n`);

  const senha = `Teste-${marca}!`;
  const eid = `empresa-teste-${marca}`;
  const eidIntruso = `empresa-intruso-${marca}`;
  const foto = `empresas/${eid}/fotosObras/teste.jpg`;
  const contas = {};          // criadas dentro do try, apagadas no finally mesmo em falha parcial
  const limpeza = [];         // [descricao, fn] executados no finally, com status conferido

  try {
    contas.gestor = await criarConta(`teste-gestor-${marca}@example.com`, senha);
    contas.lancador = await criarConta(`teste-lancador-${marca}@example.com`, senha);
    contas.intruso = await criarConta(`teste-intruso-${marca}@example.com`, senha);
    const emailConvidado = `teste-convidado-${marca}@example.com`;
    contas.convidado = await criarConta(emailConvidado, senha);
    const { gestor, lancador, intruso, convidado } = contas;

    // 1. Cadastro do gestor (mesma ordem do app: empresa → perfil)
    let r = await gravar(gestor.token, `empresas/${eid}`, { razaoSocial: "Empresa Teste KMZERO", gestorUid: gestor.uid, criadoEm: marca });
    registrar("Gestor cria a própria empresa", 200, r.status);
    limpeza.push(["empresa de teste", () => apagar(gestor.token, `empresas/${eid}`)]);
    r = await gravar(gestor.token, `usuarios/${gestor.uid}`, { empresaId: eid, nome: "Gestor Teste", perfil: "gestor", ativo: true });
    registrar("Gestor grava o próprio perfil (usuarios/{uid})", 200, r.status, r.status === 403 ? "← REGRAS AINDA NÃO PUBLICADAS" : "");
    r = await ler(gestor.token, `usuarios/${gestor.uid}`);
    registrar("Gestor lê o próprio perfil (login)", 200, r.status);

    // 2. Dados da empresa
    r = await gravar(gestor.token, `empresas/${eid}/obras/1`, { id: 1, nome: "Obra Teste" });
    registrar("Gestor grava uma obra", 200, r.status);
    limpeza.push(["obra de teste", () => apagar(gestor.token, `empresas/${eid}/obras/1`)]);
    r = await ler(gestor.token, `empresas/${eid}/obras/1`);
    registrar("Gestor lê a obra", 200, r.status);

    // 3. Gestor cria o acesso do lançador (perfil na nuvem)
    r = await gravar(gestor.token, `usuarios/${lancador.uid}`, { empresaId: eid, nome: "Lançador Teste", perfil: "encarregado", obraId: 1, ativo: true });
    registrar("Gestor cria o perfil do lançador", 200, r.status);
    r = await gravar(gestor.token, `convites/${emailConvidado}`, { email: emailConvidado, empresaId: eid, nome: "Convidado Teste", perfil: "encarregado", obraId: 1, criadoEm: marca });
    registrar("Gestor registra um convite (Gmail da pessoa)", 200, r.status);
    limpeza.push(["convite de teste", () => apagar(gestor.token, `convites/${emailConvidado}`)]);
    r = await gravar(gestor.token, `convites/teste-fora-${marca}@example.com`, { email: `teste-fora-${marca}@example.com`, empresaId: eidIntruso, nome: "X", perfil: "encarregado" });
    registrar("Gestor NÃO convida para outra empresa", 403, r.status);
    r = await http("POST", `${FS}:runQuery`, { token: gestor.token, corpo: { structuredQuery: { from: [{ collectionId: "usuarios" }], where: { fieldFilter: { field: { fieldPath: "empresaId" }, op: "EQUAL", value: { stringValue: eid } } } } } });
    registrar("Gestor lista a equipe da própria empresa", 200, r.status);
    r = await http("POST", `${FS}:runQuery`, { token: gestor.token, corpo: { structuredQuery: { from: [{ collectionId: "usuarios" }] } } });
    registrar("Gestor NÃO lista usuários sem filtrar pela empresa", 403, r.status);

    // 4. Lançador em outro aparelho: lê o próprio perfil e os dados da empresa
    r = await ler(lancador.token, `usuarios/${lancador.uid}`);
    registrar("Lançador lê o próprio perfil (primeiro acesso)", 200, r.status);
    r = await ler(lancador.token, `empresas/${eid}/obras/1`);
    registrar("Lançador lê a obra da empresa", 200, r.status);
    r = await gravar(lancador.token, `empresas/${eid}/presencas/2026-01-01_1`, { data: "2026-01-01", trabId: 1, status: "P" });
    registrar("Lançador grava presença", 200, r.status);
    limpeza.push(["presença de teste", () => apagar(gestor.token, `empresas/${eid}/presencas/2026-01-01_1`)]);
    r = await ler(lancador.token, `convites/${emailConvidado}`);
    registrar("Lançador NÃO lê convite de outra pessoa", 403, r.status);
    r = await gravar(lancador.token, `convites/teste-hacker-${marca}@example.com`, { email: `teste-hacker-${marca}@example.com`, empresaId: eid, nome: "X", perfil: "gestor" });
    registrar("Lançador NÃO cria convites (só gestor)", 403, r.status);

    // 4b. Pessoa convidada entra pela 1ª vez: lê o próprio convite; o perfil só nasce com e-mail VERIFICADO (conta Google)
    r = await ler(convidado.token, `convites/${emailConvidado}`);
    registrar("Convidado lê o convite do próprio e-mail", 200, r.status);
    r = await gravar(convidado.token, `usuarios/${convidado.uid}`, { empresaId: eid, email: emailConvidado, nome: "Convidado Teste", perfil: "encarregado", obraId: 1, ativo: true });
    registrar("Convidado com e-mail NÃO verificado não cria perfil (só conta Google)", 403, r.status);
    r = await gravar(convidado.token, `usuarios/${convidado.uid}`, { empresaId: eidIntruso, email: emailConvidado, nome: "Convidado Teste", perfil: "encarregado", ativo: true });
    registrar("Convidado NÃO entra em empresa diferente da do convite", 403, r.status);
    r = await gravar(lancador.token, `usuarios/${lancador.uid}`, { empresaId: eid, nome: "Hacker", perfil: "gestor", ativo: true });
    registrar("Lançador NÃO consegue se promover a gestor", 403, r.status);

    // 5. Intruso (conta de outra empresa) não enxerga nada
    await gravar(intruso.token, `empresas/${eidIntruso}`, { razaoSocial: "Intruso", gestorUid: intruso.uid });
    limpeza.push(["empresa do intruso", () => apagar(intruso.token, `empresas/${eidIntruso}`)]);
    await gravar(intruso.token, `usuarios/${intruso.uid}`, { empresaId: eidIntruso, nome: "Intruso", perfil: "gestor", ativo: true });
    r = await ler(intruso.token, `empresas/${eid}/obras/1`);
    registrar("Intruso NÃO lê obra de outra empresa", 403, r.status);
    r = await gravar(intruso.token, `empresas/${eid}/obras/99`, { id: 99, nome: "Invasão" });
    registrar("Intruso NÃO grava em outra empresa", 403, r.status);
    r = await gravar(intruso.token, `usuarios/${intruso.uid}`, { empresaId: eid, nome: "Intruso", perfil: "gestor", ativo: true });
    registrar("Intruso NÃO troca seu perfil para outra empresa", 403, r.status);
    r = await ler(intruso.token, `usuarios/${gestor.uid}`);
    registrar("Intruso NÃO lê perfil de outra empresa", 403, r.status);

    // 6. Storage (foto de obra) — isolamento igual ao do Firestore
    r = await http("POST", objStorage(foto), { token: lancador.token, corpo: "fake-jpeg-bytes", tipo: "image/jpeg" });
    registrar("Lançador envia foto para o Storage", 200, r.status, r.status === 403 ? "← regras do Storage não publicadas OU conta de serviço cross-service não liberada" : "");
    if (r.status === 200) limpeza.push(["foto de teste no Storage", () => http("DELETE", urlStorage(foto), { token: gestor.token })]);
    r = await http("GET", urlStorage(foto), { token: lancador.token });
    registrar("Lançador lê a própria foto", 200, r.status);
    r = await http("GET", urlStorage(foto), { token: intruso.token });
    registrar("Intruso NÃO lê foto de outra empresa", 403, r.status);
    r = await http("POST", objStorage(`empresas/${eid}/fotosObras/invasao.jpg`), { token: intruso.token, corpo: "x", tipo: "image/jpeg" });
    registrar("Intruso NÃO envia foto para outra empresa", 403, r.status);
    r = await http("POST", objStorage(`empresas/${eid}/fotosObras/arquivo.exe`), { token: lancador.token, corpo: "MZ", tipo: "application/octet-stream" });
    registrar("Storage recusa arquivo que não é imagem", 403, r.status);
    r = await http("DELETE", urlStorage(foto), { token: lancador.token });
    registrar("Lançador NÃO apaga foto (só gestor)", 403, r.status);

    // 7. Gestor desativa o lançador → perde acesso no Firestore e no Storage
    r = await gravar(gestor.token, `usuarios/${lancador.uid}`, { empresaId: eid, nome: "Lançador Teste", perfil: "encarregado", obraId: 1, ativo: false });
    registrar("Gestor desativa o lançador", 200, r.status);
    r = await ler(lancador.token, `empresas/${eid}/obras/1`);
    registrar("Lançador desativado NÃO lê mais a empresa", 403, r.status);
    r = await http("POST", objStorage(`empresas/${eid}/fotosObras/depois.jpg`), { token: lancador.token, corpo: "x", tipo: "image/jpeg" });
    registrar("Lançador desativado NÃO envia mais fotos", 403, r.status);
    r = await http("GET", urlStorage(foto), { token: lancador.token });
    registrar("Lançador desativado NÃO baixa mais fotos", 403, r.status);
  } catch (e) {
    console.error("💥 Erro inesperado:", e);
    falhas++;
  } finally {
    console.log("\n🧹 Limpando dados de teste...");
    const pendentes = [];
    for (const [desc, fn] of limpeza.reverse()) {
      try {
        const r = await fn();
        if (![200, 204].includes(r.status)) pendentes.push(`${desc} (HTTP ${r.status})`);
      } catch (e) { pendentes.push(`${desc} (${e.message})`); }
    }
    // Perfis por último (as regras dependem deles); o próprio usuário pode apagar o seu
    if (contas.gestor && contas.lancador) { const r = await apagar(contas.gestor.token, `usuarios/${contas.lancador.uid}`); if (![200].includes(r.status)) pendentes.push(`perfil do lançador (HTTP ${r.status})`); }
    if (contas.gestor) { const r = await apagar(contas.gestor.token, `usuarios/${contas.gestor.uid}`); if (![200].includes(r.status)) pendentes.push(`perfil do gestor (HTTP ${r.status})`); }
    if (contas.intruso) { const r = await apagar(contas.intruso.token, `usuarios/${contas.intruso.uid}`); if (![200].includes(r.status)) pendentes.push(`perfil do intruso (HTTP ${r.status})`); }
    for (const nome of ["gestor", "lancador", "intruso", "convidado"]) {
      if (contas[nome]) { const r = await apagarConta(contas[nome].token); if (r.status !== 200) pendentes.push(`conta ${nome} (HTTP ${r.status})`); }
    }
    if (pendentes.length) {
      console.log("   ⚠️ Não foi possível apagar:\n   - " + pendentes.join("\n   - "));
      console.log(`   (procure por "${marca}" no console do Firebase para limpar à mão)`);
    } else {
      console.log("   contas e documentos temporários apagados.");
    }
  }

  const total = resultados.length;
  console.log(`\n${falhas === 0 ? "🎉" : "⚠️"} ${total - falhas}/${total} verificações OK${falhas ? ` — ${falhas} falharam` : ""}.`);
  if (falhas && resultados.some(x => !x.ok && x.detalhe.includes("REGRAS"))) {
    console.log("\n👉 Publique as regras:  npm run firebase:login   e depois   npm run firebase:deploy-regras\n");
  }
  process.exit(falhas ? 1 : 0);
})();
