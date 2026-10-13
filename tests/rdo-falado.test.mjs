import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';

// RDO falado: botão de ditado (fala vira texto), relato obrigatório em dia trabalhado e mescla no RDO do dia.
// Sem Firebase, sem rede: o reconhecimento de voz é falso e controlado pelo teste.
const fonte=(await readFile(new URL('../src/components/BotaoDitado.jsx',import.meta.url),'utf8'))
  .replace('from "react";',`from '${import.meta.resolve('react')}';`)
  .replace('from "../theme.js";',`from '${new URL('../src/theme.js',import.meta.url).href}';`);
const compilado=await transform(fonte,{loader:'jsx',format:'esm',jsxFactory:'React.createElement',jsxFragment:'React.Fragment',banner:`import React from '${import.meta.resolve('react')}';`});
const M=await import(`data:text/javascript;base64,${Buffer.from(compilado.code).toString('base64')}`);
const presenca=await readFile(new URL('../src/screens/presenca.jsx',import.meta.url),'utf8');

const RESUMO='Relatório gerado automaticamente ao finalizar o dia. 3 presente(s), 0 falta(s). 0 foto(s) registrada(s).';

test('relato obrigatório só com presentes e com pelo menos 20 letras',()=>{
  assert.equal(M.RELATO_MINIMO,20);
  assert.equal(M.relatoObrigatorio(0),false);assert.equal(M.relatoObrigatorio(1),true);
  assert.equal(M.relatoSuficiente('   curto   '),false);
  assert.equal(M.relatoSuficiente('x'.repeat(19)),false);assert.equal(M.relatoSuficiente(' '+'x'.repeat(20)+' '),true);
});

test('observações do RDO = relato + resumo automático; mescla respeita o que o gestor escreveu',()=>{
  const relato='Assentamos 40 m² de piso no bloco B.';
  const nova=M.montarObservacoesRelato('  '+relato+' ',RESUMO);
  assert.equal(nova,relato+'\n\n'+RESUMO);
  assert.equal(M.montarObservacoesRelato('',RESUMO),RESUMO,'sem relato: só o resumo (dia sem presentes)');
  // vazio ou só o resumo automático: usa as novas
  assert.equal(M.mesclarObservacoesRelato('',nova,relato),nova);
  assert.equal(M.mesclarObservacoesRelato(undefined,nova,relato),nova);
  assert.equal(M.mesclarObservacoesRelato(RESUMO,nova,relato),nova);
  // escritas pelo gestor: mantém e acrescenta o relato uma vez só
  const gestor='Visita da fiscalização às 10h.';
  const m1=M.mesclarObservacoesRelato(gestor,nova,relato);
  assert.equal(m1,gestor+'\n\nRelato do encarregado: '+relato);
  assert.equal(M.mesclarObservacoesRelato(m1,nova,relato),m1,'não duplica se já estiver contido');
  assert.equal(M.mesclarObservacoesRelato(gestor,RESUMO,''),gestor,'sem relato não mexe');
});

class FalsoReconhecimento {
  static ultimo=null;
  constructor(){FalsoReconhecimento.ultimo=this;this.parado=false;}
  start(){this.iniciado=true;}
  stop(){this.parado=true;this.onend?.();}
  abort(){this.abortado=true;}
}
const resultado=(trechos)=>({resultIndex:0,results:trechos.map(([t,fim])=>Object.assign([{transcript:t}],{isFinal:fim}))});

