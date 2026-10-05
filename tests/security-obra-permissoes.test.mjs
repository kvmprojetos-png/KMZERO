import test from "node:test";
import assert from "node:assert/strict";
import { CAMPOS_CONTRATO_OBRA, prepararObraParaSalvar } from "../src/lib/obraPermissoes.js";

const operacional = { perfil: "gestor", acessos: ["visao", "obras"] };
const formulario = { nome: "Obra fictícia", local: "Cidade fictícia", apontadorId: "123", clienteId: "7", cliente: "", clienteDoc: "", valorContrato: "999", formaPagContrato: "À vista" };

test("nova obra operacional omite até valores vazios de contrato", () => {
  const dados = prepararObraParaSalvar(formulario, null, operacional);
  assert.equal(dados.nome, "Obra fictícia");
  assert.equal(dados.apontadorId, 123);
  for (const campo of CAMPOS_CONTRATO_OBRA) assert.equal(Object.hasOwn(dados, campo), false);
  assert.equal(formulario.valorContrato, "999", "não altera o estado do formulário por referência");
});

test("edição operacional preserva contrato mais recente e não introduz campos ausentes", () => {
  const atual = { nome: "Antiga", cliente: "Cliente atual", valorContrato: "200", obsContrato: null };
  const dados = prepararObraParaSalvar(formulario, atual, operacional);
  assert.equal(dados.nome, "Obra fictícia");
  assert.equal(dados.cliente, "Cliente atual");
  assert.equal(dados.valorContrato, "200");
  assert.equal(dados.obsContrato, null);
  assert.equal(Object.hasOwn(dados, "formaPagContrato"), false);
  assert.equal(Object.hasOwn(dados, "clienteDoc"), false);
});

test("Financeiro e gestor total preservam as edições financeiras autorizadas", () => {
  for (const usuario of [{ perfil: "gestor", acessos: ["obras", "financeiro"] }, { perfil: "gestor" }]) {
    const dados = prepararObraParaSalvar(formulario, { valorContrato: "100" }, usuario);
    assert.equal(dados.valorContrato, "999");
    assert.equal(dados.formaPagContrato, "À vista");
  }
});

test("usuário ausente ou desativado não recebe permissão financeira por padrão", () => {
  for (const usuario of [null, { perfil: "gestor", ativo: false }]) {
    assert.equal(Object.hasOwn(prepararObraParaSalvar(formulario, null, usuario), "valorContrato"), false);
  }
});
