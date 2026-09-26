import { NAVY, GOLD, RED } from "../theme.js";

/* FONTE ÚNICA do menu do escritório: grupos, itens, ícones, badges e os nomes finais das telas.
   Quem lê daqui: MenuLateral.jsx (desenha), layoutEscritorio.js (barra de página sabe quais
   telas estão no menu), KMZeroApp.jsx (TELAS_GESTOR e a guarda das áreas) e home.jsx (tiles do
   Painel usam os MESMOS nomes: "Indicadores", "Alertas", "Avisos").
   Os ids dos grupos também são as ÁREAS de acesso (usuario.acessos) — ver o fim do arquivo:
   renomear um id tira a área de quem já a tinha.
   nav = nome exato da tela no switch de KMZeroApp.jsx — confira lá antes de acrescentar.
   icone = nome do Lucide em src/components/Icones.jsx (NOMES_ICONES).
   badge = { chave (em badgesMenu de KMZeroApp.jsx), tipo: 'pendencia' | 'alerta' | 'info' }.
   busca = termos extras para o "Ir para…" (sinônimos, nomes antigos).
   livre = true: item aberto a qualquer pessoa do escritório, mesmo sem a área do grupo
   (Ajuda e Links úteis; ver ÁREAS DE ACESSO no fim do arquivo). */

// E-mail do desenvolvedor: só ele vê o grupo "Desenvolvedor" (e os tiles equivalentes no Painel)
export const EMAIL_DEV = "kvmprojetos@gmail.com";

/* Cores das pílulas de contagem (fixas nos dois temas: o menu é navy sempre).
   pendência = o gestor precisa aprovar algo (ouro/navy, ação);
   alerta = problema detectado pelo sistema (vermelho/branco);
   info = novidade para ler (azul translúcido). */
export const CORES_BADGE = {
  pendencia: { fundo: GOLD, texto: NAVY },
  alerta:    { fundo: RED,  texto: "#fff" },
  info:      { fundo: "rgba(32,148,255,0.25)", texto: "#9fd0ff" },
};

// Sufixo do texto acessível da pílula ("<span class=km-sr-only>, 3 pendências</span>")
export const TEXTO_BADGE = { pendencia: ["pendência", "pendências"], alerta: ["alerta", "alertas"], info: ["novidade", "novidades"] };

