import { NAVY, GOLD, GREEN, RED, ORANGE, BLUE, T } from "../theme.js";
import { Btn, Modal } from "./ui.jsx";
import { mesmoId } from "../lib/ids.js";
import { PREFIXO_RESUMO_AUTO } from "./BotaoDitado.jsx";

/* ════════════════════════════════════
   PRÉVIA DO RDO — janela só de leitura
   O RDO é leve: abre na hora, sem gerar PDF. Mostra o resumo do dia (equipe, horas extras,
   relato, ocorrências, fotos e refeições em quantidade, sem preço) e leva ao RDO completo.
   Usada no Painel do escritório (busca por dia) e na tela de RDO (botão "Prévia").
════════════════════════════════════ */

/* Dia do RDO em "AAAA-MM-DD": dataIso quando existe, senão a data "DD/MM/AAAA" convertida */
export const isoDoRDO = r => {
  const iso = String(r?.dataIso || "");
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
  return isoDeBR(r?.data);
};
const isoDeBR = br => {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(br || ""));
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
};
const isoLocalDeTs = ts => {
  const d = new Date(Number(ts));
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/* "AAAA-MM-DD" → "DD/MM/AAAA" (sem passar por Date: não muda de dia por causa do fuso) */
export const dataBRDeIso = iso => {
  const [a, m, d] = String(iso || "").slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : "";
};
const nRDO = n => String(n ?? "").padStart(3, "0");

/* RDOs de um dia (todas as obras, ou só a obra escolhida), do número maior para o menor */
export function buscarRDOsDoDia(rdos, iso, obraId = "") {
  if (!iso) return [];
  const todasObras = obraId === "" || obraId === null || obraId === undefined;
  return (rdos || [])
    .filter(r => r && isoDoRDO(r) === iso && (todasObras || mesmoId(r.obraId, obraId)))
    .sort((a, b) => (Number(b.numero) || 0) - (Number(a.numero) || 0) || (Number(b.ts) || 0) - (Number(a.ts) || 0));
}

export const TIPOS_REFEICAO_PREVIA = [["cafeManha", "Café da manhã"], ["cafeTarde", "Café da tarde"], ["marmita", "Marmita"], ["lanche", "Lanche"]];

/* Texto falado do dia: aceita texto puro ou { texto } */
const textoRelato = v => (typeof v === "string" ? v : v && typeof v === "object" ? String(v.texto || "") : "").trim();

/* Resumo que a prévia mostra (função pura: também usada nos testes) */
export function resumoRDO({ rdo, trabalhadores = [], diario, fotosObras = [] }) {
  const r = rdo || {};
  const iso = isoDoRDO(r);
  const pres = r.presencas && typeof r.presencas === "object" ? r.presencas : {};
  const nomeDe = id => (trabalhadores || []).find(t => t && mesmoId(t.id, id))?.nome || "Sem cadastro";
  const porStatus = st => Object.entries(pres).filter(([, v]) => v === st).map(([id]) => nomeDe(id)).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const presentes = porStatus("Presente");
  const faltas = porStatus("Falta");
  const atestados = porStatus("Atestado");

  // Horas extras: o total gravado no RDO; RDO antigo sem o total → soma o que passou de 9 h de cada presente
  let totalHE = Number(r.totalHE);
  if (r.totalHE === undefined || r.totalHE === null || r.totalHE === "" || !isFinite(totalHE)) {
    totalHE = 0;
    Object.entries(r.horasTrabalhadas || {}).forEach(([tid, h]) => {
      const horas = Number(h) || 0;
      if (pres[tid] === "Presente" && horas > 9) totalHE += horas - 9;
    });
  }
  totalHE = Math.round(Math.max(0, totalHE) * 10) / 10;

  // Refeições em QUANTIDADE por tipo (sem preço), só de quem estava presente
  const ali = r.alimentacao && typeof r.alimentacao === "object" ? r.alimentacao : {};
  const temPresencas = Object.keys(pres).length > 0;
  const refeicoes = TIPOS_REFEICAO_PREVIA
    .map(([chave, rotulo]) => ({ chave, rotulo, qtd: Object.entries(ali).filter(([tid, m]) => m && m[chave] && (!temPresencas || pres[tid] === "Presente")).length }))
    .filter(x => x.qtd > 0);

  // Ocorrências do diário da mesma obra no mesmo dia (null = diário não informado)
  const ocorrencias = Array.isArray(diario)
    ? diario
      .filter(d => d && mesmoId(d.obraId, r.obraId) && iso && (d.data ? isoDeBR(d.data) === iso : d.ts ? isoLocalDeTs(d.ts) === iso : false))
      .sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0))
    : null;

  // Fotos: as do próprio RDO (só no aparelho que fechou o dia); senão as da galeria da obra naquele dia
  const doRdo = (Array.isArray(r.fotos) ? r.fotos : []).filter(f => typeof f === "string" && f);
  let miniaturas = doRdo, totalFotos = doRdo.length;
  if (!doRdo.length) {
    const daGaleria = (fotosObras || []).filter(f => f && mesmoId(f.obraId, r.obraId) && iso && (f.data ? isoDeBR(f.data) === iso : (f.criadoEm || f.ts) ? isoLocalDeTs(f.criadoEm || f.ts) === iso : false));
    miniaturas = daGaleria.map(f => f.foto || f.fotoUrl).filter(s => typeof s === "string" && s);
    totalFotos = Math.max(daGaleria.length, Number(r.qtdFotosNaGaleria) || 0);
  }

  // Relato x observações: o fechamento grava o relato também nas observações ("relato + resumo automático" ou
  // "observações do gestor + Relato do encarregado: relato"). A prévia mostra o relato uma vez só e tira o resumo
  // automático (os números já aparecem acima). Se o escritório editou o texto e o relato não está mais lá, vale o editado.
  let relato = textoRelato(r.relatoDia);
  let observacoes = String(r.observacoes || "").trim();
  const tirarTrecho = (txt, trecho) => { const i = txt.indexOf(trecho); return i < 0 ? null : txt.slice(0, i) + txt.slice(i + trecho.length); };
  const semRelato = relato ? (tirarTrecho(observacoes, `Relato do encarregado: ${relato}`) ?? tirarTrecho(observacoes, relato)) : null;
  if (semRelato !== null) observacoes = semRelato;
  observacoes = observacoes.split(/\n\s*\n/).map(p => p.trim()).filter(p => p && !p.startsWith(PREFIXO_RESUMO_AUTO)).join("\n\n");
  if (relato && semRelato === null && observacoes) relato = ""; // o PDF usa as observações: a prévia segue o mesmo texto

  return {
    iso,
    dataBR: dataBRDeIso(iso) || String(r.data || ""),
    presentes, faltas, atestados, totalHE, refeicoes, ocorrencias,
    miniaturas, totalFotos,
    relato,
    observacoes,
  };
}

