(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const chapters = {
    fachada: {number:'01',title:'A chegada',description:'Observe a fachada, a cobertura e a relação do terminal com o pátio.',day:1,night:6},
    jardim: {number:'02',title:'O embarque',description:'Aproxime o olhar da plataforma: espera, lojas e circulação junto aos ônibus.',day:2,night:7},
    aerea: {number:'03',title:'O conjunto',description:'Ganhe distância para entender terminal, praça, estacionamento e pátio.',day:0,night:5}
  };
  const renders = [
    ['Vista aérea do terminal','Terminal, pátio dos ônibus, praça de chegada e estacionamento.'],
    ['Fachada e boxes','Cobertura e boxes na apresentação do estudo.'],
    ['Plataforma de embarque','Área de espera, lojas e circulação junto aos ônibus.'],
    ['Chegada pela praça','Percurso de pedestres e paisagismo na chegada.'],
    ['Vista da rua','O conjunto a partir do acesso ao pátio.'],
    ['Vista aérea ao anoitecer','Iluminação ilustrativa do terminal e pátio.'],
    ['Fachada e boxes à noite','Letreiro, forro e iluminação de apresentação.'],
    ['Plataforma à noite','Área de espera e vitrines na apresentação noturna.'],
    ['Praça ao anoitecer','Chegada de pedestres na apresentação noturna.']
  ];
  let mode = 'intro',view = 'fachada',light = 'dia',index = 0,frame = null,ready = false,timeout = null;
  const visited = new Set();
  function status(message) { $('status').textContent=message; }
  function failModel(message) {
    clearTimeout(timeout);ready=false;
    if(frame)frame.remove();
    frame=null;$('loading').hidden=true;
    setMode('images');status(message);
  }
  function send(action,value) {
    if(!frame || !ready)return;
    frame.contentWindow.postMessage({type:'km-tour-command',action,value},location.origin==='null'?'*':location.origin);
  }
  function showRender(n) {
    index=(n+renders.length)%renders.length;
    $('render').src=`assets/render-${String(index+1).padStart(2,'0')}.jpg`;
    $('render').alt=`Render ilustrativo — ${renders[index][0]}. ${renders[index][1]}`;
    $('viewCount').textContent=`${String(index+1).padStart(2,'0')} / 09`;
    if(mode==='images'){
      $('chapterTitle').textContent=renders[index][0];
      $('chapterDescription').textContent=renders[index][1];
      $('chapterNumber').textContent=`VISTA ${String(index+1).padStart(2,'0')}`;
      light=index>=5?'noite':'dia';
      document.querySelectorAll('[data-light]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.light===light)));
      const key=['aerea','fachada','jardim',null,null,'aerea','fachada','jardim',null][index];
      if(key){view=key;visited.add(key);}
      document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===key)));
      $('progress').textContent=`${visited.size} de 3 olhares`;
    }
  }
  function selectView(key) {
    if(!chapters[key])return;
    view=key;
    if(mode!=='model' || ready)visited.add(key);
    $('chapterNumber').textContent=`OLHAR ${chapters[key].number}`;
    $('chapterTitle').textContent=chapters[key].title;
    $('chapterDescription').textContent=chapters[key].description;
    $('progress').textContent=`${visited.size} de 3 olhares`;
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===key)));
    $('walkBtn').setAttribute('aria-pressed','false');
    if(mode==='model'){
      send('view',view);
      $('gesture').textContent='Arraste para girar · dois dedos aproximam · setas giram e + / − aproximam';
      status(!ready?'Preparando a câmera 3D…':visited.size===3?'Você explorou três olhares. Agora escolha seu enquadramento e guarde uma foto.':'A câmera é sua: arraste o modelo para encontrar outro olhar.');
    } else showRender(light==='noite'?chapters[key].night:chapters[key].day);
  }
  function setLight(value) {
    if(!['dia','tarde','noite'].includes(value))return;
    light=value;
    document.querySelectorAll('[data-light]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.light===value)));
    if(mode==='model')send('light',value);
    else {
      const pairs={0:5,1:6,2:7,3:8,5:0,6:1,7:2,8:3};
      const night=index>=5;
      if((value==='noite')!==night && pairs[index]!==undefined)showRender(pairs[index]);
      else if(value==='noite' && index===4)showRender(chapters[view].night);
      status(value==='tarde'?'A luz da tarde pode ser explorada na câmera 3D. As imagens têm vistas diurnas e noturnas.':'Iluminação ilustrativa de apresentação.');
    }
  }
  function setMode(next) {
    mode=next;
    $('intro').hidden=true; $('controls').hidden=false; $('sceneTop').hidden=false; $('sceneBottom').hidden=false;
    const model=next==='model';
    $('render').hidden=model; $('modelHost').hidden=!model; $('modelTools').hidden=!model; $('galleryTools').hidden=model;
    $('modeLabel').textContent=model?'CÂMERA 3D · AO VIVO':'IMAGENS · 09 VISTAS';
    $('switchMode').textContent=model?'Voltar às imagens':'Assumir a câmera 3D ↗';
    $('viewCount').hidden=model;
    document.querySelector('[data-light="tarde"]').disabled=!model;
    document.querySelector('[data-light="tarde"]').title=model?'Luz da tarde':'Disponível na câmera 3D';
    $('gesture').textContent=model?'Arraste para girar · dois dedos aproximam · setas giram e + / − aproximam':'Deslize para trocar a vista · use as setas para percorrer';
    if(model && !frame) {
      $('loading').hidden=false;
      frame=document.createElement('iframe'); frame.title='Maquete 3D interativa do estudo preliminar da rodoviária';
      frame.src='modelo.html';
      $('modelHost').append(frame);
      timeout=setTimeout(()=>{
        if(!ready)failModel('O 3D demorou a responder. As nove imagens continuam disponíveis; você pode tentar a câmera novamente.');
      },45000);
    } else if(model && !ready) $('loading').hidden=false;
    else $('loading').hidden=true;
    send('pause',!model);
    if(model){selectView(view);setLight(light);} else {showRender(index);status('Explore as nove vistas do estudo.');}
  }
  window.addEventListener('message',e=>{
    if(!frame || e.source!==frame.contentWindow || e.origin!==location.origin || e.data?.type!=='km-tour-state')return;
    if(e.data.ready){
      ready=true;clearTimeout(timeout);$('loading').hidden=true;
      if(mode==='model'){send('pause',false);selectView(view);setLight(light);} else send('pause',true);
    }
    if(e.data.error)failModel('Esta tela não conseguiu iniciar o 3D. Você pode explorar o projeto pelas imagens e tentar a câmera novamente.');
    if(e.data.message)status(e.data.message);
    if(e.data.mode && mode==='model'){
      const walk=e.data.mode==='passeio';
      $('walkBtn').setAttribute('aria-pressed',String(walk));
      $('gesture').textContent=walk?'Arraste para olhar · segure ▲ para avançar':'Arraste para girar · dois dedos aproximam · setas giram e + / − aproximam';
    }
    if(e.data.view && mode==='model' && chapters[e.data.view]){
      view=e.data.view;visited.add(view);
      $('chapterNumber').textContent=`OLHAR ${chapters[view].number}`;
      $('chapterTitle').textContent=chapters[view].title;
      $('chapterDescription').textContent=chapters[view].description;
      document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
      $('progress').textContent=`${visited.size} de 3 olhares`;
    }
  });
  $('enterBtn').addEventListener('click',()=>setMode('model'));
  $('imagesBtn').addEventListener('click',()=>{setMode('images');selectView('aerea');});
  $('switchMode').addEventListener('click',()=>setMode(mode==='model'?'images':'model'));
  $('cancelModel').addEventListener('click',()=>setMode('images'));
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.view)));
  document.querySelectorAll('[data-light]').forEach(b=>b.addEventListener('click',()=>setLight(b.dataset.light)));
  $('prevBtn').addEventListener('click',()=>showRender(index-1)); $('nextBtn').addEventListener('click',()=>showRender(index+1));
  $('walkBtn').addEventListener('click',()=>{if(!ready){status('Aguarde o 3D terminar de carregar.');return;}const walk=$('walkBtn').getAttribute('aria-pressed')!=='true';send(walk?'walk':'orbit');$('walkBtn').setAttribute('aria-pressed',String(walk));$('gesture').textContent=walk?'Arraste para olhar · segure ▲ para avançar':'Arraste para girar · dois dedos aproximam';});
  $('photoBtn').addEventListener('click',()=>{if(!ready){status('Aguarde o 3D terminar de carregar.');return;}$('scene').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});send('photo');status('Seu enquadramento está aberto no visor. Use Baixar para guardar a imagem.');});
  $('audio').volume=.4;
  $('audioBtn').addEventListener('click',async()=>{
    if($('audio').paused){try{await $('audio').play();$('audioBtn').textContent='Som ligado · silenciar';$('audioBtn').setAttribute('aria-pressed','true');status('Trilha instrumental original da KMZERO.');}catch{status('O navegador não iniciou o som. Tente ativá-lo novamente.');}}
    else {$('audio').pause();$('audioBtn').textContent='Som desligado';$('audioBtn').setAttribute('aria-pressed','false');}
  });
  $('aboutBtn').addEventListener('click',()=>{$('about').showModal();send('pause',true);});
  $('closeAbout').addEventListener('click',()=>$('about').close());
  $('about').addEventListener('close',()=>send('pause',mode!=='model'));
  document.addEventListener('visibilitychange',()=>{send('pause',document.hidden || mode!=='model');if(document.hidden){$('audio').pause();$('audioBtn').textContent='Som desligado';$('audioBtn').setAttribute('aria-pressed','false');}});
  let start=null;
  $('scene').addEventListener('pointerdown',e=>{if(mode==='images' && e.target===$('render'))start=[e.clientX,e.clientY];});
  $('scene').addEventListener('pointerup',e=>{if(!start)return;const dx=e.clientX-start[0],dy=e.clientY-start[1];start=null;if(Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy)*1.5)showRender(index+(dx<0?1:-1));});
  $('scene').addEventListener('pointercancel',()=>{start=null;});
  $('scene').tabIndex=0;
  $('scene').addEventListener('keydown',e=>{if(mode==='images' && ['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();showRender(index+(e.key==='ArrowRight'?1:-1));}});
})();
