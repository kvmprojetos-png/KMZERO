import { referenciaFoto } from "./fotoCaminho.js";

// Leitura das fotos privadas a partir dos snapshots de fotosObras, sem Firebase
// aqui dentro (testável com fakes). Os bytes vêm só de carregarFoto (a API
// autenticada); o cache é memória deste leitor e some em encerrar().
//  - acertos do cache entram antes de qualquer download;
//  - baixa as mais novas primeiro (ids são Date.now()), 6 de cada vez;
//  - emite SEMPRE a lista completa: o que ainda não chegou vai como marcador
//    { fotoCarregando: true }, no máximo a cada intervaloMs, e a lista final no fim;
//  - snapshot com os mesmos documentos (ex.: só metadados) não reinicia a passada;
//    mas, se a passada já terminou com falhas, o snapshot vindo do servidor
//    (fromCache false) tenta de novo só as que falharam;
//  - falha de rede/5xx também tenta de novo sozinha, com espera crescente.
export const PARALELO_FOTOS = 6;
export const INTERVALO_EMISSAO_FOTOS_MS = 700;
export const ESPERAS_NOVA_TENTATIVA_FOTOS_MS = [5000, 20000, 60000];
// Conexão parada no meio (rede trocou, TCP morto) não pode prender "carregando…" nem a vaga.
export const PRAZO_FOTO_MS = 30000;

// Sem status (rede, tempo esgotado) ou erro passageiro do servidor.
const falhaPassageira = e => !e?.status || e.status >= 500 || e.status === 408 || e.status === 429;

function maisNovasPrimeiro(a, b) {
  const na = Number(a), nb = Number(b);
  const fa = Number.isFinite(na), fb = Number.isFinite(nb);
  if (fa && fb) return nb - na;
  if (fa !== fb) return fa ? -1 : 1;
  return 0;
}

export function assinaturaDocs(snap, docs = snap.docs) {
  return JSON.stringify(docs.map(d => [d.id, d.data()]));
}

/* ── Fotos do mês no celular do encarregado ("só limpar o celular") ──
   Na virada do mês, o aparelho do encarregado deixa de baixar e de guardar
   (estado e localStorage) as fotos de meses anteriores, para liberar memória.
   Na nuvem nada muda: nenhuma foto é apagada e o escritório continua vendo todas.
   Foto ainda não enviada (só existe neste aparelho) nunca sai, de nenhum mês.
   Mês da foto: dataIso (AAAA-MM-DD), senão data (DD/MM/AAAA), senão o id
   (Date.now() de quando foi tirada). Sem nenhum deles, a foto fica. */
const ID_MINIMO_DATA = 1e12;      // ids Date.now() (depois de 2001); ids pequenos não são data
const ID_MAXIMO_DATA = 1e14;
const indiceMes = (ano, mes) => (ano >= 2000 && ano <= 9999 && mes >= 1 && mes <= 12 ? ano * 12 + (mes - 1) : null);

export function mesDaFoto(registro) {
  if (!registro || typeof registro !== "object") return null;
  const iso = typeof registro.dataIso === "string" && registro.dataIso.match(/^(\d{4})-(\d{1,2})/);
  if (iso) { const m = indiceMes(Number(iso[1]), Number(iso[2])); if (m !== null) return m; }
  const br = typeof registro.data === "string" && registro.data.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) { const m = indiceMes(Number(br[3]), Number(br[2])); if (m !== null) return m; }
  const id = Number(registro.id);
  if (Number.isFinite(id) && id >= ID_MINIMO_DATA && id < ID_MAXIMO_DATA) {
    const d = new Date(id);
    return indiceMes(d.getFullYear(), d.getMonth() + 1);
  }
  return null;
}

export function mesAtual(agora = Date.now()) {
  const d = new Date(agora);
  return d.getFullYear() * 12 + d.getMonth();
}

// Só existe neste aparelho: sem caminho/URL na nuvem e com a imagem (base64) local.
export function fotoPendenteLocal(registro) {
  return !!registro && !registro.fotoPath && !registro.fotoUrl
    && typeof registro.foto === "string" && registro.foto.startsWith("data:");
}

export function manterFotoNoAparelho(registro, perfil, agora = Date.now()) {
  if (perfil !== "encarregado") return true;          // escritório/gestor: todas as fotos
  if (fotoPendenteLocal(registro)) return true;      // ainda não subiu: nunca sai
  const mes = mesDaFoto(registro);
  return mes === null || mes >= mesAtual(agora);     // sem data conhecida fica
}

