import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { NAVY, GOLD, RED, DEFAULT_FONT } from "../theme.js";
import { AvatarUsuario, cargoDoUsuario, LogoKM } from "./ui.jsx";
import { Icone } from "./Icones.jsx";
import { useTema, OPCOES_TEMA } from "../lib/useTema.js";
import { CORES_BADGE, TEXTO_BADGE, TELA_PAI, grupoDaTela, itemDaTela, gruposDoMenu, telaPermitida } from "./menuGrupos.js";

/* Menu lateral do modo escritório (gestor em tela larga, >= 1024 px).
   No celular este componente não é renderizado — o app de campo segue igual.
   Grupos, itens, ícones e badges vêm de menuGrupos.js (fonte única). Só aparecem os grupos
   que a pessoa abre (gruposDoMenu: áreas em usuario.acessos + itens livres como Ajuda) — a
   busca "Ir para…" usa a mesma lista.
   Largura 248 px; recolhido vira trilho de 64 px (Ctrl+B, guardado em _kmzero_menu_recolhido).
   Grupos recolhíveis (estado em _kmzero_menu_grupos), busca "Ir para…" (Ctrl+K ou "/"),
   rodapé fixo com a pessoa logada, alternador de tema e Sair. */

export const LARGURA_MENU = 248;
export const LARGURA_TRILHO = 64;
const CHAVE_RECOLHIDO = "_kmzero_menu_recolhido";
const CHAVE_GRUPOS = "_kmzero_menu_grupos";
const MAX_RESULTADOS = 8;
const VERSAO = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "";

const ler = chave => { try { return localStorage.getItem(chave); } catch { return null; } };
const gravar = (chave, v) => { try { localStorage.setItem(chave, v); } catch {} };

// Sem acento e em minúsculas, para a busca ("calendario" acha "Calendário")
const normalizar = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fmtN = n => (n > 99 ? "99+" : String(n));
const PRIORIDADE_BADGE = { alerta: 3, pendencia: 2, info: 1 };

/* ── CSS do menu: uma constante de módulo, injetada UMA vez no <head>.
   Tokens --km-menu-* (navy nos dois temas); ouro = item ativo, foco e seleção. ── */
