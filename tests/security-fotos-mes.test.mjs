import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { criarLeituraFotos, manterFotoNoAparelho, fotosDoAparelho, mesDaFoto, mesAtual, fotoPendenteLocal,
  registrarNumerosFotos, juntarMarcasNumeroFoto, marcasNumeroFoto, zerarMarcasNumeroFoto, ultimoNumeroFotoObra,
  registrarFotosNaNuvem, esquecerFotosNaNuvem, limparFotosAntigasDosRdos, limparFotosAntigasDoDiario } from '../src/lib/fotosNuvemLeitura.js';

// "Só limpar o celular": no aparelho do encarregado, fotos de meses anteriores não descem
// nem ficam guardadas; na nuvem nada muda e o escritório continua vendo todas.
// Tudo aqui é memória/fakes: nenhuma conta, nenhum projeto real.
const EMP = 'emp';
const espera = ms => new Promise(r => setTimeout(r, ms));
const quando = (ano, mes, dia, h = 12, m = 0) => new Date(ano, mes - 1, dia, h, m).getTime(); // hora local
const ddmm = t => new Date(t).toLocaleDateString('pt-BR');
const bytes = id => `data:image/png;base64,${Buffer.from(String(id)).toString('base64')}`;

const OUT_31 = quando(2026, 10, 31, 23, 59);
const NOV_01 = quando(2026, 11, 1, 0, 1);
const SET_20 = quando(2026, 9, 20, 9);
const OUT_05 = quando(2026, 10, 5, 10);
const OUT_31_FOTO = quando(2026, 10, 31, 8);

// Documentos como vêm do Firestore (id do doc = Date.now() de quando a foto foi tirada).
const docNuvem = (t, extra = {}) => ({ id: String(t), dados: { obraId: 7, fotoPath: `empresas/${EMP}/fotosObras/${t}.jpg`, legenda: 'x', data: ddmm(t), hora: '10:00', ...extra } });
const snap = (lista, fromCache = false) => ({ metadata: { fromCache }, docs: lista.map(d => ({ id: d.id, data: () => ({ ...d.dados }) })) });

function leitor(perfil, relogio) {
  const baixadas = [], emissoes = [];
  const l = criarLeituraFotos({ empresaId: EMP, intervaloMs: 5, avisar: () => {}, esperasNovaTentativaMs: [],
    manterFoto: registro => manterFotoNoAparelho(registro, perfil, relogio.agora),
    callback: lista => emissoes.push(lista),
    carregarFoto: async registro => { baixadas.push(registro.id); const { fotoUrl, foto, ...meta } = registro; return { ...meta, foto: bytes(registro.id), acessoFoto: 'autenticado' }; } });
  return { l, baixadas, emissoes };
}
const ids = lista => lista.map(x => String(x.id)).sort();

test('mês da foto: dataIso, depois data DD/MM/AAAA, depois o id Date.now(); sem nada, fica', () => {
  assert.equal(mesDaFoto({ id: OUT_05, dataIso: '2026-09-30', data: '05/10/2026' }), 2026 * 12 + 8);
  assert.equal(mesDaFoto({ id: OUT_05, data: '20/09/2026' }), 2026 * 12 + 8);
  assert.equal(mesDaFoto({ id: SET_20 }), 2026 * 12 + 8);
  assert.equal(mesDaFoto({ id: 'foto-1' }), null);
  assert.equal(mesDaFoto({ id: 42 }), null); // id pequeno (demo/antigo) não é data
  assert.equal(mesDaFoto({ id: 'x', data: 'ontem' }), null);
  assert.equal(mesAtual(OUT_31), 2026 * 12 + 9);
  // Sem data conhecida, o encarregado não perde a foto.
  assert.equal(manterFotoNoAparelho({ id: 'foto-1', fotoPath: 'p' }, 'encarregado', NOV_01), true);
});

test('encarregado: foto do mês anterior não é baixada nem aparece; só o mês atual desce', async () => {
  const relogio = { agora: quando(2026, 10, 15) };
  const { l, baixadas, emissoes } = leitor('encarregado', relogio);
  const setembro = docNuvem(SET_20);
  const setembroIso = { id: 'foto-iso', dados: { obraId: 7, fotoPath: `empresas/${EMP}/fotosObras/foto-iso.jpg`, dataIso: '2026-09-30' } };
  const outubro = docNuvem(OUT_05);
  l.aoSnapshot(snap([setembro, setembroIso, outubro])); await espera(30);
  assert.deepEqual(baixadas, [String(OUT_05)]);
  assert.ok(emissoes.length > 0);
  for (const lista of emissoes) assert.deepEqual(ids(lista), [String(OUT_05)]);
  assert.equal(emissoes.at(-1)[0].foto, bytes(OUT_05));
  l.encerrar();
});