export function fotosDoAparelho(lista, perfil, agora = Date.now()) {
  if (perfil !== "encarregado" || !Array.isArray(lista)) return lista;
  const r = lista.filter(f => manterFotoNoAparelho(f, perfil, agora));
  return r.length === lista.length ? lista : r;
}

/* ── Numeração das fotos por obra (#001, #002…) ──
   O número carimbado na foto é a sequência oficial da obra e não pode repetir.
   Como o celular do encarregado deixa de guardar as fotos de meses anteriores,
   contar a lista do aparelho faria recomeçar no #001. Por isso fica guardado, por
   obra, o MAIOR número já visto (lista do aparelho, localStorage antigo e todos os
   documentos da nuvem, inclusive os que o aparelho não guarda). A limpeza do mês
   não mexe nessas marcas; o KMZeroApp as grava no aparelho ("_numeroFotoObra"). */
let _marcasNumeroFoto = {};
const chaveObra = obraId => (obraId === null || obraId === undefined || obraId === "" ? "" : String(obraId));

// Junta o maior número de cada obra; devolve true se alguma marca subiu.
export function registrarNumerosFotos(registros) {
  let mudou = false;
  (Array.isArray(registros) ? registros : []).forEach(f => {
    const k = chaveObra(f?.obraId), n = Number(f?.numero);
    if (!k || !Number.isFinite(n) || n <= 0) return;
    if (!(_marcasNumeroFoto[k] >= n)) { _marcasNumeroFoto = { ..._marcasNumeroFoto, [k]: Math.floor(n) }; mudou = true; }
  });
  return mudou;
}
// Marcas gravadas no aparelho ({ obraId: maior número }); só sobem, nunca descem.
export function juntarMarcasNumeroFoto(marcas) {
  if (!marcas || typeof marcas !== "object") return false;
  return registrarNumerosFotos(Object.entries(marcas).map(([obraId, numero]) => ({ obraId, numero })));
}
export const marcasNumeroFoto = () => _marcasNumeroFoto;
export const zerarMarcasNumeroFoto = () => { _marcasNumeroFoto = {}; };
// Último número usado na obra: o maior entre a quantidade da lista, o maior nº da lista e a marca guardada.
// A próxima foto recebe esse valor + 1.
export function ultimoNumeroFotoObra(fotos, obraId) {
  const k = chaveObra(obraId);
  if (!k) return 0;
  const daObra = (Array.isArray(fotos) ? fotos : []).filter(f => f && chaveObra(f.obraId) === k);
  const maiorLista = daObra.reduce((m, f) => Math.max(m, Number(f.numero) || 0), 0);
  return Math.max(daObra.length, maiorLista, Number(_marcasNumeroFoto[k]) || 0);
}

/* ── Cópias pesadas nos RDOs e no diário do encarregado ──
   O "Finalizar dia" guarda as fotos (base64) também dentro do RDO (rdos[].fotos) e o
   Diário guarda a foto na anotação (diario[].foto). É ali que fica o volume. Na virada
   do mês, o celular do encarregado tira essas cópias dos registros de meses anteriores,
   mas SÓ quando a mesma foto já está na galeria da nuvem (nunca a única cópia).
   A nuvem não muda: o RDO na nuvem não leva fotos e o diário não sobe base64.
   Fotos confirmadas na nuvem: documentos da nuvem (leitor) e registros com fotoPath. */
const _fotosNaNuvem = new Map(); // id → { obraId, data, origemRDO, origemDiario }
export function registrarFotosNaNuvem(registros, { daNuvem = false } = {}) {
  (Array.isArray(registros) ? registros : []).forEach(f => {
    if (!f || f.id === undefined || f.id === null || (!daNuvem && !f.fotoPath)) return;
    _fotosNaNuvem.set(String(f.id), { id: Number(f.id), obraId: chaveObra(f.obraId), data: String(f.data || "").trim(), origemRDO: f.origemRDO, origemDiario: !!f.origemDiario });
  });
}
export const esquecerFotosNaNuvem = () => _fotosNaNuvem.clear();
const ehBase64 = v => typeof v === "string" && v.startsWith("data:");
const mesAnterior = (registro, agora) => { const m = mesDaFoto(registro); return m !== null && m < mesAtual(agora); };

