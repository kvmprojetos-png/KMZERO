import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tratarSeguranca } from '../api/seguranca.js';
import { migrarPaginaRbac, ETAPAS_PROTECAO } from '../api/_lib/migracaoRbac.js';

const EMP='empresa-a', UID='dono', BASE=`empresas/${EMP}`;
const STATE=`${BASE}/_seguranca/estado`;
const req=(acao='backup',extra={})=>({method:'POST',headers:{authorization:'Bearer header.payload.signature'},body:{empresaId:EMP,acao,...extra}});
const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;}});
function fixture(patch={}) {
  const records=new Map([[BASE,{gestorUid:UID,nome:'Empresa'}],[`usuarios/${UID}`,{empresaId:EMP,perfil:'gestor',ativo:true,...patch}]]);
  const state={verify:[],writes:0};
  function ref(path) { return {path,id:path.split('/').at(-1),collection:n=>collection(`${path}/${n}`),async get(){return snapshot(path);},
    async set(d,options){state.writes++;records.set(path,options?.merge?{...records.get(path),...d}:structuredClone(d));},
    async update(d){state.writes++;const old=records.get(path);for(const[k,v]of Object.entries(d)){const parts=k.split('.');if(parts.length===2)(old[parts[0]]??={})[parts[1]]=v;else old[k]=v;}},
  }; }
  const snapshot=path=>({exists:records.has(path),data:()=>records.get(path),id:path.split('/').at(-1),ref:ref(path)});
  function collection(path) {let filtros=[],max=10000,after='';const c={doc:id=>ref(`${path}/${id}`),where:(k,op,v)=>(filtros.push([k,v]),c),orderBy:()=>c,limit:n=>(max=n,c),startAfter:id=>(after=id,c),async get(){return{docs:[...records.keys()].filter(p=>p.startsWith(path+'/')&&!p.slice(path.length+1).includes('/')&&p.split('/').at(-1)>after&&filtros.every(([k,v])=>records.get(p)[k]===v)).sort().slice(0,max).map(snapshot)};}};return c;}
  const db={doc:ref,collection,async runTransaction(callback){return callback({get:r=>r.get(),set:(r,d,o)=>r.set(d,o),update:(r,d)=>r.update(d)});}};
  const admin={db,bucket:{},auth:{async verifyIdToken(token,checkRevoked){state.verify.push({token,checkRevoked});return{uid:UID};}}};
  return {admin,records,state};
}
const backup={id:'backup-1',verificado:true,empresaId:EMP,ownerUid:UID,criadoEm:'2026-10-05',contagens:{documentos:4}};