const CSS_MENU = `
.km-menu { --km-menu-largura: ${LARGURA_MENU}px; width: var(--km-menu-largura); min-width: var(--km-menu-largura); position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; flex-shrink: 0; box-sizing: border-box; background: var(--km-menu-fundo); color: var(--km-menu-texto); font-family: ${DEFAULT_FONT}; border-right: 1px solid var(--km-menu-borda); transition: width 180ms ease, min-width 180ms ease; overflow: hidden; z-index: 30; }
.km-menu[data-recolhido="1"] { --km-menu-largura: ${LARGURA_TRILHO}px; }
.km-menu * { box-sizing: border-box; }
.km-menu button { font-family: inherit; min-height: 0; }
.km-menu-rolagem { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 4px 10px 12px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) transparent; }
.km-menu-rolagem::-webkit-scrollbar { width: 6px; }
.km-menu-rolagem::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
.km-menu-rolagem::-webkit-scrollbar-track { background: transparent; }
.km-menu[data-recolhido="1"] .km-menu-rolagem { padding-left: 8px; padding-right: 8px; }
/* Topo: logo + chevron */
.km-menu-topo { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 10px 10px 16px; flex-shrink: 0; }
.km-menu[data-recolhido="1"] .km-menu-topo { flex-direction: column; padding: 12px 8px 6px; gap: 6px; }
.km-menu-chevron { width: 28px; height: 28px; border-radius: 8px; border: none; background: transparent; color: var(--km-menu-texto2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; padding: 0; }
.km-menu-chevron:hover { background: var(--km-menu-hover); color: #fff; }
/* Cartão da empresa */
.km-menu-empresa { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; margin: 0 0 6px; border-radius: 10px; border: 1px solid var(--km-menu-borda); background: var(--km-menu-fundo2); color: inherit; text-align: left; cursor: pointer; }
.km-menu-empresa:hover { background: var(--km-menu-hover); }
.km-menu-empresa.fixo { cursor: default; }
.km-menu-empresa.fixo:hover { background: var(--km-menu-fundo2); }
.km-menu-empresa-quadrado { width: 32px; height: 32px; border-radius: 8px; background: var(--km-menu-fundo); color: ${GOLD}; font-size: 12px; font-weight: 800; letter-spacing: 0.02em; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
.km-menu-empresa-quadrado img { width: 100%; height: 100%; object-fit: contain; display: block; }
.km-menu-empresa-texto { min-width: 0; flex: 1; }
.km-menu-empresa-nome { display: block; font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
.km-menu-empresa-sub { display: block; font-size: 11px; color: var(--km-menu-texto2); line-height: 1.2; margin-top: 2px; }
.km-menu[data-recolhido="1"] .km-menu-empresa { padding: 6px 0; justify-content: center; border-color: transparent; background: transparent; }
.km-menu[data-recolhido="1"] .km-menu-empresa-texto { display: none; }
/* Busca "Ir para…" */
.km-menu-busca { position: relative; margin: 0 0 8px; }
.km-menu-busca .km-menu-lupa { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--km-menu-texto2); pointer-events: none; }
.km-menu .km-menu-busca input { width: 100%; height: 32px; min-height: 32px !important; padding: 0 10px 0 32px !important; margin: 0 !important; border-radius: 8px; border: 1px solid var(--km-menu-borda); background: var(--km-menu-fundo2); color: #fff; font-size: 13px !important; font-family: inherit; outline: none; }
.km-menu .km-menu-busca input::placeholder { color: var(--km-menu-texto2); }
.km-menu .km-menu-busca input:focus { border-color: ${GOLD}; box-shadow: 0 0 0 2px rgba(255,184,48,0.25); }
.km-menu-resultados { list-style: none; margin: 0 0 8px; padding: 4px; border-radius: 10px; background: var(--km-menu-fundo2); border: 1px solid var(--km-menu-borda); }
.km-menu-resultado { display: flex; align-items: center; gap: 8px; width: 100%; height: 32px; padding: 0 8px; border-radius: 6px; border: none; background: transparent; color: var(--km-menu-texto); font-size: 12px; text-align: left; cursor: pointer; white-space: nowrap; overflow: hidden; }
.km-menu-resultado-grupo { color: var(--km-menu-texto2); flex-shrink: 0; }
.km-menu-resultado-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.km-menu-resultado.sel, .km-menu-resultado:hover { background: var(--km-menu-hover); color: #fff; }
.km-menu-resultado mark { background: transparent; color: ${GOLD}; font-weight: 700; }
.km-menu-resultado-vazio { padding: 8px 10px; font-size: 12px; color: var(--km-menu-texto2); }
/* Grupos */
.km-menu-lista, .km-menu-lista ul { list-style: none; margin: 0; padding: 0; }
.km-menu-grupo { position: relative; display: flex; align-items: center; gap: 6px; width: 100%; height: 28px; padding: 0 8px; margin-top: 6px; border: none; border-radius: 6px; background: transparent; color: var(--km-menu-texto2); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; text-align: left; cursor: pointer; white-space: nowrap; }
.km-menu-grupo:hover { color: #fff; background: var(--km-menu-hover); }
.km-menu-grupo-titulo { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.km-menu-grupo-seta { transition: transform 150ms ease; flex-shrink: 0; }
.km-menu-grupo[aria-expanded="true"] .km-menu-grupo-seta { transform: rotate(90deg); }
.km-menu-grupo-corpo { display: grid; grid-template-rows: 1fr; visibility: visible; transition: grid-template-rows 150ms ease, visibility 0s linear 0s; }
.km-menu-grupo-corpo[data-aberto="0"] { grid-template-rows: 0fr; visibility: hidden; transition: grid-template-rows 150ms ease, visibility 0s linear 150ms; }
.km-menu-grupo-corpo > ul { overflow: hidden; min-height: 0; }
.km-menu[data-recolhido="1"] .km-menu-grupo { height: 16px; padding: 0; margin-top: 4px; justify-content: center; }
.km-menu[data-recolhido="1"] .km-menu-grupo::before { content: ""; width: 24px; height: 2px; border-radius: 1px; background: var(--km-menu-borda); }
.km-menu[data-recolhido="1"] .km-menu-grupo:hover::before { background: var(--km-menu-texto2); }
.km-menu[data-recolhido="1"] .km-menu-grupo-titulo, .km-menu[data-recolhido="1"] .km-menu-grupo-seta { display: none; }
/* Itens */
.km-menu-item { position: relative; display: flex; align-items: center; gap: 10px; width: 100%; height: 32px; padding: 0 10px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--km-menu-texto); font-size: 13px; font-weight: 500; text-align: left; cursor: pointer; white-space: nowrap; box-shadow: inset 3px 0 0 transparent; transition: background 120ms, color 120ms; }
.km-menu-item .km-menu-icone { opacity: 0.7; flex-shrink: 0; transition: opacity 120ms; }
.km-menu-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.km-menu-item:hover { background: var(--km-menu-hover); color: #fff; }
.km-menu-item:hover .km-menu-icone { opacity: 1; }
.km-menu-item.ativo { background: var(--km-menu-ativo); color: #fff; font-weight: 600; box-shadow: inset 3px 0 0 ${GOLD}; }
.km-menu-item.ativo .km-menu-icone { opacity: 1; color: ${GOLD}; }
.km-menu-item.perigo:hover { background: rgba(239,71,111,0.25); border-color: ${RED}; }
.km-menu button:focus-visible { outline: 2px solid ${GOLD}; outline-offset: -2px; }
.km-menu[data-recolhido="1"] .km-menu-item { justify-content: center; padding: 0; height: 36px; }
.km-menu[data-recolhido="1"] .km-menu-label, .km-menu[data-recolhido="1"] .km-menu-badge { display: none; }
/* Pílulas de contagem e ponto do trilho */
.km-menu-badge { display: inline-flex; align-items: center; justify-content: center; height: 18px; min-width: 18px; padding: 0 6px; border-radius: 9px; font-size: 11px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: 0; text-transform: none; flex-shrink: 0; }
.km-menu-badge.pendencia { background: ${CORES_BADGE.pendencia.fundo}; color: ${CORES_BADGE.pendencia.texto}; }
.km-menu-badge.alerta { background: ${CORES_BADGE.alerta.fundo}; color: ${CORES_BADGE.alerta.texto}; font-size: 12px; }
.km-menu-badge.info { background: ${CORES_BADGE.info.fundo}; color: ${CORES_BADGE.info.texto}; }
.km-menu-ponto { display: none; position: absolute; top: 5px; right: 9px; width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 0 2px var(--km-menu-fundo); }
.km-menu-ponto.pendencia { background: ${CORES_BADGE.pendencia.fundo}; }
.km-menu-ponto.alerta { background: ${CORES_BADGE.alerta.fundo}; }
.km-menu-ponto.info { background: #2094ff; }
.km-menu-grupo .km-menu-ponto { top: 4px; right: 8px; }
.km-menu[data-recolhido="1"] .km-menu-ponto { display: block; }
.km-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
/* Rodapé fixo: pessoa logada, tema, sair, versão */
.km-menu-rodape { flex-shrink: 0; position: sticky; bottom: 0; background: var(--km-menu-fundo); border-top: 1px solid var(--km-menu-borda); padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 8px; }
.km-menu-usuario { display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px 8px; border-radius: 10px; border: none; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.km-menu-usuario:hover, .km-menu-usuario.ativo { background: var(--km-menu-hover); }
.km-menu-usuario-texto { min-width: 0; flex: 1; }
.km-menu-usuario-nome { display: block; font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
.km-menu-usuario-cargo { display: block; font-size: 11px; color: var(--km-menu-texto2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; margin-top: 1px; }
.km-menu-linha2 { display: flex; align-items: center; gap: 8px; }
.km-menu-tema { display: inline-flex; flex: 1; height: 28px; padding: 2px; border-radius: 8px; background: var(--km-menu-fundo2); border: 1px solid var(--km-menu-borda); }
.km-menu-tema button { flex: 1; height: 100%; padding: 0; border: none; border-radius: 6px; background: transparent; color: var(--km-menu-texto2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.km-menu-tema button:hover { color: #fff; }
.km-menu-tema button[aria-checked="true"] { background: ${GOLD}; color: ${NAVY}; }
.km-menu-sair { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--km-menu-borda); background: transparent; color: var(--km-menu-texto); font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.km-menu-sair:hover { background: rgba(239,71,111,0.25); border-color: ${RED}; color: #fff; }
.km-menu-versao { font-size: 10px; color: var(--km-menu-texto2); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.km-menu[data-recolhido="1"] .km-menu-rodape { padding: 8px 6px 10px; }
.km-menu[data-recolhido="1"] .km-menu-usuario { justify-content: center; padding: 6px 0; }
.km-menu[data-recolhido="1"] .km-menu-usuario-texto, .km-menu[data-recolhido="1"] .km-menu-versao, .km-menu[data-recolhido="1"] .km-menu-sair span { display: none; }
.km-menu[data-recolhido="1"] .km-menu-linha2 { flex-direction: column; gap: 6px; }
.km-menu[data-recolhido="1"] .km-menu-tema { flex: none; flex-direction: column; width: 32px; height: auto; }
.km-menu[data-recolhido="1"] .km-menu-tema button { height: 26px; }
.km-menu[data-recolhido="1"] .km-menu-sair { width: 32px; padding: 0; }
/* Tooltip do trilho (posição fixa: o menu tem overflow hidden e cortaria um ::after) */
.km-menu-dica { position: fixed; z-index: 1000; padding: 5px 9px; border-radius: 6px; background: var(--km-menu-fundo2); border: 1px solid var(--km-menu-borda); color: #fff; font-size: 12px; font-weight: 600; white-space: nowrap; pointer-events: none; transform: translateY(-50%); box-shadow: 0 4px 12px rgba(0,0,0,0.35); animation: kmMenuDica 0s linear 150ms both; }
@keyframes kmMenuDica { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .km-menu, .km-menu-grupo-corpo, .km-menu-grupo-seta, .km-menu-item, .km-menu-item .km-menu-icone { transition: none !important; }
  .km-menu-dica { animation: none; }
}
`;

