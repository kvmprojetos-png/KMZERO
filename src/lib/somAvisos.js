// Som local com o app aberto. O navegador libera Web Audio após um toque/tecla;
// notificações com o app fechado usam o som definido pelo sistema operacional.
const CHAVE = '_kmzero_som_avisos';
let contexto;
let preferencia;
const ouvintes = new Set();
const avisar = () => ouvintes.forEach(fn => fn(estadoSomAvisos()));
export function somAvisosLigado() {
  if (preferencia !== undefined) return preferencia;
  try { return localStorage.getItem(CHAVE) !== '0'; } catch { return true; }
}
export function estadoSomAvisos() {
  if (typeof window === 'undefined' || !(window.AudioContext || window.webkitAudioContext)) return 'sem_suporte';
  if (!somAvisosLigado()) return 'desligado';
  return contexto?.state === 'running' ? 'pronto' : 'aguarda_toque';
}
export function observarSomAvisos(fn) { ouvintes.add(fn); fn(estadoSomAvisos()); return () => ouvintes.delete(fn); }
export async function liberarSomAvisos() {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    if (!contexto || contexto.state === 'closed') {
      contexto = new Audio();
      contexto.addEventListener('statechange', avisar);
    }
    if (contexto.state !== 'running') {
      let timer;
      try { await Promise.race([contexto.resume(), new Promise(resolve => { timer = setTimeout(resolve, 2000); })]); }
      finally { clearTimeout(timer); }
    }
    avisar();
    return contexto.state === 'running';
  } catch { avisar(); return false; }
}
export async function definirSomAvisos(ligado) {
  preferencia = !!ligado;
  try { localStorage.setItem(CHAVE, ligado ? '1' : '0'); } catch {}
  if (ligado) await liberarSomAvisos();
  avisar();
}
export function prepararSomAvisos() {
  const liberar = () => { if (somAvisosLigado() && contexto?.state !== 'running') void liberarSomAvisos(); };
  window.addEventListener('pointerdown', liberar, { passive: true });
  window.addEventListener('keydown', liberar);
  const atualizar = e => { if (e.key === CHAVE || e.key === null) { preferencia = undefined; avisar(); } };
  window.addEventListener('storage', atualizar);
  return () => {
    window.removeEventListener('pointerdown', liberar);
    window.removeEventListener('keydown', liberar);
    window.removeEventListener('storage', atualizar);
  };
}
export function tocarSomAviso({ teste = false } = {}) {
  if (estadoSomAvisos() !== 'pronto' || (!teste && document.visibilityState !== 'visible')) return false;
  try {
    const inicio = contexto.currentTime + 0.01;
    [660, 880].forEach((frequencia, i) => {
      const o = contexto.createOscillator(), g = contexto.createGain();
      const t = inicio + i * 0.16;
      o.type = 'sine'; o.frequency.value = frequencia;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(g); g.connect(contexto.destination);
      o.onended = () => { o.disconnect(); g.disconnect(); };
      o.start(t); o.stop(t + 0.23);
    });
    return true;
  } catch { return false; }
}
// Deduplica por documento, não por atualização: confirmar push/leitura não toca de novo.
export function novoAvisoSonoro(avisos, { uid, inicio, conhecidos }) {
  const novos = avisos.filter(a => a.de !== uid && Number(a.criadoEm) > inicio && !conhecidos.has(String(a.id)));
  avisos.forEach(a => conhecidos.add(String(a.id)));
  return novos.sort((a, b) => b.criadoEm - a.criadoEm)[0] || null;
}
