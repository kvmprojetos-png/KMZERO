import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import handler, { tratarFoto } from '../api/foto.js';
import { lerUploadFoto, migrarFotosDaEmpresa, podeAcessarFoto, CACHE_FOTOS } from '../api/_lib/fotosPrivadas.js';
import { caminhoFotoLegada, referenciaFoto, normalizarFotoLocalPrivada, BUCKET_FOTOS, PARTE_FOTO_BYTES } from '../src/lib/fotoCaminho.js';

// All collaborators here are isolated in-memory stores: never a real account.
const TOKEN = 'header.payload.signature';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1QAAAABJRU5ErkJggg==', 'base64');
const PATH = 'empresas/empresa-a/fotosObras/foto-1.jpg';
const OLD = `https://firebasestorage.googleapis.com/v0/b/${BUCKET_FOTOS}/o/${encodeURIComponent(PATH)}?alt=media&token=private-sentinel`;
const request = (overrides = {}) => ({ method: 'GET', headers: { authorization: `Bearer ${TOKEN}` }, query: { empresaId: 'empresa-a', fotoId: 'foto-1' }, ...overrides });
const upload = () => ({ empresaId: 'empresa-a', foto: { id: 'foto-1', obraId: 7, autor: 'Nome fornecido', foto: `data:image/png;base64,${PNG.toString('base64')}` } });
function response() { return { headers: {}, statusCode: 200, setHeader(k,v) { this.headers[k]=v; }, status(v) { this.statusCode=v; return this; }, json(v) { this.body=v; return this; }, send(v) { this.body=v; return this; } }; }
function fixture({ perfil = {}, photo = true, stored = true, revoked = false, bytes = PNG } = {}) {
  const state = { auth: [], downloads: 0, saves: 0, metadataWrites: 0, documentWrites: 0 };
  const records = new Map([
    ['usuarios/alice', { empresaId:'empresa-a', perfil:'gestor', ativo:true, nome:'Alice', ...perfil }],
    ['empresas/empresa-a/obras/7', { nome:'Obra' }],
  ]);
  if (photo) records.set('empresas/empresa-a/fotosObras/foto-1', { id:'foto-1', obraId:7, fotoUrl:OLD });
  const objects = new Map(stored ? [[PATH, { bytes, size:String(bytes.length), contentType:'image/png', generation:'1', metageneration:'1', cacheControl:'public', metadata:{ firebaseStorageDownloadTokens:'private-sentinel' } }]] : []);
  function ref(path) {
    return { id:path.split('/').at(-1), collection: name => collection(`${path}/${name}`),
      async get() { return snapshot(path); },
      async create(data) { if(records.has(path)) throw Object.assign(new Error(),{code:6}); state.documentWrites++; records.set(path,data); },
      async update(data) {
        state.documentWrites++; const atual=records.get(path);
        for(const [key,value] of Object.entries(data)) {
          if(value?.constructor?.name === 'DeleteTransform') delete atual[key]; else atual[key]=value;
        }
      },
    };
  }
  const snapshot = path => ({ id:path.split('/').at(-1), exists:records.has(path), data:()=>records.get(path), ref:ref(path), updateTime:{ seconds:1 } });
  function collection(path) {
    let limit=1000, after='';
    const c={ doc:id=>ref(`${path}/${id}`), orderBy:()=>c, limit:n=>(limit=n,c), startAfter:id=>(after=id,c),
      async get() { return { docs:[...records.keys()].filter(p=>p.startsWith(`${path}/`)&&!p.slice(path.length+1).includes('/')&&p.split('/').at(-1)>after).sort().slice(0,limit).map(snapshot) }; } };
    return c;
  }
  function file(name) { return { name,
    async getMetadata() { const o=objects.get(name); if(!o) throw Object.assign(new Error(),{code:404}); return [{ ...o, metadata:{...o.metadata} }]; },
    async setMetadata(m, options) { state.metadataWrites++; const o=objects.get(name); assert.equal(options.ifMetagenerationMatch,o.metageneration); if(m.metadata.firebaseStorageDownloadTokens===null) delete o.metadata.firebaseStorageDownloadTokens; o.cacheControl=m.cacheControl; },
    async save(data, options) { assert.equal(options.preconditionOpts.ifGenerationMatch,0); if(objects.has(name)) throw Object.assign(new Error(),{code:412}); state.saves++; objects.set(name,{ ...options.metadata,bytes:data,size:String(data.length),generation:'1',metageneration:'1' }); },
    async download({start,end}) { state.downloads++; return [objects.get(name).bytes.subarray(start,end+1)]; },
  }; }
  const admin={ db:{ collection }, auth:{ async verifyIdToken(token,checkRevoked) { state.auth.push({token,checkRevoked}); if(revoked) throw Object.assign(new Error('secret'),{code:'auth/id-token-revoked'}); return {uid:'alice'}; } },
    bucket:{ file, async getFiles({prefix,maxResults,pageToken}) { const all=[...objects.keys()].filter(k=>k.startsWith(prefix)).sort(); const start=Number(pageToken||0); return [all.slice(start,start+maxResults).map(file),start+maxResults<all.length?{pageToken:String(start+maxResults)}:null]; } } };
  return { admin,state,records,objects };
}

