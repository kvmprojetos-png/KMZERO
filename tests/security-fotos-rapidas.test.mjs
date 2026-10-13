import test from 'node:test';
import assert from 'node:assert/strict';
import { tratarFoto } from '../api/foto.js';
import { criarLeituraFotos } from '../src/lib/fotosNuvemLeitura.js';
import { normalizarFotoLocalPrivada } from '../src/lib/fotoCaminho.js';

// Tudo aqui é memória/fakes: nunca uma conta ou projeto real.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1QAAAABJRU5ErkJggg==', 'base64');
const PATH = 'empresas/empresa-a/fotosObras/foto-1.jpg';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
// Forma de login Firebase deste projeto e no prazo (a assinatura é falsa: quem confere é o verifyIdToken do fake).
const tokenDe = uid => `${b64({ alg: 'RS256', kid: 'k1' })}.${b64({ user_id: uid, sub: uid, aud: 'kmzero-aca24', iss: 'https://securetoken.google.com/kmzero-aca24', exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura`;
const espera = ms => new Promise(r => setTimeout(r, ms));
const request = token => ({ method: 'GET', headers: { authorization: `Bearer ${token}` }, query: { empresaId: 'empresa-a', fotoId: 'foto-1' } });
function response() { return { headers: {}, statusCode: 200, setHeader(k,v) { this.headers[k]=v; }, status(v) { this.statusCode=v; return this; }, json(v) { this.body=v; return this; }, send(v) { this.body=v; return this; } }; }

// verifyIdToken demora: as outras leituras já saíram quando ele responde.
function servidor({ verificado = 'alice', revogado = false, perfis = {}, objeto = true } = {}) {
  const estado = { eventos: [], perfisLidos: [], downloads: 0 };
  const registros = new Map([
    ['usuarios/alice', { empresaId: 'empresa-a', perfil: 'gestor', ativo: true }],
    ['usuarios/bob', { empresaId: 'empresa-b', perfil: 'gestor', ativo: true }],
    ['usuarios/enc8', { empresaId: 'empresa-a', perfil: 'encarregado', obraId: 8, ativo: true }],
    ['empresas/empresa-a/fotosObras/foto-1', { id: 'foto-1', obraId: 7, fotoPath: PATH }],
  ]);
  for (const [uid, p] of Object.entries(perfis)) registros.set(`usuarios/${uid}`, p);
  const ref = path => ({ collection: n => colecao(`${path}/${n}`), async get() {
    if (path.startsWith('usuarios/')) estado.perfisLidos.push(path.slice(9));
    estado.eventos.push(`get:${path}`); await espera(1);
    return { exists: registros.has(path), data: () => registros.get(path) };
  } });
  const colecao = path => ({ doc: id => ref(`${path}/${id}`) });
  const arquivo = name => ({ name,
    async getMetadata() { estado.eventos.push('metadados'); await espera(1); if (!objeto) throw Object.assign(new Error(), { code: 404 });
      return [{ size: String(PNG.length), contentType: 'image/png', generation: '1' }]; },
    async download({ start, end }) { estado.downloads++; return [PNG.subarray(start, end + 1)]; } });
  const admin = { db: { collection: colecao }, bucket: { file: arquivo },
    auth: { async verifyIdToken(token, checar) { assert.equal(checar, true); estado.eventos.push('verificar:inicio'); await espera(15); estado.eventos.push('verificar:fim');
      if (revogado) throw Object.assign(new Error('segredo'), { code: 'auth/id-token-revoked' }); return { uid: verificado }; } } };
  return { admin, estado };
}

test('GET em paralelo: leituras saem antes do login responder, mas a foto só vai com tudo autorizado', async () => {
  const { admin, estado } = servidor(); const res = response();
  await tratarFoto(admin, request(tokenDe('alice')), res);
  assert.equal(res.statusCode, 200); assert.deepEqual(res.body, PNG); assert.equal(estado.downloads, 1);
  const fim = estado.eventos.indexOf('verificar:fim');
  for (const e of ['get:usuarios/alice', 'get:empresas/empresa-a/fotosObras/foto-1', 'metadados']) assert.ok(estado.eventos.indexOf(e) < fim, e);
  assert.deepEqual(estado.perfisLidos, ['alice']);
});

