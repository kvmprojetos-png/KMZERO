import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { firebaseAdmin } from "./_lib/firebaseAdmin.js";
import { criarBackupEmpresa, verificarBackupEmpresa } from "./_lib/backupEmpresa.js";
import { migrarPaginaRbac, VERSAO_PROTECAO } from "./_lib/migracaoRbac.js";
import { BUCKET_FOTOS, idFotoValido } from "../src/lib/fotoCaminho.js";

const ERROS_LOGIN = new Set(["auth/argument-error", "auth/invalid-id-token", "auth/id-token-expired", "auth/id-token-revoked", "auth/user-disabled", "auth/user-not-found"]);
const DURACAO_TRAVA = 10 * 60 * 1000;
const erro = (codigo, mensagem) => Object.assign(new Error(mensagem), { status: codigo });
const backupPublico = b => b ? { id: b.id, criadoEm: b.criadoEm, verificado: b.verificado === true, contagens: b.contagens || {} } : null;
const estadoPublico = e => e ? { status: e.status || "pendente", etapa: e.etapa || null, backupId: e.backupId || null,
  versao: e.versao || null, concluidoEm: e.concluidoEm || null, totais: e.totais || {}, falhas: e.falhas || [] } : null;

function validar(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0"); res.setHeader("Vary", "Authorization");
  if (!["GET", "POST"].includes(req.method)) { res.setHeader("Allow", "GET, POST"); res.status(405).json({ erro: "Use GET ou POST." }); return null; }
  const h = req.headers?.authorization;
  const token = typeof h === "string" && h.length <= 16384 ? /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(h)?.[1] : null;
  if (!token) { res.status(401).json({ erro: "Sem login." }); return null; }
  const dados = req.method === "GET" ? req.query : req.body;
  if (!dados || Array.isArray(dados) || !idFotoValido(dados.empresaId)
    || (req.method === "POST" && !["backup", "migrar"].includes(dados.acao))
    || (req.method === "POST" && dados.acao === "migrar" && !idFotoValido(dados.backupId))) {
    res.status(400).json({ erro: "Pedido de segurança inválido." }); return null;
  }
  return { token, empresaId: dados.empresaId, acao: dados.acao, backupId: dados.backupId };
}

export default async function handler(req, res) {
  if (!validar(req, res)) return;
  let admin;
  try { admin = { ...firebaseAdmin(), bucket: getStorage().bucket(BUCKET_FOTOS) }; }
  catch (e) { console.error("seguranca: configuração indisponível", e.code || "falha-interna"); return res.status(503).json({ erro: "Segurança indisponível no servidor." }); }
  return tratarSeguranca(admin, req, res);
}