test('gestor (escritório): baixa e guarda todas, de qualquer mês', async () => {
  const relogio = { agora: quando(2026, 10, 15) };
  const { l, baixadas, emissoes } = leitor('gestor', relogio);
  const docs = [docNuvem(quando(2026, 7, 2)), docNuvem(SET_20), docNuvem(OUT_05)];
  l.aoSnapshot(snap(docs)); await espera(30);
  assert.deepEqual(baixadas.sort(), ids(docs));
  assert.deepEqual(ids(emissoes.at(-1)), ids(docs));
  assert.equal(emissoes.at(-1).every(x => x.foto.startsWith('data:image/')), true);
  // Estado/localStorage do gestor: a lista passa inteira (o mesmo array).
  const local = emissoes.at(-1);
  assert.equal(fotosDoAparelho(local, 'gestor', NOV_01), local);
  assert.equal(fotosDoAparelho(local, undefined, NOV_01), local);
  l.encerrar();
});

test('estado/localStorage do encarregado: mês anterior sai, pendente antiga (ainda não enviada) fica', () => {
  const agora = quando(2026, 10, 15);
  const pendenteAntiga = { id: SET_20, obraId: 7, foto: bytes('p'), data: ddmm(SET_20), legenda: 'sem sinal' };
  const pendenteJulho = { id: quando(2026, 7, 1), obraId: 7, foto: 'data:image/jpeg;base64,AAAA', data: '01/07/2026' };
  const enviadaAntiga = { id: SET_20 + 1, obraId: 7, fotoPath: `empresas/${EMP}/fotosObras/${SET_20 + 1}.jpg`, foto: bytes('a'), data: ddmm(SET_20) };
  const urlAntiga = { id: SET_20 + 2, obraId: 7, fotoUrl: 'https://exemplo.invalid/f.jpg', foto: '', data: ddmm(SET_20) };
  const doMes = { id: OUT_05, obraId: 7, fotoPath: `empresas/${EMP}/fotosObras/${OUT_05}.jpg`, foto: bytes('m'), data: ddmm(OUT_05) };
  const semData = { id: 'antiga-sem-data', obraId: 7, fotoPath: 'x', foto: '' };
  assert.equal(fotoPendenteLocal(pendenteAntiga), true);
  assert.equal(fotoPendenteLocal(enviadaAntiga), false);
  const lista = [doMes, pendenteAntiga, enviadaAntiga, urlAntiga, pendenteJulho, semData];
  const guardada = fotosDoAparelho(lista, 'encarregado', agora);
  assert.deepEqual(ids(guardada), ids([doMes, pendenteAntiga, pendenteJulho, semData]));
  // O que vai para o localStorage (JSON) não leva a foto antiga já enviada.
  const json = JSON.stringify(guardada);
  assert.equal(json.includes(String(SET_20 + 1)), false);
  assert.equal(json.includes(bytes('p')), true);
  // Nada mudou: devolve o mesmo array (sem regravar à toa).
  assert.equal(fotosDoAparelho(guardada, 'encarregado', agora), guardada);
});

test('virada do mês: no próximo snapshot (mesmos documentos) as de outubro saem, sem baixar nada', async () => {
  const relogio = { agora: OUT_31 };
  const { l, baixadas, emissoes } = leitor('encarregado', relogio);
  const docs = [docNuvem(OUT_05), docNuvem(OUT_31_FOTO)];
  l.aoSnapshot(snap(docs)); await espera(30);
  assert.deepEqual(baixadas.sort(), ids(docs));
  assert.deepEqual(ids(emissoes.at(-1)), ids(docs));
  const antes = emissoes.length;

  relogio.agora = NOV_01; // passou da meia-noite do dia 31
  l.aoSnapshot(snap(docs, true)); await espera(30); // só metadados mudaram
  assert.ok(emissoes.length > antes);
  assert.deepEqual(emissoes.at(-1), []);
  assert.equal(baixadas.length, 2); // nenhum download novo

  // Os bytes de outubro saíram também do cache do leitor: se voltassem, desceriam de novo.
  relogio.agora = OUT_31;
  l.aoSnapshot(snap(docs)); await espera(30);
  assert.equal(baixadas.length, 4);
  l.encerrar();

  // No estado do aparelho, a pendente de outubro (sem sinal) atravessa a virada.
  const pendenteOutubro = { id: OUT_31_FOTO, obraId: 7, foto: bytes('o'), data: ddmm(OUT_31_FOTO) };
  const enviadaOutubro = { id: OUT_05, obraId: 7, fotoPath: 'p', foto: bytes('e'), data: ddmm(OUT_05) };
  assert.deepEqual(ids(fotosDoAparelho([pendenteOutubro, enviadaOutubro], 'encarregado', OUT_31)), ids([pendenteOutubro, enviadaOutubro]));
  assert.deepEqual(ids(fotosDoAparelho([pendenteOutubro, enviadaOutubro], 'encarregado', NOV_01)), [String(OUT_31_FOTO)]);
  // Virada do ano também conta (dezembro -> janeiro).
  assert.equal(manterFotoNoAparelho({ id: 1, fotoPath: 'p', data: '31/12/2026' }, 'encarregado', quando(2027, 1, 1, 0, 5)), false);
  assert.equal(manterFotoNoAparelho({ id: 1, fotoPath: 'p', data: '01/01/2027' }, 'encarregado', quando(2027, 1, 1, 0, 5)), true);
});

