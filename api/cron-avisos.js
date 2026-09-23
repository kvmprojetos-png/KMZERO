/* GET /api/cron-avisos?etapa=tarde|noite — chamado pelo Cron do Vercel (vercel.json).
   O Vercel manda "Authorization: Bearer <CRON_SECRET>"; sem isso a rota recusa.

   tarde (~16h, seg–sex): obra sem ponto hoje → lembrete para o encarregado da obra.
   noite (~19h, todo dia):
     • ponto ainda não lançado → gestores (lista das obras)
     • pagamento no próximo dia útil (Equipe 1/2, mensal) → gestores
     • prazos: contrato perto do fim/vencido, etapa do cronograma atrasada,
       ASO vencendo/vencido, equipamento quebrado → gestores, UMA vez por item
     • avisos que ficaram sem disparar (app fechou sem internet) → dispara agora

   "Uma vez por item": cada alerta tem uma chave em empresas/{id}/avisosEnviados;
   se a chave já existe, não repete. */
import { firebaseAdmin } from "./_lib/firebaseAdmin.js";
import { enviarPush } from "./_lib/enviarAviso.js";
import { isoNoFuso, somarDias, diasEntre, dataBR, dataBRAno, proximoPagamento } from "../src/lib/avisosRegras.js";
import { feriadoEm } from "../src/utils.js";

const diaUtil = iso => {
  const dow = new Date(iso + "T12:00:00").getDay();
  const f = feriadoEm(iso);
  return dow !== 0 && dow !== 6 && !(f && f.tipo === "nacional");
};
const reais = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function handler(req, res) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.authorization !== `Bearer ${segredo}`) return res.status(401).json({ erro: "Não autorizado." });
  const etapa = req.query?.etapa === "tarde" ? "tarde" : "noite";
  const { db, mensageiro } = firebaseAdmin();
  const hoje = isoNoFuso(new Date());
  const empresas = await db.collection("empresas").listDocuments();
  const resumo = [];
  for (const e of empresas) {
    try { resumo.push({ empresa: e.id, ...(await verificarEmpresa(db, mensageiro, e.id, etapa, hoje)) }); }
    catch (err) { console.error("cron", e.id, err); resumo.push({ empresa: e.id, erro: String(err.message || err) }); }
  }
  return res.status(200).json({ etapa, hoje, resumo });
}