// Dependências de backup/migração podem ser injetadas somente pelos testes locais.
export async function tratarSeguranca({ db, auth, bucket }, req, res, tarefas = {}) {
  const p = validar(req, res); if (!p) return;
  const criarBackup = tarefas.criarBackup || criarBackupEmpresa;
  const verificarBackup = tarefas.verificarBackup || verificarBackupEmpresa;
  const migrar = tarefas.migrar || migrarPaginaRbac;
  let estadoRef, trava;
  try {
    const pessoa = await auth.verifyIdToken(p.token, true);
    const perfil = (await db.collection("usuarios").doc(pessoa.uid).get()).data();
    if (!perfil || perfil.ativo === false || perfil.empresaId !== p.empresaId) throw erro(403, "Sem acesso à empresa.");
    const empresaRef = db.collection("empresas").doc(p.empresaId);
    const empresa = (await empresaRef.get()).data();
    if (!empresa || empresa.gestorUid !== pessoa.uid) throw erro(403, "Somente o proprietário pode executar esta proteção.");
    estadoRef = empresaRef.collection("_seguranca").doc("estado");
    const anterior = (await estadoRef.get()).data() || {};
    if (req.method === "GET") {
      const backup = anterior.backupId ? (await empresaRef.collection("_backups").doc(anterior.backupId).get()).data() : null;
      return res.status(200).json({ ok: true, estado: estadoPublico(anterior), backup: backupPublico(backup) });
    }
    // Trava privada com expiração: duas abas não repetem a mesma página. Se a
    // função morrer, a próxima tentativa pode retomar após 10 minutos.
    trava = randomUUID();
    const estado = await db.runTransaction(async tx => {
      const atual = (await tx.get(estadoRef)).data() || {};
      if (atual.trava && atual.travaAte > Date.now()) throw erro(409, "Outra verificação está em andamento. Aguarde.");
      if (p.acao === "migrar" && atual.backupId && atual.backupId !== p.backupId && atual.status === "migrando") throw erro(409, "Use o backup da migração em andamento.");
      tx.set(estadoRef, { trava, travaAte: Date.now() + DURACAO_TRAVA }, { merge: true });
      return atual;
    });
    const salvarEstado = dados => db.runTransaction(async tx => {
      const atual = (await tx.get(estadoRef)).data() || {};
      if (atual.trava !== trava) throw erro(409, "Verificação interrompida. Consulte o estado antes de continuar.");
      tx.set(estadoRef, { ...dados, trava: null, travaAte: 0 }, { merge: true });
    });
    if (p.acao === "backup") {
      if (estado.status === "migrando") throw erro(409, "Conclua a migração em andamento antes de criar outro backup.");
      const b = await criarBackup({ db, bucket, empresaId: p.empresaId, uid: pessoa.uid });
      if (!b?.verificado || !idFotoValido(b.id)) throw new Error("Backup não verificado");
      await salvarEstado({ status: "backup-pronto", backupId: b.id, etapa: "trabalhadores", cursor: null,
        versao: null, concluidoEm: null, totais: {}, falhas: [], atualizadoEm: Date.now() });
      return res.status(200).json({ ok: true, backup: backupPublico(b), backupId: b.id, verificado: true });
    }
    if (estado.status === "concluido" && estado.versao === VERSAO_PROTECAO && estado.backupId === p.backupId) {
      await salvarEstado({}); return res.status(200).json({ ok: true, concluido: true, estado: estadoPublico(estado) });
    }
    if (estado.backupId !== p.backupId) throw erro(409, "Crie e verifique um backup antes de migrar.");
    const backupConferido = await verificarBackup({ db, bucket, empresaId: p.empresaId, uid: pessoa.uid, backupId: p.backupId });
    if (backupConferido?.verificado !== true) throw erro(409, "O backup ainda não foi verificado.");
    const etapa = estado.etapa || "trabalhadores";
    const resultado = await migrar({ db, bucket, empresaId: p.empresaId, etapa, cursor: estado.cursor || null, limite: 25 });
    const falhou = resultado.falhas.length > 0;
    const concluido = !falhou && resultado.proximaEtapa === null && !resultado.cursor;
    const totais = { ...(estado.totais || {}) };
    // Só acumular páginas concluídas. Em falha, repete a mesma página com ações
    // idempotentes; nunca avança o cursor por cima de dados que falharam.
    if (!falhou) {
      const t = totais[etapa] || { examinados: 0, alterados: 0, semVinculo: 0 };
      totais[etapa] = { examinados: t.examinados + resultado.examinados, alterados: t.alterados + resultado.alterados,
        semVinculo: t.semVinculo + (resultado.semVinculo || 0) };
    }
    const novo = { status: concluido ? "concluido" : "migrando", backupId: p.backupId,
      etapa: falhou ? etapa : resultado.proximaEtapa, cursor: falhou ? estado.cursor || null : resultado.cursor,
      totais, falhas: resultado.falhas, atualizadoEm: Date.now(),
      ...(concluido ? { versao: VERSAO_PROTECAO, concluidoEm: Date.now() } : {}) };
    await salvarEstado(novo);
    return res.status(200).json({ ok: !falhou, ...resultado, concluido, estado: estadoPublico(novo) });
  } catch (e) {
    if (estadoRef && trava) {
      try { await db.runTransaction(async tx => {
        const atual = (await tx.get(estadoRef)).data();
        if (atual?.trava === trava) tx.set(estadoRef, { trava: null, travaAte: 0 }, { merge: true });
      }); } catch { /* TTL permite retomar após queda de rede. */ }
    }
    if (ERROS_LOGIN.has(e.code)) return res.status(401).json({ erro: "Login expirado. Entre de novo." });
    if (e.status) return res.status(e.status).json({ erro: e.message });
    console.error("seguranca:", e.code || "falha-interna");
    return res.status(500).json({ erro: "A proteção não foi concluída. O progresso salvo permite tentar novamente." });
  }
}