const horasTxt = h => `${String(h).replace(".", ",")} h`;
const horaDe = o => {
  if (o.hora) return String(o.hora);
  const d = o.ts ? new Date(Number(o.ts)) : null;
  return d && !isNaN(d.getTime()) ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "";
};
const LIMITE_MINIATURAS = 8;

export function PreviaRDO({ rdo, obras = [], trabalhadores = [], diario, fotosObras = [], mostrarRefeicoes = true, onClose, onAbrirCompleto }) {
  if (!rdo) return null;
  const s = resumoRDO({ rdo, trabalhadores, diario, fotosObras });
  const obraNome = obras.find(o => mesmoId(o.id, rdo.obraId))?.nome || rdo.obraNome || rdo.obra || "Obra";
  const secaoS = { background: T.superficie, border: `1px solid ${T.borda}`, borderRadius: 12, padding: "10px 12px", marginBottom: 10 };
  const tituloS = { fontSize: 11, fontWeight: 800, color: T.texto2, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 };
  const textoS = { fontSize: 13, color: T.texto, lineHeight: 1.45, whiteSpace: "pre-wrap", overflowWrap: "anywhere" };
  const kpiS = cor => ({ background: T.superficie2, borderRadius: 10, padding: "8px 6px", textAlign: "center", borderTop: `3px solid ${cor}` });
  const nomes = lista => lista.join(", ");
  const extras = s.totalFotos - Math.min(s.miniaturas.length, LIMITE_MINIATURAS);

  return (
    <Modal show title={`RDO Nº ${nRDO(rdo.numero)} · ${s.dataBR || "—"}`} onClose={onClose}>
      <div data-previa-rdo={String(rdo.id ?? "")}>
        {/* Cabeçalho: obra, número, data, encarregado, clima */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, color: T.titulo, fontSize: 15, lineHeight: 1.3, overflowWrap: "anywhere" }}>{obraNome}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            <span style={{ background: GOLD, color: NAVY, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>RDO Nº {nRDO(rdo.numero)}</span>
            <span style={{ background: T.superficie2, color: T.texto, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>📅 {s.dataBR || "—"}</span>
            <span style={{ background: T.superficie2, color: T.texto, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>🌤️ {rdo.clima || "—"}</span>
          </div>
          <div style={{ fontSize: 12, color: T.texto2, marginTop: 6 }}>👷 Encarregado: <b style={{ color: T.titulo }}>{rdo.encarregado || "—"}</b></div>
        </div>

        {/* Equipe do dia */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 10 }}>
          <div style={kpiS(GREEN)}><div style={{ fontSize: 20, fontWeight: 900, color: GREEN }}>{s.presentes.length}</div><div style={{ fontSize: 10, color: T.texto2, fontWeight: 700 }}>Presentes</div></div>
          <div style={kpiS(RED)}><div style={{ fontSize: 20, fontWeight: 900, color: s.faltas.length ? RED : T.texto3 }}>{s.faltas.length}</div><div style={{ fontSize: 10, color: T.texto2, fontWeight: 700 }}>Faltas</div></div>
          <div style={kpiS(ORANGE)}><div style={{ fontSize: 20, fontWeight: 900, color: s.totalHE > 0 ? ORANGE : T.texto3 }}>{horasTxt(s.totalHE)}</div><div style={{ fontSize: 10, color: T.texto2, fontWeight: 700 }}>Horas extras</div></div>
        </div>
        {(s.presentes.length > 0 || s.faltas.length > 0 || s.atestados.length > 0) ? (
          <div style={secaoS}>
            {s.presentes.length > 0 && <div style={{ fontSize: 12, color: T.texto, marginBottom: 4 }}><b style={{ color: GREEN }}>Presentes:</b> {nomes(s.presentes)}</div>}
            {s.faltas.length > 0 && <div style={{ fontSize: 12, color: T.texto, marginBottom: 4 }}><b style={{ color: RED }}>Faltas:</b> {nomes(s.faltas)}</div>}
            {s.atestados.length > 0 && <div style={{ fontSize: 12, color: T.texto }}><b style={{ color: ORANGE }}>Atestado:</b> {nomes(s.atestados)}</div>}
          </div>
        ) : (
          <div style={{ ...secaoS, fontSize: 12, color: T.texto3 }}>Presença da equipe não registrada neste RDO.</div>
        )}

        {/* Relato falado do dia e atividades */}
        {s.relato && (
          <div style={secaoS}>
            <div style={tituloS}>🎙️ Relato do dia</div>
            <div style={textoS}>{s.relato}</div>
          </div>
        )}
        <div style={secaoS}>
          <div style={tituloS}>📝 Atividades e observações</div>
          {s.observacoes ? <div style={textoS}>{s.observacoes}</div> : <div style={{ fontSize: 12, color: T.texto3 }}>Nada escrito.</div>}
        </div>

        {/* Ocorrências do diário do mesmo dia e obra */}
        {s.ocorrencias && (
          <div style={secaoS}>
            <div style={tituloS}>📌 Ocorrências do diário ({s.ocorrencias.length})</div>
            {s.ocorrencias.length === 0
              ? <div style={{ fontSize: 12, color: T.texto3 }}>Nenhuma ocorrência neste dia.</div>
              : s.ocorrencias.map((o, i) => (
                <div key={o.id ?? i} style={{ borderLeft: `3px solid ${ORANGE}`, paddingLeft: 8, marginTop: i ? 8 : 0 }}>
                  <div style={{ fontSize: 10, color: T.texto2, fontWeight: 700 }}>{[o.autor, horaDe(o)].filter(Boolean).join(" · ") || "—"}</div>
                  <div style={{ ...textoS, fontSize: 12 }}>{o.texto || "—"}</div>
                </div>
              ))}
          </div>
        )}

        {/* Fotos: miniaturas quando o aparelho tem a foto; senão só a quantidade */}
        <div style={secaoS}>
          <div style={tituloS}>📷 Fotos ({s.totalFotos})</div>
          {s.miniaturas.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
              {s.miniaturas.slice(0, LIMITE_MINIATURAS).map((src, i) => (
                <img key={i} src={src} alt={`Foto ${i + 1}`} loading="lazy" style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 8, background: T.superficie2, display: "block" }} />
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: T.texto3 }}>{s.totalFotos > 0 ? `${s.totalFotos} foto${s.totalFotos > 1 ? "s" : ""} na galeria da obra (abra o RDO completo para ver).` : "Nenhuma foto neste dia."}</div>
          )}
          {s.miniaturas.length > 0 && extras > 0 && <div style={{ fontSize: 11, color: T.texto2, marginTop: 6 }}>+ {extras} foto{extras > 1 ? "s" : ""} no RDO completo</div>}
        </div>

        {/* Refeições: só a quantidade por tipo (sem preço) */}
        {mostrarRefeicoes && (
          <div style={secaoS}>
            <div style={tituloS}>🍽️ Refeições</div>
            {s.refeicoes.length === 0
              ? <div style={{ fontSize: 12, color: T.texto3 }}>Nenhuma refeição marcada.</div>
              : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {s.refeicoes.map(x => (
                    <span key={x.chave} data-refeicao={x.chave} style={{ background: T.superficie2, color: T.texto, borderRadius: 8, padding: "4px 10px", fontSize: 12 }}>{x.rotulo}: <b style={{ color: T.titulo }}>{x.qtd}</b></span>
                  ))}
                </div>
              )}
          </div>
        )}

        {onAbrirCompleto && <Btn label="📄 Abrir RDO completo" color={BLUE} onClick={() => onAbrirCompleto(rdo)} style={{ marginTop: 4 }} />}
      </div>
    </Modal>
  );
}
