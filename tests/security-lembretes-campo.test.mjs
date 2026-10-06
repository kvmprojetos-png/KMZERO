import test from 'node:test';
import assert from 'node:assert/strict';
import {obrasComPontoPendente,pendenciasFechamento} from '../api/_lib/lembretesCampo.js';
import {avisoEhPara} from '../src/lib/avisosRegras.js';

test('attendance reminder covers partially filled point, but ignores inactive workers and completed sites',()=>{
  const obras=[{id:1},{id:'2'},{id:3}];
  const equipe=[{id:10,obraId:'1'},{id:11,obraId:1},{id:12,obraId:1,ativo:false},{id:20,obraId:2}];
  const ponto=[{trabId:'10',status:'Falta'},{trabId:20,status:'Presente'}];
  assert.deepEqual(obrasComPontoPendente(obras,equipe,ponto),[{id:1,pontoPendente:1}]);
});
test('closing reminder only includes missing RDO/photos for the selected day, including legacy Brazilian dates',()=>{
  const obras=[{id:1},{id:2},{id:3},{id:4}];
  const rdos=[{obraId:'1',dataIso:'2026-10-05'},{obraId:2,data:'05/10/2026'},{obraId:4,dataIso:'2026-10-04'}];
  const fotos=[{obraId:1,data:'05/10/2026'},{obraId:'3',data:'2026-10-05'}];
  assert.deepEqual(pendenciasFechamento(obras,rdos,fotos,'2026-10-05'),[
    {id:2,rdoPendente:false,fotoPendente:true},{id:3,rdoPendente:true,fotoPendente:false},{id:4,rdoPendente:true,fotoPendente:true}]);
});
test('a site reminder reaches its field team only, never another site or office profile',()=>{
  const aviso={para:{tipo:'obra',obraId:1,perfil:'encarregado'}};
  assert.equal(avisoEhPara(aviso,{perfil:'encarregado',cargo:'Apontador',obraId:'1'}),true);
  assert.equal(avisoEhPara(aviso,{perfil:'encarregado',cargo:'Encarregado',obraId:1}),true);
  assert.equal(avisoEhPara(aviso,{perfil:'encarregado',obraId:2}),false);
  assert.equal(avisoEhPara(aviso,{perfil:'gestor',obraId:1}),false);
  assert.equal(avisoEhPara(aviso,{perfil:'encarregado'}),false);
});