export async function verificarEmpresa(db, mensageiro, empresaId, etapa, hoje) {
  const base = db.collection("empresas").doc(empresaId);
  const ler = async nome => (await base.collection(nome).get()).docs.map(d => d.data());
  const [obras, trabalhadores] = await Promise.all([ler("obras"), ler("trabalhadores")]);
  if (!obras.length && !trabalhadores.length) return { pulada: "sem dados" };

  const enviados = [];
  let seq = 0;
  const criar = async (aviso) => {
    const id = String(Date.now() * 100 + (seq++ % 100)); // numérico: o app ordena avisos pelo id
    const doc = { id, de: "sistema", deNome: "KMZERO", criadoEm: Date.now(), ...aviso, push: { disparadoEm: Date.now() } };
    await base.collection("avisos").doc(id).set(doc);
    const r = await enviarPush(db, mensageiro, empresaId, doc);
    await base.collection("avisos").doc(id).update({ "push.pessoas": r.pessoas, "push.aparelhos": r.aparelhos });
    enviados.push({ titulo: doc.titulo, ...r });
  };
  const chavesRef = base.collection("avisosEnviados");
  const jaFoi = new Set((await chavesRef.get()).docs.map(d => d.id));
  const marcar = chave => chavesRef.doc(chave).set({ chave, em: Date.now() });

  // ── Ponto de hoje ──
  const obrasAtivas = obras.filter(o => o.status === "Ativa" || !o.status);
  if (diaUtil(hoje)) {
    const pres = (await base.collection("presencas").where("data", "==", hoje).get()).docs.map(d => d.data());
    const comPonto = new Set(pres.map(p => String(p.trabId)));
    const semPonto = obrasAtivas.filter(o => {
      const equipe = trabalhadores.filter(t => String(t.obraId) === String(o.id) && t.ativo !== false);
      return equipe.length > 0 && !equipe.some(t => comPonto.has(String(t.id)));
    });
    if (etapa === "tarde") {
      for (const o of semPonto) {
        const chave = `ponto_${hoje}_${o.id}_enc`;
        if (jaFoi.has(chave)) continue;
        await criar({ tipo: "ponto", titulo: "⏰ Ponto de hoje ainda não lançado", texto: `${o.nome}: lance a presença da equipe antes de encerrar o dia.`, para: { tipo: "obra", obraId: o.id, perfil: "encarregado" }, navegarPara: "fluxo" });
        await marcar(chave);
      }
    } else if (semPonto.length && !jaFoi.has(`ponto_${hoje}_gestores`)) {
      await criar({ tipo: "ponto", titulo: `📋 Ponto não lançado hoje (${semPonto.length} obra${semPonto.length > 1 ? "s" : ""})`, texto: semPonto.map(o => `• ${o.nome}`).join("\n"), para: { tipo: "gestores" }, navegarPara: "calendario" });
      await marcar(`ponto_${hoje}_gestores`);
    }
  }
  if (etapa === "tarde") return { enviados };

  // ── Pagamento no próximo dia útil ──
  let proxUtil = somarDias(hoje, 1);
  while (!diaUtil(proxUtil)) proxUtil = somarDias(proxUtil, 1);
  const pagar = trabalhadores
    .filter(t => t.ativo !== false)
    .map(t => ({ t, ciclo: proximoPagamento(t) }))
    .filter(x => x.ciclo && x.ciclo.data > hoje && x.ciclo.data <= proxUtil);
  const chaveFolha = `folha_${proxUtil}`;
  if (pagar.length && !jaFoi.has(chaveFolha)) {
    const ini = pagar.reduce((m, x) => (x.ciclo.inicio < m ? x.ciclo.inicio : m), proxUtil);
    const pres = (await base.collection("presencas").where("data", ">=", ini).where("data", "<=", proxUtil).get()).docs.map(d => d.data());
    const dias = (t, c) => pres.filter(p => String(p.trabId) === String(t.id) && p.data >= c.inicio && p.data <= c.data)
      .reduce((s, p) => s + (p.status === "Presente" ? 1 : p.status === "Meia" ? 0.5 : 0), 0);
    const grupos = {};
    let total = 0;
    pagar.forEach(({ t, ciclo }) => {
      const nome = t.tipoFolha === "mensal" ? "Mensalistas" : t.equipe ? `Equipe ${t.equipe}` : "Sem equipe";
      const valor = dias(t, ciclo) * (parseFloat(t.diaria) || 0);
      grupos[nome] = grupos[nome] || { n: 0, valor: 0, data: ciclo.data };
      grupos[nome].n++; grupos[nome].valor += valor; total += valor;
    });
    const quando = proxUtil === somarDias(hoje, 1) ? "Amanhã" : `${dataBR(proxUtil)}`;
    await criar({
      tipo: "folha",
      titulo: `💰 ${quando} tem pagamento — ≈ ${reais(total)}`,
      texto: Object.entries(grupos).map(([g, x]) => `• ${g}: ${x.n} pessoa${x.n > 1 ? "s" : ""} (${dataBR(x.data)}) ≈ ${reais(x.valor)}`).join("\n") + "\nEstimativa pelas diárias lançadas, antes de vales.",
      para: { tipo: "gestores" }, navegarPara: "folha",
    });
    await marcar(chaveFolha);
  }

  // ── Prazos e alertas (cada item avisa uma vez) ──
  const novos = [];
  const item = (chave, texto) => { if (!jaFoi.has(chave)) novos.push({ chave, texto }); };
  obrasAtivas.forEach(o => {
    if (!o.dataFimContrato) return;
    const d = diasEntre(hoje, o.dataFimContrato);
    if (d < 0) item(`prazo_${o.id}_${o.dataFimContrato}_vencido`, `🏁 ${o.nome}: prazo do contrato venceu em ${dataBRAno(o.dataFimContrato)}`);
    else {
      const marco = [0, 7, 15, 30].find(m => d <= m);
      if (marco !== undefined) item(`prazo_${o.id}_${o.dataFimContrato}_${marco}`, `🏁 ${o.nome}: contrato termina em ${d} dia${d === 1 ? "" : "s"} (${dataBRAno(o.dataFimContrato)})`);
    }
  });
  const cronos = await ler("cronogramas");
  cronos.forEach(c => {
    const o = obrasAtivas.find(x => String(x.id) === String(c.obraId || c.id));
    if (!o) return;
    const atrasadas = (c.etapas || [])
      .filter(e => e.fim && (Number(e.progresso) || 0) < 100 && e.fim < hoje)
      .map(e => ({ e, chave: `etapa_${o.id}_${e.id}_${e.fim}` }))
      .filter(x => !jaFoi.has(x.chave));
    if (!atrasadas.length) return;
    // Até 2 etapas: uma linha para cada. Mais que isso: uma linha só para a obra
    // (ex.: cronograma sem avanço lançado deixa tudo "atrasado" de uma vez).
    if (atrasadas.length <= 2) {
      atrasadas.forEach(({ e, chave }) => item(chave, `📅 ${o.nome}: "${e.nome}" atrasada desde ${dataBR(e.fim)} (${Number(e.progresso) || 0}%)`));
    } else {
      const maisAntiga = atrasadas.reduce((m, x) => (x.e.fim < m ? x.e.fim : m), hoje);
      atrasadas.forEach(({ chave }, i) => novos.push({ chave, texto: i === 0 ? `📅 ${o.nome}: ${atrasadas.length} etapas atrasadas (a mais antiga desde ${dataBRAno(maisAntiga)}) — confira o avanço no Cronograma` : null }));
    }
  });
  trabalhadores.filter(t => t.ativo !== false && t.asoValidade).forEach(t => {
    const d = diasEntre(hoje, t.asoValidade);
    if (d < 0) item(`aso_${t.id}_${t.asoValidade}_vencido`, `🏥 ASO de ${t.nome} vencido (${dataBR(t.asoValidade)})`);
    else if (d <= 30) item(`aso_${t.id}_${t.asoValidade}_30`, `🏥 ASO de ${t.nome} vence em ${d} dia${d === 1 ? "" : "s"}`);
  });
  const equips = await ler("equips");
  for (const q of equips) {
    const chave = `equip_${q.id}_quebrada`;
    if (q.status === "Quebrada") item(chave, `🔧 Equipamento quebrado: ${q.nome || "sem nome"}`);
    else if (jaFoi.has(chave)) await chavesRef.doc(chave).delete(); // consertou: se quebrar de novo, avisa de novo
  }
  const linhas = novos.map(x => x.texto).filter(Boolean);
  if (linhas.length) {
    const mostrar = linhas.slice(0, 12);
    if (linhas.length > 12) mostrar.push(`… e mais ${linhas.length - 12}. Veja em Alertas.`);
    await criar({ tipo: "prazo", titulo: `⚠️ ${linhas.length} alerta${linhas.length > 1 ? "s" : ""} novo${linhas.length > 1 ? "s" : ""}`, texto: mostrar.join("\n"), para: { tipo: "gestores" }, navegarPara: "alertas" });
    const lote = db.batch(); // várias chaves de uma vez (a Quadra sozinha tem 17 etapas)
    novos.forEach(x => lote.set(chavesRef.doc(x.chave), { chave: x.chave, em: Date.now() }));
    await lote.commit();
  }

  // ── Avisos que ficaram sem disparar ──
  const desde = Date.now() - 24 * 3600 * 1000;
  const pendentes = (await base.collection("avisos").where("criadoEm", ">=", desde).get()).docs
    .map(d => ({ ref: d.ref, a: { ...d.data(), id: d.id } }))
    .filter(x => !x.a.push?.disparadoEm && x.a.de && x.a.de !== "sistema");
  for (const { ref, a } of pendentes) {
    const autor = (await db.collection("usuarios").doc(a.de).get()).data();
    const pode = autor && autor.ativo !== false && autor.empresaId === empresaId && (autor.perfil === "gestor" || ["gestores", "pessoa"].includes(a.para?.tipo));
    await ref.update({ "push.disparadoEm": Date.now(), ...(pode ? {} : { "push.recusado": true }) });
    if (!pode) continue;
    const r = await enviarPush(db, mensageiro, empresaId, a, { excetoUid: a.de });
    await ref.update({ "push.pessoas": r.pessoas, "push.aparelhos": r.aparelhos });
    enviados.push({ titulo: a.titulo, atrasado: true, ...r });
  }
  return { enviados };
}