// RDOs: tira `fotos` quando a galeria da nuvem tem as fotos desse RDO (mesma obra, dia e nº de origem)
export function limparFotosAntigasDosRdos(rdos, perfil, agora = Date.now()) {
  if (perfil !== "encarregado" || !Array.isArray(rdos)) return rdos;
  let mudou = false;
  const r = rdos.map(rdo => {
    const fotos = Array.isArray(rdo?.fotos) ? rdo.fotos : null;
    if (!fotos || !fotos.length || !mesAnterior(rdo, agora)) return rdo;
    const k = chaveObra(rdo.obraId), dia = String(rdo.data || "").trim();
    let naNuvem = 0;
    _fotosNaNuvem.forEach(f => { if (f.obraId === k && f.data === dia && f.origemRDO != null && String(f.origemRDO) === String(rdo.numero)) naNuvem++; });
    if (!k || !dia || naNuvem < fotos.length) return rdo;
    const { fotos: _copias, ...resto } = rdo;
    mudou = true;
    return { ...resto, qtdFotosNaGaleria: Math.max(Number(rdo.qtdFotosNaGaleria) || 0, fotos.length) };
  });
  return mudou ? r : rdos;
}

// Diário: tira `foto` (base64) quando a galeria da nuvem tem a foto dessa anotação
// (origem Diário, mesma obra, tirada no mesmo instante: os dois ids são Date.now() do mesmo toque)
export const JANELA_FOTO_DIARIO_MS = 10000;
export function limparFotosAntigasDoDiario(diario, perfil, agora = Date.now()) {
  if (perfil !== "encarregado" || !Array.isArray(diario)) return diario;
  let mudou = false;
  const r = diario.map(d => {
    if (!d || !ehBase64(d.foto) || !mesAnterior(d, agora)) return d;
    const k = chaveObra(d.obraId), id = Number(d.id);
    if (!k || !Number.isFinite(id)) return d;
    let achou = false;
    _fotosNaNuvem.forEach(f => { if (!achou && f.origemDiario && f.obraId === k && Number.isFinite(f.id) && Math.abs(id - f.id) <= JANELA_FOTO_DIARIO_MS) achou = true; });
    if (!achou) return d;
    const { foto: _copia, ...resto } = d;
    mudou = true;
    return resto;
  });
  return mudou ? r : diario;
}

