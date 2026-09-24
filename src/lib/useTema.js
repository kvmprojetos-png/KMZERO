import { useCallback, useEffect, useState } from "react";
import { LARGURA_ESCRITORIO } from "./useLargura.js";

/* Tema claro/escuro do app. A preferência fica em _kmzero_tema ('claro' | 'escuro' | 'auto');
   'auto' = escuro no escritório (PC >= 1024) e claro no app de campo (sol no canteiro).
   O script anti-FOUC de app/index.html aplica a mesma regra antes do React carregar,
   então este hook só mantém o <html data-tema> e a theme-color sincronizados. */

export const CHAVE_TEMA = "_kmzero_tema";
const PREFERENCIAS = ["claro", "escuro", "auto"];
// Evento da mesma aba: quando um alternador grava, os outros useTema (menu, Minha conta, gráficos) acompanham
const EVENTO_TEMA = "kmzero-tema";

// As três opções do alternador (menu lateral e Minha conta): ícone = nome em Icones.jsx
export const OPCOES_TEMA = [
  { valor: "claro",  rotulo: "Claro",      icone: "sun",     dica: "Tema claro" },
  { valor: "escuro", rotulo: "Escuro",     icone: "moon",    dica: "Tema escuro" },
  { valor: "auto",   rotulo: "Automático", icone: "monitor", dica: "Automático: escuro no computador, claro no celular" },
];

// Cor da barra do navegador/PWA: navy no claro (casa com o KMHeader), fundo escuro no escuro
const THEME_COLOR = { claro: "#052f3d", escuro: "#081a21" };

/* Hex do tema atual para Recharts e SVG (var() não funciona em atributo SVG).
   Espelha os tokens de src/tema.css — se mudar lá, mudar aqui. */
export const PALETAS = {
  claro:  { fundo: "#f7fbfc", superficie: "#ffffff", borda: "#e0e9ed", texto: "#22343b", texto2: "#5c6b73", grade: "#e0e9ed" },
  escuro: { fundo: "#081a21", superficie: "#0f242c", borda: "rgba(255,255,255,0.10)", texto: "#d5e1e5", texto2: "#9fb3bb", grade: "rgba(255,255,255,0.10)" },
};

export function lerPreferencia() {
  try {
    const v = localStorage.getItem(CHAVE_TEMA);
    return PREFERENCIAS.includes(v) ? v : "auto";
  } catch {
    return "auto";
  }
}

export function resolverTema(preferencia) {
  if (preferencia === "claro" || preferencia === "escuro") return preferencia;
  const largura = typeof window !== "undefined" ? window.innerWidth : 0;
  return largura >= LARGURA_ESCRITORIO ? "escuro" : "claro";
}

/* Aplica no documento e devolve o tema resolvido. Serve fora do React também
   (splash, confirmar()). Não grava no localStorage: quem grava é setPreferencia. */
export function aplicarTema(preferencia = lerPreferencia()) {
  const tema = resolverTema(preferencia);
  if (typeof document === "undefined") return tema;
  document.documentElement.dataset.tema = tema;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[tema]);
  return tema;
}

export function useTema() {
  const [preferencia, setPreferenciaState] = useState(lerPreferencia);
  const [tema, setTema] = useState(() => aplicarTema(lerPreferencia()));

  // Reaplica quando a preferência muda; em 'auto' também quando a janela cruza 1024px
  useEffect(() => {
    setTema(aplicarTema(preferencia));
    if (preferencia !== "auto") return;
    const aoRedimensionar = () => setTema(aplicarTema("auto"));
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, [preferencia]);

  // Outra aba (ou a vitrine na mesma origem) mudou a preferência: acompanha
  useEffect(() => {
    const aoStorage = e => { if (!e.key || e.key === CHAVE_TEMA) setPreferenciaState(lerPreferencia()); };
    const aoEvento = e => setPreferenciaState(PREFERENCIAS.includes(e.detail) ? e.detail : lerPreferencia());
    window.addEventListener("storage", aoStorage);
    window.addEventListener(EVENTO_TEMA, aoEvento);
    return () => { window.removeEventListener("storage", aoStorage); window.removeEventListener(EVENTO_TEMA, aoEvento); };
  }, []);

  const setPreferencia = useCallback(nova => {
    const p = PREFERENCIAS.includes(nova) ? nova : "auto";
    try { localStorage.setItem(CHAVE_TEMA, p); } catch {}
    setPreferenciaState(p);
    try { window.dispatchEvent(new CustomEvent(EVENTO_TEMA, { detail: p })); } catch {}
  }, []);

  return { preferencia, tema, setPreferencia, paleta: PALETAS[tema] };
}