test('token revogado, perfil de outra empresa ou encarregado de outra obra: 401/403 sem baixar nem expor metadados', async () => {
  const casos = [
    [{ revogado: true }, 'alice', 401],
    [{ verificado: 'bob' }, 'bob', 403],
    [{ verificado: 'enc8' }, 'enc8', 403],
    [{ verificado: 'alice', perfis: { alice: { empresaId: 'empresa-a', perfil: 'gestor', ativo: false } } }, 'alice', 403],
    [{ verificado: 'alice', perfis: { alice: { empresaId: 'empresa-a', perfil: 'gestor', acessos: ['financeiro'] } } }, 'alice', 403],
  ];
  for (const [opcoes, uid, codigo] of casos) {
    const { admin, estado } = servidor(opcoes); const res = response();
    await tratarFoto(admin, request(tokenDe(uid)), res);
    assert.equal(res.statusCode, codigo, JSON.stringify(opcoes)); assert.equal(estado.downloads, 0);
    assert.equal(res.headers['Content-Type'], undefined); assert.equal(res.headers['X-KM-Foto-Tamanho'], undefined); assert.equal(res.headers['X-KM-Foto-Versao'], undefined);
    assert.equal(JSON.stringify(res.body).includes('image/png'), false);
  }
});

test('objeto ausente só vira 404 depois das checagens de acesso', async () => {
  const sem = servidor({ verificado: 'bob', objeto: false }); const a = response();
  await tratarFoto(sem.admin, request(tokenDe('bob')), a); assert.equal(a.statusCode, 403);
  const revogado = servidor({ revogado: true, objeto: false }); const b = response();
  await tratarFoto(revogado.admin, request(tokenDe('alice')), b); assert.equal(b.statusCode, 401);
  const autorizado = servidor({ objeto: false }); const c = response();
  await tratarFoto(autorizado.admin, request(tokenDe('alice')), c); assert.equal(c.statusCode, 404);
});

test('uid adulterado no payload do token nunca escolhe o perfil usado', async () => {
  // Payload diz "alice" (gestora da empresa-a), mas o token verificado é do bob (empresa-b).
  const bob = servidor({ verificado: 'bob' }); const a = response();
  await tratarFoto(bob.admin, request(tokenDe('alice')), a);
  assert.equal(a.statusCode, 403); assert.equal(bob.estado.downloads, 0); assert.deepEqual(bob.estado.perfisLidos, ['alice', 'bob']);
  // Payload diz "bob", verificado é alice: relê o perfil da alice e libera.
  const alice = servidor({ verificado: 'alice' }); const b = response();
  await tratarFoto(alice.admin, request(tokenDe('bob')), b);
  assert.equal(b.statusCode, 200); assert.deepEqual(alice.estado.perfisLidos, ['bob', 'alice']);
  // Payload ilegível ou com uid inválido: lê só o perfil do uid verificado.
  for (const token of ['xx.yy.zz', `${b64({})}.${b64({ user_id: '../x' })}.s`]) {
    const s = servidor(); const r = response();
    await tratarFoto(s.admin, request(token), r);
    assert.equal(r.statusCode, 200); assert.deepEqual(s.estado.perfisLidos, ['alice']);
  }
});

