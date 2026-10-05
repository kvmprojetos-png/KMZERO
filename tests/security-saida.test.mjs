import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  prepararSaida, executarSaida, concluirLimpezaPendente, lerLimpezaPendente,
  marcarDonoCacheLocal, donoCacheLocal, CHAVE_LIMPEZA_PENDENTE,
  higienizarCachePermissoes,
  prepararRecuperacaoDono, concluirRecuperacaoDono,
} from "../src/lib/saidaSegura.js";

function contexto() {
  const dom = new JSDOM("", { url: "https://exemplo.invalid" });
  const storage = dom.window.localStorage;
  storage.setItem("empresaA_obras", JSON.stringify([{ id: "obra1", nome: "Obra teste" }]));
  storage.setItem("empresaA_rdos", JSON.stringify([{ id: "rdo1", fotos: ["data:image/png;base64,AAAA"] }]));
  storage.setItem("empresaA_usuarioLogado", JSON.stringify({ firebaseUid: "pessoaA" }));
  storage.setItem("empresaB_obras", "[1]");
  storage.setItem("kmzero_tema", "escuro");
  storage.setItem("_kmzero_empresaId", "empresaA");
  storage.setItem("_kmzero_sessao", "1");
  marcarDonoCacheLocal("empresaA", "pessoaA", storage);
  const chamadas = [];
  let atual = { uid: "pessoaA" };
  const anexos = [{ id: "anexo1", obraId: "obra1", nomeOriginal: "planta.pdf", conteudoBase64: "data:application/pdf;base64,AAAA" }];
  const opcoes = {
    perfil: { firebaseUid: "pessoaA", empresaId: "empresaA", ativo: true, perfil: "gestor", acessos: null },
    storage, online: true, lerAnexos: async () => anexos,
    apagarAnexos: async id => { chamadas.push(`anexos:${id}`); },
    comTrava: async fn => fn(),
    firebase: {
      usuarioAtual: () => atual,
      aguardarGravacoesFirebase: async () => { chamadas.push("sync"); },
      limparCacheFirestoreParaSaida: async () => { chamadas.push("cache"); },
      logoutFirebase: async () => { chamadas.push("logout"); atual = null; return { ok: true }; },
    },
  };
  return { dom, storage, chamadas, anexos, opcoes, setUsuario: u => { atual = u; }, preparar: () => prepararSaida({ empresaId: "empresaA", uid: "pessoaA", ...opcoes }) };
}

test("backup de saída preserva coleções, fotos e todos os anexos, sem sessão nem outra empresa", async () => {
  const c = contexto();
  const p = await c.preparar();
  assert.equal(p.requerBackup, true);
  assert.equal(p.backup.obras[0].nome, "Obra teste");
  assert.equal(p.backup.rdosEmitidos[0].fotos[0], "data:image/png;base64,AAAA");
  assert.deepEqual(p.backup.anexosLocais, c.anexos);
  assert.equal(p.backup.usuarioLogado, undefined);
  assert.equal(p.backup.empresaB_obras, undefined);
  assert.equal(p.backup._kmzeroBackup.empresaId, "empresaA");
  assert.equal(donoCacheLocal("empresaA", c.storage), "pessoaA");
  assert.equal(c.chamadas.length, 0);
});

test("sem confirmar arquivo salvo nenhuma limpeza nem logout são executados", async () => {
  const c = contexto();
  const r = await executarSaida({ plano: await c.preparar(), ...c.opcoes });
  assert.equal(r.ok, false);
  assert.match(r.erro, /confirme/);
  assert.deepEqual(c.chamadas, []);
  assert.ok(c.storage.getItem("empresaA_obras"));
});

test("sair offline preserva arquivos e sessão", async () => {
  const c = contexto();
  const r = await executarSaida({ plano: await c.preparar(), backupConfirmado: true, ...c.opcoes, online: false });
  assert.equal(r.ok, false);
  assert.deepEqual(c.chamadas, []);
});

test("gravação sem confirmação do servidor bloqueia a exclusão", async () => {
  const c = contexto();
  const p = await c.preparar();
  c.opcoes.firebase.aguardarGravacoesFirebase = async () => { throw new Error("pendente"); };
  const r = await executarSaida({ plano: p, backupConfirmado: true, ...c.opcoes });
  assert.equal(r.ok, false);
  assert.equal(r.erro, "pendente");
  assert.deepEqual(c.chamadas, []);
  assert.ok(c.storage.getItem("empresaA_obras"));
});

test("alteração depois do backup exige nova cópia e não apaga o dado novo", async () => {
  const c = contexto();
  const p = await c.preparar();
  c.storage.setItem("empresaA_pedidos", '[{"id":"novo"}]');
  const r = await executarSaida({ plano: p, backupConfirmado: true, ...c.opcoes });
  assert.equal(r.ok, false);
  assert.match(r.erro, /mudaram/);
  assert.deepEqual(c.chamadas, ["sync"]);
  assert.equal(c.storage.getItem("empresaA_pedidos"), '[{"id":"novo"}]');
});

