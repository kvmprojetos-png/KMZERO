/* Camada de visita KMZERO. O motor original é preservado em modelo_original.html. */
(() => {
  'use strict';
  const allowedViews=['fachada','jardim','aerea'],allowedLight=['dia','tarde','noite'];
  const announce = data => parent.postMessage({type:'km-tour-state',...data},location.origin==='null'?'*':location.origin);
  let movement=0;
  const stopMovement=()=>{cancelAnimationFrame(movement);movement=0;};
  window.addEventListener('keydown',e=>{if(e.key==='Escape')stopMovement();},true);
  function cinematicView(value) {
    stopMovement();
    const km=window.KM,wasOrbit=km.modo()==='orbita';
    const start={...km.orb,target:km.alvo.clone()};
    km.vista(value);
    if(!wasOrbit || matchMedia('(prefers-reduced-motion: reduce)').matches){km.desenhar(0);return;}
    const end={...km.orb,target:km.alvo.clone()};
    Object.assign(km.orb,{az:start.az,el:start.el,r:start.r});km.alvo.copy(start.target);
    const delta=Math.atan2(Math.sin(end.az-start.az),Math.cos(end.az-start.az));
    const begun=performance.now();
    const animate=now=>{
      const t=Math.min(1,(now-begun)/1100),ease=t*t*(3-2*t);
      km.orb.az=start.az+delta*ease;km.orb.el=start.el+(end.el-start.el)*ease;km.orb.r=start.r+(end.r-start.r)*ease;
      km.alvo.copy(start.target).lerp(end.target,ease);
      if(t<1)movement=requestAnimationFrame(animate);else {movement=0;km.desenhar(0);}
    };
    movement=requestAnimationFrame(animate);
  }
  const clickOriginal = id => {
    const b=document.getElementById(id);
    if(!b || b.hidden || b.disabled){announce({message:'Este recurso não está disponível nesta versão da maquete.'});return false;}
    b.click();return true;
  };
  window.addEventListener('message',e=>{
    if(e.source!==parent || e.origin!==location.origin || e.data?.type!=='km-tour-command')return;
    const {action,value}=e.data,km=window.KM;
    if(!km)return;
    try {
      if(action==='pause'){window.__kmPortalPausado=Boolean(value);if(value){stopMovement();km.pausarInteracao();}}
      if(action==='view' && allowedViews.includes(value))cinematicView(value);
      if(action==='light' && allowedLight.includes(value)){km.luz(value);km.desenhar(0);announce({light:value});}
      if(action==='walk'){stopMovement();clickOriginal('bPasseio');}
      if(action==='orbit'){stopMovement();clickOriginal('bOrbita');}
      if(action==='photo'){stopMovement();clickOriginal('bFoto');}
    }catch(error){announce({message:'Não foi possível concluir este controle. Tente outra vista ou volte às imagens.'});console.error('Controle da visita',error);}
  });
  if(window.KM){
    const canvas=document.getElementById('tela');
    canvas.addEventListener('pointerdown',stopMovement);
    canvas.addEventListener('webglcontextlost',()=>{stopMovement();announce({error:true});});
    canvas.tabIndex=0;
    canvas.addEventListener('keydown',e=>{
      const km=window.KM;
      if(km.modo()!=='orbita')return;
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;
      e.preventDefault();
      stopMovement();
      if(e.key==='ArrowLeft')km.orb.az-=.08;
      if(e.key==='ArrowRight')km.orb.az+=.08;
      if(e.key==='ArrowUp')km.orb.el=Math.min(1.4,km.orb.el+.05);
      if(e.key==='ArrowDown')km.orb.el=Math.max(-.2,km.orb.el-.05);
      if(e.key==='+' || e.key==='=')km.orb.r=Math.max(3,km.orb.r*.92);
      if(e.key==='-')km.orb.r=Math.min(260,km.orb.r*1.08);
      km.desenhar(0);
    });
    new MutationObserver(()=>announce({mode:window.KM.modo()})).observe(document.getElementById('bPasseio'),{attributes:true,attributeFilter:['aria-pressed']});
    const syncView=()=>{
      const current=allowedViews.find(key=>document.getElementById('v-'+key).getAttribute('aria-pressed')==='true');
      if(current)announce({view:current});
    };
    allowedViews.forEach(key=>new MutationObserver(syncView).observe(document.getElementById('v-'+key),{attributes:true,attributeFilter:['aria-pressed']}));
    announce({ready:true});
  }
  else announce({error:true});
})();
