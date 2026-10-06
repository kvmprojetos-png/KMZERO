import {createHash} from 'node:crypto';
import {enviarPush} from './enviarAviso.js';

export function obrasComPontoPendente(obras,trabalhadores,presencas) {
  const registrados=new Set(presencas.map(p=>String(p.trabId)));
  return obras.map(o=>{
    const equipe=trabalhadores.filter(t=>t.ativo!==false&&String(t.obraId)===String(o.id));
    return {...o,pontoPendente:equipe.filter(t=>!registrados.has(String(t.id))).length};
  }).filter(o=>o.pontoPendente>0);
}
export function diaRegistro(r) {
  if(typeof r.dataIso==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.dataIso))return r.dataIso;
  const s=String(r.data || '').trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const br=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : '';
}
export function pendenciasFechamento(obras,rdos,fotos,hoje) {
  const comRdo=new Set(rdos.filter(r=>diaRegistro(r)===hoje).map(r=>String(r.obraId)));
  const comFoto=new Set(fotos.filter(r=>diaRegistro(r)===hoje).map(r=>String(r.obraId)));
  return obras.map(o=>({...o,rdoPendente:!comRdo.has(String(o.id)),fotoPendente:!comFoto.has(String(o.id))}))
    .filter(o=>o.rdoPendente||o.fotoPendente);
}
// create é atômico: duas invocações do cron não publicam/disparam o mesmo lembrete.
export async function publicarLembreteCampo(db,mensageiro,empresaId,chave,aviso,{enviar=enviarPush,agora=Date.now()}={}) {
  const base=db.collection('empresas').doc(empresaId);
  const id=`cron-${createHash('sha256').update(chave).digest('hex')}`;
  const ref=base.collection('avisos').doc(id);
  const doc={id,de:'sistema',deNome:'KMZERO',criadoEm:agora,...aviso,push:{disparadoEm:agora}};
  try {await ref.create(doc);}catch(e){if([6,409].includes(Number(e.code)))return null;throw e;}
  try {
    const r=await enviar(db,mensageiro,empresaId,doc);
    await ref.update({'push.pessoas':r.pessoas,'push.aparelhos':r.aparelhos});
    await base.collection('avisosEnviados').doc(chave).set({chave,em:agora});
    return {titulo:doc.titulo,...r};
  }catch(e){await ref.update({'push.falhouEm':Date.now()});throw e;}
}
