import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {criarNavegacao,useNavegacao} from '../src/lib/navegacao.js';

function fixture(){
  const dom=new JSDOM('',{url:'https://exemplo.invalid/app/'});
  dom.window.history.replaceState({preservar:true},'');
  const nav=criarNavegacao({janela:dom.window,raiz:()=> 'gestor'}),fim=nav.iniciar();
  nav.setTela('gestor');
  return {dom,nav,fechar(){fim();dom.window.close();}};
}
async function mover(janela,acao){
  const evento=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{janela.removeEventListener('popstate',receber);reject(new Error('Navegação sem popstate'));},1000);
    function receber(e){clearTimeout(timer);resolve(e);}janela.addEventListener('popstate',receber,{once:true});
  });
  acao();await evento;
}

test('browser and app back each return one step, preserving work details and forward navigation',async()=>{
  const f=fixture();try {
    f.nav.setTela('obras');f.nav.setContexto({obraId:42});f.nav.setTela('cronograma',{obraId:42});
    await mover(f.dom.window,()=>f.dom.window.history.back());
    assert.deepEqual(f.nav.getSnapshot(),{tela:'obras',contexto:{obraId:42}});
    await mover(f.dom.window,()=>f.dom.window.history.forward());assert.equal(f.nav.getSnapshot().tela,'cronograma');
    await mover(f.dom.window,()=>f.nav.voltar());assert.deepEqual(f.nav.getSnapshot(),{tela:'obras',contexto:{obraId:42}});
    await mover(f.dom.window,()=>f.nav.voltar());assert.deepEqual(f.nav.getSnapshot(),{tela:'obras',contexto:{}});
    await mover(f.dom.window,()=>f.nav.voltar());assert.equal(f.nav.getSnapshot().tela,'gestor');
    assert.equal(f.dom.window.location.pathname,'/app/');
  } finally {f.fechar();}
});

test('same destination and rapid back clicks never duplicate a screen or skip multiple steps',async()=>{
  const f=fixture();try {
    f.nav.setTela('obras');f.nav.setTela('obras');f.nav.setTela('pedidos');
    await mover(f.dom.window,()=>{f.nav.voltar();f.nav.voltar();});assert.equal(f.nav.getSnapshot().tela,'obras');
    await mover(f.dom.window,()=>f.nav.voltar());assert.equal(f.nav.getSnapshot().tela,'gestor');
    f.nav.voltar();assert.equal(f.nav.getSnapshot().tela,'gestor');
  } finally {f.fechar();}
});

test('visiting the dashboard is a normal step and a new branch replaces the old forward route',async()=>{
  const f=fixture();try {
    f.nav.setTela('obras');f.nav.setTela('gestor');f.nav.setTela('equipe');
    await mover(f.dom.window,()=>f.nav.voltar());assert.equal(f.nav.getSnapshot().tela,'gestor');
    await mover(f.dom.window,()=>f.nav.voltar());assert.equal(f.nav.getSnapshot().tela,'obras');
    f.nav.setTela('galeria');
    await mover(f.dom.window,()=>f.nav.voltar());assert.equal(f.nav.getSnapshot().tela,'obras');
    await mover(f.dom.window,()=>f.dom.window.history.forward());assert.equal(f.nav.getSnapshot().tela,'galeria');
  } finally {f.fechar();}
});

test('clearing history drops previous account/work context and browser metadata contains no business data',async()=>{
  const f=fixture();try {
    f.nav.setTela('obras');f.nav.setContexto({obraId:'obra-antiga'});f.nav.setTela('cronograma');
    const marker=f.dom.window.history.state.kmzeroNavegacao;
    assert.deepEqual(Object.keys(marker).sort(),['posicao','sessao']);assert.equal(f.dom.window.history.state.preservar,true);
    assert.doesNotMatch(JSON.stringify(f.dom.window.history.state),/obra-antiga|cronograma/);
    f.nav.setTelaRaw('gestor');
    await mover(f.dom.window,()=>f.dom.window.history.back());assert.deepEqual(f.nav.getSnapshot(),{tela:'gestor',contexto:{}});
    f.nav.setContexto({obraId:99});f.nav.limparHistorico();assert.deepEqual(f.nav.getSnapshot().contexto,{});
  } finally {f.fechar();}
});

test('local navigation still returns one step if browser History cannot write',()=>{
  const janela={history:{state:null,pushState(){throw new Error('disabled');},replaceState(){throw new Error('disabled');}},addEventListener(){},removeEventListener(){}};
  const nav=criarNavegacao({janela,raiz:()=> 'home'}),fim=nav.iniciar();
  nav.setTela('home');nav.setTela('diario');nav.setTela('fotos_solo');nav.voltar();assert.equal(nav.getSnapshot().tela,'diario');nav.voltar();assert.equal(nav.getSnapshot().tela,'home');fim();
});

test('React StrictMode records each navigation once and back does not replay a state updater',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://exemplo.invalid/app/'});
  const anteriores=new Map(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
  let nav;function Harness(){nav=useNavegacao();nav.setRaiz(()=> 'gestor');return React.createElement('output',null,nav.tela);}
  const root=createRoot(document.getElementById('root'));
  try {
    await act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Harness))));
    await act(async()=>nav.setTela('gestor'));await act(async()=>nav.setTela('obras'));await act(async()=>nav.setTela('pedidos'));
    await act(async()=>mover(dom.window,()=>nav.voltar()));assert.equal(document.querySelector('output').textContent,'obras');
    await act(async()=>mover(dom.window,()=>nav.voltar()));assert.equal(document.querySelector('output').textContent,'gestor');
  } finally {
    await act(async()=>root.unmount());dom.window.close();
    for(const[k,d]of anteriores){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
  }
});