/* ── Cliente: leitura progressiva (fotosNuvemLeitura.js, sem Firebase) ── */
const EMP = 'emp';
const doc = (id, extra = {}) => ({ id: String(id), dados: { obraId: 7, fotoPath: `empresas/${EMP}/fotosObras/${id}.jpg`, legenda: 'x', ...extra } });
const snap = lista => ({ docs: lista.map(d => ({ id: d.id, data: () => ({ ...d.dados }) })) });
function adiado() { let resolve, reject; const promessa = new Promise((a, b) => { resolve = a; reject = b; }); return { promessa, resolve, reject }; }
function leitor({ paralelo, intervaloMs = 30 } = {}) {
  const chamadas = [], emissoes = [];
  const l = criarLeituraFotos({ empresaId: EMP, paralelo, intervaloMs, avisar: () => {},
    callback: lista => emissoes.push({ t: Date.now(), lista }),
    carregarFoto: (registro, { signal }) => { const d = adiado(); chamadas.push({ id: registro.id, registro, signal, ...d }); return d.promessa; } });
  return { l, chamadas, emissoes };
}
const bytes = id => `data:image/png;base64,${Buffer.from(String(id)).toString('base64')}`;
const carregada = ({ registro }) => { const { fotoUrl, foto, ...meta } = registro; return { ...meta, foto: bytes(registro.id), fotoIndisponivel: false, acessoFoto: 'autenticado' }; };
const responder = c => c.resolve(carregada(c));
const ids = lista => lista.map(x => x.id).sort();

test('baixa as mais novas primeiro, 6 por vez, e emite só listas completas com marcadores', async () => {
  const docs = [1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007].map(i => doc(i)); // Firestore: mais antigas primeiro
  const { l, chamadas, emissoes } = leitor();
  l.aoSnapshot(snap(docs)); await espera(5);
  assert.deepEqual(chamadas.map(c => c.id), ['1007', '1006', '1005', '1004', '1003', '1002']);
  assert.equal(emissoes.length, 1); // lista inicial já aparece
  for (const x of emissoes[0].lista) { assert.equal(x.fotoCarregando, true); assert.equal(x.foto, ''); assert.equal(x.fotoUrl, undefined); assert.ok(x.fotoPath); }
  responder(chamadas[0]); await espera(1);
  assert.deepEqual(chamadas.map(c => c.id).slice(6), ['1001']);
  await espera(60);
  const parcial = emissoes.at(-1).lista.find(x => x.id === '1007');
  assert.equal(parcial.foto, bytes('1007')); assert.equal(parcial.fotoCarregando, undefined);
  for (const c of chamadas.slice(1)) responder(c); await espera(1);
  for (const c of chamadas.slice(7)) responder(c); await espera(5);
  const final = emissoes.at(-1).lista;
  assert.equal(final.some(x => x.fotoCarregando), false); assert.equal(final.every(x => x.foto.startsWith('data:image/')), true);
  for (const e of emissoes) assert.deepEqual(ids(e.lista), docs.map(d => d.id).sort());
  for (let i = 1; i < emissoes.length - 1; i++) assert.ok(emissoes[i].t - emissoes[i - 1].t >= 25, 'emissões intermediárias respeitam o intervalo');
  l.encerrar();
});

test('snapshot só de metadados não reinicia; doc novo só baixa o novo; online tenta de novo as que falharam', async () => {
  const { l, chamadas, emissoes } = leitor();
  const a = doc(1), b = doc(2);
  l.aoSnapshot(snap([a, b])); await espera(1);
  assert.deepEqual(chamadas.map(c => c.id), ['2', '1']);
  l.aoSnapshot(snap([a, b])); await espera(1); // mesmo conteúdo (ex.: fromCache -> servidor)
  assert.equal(chamadas.length, 2); assert.equal(chamadas.some(c => c.signal.aborted), false);
  responder(chamadas[0]); chamadas[1].reject(Object.assign(new Error('x'), { status: 500 })); await espera(5);
  let final = emissoes.at(-1).lista;
  assert.equal(final.find(x => x.id === '1').fotoIndisponivel, true); assert.equal(final.find(x => x.id === '2').foto, bytes('2'));
  l.aoSnapshot(snap([a, b])); await espera(5); assert.equal(chamadas.length, 2); // concluída e igual: ignora
  const antes = emissoes.length;
  l.aoSnapshot(snap([a, b, doc(3)])); await espera(45); // lista com marcadores sai no próximo intervalo
  assert.deepEqual(chamadas.slice(2).map(x => x.id), ['3', '1']); // a 2 vem do cache; mais novo primeiro
  const inicial = emissoes[antes].lista;
  assert.equal(inicial.length, 3); assert.equal(inicial.find(x => x.id === '2').foto, bytes('2'));
  assert.equal(inicial.find(x => x.id === '3').fotoCarregando, true); assert.equal(inicial.find(x => x.id === '1').fotoCarregando, true);
  responder(chamadas[2]); chamadas[3].reject(new Error('rede')); await espera(5);
  final = emissoes.at(-1).lista; assert.equal(final.length, 3); assert.equal(final.find(x => x.id === '1').fotoIndisponivel, true);
  const n = chamadas.length; l.aoReconectar(); await espera(1);
  assert.deepEqual(chamadas.slice(n).map(x => x.id), ['1']); // online: só a que falhou
  responder(chamadas[n]); await espera(5);
  assert.equal(emissoes.at(-1).lista.every(x => x.foto.startsWith('data:image/') && !x.fotoIndisponivel && !x.fotoCarregando), true);
  l.encerrar();
});

