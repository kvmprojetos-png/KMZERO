import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { ajustarCacheComCopia, higienizarCachePermissoes, COPIAS_PERMISSOES, prepararSaida, executarSaida } from "../src/lib/saidaSegura.js";

/* Celular de encarregado com o cache gravado pelo cliente anterior a 05/10/2026,
   que baixava as coleções completas para todo mundo. */
function celularAntigo() {
  const storage = new JSDOM("", { url: "https://exemplo.invalid" }).window.localStorage;
  const cache = {
    obras: [
      { id: 1001, nome: "Obra A", local: "Alegre", status: "Em andamento", tipo: "Reforma", cliente: "Cliente X", valorContrato: 500000 },
      { id: 1002, nome: "Obra B", local: "Guaçuí", status: "Em andamento", tipo: "Pavimentação", valorContrato: 900000 },
    ],
    trabalhadores: [
      { id: 1, nome: "Pessoa 1", cargo: "Pedreiro", obraId: 1001, ativo: true, diaria: 150, cpf: "000" },
      { id: 2, nome: "Pessoa 2", cargo: "Servente", obraId: "1002", ativo: true, diaria: 100 },
    ],
    usuarios: [
      { id: "uidDono", firebaseUid: "uidDono", nome: "Dono", email: "dono@exemplo.invalid", perfil: "gestor", ativo: true },
      { id: "uidEnc", firebaseUid: "uidEnc", nome: "Encarregado", email: "enc@exemplo.invalid", perfil: "encarregado", obraId: 1001, ativo: true },
    ],
    historico: { "2026-10-01": { 1: "P", 2: "F" } },
    mensagens: [
      { id: 1, de: "uidOutro", para: "uidTerceiro", texto: "entre terceiros" },
      { id: 2, de: "uidEnc", para: "uidDono", texto: "minha" },
    ],
    rdos: [{ id: 10, obraId: 1001, fotos: ["data:image/png;base64,AAAA"] }, { id: 11, obraId: 1002 }],
    empresa: { nome: "Empresa teste" },
  };
  for (const [k, v] of Object.entries(cache)) storage.setItem(`empA_${k}`, JSON.stringify(v));
  storage.setItem("empA_usuarioLogado", JSON.stringify({ firebaseUid: "uidEnc" }));
  storage.setItem("empA__syncIds_obras", "[1001,1002]");
  storage.setItem("empB_obras", "[1]");
  const perfil = { firebaseUid: "uidEnc", empresaId: "empA", ativo: true, perfil: "encarregado", obraId: 1001, acessos: null };
  return { storage, perfil, cache };
}
const tudo = s => JSON.stringify(Object.fromEntries(Array.from({ length: s.length }, (_, i) => s.key(i)).sort().map(k => [k, s.getItem(k)])));
const ler = (storage, k) => JSON.parse(storage.getItem(`empA_${k}`));

test("cache antigo de encarregado: guarda cópia integral e abre com os dados do perfil", async () => {
  const { storage, perfil } = celularAntigo();
  const antes = Object.fromEntries(["obras", "trabalhadores", "usuarios", "historico", "mensagens", "rdos"].map(k => [k, storage.getItem(`empA_${k}`)]));
  const copias = [];
  const r = await ajustarCacheComCopia(perfil, { storage, gravarCopia: async c => { copias.push(structuredClone(c)); }, agora: () => 1791476276091 });
  assert.equal(r.ok, true);
  assert.deepEqual([...r.chaves].sort(), Object.keys(antes).sort());
  assert.equal(copias.length, 1);
  assert.equal(copias[0].tipo, COPIAS_PERMISSOES.tipo);
  assert.match(copias[0].id, /^empA:uidEnc:[0-9a-f]{24}$/);
  assert.deepEqual(copias[0].chaves, antes); // texto original, byte a byte
  assert.deepEqual(copias[0].perfil, { perfil: "encarregado", obraId: 1001, acessos: null });

  assert.deepEqual(ler(storage, "obras"), [
    { id: 1001, nome: "Obra A", local: "Alegre", status: "Em andamento", tipo: "Reforma" },
    { id: 1002, nome: "Obra B", local: "Guaçuí", status: "Em andamento", tipo: "Pavimentação" },
  ]);
  assert.deepEqual(ler(storage, "trabalhadores"), [{ id: 1, nome: "Pessoa 1", cargo: "Pedreiro", obraId: 1001, ativo: true }]);
  assert.ok(ler(storage, "usuarios").every(u => u.email === undefined));
  assert.deepEqual(ler(storage, "historico"), { "2026-10-01": { 1: "P" } });
  assert.deepEqual(ler(storage, "mensagens").map(m => m.id), [2]);
  assert.deepEqual(ler(storage, "rdos").map(x => x.id), [10]);
  assert.equal(ler(storage, "rdos")[0].fotos[0], "data:image/png;base64,AAAA"); // anexo local da própria obra fica
  assert.deepEqual(ler(storage, "empresa"), { nome: "Empresa teste" });
  assert.equal(storage.getItem("empA__syncIds_obras"), "[1001,1002]");
  assert.equal(storage.getItem("empB_obras"), "[1]");
  assert.equal(higienizarCachePermissoes(perfil, { storage }).ok, true); // a próxima abertura não copia de novo
});

test("sem cópia confirmada nada muda no aparelho e a abertura para com o motivo", async () => {
  const { storage, perfil } = celularAntigo();
  const antes = tudo(storage);
  const r = await ajustarCacheComCopia(perfil, { storage, gravarCopia: async () => { throw new Error("armazenamento cheio"); } });
  assert.equal(r.ok, false);
  assert.match(r.erro, /armazenamento cheio/);
  assert.equal(tudo(storage), antes);
});

