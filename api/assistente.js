import { firebaseAdmin } from './_lib/firebaseAdmin.js';
import { idFotoValido } from '../src/lib/fotoCaminho.js';
import { MODELO_IA, MODOS_IA, podeUsarAssistente, listarObrasAssistente, contextoObraAssistente, reservarAnalise, analisarComGroq, ErroAssistente } from './_lib/assistenteObras.js';

const LOGIN = new Set(['auth/argument-error','auth/invalid-id-token','auth/id-token-expired','auth/id-token-revoked','auth/user-disabled','auth/user-not-found']);
function pedido(req,res) {
  res.setHeader('Cache-Control','private, no-store'); res.setHeader('Vary','Authorization');
  if (!['GET','POST'].includes(req.method)) {res.setHeader('Allow','GET, POST');res.status(405).json({erro:'Use GET ou POST.'});return null;}
  const h = req.headers?.authorization;
  const token = typeof h === 'string' && h.length <= 16384 ? /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(h)?.[1] : null;
  if (!token) {res.status(401).json({erro:'Entre na sua conta.'});return null;}
  const b = req.method === 'POST' ? req.body : req.query;
  if (!b || typeof b !== 'object' || Array.isArray(b) || !idFotoValido(b.empresaId)
    || (b.obraId !== undefined && !idFotoValido(b.obraId))) {res.status(400).json({erro:'Escolha uma empresa e obra válidas.'});return null;}
  if (req.method === 'POST' && (!b.obraId || typeof b.modo !== 'string' || !Object.hasOwn(MODOS_IA,b.modo) || b.consentimento !== true
    || Object.keys(b).some(k=>!['empresaId','obraId','modo','consentimento'].includes(k))
    || Number(req.headers?.['content-length'] || 0) > 2048)) {res.status(400).json({erro:'Escolha a análise e confirme o envio do resumo operacional à Groq.'});return null;}
  return {token,empresaId:b.empresaId,obraId:b.obraId,modo:b.modo};
}

export default async function handler(req,res) {
  if (!pedido(req,res)) return;
  let admin;
  try {admin=firebaseAdmin();}
  catch {return res.status(503).json({erro:'Serviço de obras indisponível no servidor.'});}
  return tratarAssistente(admin,req,res);
}

export async function tratarAssistente({db,auth},req,res,{key=process.env.GROQ_API_KEY,fetchImpl=fetch,agora=Date.now()}={}) {
  const p = pedido(req,res); if (!p) return;
  try {
    const eu = await auth.verifyIdToken(p.token,true);
    const perfil = (await db.collection('usuarios').doc(eu.uid).get()).data();
    if (!perfil || perfil.empresaId !== p.empresaId || !podeUsarAssistente(perfil))
      return res.status(403).json({erro:'O assistente exige acesso de gestor a obras, campo, suprimentos ou financeiro desta empresa.'});
    if (req.method === 'GET') {
      const lista = await listarObrasAssistente(db,p.empresaId,perfil);
      const contexto = p.obraId ? await contextoObraAssistente(db,p.empresaId,p.obraId,perfil,agora) : null;
      return res.status(200).json({...lista,contexto,configurado:!!key,provedor:'Groq',modelo:MODELO_IA,limiteEmpresaPorDia:20});
    }
    if (!key) throw new ErroAssistente(503,'A IA ainda precisa ser ativada pelo administrador.');
    const contexto = await contextoObraAssistente(db,p.empresaId,p.obraId,perfil,agora);
    await reservarAnalise(db,p.empresaId,eu.uid,agora);
    const analise = await analisarComGroq(contexto,p.modo,{key,fetchImpl});
    return res.status(200).json({analise,contexto,obraId:p.obraId,modo:p.modo});
  } catch(e) {
    if (LOGIN.has(e.code)) return res.status(401).json({erro:'Sessão expirada. Entre novamente.'});
    if (e instanceof ErroAssistente) return res.status(e.status).json({erro:e.message});
    console.error('assistente:',e.code || 'falha-interna');
    return res.status(500).json({erro:'Não foi possível carregar os dados da obra. Tente novamente.'});
  }
}
