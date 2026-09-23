import { useEffect, useState } from "react";

/* Largura da tela em tempo real. A partir de LARGURA_ESCRITORIO o app vira
   "modo escritório" (menu lateral, grades, tabelas); abaixo disso é o app de campo. */
export const LARGURA_ESCRITORIO = 1024;

export function useLarguraTela() {
  const [largura, setLargura] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 0));
  useEffect(() => {
    const atualizar = () => setLargura(window.innerWidth);
    window.addEventListener("resize", atualizar);
    return () => window.removeEventListener("resize", atualizar);
  }, []);
  return largura;
}

export function useModoEscritorio() {
  return useLarguraTela() >= LARGURA_ESCRITORIO;
}