test("anexo adicionado depois do backup também bloqueia a limpeza", async () => {
  const c = contexto();
  const p = await c.preparar();
  c.anexos.push({ id: "novo", conteudoBase64: "data:text/plain;base64,YQ==" });
  assert.equal(p.backup.anexosLocais.length, 1);
  const r = await executarSaida({ plano: p, backupConfirmado: true, ...c.opcoes });
  assert.equal(r.ok, false);
  assert.deepEqual(c.chamadas, ["sync"]);
});

test("troca de conta impede usar o backup anterior para limpar", async () => {
  const c = contexto();
  const p = await c.preparar();
  c.setUsuario({ uid: "pessoaB" });
  const r = await executarSaida({ plano: p, backupConfirmado: true, ...c.opcoes });
  assert.equal(r.ok, false);
  assert.match(r.erro, /conta mudou/);
  assert.deepEqual(c.chamadas, []);
});

test("mesma empresa com outro dono de cache não permite exportar os dados", async () => {
  const c = contexto();
  await assert.rejects(prepararSaida({ empresaId: "empresaA", uid: "pessoaB", ...c.opcoes }), /outra sessão/);
});

test("falha na leitura do IndexedDB não é tratada como ausência de anexos", async () => {
  const c = contexto();
  await assert.rejects(prepararSaida({ empresaId: "empresaA", uid: "pessoaA", ...c.opcoes, lerAnexos: async () => { throw new Error("banco indisponível"); } }), /banco indisponível/);
  assert.ok(c.storage.getItem("empresaA_obras"));
});

test("outra aba bloqueia a operação antes de qualquer exclusão", async () => {
  const c = contexto();
  const r = await executarSaida({ plano: await c.preparar(), backupConfirmado: true, ...c.opcoes, comTrava: async () => { throw new Error("Feche as outras abas"); } });
  assert.equal(r.ok, false);
  assert.deepEqual(c.chamadas, []);
});

test("cache Firestore ocupado conserva anexos/LS e pede recarregar", async () => {
  const c = contexto();
  const p = await c.preparar();
  c.opcoes.firebase.limparCacheFirestoreParaSaida = async () => { throw new Error("cache ocupado"); };
  const r = await executarSaida({ plano: p, backupConfirmado: true, ...c.opcoes });
  assert.equal(r.ok, false);
  assert.equal(r.recarregar, true);
  assert.deepEqual(c.chamadas, ["sync"]);
  assert.ok(c.storage.getItem("empresaA_obras"));
  assert.equal(lerLimpezaPendente(c.storage), null);
});

test("falha no signOut não é apresentada como saída concluída e conserva dados locais", async () => {
  const c = contexto();
  const p = await c.preparar();
  c.opcoes.firebase.logoutFirebase = async () => ({ ok: false });
  const r = await executarSaida({ plano: p, backupConfirmado: true, ...c.opcoes });
  assert.equal(r.ok, false);
  assert.equal(r.recarregar, true);
  assert.deepEqual(c.chamadas, ["sync", "cache"]);
  assert.ok(c.storage.getItem("empresaA_obras"));
});

test("saída confirmada limpa só a empresa atual, cache e marcas de sessão", async () => {
  const c = contexto();
  const r = await executarSaida({ plano: await c.preparar(), backupConfirmado: true, ...c.opcoes });
  assert.equal(r.ok, true);
  assert.deepEqual(c.chamadas, ["sync", "cache", "logout", "anexos:empresaA"]);
  assert.equal(c.storage.getItem("empresaA_obras"), null);
  assert.equal(c.storage.getItem("empresaA_usuarioLogado"), null);
  assert.equal(c.storage.getItem("_kmzero_empresaId"), null);
  assert.equal(c.storage.getItem("_kmzero_sessao"), null);
  assert.equal(c.storage.getItem(CHAVE_LIMPEZA_PENDENTE), null);
  assert.equal(c.storage.getItem("empresaB_obras"), "[1]");
  assert.equal(c.storage.getItem("kmzero_tema"), "escuro");
});

test("falha após signOut fica registrada; retomada limpa antes de permitir outra conta", async () => {
  const c = contexto();
  const p = await c.preparar();
  const r = await executarSaida({ plano: p, backupConfirmado: true, ...c.opcoes, apagarAnexos: async () => { throw new Error("anexos ocupados"); } });
  assert.equal(r.ok, false);
  assert.equal(r.limpezaPendente, true);
  assert.equal(lerLimpezaPendente(c.storage).empresaId, "empresaA");
  assert.ok(c.storage.getItem("empresaA_obras"));
  const fim = await concluirLimpezaPendente(c.opcoes);
  assert.equal(fim.limpou, true);
  assert.equal(c.storage.getItem("empresaA_obras"), null);
  assert.equal(lerLimpezaPendente(c.storage), null);
});

