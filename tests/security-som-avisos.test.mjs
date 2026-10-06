import test from 'node:test';
import assert from 'node:assert/strict';
import { novoAvisoSonoro } from '../src/lib/somAvisos.js';
test('only incoming notices created after this session produce a sound candidate', () => {
  const conhecidos = new Set();
  const avisos = [{id:'antigo',de:'outro',criadoEm:99},{id:'meu',de:'eu',criadoEm:110},{id:'novo',de:'outro',criadoEm:120}];
  assert.equal(novoAvisoSonoro(avisos,{uid:'eu',inicio:100,conhecidos}).id,'novo');
  assert.equal(novoAvisoSonoro(avisos.map(a=>({...a,push:{aparelhos:1}})),{uid:'eu',inicio:100,conhecidos}),null);
});
test('batch arrivals play once for the latest incoming notice, with mixed numeric ids deduplicated', () => {
  const conhecidos = new Set(['1']);
  const avisos=[{id:1,de:'outro',criadoEm:130},{id:2,de:'outro',criadoEm:120},{id:3,de:'outro',criadoEm:140}];
  assert.equal(novoAvisoSonoro(avisos,{uid:'eu',inicio:100,conhecidos}).id,3);
  assert.equal(novoAvisoSonoro(avisos,{uid:'eu',inicio:100,conhecidos}),null);
});

test('audio waits for a gesture, plays when visible, and mute survives blocked storage', async () => {
  const originais = Object.fromEntries(['window','document','localStorage'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis,k)]));
  let criados = 0, iniciados = 0;
  class Audio {
    state = 'suspended'; currentTime = 0; destination = {};
    constructor() { criados++; }
    addEventListener() {}
    async resume() { this.state = 'running'; }
    createOscillator() { return {frequency:{},connect(){},disconnect(){},start(){iniciados++;},stop(){}}; }
    createGain() { return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}; }
  }
  try {
    globalThis.window = {webkitAudioContext:Audio};
    globalThis.document = {visibilityState:'visible'};
    globalThis.localStorage = {getItem(){throw new Error('bloqueado');},setItem(){throw new Error('bloqueado');}};
    const som = await import('../src/lib/somAvisos.js?teste-audio');
    assert.equal(som.tocarSomAviso(),false);
    assert.equal(criados,0);
    assert.equal(await som.liberarSomAvisos(),true);
    assert.equal(som.tocarSomAviso(),true);
    assert.equal(iniciados,2);
    document.visibilityState = 'hidden';
    assert.equal(som.tocarSomAviso(),false);
    assert.equal(iniciados,2);
    document.visibilityState = 'visible';
    await som.definirSomAvisos(false);
    assert.equal(som.estadoSomAvisos(),'desligado');
    assert.equal(som.tocarSomAviso({teste:true}),false);
    await som.definirSomAvisos(true);
    assert.equal(som.tocarSomAviso({teste:true}),true);
    assert.equal(iniciados,4);
  } finally {
    for (const [k,d] of Object.entries(originais)) { if (d) Object.defineProperty(globalThis,k,d); else delete globalThis[k]; }
  }
});
