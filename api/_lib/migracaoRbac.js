import { FieldPath } from "firebase-admin/firestore";
import { trabalhadorCampo, obraCampo, perfilCampo } from "../../src/lib/permissoesDados.js";
import { idFotoValido } from "../../src/lib/fotoCaminho.js";
import { migrarFotosDaEmpresa } from "./fotosPrivadas.js";

export const ETAPAS_PROTECAO = Object.freeze(["trabalhadores", "obras", "usuarios", "presencas", "avisos", "fotosObjetos", "fotosDocumentos"]);
export const VERSAO_PROTECAO = 1;

// Uma página por chamada; cursores vêm exclusivamente do estado privado do servidor.
// Projeções contêm apenas os campos operacionais permitidos. Originais permanecem.
export async function migrarPaginaRbac({ db, bucket, empresaId, etapa, cursor = null, limite = 25 }) {
  if (!idFotoValido(empresaId) || !ETAPAS_PROTECAO.includes(etapa) || !Number.isInteger(limite) || limite < 1 || limite > 50) throw new Error("Migração inválida.");
  if (etapa === "fotosObjetos" || etapa === "fotosDocumentos") {
    const r = await migrarFotosDaEmpresa({ db, bucket, empresaId, etapa: etapa === "fotosObjetos" ? "objetos" : "documentos", cursor, limite, aplicar: true });
    return { ...r, etapa, proximaEtapa: r.cursor ? etapa : etapa === "fotosObjetos" ? "fotosDocumentos" : null };
  }
  const empresa = db.collection("empresas").doc(empresaId);
  let consulta = etapa === "usuarios" ? db.collection("usuarios").where("empresaId", "==", empresaId) : empresa.collection(etapa);
  consulta = consulta.orderBy(FieldPath.documentId()).limit(limite);
  if (cursor) consulta = consulta.startAfter(cursor);
  const pagina = await consulta.get();
  const resultado = { etapa, examinados: 0, alterados: 0, semVinculo: 0, falhas: [], cursor: null, proximaEtapa: etapa, concluido: false };
  for (const item of pagina.docs) {
    resultado.examinados++;
    try {
      const alterado = await db.runTransaction(async tx => {
        const atual = await tx.get(item.ref);
        if (!atual.exists) return 0;
        const d = atual.data();
        if (etapa === "usuarios" && d.empresaId !== empresaId) return 0;
        if (etapa === "trabalhadores") tx.set(empresa.collection("trabalhadoresCampo").doc(item.id), trabalhadorCampo({ ...d, id: d.id ?? item.id }));
        else if (etapa === "obras") tx.set(empresa.collection("obrasCampo").doc(item.id), obraCampo({ ...d, id: d.id ?? item.id }));
        else if (etapa === "usuarios") tx.set(empresa.collection("perfisCampo").doc(item.id), perfilCampo(d, item.id));
        else if (etapa === "presencas") {
          if (d.obraId !== undefined && d.obraId !== null && d.obraId !== "") return 0;
          // O trabalhador pode ter mudado de obra. Sua obra ATUAL não comprova
          // onde a presença antiga ocorreu. Conservar o registro para RH sem
          // atribuir uma obra e expor o histórico ao encarregado errado.
          return -1;
        } else if (etapa === "avisos") {
          const areaSistema = { folha: "equipe", prazo: "total", ponto: "campo" }[d.tipo];
          if (d.de === "sistema" && d.para?.tipo === "gestores" && areaSistema) {
            tx.update(item.ref, { para: { tipo: "area", area: areaSistema } });
          } else if (d.para?.tipo === "obra" && !Object.hasOwn(d.para, "perfil")) {
            tx.update(item.ref, { "para.perfil": null });
          } else return 0;
        }
        return 1;
      });
      if (alterado > 0) resultado.alterados++;
      if (alterado < 0) resultado.semVinculo++;
    } catch (e) { resultado.falhas.push({ id: item.id, codigo: String(e.code || "falha-migracao") }); }
  }
  resultado.cursor = pagina.docs.length === limite ? pagina.docs.at(-1).id : null;
  if (!resultado.cursor) resultado.proximaEtapa = ETAPAS_PROTECAO[ETAPAS_PROTECAO.indexOf(etapa) + 1] || null;
  return resultado;
}
