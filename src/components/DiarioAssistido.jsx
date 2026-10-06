import {useEffect,useRef,useState} from 'react';
import {auth} from '../firebase.js';
import {T,NAVY,GOLD,inputS} from '../theme.js';

async function consultar(empresaId,obraId,{relato,signal}={}) {
  if (!auth.currentUser) throw new Error('Entre na sua conta para usar a IA no diário.');
  const token=await auth.currentUser.getIdToken();
  if (signal.aborted) throw new DOMException('Cancelado','AbortError');
  const post=relato!==undefined;
  const url=post ? '/api/diario-ia' : `/api/diario-ia?empresaId=${encodeURIComponent(empresaId)}&obraId=${encodeURIComponent(obraId)}`;
  const r=await fetch(url,{method:post ? 'POST':'GET',cache:'no-store',signal,
    headers:{Authorization:`Bearer ${token}`,...(post ? {'Content-Type':'application/json'}:{})},
    ...(post ? {body:JSON.stringify({empresaId,obraId:String(obraId),relato,consentimento:true})}:{})});
  const j=await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(j.erro || 'Não foi possível consultar a IA. Seu relato foi preservado.');
  return j;
}

export function DiarioAssistido({empresaId,obraId,texto,onAplicar,onOcupado,disabled=false,demo=false}) {
  const [configurado,setConfigurado]=useState(false),[verificando,setVerificando]=useState(true);
  const [consentiu,setConsentiu]=useState(false),[ocupado,setOcupado]=useState(false);
  const [erro,setErro]=useState(''),[rascunho,setRascunho]=useState(null),[revisado,setRevisado]=useState(false);
  const pedido=useRef(null);
  useEffect(()=>{onOcupado?.(ocupado);},[ocupado,onOcupado]);
  useEffect(()=>{
    const c=new AbortController();let ativo=true;setConfigurado(false);setVerificando(true);setErro('');
    if (demo || !empresaId || obraId==null) {setVerificando(false);return;}
    const timer=setTimeout(()=>{c.abort();if(ativo){setVerificando(false);setErro('Não foi possível conferir a IA agora. Você pode continuar escrevendo o diário.');}},15000);
    consultar(empresaId,obraId,{signal:c.signal}).then(d=>{if(!c.signal.aborted)setConfigurado(d.configurado);})
      .catch(e=>{if(!c.signal.aborted)setErro(e.message);})
      .finally(()=>{clearTimeout(timer);if(!c.signal.aborted)setVerificando(false);});
    return ()=>{ativo=false;clearTimeout(timer);c.abort();};
  },[empresaId,obraId,demo]);
  useEffect(()=>{
    pedido.current?.abort();pedido.current=null;setConsentiu(false);setRascunho(null);setRevisado(false);setOcupado(false);
    return ()=>{pedido.current?.abort();pedido.current=null;};
  },[texto,empresaId,obraId]);
  const organizar=async()=>{
    if (disabled || ocupado || !configurado || !consentiu || texto.trim().length<10 || texto.length>5000) return;
    const c=new AbortController();pedido.current=c;
    const timer=setTimeout(()=>c.abort(),30000);setOcupado(true);setErro('');setRascunho(null);setRevisado(false);
    try {
      const d=await consultar(empresaId,obraId,{relato:texto,signal:c.signal});
      if (pedido.current===c && !c.signal.aborted)setRascunho(d.rascunho);
    } catch(e) {if(pedido.current===c)setErro(e.name==='AbortError' ? 'A IA demorou demais. Seu relato foi preservado.' : e.message);}
    finally {clearTimeout(timer);if(pedido.current===c){pedido.current=null;setOcupado(false);}}
  };
  const podeOrganizar=configurado && consentiu && !disabled && !ocupado && texto.trim().length>=10 && texto.length<=5000;
  return <section aria-label="Diário com IA" style={{border:`1px solid ${T.borda}`,borderRadius:10,padding:12,marginBottom:12}}>
    <h2 style={{fontSize:15,color:T.titulo,margin:'0 0 6px'}}>Organizar o relato com IA</h2>
    <p style={{fontSize:12,color:T.texto2,margin:'0 0 10px'}}>Dite ou escreva o que aconteceu. A IA prepara um rascunho; você confere e decide o que registrar.</p>
    {demo ? <p role="status">A demonstração não envia relatos à IA.</p>
      : verificando ? <p role="status">Conferindo disponibilidade da IA…</p>
      : !configurado && !erro ? <p role="status">IA aguardando ativação do administrador. Você pode continuar escrevendo o diário.</p> : null}
    <label style={{display:'flex',gap:8,alignItems:'flex-start',fontSize:12,color:T.texto}}>
      <input type="checkbox" checked={consentiu} disabled={!configurado || disabled || ocupado} onChange={e=>setConsentiu(e.target.checked)}/>
      <span>Autorizo enviar à Groq o texto acima e o nome desta obra para organizar este diário.</span>
    </label>
    <p style={{fontSize:11,color:T.texto2}}>Confira o relato antes do envio. Fotos, folha e outros cadastros não são consultados pela IA. Até 5.000 caracteres; o diário compartilha o limite de 20 análises da empresa por dia.</p>
    <button type="button" disabled={!podeOrganizar} onClick={organizar} style={{background:podeOrganizar ? GOLD:T.superficie2,color:NAVY,border:'none',borderRadius:8,padding:'11px 14px',fontWeight:800,cursor:podeOrganizar ? 'pointer':'default',width:'100%'}}>{ocupado ? 'Organizando o relato…':'Organizar com IA'}</button>
    {erro && <p role="alert" style={{color:T.erroTexto,fontSize:12}}>{erro}</p>}
    {rascunho && <div style={{marginTop:14}}>
      <label style={{display:'block',fontWeight:700,fontSize:13,color:T.titulo,marginBottom:6}}>Rascunho do diário — revise antes de usar
        <textarea aria-label="Rascunho do diário" value={rascunho.texto} maxLength={5000} rows={9} onChange={e=>{const valor=e.target.value;setRascunho(d=>({...d,texto:valor}));setRevisado(false);}} style={{...inputS,marginTop:6,fontFamily:'inherit',resize:'vertical'}}/>
      </label>
      {rascunho.conferir.length>0 && <><p style={{fontWeight:700,fontSize:12,color:T.titulo}}>Pontos a conferir com quem relatou:</p><ul style={{fontSize:12,color:T.texto2,paddingLeft:20}}>{rascunho.conferir.map((p,i)=><li key={i}>{p}</li>)}</ul></>}
      <label style={{display:'flex',gap:8,fontSize:12,color:T.texto,marginBottom:10}}><input type="checkbox" checked={revisado} onChange={e=>setRevisado(e.target.checked)}/><span>Revisei o rascunho e os pontos a conferir.</span></label>
      <button type="button" disabled={!revisado || !rascunho.texto.trim()} onClick={()=>{if(revisado && rascunho.texto.trim())onAplicar(rascunho.texto);}} style={{background:revisado ? NAVY:T.superficie2,color:revisado ? '#fff':T.texto2,border:'none',borderRadius:8,padding:'10px 14px',fontWeight:700,width:'100%'}}>Usar texto revisado no diário</button>
      <p style={{fontSize:11,color:T.texto2}}>Usar o texto preenche a anotação. O registro só é salvo quando você toca em Adicionar anotação.</p>
    </div>}
  </section>;
}
