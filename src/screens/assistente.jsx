import {useEffect,useRef,useState} from 'react';
import {auth} from '../firebase.js';
import {KMHeader,KMFooter,Btn} from '../components/ui.jsx';
import {T,NAVY,GOLD,selS} from '../theme.js';
import './assistente.css';

const MODOS = [
  {id:'resumo',titulo:'Resumo da obra',desc:'Entenda o que está registrado e o que ainda falta conferir.'},
  {id:'prioridades',titulo:'Prioridades',desc:'Transforme pendências registradas em próximos passos.'},
  {id:'relatorio',titulo:'Rascunho de relatório',desc:'Prepare um texto para revisar antes de compartilhar.'},
];
async function consultar(empresaId,{obraId,modo,signal}={}) {
  if (!auth.currentUser) throw new Error('Entre na sua conta para consultar as obras.');
  const token = await auth.currentUser.getIdToken();
  if (signal?.aborted) throw new DOMException('Cancelado','AbortError');
  const url = modo ? '/api/assistente' : `/api/assistente?empresaId=${encodeURIComponent(empresaId)}${obraId ? `&obraId=${encodeURIComponent(obraId)}` : ''}`;
  const r = await fetch(url,{method:modo ? 'POST':'GET',cache:'no-store',signal,
    headers:{Authorization:`Bearer ${token}`,...(modo ? {'Content-Type':'application/json'}:{})},
    ...(modo ? {body:JSON.stringify({empresaId,obraId,modo,consentimento:true})}:{})});
  const j = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(j.erro || 'Não foi possível concluir a consulta.');
  return j;
}

