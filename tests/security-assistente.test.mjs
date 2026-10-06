import test from 'node:test';
import assert from 'node:assert/strict';
import handler, {tratarAssistente} from '../api/assistente.js';
import {analisarComGroq,reservarAnalise,ErroAssistente} from '../api/_lib/assistenteObras.js';

const TOKEN='a.b.c';
const req=(body={empresaId:'empresa-a',obraId:'42',modo:'resumo',consentimento:true},method='POST')=>({method,headers:{authorization:`Bearer ${TOKEN}`},body,query:body});
const res=()=>({code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(j){this.body=j;return this;}});
function fixture(perfil={},authCode) {
  const registros=new Map([
    ['usuarios/eu',{empresaId:'empresa-a',perfil:'gestor',ativo:true,...perfil}],
    ['empresas/empresa-a/obras/42',{nome:'Obra teste',status:'Ativa',tipo:'Reforma',valorContrato:999999,cliente:'PRIVADO',local:'ENDERECO_PRIVADO'}],
    ['empresas/empresa-a/obrasCampo/42',{nome:'Obra teste',status:'Ativa',local:'ENDERECO_PRIVADO'}],
    ['empresas/empresa-a/cronogramas/42',{obraId:42,etapas:[{nome:'Alvenaria',fim:'2026-10-01',progresso:30,custo:1234},{nome:'Pintura',fim:'2026-02-31',progresso:''}]}],
    ['empresas/empresa-a/pedidos/p1',{obraId:42,status:'Aguardando',enc:'PESSOA_PRIVADA',itens:[{material:'SEGREDO'}]}],
    ['empresas/empresa-a/pedidos/p2',{obraId:'42',status:'Aprovado',valor:7654}],
    ['empresas/empresa-a/pedidos/outra',{obraId:'43',status:'Aguardando'}],
  ]);
  const estado={leituras:[],escritas:[],envios:[],revogado:false};
  const snap=path=>({id:path.split('/').at(-1),exists:registros.has(path),data:()=>registros.get(path)});
  const doc=path=>({path,collection:n=>col(`${path}/${n}`),async get(){estado.leituras.push(path);return snap(path);}});
  const col=(path,filtros=[],max=Infinity)=>({doc:id=>doc(`${path}/${id}`),limit:n=>col(path,filtros,n),where:(k,op,v)=>col(path,[...filtros,[k,op,v]],max),async get(){
    estado.leituras.push(path);
    const paths=[...registros.keys()].filter(p=>p.startsWith(`${path}/`)&&!p.slice(path.length+1).includes('/'));
    return {docs:paths.filter(p=>filtros.every(([k,op,v])=>op==='in' ? v.includes(registros.get(p)[k]) : registros.get(p)[k]===v)).slice(0,max).map(snap)};
  }});
  const db={collection:col,runTransaction:fn=>fn({get:r=>r.get(),set:(r,d)=>{estado.escritas.push(r.path);registros.set(r.path,d);}})};
  const auth={async verifyIdToken(_token,revogado){estado.revogado=revogado;if(authCode)throw Object.assign(new Error('DADO_SENSIVEL'),{code:authCode});return {uid:'eu'};}};
  const fetchImpl=async(url,opts)=>{estado.envios.push({url,opts});return {ok:true,status:200,json:async()=>({choices:[{message:{content:'Rascunho de teste'},finish_reason:'stop'}]})};};
  return {admin:{db,auth},estado,registros,opcoes:{key:'fake-key',fetchImpl,agora:Date.parse('2026-10-05T15:00:00Z')}};
}

