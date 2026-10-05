import test from 'node:test';
import assert from 'node:assert/strict';
import { politicaColecao,filtrarCachePermitido,filtrarDadosPermitidos,perfilCampo } from '../src/lib/permissoesDados.js';
import { avisoEhPara,podeEnviarAviso } from '../src/lib/avisosRegras.js';
const campo={firebaseUid:'enc',perfil:'encarregado',obraId:12,ativo:true};
const gerente=acessos=>({firebaseUid:'g',perfil:'gestor',acessos,ativo:true});
test('obra e trabalhador do canteiro nunca contêm RH ou contratos em cache',()=>{
  assert.deepEqual(filtrarDadosPermitidos(campo,'trabalhadores',[{id:1,obraId:'12',nome:'Jo',cpf:'secreto',salario:6000,aso:'restrito'},{id:2,obraId:99,nome:'outra'}]),[{id:1,obraId:'12',nome:'Jo'}]);
  assert.deepEqual(filtrarDadosPermitidos(campo,'obras',[{id:12,nome:'A',valorContrato:9000,clienteDoc:'secret'}]),[{id:12,nome:'A'}]);
});
test('áreas vazias ou inválidas não concedem acesso a dados; sistema não equivale a RH',()=>{
  for(const acesso of [[],['visao'],['sistema'],'equipe']) {
    assert.equal(politicaColecao(gerente(acesso),'folhasSalvas').leitura,false);
    assert.equal(politicaColecao(gerente(acesso),'trabalhadores').colecao,'trabalhadoresCampo');
  }
  assert.equal(politicaColecao(gerente(null),'folhasSalvas').escrita,true);
  assert.equal(politicaColecao(gerente(['equipe']),'folhasSalvas').escrita,true);
});
test('financeiro pode consultar custos mas não alterar cadastros de equipamentos',()=>{
  const p=politicaColecao(gerente(['financeiro']),'equips');
  assert.equal(p.leitura,true);assert.equal(p.escrita,false);
  assert.equal(politicaColecao(gerente(['campo']),'presencas').escrita,false);
});
test('mensagens e presenças em cache ficam limitadas ao próprio escopo',()=>{
  assert.equal(filtrarCachePermitido(campo,'mensagens',[{de:'a',para:'b'},{de:'enc',para:'b'}]).length,1);
  assert.deepEqual(filtrarCachePermitido(campo,'historico',{'2026-10-05':{1:'Presente',2:'Falta'}},[{id:1}]),{'2026-10-05':{1:'Presente'}});
  assert.deepEqual(filtrarCachePermitido(gerente(['visao']),'historico',{'2026-10-05':{1:'Presente'}}),{});
});
test('notificações de folha respeitam RH tanto na tela quanto no push',()=>{
  const aviso={para:{tipo:'area',area:'equipe'}};
  assert.equal(avisoEhPara(aviso,gerente(['obras'])),false);
  assert.equal(avisoEhPara(aviso,gerente(['equipe'])),true);
  assert.equal(avisoEhPara({para:{tipo:'area',area:'total'}},gerente(['sistema'])),false);
  assert.equal(podeEnviarAviso(campo,{tipo:'area',area:'equipe'}),false);
  assert.equal(podeEnviarAviso(campo,{tipo:'area',area:'suprimentos'}),true);
});
test('diretório mínimo não carrega emails, telefones nem concessões de acesso',()=>{
  assert.deepEqual(perfilCampo({nome:'Ana',perfil:'gestor',email:'privado',tel:'privado',acessos:null},'u'),{id:'u',firebaseUid:'u',nome:'Ana',perfil:'gestor',ativo:true});
});