test("cache alterado durante a cópia (outra aba) não é sobrescrito", async () => {
  const { storage, perfil } = celularAntigo();
  const r = await ajustarCacheComCopia(perfil, { storage, gravarCopia: async () => {
    storage.setItem("empA_rdos", JSON.stringify([{ id: 12, obraId: 1001, novo: true }]));
  } });
  assert.equal(r.ok, false);
  assert.match(r.erro, /mudaram durante a cópia/);
  assert.equal(ler(storage, "rdos")[0].id, 12);
  assert.equal(ler(storage, "obras")[0].valorContrato, 500000); // nenhuma outra chave foi filtrada
});

test("cache já compatível abre sem gravar cópia", async () => {
  const { storage } = celularAntigo();
  const dono = { firebaseUid: "uidDono", empresaId: "empA", ativo: true, perfil: "gestor", acessos: null };
  storage.setItem("empA_mensagens", JSON.stringify([{ id: 2, de: "uidEnc", para: "uidDono" }]));
  let chamou = false;
  const r = await ajustarCacheComCopia(dono, { storage, gravarCopia: async () => { chamou = true; } });
  assert.deepEqual(r, { ok: true, chaves: [] });
  assert.equal(chamou, false);
});

test("dono com mensagens entre terceiros no cache também abre, com cópia", async () => {
  const { storage } = celularAntigo();
  const dono = { firebaseUid: "uidDono", empresaId: "empA", ativo: true, perfil: "gestor", acessos: null };
  let copia = null;
  const r = await ajustarCacheComCopia(dono, { storage, gravarCopia: async c => { copia = c; } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.chaves, ["mensagens"]);
  assert.ok(copia.chaves.mensagens.includes("entre terceiros"));
  assert.ok(ler(storage, "mensagens").every(m => [m.de, m.para].includes("uidDono")));
  assert.equal(ler(storage, "obras")[0].valorContrato, 500000); // dono continua com tudo
});

/* Saída segura com cópias guardadas: perfil restrito não exporta nem limpa; gestor completo
   leva as cópias no arquivo e elas são apagadas junto com o resto do aparelho. */
function saidaComCopia(perfil) {
  const { storage } = celularAntigo();
  storage.setItem("empA__donoCacheUid", perfil.firebaseUid);
  const copia = { id: "empA:uidX:abc", tipo: COPIAS_PERMISSOES.tipo, empresaId: "empA", uid: perfil.firebaseUid, chaves: { obras: "[{\"id\":1,\"valorContrato\":9}]" } };
  const chamadas = [];
  let atual = { uid: perfil.firebaseUid };
  const opcoes = {
    storage, online: true, lerAnexos: async () => [], lerCopias: async id => (id === "empA" ? [copia] : []),
    apagarAnexos: async id => { chamadas.push(`anexos:${id}`); }, apagarCopias: async id => { chamadas.push(`copias:${id}`); },
    comTrava: async fn => fn(),
    firebase: {
      usuarioAtual: () => atual,
      aguardarGravacoesFirebase: async () => { chamadas.push("sync"); },
      limparCacheFirestoreParaSaida: async () => { chamadas.push("cache"); },
      logoutFirebase: async () => { chamadas.push("logout"); atual = null; return { ok: true }; },
    },
  };
  return { storage, copia, chamadas, opcoes };
}

test("saída: perfil restrito com cópia guardada no aparelho não exporta nem apaga", async () => {
  const enc = { firebaseUid: "uidEnc", empresaId: "empA", ativo: true, perfil: "encarregado", obraId: 1001 };
  const c = saidaComCopia(enc);
  await ajustarCacheComCopia(enc, { storage: c.storage, gravarCopia: async () => {} }); // cache já ajustado
  await assert.rejects(prepararSaida({ empresaId: "empA", uid: "uidEnc", perfil: enc, ...c.opcoes }), /cópia de segurança/);
  assert.deepEqual(c.chamadas, []);
});

test("saída: gestor completo leva as cópias no arquivo e elas são apagadas na limpeza", async () => {
  const dono = { firebaseUid: "uidDono", empresaId: "empA", ativo: true, perfil: "gestor", acessos: null };
  const c = saidaComCopia(dono);
  await ajustarCacheComCopia(dono, { storage: c.storage, gravarCopia: async () => {} }); // abertura já ajustou
  const plano = await prepararSaida({ empresaId: "empA", uid: "uidDono", perfil: dono, ...c.opcoes });
  assert.equal(plano.requerBackup, true);
  assert.deepEqual(plano.backup.copiasPermissoes, [c.copia]);
  const r = await executarSaida({ plano, backupConfirmado: true, ...c.opcoes });
  assert.equal(r.ok, true, r.erro);
  assert.deepEqual(c.chamadas, ["sync", "cache", "logout", "anexos:empA", "copias:empA"]);
});

test("mesmo cache aberto duas vezes gera a mesma cópia (id pelo conteúdo)", async () => {
  const a = celularAntigo(), b = celularAntigo();
  const ids = [];
  await ajustarCacheComCopia(a.perfil, { storage: a.storage, gravarCopia: async c => { ids.push(c.id); }, agora: () => 1 });
  await ajustarCacheComCopia(b.perfil, { storage: b.storage, gravarCopia: async c => { ids.push(c.id); }, agora: () => 2 });
  assert.equal(ids.length, 2);
  assert.equal(ids[0], ids[1]);
  assert.match(ids[0], /^empA:uidEnc:[0-9a-f]{24}$/);
});