test('documento alterado baixa de novo mostrando os bytes conhecidos do mesmo caminho; encerrar silencia', async () => {
  const { l, chamadas, emissoes } = leitor();
  l.aoSnapshot(snap([doc(1)])); await espera(1); responder(chamadas[0]); await espera(5);
  l.aoSnapshot(snap([doc(1, { legenda: 'nova' })])); await espera(45); // a lista com marcador respeita o intervalo desde a última emissão
  assert.equal(chamadas.length, 2);
  const marcador = emissoes.at(-1).lista[0];
  assert.equal(marcador.fotoCarregando, true); assert.equal(marcador.legenda, 'nova'); assert.equal(marcador.foto, bytes('1'));
  l.aoSnapshot(snap([doc(1, { legenda: 'nova', obraId: 8 })])); await espera(45); // mudou de obra: não reaproveita bytes
  assert.equal(chamadas[1].signal.aborted, true); assert.equal(emissoes.at(-1).lista[0].foto, '');
  const total = emissoes.length; l.encerrar(); responder(chamadas[2]); await espera(40);
  assert.equal(emissoes.length, total); assert.equal(chamadas[2].signal.aborted, true);
});

test('snapshot do servidor com os mesmos docs tenta de novo só as que falharam; em andamento segue ignorado', async () => {
  const chamadas = [], emissoes = [];
  const l = criarLeituraFotos({ empresaId: EMP, intervaloMs: 30, avisar: () => {}, esperasNovaTentativaMs: [],
    callback: lista => emissoes.push(lista),
    carregarFoto: (registro, { signal }) => { const d = adiado(); chamadas.push({ id: registro.id, registro, signal, ...d }); return d.promessa; } });
  const docs = [doc(1), doc(2)];
  const doCache = { ...snap(docs), metadata: { fromCache: true } }, doServidor = { ...snap(docs), metadata: { fromCache: false } };
  l.aoSnapshot(doCache); await espera(1);
  l.aoSnapshot(doServidor); await espera(1); // passada em andamento: ignora
  assert.equal(chamadas.length, 2); assert.equal(chamadas.some(c => c.signal.aborted), false);
  responder(chamadas[0]); chamadas[1].reject(new Error('rede')); await espera(5);
  assert.equal(emissoes.at(-1).find(x => x.id === '1').fotoIndisponivel, true);
  l.aoSnapshot(doCache); await espera(1); assert.equal(chamadas.length, 2); // ainda do cache: não tenta
  l.aoSnapshot(doServidor); await espera(1);
  assert.deepEqual(chamadas.slice(2).map(c => c.id), ['1']); // só a que falhou
  responder(chamadas[2]); await espera(5);
  assert.equal(emissoes.at(-1).every(x => x.foto.startsWith('data:image/') && !x.fotoIndisponivel), true);
  l.aoSnapshot(doServidor); await espera(5); assert.equal(chamadas.length, 3); // sem falhas: ignora
  l.encerrar();
});