export function criarLeituraFotos({ empresaId, carregarFoto, callback, paralelo = PARALELO_FOTOS,
  intervaloMs = INTERVALO_EMISSAO_FOTOS_MS, esperasNovaTentativaMs = ESPERAS_NOVA_TENTATIVA_FOTOS_MS, prazoFotoMs = PRAZO_FOTO_MS,
  agora = () => Date.now(), avisar = e => console.warn("Foto indisponível:", e?.status || "falha-leitura"),
  manterFoto = () => true }) {
  let versao = 0, encerrado = false, ultimoSnapshot = null, leituraAtual = null, assinaturaAtual = null;
  let ultimaEmissao = -Infinity, timer = null;
  let concluidaComFalhas = false, timerNovaTentativa = null, tentativasAuto = 0;
  const cache = new Map();

  // Bytes já vistos deste id, só se forem do mesmo caminho e da mesma obra.
  const bytesConhecidos = (registro, path) => {
    const anterior = cache.get(String(registro.id))?.foto;
    return path && anterior?.fotoPath === path && String(anterior?.obraId) === String(registro.obraId)
      && typeof anterior?.foto === "string" && anterior.foto.startsWith("data:image/") ? anterior.foto : "";
  };
  const semBytes = (registro, extra) => {
    const { fotoUrl: _urlAntiga, foto: _fotoAntiga, ...meta } = registro;
    const path = referenciaFoto(registro, empresaId);
    return { ...meta, ...(path ? { fotoPath: path } : {}), foto: bytesConhecidos(registro, path), ...extra };
  };
  const cancelarEmissao = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const cancelarNovaTentativa = () => { if (timerNovaTentativa) { clearTimeout(timerNovaTentativa); timerNovaTentativa = null; } };

  const carregar = async (snap, forcar = false) => {
    if (encerrado) return;
    ultimoSnapshot = snap;
    // Numeração: todos os documentos contam, inclusive os que este aparelho não guarda (só metadados, sem baixar)
    const todosDocs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    registrarNumerosFotos(todosDocs);
    registrarFotosNaNuvem(todosDocs, { daNuvem: true }); // já estão na nuvem: libera as cópias pesadas antigas
    // Fotos que este aparelho não guarda (ex.: meses anteriores no celular do encarregado)
    // nem entram: não baixam, não aparecem e saem do cache. A conta é refeita a cada
    // snapshot, então na virada do mês a assinatura muda e a passada é refeita.
    const docsSnap = snap.docs.filter(d => manterFoto({ ...d.data(), id: d.id }));
    const assinatura = assinaturaDocs(snap, docsSnap);
    if (!forcar && assinatura === assinaturaAtual) {
      // Mesmos documentos: segue a passada atual. Se ela já terminou com falhas e
      // o Firestore voltou ao servidor, a conexão voltou: tenta de novo as que falharam.
      if (!(concluidaComFalhas && snap.metadata?.fromCache === false)) return;
    } else if (assinatura !== assinaturaAtual) tentativasAuto = 0;
    assinaturaAtual = assinatura;
    concluidaComFalhas = false;
    cancelarNovaTentativa();
    leituraAtual?.abort();
    cancelarEmissao();
    const leitura = new AbortController();
    leituraAtual = leitura;
    const minhaVersao = ++versao;
    const valida = () => !encerrado && !leitura.signal.aborted && minhaVersao === versao;
    const docs = docsSnap.map(d => {
      const registro = { ...d.data(), id: d.id };
      return { id: d.id, registro, chave: JSON.stringify(registro) };
    });
    const saida = new Array(docs.length);
    const pendentes = [];
    docs.forEach((item, posicao) => {
      const c = cache.get(item.id);
      if (c?.chave === item.chave) saida[posicao] = c.foto; else pendentes.push(posicao);
    });
    pendentes.sort((a, b) => maisNovasPrimeiro(docs[a].id, docs[b].id) || a - b);
    const lista = () => docs.map((item, posicao) => saida[posicao] || semBytes(item.registro, { fotoCarregando: true }));
    const emitir = () => {
      timer = null;
      if (!valida()) return;
      ultimaEmissao = agora();
      callback(lista());
    };
    const programar = () => {
      if (timer || !valida()) return;
      timer = setTimeout(emitir, Math.max(0, ultimaEmissao + intervaloMs - agora()));
    };
    if (pendentes.length) programar(); // mostra logo a lista (com marcadores) sem esperar downloads

    let indice = 0, falhas = 0, passageiras = 0;
    const ler = async () => {
      while (indice < pendentes.length && valida()) {
        const posicao = pendentes[indice++];
        const { id, registro, chave } = docs[posicao];
        const c = cache.get(id);
        if (c?.chave === chave) { saida[posicao] = c.foto; programar(); continue; }
        // Sinal próprio da foto: cai junto com a passada ou quando o prazo estoura
        // (sem AbortSignal.any, que falta em iPhones mais antigos).
        const porFoto = new AbortController();
        const repassar = () => porFoto.abort();
        leitura.signal.addEventListener("abort", repassar, { once: true });
        const prazo = setTimeout(() => porFoto.abort(), prazoFotoMs);
        try {
          const foto = await carregarFoto(registro, { signal: porFoto.signal }).finally(() => {
            clearTimeout(prazo); leitura.signal.removeEventListener("abort", repassar);
          });
          if (encerrado) return;
          cache.set(id, { chave, foto }); // vale para a próxima passada mesmo se esta foi trocada
          if (!valida()) return;
          saida[posicao] = foto;
        } catch (e) {
          if (!valida()) return;
          saida[posicao] = semBytes(registro, { fotoIndisponivel: true });
          falhas++; if (falhaPassageira(e)) passageiras++;
          avisar(e);
        }
        programar();
      }
    };
    await Promise.all(Array.from({ length: Math.min(paralelo, pendentes.length) }, ler));
    if (!valida()) return;
    cancelarEmissao();
    const ids = new Set(docs.map(d => d.id));
    for (const id of cache.keys()) if (!ids.has(id)) cache.delete(id);
    ultimaEmissao = agora();
    concluidaComFalhas = falhas > 0;
    if (!falhas) tentativasAuto = 0;
    else if (passageiras && tentativasAuto < esperasNovaTentativaMs.length) {
      // Rede/5xx: nova tentativa automática (acertos do cache não baixam de novo).
      timerNovaTentativa = setTimeout(() => {
        timerNovaTentativa = null;
        if (ultimoSnapshot && !encerrado) carregar(ultimoSnapshot, true);
      }, esperasNovaTentativaMs[tentativasAuto++]);
    }
    callback(saida.filter(Boolean));
  };

  return {
    aoSnapshot: snap => carregar(snap),
    // Volta da rede: refaz a passada (acertos do cache são imediatos; as que falharam tentam de novo).
    aoReconectar: () => { if (ultimoSnapshot && !encerrado) { tentativasAuto = 0; return carregar(ultimoSnapshot, true); } },
    encerrar: () => { encerrado = true; leituraAtual?.abort(); cancelarEmissao(); cancelarNovaTentativa(); cache.clear(); ultimoSnapshot = null; },
  };
}