test('ligação: leitor do store filtra pelo perfil, App filtra na abertura e no snapshot, nada é apagado na nuvem', () => {
  const store = readFileSync(new URL('../src/lib/store.js', import.meta.url), 'utf8');
  const leitura = readFileSync(new URL('../src/lib/fotosNuvemLeitura.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/KMZeroApp.jsx', import.meta.url), 'utf8');
  const observar = store.slice(store.indexOf('export function observarFotosNuvem'), store.indexOf('export const semUndefined'));
  assert.match(observar, /manterFoto: registro => manterFotoNoAparelho\(registro, perfil\)/);
  assert.match(observar, /const perfil = _perfilDados\?\.perfil;/);
  assert.match(observar, /consultaPermitida\(fb, "fotosObras"\)/);
  for (const proibido of ['deleteDoc', 'removerDocNuvem', 'deleteObject', 'where(', 'query(']) {
    assert.equal(observar.includes(proibido), false, proibido);
    assert.equal(leitura.includes(proibido), false, proibido);
  }
  assert.match(app, /setFotosObras\(fotosDoAparelho\(n\("fotosObras", fotos_\), userLogado\?\.perfil\)\)/);
  assert.match(app, /return fotosDoAparelho\(\[\.\.\.porId\.values\(\)\], usuario\?\.perfil\)/);
});

test('numeração: encarregado em novembro com #1..#40 de outubro na nuvem tira uma foto e ela recebe o #41', async () => {
  zerarMarcasNumeroFoto();
  const relogio = { agora: NOV_01 };
  const { l, emissoes } = leitor('encarregado', relogio);
  const outubro = Array.from({ length: 40 }, (_, i) => docNuvem(OUT_05 + i * 1000, { numero: i + 1 }));
  l.aoSnapshot(snap(outubro)); await espera(30);
  l.encerrar();
  const noAparelho = emissoes.at(-1) || [];
  assert.equal(noAparelho.length, 0, 'fotos de outubro não ficam no celular');
  assert.equal(ultimoNumeroFotoObra(noAparelho, 7), 40);
  assert.equal(ultimoNumeroFotoObra(noAparelho, 7) + 1, 41, 'próxima foto é a #41, não a #001');
  assert.equal(ultimoNumeroFotoObra([], 8), 0, 'outra obra começa do zero');
  // Marca guardada no aparelho volta depois de reabrir (sem rede), e só sobe
  const guardada = { ...marcasNumeroFoto() };
  zerarMarcasNumeroFoto();
  assert.equal(ultimoNumeroFotoObra([], 7), 0);
  juntarMarcasNumeroFoto(guardada);
  assert.equal(ultimoNumeroFotoObra([], '7'), 40, 'obra como texto ou número');
  juntarMarcasNumeroFoto({ 7: 3 });
  assert.equal(ultimoNumeroFotoObra([], 7), 40, 'marca nunca desce');
  // localStorage antigo lido antes da limpeza também conta
  registrarNumerosFotos([{ obraId: 7, numero: 52, fotoPath: 'p', data: ddmm(OUT_05) }]);
  assert.equal(ultimoNumeroFotoObra(fotosDoAparelho([{ id: OUT_05, obraId: 7, numero: 52, fotoPath: 'p', data: ddmm(OUT_05) }], 'encarregado', NOV_01), 7), 52);
  // Escritório (lista completa) continua como antes: quantidade ou maior número
  zerarMarcasNumeroFoto();
  assert.equal(ultimoNumeroFotoObra([{ obraId: 7, numero: 1 }, { obraId: 7, numero: 2 }, { obraId: 8, numero: 9 }], 7), 2);
  zerarMarcasNumeroFoto();
});

