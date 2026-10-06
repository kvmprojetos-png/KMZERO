import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {Simulate} from 'react-dom/test-utils';

// Exercise the real UI with a fake signed-in identity and provider boundary.
// No Firebase initialization, credentials, network or diary writes in these tests.
const fonte=(await readFile(new URL('../src/components/DiarioAssistido.jsx',import.meta.url),'utf8'))
  .replace("from 'react';",`from '${import.meta.resolve('react')}';`)
  .replace("import {auth} from '../firebase.js';","const auth={currentUser:{getIdToken:async()=> 'fake-token'}};")
  .replace("from '../theme.js';",`from '${new URL('../src/theme.js',import.meta.url).href}';`);
const compilado=await transform(fonte,{loader:'jsx',format:'esm',jsxFactory:'React.createElement',banner:`import React from '${import.meta.resolve('react')}';`});
const {DiarioAssistido}=await import(`data:text/javascript;base64,${Buffer.from(compilado.code).toString('base64')}`);
const RELATO='Relato fictício: executados 12 metros de alvenaria. Concretagem ainda não executada.';
const DRAFT={texto:'Serviços relatados: 12 metros de alvenaria. Concretagem ainda não executada.',conferir:['Confirmar a data.']};

async function tela(post=async()=>({ok:true,json:async()=>({rascunho:DRAFT})})) {
  const dom=new JSDOM('<div id="root"></div>',{url:'https://exemplo.invalid'});
  const anteriores=new Map(['window','document','HTMLElement','IS_REACT_ACT_ENVIRONMENT','fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
  const envios=[],aplicados=[],ocupados=[];
  globalThis.fetch=async(url,opts)=>{if(opts.method==='GET')return {ok:true,json:async()=>({configurado:true})};envios.push({url,opts});return post(url,opts);};
  const root=createRoot(document.getElementById('root'));
  const props={empresaId:'empresa-ficticia',obraId:42,texto:RELATO,onAplicar:t=>aplicados.push(t),onOcupado:v=>ocupados.push(v)};
  const render=async p=>{await act(async()=>root.render(React.createElement(DiarioAssistido,{...props,...p})));};
  await render();
  const botao=nome=>[...document.querySelectorAll('button')].find(b=>b.textContent===nome);
  const clique=async el=>{assert.ok(el);await act(async()=>el.click());};
  const fechar=async()=>{await act(async()=>root.unmount());dom.window.close();for(const[k,d]of anteriores){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}};
  return {envios,aplicados,ocupados,render,botao,clique,fechar};
}

test('diary UI requires specific consent, human review and explicit application without auto-save',async()=>{
  const t=await tela();try {
    assert.equal(t.botao('Organizar com IA').disabled,true);
    await t.clique(document.querySelector('input[type="checkbox"]'));assert.equal(t.envios.length,0);
    await t.clique(t.botao('Organizar com IA'));
    assert.equal(t.envios.length,1);assert.deepEqual(JSON.parse(t.envios[0].opts.body),{empresaId:'empresa-ficticia',obraId:'42',relato:RELATO,consentimento:true});
    assert.deepEqual(t.aplicados,[]);assert.equal(t.botao('Usar texto revisado no diário').disabled,true);
    await t.clique(document.querySelectorAll('input[type="checkbox"]')[1]);
    const rascunho=document.querySelector('textarea');
    await act(async()=>{rascunho.value='Rascunho editado pelo autor';Simulate.change(rascunho);});
    assert.equal(t.botao('Usar texto revisado no diário').disabled,true,'editing invalidates previous review');
    await t.clique(document.querySelectorAll('input[type="checkbox"]')[1]);
    await t.clique(t.botao('Usar texto revisado no diário'));assert.deepEqual(t.aplicados,['Rascunho editado pelo autor']);
    assert.equal(t.envios.length,1,'applying a draft sends no additional request or save');
  } finally {await t.fechar();}
});

test('provider failure preserves source and lets the author continue without applying a draft',async()=>{
  const t=await tela(async()=>({ok:false,json:async()=>({erro:'A IA falhou. Seu relato foi preservado.'})}));try {
    await t.clique(document.querySelector('input[type="checkbox"]'));await t.clique(t.botao('Organizar com IA'));
    assert.match(document.querySelector('[role="alert"]').textContent,/preservado/);
    assert.equal(document.querySelector('textarea'),null);assert.deepEqual(t.aplicados,[]);
    assert.equal(JSON.parse(t.envios[0].opts.body).relato,RELATO);assert.equal(t.ocupados.at(-1),false);
  } finally {await t.fechar();}
});

test('changing work cancels an in-flight draft and requires new consent; stale results cannot be applied',async()=>{
  let completar;
  const t=await tela(()=>new Promise(resolve=>{completar=resolve;}));try {
    await t.clique(document.querySelector('input[type="checkbox"]'));await t.clique(t.botao('Organizar com IA'));
    assert.equal(t.ocupados.at(-1),true);assert.ok(completar);
    await t.render({obraId:43,texto:'Novo relato fictício de outra obra.'});
    assert.equal(t.envios[0].opts.signal.aborted,true);assert.equal(document.querySelector('input[type="checkbox"]').checked,false);
    await act(async()=>completar({ok:true,json:async()=>({rascunho:DRAFT})}));
    assert.equal(document.querySelector('textarea'),null);assert.deepEqual(t.aplicados,[]);assert.equal(t.ocupados.at(-1),false);
  } finally {await t.fechar();}
});
