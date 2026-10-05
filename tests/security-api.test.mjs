import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { tratarNotificar } from '../api/notificar.js';
import cronHandler from '../api/cron-avisos.js';
import { destinatarios } from '../api/_lib/enviarAviso.js';

// Local contract tests: no Firebase credentials, network or real notifications.
const TOKEN = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhbGljZSJ9.signature';
const request = (body = { empresaId: 'empresa-a', avisoId: 'aviso-1' }, authorization = `Bearer ${TOKEN}`) => ({ method: 'POST', headers: { authorization }, body });
function response() {
  return { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, setHeader(k, v) { this.headers[k] = v; }, json(body) { this.body = body; return this; } };
}
function fixture({ perfil = {}, aviso = {}, revoked = false, authError, dbError } = {}) {
  const state = { reads: [], verifications: [], sends: 0, writes: 0 };
  const records = new Map([
    ['usuarios/alice', { empresaId: 'empresa-a', perfil: 'gestor', ativo: true, ...perfil }],
    ['usuarios/bob', { empresaId: 'empresa-a', perfil: 'encarregado', ativo: true }],
    ['empresas/empresa-a/avisos/aviso-1', { de: 'alice', titulo: 'Aviso', texto: 'Conferir a obra', para: { tipo: 'todos' }, ...aviso }],
    ['empresas/empresa-a/pushTokens/aparelho-bob', { uid: 'bob', token: 'fake-fcm-token' }],
  ]);
  const snapshot = path => ({ id: path.split('/').at(-1), exists: records.has(path), data: () => records.get(path), ref: ref(path) });
  function ref(path) {
    return {
      async get() { state.reads.push(path); if (dbError) throw dbError; return snapshot(path); },
      collection(name) { return collection(`${path}/${name}`); },
      async update(updates) {
        state.writes++;
        const record = records.get(path);
        for (const [key, value] of Object.entries(updates)) {
          const [field, nested] = key.split('.');
          if (nested) (record[field] ||= {})[nested] = value;
          else record[field] = value;
        }
      },
      async delete() { records.delete(path); },
    };
  }
  function collection(path) {
    const get = async () => ({ docs: [...records.keys()].filter(p => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes('/')).map(snapshot) });
    return { doc: id => ref(`${path}/${id}`), get, where: (field, _op, value) => ({ get: async () => ({ docs: (await get()).docs.filter(d => d.data()[field] === value) }) }) };
  }
  const admin = {
    db: { collection, runTransaction: callback => callback({ get: r => r.get(), update: (r, data) => r.update(data) }) },
    auth: { async verifyIdToken(token, checkRevoked) {
      state.verifications.push({ token, checkRevoked });
      if (authError) throw authError;
      if (revoked && checkRevoked) throw Object.assign(new Error('revoked'), { code: 'auth/id-token-revoked' });
      return { uid: 'alice' };
    } },
    mensageiro: { async sendEachForMulticast({ tokens }) { state.sends++; return { responses: tokens.map(() => ({ success: true })) }; } },
  };
  return { admin, state, records };
}

test('anonymous requests are rejected before server configuration is loaded', async () => {
  const res = response();
  await handler(request(undefined, ''), res);
  assert.equal(res.statusCode, 401);
  assert.equal('detalhe' in res.body, false);
});

test('malformed authorization never reaches authentication or storage', async () => {
  for (const value of ['', TOKEN, 'Basic secret', ['Bearer token'], 'Bearer token extra', `Bearer ${TOKEN} trailing`, `Bearer ${'a'.repeat(17000)}.b.c`]) {
    const { admin, state } = fixture();
    const res = response();
    await tratarNotificar(admin, request(undefined, value), res);
    assert.equal(res.statusCode, 401, String(value));
    assert.equal(state.verifications.length, 0);
    assert.equal(state.reads.length, 0);
  }
});

