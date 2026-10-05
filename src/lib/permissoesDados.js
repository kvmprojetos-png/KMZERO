// O cliente reduz consultas/cache; a fronteira de autorização permanece nas regras.
export const AREAS_DADOS = Object.freeze({
  trabalhadores: 'equipe', ferias: 'equipe', adiantamentos: 'equipe', folhasSalvas: 'equipe', movimentacoes: 'equipe', presencas: 'equipe',
  obras: 'obras', clientes: 'obras', cronogramas: 'obras',
  pedidos: 'suprimentos', fornecedores: 'suprimentos', recebimentos: 'suprimentos',
  equips: 'equipamentos', ativos: 'equipamentos', ferramentas: 'equipamentos', manutencoes: 'equipamentos', abastecimentos: 'equipamentos', movEquip: 'equipamentos',
  diario: 'campo', rdos: 'campo', produtividade: 'campo', fotosObras: 'campo',
  despesasAvulsas: 'financeiro', config: 'sistema', links: 'sistema',
});
export function temAreaDados(u, area) {
  return !!u && u.ativo !== false && u.perfil === 'gestor'
    && (u.acessos == null || (Array.isArray(u.acessos) && u.acessos.includes(area)));
}
export const administraPessoas = u => temAreaDados(u, 'sistema') || temAreaDados(u, 'equipe');
const CAMPO_LE = new Set(['equips','ativos','ferramentas','manutencoes','abastecimentos','movEquip','movimentacoes','pedidos','recebimentos','presencas','diario','rdos','produtividade','fotosObras','cronogramas']);
const CAMPO_GRAVA = new Set(['equips','movEquip','movimentacoes','pedidos','recebimentos','presencas','diario','rdos','produtividade','fotosObras']);
const FINANCEIRO_LE = new Set(['obras','fornecedores','pedidos','recebimentos','equips','ativos','ferramentas','manutencoes','abastecimentos','movEquip']);
export function politicaColecao(u, nome) {
  const p = { colecao: nome, leitura: false, escrita: false, escopo: null };
  if (!u || u.ativo === false) return p;
  if (nome === 'mensagens') return { ...p, leitura: true, escrita: true, escopo: 'participantes' };
  if (['config','links','perfisCampo'].includes(nome)) return { ...p, leitura: true, escrita: nome !== 'perfisCampo' && temAreaDados(u, 'sistema') };
  if (nome === 'trabalhadores' && !temAreaDados(u, 'equipe')) return { ...p, colecao:'trabalhadoresCampo', leitura:true, escopo:u.perfil === 'encarregado' ? 'obraId' : null };
  if (nome === 'obras' && !temAreaDados(u, 'obras') && !temAreaDados(u, 'financeiro')) return { ...p, colecao:'obrasCampo', leitura:true };
  if (u.perfil === 'gestor') {
    const area = AREAS_DADOS[nome];
    return { ...p, leitura: !!area && (temAreaDados(u, area) || (FINANCEIRO_LE.has(nome) && temAreaDados(u, 'financeiro')) || (['presencas','cronogramas'].includes(nome) && temAreaDados(u,'campo'))), escrita: !!area && (temAreaDados(u, area) || (nome === 'obras' && temAreaDados(u,'financeiro'))) };
  }
  if (u.perfil !== 'encarregado' || u.obraId == null || u.obraId === '') return p;
  return { ...p, leitura:CAMPO_LE.has(nome), escrita:CAMPO_GRAVA.has(nome), escopo:nome === 'movimentacoes' ? 'movPessoal' : nome === 'movEquip' ? 'movEquip' : 'obraId' };
}
export const CAMPOS_TRABALHADOR_CAMPO = ['id','nome','cargo','obraId','ativo'];
export const CAMPOS_OBRA_CAMPO = ['id','nome','local','status','tipo','apontadorId'];
export const CAMPOS_PERFIL_CAMPO = ['id','firebaseUid','nome','perfil','obraId','ativo'];
const selecionar = (d, campos) => Object.fromEntries(campos.filter(k => d[k] !== undefined).map(k => [k,d[k]]));
export const trabalhadorCampo = d => selecionar(d, CAMPOS_TRABALHADOR_CAMPO);
export const obraCampo = d => selecionar(d, CAMPOS_OBRA_CAMPO);
export const perfilCampo = (d,uid) => selecionar({...d,id:uid,firebaseUid:uid,nome:d.nome || '',ativo:d.ativo !== false}, CAMPOS_PERFIL_CAMPO);
export function variantesId(v) {
  if (v === null || v === undefined || v === '') return [];
  const s = String(v), n = Number(s);
  return Number.isSafeInteger(n) && String(n) === s ? [s,n] : [s];
}
export function filtrarDadosPermitidos(u, nome, dados) {
  const p = politicaColecao(u,nome);
  if (!p.leitura || !Array.isArray(dados)) return [];
  let lista = dados;
  const mesmo = v => u.obraId != null && v != null && String(v) === String(u.obraId);
  if (p.escopo === 'participantes') lista = lista.filter(d => [d.de,d.para].includes(u.firebaseUid || u.id));
  else if (p.escopo === 'movPessoal') lista = lista.filter(d => mesmo(d.obraOrigem) || mesmo(d.obraDestino));
  else if (p.escopo === 'movEquip') lista = lista.filter(d => mesmo(d.obraOrigemId) || mesmo(d.obraDestinoId));
  else if (p.escopo) lista = lista.filter(d => mesmo(d[p.escopo]));
  if (p.colecao === 'trabalhadoresCampo') return lista.map(trabalhadorCampo);
  if (p.colecao === 'obrasCampo') return lista.map(obraCampo);
  return lista;
}
export function filtrarCachePermitido(u, chave, valor, trabalhadores = []) {
  if (!u || u.ativo === false) return null;
  if (chave === 'usuarios') return administraPessoas(u) ? valor : (Array.isArray(valor) ? valor.map(d => perfilCampo(d,d.firebaseUid || d.id)) : []);
  if (chave === 'historico') {
    if (u.perfil === 'gestor' && politicaColecao(u,'presencas').leitura) return valor;
    if (u.perfil !== 'encarregado') return {};
    const ids = new Set(trabalhadores.map(t => String(t.id)));
    return Object.fromEntries(Object.entries(valor || {}).map(([dia,ps]) => [dia,Object.fromEntries(Object.entries(ps || {}).filter(([id]) => ids.has(id)))]));
  }
  if (chave === 'cronogramas') return Object.fromEntries(filtrarDadosPermitidos(u,'cronogramas',Object.entries(valor || {}).map(([id,etapas]) => ({id,obraId:id,etapas}))).map(d => [d.id,d.etapas]));
  if (chave === 'empresa') return valor;
  return filtrarDadosPermitidos(u,chave === 'rdos' ? 'rdos' : chave,valor);
}