test('legacy URLs resolve to one canonical company/photo path, never another host/path',()=>{
  assert.equal(caminhoFotoLegada(OLD,'empresa-a','foto-1'),PATH);
  assert.equal(referenciaFoto({id:'foto-1',fotoUrl:OLD},'empresa-a'),PATH);
  for(const value of [OLD.replace(BUCKET_FOTOS,'other-bucket'),OLD.replace('firebasestorage.googleapis.com','evil.example'),OLD.replace('https:','http:'),OLD.replace('foto-1','foto-2'),'javascript:alert(1)',`https://evil.example/${PATH}`,PATH+'/../x']) assert.equal(caminhoFotoLegada(value,'empresa-a','foto-1'),'');
  assert.equal(referenciaFoto({id:'foto-1',fotoUrl:OLD},'empresa-b'),'');
});
test('photo permission matrix checks active company, office area and field worksite',()=>{
  assert.equal(podeAcessarFoto({empresaId:'a',perfil:'gestor'},'a',7),true);
  assert.equal(podeAcessarFoto({empresaId:'a',perfil:'gestor',acessos:['campo']},'a',7),true);
  assert.equal(podeAcessarFoto({empresaId:'a',perfil:'encarregado',obraId:'7'},'a',7),true);
  for(const p of [{perfil:'gestor',acessos:['financeiro']},{perfil:'encarregado',obraId:8},{perfil:'encarregado'},{perfil:'gestor',ativo:false},{perfil:'outro'}]) assert.equal(podeAcessarFoto({empresaId:'a',...p},'a',7),false);
  assert.equal(podeAcessarFoto({empresaId:'b',perfil:'gestor'},'a',7),false);
});
test('cache and backup hydration never restore token links and retain pending raster data',()=>{
  const pending=`data:image/png;base64,${PNG.toString('base64')}`;
  assert.deepEqual(normalizarFotoLocalPrivada({id:'foto-1',obraId:7,fotoUrl:OLD,foto:OLD},'empresa-a'),{id:'foto-1',obraId:7,fotoPath:PATH,acessoFoto:'autenticado'});
  assert.deepEqual(normalizarFotoLocalPrivada({id:'foto-1',foto:pending},'empresa-a'),{id:'foto-1',foto:pending});
  assert.deepEqual(normalizarFotoLocalPrivada({id:'foto-1',fotoPath:PATH,foto:pending},'empresa-a'),{id:'foto-1',fotoPath:PATH,acessoFoto:'autenticado'});
  for(const foto of [OLD,'https://example.invalid/photo.jpg','javascript:alert(1)']) {
    const safe=normalizarFotoLocalPrivada({id:'foto-1',foto},'empresa-a');assert.equal(safe.foto,undefined);assert.equal(safe.fotoUrl,undefined);
  }
  assert.equal(normalizarFotoLocalPrivada(null,'empresa-a'),null);
});
test('upload validates real raster signature, canonical base64 and identifiers',()=>{
  assert.equal(lerUploadFoto(upload()).mime,'image/png');
  const bad=[{foto:'data:image/png;base64,PHN2Zz48L3N2Zz4='},{foto:upload().foto.foto.replace('image/png','image/jpeg')},{id:'../x'},{id:{}},{obraId:[]},{id:NaN},{foto:upload().foto.foto+'='},{legenda:'x'.repeat(2001)}];
  for(const patch of bad) assert.equal(lerUploadFoto({...upload(),foto:{...upload().foto,...patch}}),null);
});
test('photo route rejects unsupported/anonymous requests before credentials',async()=>{
  for(const [req,code] of [[request({method:'DELETE'}),405],[request({headers:{}}),401]]) {const res=response();await handler(req,res);assert.equal(res.statusCode,code);assert.equal(res.headers['Cache-Control'],CACHE_FOTOS);}
});
test('invalid paths and part arrays never reach authentication',async()=>{
  for(const query of [{empresaId:'../b',fotoId:'foto-1'},{empresaId:'empresa-a',fotoId:['foto-1']},{empresaId:'empresa-a',fotoId:'foto-1',parte:['1']},{empresaId:'empresa-a',fotoId:'foto-1',parte:'10'}]) {const {admin,state}=fixture();const res=response();await tratarFoto(admin,request({query}),res);assert.equal(res.statusCode,400);assert.equal(state.auth.length,0);}
});
test('private download authorizes every request and never redirects to a token URL',async()=>{
  const {admin,state}=fixture();const res=response();await tratarFoto(admin,request(),res);
  assert.equal(res.statusCode,200);assert.deepEqual(res.body,PNG);assert.equal(state.auth[0].checkRevoked,true);assert.equal(res.headers['X-KM-Foto-Partes'],1);assert.equal(res.headers.Location,undefined);assert.equal(res.headers['Cache-Control'],CACHE_FOTOS);
});
test('revoked, inactive, other-company, unassigned or wrong-area users cannot read bytes',async()=>{
  for(const options of [{revoked:true},{perfil:{ativo:false}},{perfil:{empresaId:'empresa-b'}},{perfil:{perfil:'encarregado',obraId:8}},{perfil:{acessos:['financeiro']}}]) {const {admin,state}=fixture(options);const res=response();await tratarFoto(admin,request(),res);assert.ok([401,403].includes(res.statusCode));assert.equal(state.downloads,0);}
});
test('old large photos use authenticated one-megabyte parts',async()=>{
  const bytes=Buffer.alloc(PARTE_FOTO_BYTES+137,7);PNG.copy(bytes);const {admin}=fixture({bytes});const a=response(),b=response();await tratarFoto(admin,request(),a);await tratarFoto(admin,request({query:{empresaId:'empresa-a',fotoId:'foto-1',parte:'1'}}),b);
  assert.equal(a.body.length,PARTE_FOTO_BYTES);assert.equal(b.body.length,137);assert.deepEqual(Buffer.concat([a.body,b.body]),bytes);assert.equal(a.headers['X-KM-Foto-Partes'],2);
});
test('upload creates private object without download token and metadata without public URL',async()=>{
  const {admin,state,objects,records}=fixture({photo:false,stored:false});const res=response();await tratarFoto(admin,request({method:'POST',body:upload()}),res);
  assert.equal(res.statusCode,200);assert.equal(state.saves,1);assert.equal(objects.get(PATH).metadata.firebaseStorageDownloadTokens,undefined);assert.equal(objects.get(PATH).cacheControl,CACHE_FOTOS);
  const d=records.get('empresas/empresa-a/fotosObras/foto-1');assert.equal(d.fotoUrl,undefined);assert.equal(d.foto,undefined);assert.equal(d.fotoPath,PATH);assert.equal(d.autorUid,'alice');assert.equal(d.autor,'Alice');
  const retry=response();await tratarFoto(admin,request({method:'POST',body:upload()}),retry);assert.equal(retry.statusCode,200);assert.equal(state.saves,1);
});
test('new uploads cannot replace old photo IDs, even by a manager',async()=>{
  const {admin,state}=fixture();const res=response();await tratarFoto(admin,request({method:'POST',body:upload()}),res);assert.equal(res.statusCode,409);assert.equal(state.saves,0);
});
test('field uploader cannot write another worksite',async()=>{
  const {admin,state}=fixture({photo:false,stored:false,perfil:{perfil:'encarregado',obraId:8}});const res=response();await tratarFoto(admin,request({method:'POST',body:upload()}),res);assert.equal(res.statusCode,403);assert.equal(state.saves,0);
});
test('migration dry-run changes neither metadata nor documents, and never leaks tokens',async()=>{
  const {admin,state}=fixture();for(const etapa of ['objetos','documentos']) {const r=await migrarFotosDaEmpresa({...admin,empresaId:'empresa-a',etapa});assert.equal(r.alterados,1);assert.equal(JSON.stringify(r).includes('private-sentinel'),false);}assert.equal(state.metadataWrites,0);assert.equal(state.documentWrites,0);
});
test('migration revokes every object, including orphan photos, before converting documents',async()=>{
  const {admin,state,objects,records}=fixture();objects.set('empresas/empresa-a/fotosObras/orphan.jpg',{...objects.get(PATH),metadata:{firebaseStorageDownloadTokens:'orphan-secret'}});
  const first=await migrarFotosDaEmpresa({...admin,empresaId:'empresa-a',aplicar:true,limite:1});assert.equal(first.cursor,'1');assert.equal(first.examinados,1);
  const second=await migrarFotosDaEmpresa({...admin,empresaId:'empresa-a',aplicar:true,cursor:first.cursor,limite:1});assert.equal(second.proximaEtapa,'documentos');
  const done=await migrarFotosDaEmpresa({...admin,empresaId:'empresa-a',aplicar:true,etapa:'documentos'});assert.equal(done.concluido,true);assert.equal(state.metadataWrites,2);
  assert.equal([...objects.values()].some(o=>o.metadata.firebaseStorageDownloadTokens),false);const d=records.get('empresas/empresa-a/fotosObras/foto-1');assert.equal(d.fotoUrl,undefined);assert.equal(d.fotoPath,PATH);
  const retry=await migrarFotosDaEmpresa({...admin,empresaId:'empresa-a',aplicar:true,etapa:'documentos'});assert.equal(retry.alterados,0);
});
test('conversion refuses a still-public object and preserves the document',async()=>{
  const {admin,records}=fixture();const r=await migrarFotosDaEmpresa({...admin,empresaId:'empresa-a',aplicar:true,etapa:'documentos'});assert.equal(r.concluido,false);assert.equal(r.falhas[0].codigo,'revogacao-pendente');assert.equal(records.get('empresas/empresa-a/fotosObras/foto-1').fotoUrl,OLD);
});
test('migration preserves incompatible references instead of silently replacing them',async()=>{
  const {admin,records}=fixture();records.get('empresas/empresa-a/fotosObras/foto-1').fotoUrl='https://example.invalid/outro.jpg';
  const r=await migrarFotosDaEmpresa({...admin,empresaId:'empresa-a',aplicar:true,etapa:'documentos'});assert.equal(r.concluido,false);assert.equal(r.falhas[0].codigo,'referencia-incompativel');assert.equal(records.get('empresas/empresa-a/fotosObras/foto-1').fotoUrl,'https://example.invalid/outro.jpg');
});
test('new photo API loads under the deployed CommonJS/ESM runtime boundary',()=>{
  const run=spawnSync(process.execPath,['--no-experimental-require-module','--input-type=module','-e',"await import('./api/foto.js');"],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',timeout:20000});assert.ifError(run.error);assert.equal(run.status,0,run.stderr);
});
