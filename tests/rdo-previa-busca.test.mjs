import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build,transform} from 'esbuild';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';

// Prévia do RDO (pedido do dono: "pré visualização e pesquisa pelo rdo de algum dia").
// Componente real compilado com esbuild e desenhado no jsdom; dados fictícios, sem Firebase nem rede.
const reactUrl=import.meta.resolve('react');
const saida=await build({entryPoints:[fileURLToPath(new URL('../src/components/PreviaRDO.jsx',import.meta.url))],bundle:true,write:false,format:'esm',
  loader:{'.jsx':'jsx','.js':'jsx'},jsx:'transform',jsxFactory:'React.createElement',external:['react'],banner:{js:`import React from '${reactUrl}';`},logLevel:'silent'});
const codigo=saida.outputFiles[0].text.replace(/from\s*["']react["']/g,`from '${reactUrl}'`);
const M=await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`);

const OBRAS=[{id:1,nome:'Obra Fictícia A'},{id:'2',nome:'Obra Fictícia B'}];
const TRAB=[{id:11,nome:'Ana Teste',obraId:1},{id:12,nome:'Bruno Teste',obraId:1},{id:13,nome:'Caio Teste',obraId:1}];
const RDO={id:900,numero:7,obraId:1,data:'05/10/2026',dataIso:'2026-10-05',encarregado:'Encarregado Fictício',clima:'Nublado',
  observacoes:'Alvenaria do bloco B.\n\nRelato do encarregado: Hoje levantamos a parede do fundo.',relatoDia:'Hoje levantamos a parede do fundo.',totalHE:1.5,
  presencas:{11:'Presente',12:'Presente',13:'Falta'},
  alimentacao:{11:{cafeManha:true,cafeTarde:true,marmita:true},12:{cafeManha:true},13:{cafeManha:true}},
  fotos:['data:image/png;base64,AAAA','data:image/png;base64,BBBB']};
const DIARIO=[{id:1,obraId:1,data:'05/10/2026',autor:'Encarregado Fictício',texto:'Chuva às 15h.',ts:1}, {id:2,obraId:1,data:'06/10/2026',texto:'Outro dia'}, {id:3,obraId:'2',data:'05/10/2026',texto:'Outra obra'}];

test('busca por dia compara dataIso e data DD/MM/AAAA, com e sem obra escolhida',()=>{
  const rdos=[RDO,{id:901,numero:3,obraId:'2',data:'05/10/2026'},{id:902,numero:8,obraId:1,data:'06/10/2026'},{id:903,numero:2,obraId:1,dataIso:'2026-10-04',data:'04/10/2026'}];
  assert.deepEqual(M.buscarRDOsDoDia(rdos,'2026-10-05').map(r=>r.id),[900,901]);
  assert.deepEqual(M.buscarRDOsDoDia(rdos,'2026-10-05','2').map(r=>r.id),[901],'obra como texto do <select> casa com id numérico ou texto');
  assert.deepEqual(M.buscarRDOsDoDia(rdos,'2026-10-05',1).map(r=>r.id),[900]);
  assert.deepEqual(M.buscarRDOsDoDia(rdos,''),[]);
  assert.equal(M.isoDoRDO({data:'5/9/2026'}),'2026-09-05');
  assert.equal(M.dataBRDeIso('2026-10-05'),'05/10/2026');
});

test('resumo: presentes/faltas com nomes, horas extras, refeições em quantidade e ocorrências do mesmo dia e obra',()=>{
  const s=M.resumoRDO({rdo:RDO,trabalhadores:TRAB,diario:DIARIO});
  assert.deepEqual(s.presentes,['Ana Teste','Bruno Teste']);assert.deepEqual(s.faltas,['Caio Teste']);
  assert.equal(s.totalHE,1.5);assert.equal(s.dataBR,'05/10/2026');
  assert.deepEqual(s.refeicoes.map(x=>[x.chave,x.qtd]),[['cafeManha',2],['cafeTarde',1],['marmita',1]],'só quem estava presente conta');
  assert.deepEqual(s.ocorrencias.map(o=>o.id),[1]);
  assert.equal(s.totalFotos,2);
  const semTotal=M.resumoRDO({rdo:{...RDO,totalHE:undefined,horasTrabalhadas:{11:10.5,12:9,13:12}},trabalhadores:TRAB});
  assert.equal(semTotal.totalHE,1.5,'RDO antigo sem total: soma o que passou de 9 h dos presentes');
  assert.equal(semTotal.ocorrencias,null,'sem diário informado não mostra a seção');
  const nuvem=M.resumoRDO({rdo:{...RDO,fotos:undefined,qtdFotosNaGaleria:3},fotosObras:[{obraId:1,data:'05/10/2026',fotoUrl:'https://exemplo.invalid/f.jpg'},{obraId:1,data:'05/10/2026',fotoPath:'x'},{obraId:'2',data:'05/10/2026',foto:'data:x'}]});
  assert.deepEqual(nuvem.miniaturas,['https://exemplo.invalid/f.jpg']);assert.equal(nuvem.totalFotos,3);
});

async function desenhar(props){
  const dom=new JSDOM('<div id="root"></div>',{url:'https://exemplo.invalid'});
  const anteriores=new Map(['window','document','HTMLElement','IS_REACT_ACT_ENVIRONMENT'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
  const root=createRoot(document.getElementById('root'));
  await act(async()=>root.render(React.createElement(M.PreviaRDO,props)));
  const fechar=async()=>{await act(async()=>root.unmount());dom.window.close();for(const[k,d]of anteriores){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}};
  return {texto:()=>document.body.textContent,fechar};
}

test('prévia mostra o RDO sem preço e o botão leva ao RDO completo',async()=>{
  const abertos=[];let fechou=0;
  const t=await desenhar({rdo:RDO,obras:OBRAS,trabalhadores:TRAB,diario:DIARIO,onClose:()=>fechou++,onAbrirCompleto:r=>abertos.push(r.id)});
  try{
    const tx=t.texto();
    for(const esperado of ['RDO Nº 007','05/10/2026','Obra Fictícia A','Encarregado Fictício','Nublado','Ana Teste, Bruno Teste','Caio Teste','1,5 h','Hoje levantamos a parede do fundo.','Alvenaria do bloco B.','Chuva às 15h.','Café da manhã: 2','Marmita: 1'])
      assert.ok(tx.includes(esperado),`faltou "${esperado}"`);
    assert.ok(!/R\$/.test(tx),'refeições sem preço');
    assert.ok(!tx.includes('Outra obra')&&!tx.includes('Outro dia'));
    assert.equal(document.querySelectorAll('img').length,2);
    const botao=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Abrir RDO completo'));
    await act(async()=>botao.click());assert.deepEqual(abertos,[900]);
    const x=[...document.querySelectorAll('button')].find(b=>b.textContent==='✕');await act(async()=>x.click());assert.equal(fechou,1);
  }finally{await t.fechar();}
});

test('sem permissão para a tela de RDO não há botão; refeições podem ficar escondidas',async()=>{
  const t=await desenhar({rdo:RDO,obras:OBRAS,trabalhadores:TRAB,mostrarRefeicoes:false,onClose:()=>{}});
  try{
    assert.ok(!t.texto().includes('Abrir RDO completo'));
    assert.ok(!t.texto().includes('Refeições'));
  }finally{await t.fechar();}
});

test('Painel e tela de RDO: busca por dia e prévia ligadas, agrupamento por obra mantido',async()=>{
  const home=await readFile(new URL('../src/screens/home.jsx',import.meta.url),'utf8');
  const rdo=await readFile(new URL('../src/screens/rdo.jsx',import.meta.url),'utf8');
  const app=await readFile(new URL('../src/KMZeroApp.jsx',import.meta.url),'utf8');
  for(const [nome,fonte] of [['home',home],['rdo',rdo]]) await transform(fonte,{loader:'jsx'}).catch(e=>assert.fail(`${nome}.jsx não compila: ${e.message}`));
  assert.match(home,/rdosPorObra\.map\(g =>/,'Painel continua agrupado por obra');
  assert.match(home,/Buscar RDO do dia[\s\S]{0,200}type="date"/);
  assert.match(home,/buscarRDOsDoDia\(rdosEmitidos, buscaDiaRdo, buscaObraRdo\)/);
  assert.match(home,/onClick=\{\(\) => setRdoPrevia\(r\)\}/,'tocar no RDO abre a prévia');
  assert.match(home,/onAbrirCompleto=\{pode\("rdo"\) \? r => \{ setRdoPrevia\(null\); onNav\("rdo", \{ obraId: r\.obraId, dia: isoDoRDO\(r\) \}\); \}/);
  assert.match(app,/case \"rdo\":[^\n]*obraInicialId=\{contextoTela\.obraId\} diaInicial=\{contextoTela\.dia\}/);
  assert.match(rdo,/useState\(diaValido\)/,'abre já buscando o dia do RDO');
  assert.match(app,/<TelaPainelGestor[^\n]*diario=\{diario\}/);
  assert.match(rdo,/Buscar RDO do dia[\s\S]{0,200}type="date"/);
  assert.match(rdo,/rdosObra\.filter\(r => _isoRDO\(r\) === buscaDia\)/,'busca soma ao filtro de obra');
  assert.match(rdo,/👁️ Prévia/);
  assert.match(rdo,/onAbrirCompleto=\{r => \{[\s\S]{0,200}baixarRDO\(r\)/);
});

test('prévia mostra o relato falado uma vez só (sem repetir nas observações nem o resumo automático)',async()=>{
  const relato='Concretagem da laje do 2º pavimento e desforma do bloco C.';
  const resumo='Relatório gerado automaticamente ao finalizar o dia. 3 presente(s), 0 falta(s). 2 foto(s) registrada(s).';
  const s=M.resumoRDO({rdo:{...RDO,relatoDia:relato,observacoes:relato+'\n\n'+resumo}});
  assert.equal(s.relato,relato);assert.equal(s.observacoes,'');
  const g=M.resumoRDO({rdo:{...RDO,relatoDia:relato,observacoes:'Visita da fiscalização.\n\nRelato do encarregado: '+relato}});
  assert.equal(g.relato,relato);assert.equal(g.observacoes,'Visita da fiscalização.');
  // escritório corrigiu o texto nas observações: vale o corrigido (como no PDF), sem a versão velha ao lado
  const e=M.resumoRDO({rdo:{...RDO,relatoDia:relato,observacoes:'Concretagem da laje do 2º pavimento (corrigido).'}});
  assert.equal(e.relato,'');assert.equal(e.observacoes,'Concretagem da laje do 2º pavimento (corrigido).');
  const t=await desenhar({rdo:{...RDO,relatoDia:relato,observacoes:relato+'\n\n'+resumo},obras:OBRAS,trabalhadores:TRAB,onClose:()=>{}});
  try{
    const tx=t.texto();
    assert.equal(tx.split(relato).length-1,1,'relato aparece uma vez');
    assert.ok(!tx.includes('Relatório gerado automaticamente'));
  }finally{await t.fechar();}
});