test('assistant refuses anonymous, malformed body, paths, extra context and missing consent before any services',async()=>{
  const sem=res();await handler({method:'POST',headers:{},body:{}},sem);assert.equal(sem.code,401);
  for(const body of [null,[],{empresaId:'../b'},{empresaId:'empresa-a',obraId:'a/b',modo:'resumo',consentimento:true},
    {empresaId:'empresa-a',obraId:'42',modo:'inventado',consentimento:true},
    {empresaId:'empresa-a',obraId:'42',modo:'resumo',consentimento:false},
    {empresaId:'empresa-a',obraId:'42',modo:'resumo',consentimento:true,contexto:{privado:true}}]){
    const f=fixture(),r=res();await tratarAssistente(f.admin,req(body),r,f.opcoes);
    assert.equal(r.code,400);assert.deepEqual(f.estado.leituras,[]);assert.deepEqual(f.estado.envios,[]);
  }
});
test('revoked, inactive, field, other company and unsupported office areas cannot consult or transmit works',async()=>{
  for(const [perfil,code,status] of [[{},'auth/id-token-revoked',401],[{ativo:false},null,403],[{perfil:'encarregado',obraId:42},null,403],[{empresaId:'empresa-b'},null,403],[{acessos:[]},null,403],[{acessos:['equipe','sistema']},null,403]]){
    const f=fixture(perfil,code),r=res();await tratarAssistente(f.admin,req(),r,f.opcoes);
    assert.equal(r.code,status);assert.deepEqual(f.estado.envios,[]);assert.deepEqual(f.estado.escritas,[]);
    assert.ok(f.estado.leituras.every(p=>p==='usuarios/eu'));assert.equal(f.estado.revogado,true);
  }
});
test('provider receives only selected work allowlisted facts, not HR, contracts, contacts or other work orders',async()=>{
  const f=fixture(),r=res();await tratarAssistente(f.admin,req(),r,f.opcoes);assert.equal(r.code,200);
  assert.equal(r.body.contexto.cronograma.atrasadas,1);assert.equal(r.body.contexto.cronograma.semAvancoInformado,1);
  assert.equal(r.body.contexto.cronograma.etapas[1].fim,null);assert.equal(r.body.contexto.cronograma.etapas[1].progresso,null);
  assert.equal(r.body.contexto.suprimentos.totalNaAmostra,2);
  const {url,opts}=f.estado.envios[0];assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
  assert.doesNotMatch(opts.body,/PRIVADO|PRIVADA|SEGREDO|999999|7654|1234|ENDERECO/);
  assert.ok(f.estado.escritas.every(p=>p.startsWith('_iaCotas/')));
  assert.equal(r.headers['Cache-Control'],'private, no-store');
});
test('field office area sees a work projection and schedule, but cannot leak orders; supply area cannot leak schedule',async()=>{
  for(const [areas,expected,absent] of [[['campo'],'cronograma','suprimentos'],[['suprimentos'],'suprimentos','cronograma']]){
    const f=fixture({acessos:areas}),r=res();await tratarAssistente(f.admin,req(),r,f.opcoes);assert.equal(r.code,200);
    assert.ok(r.body.contexto[expected]);assert.equal(r.body.contexto[absent],null);
    assert.ok(f.estado.leituras.includes('empresas/empresa-a/obrasCampo/42'));
    assert.ok(!f.estado.leituras.includes(`empresas/empresa-a/${absent==='cronograma'?'cronogramas/42':'pedidos'}`));
  }
});
test('missing key exposes truthful disabled status without consuming quotas or transmitting data',async()=>{
  const f=fixture(),get=res();await tratarAssistente(f.admin,req({empresaId:'empresa-a',obraId:'42'},'GET'),get,{...f.opcoes,key:''});
  assert.equal(get.code,200);assert.equal(get.body.configurado,false);assert.equal(get.body.obras.length,1);
  const post=res();await tratarAssistente(f.admin,req(),post,{...f.opcoes,key:''});assert.equal(post.code,503);
  assert.deepEqual(f.estado.escritas,[]);assert.deepEqual(f.estado.envios,[]);
});
test('quota and cooldown block repeat calls before provider; day rollover reopens quota',async()=>{
  const f=fixture(),r=res();await tratarAssistente(f.admin,req(),r,f.opcoes);assert.equal(r.code,200);
  const again=res();await tratarAssistente(f.admin,req(),again,f.opcoes);assert.equal(again.code,429);assert.equal(f.estado.envios.length,1);
  await reservarAnalise(f.admin.db,'empresa-a','eu',f.opcoes.agora+86400000);
  f.registros.set('_iaCotas/empresa_empresa-a_2026-10-05',{quantidade:20});
  await assert.rejects(reservarAnalise(f.admin.db,'empresa-a','outro',f.opcoes.agora),e=>e.status===429);
});
test('provider errors are controlled and never disclose upstream details or keys',async()=>{
  for(const status of [401,403,429,500]){
    await assert.rejects(analisarComGroq({},'resumo',{key:'fake-secret',fetchImpl:async()=>({ok:false,status,json:async()=>({erro:'fake-secret'})})}),e=>e instanceof ErroAssistente && !e.message.includes('fake-secret'));
  }
  await assert.rejects(analisarComGroq({},'resumo',{key:'fake-secret',fetchImpl:async()=>{throw new Error('fake-secret');}}),e=>e.status===502&&!e.message.includes('fake-secret'));
  await assert.rejects(analisarComGroq({},'resumo',{key:'fake-secret',fetchImpl:async()=>({ok:true,json:async()=>({choices:[]})})}),e=>e.status===502);
});
