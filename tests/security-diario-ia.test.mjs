import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{tratarDiarioIA} from '../api/diario-ia.js';
import {organizarRelatoDiario} from '../api/_lib/diarioIA.js';
import {ErroAssistente,reservarAnalise} from '../api/_lib/assistenteObras.js';

const RELATO='Foram feitos 12 metros de alvenaria. A concretagem está prevista para amanhã; ainda não foi executada.';
const BODY={empresaId:'empresa-a',obraId:'42',relato:RELATO,consentimento:true};
const req=(body=BODY,method='POST')=>({method,headers:{authorization:'Bearer a.b.c'},body,query:body});
const res=()=>({code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(b){this.body=b;return this;}});
function fixture(perfil={},authCode) {
  const registros=new Map([
    ['usuarios/eu',{empresaId:'empresa-a',perfil:'gestor',ativo:true,...perfil}],
    ['empresas/empresa-a/obras/42',{nome:'Obra fictícia',local:'ENDERECO_PRIVADO',valorContrato:987654,cliente:'PESSOA_PRIVADA'}],
    ['empresas/empresa-a/obrasCampo/42',{nome:'Obra fictícia',local:'ENDERECO_PRIVADO'}],
    ['empresas/empresa-a/diario/anterior',{obraId:42,texto:'REGISTRO_NAO_CONSENTIDO'}],
  ]);
  const estado={leituras:[],escritas:[],envios:[],revogado:false};
  const doc=path=>({path,collection:n=>col(`${path}/${n}`),async get(){estado.leituras.push(path);return {exists:registros.has(path),data:()=>registros.get(path)};}});
  const col=path=>({doc:id=>doc(`${path}/${id}`)});
  const db={collection:col,runTransaction:fn=>fn({get:r=>r.get(),set:(r,d)=>{estado.escritas.push(r.path);registros.set(r.path,d);}})};
  const auth={async verifyIdToken(_token,revogado){estado.revogado=revogado;if(authCode)throw Object.assign(new Error('DADO_PRIVADO'),{code:authCode});return {uid:'eu'};}};
  const fetchImpl=async(url,opts)=>{
    estado.envios.push({url,opts});
    return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({texto:'Serviços relatados: 12 metros de alvenaria. Concretagem ainda não executada; prevista para amanhã.',conferir:['Confirmar a data do relato.']})}}]})};
  };
  return {admin:{db,auth},registros,estado,opcoes:{key:'fake-key',fetchImpl,agora:Date.parse('2026-10-06T15:00:00Z')}};
}

test('diary rejects anonymous, unsupported methods and invalid or unapproved text before services',async()=>{
  const a=res();await handler({method:'POST',headers:{},body:{}},a);assert.equal(a.code,401);
  const m=res();await handler({method:'DELETE',headers:{}},m);assert.equal(m.code,405);assert.equal(m.headers.Allow,'GET, POST');
  for(const body of [null,[],{...BODY,empresaId:'../b'},{...BODY,obraId:'a/b'},{...BODY,obraId:42},
    {...BODY,consentimento:false},{...BODY,relato:'curto'},{...BODY,relato:'a'.repeat(5001)},
    {...BODY,relato:{texto:RELATO}},{...BODY,fotos:['PRIVADO']},{...BODY,contexto:{privado:true}}]){
    const f=fixture(),r=res();await tratarDiarioIA(f.admin,req(body),r,f.opcoes);
    assert.equal(r.code,400);assert.deepEqual(f.estado.leituras,[]);assert.deepEqual(f.estado.envios,[]);assert.deepEqual(f.estado.escritas,[]);
  }
  const f=fixture(),r=res(),p=req();p.headers['content-length']='24001';await tratarDiarioIA(f.admin,p,r,f.opcoes);
  assert.equal(r.code,400);assert.deepEqual(f.estado.leituras,[]);
});

test('diary enforces revocation, active company profile, field area and assigned work on server',async()=>{
  for(const [perfil,code,status] of [[{},'auth/id-token-revoked',401],[{ativo:false},null,403],[{empresaId:'empresa-b'},null,403],
    [{perfil:'encarregado',obraId:43},null,403],[{perfil:'encarregado'},null,403],[{perfil:'visitante'},null,403],
    [{acessos:[]},null,403],[{acessos:['financeiro','equipe']},null,403]]){
    const f=fixture(perfil,code),r=res();await tratarDiarioIA(f.admin,req(),r,f.opcoes);
    assert.equal(r.code,status);assert.deepEqual(f.estado.envios,[]);assert.deepEqual(f.estado.escritas,[]);
    assert.ok(f.estado.leituras.every(p=>p==='usuarios/eu'));assert.equal(f.estado.revogado,true);
  }
});

