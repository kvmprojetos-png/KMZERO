import {firebaseAdmin} from './_lib/firebaseAdmin.js';
import {idFotoValido} from '../src/lib/fotoCaminho.js';
import {politicaColecao} from '../src/lib/permissoesDados.js';
import {reservarAnalise,ErroAssistente} from './_lib/assistenteObras.js';
import {organizarRelatoDiario} from './_lib/diarioIA.js';
import {isoNoFuso} from '../src/lib/avisosRegras.js';

const LOGIN = new Set(['auth/argument-error','auth/invalid-id-token','auth/id-token-expired','auth/id-token-revoked','auth/user-disabled','auth/user-not-found']);
function pedido(req,res) {
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Authorization');
  if (!['GET','POST'].includes(req.method)) {res.setHeader('Allow','GET, POST');res.status(405).json({erro:'Use GET ou POST.'});return null;}
  const h=req.headers?.authorization;
  const token=typeof h==='string' && h.length<=16384 ? /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(h)?.[1] : null;
  if (!token) {res.status(401).json({erro:'Entre na sua conta.'});return null;}
  const b=req.method==='POST' ? req.body : req.query;
  if (!b || typeof b!=='object' || Array.isArray(b) || !idFotoValido(b.empresaId) || !idFotoValido(b.obraId)) {
    res.status(400).json({erro:'Escolha uma empresa e obra válidas.'});return null;
  }
  if (req.method==='POST' && (b.consentimento!==true || typeof b.relato!=='string' || b.relato.trim().length<10 || b.relato.length>5000
    || Object.keys(b).some(k=>!['empresaId','obraId','relato','consentimento'].includes(k))
    || Buffer.byteLength(JSON.stringify(b),'utf8')>24000 || Number(req.headers?.['content-length'] || 0)>24000)) {
    res.status(400).json({erro:'Confira um relato de 10 a 5.000 caracteres e autorize o envio à Groq.'});return null;
  }
  return {token,empresaId:b.empresaId,obraId:b.obraId,relato:b.relato};
}

export default async function handler(req,res) {
  if (!pedido(req,res)) return;
  let admin;try {admin=firebaseAdmin();} catch {return res.status(503).json({erro:'Diário indisponível no servidor.'});}
  return tratarDiarioIA(admin,req,res);
}

export async function tratarDiarioIA({db,auth},req,res,{key=process.env.GROQ_API_KEY,fetchImpl=fetch,agora=Date.now()}={}) {
  const p=pedido(req,res);if (!p) return;
  try {
    const eu=await auth.verifyIdToken(p.token,true);
    const perfil=(await db.collection('usuarios').doc(eu.uid).get()).data();
    const acesso=politicaColecao(perfil,'diario');
    if (!perfil || perfil.empresaId!==p.empresaId || !acesso.escrita
      || (acesso.escopo && String(perfil.obraId)!==p.obraId))
      return res.status(403).json({erro:'Use uma obra vinculada ao seu acesso de campo.'});
    const colecao=politicaColecao(perfil,'obras').colecao;
    const obra=await db.collection('empresas').doc(p.empresaId).collection(colecao).doc(p.obraId).get();
    if (!obra.exists) return res.status(404).json({erro:'Obra não encontrada no seu acesso.'});
    if (req.method==='GET') return res.status(200).json({configurado:!!key,limiteEmpresaPorDia:20});
    if (!key) throw new ErroAssistente(503,'A IA ainda precisa ser ativada pelo administrador.');
    await reservarAnalise(db,p.empresaId,eu.uid,agora);
    const contexto={dataReferencia:isoNoFuso(new Date(agora)),obra:{nome:typeof obra.data().nome==='string' ? obra.data().nome.slice(0,100) : ''},relato:p.relato.trim()};
    const rascunho=await organizarRelatoDiario(contexto,{key,fetchImpl});
    return res.status(200).json({rascunho,obraId:p.obraId});
  } catch(e) {
    if (LOGIN.has(e.code)) return res.status(401).json({erro:'Sessão expirada. Entre novamente.'});
    if (e instanceof ErroAssistente) return res.status(e.status).json({erro:e.message});
    console.error('diario-ia:',e.code || 'falha-interna');
    return res.status(500).json({erro:'Não foi possível organizar o diário agora. Seu relato foi preservado.'});
  }
}