export function TelaAssistente({empresaId,demo,onBack}) {
  const [dados,setDados]=useState(null),[obraId,setObraId]=useState(''),[modo,setModo]=useState('resumo');
  const [consentiu,setConsentiu]=useState(false),[carregando,setCarregando]=useState(true),[ocupado,setOcupado]=useState(false);
  const [erro,setErro]=useState(''),[resultado,setResultado]=useState(null),[consulta,setConsulta]=useState(0),[copiado,setCopiado]=useState('');
  const geracao=useRef(null);
  useEffect(()=>{setObraId('');setResultado(null);},[empresaId,demo]);
  useEffect(()=>{
    const c=new AbortController();
    setDados(null);setErro('');setResultado(null);setConsentiu(false);setCarregando(true);setOcupado(false);setCopiado('');
    if (demo) {setCarregando(false);return;}
    consultar(empresaId,{obraId,signal:c.signal}).then(d=>{
      if(c.signal.aborted)return;
      setDados(d);
      if (!obraId && d.obras.length) setObraId(d.obras[0].id);
    }).catch(e=>{if(!c.signal.aborted)setErro(e.message);}).finally(()=>{if(!c.signal.aborted)setCarregando(false);});
    return ()=>{c.abort();geracao.current?.abort();};
  },[empresaId,demo,obraId,consulta]);
  const gerar=async()=>{
    if (!consentiu || !dados?.configurado || !dados?.contexto || ocupado) return;
    const c=new AbortController();geracao.current=c;
    const timer=setTimeout(()=>c.abort(),30000);
    setOcupado(true);setErro('');setResultado(null);setCopiado('');
    try {
      const d=await consultar(empresaId,{obraId,modo,signal:c.signal});
      if(!c.signal.aborted){setResultado(d.analise);setDados(v=>({...v,contexto:d.contexto}));}
    } catch(e){if(geracao.current===c)setErro(e.name==='AbortError' ? 'A análise demorou demais ou foi interrompida. Você pode tentar novamente.' : e.message);}
    finally{clearTimeout(timer);if(geracao.current===c){geracao.current=null;setOcupado(false);}}
  };
  const copiar=async()=>{
    try {await navigator.clipboard.writeText(resultado.texto);setCopiado('Texto copiado. Revise antes de compartilhar.');}
    catch {setCopiado('Selecione o texto abaixo e copie manualmente.');}
  };
  const contexto=dados?.contexto;
  return <div className="km-assistente" style={{display:'flex',flexDirection:'column',flex:1}}>
    <KMHeader title="Assistente de obras" sub="Análise para o gestor" onBack={onBack}/>
    <main className="km-ia-main">
      <section className="km-ia-hero">
        <span className="km-ia-kicker">KMZERO · ASSISTENTE</span>
        <h1>Mais clareza para<br/><span>conduzir sua obra.</span></h1>
        <p>Escolha uma obra. Confira o resumo dos dados e peça uma análise para apoiar seu acompanhamento.</p>
      </section>
      {demo ? <section className="km-ia-card"><h2>Entre na sua empresa</h2><p>O assistente usa os registros da sua conta. A demonstração não envia dados à IA.</p></section> : <>
        {carregando && <p role="status">Carregando dados autorizados da obra…</p>}
        {erro && <p role="alert" className="km-ia-erro">{erro}</p>}
        {!carregando && !dados && <Btn label="Conferir novamente" onClick={()=>setConsulta(v=>v+1)}/>}
        {dados && <>
          <section className="km-ia-card">
            <label htmlFor="km-ia-obra" className="km-ia-label">Obra em análise</label>
            <select id="km-ia-obra" style={selS} value={obraId} disabled={ocupado || !dados.obras.length} onChange={e=>setObraId(e.target.value)}>
              {!dados.obras.length && <option value="">Nenhuma obra disponível</option>}
              {dados.obras.map(o=><option key={o.id} value={o.id}>{o.nome || 'Obra sem nome'}</option>)}
            </select>
            {dados.parcial && <p>Exibindo as primeiras 100 obras acessíveis.</p>}
            {contexto && <>
              <div className="km-ia-metricas">
                <div><strong>{contexto.cronograma?.atrasadas ?? '—'}</strong><span>Etapas com prazo vencido e avanço registrado</span></div>
                <div><strong>{contexto.suprimentos?.aguardando ?? '—'}</strong><span>Pedidos aguardando na amostra</span></div>
                <div><strong>{contexto.cronograma?.totalEtapas ?? '—'}</strong><span>Etapas cadastradas</span></div>
              </div>
              <p className="km-ia-nota">Dados da nuvem em {contexto.dataReferencia}. “—” indica informação ausente ou fora da sua área de acesso. A análise será feita com uma nova consulta.</p>
              <details><summary>Ver os dados que serão usados</summary><pre>{JSON.stringify(contexto,null,2)}</pre></details>
            </>}
          </section>
          <section className="km-ia-card">
            <h2>O que você precisa agora?</h2>
            <div className="km-ia-modos" role="group" aria-label="Tipo de análise">
              {MODOS.map(m=><button type="button" key={m.id} aria-pressed={modo===m.id} disabled={ocupado} onClick={()=>{setModo(m.id);setResultado(null);setCopiado('');}}><strong>{m.titulo}</strong><span>{m.desc}</span></button>)}
            </div>
            {!dados.configurado && <p role="status" className="km-ia-pendente">IA aguardando ativação do administrador. Os dados da obra acima já estão disponíveis.</p>}
            <label className="km-ia-consentimento"><input type="checkbox" checked={consentiu} disabled={ocupado || !dados.configurado} onChange={e=>setConsentiu(e.target.checked)}/><span>Autorizo enviar à Groq o nome e a situação da obra, etapas do cronograma e contagens de pedidos exibidos acima para esta análise.</span></label>
            <p className="km-ia-nota">Esta análise não inclui folha, documentos pessoais, contatos ou fotos. Limite de 20 solicitações por empresa/dia, sujeito à disponibilidade do provedor.</p>
            <Btn label={ocupado ? 'Analisando a obra…' : 'Gerar análise'} color={GOLD} text={NAVY} disabled={ocupado || carregando || !consentiu || !dados.configurado || !contexto} onClick={gerar}/>
          </section>
          {resultado && <section className="km-ia-card" aria-label="Resultado da análise">
            <div className="km-ia-resultado-topo"><h2>{MODOS.find(m=>m.id===modo)?.titulo}</h2><button type="button" onClick={copiar}>Copiar texto</button></div>
            <p className="km-ia-nota">Rascunho gerado em {new Date(resultado.geradoEm).toLocaleString('pt-BR')} · Confira os fatos e as sugestões antes de usar.</p>
            {resultado.incompleto && <p role="status">O texto atingiu o limite de tamanho e pode estar incompleto.</p>}
            <div className="km-ia-resultado" role="status">{resultado.texto}</div>
            {copiado && <p role="status">{copiado}</p>}
          </section>}
        </>}
      </>}
    </main><KMFooter/>
  </div>;
}
