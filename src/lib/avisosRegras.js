/* Regras dos AVISOS (notificações) — usadas no app E no servidor (api/), por isso
   este arquivo é JavaScript puro: nada de React, navegador ou Firebase aqui.

   Um aviso é um documento em empresas/{empresaId}/avisos/{id}:
     { id, titulo, texto, tipo, para, de, deNome, criadoEm, navegarPara, push? }
   `para` diz quem recebe:
     { tipo: "todos" }                       todo mundo da empresa
     { tipo: "gestores" }                    gestores (diretores entram como gestor)
     { tipo: "encarregados" }                equipe de campo
     { tipo: "obra", obraId, perfil? }       quem está vinculado à obra (perfil opcional filtra)
     { tipo: "pessoa", uid }                 uma pessoa */

export const TIPOS_AVISO = {
  manual: { icone: "📢", nome: "Aviso" },
  pedido: { icone: "📦", nome: "Pedido de material" },
  ponto:  { icone: "⏰", nome: "Ponto" },
  folha:  { icone: "💰", nome: "Pagamento" },
  prazo:  { icone: "⚠️", nome: "Prazos e alertas" },
  teste:  { icone: "🔔", nome: "Teste" },
};

export const uidDe = u => String((u && (u.firebaseUid || u.id)) || "");

// Este aviso é para esta pessoa? (u = perfil: { firebaseUid|id, perfil, obraId })
export function avisoEhPara(aviso, u) {
  if (!aviso || !u) return false;
  const p = aviso.para || { tipo: "todos" };
  const gestor = u.perfil === "gestor";
  switch (p.tipo) {
    case "todos":        return true;
    case "gestores":     return gestor;
    case "encarregados": return !gestor;
    case "obra":         return u.obraId !== null && u.obraId !== undefined && String(u.obraId) === String(p.obraId) && (!p.perfil || (p.perfil === "gestor") === gestor);
    case "pessoa":       return uidDe(u) === String(p.uid);
    default:             return false;
  }
}

// Texto curto do destinatário ("Todos", "Obra IFES", "João")
export function descreverPara(para, { obras = [], usuarios = [] } = {}) {
  const p = para || { tipo: "todos" };
  if (p.tipo === "todos") return "Todos";
  if (p.tipo === "gestores") return "Gestores e diretores";
  if (p.tipo === "encarregados") return "Encarregados";
  if (p.tipo === "obra") {
    const o = obras.find(x => String(x.id) === String(p.obraId));
    return `Obra ${o ? o.nome : ""}`.trim() + (p.perfil === "encarregado" ? " (encarregados)" : "");
  }
  if (p.tipo === "pessoa") {
    const u = usuarios.find(x => uidDe(x) === String(p.uid));
    return u ? u.nome : "Uma pessoa";
  }
  return "";
}

/* ── Datas no fuso do Brasil (o servidor roda em UTC) ── */
export function isoNoFuso(data = new Date(), fuso = "America/Sao_Paulo") {
  // en-CA formata como AAAA-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(data);
}
export const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const somarDias = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return isoLocal(d); };
export const diasEntre = (isoA, isoB) => Math.round((new Date(isoB + "T12:00:00") - new Date(isoA + "T12:00:00")) / 86400000);
export const dataBR = iso => iso ? iso.split("-").reverse().slice(0, 2).join("/") : "";          // 25/09
export const dataBRAno = iso => iso ? iso.split("-").reverse().join("/") : "";                        // 25/09/2026

/* Próxima data de pagamento de um trabalhador — mesma regra da Folha "Por Ciclo"
   (presenca.jsx → calcularCiclo): conta dias de semana depois do último pagamento
   (5 semanal, 10 quinzenal); o mensal fecha no "dia X" do mês (diaPagamentoMes). */
export function proximoPagamento(t) {
  if (!t || !t.ultimoPagamento) return null;
  const tipo = t.tipoFolha || "quinzenal";
  const ancora = new Date(t.ultimoPagamento + "T12:00:00");
  if (isNaN(ancora)) return null;
  if (tipo === "mensal") {
    const diaPg = Math.min(31, Math.max(1, parseInt(t.diaPagamentoMes, 10) || 5));
    const noMes = (ano, mes) => new Date(ano, mes, Math.min(diaPg, new Date(ano, mes + 1, 0).getDate()), 12);
    let fim = noMes(ancora.getFullYear(), ancora.getMonth());
    if (fim <= ancora) fim = noMes(ancora.getFullYear(), ancora.getMonth() + 1);
    return { data: isoLocal(fim), inicio: isoLocal(new Date(ancora.getTime() + 86400000)) };
  }
  const nUteis = tipo === "semanal" ? 5 : 10;
  const cursor = new Date(ancora);
  let contados = 0, inicio = null, guard = 0;
  while (contados < nUteis && guard++ < 60) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() === 0 || cursor.getDay() === 6) continue;
    if (!inicio) inicio = isoLocal(cursor);
    contados++;
  }
  return { data: isoLocal(cursor), inicio };
}
