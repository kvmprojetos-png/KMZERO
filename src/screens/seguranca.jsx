import { useEffect, useState } from 'react';
import { auth } from '../firebase.js';
import { KMHeader, KMFooter, Btn } from '../components/ui.jsx';
import { T, NAVY, GREEN } from '../theme.js';

export function TelaSeguranca({empresaId,dono,demo,onBack}) {
  const [status,setStatus] = useState(null), [ocupado,setOcupado] = useState(false), [erro,setErro] = useState(''), [progresso,setProgresso] = useState('');
  const [servidorPronto,setServidorPronto] = useState(false), [conferindo,setConferindo] = useState(true), [consulta,setConsulta] = useState(0);
  const chamada = async body => {
    if (!auth.currentUser || demo) throw new Error('Entre na conta proprietária da empresa.');
    const token = await auth.currentUser.getIdToken();
    const resposta = await fetch(body ? '/api/seguranca' : `/api/seguranca?empresaId=${encodeURIComponent(empresaId)}`, {
      method:body ? 'POST':'GET', headers:{Authorization:`Bearer ${token}`,...(body ? {'Content-Type':'application/json'}:{})},
      ...(body ? {body:JSON.stringify({empresaId,...body})}:{}), cache:'no-store',
    });
    const dados = await resposta.json().catch(() => ({}));
    if (resposta.status === 503) {
      setServidorPronto(false);
      throw new Error('Serviço de segurança indisponível. A configuração do servidor precisa ser concluída antes do backup e da migração.');
    }
    if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível concluir. Tente novamente.');
    return dados;
  };
  useEffect(() => {
    let vivo = true;
    setServidorPronto(false); setStatus(null); setErro(''); setConferindo(true);
    if (dono && !demo) chamada().then(d => {if(vivo){setStatus(d);setServidorPronto(true);}}).catch(e => {if(vivo)setErro(e.message);}).finally(() => {if(vivo)setConferindo(false);});
    else setConferindo(false);
    return () => {vivo=false;};
  },[empresaId,dono,demo,consulta]);
  const backup = async () => {
    setOcupado(true); setErro(''); setProgresso('Criando e conferindo a cópia privada…');
    try { const r=await chamada({acao:'backup'}); setStatus(s => ({...s,backup:r.backup})); setProgresso('Cópia privada criada e integridade conferida.'); }
    catch(e){setErro(e.message);setProgresso('');} finally{setOcupado(false);}
  };
  const migrar = async () => {
    setOcupado(true);setErro('');
    try {
      for(let rodada=0;rodada<10000;rodada++) {
        const r=await chamada({acao:'migrar',backupId:status.backup.id});
        setStatus(s => ({...s,estado:r.estado}));
        if (r.falhas?.length) throw new Error('Alguns registros precisam de revisão. A cópia foi preservada e a migração pode ser retomada sem repetir registros concluídos.');
        setProgresso(`Atualizando proteção: ${r.etapa || 'conferência'} · ${r.examinados || 0} registros nesta etapa.`);
        if(r.concluido){setProgresso('Migração concluída. Permissões separadas e links antigos das fotos invalidados.');return;}
      }
      throw new Error('Pausa de processamento. Toque em continuar para concluir.');
    } catch(e){setErro(e.message);} finally{setOcupado(false);}
  };
  return <div style={{display:'flex',flexDirection:'column',flex:1}}>
    <KMHeader title="Segurança e cópias" onBack={ocupado ? undefined : onBack}/>
    <main style={{padding:24,maxWidth:740,color:T.texto,background:T.fundo}}>
      <h2 style={{color:T.titulo}}>Dados protegidos por função</h2>
      <p>A equipe de campo recebe os dados operacionais da obra. Cadastros pessoais e folha ficam nas áreas autorizadas.</p>
      {!dono || demo ? <p>As cópias da nuvem e a atualização dos dados antigos são administradas pela conta proprietária da empresa.</p> : <>
        <p>A cópia abaixo fica privada na nuvem da empresa. Ela é conferida antes de atualizar registros antigos e invalidar links de fotos.</p>
        {status?.backup && <p role="status">Última cópia verificada: {new Date(status.backup.criadoEm).toLocaleString('pt-BR')}.</p>}
        {status?.estado?.versao === 1 && status?.estado?.status === 'concluido' && <p>Proteção dos registros existentes: concluída.</p>}
        {conferindo && <p role="status">Conferindo disponibilidade do serviço…</p>}
        <Btn label={ocupado ? 'Processando…' : 'Criar cópia privada de segurança'} color={NAVY} disabled={ocupado || !servidorPronto} onClick={backup}/>
        {status?.backup?.verificado && <Btn label="Concluir proteção dos dados antigos" color={GREEN} disabled={ocupado || !servidorPronto} onClick={migrar}/>}
        {progresso && <p role="status">{progresso}</p>}
        {erro && <p role="alert" style={{color:T.erroTexto || '#b42318'}}>{erro}</p>}
        {!servidorPronto && !conferindo && <Btn label="Conferir serviço novamente" color={NAVY} disabled={ocupado} onClick={()=>setConsulta(v=>v+1)}/>}
      </>}
      <p>Ao sair em um aparelho compartilhado, use a opção de guardar uma cópia e limpar os dados locais. A autenticação em duas etapas da hospedagem deve ser configurada com o autenticador do proprietário.</p>
    </main><KMFooter/>
  </div>;
}