test('maintenance endpoint is owner-only even for an active same-company manager',async()=>{
  const {admin,records,state}=fixture();records.get(BASE).gestorUid='outra-pessoa';const r=response();let called=0;
  await tratarSeguranca(admin,req(),r,{criarBackup:async()=>{called++;return backup;}});assert.equal(r.statusCode,403);assert.equal(called,0);assert.equal(state.writes,0);assert.equal(state.verify[0].checkRevoked,true);
});
test('maintenance endpoint refuses inactive and other-company accounts',async()=>{
  for(const patch of [{ativo:false},{empresaId:'outra'}]){const{admin}=fixture(patch);const r=response();await tratarSeguranca(admin,req(),r,{criarBackup:async()=>{throw Error('must not run');}});assert.equal(r.statusCode,403);}
});
test('backup checkpoint stores only a verified server-created backup and does not return private fields',async()=>{
  const {admin,records}=fixture();const r=response();await tratarSeguranca(admin,req(),r,{criarBackup:async()=>({...backup,path:'private-path',sha256:'secret-hash'})});
  assert.equal(r.statusCode,200);assert.equal(r.body.backupId,'backup-1');assert.equal(r.body.backup.path,undefined);assert.equal(records.get(STATE).status,'backup-pronto');assert.equal(records.get(STATE).trava,null);
});
test('caller cannot forge a backup ID or completed cursor to skip migration',async()=>{
  const {admin,records}=fixture();records.set(STATE,{backupId:'backup-1',status:'backup-pronto',etapa:'trabalhadores',cursor:null});let ran=false;const r=response();
  await tratarSeguranca(admin,req('migrar',{backupId:'forged',concluido:true,etapa:'fotosDocumentos',cursor:'zz'}),r,{migrar:async()=>{ran=true;}});
  assert.equal(r.statusCode,409);assert.equal(ran,false);assert.equal(records.get(STATE).etapa,'trabalhadores');
});
test('failed or unverified backup blocks all data changes',async()=>{
  const {admin,records}=fixture();records.set(STATE,{backupId:'backup-1',status:'backup-pronto',etapa:'trabalhadores'});let ran=false;const r=response();
  await tratarSeguranca(admin,req('migrar',{backupId:'backup-1'}),r,{verificarBackup:async()=>({verificado:false}),migrar:async()=>{ran=true;}});assert.equal(r.statusCode,409);assert.equal(ran,false);
});
test('migration uses its private checkpoint and advances only a successful page',async()=>{
  const {admin,records}=fixture();records.set(STATE,{backupId:'backup-1',status:'migrando',etapa:'obras',cursor:'obra-2'});const r=response();
  await tratarSeguranca(admin,req('migrar',{backupId:'backup-1',etapa:'fotosDocumentos',cursor:'forged'}),r,{verificarBackup:async()=>backup,migrar:async p=>{assert.equal(p.etapa,'obras');assert.equal(p.cursor,'obra-2');return{etapa:p.etapa,examinados:3,alterados:3,falhas:[],cursor:null,proximaEtapa:'usuarios'};}});
  assert.equal(r.statusCode,200);assert.equal(records.get(STATE).etapa,'usuarios');assert.equal(records.get(STATE).cursor,null);assert.equal(records.get(STATE).totais.obras.alterados,3);
});
test('a partial failure preserves cursor and prevents a false complete marker',async()=>{
  const {admin,records}=fixture();records.set(STATE,{backupId:'backup-1',status:'migrando',etapa:'fotosDocumentos',cursor:'foto-9'});const r=response();
  await tratarSeguranca(admin,req('migrar',{backupId:'backup-1'}),r,{verificarBackup:async()=>backup,migrar:async()=>({etapa:'fotosDocumentos',examinados:2,alterados:1,falhas:[{id:'foto-10',codigo:'404'}],cursor:null,proximaEtapa:null})});
  assert.equal(r.body.concluido,false);assert.equal(records.get(STATE).cursor,'foto-9');assert.equal(records.get(STATE).versao,undefined);assert.equal(records.get(STATE).trava,null);
});
test('two tabs cannot run a migration page while one holds the private lock',async()=>{
  const {admin,records}=fixture();records.set(STATE,{backupId:'backup-1',status:'migrando',etapa:'trabalhadores',trava:'other',travaAte:Date.now()+100000});const r=response();
  await tratarSeguranca(admin,req('migrar',{backupId:'backup-1'}),r);assert.equal(r.statusCode,409);assert.equal(records.get(STATE).trava,'other');
});
test('only final successful page marks the protection complete',async()=>{
  const {admin,records}=fixture();records.set(STATE,{backupId:'backup-1',status:'migrando',etapa:'fotosDocumentos'});const r=response();
  await tratarSeguranca(admin,req('migrar',{backupId:'backup-1'}),r,{verificarBackup:async()=>backup,migrar:async()=>({etapa:'fotosDocumentos',examinados:0,alterados:0,falhas:[],cursor:null,proximaEtapa:null})});
  assert.equal(r.body.concluido,true);assert.equal(records.get(STATE).versao,1);assert.equal(records.get(STATE).status,'concluido');
});
test('projection migration retains originals and excludes salaries/identity/medical details',async()=>{
  const {admin,records}=fixture();records.set(`${BASE}/trabalhadores/1`,{id:1,nome:'Pessoa',cargo:'Função',obraId:7,ativo:true,cpf:'private-cpf',salario:5000,aso:{laudo:'private-health'},foto:'private-photo'});
  const r=await migrarPaginaRbac({...admin,empresaId:EMP,etapa:'trabalhadores'});assert.equal(r.alterados,1);assert.deepEqual(records.get(`${BASE}/trabalhadoresCampo/1`),{id:1,nome:'Pessoa',cargo:'Função',obraId:7,ativo:true});assert.equal(records.get(`${BASE}/trabalhadores/1`).salario,5000);
});
test('profile projections are limited to this company and never contain email or access grants',async()=>{
  const {admin,records}=fixture();records.get(`usuarios/${UID}`).email='private@example.invalid';records.set('usuarios/outro',{empresaId:'outra',nome:'Other'});
  const r=await migrarPaginaRbac({...admin,empresaId:EMP,etapa:'usuarios'});assert.equal(r.examinados,1);const p=records.get(`${BASE}/perfisCampo/${UID}`);assert.equal(p.email,undefined);assert.equal(p.acessos,undefined);assert.equal(records.has(`${BASE}/perfisCampo/outro`),false);
});
test('historical attendance retains existing worksite; missing linkage is reported and unchanged',async()=>{
  const {admin,records}=fixture();records.set(`${BASE}/trabalhadores/1`,{obraId:7});records.set(`${BASE}/presencas/a`,{trabId:1,status:'presente'});records.set(`${BASE}/presencas/b`,{trabId:1,obraId:9,status:'presente'});records.set(`${BASE}/presencas/c`,{trabId:999,status:'falta'});
  const r=await migrarPaginaRbac({...admin,empresaId:EMP,etapa:'presencas'});assert.equal(r.alterados,0);assert.equal(r.semVinculo,2);assert.equal(records.get(`${BASE}/presencas/a`).obraId,undefined);assert.equal(records.get(`${BASE}/presencas/b`).obraId,9);assert.equal(records.get(`${BASE}/presencas/c`).obraId,undefined);
});
test('old automatic alerts are scoped to their allowed area and human messages stay intact',async()=>{
  const {admin,records}=fixture();for(const tipo of ['folha','prazo','ponto'])records.set(`${BASE}/avisos/${tipo}`,{de:'sistema',tipo,para:{tipo:'gestores'}});records.set(`${BASE}/avisos/humano`,{de:'dono',tipo:'folha',para:{tipo:'gestores'}});records.set(`${BASE}/avisos/obra`,{de:'dono',para:{tipo:'obra',obraId:7}});
  const r=await migrarPaginaRbac({...admin,empresaId:EMP,etapa:'avisos'});assert.equal(r.alterados,4);assert.deepEqual(records.get(`${BASE}/avisos/folha`).para,{tipo:'area',area:'equipe'});assert.deepEqual(records.get(`${BASE}/avisos/prazo`).para,{tipo:'area',area:'total'});assert.deepEqual(records.get(`${BASE}/avisos/ponto`).para,{tipo:'area',area:'campo'});assert.deepEqual(records.get(`${BASE}/avisos/humano`).para,{tipo:'gestores'});assert.equal(records.get(`${BASE}/avisos/obra`).para.perfil,null);assert.ok(ETAPAS_PROTECAO.indexOf('avisos')<ETAPAS_PROTECAO.indexOf('fotosObjetos'));
});
test('backend failure preserves checkpoint and hides private exception text',async()=>{
  const {admin,records}=fixture();records.set(STATE,{backupId:'backup-1',status:'migrando',etapa:'obras',cursor:'x'});const r=response();
  await tratarSeguranca(admin,req('migrar',{backupId:'backup-1'}),r,{verificarBackup:async()=>{throw new Error('PRIVATE_SENTINEL');}});
  assert.equal(r.statusCode,500);assert.equal(JSON.stringify(r.body).includes('PRIVATE_SENTINEL'),false);assert.equal(records.get(STATE).cursor,'x');assert.equal(records.get(STATE).trava,null);
});
test('both new APIs load with deployed module restrictions and return 503 without credentials',()=>{
  const code=`delete process.env.FIREBASE_SERVICE_ACCOUNT;
    const {default: foto}=await import('./api/foto.js');
    const {default: seguranca}=await import('./api/seguranca.js');
    const response=()=>({statusCode:200,setHeader(){},status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;}});
    const a=response(),b=response(),headers={authorization:'Bearer a.b.c'};
    await foto({method:'GET',headers,query:{empresaId:'demo',fotoId:'demo'}},a);
    await seguranca({method:'GET',headers,query:{empresaId:'demo'}},b);
    console.log(JSON.stringify([a.statusCode,b.statusCode]));`;
  const r=spawnSync(process.execPath,['--no-experimental-require-module','--input-type=module','-e',code],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',timeout:20000});
  assert.ifError(r.error);assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout.trim()),[503,503]);
});