test("limpeza pendente não pode agir sobre uma nova sessão autenticada", async () => {
  const c = contexto();
  c.storage.setItem(CHAVE_LIMPEZA_PENDENTE, JSON.stringify({ empresaId: "empresaA", uid: "pessoaA", backupConfirmado: true }));
  await assert.rejects(concluirLimpezaPendente(c.opcoes), /Encerre a sessão/);
  assert.deepEqual(c.chamadas, []);
});

test("higiene detecta dados revogados sem apagar edição local única", async () => {
  const c = contexto();
  c.storage.setItem("empresaA_trabalhadores", '[{"id":"p1","nome":"Pessoa teste","salario":5000}]');
  const restrito = { ...c.opcoes.perfil, acessos: ["visao"] };
  const p = higienizarCachePermissoes(restrito, { storage: c.storage });
  assert.equal(p.ok, false);
  assert.equal(p.permitidos.trabalhadores[0].salario, undefined);
  assert.ok(c.storage.getItem("empresaA_trabalhadores").includes("5000"));
  assert.throws(() => higienizarCachePermissoes(restrito, { storage: c.storage, aplicar: true }), /resguardar/);
  await assert.rejects(prepararSaida({ empresaId: "empresaA", uid: "pessoaA", ...c.opcoes, perfil: restrito }), /não pode exportá-los/);
});

test("anexos sem ACL individual não são exportados por gestor limitado", async () => {
  const c = contexto();
  c.storage.removeItem("empresaA_rdos");
  c.storage.setItem("empresaA_obras", "[]");
  const restrito = { ...c.opcoes.perfil, acessos: ["visao"] };
  await assert.rejects(prepararSaida({ empresaId: "empresaA", uid: "pessoaA", ...c.opcoes, perfil: restrito }), /anexos locais/);
  assert.equal(c.anexos.length, 1);
});

test("recuperação administrativa exige dono confirmado no servidor", async () => {
  const c = contexto();
  await assert.rejects(prepararRecuperacaoDono({ empresaId: "empresaA", uid: "pessoaA", ...c.opcoes, confirmarDono: async () => false }), /proprietário ativo/);
  assert.ok(c.storage.getItem("empresaA_obras"));
});

test("cópia do dono preserva cache legado integral e só depois da confirmação ajusta acesso", async () => {
  const c = contexto();
  c.storage.setItem("empresaA_mensagens", '[{"id":"m1","de":"pessoaB","para":"pessoaC","texto":"registro legado"}]');
  const o = { ...c.opcoes, confirmarDono: async () => true };
  const plano = await prepararRecuperacaoDono({ empresaId: "empresaA", uid: "pessoaA", ...o });
  assert.equal(plano.backup.mensagens[0].texto, "registro legado");
  assert.equal(plano.backup.anexosLocais.length, 1);
  assert.ok(c.storage.getItem("empresaA_mensagens").includes("registro legado"));
  assert.equal((await concluirRecuperacaoDono({ plano, ...o })).ok, false);
  assert.ok(c.storage.getItem("empresaA_mensagens").includes("registro legado"));
  const r = await concluirRecuperacaoDono({ plano, backupConfirmado: true, ...o });
  assert.equal(r.ok, true);
  assert.equal(c.storage.getItem("empresaA_mensagens"), "[]");
  assert.ok(c.storage.getItem("empresaA_obras").includes("Obra teste"));
  assert.equal(c.anexos.length, 1);
  assert.deepEqual(c.chamadas, []);
});

test("recuperação recusa cache alterado depois da cópia integral", async () => {
  const c = contexto();
  const o = { ...c.opcoes, confirmarDono: async () => true };
  const plano = await prepararRecuperacaoDono({ empresaId: "empresaA", uid: "pessoaA", ...o });
  c.storage.setItem("empresaA_pedidos", '[{"id":"alteracao-unica"}]');
  const r = await concluirRecuperacaoDono({ plano, backupConfirmado: true, ...o });
  assert.equal(r.ok, false);
  assert.match(r.erro, /cache mudou/);
  assert.equal(c.storage.getItem("empresaA_pedidos"), '[{"id":"alteracao-unica"}]');
});

test("dono precisa continuar autorizado no instante de aplicar recuperação", async () => {
  const c = contexto();
  const plano = await prepararRecuperacaoDono({ empresaId: "empresaA", uid: "pessoaA", ...c.opcoes, confirmarDono: async () => true });
  const r = await concluirRecuperacaoDono({ plano, backupConfirmado: true, ...c.opcoes, confirmarDono: async () => false });
  assert.equal(r.ok, false);
  assert.ok(c.storage.getItem("empresaA_obras"));
});