export const GRUPOS_MENU = [
  { id: "visao", titulo: "Visão geral", itens: [
    { nav: "gestor",    label: "Painel",      icone: "layout-dashboard", busca: "início home resumo" },
    { nav: "avisos",    label: "Avisos",      icone: "bell",             badge: { chave: "avisos", tipo: "info" }, busca: "notificações recados push" },
    { nav: "alertas",   label: "Alertas",     icone: "alert-triangle",   badge: { chave: "alertas", tipo: "alerta" }, busca: "problemas vencimentos atrasos" },
    { nav: "dashboard", label: "Indicadores", icone: "bar-chart-3",      busca: "dashboard gráficos números" },
    { nav: "mensagens", label: "Mensagens",   icone: "message-square",   badge: { chave: "mensagens", tipo: "info" }, busca: "chat conversa" },
  ] },
  { id: "obras", titulo: "Obras", itens: [
    { nav: "obras",          label: "Obras",          icone: "hard-hat",    busca: "cadastro de obra canteiro" },
    { nav: "cronograma",     label: "Cronograma",     icone: "gantt-chart", busca: "etapas prazo" },
    { nav: "cronograma_pro", label: "Cronograma Pro", icone: "gantt-chart", busca: "curva s avançado" },
    { nav: "mapa",           label: "Mapa",           icone: "map-pin",     busca: "localização endereço" },
    { nav: "clientes",       label: "Clientes",       icone: "briefcase",   busca: "contratante" },
  ] },
  { id: "equipe", titulo: "Equipe", itens: [
    { nav: "equipe",          label: "Equipe",              icone: "users",            busca: "trabalhadores funcionários pessoas" },
    { nav: "ficha",           label: "Fichas cadastrais",   icone: "id-card",          busca: "cadastrar trabalhador admissão" },
    { nav: "calendario",      label: "Calendário",          icone: "calendar-days",    busca: "presença faltas dias" },
    { nav: "folha_quinzenal", label: "Folha de pagamento",  icone: "banknote",         busca: "folha quinzenal mensal salário pagar" },
    { nav: "hist_folha",      label: "Histórico de folhas", icone: "history",          busca: "folhas salvas arquivadas" },
    { nav: "adiantamentos",   label: "Adiantamentos",       icone: "hand-coins",       busca: "vale" },
    { nav: "aprovar_mov",     label: "Movimentações",       icone: "arrow-left-right", badge: { chave: "aprovar_mov", tipo: "pendencia" }, busca: "transferência de pessoal aprovar" },
    { nav: "contatos",        label: "Contatos",            icone: "phone",            busca: "telefone emergência" },
    { nav: "exames",          label: "Exames (ASO)",        icone: "stethoscope",      busca: "aso saúde ocupacional" },
    { nav: "rh",              label: "Aniversários e EPI",  icone: "cake",             busca: "rh aniversário epi" },
    { nav: "ferias",          label: "Férias",              icone: "palmtree",         busca: "descanso" },
  ] },
  { id: "campo", titulo: "Campo", itens: [
    { nav: "rdo",           label: "RDO",              icone: "file-text",    busca: "relatório diário de obra abnt" },
    { nav: "diario",        label: "Diário de obra",   icone: "notebook-pen", busca: "ocorrências anotações" },
    { nav: "galeria",       label: "Galeria de fotos", icone: "images",       busca: "fotos imagens" },
    { nav: "produtividade", label: "Produtividade",    icone: "trending-up",  busca: "rendimento medição" },
  ] },
  { id: "suprimentos", titulo: "Suprimentos", itens: [
    { nav: "pedidos",      label: "Pedidos",      icone: "shopping-cart", badge: { chave: "pedidos", tipo: "pendencia" }, busca: "material compras solicitação aprovar" },
    { nav: "recebimento",  label: "Recebimentos", icone: "package-check", busca: "entrega conferência" },
    { nav: "fornecedores", label: "Fornecedores", icone: "store",         busca: "loja depósito" },
  ] },
  { id: "equipamentos", titulo: "Equipamentos", itens: [
    { nav: "ativos",       label: "Máquinas e veículos", icone: "truck",            busca: "ativos frota caminhão" },
    { nav: "frota",        label: "Combustível",         icone: "fuel",             busca: "abastecimento diesel" },
    { nav: "manutencao",   label: "Manutenções",         icone: "wrench",           busca: "revisão conserto" },
    { nav: "equip_gestao", label: "Equipamentos de obra", icone: "cog",             busca: "betoneira equipamentos" },
    { nav: "ferramentas",  label: "Ferramentas",         icone: "hammer",           busca: "" },
    { nav: "mov_equip",    label: "Transferências",      icone: "arrow-left-right", badge: { chave: "mov_equip", tipo: "pendencia" }, busca: "movimentação de equipamentos aprovar" },
  ] },
  { id: "financeiro", titulo: "Financeiro", itens: [
    { nav: "custos",      label: "Custos por obra",  icone: "calculator",   busca: "gastos" },
    { nav: "pagamentos",  label: "Pagamentos",       icone: "receipt",      busca: "medição recebimento cliente" },
    { nav: "despesas",    label: "Despesas avulsas", icone: "receipt-text", busca: "gastos extras" },
    { nav: "consolidado", label: "Consolidado",      icone: "pie-chart",    busca: "relatório geral" },
  ] },
  { id: "sistema", titulo: "Sistema", itens: [
    { nav: "acessos", label: "Usuários e acessos", icone: "key-round",  busca: "convites permissões encarregado" },
    { nav: "empresa", label: "Empresa",            icone: "building-2", busca: "cadastro cnpj logo" },
    { nav: "links",   label: "Links úteis",        icone: "link",       livre: true, busca: "sites sinapi preços referência" },
    { nav: "backup",  label: "Exportar dados",     icone: "database",   busca: "backup restaurar" },
    { nav: "ajuda",   label: "Ajuda",              icone: "life-buoy",  livre: true, busca: "suporte termos privacidade" },
  ] },
  { id: "dev", titulo: "Desenvolvedor", somenteEmail: EMAIL_DEV, itens: [
    { nav: "diagnostico",     label: "Painel técnico", icone: "activity",      busca: "diagnóstico" },
    { nav: "gerar_simulacao", label: "Popular demo",   icone: "flask-conical", busca: "simulação dados de teste" },
    { nav: "zerar_tudo",      label: "Limpar banco",   icone: "trash-2",       perigo: true, busca: "zerar apagar tudo" },
  ] },
];