async function montar(props,{suporte=true}={}) {
  const dom=new JSDOM('<div id="root"></div>',{url:'https://exemplo.invalid'});
  const anteriores=new Map(['window','document','HTMLElement','IS_REACT_ACT_ENVIRONMENT'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  if (suporte) dom.window.webkitSpeechRecognition=FalsoReconhecimento;
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
  const root=createRoot(document.getElementById('root'));
  const render=async p=>{await act(async()=>root.render(React.createElement(M.BotaoDitado,{...props,...p})));};
  await render();
  const botao=()=>document.querySelector('button');
  const fechar=async()=>{await act(async()=>root.unmount());dom.window.close();for(const[k,d]of anteriores){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}};
  return {render,botao,fechar};
}

test('BotaoDitado: fala em pt-BR acrescenta ao texto, mostra estado e para',async()=>{
  const textos=[],gravando=[];let iniciou=0;
  const t=await montar({texto:'Relato anterior.',onTexto:v=>textos.push(v),onGravando:v=>gravando.push(v),onIniciar:()=>iniciou++});
  try {
    assert.equal(t.botao().textContent,'🎤 Falar');
    await act(async()=>t.botao().click());
    const rec=FalsoReconhecimento.ultimo;
    assert.equal(rec.lang,'pt-BR');assert.equal(rec.continuous,true);assert.equal(rec.iniciado,true);
    assert.deepEqual(gravando,[true]);assert.equal(iniciou,1);
    assert.match(t.botao().textContent,/Parar/);
    assert.match(document.querySelector('[role="status"]').textContent,/Ouvindo/);
    await act(async()=>rec.onresult(resultado([['concretamos a laje',true],[' e o',false]])));
    assert.equal(textos.at(-1),'Relato anterior. concretamos a laje  e o');
    await act(async()=>t.botao().click());
    assert.equal(rec.parado,true);assert.deepEqual(gravando,[true,false]);
    assert.equal(t.botao().textContent,'🎤 Falar');
  } finally {await t.fechar();}
});

test('BotaoDitado: sem suporte explica a alternativa; microfone negado preserva o texto',async()=>{
  const t=await montar({texto:'',onTexto:()=>{}},{suporte:false});
  try {
    await act(async()=>t.botao().click());
    assert.match(document.querySelector('[role="alert"]').textContent,/Use o microfone do teclado do celular ou escreva/);
  } finally {await t.fechar();}
  const gravando=[];
  const t2=await montar({texto:'abc',onTexto:()=>{},onGravando:v=>gravando.push(v)});
  try {
    await act(async()=>t2.botao().click());
    await act(async()=>FalsoReconhecimento.ultimo.onerror({error:'not-allowed'}));
    assert.match(document.querySelector('[role="alert"]').textContent,/Permita o microfone/);
    assert.deepEqual(gravando,[true,false]);
  } finally {await t2.fechar();}
  const t3=await montar({texto:'',onTexto:()=>{},disabled:true});
  try {assert.equal(t3.botao().disabled,true);} finally {await t3.fechar();}
});

test('Finalizar Dia: relato com ditado, IA opcional, trava em dia trabalhado, rascunho e gravação no RDO',()=>{
  const fluxo=presenca.slice(presenca.indexOf('export function FluxoEncarregado'),presenca.indexOf('export function TelaCalendario'));
  assert.match(fluxo,/🗣️ RELATO DO DIA/);
  assert.match(fluxo,/<BotaoDitado texto=\{relato\} onTexto=\{setRelato\}/);
  assert.match(fluxo,/<DiarioAssistido empresaId=\{empresaIdRelato\} obraId=\{obra\.id\} texto=\{relato\} demo=\{demoRelato\}[^>]*onAplicar=\{t => \{ setRelato\(t\)/);
  assert.match(fluxo,/const bloqueado = gravandoRelato \|\| ocupadoIARelato \|\| \(relatoObrigatorio\(presentes\) && !relatoSuficiente\(relato\)\)/);
  assert.match(fluxo,/<Btn label="FINALIZAR DIA" color=\{bloqueado \? "#ccc" : GREEN\} disabled=\{bloqueado\}/);
  assert.match(fluxo,/store\.get\("_rascunhoRelato"\)/);
  assert.match(fluxo,/mesmoId\(r\.obraId, obra\.id\) && r\.dataIso === hojeStr\(\)/);
  assert.match(fluxo,/store\.set\("_rascunhoRelato", relato\.trim\(\) \? \{ obraId: normId\(obra\.id\), dataIso: hojeStr\(\), texto: relato \} : null\)/);
  assert.match(fluxo,/onAutoEmitirRDO\(rdo\);\r?\n\s*\/\/ Dia fechado[^\n]*\r?\n\s*rascunhoRelatoPronto\.current = false;\r?\n\s*store\.set\("_rascunhoRelato", null\)/);
  assert.match(fluxo,/observacoes: montarObservacoesRelato\(relatoLimpo, `Relatório gerado automaticamente/);
  assert.match(fluxo,/relatoDia: relatoLimpo,/);
  assert.match(fluxo,/const obsMescladas = mesclarObservacoesRelato\(rdoExistente\.observacoes, rdoNovo\.observacoes, relatoLimpo, rdoExistente\.relatoDia, rdoExistente\.observacoesGeradas\)/);
  assert.match(fluxo,/observacoesGeradas: obsMescladas === rdoNovo\.observacoes \? obsMescladas : null/);
  assert.match(fluxo,/rdoNovo\.observacoesGeradas = rdoNovo\.observacoes;/);
  // dia já fechado e sem rascunho: o campo volta com o relato salvo no RDO de hoje desta obra
  assert.match(fluxo,/rdosDoDiaObra\(rdosEmitidos, obra\.id, hojeStr\(\)\)\[0\]\?\.relatoDia/);
  assert.match(fluxo,/relatoDia: relatoLimpo \|\| rdoExistente\.relatoDia/);
  // café continua indo ao RDO (só a tela esconde para o encarregado)
  assert.match(fluxo,/alimentacao: \{ \.\.\.alimentacao \}/);
});

test('Diário de Obra usa o mesmo BotaoDitado sem mudar rótulos nem mensagens',()=>{
  const diario=presenca.slice(presenca.indexOf('export function TelaDiario'));
  assert.doesNotMatch(presenca,/SpeechRecognition/,'lógica de voz só no componente');
  assert.match(diario,/<BotaoDitado texto=\{texto\} onTexto=\{setTexto\} disabled=\{ocupadoIA \|\| salvando\} onGravando=\{setGravando\}/);
  assert.match(diario,/rotuloFalar="🎤 Ditar por Voz" rotuloParar="⏹️ Parar Gravação \(gravando\.\.\.\)"/);
  assert.match(diario,/escreva o relato e depois organize com IA\./);
});

test('fechar o mesmo dia de novo: troca o relato anterior e refaz o resumo com os números atuais',()=>{
  const A='Concretagem da laje do bloco A.';
  const B='Concretagem da laje do bloco A. Tarde: reboco da fachada.';
  const resumo12h='Relatório gerado automaticamente ao finalizar o dia. 5 presente(s), 0 falta(s). 0 foto(s) registrada(s).';
  const resumo17h='Relatório gerado automaticamente ao finalizar o dia. 7 presente(s), 0 falta(s). 3 foto(s) registrada(s).';
  const obs12h=M.montarObservacoesRelato(A,resumo12h);
  const nova=M.montarObservacoesRelato(B,resumo17h);
  assert.equal(M.mesclarObservacoesRelato(obs12h,nova,B,A,obs12h),nova,'texto que o sistema gerou (ninguém mexeu) é refeito com o relato e os números novos');
  assert.equal(M.mesclarObservacoesRelato(resumo12h,nova,B,''),nova,'resumo antigo de uma linha é refeito');
  // observações do gestor + relato anterior: troca só o relato, não acumula
  const gestor='Visita da fiscalização às 10h.';
  const m1=M.mesclarObservacoesRelato(gestor,M.montarObservacoesRelato(A,resumo12h),A,'');
  assert.equal(m1,gestor+'\n\nRelato do encarregado: '+A);
  const m2=M.mesclarObservacoesRelato(m1,nova,B,A);
  assert.equal(m2,gestor+'\n\nRelato do encarregado: '+B);
  assert.equal(m2.split('Relato do encarregado:').length,2,'um relato só');
  // gestor editou o texto: mantém e acrescenta
  const editado='Texto revisto pelo escritório.';
  assert.equal(M.mesclarObservacoesRelato(editado,nova,B,A),editado+'\n\nRelato do encarregado: '+B);
  // Revisão: gestor acrescentou nota DEPOIS do resumo automático — refechar o dia não pode apagar a nota
  const comNota=obs12h+'\n\nFiscal pediu refazer a armadura da viga V3.';
  assert.equal(M.mesclarObservacoesRelato(comNota,nova,A,A,obs12h),comNota,'relato igual: nada muda');
  const r2=M.mesclarObservacoesRelato(comNota,nova,B,A,obs12h);
  assert.ok(r2.includes('Fiscal pediu refazer a armadura da viga V3.'),'nota do gestor fica');
  assert.ok(r2.endsWith('Relato do encarregado: '+B),'relato novo acrescentado');
  // Revisão: gestor corrigiu o relato dentro das observações; encarregado refecha com o mesmo relato — não duplica
  const corrigido=obs12h.replace('bloco A','bloco A (corrigido)');
  assert.equal(M.mesclarObservacoesRelato(corrigido,M.montarObservacoesRelato(A,resumo17h),A,A,obs12h),corrigido);
});

test('BotaoDitado: sair da tela no meio do ditado avisa o pai que parou (FINALIZAR DIA não fica travado)',async()=>{
  const gravando=[];
  const t=await montar({texto:'',onTexto:()=>{},onGravando:v=>gravando.push(v)});
  await act(async()=>t.botao().click());
  const rec=FalsoReconhecimento.ultimo;
  assert.deepEqual(gravando,[true]);
  await t.fechar();
  assert.equal(rec.abortado,true);
  assert.equal(gravando.at(-1),false);
});