let cssInjetado = false;
function injetarCSS() {
  if (cssInjetado || typeof document === "undefined") return;
  cssInjetado = true;
  if (document.getElementById("km-menu-css")) return;
  const s = document.createElement("style");
  s.id = "km-menu-css";
  s.textContent = CSS_MENU;
  document.head.appendChild(s);
}

export function MenuLateral({ tela, onNav, usuario, empresa, badges = {}, onLogout, topo = 0 }) {
  injetarCSS();
  const { preferencia, setPreferencia } = useTema();
  // Grupos do menu e da busca: os que o e-mail vê, nas áreas liberadas para a pessoa
  const grupos = useMemo(() => gruposDoMenu(usuario), [usuario]);
  const podeEmpresa = telaPermitida(usuario, "empresa"); // cartão da empresa só leva a Empresa se a área Sistema for dela
  const telaMenu = TELA_PAI[tela] || tela; // tela de detalhe destaca o item pai
  const grupoAtivo = grupoDaTela(tela);

  /* Recolhido (trilho de 64 px): escolha do usuário em _kmzero_menu_recolhido;
     sem escolha, começa recolhido em janela estreita (< 1200 px). */
  const [recolhido, setRecolhido] = useState(() => {
    const v = ler(CHAVE_RECOLHIDO);
    if (v === "1") return true;
    if (v === "0") return false;
    return typeof window !== "undefined" && window.innerWidth < 1200;
  });
  const alternarRecolhido = useCallback(() => setRecolhido(r => { gravar(CHAVE_RECOLHIDO, r ? "0" : "1"); return !r; }), []);

  /* Grupos abertos {id: bool}: começa só com o grupo da tela; navegar para outro grupo
     abre-o sem fechar os demais. */
  const [abertos, setAbertos] = useState(() => {
    try { const v = JSON.parse(ler(CHAVE_GRUPOS) || "null"); if (v && typeof v === "object" && !Array.isArray(v)) return v; } catch {}
    return { [grupoAtivo || "visao"]: true };
  });
  const definirGrupo = useCallback((id, aberto) => setAbertos(a => {
    if (!!a[id] === aberto) return a;
    const n = { ...a, [id]: aberto };
    gravar(CHAVE_GRUPOS, JSON.stringify(n));
    return n;
  }), []);
  useEffect(() => { if (grupoAtivo) definirGrupo(grupoAtivo, true); }, [grupoAtivo, definirGrupo]);

  /* Busca "Ir para…" */
  const [busca, setBusca] = useState("");
  const [idxSel, setIdxSel] = useState(0);
  const [buscaNoTrilho, setBuscaNoTrilho] = useState(false); // lupa do trilho expande o menu só enquanto busca
  const inputRef = useRef(null);
  const navRef = useRef(null);
  const expandido = !recolhido || buscaNoTrilho;

  const indice = useMemo(() => grupos.flatMap(g => g.itens.map(i => ({
    grupo: g.titulo, nav: i.nav, label: i.label, icone: i.icone,
    labelNorm: normalizar(i.label), chave: normalizar(`${i.label} ${i.busca || ""} ${g.titulo}`),
  }))), [grupos]);
  const q = normalizar(busca.trim());
  const resultados = useMemo(() => (q ? indice.filter(e => e.chave.includes(q)).slice(0, MAX_RESULTADOS) : []), [q, indice]);
  useEffect(() => { setIdxSel(0); }, [q]);

  const abrirBusca = useCallback(() => {
    if (recolhido) setBuscaNoTrilho(true);
    requestAnimationFrame(() => inputRef.current && inputRef.current.focus());
  }, [recolhido]);
  const fecharBusca = useCallback(() => {
    setBusca("");
    setBuscaNoTrilho(false);
    if (inputRef.current) inputRef.current.blur();
  }, []);
  const irPara = useCallback(nav => { fecharBusca(); if (onNav) onNav(nav); }, [fecharBusca, onNav]);

  // Atalhos globais: Ctrl+B recolhe/expande; Ctrl+K ou "/" (fora de campos) abre a busca
  useEffect(() => {
    const emCampo = el => !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
    const aoTeclar = e => {
      const ctrl = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey;
      const k = String(e.key || "").toLowerCase();
      if (ctrl && k === "b") { e.preventDefault(); alternarRecolhido(); return; }
      if (ctrl && k === "k") { e.preventDefault(); abrirBusca(); return; }
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !emCampo(e.target)) { e.preventDefault(); abrirBusca(); }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [alternarRecolhido, abrirBusca]);

  const aoTeclarBusca = e => {
    if (e.key === "Escape") { e.preventDefault(); fecharBusca(); return; }
    if (!resultados.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setIdxSel(i => (i + 1) % resultados.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdxSel(i => (i - 1 + resultados.length) % resultados.length); }
    else if (e.key === "Enter") { e.preventDefault(); const r = resultados[idxSel] || resultados[0]; if (r) irPara(r.nav); }
  };
  // Trecho casado em ouro (a normalização NFD mantém os índices das letras acentuadas do pt-BR)
  const realcar = r => {
    const i = q ? r.labelNorm.indexOf(q) : -1;
    if (i < 0) return r.label;
    return <>{r.label.slice(0, i)}<mark>{r.label.slice(i, i + q.length)}</mark>{r.label.slice(i + q.length)}</>;
  };

  /* Roving tabindex: só uma entrada da lista entra no Tab (o item da tela atual;
     senão, o cabeçalho do primeiro grupo). Setas/Home/End andam pelos visíveis. */
  const [foco, setFoco] = useState(null);
  useEffect(() => { setFoco(itemDaTela(tela) ? "item:" + telaMenu : null); }, [tela, telaMenu]);
  const focoPadrao = foco && indice.some(e => "item:" + e.nav === foco) ? foco : "grupo:" + (grupos[0] ? grupos[0].id : "visao");
  const tabIndexDe = id => (id === focoPadrao ? 0 : -1);
  const focaveis = () => Array.from(navRef.current ? navRef.current.querySelectorAll("[data-foco]") : []).filter(el => !el.closest('[data-aberto="0"]'));
  const aoTeclarLista = e => {
    const el = e.target.closest ? e.target.closest("[data-foco]") : null;
    if (!el) return;
    const [tipo, id] = el.dataset.foco.split(":");
    const grupoDe = tipo === "grupo" ? id : el.dataset.grupo;
    if (e.key === "ArrowRight") { if (tipo === "grupo") { e.preventDefault(); definirGrupo(id, true); } return; }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      definirGrupo(grupoDe, false);
      if (tipo === "item") { const cab = navRef.current.querySelector(`[data-foco="grupo:${grupoDe}"]`); if (cab) { cab.focus(); setFoco("grupo:" + grupoDe); } }
      return;
    }
    const lista = focaveis();
    const i = lista.indexOf(el);
    if (i < 0) return;
    let alvo = null;
    if (e.key === "ArrowDown") alvo = lista[Math.min(i + 1, lista.length - 1)];
    else if (e.key === "ArrowUp") alvo = lista[Math.max(i - 1, 0)];
    else if (e.key === "Home") alvo = lista[0];
    else if (e.key === "End") alvo = lista[lista.length - 1];
    else return;
    e.preventDefault();
    if (alvo) { alvo.focus(); setFoco(alvo.dataset.foco); }
  };

  /* Tooltip do trilho (só quando recolhido; no menu aberto o texto já está visível) */
  const [dica, setDica] = useState(null);
  const mostrarDica = (e, texto) => {
    if (expandido || !texto) return;
    const r = e.currentTarget.getBoundingClientRect();
    setDica({ texto, x: r.right + 8, y: r.top + r.height / 2 });
  };
  const esconderDica = () => setDica(null);
  useEffect(() => { if (expandido) setDica(null); }, [expandido]);
  const dicaProps = texto => ({ onMouseEnter: e => mostrarDica(e, texto), onMouseLeave: esconderDica, onFocus: e => mostrarDica(e, texto), onBlur: esconderDica });

  /* Badges */
  const contagem = chave => Number(badges[chave]) || 0;
  const badgeDoItem = i => (i.badge ? { n: contagem(i.badge.chave), tipo: i.badge.tipo } : { n: 0, tipo: null });
  const badgeDoGrupo = g => {
    let n = 0, tipo = null;
    for (const i of g.itens) {
      const b = badgeDoItem(i);
      if (b.n > 0) { n += b.n; if (!tipo || PRIORIDADE_BADGE[b.tipo] > PRIORIDADE_BADGE[tipo]) tipo = b.tipo; }
    }
    return { n, tipo };
  };
  const textoBadge = (n, tipo) => (n > 0 && tipo ? `, ${n} ${TEXTO_BADGE[tipo][n === 1 ? 0 : 1]}` : "");

  const nomeEmpresa = empresa?.nomeFantasia || empresa?.razaoSocial || "Minha empresa";
  const iniciaisEmpresa = nomeEmpresa.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase() || "KM";
  const nomeUsuario = usuario?.nome || "Gestor";
  const naConta = tela === "minha_conta";
  const rotuloChevron = recolhido ? "Expandir menu" : "Recolher menu";

  return (
    <nav
      ref={navRef}
      className="km-menu"
      data-recolhido={expandido ? "0" : "1"}
      aria-label="Menu principal"
      style={topo ? { top: topo, height: `calc(100vh - ${topo}px)` } : undefined}
    >
      {/* Topo: marca + recolher */}
      <div className="km-menu-topo">
        <LogoKM tamanho={expandido ? 22 : 13} tagline={expandido} />
        <button type="button" className="km-menu-chevron" onClick={alternarRecolhido} aria-label={rotuloChevron} title={`${rotuloChevron} (Ctrl+B)`} {...dicaProps(`${rotuloChevron} · Ctrl+B`)}>
          <Icone nome={recolhido ? "chevrons-right" : "chevrons-left"} tamanho={16} />
        </button>
      </div>

      <div className="km-menu-rolagem">
        {/* Cartão da empresa (lugar do futuro seletor de empresa); sem a área Sistema, só mostra o nome */}
        {podeEmpresa ? (
          <button type="button" className="km-menu-empresa" onClick={() => onNav && onNav("empresa")} aria-label={`${nomeEmpresa}. Configurar empresa`} title={nomeEmpresa} {...dicaProps(nomeEmpresa)}>
            <span className="km-menu-empresa-quadrado" aria-hidden="true">
              {empresa?.logoBase64 ? <img src={empresa.logoBase64} alt="" /> : iniciaisEmpresa}
            </span>
            <span className="km-menu-empresa-texto">
              <span className="km-menu-empresa-nome">{nomeEmpresa}</span>
              <span className="km-menu-empresa-sub">Configurar</span>
            </span>
          </button>
        ) : (
          <div className="km-menu-empresa fixo" title={nomeEmpresa} onMouseEnter={e => mostrarDica(e, nomeEmpresa)} onMouseLeave={esconderDica}>
            <span className="km-menu-empresa-quadrado" aria-hidden="true">
              {empresa?.logoBase64 ? <img src={empresa.logoBase64} alt="" /> : iniciaisEmpresa}
            </span>
            <span className="km-menu-empresa-texto">
              <span className="km-menu-empresa-nome">{nomeEmpresa}</span>
            </span>
          </div>
        )}

        {/* Busca: campo no menu aberto; no trilho, uma lupa que expande enquanto busca */}
        {expandido ? (
          <div className="km-menu-busca">
            <Icone nome="search" tamanho={15} className="km-menu-lupa" />
            <input
              ref={inputRef}
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              onKeyDown={aoTeclarBusca}
              onBlur={e => { if (buscaNoTrilho && !(navRef.current && navRef.current.contains(e.relatedTarget))) fecharBusca(); }}
              placeholder="Ir para…  Ctrl+K"
              aria-label="Ir para uma tela"
              role="combobox"
              aria-expanded={!!q}
              aria-controls="km-menu-resultados"
              aria-autocomplete="list"
              aria-activedescendant={q && resultados[idxSel] ? `km-menu-res-${resultados[idxSel].nav}` : undefined}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ) : (
          <button type="button" className="km-menu-item" onClick={abrirBusca} aria-label="Ir para… (Ctrl+K)" {...dicaProps("Ir para… · Ctrl+K")}>
            <Icone nome="search" tamanho={18} className="km-menu-icone" />
          </button>
        )}

        {q ? (
          <ul id="km-menu-resultados" className="km-menu-resultados" role="listbox" aria-label="Telas encontradas">
            {resultados.length === 0 && <li className="km-menu-resultado-vazio">Nenhuma tela com “{busca.trim()}”</li>}
            {resultados.map((r, i) => (
              <li key={r.nav} id={`km-menu-res-${r.nav}`} role="option" aria-selected={i === idxSel}>
                <button type="button" tabIndex={-1} className={"km-menu-resultado" + (i === idxSel ? " sel" : "")} onMouseDown={e => e.preventDefault()} onMouseEnter={() => setIdxSel(i)} onClick={() => irPara(r.nav)}>
                  <Icone nome={r.icone} tamanho={15} />
                  <span className="km-menu-resultado-grupo">{r.grupo} ›</span>
                  <span className="km-menu-resultado-label">{realcar(r)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="km-menu-lista" role="list" onKeyDown={aoTeclarLista}>
            {grupos.map(g => {
              const aberto = !!abertos[g.id];
              const bg = badgeDoGrupo(g);
              const somaVisivel = !aberto && bg.n > 0; // cabeçalho recolhido mostra a soma dos filhos
              const rotuloGrupo = g.titulo + (somaVisivel ? textoBadge(bg.n, bg.tipo) : "");
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    className="km-menu-grupo"
                    data-foco={"grupo:" + g.id}
                    tabIndex={tabIndexDe("grupo:" + g.id)}
                    aria-expanded={aberto}
                    aria-controls={"km-grupo-" + g.id}
                    aria-label={rotuloGrupo}
                    onClick={() => definirGrupo(g.id, !aberto)}
                    onMouseEnter={e => mostrarDica(e, rotuloGrupo)}
                    onMouseLeave={esconderDica}
                    onFocus={e => { setFoco("grupo:" + g.id); mostrarDica(e, rotuloGrupo); }}
                    onBlur={esconderDica}
                  >
                    <Icone nome="chevron-right" tamanho={14} className="km-menu-grupo-seta" />
                    <span className="km-menu-grupo-titulo">{g.titulo}</span>
                    {somaVisivel && <span className={"km-menu-badge " + bg.tipo} aria-hidden="true">{fmtN(bg.n)}</span>}
                    {somaVisivel && <span className={"km-menu-ponto " + bg.tipo} aria-hidden="true" />}
                  </button>
                  <div id={"km-grupo-" + g.id} className="km-menu-grupo-corpo" data-aberto={aberto ? "1" : "0"}>
                    <ul role="list">
                      {g.itens.map(i => {
                        const ativo = telaMenu === i.nav;
                        const b = badgeDoItem(i);
                        const sufixo = textoBadge(b.n, b.tipo);
                        return (
                          <li key={i.nav}>
                            <button
                              type="button"
                              className={"km-menu-item" + (ativo ? " ativo" : "") + (i.perigo ? " perigo" : "")}
                              data-foco={"item:" + i.nav}
                              data-grupo={g.id}
                              tabIndex={aberto ? tabIndexDe("item:" + i.nav) : -1}
                              aria-current={ativo ? "page" : undefined}
                              aria-label={expandido ? undefined : i.label + sufixo}
                              onClick={() => onNav && onNav(i.nav)}
                              onMouseEnter={e => mostrarDica(e, i.label + sufixo)}
                              onMouseLeave={esconderDica}
                              onFocus={e => { setFoco("item:" + i.nav); mostrarDica(e, i.label + sufixo); }}
                              onBlur={esconderDica}
                            >
                              <Icone nome={i.icone} tamanho={18} className="km-menu-icone" />
                              <span className="km-menu-label">{i.label}</span>
                              {b.n > 0 && <span className={"km-menu-badge " + b.tipo} aria-hidden="true">{fmtN(b.n)}</span>}
                              {b.n > 0 && <span className={"km-menu-ponto " + b.tipo} aria-hidden="true" />}
                              {expandido && sufixo && <span className="km-sr-only">{sufixo}</span>}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Rodapé: quem está logado, tema, sair, versão */}
      <div className="km-menu-rodape">
        <button
          type="button"
          className={"km-menu-usuario" + (naConta ? " ativo" : "")}
          onClick={() => onNav && onNav("minha_conta")}
          aria-label={`Conectado como ${nomeUsuario}, abrir Minha conta`}
          aria-current={naConta ? "page" : undefined}
          title={`${nomeUsuario}${usuario?.email ? " · " + usuario.email : ""} — Minha conta`}
          {...dicaProps(`${nomeUsuario} · Minha conta`)}
        >
          <AvatarUsuario usuario={usuario} tamanho={32} />
          <span className="km-menu-usuario-texto">
            <span className="km-menu-usuario-nome">{nomeUsuario}</span>
            <span className="km-menu-usuario-cargo">{cargoDoUsuario(usuario)}</span>
          </span>
        </button>
        <div className="km-menu-linha2">
          <div className="km-menu-tema" role="radiogroup" aria-label="Tema">
            {OPCOES_TEMA.map(o => (
              <button key={o.valor} type="button" role="radio" aria-checked={preferencia === o.valor} aria-label={o.dica} title={o.dica} onClick={() => setPreferencia(o.valor)} {...dicaProps(o.dica)}>
                <Icone nome={o.icone} tamanho={15} />
              </button>
            ))}
          </div>
          <button type="button" className="km-menu-sair" onClick={() => onLogout && onLogout()} aria-label="Sair" {...dicaProps("Sair")}>
            <Icone nome="log-out" tamanho={15} /><span>Sair</span>
          </button>
        </div>
        <div className="km-menu-versao">KMZERO · @km_engenharias{VERSAO ? ` · v${VERSAO}` : ""}</div>
      </div>

      {dica && <div className="km-menu-dica" role="tooltip" style={{ left: dica.x, top: dica.y }}>{dica.texto}</div>}
    </nav>
  );
}

export default MenuLateral;