// Todas as telas com item no menu (inclui o grupo do desenvolvedor)
export const TODAS_TELAS_MENU = new Set(GRUPOS_MENU.flatMap(g => g.itens.map(i => i.nav)));

/* Telas sem item próprio que "pertencem" a um item (abertas a partir dele): o menu
   destaca o item pai e abre o grupo dele. 'folha' é alias antigo de folha_quinzenal. */
export const TELA_PAI = {
  folha: "folha_quinzenal",
  trab_detalhe: "equipe",
  pedido_detalhe: "pedidos",
  mov_pess_detalhe: "aprovar_mov",
  mov_equip_detalhe: "mov_equip",
  anexos_obra: "obras",
};

const ITEM_POR_TELA = new Map(GRUPOS_MENU.flatMap(g => g.itens.map(i => [i.nav, { item: i, grupo: g }])));

// Item do menu que representa a tela (a própria ou o pai), ou null
export function itemDaTela(tela) {
  const e = ITEM_POR_TELA.get(TELA_PAI[tela] || tela);
  return e ? e.item : null;
}

// Nome final da tela como está no menu (fallback: o que a tela passar)
export function labelDaTela(tela, fallback = "") {
  const i = itemDaTela(tela);
  return i ? i.label : fallback;
}

// id do grupo da tela (ou do pai dela), ou null para telas fora do menu
export function grupoDaTela(tela) {
  const e = ITEM_POR_TELA.get(TELA_PAI[tela] || tela);
  return e ? e.grupo.id : null;
}

// Grupos que este usuário vê (o do desenvolvedor só para EMAIL_DEV)
export function gruposVisiveis(email) {
  return GRUPOS_MENU.filter(g => !g.somenteEmail || g.somenteEmail === email);
}

/* ── ÁREAS DE ACESSO (quem trabalha no escritório) ───────────────────────────
   Perfil continua "gestor" ou "encarregado". O gestor pode ter usuario.acessos = lista de ids
   de grupo acima (visao, obras, equipe, campo, suprimentos, equipamentos, financeiro, sistema);
   ausente ou null = acesso total (todos os gestores de antes). O grupo do desenvolvedor nunca
   entra na lista: continua decidido só pelo e-mail. Encarregado ignora acessos (app de campo,
   guarda TELAS_GESTOR em KMZeroApp.jsx).
   Itens com livre: true (Ajuda, Links úteis) abrem para todo gestor: suporte, termos e a consulta
   SINAPI não são área restrita. Na área "Sistema" o que conta é Empresa, Usuários e acessos e
   Exportar dados.
   "Visão geral" (AREA_FIXA) entra SEMPRE que houver lista: o Painel é a porta de entrada do
   escritório e, no celular (sem menu lateral), é por ele que a pessoa chega às outras áreas.
   normalizarAcessos já a devolve, então lista antiga ou gravada sem ela também a recebe.
   Quem usa: MenuLateral (menu e busca Ctrl+K), KMZeroApp (guarda de navegação, tela inicial,
   ?acessos= da demo), home.jsx (atalhos do Painel) e a tela Usuários e acessos (auth.jsx).
   As áreas só escondem menus e telas: não trancam os dados da empresa (firestore.rules). */

// Áreas que podem ser liberadas: todos os grupos, menos os de e-mail fixo (desenvolvedor)
export const AREAS_ACESSO = GRUPOS_MENU.filter(g => !g.somenteEmail).map(g => g.id);

// Área que todo acesso do escritório tem (o Painel; ver o comentário acima)
export const AREA_FIXA = "visao";

/* Pacotes prontos (tela Usuários e acessos e o &acessos= da demo). Financeiro leva Equipe e
   Suprimentos porque folha, adiantamentos e pedidos são custo. "Sistema" (Empresa, Usuários
   e acessos, Exportar dados) só vem no "Tudo" ou marcado à mão. */
