import {useEffect,useState,useSyncExternalStore} from 'react';

const CHAVE='kmzeroNavegacao';
const ENTRADA=new Set(['login','primeiro_acesso','registro','convite_empresa']);
const rota=(tela,contexto={})=>Object.freeze({tela,contexto:Object.freeze({...contexto})});
const iguais=(a,b)=>a.tela===b.tela && JSON.stringify(a.contexto)===JSON.stringify(b.contexto);
const novaSessao=()=>`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// A pilha contém apenas telas/contexto de navegação, nunca dados da obra ou login.
// O navegador recebe só um identificador efêmero e a posição dessa pilha em memória.
export function criarNavegacao({inicial='login',janela,raiz=()=>inicial}={}) {
  let entradas=[rota(inicial)],posicao=0,sessao=novaSessao(),iniciada=false,voltando=false,destinoPendente=null;
  const ouvintes=new Set();
  const emitir=()=>ouvintes.forEach(fn=>fn());
  const estadoBrowser=()=>janela?.history?.state?.[CHAVE];
  const gravar=metodo=>{
    if(!iniciada || !janela?.history)return;
    try {
      const anterior=janela.history.state;
      janela.history[metodo]({...((anterior&&typeof anterior==='object')?anterior:{}),[CHAVE]:{sessao,posicao}},'');
    } catch { /* Navegação local continua disponível quando History não pode gravar. */ }
  };
  const getSnapshot=()=>entradas[posicao];
  const reiniciar=(tela,contexto={})=>{
    sessao=novaSessao();entradas=[rota(tela,contexto)];posicao=0;voltando=false;destinoPendente=null;gravar('replaceState');emitir();
  };
  const ir=(tela,contexto={})=>{
    const destino=rota(tela,contexto);
    if(voltando){destinoPendente=destino;return;}
    if(iguais(getSnapshot(),destino))return;
    if(ENTRADA.has(getSnapshot().tela)||ENTRADA.has(tela)){reiniciar(tela,contexto);return;}
    entradas=entradas.slice(0,posicao+1);entradas.push(destino);posicao++;
    gravar('pushState');emitir();
  };
  const receberVolta=event=>{
    const m=event.state?.[CHAVE];
    voltando=false;
    if(m?.sessao===sessao && Number.isInteger(m.posicao) && entradas[m.posicao]){
      posicao=m.posicao;emitir();
    }
    // Entradas de uma conta/empresa anterior nunca reabrem seu contexto.
    const destino=destinoPendente;destinoPendente=null;if(destino)ir(destino.tela,destino.contexto);
  };
  return {
    getSnapshot,
    subscribe(fn){ouvintes.add(fn);return ()=>ouvintes.delete(fn);},
    iniciar(){
      iniciada=true;gravar('replaceState');janela?.addEventListener('popstate',receberVolta);
      return ()=>{iniciada=false;janela?.removeEventListener('popstate',receberVolta);};
    },
    setRaiz(fn){raiz=fn;},
    setTela:ir,
    setTelaRaw:reiniciar,
    limparHistorico(){reiniciar(getSnapshot().tela);},
    setContexto(contexto){ir(getSnapshot().tela,contexto);},
    voltar(){
      if(voltando)return;
      if(posicao===0){const destino=raiz();if(destino!==getSnapshot().tela)reiniciar(destino);return;}
      const m=estadoBrowser();
      if(iniciada&&m?.sessao===sessao&&m.posicao===posicao){
        try {voltando=true;janela.history.back();return;} catch {voltando=false;}
      }
      posicao--;gravar('replaceState');emitir();
    },
  };
}

export function useNavegacao() {
  const [controle]=useState(()=>criarNavegacao({janela:typeof window==='undefined'?undefined:window}));
  const estado=useSyncExternalStore(controle.subscribe,controle.getSnapshot,controle.getSnapshot);
  useEffect(()=>controle.iniciar(),[controle]);
  return {...controle,...estado};
}
