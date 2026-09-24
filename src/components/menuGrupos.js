import { NAVY, GOLD, RED } from "../theme.js";

/* FONTE ÚNICA do menu do escritório: grupos, itens, ícones, badges e os nomes finais das telas.
   Quem lê daqui: MenuLateral.jsx (desenha), layoutEscritorio.js (barra de página sabe quais
   telas estão no menu), KMZeroApp.jsx (TELAS_GESTOR) e home.jsx (tiles do Painel usam os
   MESMOS nomes: "Indicadores", "Alertas", "Avisos").
   nav = nome exato da tela no switch de KMZeroApp.jsx — confira lá antes de acrescentar.
   icone = nome do Lucide em src/components/Icones.jsx (NOMES_ICONES).
   badge = { chave (em badgesMenu de KMZeroApp.jsx), tipo: 'pendencia' | 'alerta' | 'info' }.
   busca = termos extras para o "Ir para…" (sinônimos, nomes antigos). */

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
    { nav: "links",   label: "Links úteis",        icone: "link",       busca: "sites sinapi preços referência" },
    { nav: "backup",  label: "Exportar dados",     icone: "database",   busca: "backup restaurar" },
    { nav: "ajuda",   label: "Ajuda",              icone: "life-buoy",  busca: "suporte termos privacidade" },
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
