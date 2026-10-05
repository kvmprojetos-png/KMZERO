// Cenários somente fictícios, chamados pelo runner que exige os emuladores locais.
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, collection, setDoc, updateDoc, getDoc, getDocs, query, where, or, deleteDoc, writeBatch } from "firebase/firestore";
import { prepararObraParaSalvar } from "../src/lib/obraPermissoes.js";
import { trabalhadorCampo, obraCampo } from "../src/lib/permissoesDados.js";

export async function testarRbac(env, check) {
  const empresa = "empresa-a";
  const actor = uid => env.authenticatedContext(uid, { email: `${uid}@example.test`, email_verified: true }).firestore();
  const ref = (uid, col, id = "amostra") => doc(actor(uid), "empresas", empresa, col, id);
  const salvarProjetado = (uid, col, dados) => {
    const db = actor(uid), batch = writeBatch(db);
    const projetar = col === "obras" ? obraCampo : trabalhadorCampo;
    batch.set(doc(db, "empresas", empresa, col, String(dados.id)), dados);
    batch.set(doc(db, "empresas", empresa, `${col}Campo`, String(dados.id)), projetar(dados));
    return batch.commit();
  };
  const excluirProjetado = (uid, col, id) => {
    const db = actor(uid), batch = writeBatch(db);
    batch.delete(doc(db, "empresas", empresa, col, id));
    batch.delete(doc(db, "empresas", empresa, `${col}Campo`, id));
    return batch.commit();
  };
  const data = { id: "amostra", obraId: 101, nome: "Registro fictício", status: "Aguardando" };
  const roles = { rh: ["visao", "equipe"], fin: ["visao", "financeiro"], obra: ["visao", "obras"], op: ["visao", "campo"], sup: ["visao", "suprimentos"], equip: ["visao", "equipamentos"], minimo: ["visao"] };
  const matrix = {
    trabalhadores: ["rh"], ferias: ["rh"], adiantamentos: ["rh"], folhasSalvas: ["rh"],
    obras: ["obra", "fin"], clientes: ["obra"], fornecedores: ["sup", "fin"],
    despesasAvulsas: ["fin"], cronogramas: ["obra", "op"], rdos: ["op"], diario: ["op"], produtividade: ["op"],
    ativos: ["equip", "fin"], equips: ["equip", "fin"], ferramentas: ["equip", "fin"], manutencoes: ["equip", "fin"], abastecimentos: ["equip", "fin"],
    pedidos: ["sup", "fin"], recebimentos: ["sup", "fin"], fotosObras: ["op"],
  };
  await env.withSecurityRulesDisabled(async admin => {
    const db = admin.firestore();
    await Promise.all([
      ...Object.entries(roles).map(([uid, acessos]) => setDoc(doc(db, "usuarios", uid), { empresaId: empresa, perfil: "gestor", ativo: true, email: `${uid}@example.test`, acessos })),
      ...Object.keys(matrix).map(col => setDoc(doc(db, "empresas", empresa, col, "amostra"), { ...data, ...(col === "trabalhadores" ? { cpf: "CPF-FICTICIO", diaria: 100 } : {}) })),
      setDoc(doc(db, "empresas", empresa, "trabalhadoresCampo", "t1"), { id: "t1", nome: "Fictício 1", cargo: "Teste", obraId: 101, ativo: true }),
      setDoc(doc(db, "empresas", empresa, "trabalhadoresCampo", "t2"), { id: "t2", nome: "Fictício 2", cargo: "Teste", obraId: 202, ativo: true }),
      setDoc(doc(db, "empresas", empresa, "rdos", "outra-obra"), { id: "outra-obra", obraId: 202 }),
      setDoc(doc(db, "empresas", empresa, "rdos", "string-obra"), { id: "string-obra", obraId: "101" }),
      setDoc(doc(db, "empresas", empresa, "equips", "outra-obra"), { id: "outra-obra", obraId: 202, status: "Disponível" }),
      setDoc(doc(db, "empresas", empresa, "obras", "contrato"), { id: "contrato", nome: "Obra com contrato fictício", valorContrato: "100", cliente: "Teste", clienteDoc: "FICTICIO" }),
      setDoc(doc(db, "empresas", empresa, "mensagens", "msg"), { id: "msg", de: "gestor", para: "campo", texto: "Mensagem fictícia", ts: 1000, lida: false }),
      setDoc(doc(db, "convites", "obra-forjada@example.test"), { empresaId: empresa, perfil: "encarregado", obraId: 101, email: "obra-forjada@example.test" }),
      setDoc(doc(db, "convites", "obra-texto@example.test"), { empresaId: empresa, perfil: "encarregado", obraId: "101", email: "obra-texto@example.test" }),
      setDoc(doc(db, "empresas", empresa, "presencas", "ponto-gestor"), { data: "2026-10-01", trabId: "t1", obraId: 101, status: "Presente", editadoPorGestor: true }),
      setDoc(doc(db, "empresas", empresa, "avisos", "folha-privada"), { id: "folha-privada", de: "gestor", tipo: "folha", titulo: "Folha fictícia", texto: "Valor fictício", criadoEm: 1000, para: { tipo: "area", area: "equipe" } }),
      setDoc(doc(db, "empresas", empresa, "avisos", "total-privado"), { id: "total-privado", de: "sistema", tipo: "prazo", titulo: "Resumo fictício", texto: "Dados fictícios", criadoEm: 1000, para: { tipo: "area", area: "total" } }),
      setDoc(doc(db, "empresas", empresa, "avisos", "obra-privada"), { id: "obra-privada", de: "gestor", tipo: "manual", titulo: "Obra fictícia", texto: "Dados fictícios", criadoEm: 1000, para: { tipo: "obra", obraId: 101, perfil: null } }),
    ]);
  });
  for (const [col, permitidos] of Object.entries(matrix)) {
    for (const uid of [...permitidos, "minimo", "admin-sistema"]) {
      await check(`${col}: ${uid} ${permitidos.includes(uid) ? "lê área autorizada" : "não lê área ausente"}`, () =>
        (permitidos.includes(uid) ? assertSucceeds : assertFails)(getDoc(ref(uid, col))));
    }
    await check(`${col}: sem área não altera dados por cliente próprio`, () => assertFails(updateDoc(ref("minimo", col), { nome: "Tentativa não autorizada" })));
  }
  await check("gestor antigo com acesso total preserva RH", () => assertSucceeds(getDoc(ref("gestor", "trabalhadores"))));
  await check("campo não lê CPF/diária do documento original", () => assertFails(getDoc(ref("campo", "trabalhadores"))));
  await check("campo consulta projeções só da obra com id numérico/string", () => assertSucceeds(getDocs(query(collection(actor("campo"), "empresas", empresa, "trabalhadoresCampo"), where("obraId", "in", [101, "101"])))));
  await check("campo não consulta todos os trabalhadores operacionais", () => assertFails(getDocs(collection(actor("campo"), "empresas", empresa, "trabalhadoresCampo"))));
  await check("campo não lê trabalhador operacional de outra obra", () => assertFails(getDoc(ref("campo", "trabalhadoresCampo", "t2"))));
  await check("RH não publica CPF na projeção do campo", () => assertFails(setDoc(ref("rh", "trabalhadoresCampo", "vazamento"), { id: "vazamento", nome: "Teste", obraId: 101, cpf: "CPF-FICTICIO" })));
  await check("RH não publica diária na projeção do campo", () => assertFails(setDoc(ref("rh", "trabalhadoresCampo", "vazamento"), { id: "vazamento", nome: "Teste", obraId: 101, diaria: 100 })));
  const trabalhadorNovo = { id: "novo", nome: "Teste", cargo: "Teste", obraId: 101, ativo: true, cpf: "CPF-FICTICIO", diaria: 100 };
  await check("RH cria original e projeção mínima válida no mesmo batch", () => assertSucceeds(salvarProjetado("rh", "trabalhadores", trabalhadorNovo)));
  await check("cliente antigo não cria trabalhador sem projeção", () => assertFails(setDoc(ref("rh", "trabalhadores", "sem-projecao"), { ...trabalhadorNovo, id: "sem-projecao" })));
  await check("RH não cria projeção sem trabalhador original", () => assertFails(setDoc(ref("rh", "trabalhadoresCampo", "fantasma"), trabalhadorCampo({ ...trabalhadorNovo, id: "fantasma" }))));
  await check("cliente antigo não transfere trabalhador sem atualizar projeção", () => assertFails(updateDoc(ref("rh", "trabalhadores", "novo"), { obraId: 202 })));
  await check("RH não transfere apenas a projeção", () => assertFails(updateDoc(ref("rh", "trabalhadoresCampo", "novo"), { obraId: 202 })));
  await check("RH transfere original e projeção de forma atômica", () => assertSucceeds(salvarProjetado("rh", "trabalhadores", { ...trabalhadorNovo, obraId: 202 })));
  await check("encarregado da obra antiga perde leitura após transferência atômica", () => assertFails(getDoc(ref("campo", "trabalhadoresCampo", "novo"))));
  await check("RH altera só salário legado sem depender de projeção ausente", () => assertSucceeds(updateDoc(ref("rh", "trabalhadores"), { diaria: 150 })));
  await check("cliente antigo não apaga original deixando projeção órfã", () => assertFails(deleteDoc(ref("rh", "trabalhadores", "novo"))));
  await check("RH não apaga apenas projeção de trabalhador existente", () => assertFails(deleteDoc(ref("rh", "trabalhadoresCampo", "novo"))));
  await check("RH apaga trabalhador e projeção no mesmo batch", () => assertSucceeds(excluirProjetado("rh", "trabalhadores", "novo")));
  await check("obras não publica contrato na projeção", () => assertFails(setDoc(ref("obra", "obrasCampo", "vazamento"), { id: "vazamento", nome: "Teste", valorContrato: 100 })));
  await check("campo não altera sua obra no perfil", () => assertFails(updateDoc(doc(actor("campo"), "usuarios/campo"), { obraId: 202 })));
  await check("restrito não apaga perfil para reutilizar convite antigo mais poderoso", () => assertFails(deleteDoc(doc(actor("minimo"), "usuarios/minimo"))));
  await check("convite não permite escolher obra diferente", () => assertFails(setDoc(doc(actor("obra-forjada"), "usuarios/obra-forjada"), { empresaId: empresa, perfil: "encarregado", obraId: 202, email: "obra-forjada@example.test" })));
  await check("convite legado normaliza id texto para número da mesma obra", () => assertSucceeds(setDoc(doc(actor("obra-texto"), "usuarios/obra-texto"), { empresaId: empresa, perfil: "encarregado", obraId: 101, email: "obra-texto@example.test" })));
  await check("perfil preserva a mesma obra ao normalizar tipo do id", () => assertSucceeds(updateDoc(doc(actor("obra-texto"), "usuarios/obra-texto"), { obraId: "101" })));
  await check("campo não lista perfis completos com emails", () => assertFails(getDocs(query(collection(actor("campo"), "usuarios"), where("empresaId", "==", empresa)))));
  await check("RH lista perfis administrativos da própria empresa", () => assertSucceeds(getDocs(query(collection(actor("rh"), "usuarios"), where("empresaId", "==", empresa)))));
  await check("financeiro não altera permissão nem obra de outro perfil", () => assertFails(updateDoc(doc(actor("fin"), "usuarios/campo"), { obraId: 202 })));
  await check("campo lê RDO da própria obra em id legado texto", () => assertSucceeds(getDoc(ref("campo", "rdos", "string-obra"))));
  await check("campo não lê RDO de outra obra", () => assertFails(getDoc(ref("campo", "rdos", "outra-obra"))));
  await check("campo consulta RDO da própria obra", () => assertSucceeds(getDocs(query(collection(actor("campo"), "empresas", empresa, "rdos"), where("obraId", "in", [101, "101"])))));
  await check("campo não move RDO para outra obra", () => assertFails(updateDoc(ref("campo", "rdos", "string-obra"), { obraId: 202 })));
  await check("campo não apaga RDO", () => assertFails(deleteDoc(ref("campo", "rdos", "string-obra"))));
  await check("campo registra ponto do trabalhador da própria obra", () => assertSucceeds(setDoc(ref("campo", "presencas", "ponto"), { data: "2026-10-01", trabId: "t1", obraId: "101", status: "Presente", criadoEm: 1000 })));
  await check("campo não forja obra no ponto de outro trabalhador", () => assertFails(setDoc(ref("campo", "presencas", "ponto-forjado"), { data: "2026-10-01", trabId: "t2", obraId: 101, status: "Presente", criadoEm: 1000 })));
  await check("campo não passa por cima do ponto corrigido pelo gestor", () => assertFails(updateDoc(ref("campo", "presencas", "ponto-gestor"), { status: "Falta", editadoPorGestor: false })));
  await check("campo não se identifica como correção administrativa", () => assertFails(setDoc(ref("campo", "presencas", "ponto-forjado"), { data: "2026-10-01", trabId: "t1", obraId: 101, status: "Presente", editadoPorGestor: true })));
  await check("campo solicita material pendente", () => assertSucceeds(setDoc(ref("campo", "pedidos", "pedido-campo"), { id: "pedido-campo", obraId: 101, status: "Aguardando", criadoPorUid: "campo", material: "Teste" })));
  await check("campo não aprova o próprio pedido", () => assertFails(updateDoc(ref("campo", "pedidos", "pedido-campo"), { status: "Aprovado" })));
  await check("campo não cria pedido já aprovado", () => assertFails(setDoc(ref("campo", "pedidos", "auto-aprovado"), { obraId: 101, status: "Aprovado", criadoPorUid: "campo" })));
  await check("campo não altera valor de aquisição do equipamento", () => assertFails(updateDoc(ref("campo", "equips"), { valor: 100 })));
  await check("campo atualiza somente status operacional do equipamento", () => assertSucceeds(updateDoc(ref("campo", "equips"), { status: "Em uso" })));
  await check("campo não atualiza equipamento de outra obra", () => assertFails(updateDoc(ref("campo", "equips", "outra-obra"), { status: "Em uso" })));
  await check("financeiro atualiza condições do contrato mesmo sem projeção legada", () => assertSucceeds(updateDoc(ref("fin", "obras", "contrato"), { valorContrato: "200", formaPagContrato: "Mensal" })));
  await check("financeiro não muda cadastro operacional da obra", () => assertFails(updateDoc(ref("fin", "obras", "contrato"), { nome: "Outro" })));
  await check("área Obras não altera valor do contrato", () => assertFails(updateDoc(ref("obra", "obras", "contrato"), { valorContrato: "300" })));
  await check("cliente antigo não altera operação de obra sem projeção", () => assertFails(updateDoc(ref("obra", "obras", "contrato"), { nome: "Nome atualizado" })));
  await check("área Obras altera dados operacionais e projeção preservando contrato", async () => {
    const atual = (await getDoc(ref("obra", "obras", "contrato"))).data();
    await assertSucceeds(salvarProjetado("obra", "obras", { ...atual, nome: "Nome atualizado" }));
  });
  await check("cliente antigo não cria obra sem projeção", () => assertFails(setDoc(ref("obra", "obras", "sem-projecao"), { id: "sem-projecao", nome: "Teste" })));
  await check("Obras não cria projeção sem original", () => assertFails(setDoc(ref("obra", "obrasCampo", "fantasma"), { id: "fantasma", nome: "Teste" })));
  await check("formulário operacional cria obra e projeção sem mandar contrato vazio", () => assertSucceeds(salvarProjetado("obra", "obras", prepararObraParaSalvar({ id: "obra-nova-operacional", nome: "Teste", local: "Cidade", cliente: "", clienteDoc: "" }, null, { perfil: "gestor", acessos: ["obras"] }))));
  await check("formulário operacional salva documento completo preservando contrato", async () => {
    const atual = (await getDoc(ref("obra", "obras", "contrato"))).data();
    const payload = prepararObraParaSalvar({ ...atual, local: "Nova cidade", valorContrato: "999" }, atual, { perfil: "gestor", acessos: ["obras"] });
    await assertSucceeds(salvarProjetado("obra", "obras", payload));
  });
  await check("Obras não muda apenas o diretório operacional", () => assertFails(updateDoc(ref("obra", "obrasCampo", "obra-nova-operacional"), { nome: "Forjado" })));
  await check("cliente antigo não apaga obra deixando projeção órfã", () => assertFails(deleteDoc(ref("gestor", "obras", "obra-nova-operacional"))));
  await check("gestor não apaga somente projeção de obra existente", () => assertFails(deleteDoc(ref("gestor", "obrasCampo", "obra-nova-operacional"))));
  await check("gestor apaga obra e projeção no mesmo batch", () => assertSucceeds(excluirProjetado("gestor", "obras", "obra-nova-operacional")));
  await check("campo não lê conversa entre outros usuários", () => assertFails(getDoc(ref("minimo", "mensagens", "msg"))));
  await check("mensagens: consulta OR só de participantes", () => assertSucceeds(getDocs(query(collection(actor("campo"), "empresas", empresa, "mensagens"), or(where("de", "==", "campo"), where("para", "==", "campo"))))));
  await check("mensagens: consulta ampla é bloqueada mesmo para dono", () => assertFails(getDocs(collection(actor("gestor"), "empresas", empresa, "mensagens"))));
  await check("destinatário marca conversa lida", () => assertSucceeds(updateDoc(ref("campo", "mensagens", "msg"), { lida: true })));
  await check("destinatário não altera texto do autor", () => assertFails(updateDoc(ref("campo", "mensagens", "msg"), { texto: "Forjado" })));
  await check("autor não marca leitura pelo destinatário", () => assertFails(updateDoc(ref("gestor", "mensagens", "msg"), { lida: true })));
  await check("autor real envia mensagem para colega ativo", () => assertSucceeds(setDoc(ref("campo", "mensagens", "resposta"), { id: "resposta", de: "campo", para: "gestor", texto: "Teste", ts: 1000, lida: false })));
  await check("mensagem não falsifica remetente", () => assertFails(setDoc(ref("campo", "mensagens", "forjada"), { id: "forjada", de: "gestor", para: "campo", texto: "Teste", ts: 1000, lida: false })));
  await check("mensagem não cruza empresas", () => assertFails(setDoc(ref("campo", "mensagens", "externa"), { id: "externa", de: "campo", para: "externo", texto: "Teste", ts: 1000, lida: false })));
  await check("cliente não grava metadata foto com URL pública", () => assertFails(setDoc(ref("gestor", "fotosObras", "nova"), { obraId: 101, fotoUrl: "https://example.test/token" })));
  await check("coleção desconhecida é negada até para gestor total", () => assertFails(setDoc(ref("gestor", "colecaoNaoAprovada"), { teste: true })));
  await check("cadastro atômico cria também diretório mínimo do próprio usuário", async () => {
    const db = actor("dono-rbac");
    const batch = writeBatch(db);
    batch.set(doc(db, "empresas/empresa-rbac"), { gestorUid: "dono-rbac" });
    batch.set(doc(db, "usuarios/dono-rbac"), { empresaId: "empresa-rbac", perfil: "gestor", email: "dono-rbac@example.test", nome: "Dono fictício", obraId: null, ativo: true });
    batch.set(doc(db, "empresas/empresa-rbac/perfisCampo/dono-rbac"), { id: "dono-rbac", firebaseUid: "dono-rbac", nome: "Dono fictício", perfil: "gestor", obraId: null, ativo: true });
    await assertSucceeds(batch.commit());
  });
  await check("auto projeção não forja papel de gestor", () => assertFails(setDoc(ref("campo", "perfisCampo", "campo"), { id: "campo", firebaseUid: "campo", nome: "", perfil: "gestor", obraId: 101, ativo: true })));
  await check("diretório mínimo não contém email de login", () => assertFails(setDoc(ref("gestor", "perfisCampo", "campo"), { id: "campo", firebaseUid: "campo", nome: "", perfil: "encarregado", obraId: 101, ativo: true, email: "campo@example.test" })));
  await check("aviso de folha só aparece para RH", () => assertSucceeds(getDoc(ref("rh", "avisos", "folha-privada"))));
  await check("gestor operacional não lê resumo de folha", () => assertFails(getDoc(ref("op", "avisos", "folha-privada"))));
  await check("campo não lê resumo de folha", () => assertFails(getDoc(ref("campo", "avisos", "folha-privada"))));
  await check("administrador de Sistema não lê aviso de acesso total", () => assertFails(getDoc(ref("admin-sistema", "avisos", "total-privado"))));
  await check("dono total lê aviso de acesso total", () => assertSucceeds(getDoc(ref("gestor", "avisos", "total-privado"))));
  await check("RH consulta avisos da área sem baixar os de outras áreas", () => assertSucceeds(getDocs(query(collection(actor("rh"), "empresas", empresa, "avisos"), where("para.tipo", "==", "area"), where("para.area", "in", ["equipe"])))));
  await check("campo lê aviso próprio de obra com perfil null", () => assertSucceeds(getDoc(ref("campo", "avisos", "obra-privada"))));
  await check("campo consulta aviso próprio de obra com perfil null igual", () => assertSucceeds(getDocs(query(collection(actor("campo"), "empresas", empresa, "avisos"), where("para.tipo", "==", "obra"), where("para.obraId", "==", 101), where("para.perfil", "==", null)))));
  await check("campo consulta avisos da sua obra com perfil null em ramo separado", () => assertSucceeds(getDocs(query(collection(actor("campo"), "empresas", empresa, "avisos"), where("para.tipo", "==", "obra"), where("para.obraId", "in", [101, "101"]), where("para.perfil", "==", null)))));
  await check("campo consulta avisos da sua obra com perfil definido em ramo separado", () => assertSucceeds(getDocs(query(collection(actor("campo"), "empresas", empresa, "avisos"), where("para.tipo", "==", "obra"), where("para.obraId", "in", [101, "101"]), where("para.perfil", "==", "encarregado")))));
  await check("campo pode avisar suprimentos de um novo pedido", () => assertSucceeds(setDoc(ref("campo", "avisos", "aviso-sup"), { id: "aviso-sup", de: "campo", tipo: "pedido", titulo: "Pedido fictício", texto: "Material fictício", criadoEm: 1000, para: { tipo: "area", area: "suprimentos" } })));
  await check("campo não publica aviso reservado a RH", () => assertFails(setDoc(ref("campo", "avisos", "aviso-rh"), { id: "aviso-rh", de: "campo", tipo: "folha", titulo: "Teste", texto: "Teste", criadoEm: 1000, para: { tipo: "area", area: "equipe" } })));
}
