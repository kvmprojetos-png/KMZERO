import { TODAS_TELAS_MENU } from "../components/menuGrupos.js";

/* Moldura do modo escritório (gestor em tela larga, >= 1024 px).
   Aqui fica o que a moldura precisa saber sobre as telas sem tocar nelas:
   quais estão no menu lateral (não precisam de "Voltar"), quais são de detalhe
   e a largura máxima da coluna de conteúdo por tipo de tela.
   Os grupos e itens do menu vivem em src/components/menuGrupos.js (fonte única);
   ui.jsx importa daqui e menuGrupos.js só importa theme.js — sem ciclo. */

// Telas que têm item no menu: a barra de página não mostra "‹ Voltar" (o menu já é a navegação)
export const TELAS_MENU = TODAS_TELAS_MENU;

// Telas de detalhe (abertas a partir de uma lista): aqui o "‹ Voltar" faz sentido
export const TELAS_DE_DETALHE = new Set(["trab_detalhe", "pedido_detalhe", "mov_pess_detalhe", "mov_equip_detalhe", "anexos_obra"]);

// Largura máxima da coluna de conteúdo, por tipo de tela
export const LARGURA_POR_TELA = { formulario: 720, lista: 1080, painel: 1400 };

const TELAS_FORMULARIO = new Set(["empresa", "minha_conta", "ficha", "ajuda", "backup", "acessos", "zerar_tudo", "gerar_simulacao", "diagnostico", "registro"]);
const TELAS_PAINEL = new Set(["gestor", "dashboard", "cronograma", "cronograma_pro", "mapa", "consolidado", "galeria", "rdo", "calendario", "alertas"]);

export function tipoDaTela(tela) {
  if (TELAS_FORMULARIO.has(tela)) return "formulario";
  if (TELAS_PAINEL.has(tela)) return "painel";
  return "lista";
}