export const PRESETS_ACESSOS = [
  { id: "tudo",           titulo: "Tudo",                acessos: null },
  { id: "financeiro",     titulo: "Financeiro",          acessos: ["visao", "financeiro", "suprimentos", "equipe"] },
  { id: "administrativo", titulo: "Administrativo / RH", acessos: ["visao", "equipe", "obras"] },
  { id: "obras",          titulo: "Obras e campo",       acessos: ["visao", "obras", "campo", "suprimentos", "equipamentos"] },
];

// Lista limpa (só áreas conhecidas, sem repetir, na ordem do menu, sempre com a Visão geral)
// ou null (= tudo)
export function normalizarAcessos(acessos) {
  if (!Array.isArray(acessos)) return null;
  const marcadas = new Set([AREA_FIXA, ...acessos.map(a => String(a).trim())]);
  return AREAS_ACESSO.filter(id => marcadas.has(id));
}

// Pacote pronto que bate exatamente com a lista (null → "Tudo"), ou null se for personalizado
export function presetDosAcessos(acessos) {
  const a = normalizarAcessos(acessos);
  return PRESETS_ACESSOS.find(p => (p.acessos === null ? a === null : !!a && normalizarAcessos(p.acessos).join() === a.join())) || null;
}

// Resumo curto para cartões e rodapés: "Tudo", "Financeiro", "3 áreas", "Só Visão geral"
export function resumoAcessos(acessos) {
  const a = normalizarAcessos(acessos);
  if (!a || a.length === AREAS_ACESSO.length) return "Tudo";
  const p = presetDosAcessos(a);
  if (p) return p.titulo;
  if (a.length === 1) return `Só ${GRUPOS_MENU.find(g => g.id === a[0])?.titulo || "1 área"}`;
  return `${a.length} áreas`;
}

/* ids dos grupos do escritório que esta pessoa abre: gestor sem acessos → todos os que vê;
   gestor com acessos → só esses (o do desenvolvedor segue o e-mail); encarregado → nenhum
   (é o de hoje: o menu do escritório não existe para ele). */
export function gruposPermitidos(usuario) {
  if (!usuario || usuario.perfil !== "gestor") return [];
  const visiveis = gruposVisiveis(usuario.email);
  const a = normalizarAcessos(usuario.acessos);
  if (!a) return visiveis.map(g => g.id);
  return visiveis.filter(g => g.somenteEmail || a.includes(g.id)).map(g => g.id);
}

/* A pessoa pode abrir esta tela? Tela do menu (ou de detalhe dele, via TELA_PAI) segue o grupo;
   item livre (Ajuda, Links úteis) e tela sem grupo (minha_conta, login, registro,
   primeiro_acesso, telas de campo…) são sempre permitidos ao gestor. Encarregado: igual a
   TELAS_GESTOR (nada do menu, nem Minha conta). */
export function telaPermitida(usuario, tela) {
  if (!usuario) return true; // sem sessão só existem as telas de entrada
  const g = grupoDaTela(tela);
  if (usuario.perfil !== "gestor") return !g && tela !== "minha_conta";
  if (!g || itemDaTela(tela)?.livre) return true;
  return gruposPermitidos(usuario).includes(g);
}

/* Grupos do menu lateral (e da busca Ctrl+K) desta pessoa: os que o e-mail vê, só nas áreas
   liberadas; grupo fora das áreas que tenha item livre aparece só com esse item
   (ex.: "Sistema" com Links úteis e Ajuda para quem não tem a área Sistema). */
export function gruposDoMenu(usuario) {
  const permitidos = new Set(gruposPermitidos(usuario));
  return gruposVisiveis(usuario?.email).flatMap(g => {
    if (permitidos.has(g.id)) return [g];
    if (usuario?.perfil !== "gestor") return [];
    const livres = g.itens.filter(i => i.livre);
    return livres.length ? [{ ...g, itens: livres }] : [];
  });
}

// Primeira tela depois de entrar: o Painel ("Visão geral" vem sempre, ver AREA_FIXA). O resto é
// só rede de segurança: a primeira tela do primeiro grupo liberado; sem nenhum, Minha conta
export function telaInicialPermitida(usuario) {
  if (!usuario) return "login";
  if (usuario.perfil !== "gestor") return "home";
  const ids = gruposPermitidos(usuario);
  if (ids.includes("visao")) return "gestor";
  const g = GRUPOS_MENU.find(x => !x.somenteEmail && ids.includes(x.id));
  return g ? g.itens[0].nav : "minha_conta";
}