test('falha de rede/5xx tenta de novo sozinha com espera crescente; 403 não; encerrar cancela', async () => {
  const chamadas = [];
  const l = criarLeituraFotos({ empresaId: EMP, intervaloMs: 5, avisar: () => {}, esperasNovaTentativaMs: [10, 30],
    callback: () => {}, carregarFoto: registro => { const d = adiado(); chamadas.push({ id: registro.id, ...d }); return d.promessa; } });
  l.aoSnapshot(snap([doc(1)])); await espera(1);
  chamadas[0].reject(Object.assign(new Error('x'), { status: 503 })); await espera(20);
  assert.equal(chamadas.length, 2);
  chamadas[1].reject(new Error('rede')); await espera(15); assert.equal(chamadas.length, 2); // segunda espera é maior
  await espera(30); assert.equal(chamadas.length, 3);
  chamadas[2].reject(new Error('rede')); await espera(60); assert.equal(chamadas.length, 3); // esperas esgotadas
  l.encerrar();
  const n = criarLeituraFotos({ empresaId: EMP, intervaloMs: 5, avisar: () => {}, esperasNovaTentativaMs: [10],
    callback: () => {}, carregarFoto: registro => { const d = adiado(); chamadas.push({ id: registro.id, ...d }); return d.promessa; } });
  n.aoSnapshot(snap([doc(2)])); await espera(1);
  chamadas[3].reject(Object.assign(new Error('x'), { status: 403 })); await espera(30); assert.equal(chamadas.length, 4);
  n.aoSnapshot(snap([doc(3)])); await espera(1); chamadas[4].reject(new Error('rede')); await espera(2);
  n.encerrar(); await espera(20); assert.equal(chamadas.length, 5);
});

test('marcador de carregamento nunca é guardado no cache local', () => {
  const r = normalizarFotoLocalPrivada({ id: '1', obraId: 7, fotoPath: 'empresas/emp/fotosObras/1.jpg', foto: '', fotoCarregando: true }, 'emp');
  assert.equal(r.fotoCarregando, undefined); assert.equal(r.foto, undefined);
});

test('token sem forma de login deste projeto (vencido ou de outro projeto) é recusado antes de qualquer leitura', async () => {
  const agora = Math.floor(Date.now() / 1000);
  const tokens = [
    `${b64({ alg: 'RS256', kid: 'k1' })}.${b64({ user_id: 'alice', sub: 'alice', aud: 'kmzero-aca24', iss: 'https://securetoken.google.com/kmzero-aca24', exp: agora - 10 })}.s`,
    `${b64({ alg: 'RS256', kid: 'k1' })}.${b64({ user_id: 'alice', sub: 'alice', aud: 'outro', iss: 'https://securetoken.google.com/outro', exp: agora + 3600 })}.s`,
    `${b64({ alg: 'none' })}.${b64({ user_id: 'alice', aud: 'kmzero-aca24', iss: 'https://securetoken.google.com/kmzero-aca24', exp: agora + 3600 })}.s`,
  ];
  for (const token of tokens) {
    const { admin, estado } = servidor({ revogado: true }); const res = response();
    await tratarFoto(admin, request(token), res);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(estado.eventos, ['verificar:inicio', 'verificar:fim']); // nenhuma leitura
    assert.equal(estado.downloads, 0);
  }
});

test('foto parada no meio do download vira indisponível no prazo e não prende a passada', async () => {
  const emissoes = [];
  const l = criarLeituraFotos({ empresaId: EMP, paralelo: 1, intervaloMs: 5, prazoFotoMs: 40, esperasNovaTentativaMs: [], avisar: () => {},
    callback: lista => emissoes.push(lista),
    carregarFoto: (registro, { signal }) => registro.id === '2'
      ? new Promise((_, rej) => signal.addEventListener('abort', () => rej(new DOMException('parou', 'AbortError')), { once: true }))
      : Promise.resolve(carregada({ registro })) });
  l.aoSnapshot(snap([doc(1), doc(2)]));
  await espera(150);
  const final = emissoes.at(-1);
  assert.equal(final.find(x => x.id === '2').fotoIndisponivel, true);
  assert.equal(final.find(x => x.id === '1').foto, bytes('1')); // a outra foto não ficou presa atrás
  assert.equal(final.some(x => x.fotoCarregando), false);
  l.encerrar();
});