test('limpeza do celular: RDOs e diário de meses anteriores largam o base64 só quando a foto já está na galeria da nuvem', () => {
  esquecerFotosNaNuvem();
  const pesada = 'data:image/jpeg;base64,' + 'A'.repeat(200000);
  const rdoOut = { id: 1, numero: 25, obraId: 7, data: '05/10/2026', dataIso: '2026-10-05', relatoDia: 'Concretagem da laje.', observacoes: 'Concretagem da laje.', fotos: [pesada, pesada] };
  const rdoOutSemNuvem = { id: 2, numero: 26, obraId: 7, data: '06/10/2026', dataIso: '2026-10-06', fotos: [pesada] };
  const rdoNov = { id: 3, numero: 30, obraId: 7, data: '01/11/2026', dataIso: '2026-11-01', fotos: [pesada] };
  const diaOut = { id: OUT_05, obraId: 7, texto: 'Chegou o cimento.', foto: pesada, ts: OUT_05 };
  const diaOutSoLocal = { id: OUT_05 + 3600000, obraId: 7, texto: 'Foto sem carimbo (só aqui).', foto: pesada, ts: OUT_05 + 3600000 };
  const rdos = [rdoOut, rdoOutSemNuvem, rdoNov], diario = [diaOut, diaOutSoLocal];
  // Sem confirmação da nuvem: nada sai
  assert.equal(limparFotosAntigasDosRdos(rdos, 'encarregado', NOV_01), rdos);
  assert.equal(limparFotosAntigasDoDiario(diario, 'encarregado', NOV_01), diario);
  // Galeria da nuvem: 2 fotos do RDO 25 (mesma obra e dia) e a foto do diário (mesmo instante); 1 só do RDO 26 (faltam)
  registrarFotosNaNuvem([
    { id: OUT_05 - 5, obraId: 7, data: '05/10/2026', origemRDO: 25, numero: 1 },
    { id: OUT_05 - 4, obraId: 7, data: '05/10/2026', origemRDO: 25, numero: 2 },
    { id: OUT_05 - 1, obraId: 7, data: '05/10/2026', origemDiario: true, numero: 3 },
  ], { daNuvem: true });
  registrarFotosNaNuvem([{ id: 99, obraId: 7, data: '06/10/2026', origemRDO: 26 }]); // sem fotoPath: não confirma
  const tam = v => JSON.stringify(v).length;
  // Mês corrente: nada muda
  assert.equal(limparFotosAntigasDosRdos(rdos, 'encarregado', OUT_31), rdos);
  // Escritório: nunca mexe
  assert.equal(limparFotosAntigasDosRdos(rdos, 'gestor', NOV_01), rdos);
  assert.equal(limparFotosAntigasDoDiario(diario, 'gestor', NOV_01), diario);
  const rdos2 = limparFotosAntigasDosRdos(rdos, 'encarregado', NOV_01);
  const diario2 = limparFotosAntigasDoDiario(diario, 'encarregado', NOV_01);
  assert.ok(tam(rdos) - tam(rdos2) >= 400000, 'localStorage "rdos" encolhe (2 fotos pesadas saem)');
  assert.ok(tam(diario) - tam(diario2) >= 200000, 'localStorage "diario" encolhe');
  assert.equal(rdos2[0].fotos, undefined);
  assert.equal(rdos2[0].qtdFotosNaGaleria, 2, 'prévia e PDF usam a galeria da obra');
  assert.equal(rdos2[0].relatoDia, 'Concretagem da laje.');
  assert.equal(rdos2[0].observacoes, 'Concretagem da laje.');
  assert.equal(rdos2[0].numero, 25);
  assert.equal(rdos2[1], rdoOutSemNuvem, 'galeria incompleta: a cópia fica');
  assert.equal(rdos2[2], rdoNov, 'mês atual fica');
  assert.equal(diario2[0].foto, undefined);
  assert.equal(diario2[0].texto, 'Chegou o cimento.');
  assert.equal(diario2[1], diaOutSoLocal, 'foto que só existe no aparelho nunca sai');
  // Idempotente
  assert.equal(limparFotosAntigasDosRdos(rdos2, 'encarregado', NOV_01), rdos2);
  assert.equal(limparFotosAntigasDoDiario(diario2, 'encarregado', NOV_01), diario2);
  esquecerFotosNaNuvem();
});
