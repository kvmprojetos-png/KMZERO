import { temAreaDados } from "./permissoesDados.js";
import { normId } from "./ids.js";

export const CAMPOS_CONTRATO_OBRA = ["cliente", "clienteDoc", "valorContrato", "dataInicioContrato", "dataFimContrato", "formaPagContrato", "obsContrato"];

// O formulário operacional não muda/remova contratos quando seu usuário não é do Financeiro.
// Usa a versão atual da obra para preservar uma atualização recebida enquanto o modal estava aberto.
export function prepararObraParaSalvar(form, obraAtual, usuario) {
  const dados = { ...form, apontadorId: normId(form.apontadorId) ?? "", clienteId: normId(form.clienteId) ?? "" };
  if (!temAreaDados(usuario, "financeiro")) {
    for (const campo of CAMPOS_CONTRATO_OBRA) {
      delete dados[campo];
      if (obraAtual && Object.hasOwn(obraAtual, campo)) dados[campo] = obraAtual[campo];
    }
  }
  return dados;
}
