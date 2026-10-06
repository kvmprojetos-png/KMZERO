import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('server entry points load when CommonJS cannot require an ES module (Vercel)', () => {
  // Vercel's runtime loader rejects the jwks-rsa 4 -> require(jose 6) chain.
  // Exercise the real dependency graph, without credentials or network calls.
  const code = `
    const { default: notificar } = await import('./api/notificar.js');
    const { default: cron } = await import('./api/cron-avisos.js');
    const { default: assistente } = await import('./api/assistente.js');
    function response() {
      return { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; },
        status(value) { this.statusCode = value; return this; },
        json(value) { this.body = value; return this; } };
    }
    const n = response(), c = response(), a = response();
    await notificar({ method: 'GET', headers: {} }, n);
    await cron({ method: 'GET', headers: {}, query: {} }, c);
    await assistente({ method: 'GET', headers: {}, query: {} }, a);
    console.log(JSON.stringify({ notificar: n.statusCode, allow: n.headers.Allow, cron: c.statusCode, assistente: a.statusCode }));
  `;
  const result = spawnSync(process.execPath, ['--no-experimental-require-module', '--input-type=module', '-e', code], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', timeout: 20000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), { notificar: 405, allow: 'POST', cron: 401, assistente: 401 });
});
