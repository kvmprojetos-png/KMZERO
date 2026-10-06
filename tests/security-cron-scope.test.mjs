import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { empresasCronConfiguradas } from '../api/cron-avisos.js';

test('cron company allowlist rejects malformed paths and never enables all companies implicitly', () => {
  for (const v of [undefined,'','empresa/outra','../outra',Array.from({length:21},(_,i)=>`empresa${i}`).join(',')]) assert.deepEqual(empresasCronConfiguradas(v),[]);
  assert.deepEqual(empresasCronConfiguradas(' empresa-1, empresa-1 ,empresa_2'),['empresa-1','empresa_2']);
});
test('even a valid cron secret cannot start without explicit enabled companies', async () => {
  const anterior = process.env.CRON_SECRET, ids = process.env.CRON_EMPRESA_IDS;
  process.env.CRON_SECRET = 'segredo-teste'; delete process.env.CRON_EMPRESA_IDS;
  const res = {setHeader(){},status(c){this.code=c;return this;},json(j){this.body=j;return this;}};
  try {
    await handler({method:'GET',headers:{authorization:'Bearer segredo-teste'},query:{}},res);
    assert.equal(res.code,503);
    assert.match(res.body.erro,/sem empresas/);
  } finally {
    if (anterior === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET=anterior;
    if (ids === undefined) delete process.env.CRON_EMPRESA_IDS; else process.env.CRON_EMPRESA_IDS=ids;
  }
});