test('invalid document paths and body types never reach Firestore', async () => {
  const bodies = [null, [], 'text', {}, { empresaId: 'empresa-a', avisoId: 'a/subcollection/b' }, { empresaId: 'empresa-a', avisoId: ['aviso-1'] }, { empresaId: 'empresa-a', avisoId: '..' }, { empresaId: 'empresa-a', avisoId: '__reserved__' }, { empresaId: 'empresa-a', avisoId: 'x'.repeat(1501) }, { empresaId: 'empresa-a', avisoId: 'bad\npath' }, { empresaId: {}, avisoId: 'aviso-1' }];
  for (const body of bodies) {
    const { admin, state } = fixture();
    const res = response();
    await tratarNotificar(admin, request(body), res);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.equal(state.reads.length, 0);
    assert.equal(state.sends, 0);
  }
});

test('a revoked session is refused even when the ID token has not expired', async () => {
  const { admin, state } = fixture({ revoked: true });
  const res = response();
  await tratarNotificar(admin, request(), res);
  assert.equal(res.statusCode, 401);
  assert.equal(state.reads.length, 0);
  assert.equal(state.sends, 0);
});

test('expired, disabled and invalid sessions all return 401 without side effects', async () => {
  for (const code of ['auth/id-token-expired', 'auth/user-disabled', 'auth/invalid-id-token']) {
    const { admin, state } = fixture({ authError: Object.assign(new Error('PRIVATE_AUTH_SENTINEL'), { code }) });
    const res = response();
    await tratarNotificar(admin, request(), res);
    assert.equal(res.statusCode, 401);
    assert.equal(state.reads.length, 0);
    assert.equal(JSON.stringify(res.body).includes('PRIVATE_AUTH_SENTINEL'), false);
  }
});

test('server errors do not expose internal details to the caller', async () => {
  const { admin } = fixture({ dbError: new Error('PRIVATE_SENTINEL_database_detail') });
  const res = response();
  await tratarNotificar(admin, request(), res);
  assert.equal(res.statusCode, 500);
  assert.equal('detalhe' in res.body, false);
  assert.equal(JSON.stringify(res.body).includes('PRIVATE_SENTINEL'), false);
});

test('authorized notification sends once and a replay is idempotent', async () => {
  const { admin, state } = fixture();
  const first = response(), second = response();
  await tratarNotificar(admin, request(), first);
  await tratarNotificar(admin, request(), second);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.aparelhos, 1);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.jaEnviado, true);
  assert.equal(state.sends, 1);
});

test('inactive users, another company, another author and an excessive audience are denied', async () => {
  for (const options of [{ perfil: { ativo: false } }, { perfil: { empresaId: 'outra-empresa' } }, { aviso: { de: 'bob' } }, { perfil: { perfil: 'encarregado' } }]) {
    const { admin, state } = fixture(options);
    const res = response();
    await tratarNotificar(admin, request(), res);
    assert.equal(res.statusCode, 403);
    assert.equal(state.sends, 0);
    assert.equal(state.writes, 0);
  }
});

test('an authorized field user can still notify managers', async () => {
  const { admin } = fixture({ perfil: { perfil: 'encarregado' }, aviso: { para: { tipo: 'gestores' } } });
  const res = response();
  await tratarNotificar(admin, request(), res);
  assert.equal(res.statusCode, 200);
});

test('recipient identity comes from the document ID, never a writable profile field', async () => {
  const { admin, records } = fixture();
  records.get('usuarios/bob').firebaseUid = 'alice';
  assert.deepEqual(await destinatarios(admin.db, 'empresa-a', { para: { tipo: 'pessoa', uid: 'bob' } }), ['bob']);
  assert.deepEqual(await destinatarios(admin.db, 'empresa-a', { para: { tipo: 'pessoa', uid: 'alice' } }), ['alice']);
});

test('notification and cron endpoints reject unsupported methods', async () => {
  const n = response(), c = response();
  await handler({ method: 'GET', headers: {} }, n);
  await cronHandler({ method: 'POST', headers: {} }, c);
  assert.equal(n.statusCode, 405);
  assert.equal(n.headers.Allow, 'POST');
  assert.equal(c.statusCode, 405);
  assert.equal(c.headers.Allow, 'GET');
});

test('cron refuses an anonymous call before loading Firebase', async () => {
  const res = response();
  await cronHandler({ method: 'GET', headers: {}, query: { etapa: 'noite' } }, res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { erro: 'Não autorizado.' });
});