test('assigned field worker and field office can create drafts using only work projection and approved text',async()=>{
  for(const perfil of [{perfil:'encarregado',obraId:42},{acessos:['campo']}]){
    const f=fixture(perfil),r=res();await tratarDiarioIA(f.admin,req(),r,f.opcoes);assert.equal(r.code,200);
    assert.equal(r.body.obraId,'42');assert.match(r.body.rascunho.texto,/12 metros/);
    assert.ok(f.estado.leituras.includes('empresas/empresa-a/obrasCampo/42'));
    assert.ok(!f.estado.leituras.includes('empresas/empresa-a/obras/42'));
    const {url,opts}=f.estado.envios[0],payload=JSON.parse(opts.body);
    assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
    assert.deepEqual(JSON.parse(payload.messages[1].content),{dataReferencia:'2026-10-06',obra:{nome:'Obra fictícia'},relato:RELATO});
    assert.doesNotMatch(opts.body,/ENDERECO_PRIVADO|PESSOA_PRIVADA|987654|REGISTRO_NAO_CONSENTIDO/);
    assert.ok(f.estado.leituras.every(p=>p==='usuarios/eu'||p==='empresas/empresa-a/obrasCampo/42'||p.startsWith('_iaCotas/')));
    assert.ok(f.estado.escritas.every(p=>p.startsWith('_iaCotas/')));
    assert.deepEqual(f.registros.get('empresas/empresa-a/diario/anterior'),{obraId:42,texto:'REGISTRO_NAO_CONSENTIDO'});
    assert.equal(r.headers['Cache-Control'],'private, no-store');
  }
});

test('missing work or configuration never consumes quota or sends a diary',async()=>{
  const f=fixture();f.registros.delete('empresas/empresa-a/obras/42');const missing=res();await tratarDiarioIA(f.admin,req(),missing,f.opcoes);assert.equal(missing.code,404);
  const g=fixture(),get=res();await tratarDiarioIA(g.admin,req({empresaId:'empresa-a',obraId:'42'},'GET'),get,{...g.opcoes,key:''});
  assert.equal(get.code,200);assert.equal(get.body.configurado,false);
  const post=res();await tratarDiarioIA(g.admin,req(),post,{...g.opcoes,key:''});assert.equal(post.code,503);
  assert.deepEqual(g.estado.envios,[]);assert.deepEqual(g.estado.escritas,[]);assert.deepEqual(f.estado.envios,[]);assert.deepEqual(f.estado.escritas,[]);
});

test('diary shares assistant quotas and prevents duplicate provider calls',async()=>{
  const f=fixture(),r=res();await tratarDiarioIA(f.admin,req(),r,f.opcoes);assert.equal(r.code,200);
  const again=res();await tratarDiarioIA(f.admin,req(),again,f.opcoes);assert.equal(again.code,429);assert.equal(f.estado.envios.length,1);
  await assert.rejects(reservarAnalise(f.admin.db,'empresa-a','eu',f.opcoes.agora),e=>e.status===429);
  for(const quota of ['empresa_empresa-a_2026-10-06','global_2026-10-06']){
    const g=fixture(),limit=res();g.registros.set(`_iaCotas/${quota}`,{quantidade:quota.startsWith('empresa')?20:40});
    await tratarDiarioIA(g.admin,req(),limit,g.opcoes);assert.equal(limit.code,429);assert.deepEqual(g.estado.envios,[]);
  }
});

test('invalid, truncated or oversized drafts are refused rather than saved',async()=>{
  for(const [content,finish_reason='stop'] of [
    ['not JSON'],[JSON.stringify({texto:'rascunho',conferir:[]}), 'length'],
    [JSON.stringify({texto:'',conferir:[]})],[JSON.stringify({texto:'a'.repeat(5001),conferir:[]})],
    [JSON.stringify({texto:'rascunho',conferir:['a'.repeat(301)]})],[JSON.stringify({texto:'rascunho',conferir:Array(6).fill('conferir')})],
    [JSON.stringify({texto:'rascunho',conferir:[],obraId:'outra'})],[JSON.stringify({texto:'rascunho',conferir:[null]})],
    ['x'.repeat(12001)]]){
    const f=fixture(),r=res();await tratarDiarioIA(f.admin,req(),r,{...f.opcoes,fetchImpl:async()=>({ok:true,status:200,json:async()=>({choices:[{finish_reason,message:{content}}]})})});
    assert.equal(r.code,502);assert.equal(r.body.rascunho,undefined);
    assert.ok(f.estado.escritas.every(p=>p.startsWith('_iaCotas/')));assert.equal(f.registros.size,7);
  }
});

test('provider failures hide upstream details and never write diary or RDO',async()=>{
  for(const [status,expected] of [[401,503],[403,503],[429,429],[500,502]]){
    const f=fixture(),r=res();await tratarDiarioIA(f.admin,req(),r,{...f.opcoes,key:'fake-secret',fetchImpl:async()=>({ok:false,status,json:async()=>({erro:'fake-secret'})})});
    assert.equal(r.code,expected);assert.doesNotMatch(JSON.stringify(r.body),/fake-secret/);assert.ok(f.estado.escritas.every(p=>p.startsWith('_iaCotas/')));
  }
  await assert.rejects(organizarRelatoDiario({relato:RELATO},{key:'fake-secret',fetchImpl:async()=>{throw new Error('fake-secret');}}),e=>e instanceof ErroAssistente&&e.status===502&&!e.message.includes('fake-secret'));
});
