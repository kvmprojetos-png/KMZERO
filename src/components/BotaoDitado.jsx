import { useEffect, useRef, useState } from "react";
import { RED, T } from "../theme.js";

/* ════════════════════════════════════
   DITADO POR VOZ (pt-BR)
   Botão que transforma a fala em texto e acrescenta ao campo.
   Usado no Diário de Obra e no relato do dia (Finalizar Dia do encarregado).
════════════════════════════════════ */

export const RELATO_MINIMO = 20; // caracteres mínimos do relato em dia trabalhado
export const PREFIXO_RESUMO_AUTO = "Relatório gerado automaticamente";
export const MSG_SEM_DITADO = "Ditado indisponível neste navegador. Use o microfone do teclado do celular ou escreva.";

export const ditadoDisponivel = () =>
  typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

// Relato obrigatório quando há pelo menos 1 trabalhador presente no dia
export const relatoObrigatorio = (presentes) => Number(presentes) > 0;
export const relatoSuficiente = (texto) => String(texto || "").trim().length >= RELATO_MINIMO;

// Observações do RDO: relato do encarregado + resumo automático do fechamento
export function montarObservacoesRelato(relato, resumoAuto) {
  const r = String(relato || "").trim();
  return r ? `${r}\n\n${resumoAuto}` : resumoAuto;
}


// Só o resumo de uma linha das versões anteriores, sem nada escrito por alguém.
const SO_RESUMO_ANTIGO = /^Relatório gerado automaticamente ao finalizar o dia\. \d+ presente\(s\), \d+ falta\(s\)\. \d+ foto\(s\) registrada\(s\)\.$/;

// Mescla com o RDO já existente do dia. Regra: texto que alguém escreveu ou corrigiu nunca some.
// - observações vazias, iguais às que o fechamento anterior gerou (obsGeradaAnterior) ou só o resumo
//   antigo de uma linha: refaz tudo com o relato novo e os números atuais;
// - editadas por alguém (ex.: nota do gestor): ficam; se o relato não mudou, nada é mexido; se mudou,
//   troca o "Relato do encarregado: …" anterior do fim ou acrescenta o novo (uma vez só).
export function mesclarObservacoesRelato(obsExistente, obsNova, relato, relatoAnterior = "", obsGeradaAnterior = null) {
  const s = String(obsExistente || "").trim();
  if (!s || SO_RESUMO_ANTIGO.test(s)) return obsNova;
  if (typeof obsGeradaAnterior === "string" && s === obsGeradaAnterior.trim()) return obsNova;
  const r = String(relato || "").trim();
  const ant = String(relatoAnterior || "").trim();
  if (!r || r === ant || s.includes(r)) return obsExistente;
  const cauda = `\n\nRelato do encarregado: ${ant}`;
  if (ant && s.endsWith(cauda)) return `${s.slice(0, -cauda.length)}\n\nRelato do encarregado: ${r}`;
  return `${obsExistente}\n\nRelato do encarregado: ${r}`;
}

export function BotaoDitado({
  texto = "",
  onTexto,
  disabled = false,
  onGravando,
  onIniciar,
  rotuloFalar = "🎤 Falar",
  rotuloParar = "⏹ Parar",
  msgSemSuporte = MSG_SEM_DITADO,
  mostrarEstado = true,
}) {
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState("");
  const recognition = useRef(null);
  const cb = useRef({ onTexto, onGravando });
  cb.current = { onTexto, onGravando };

  const marcar = (v) => { setGravando(v); cb.current.onGravando?.(v); };

  useEffect(() => () => {
    const rec = recognition.current;
    if (rec) { rec.onresult = null; rec.onend = null; rec.onerror = null; rec.abort(); recognition.current = null; }
    // Saiu da tela no meio do ditado: avisa o pai que parou (senão o relato e o FINALIZAR DIA ficam travados)
    cb.current.onGravando?.(false);
  }, []);

  const iniciar = () => {
    if (gravando || disabled) return;
    setErro("");
    onIniciar?.();
    const SpeechRec = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechRec) { setErro(msgSemSuporte); return; }
    const rec = new SpeechRec();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    let textoFinal = String(texto || "").trim() ? String(texto).trim() + " " : "";
    rec.onresult = (event) => {
      if (recognition.current !== rec) return;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) textoFinal += transcript + " ";
        else interim += transcript;
      }
      cb.current.onTexto?.(textoFinal + interim);
    };
    rec.onerror = (e) => {
      if (recognition.current !== rec) return;
      rec.onresult = null; rec.onend = null; recognition.current = null; rec.abort();
      setErro(e.error === "not-allowed" ? "Permita o microfone neste navegador para ditar. Seu texto foi preservado." : "O ditado foi interrompido: " + e.error);
      marcar(false);
    };
    rec.onend = () => { if (recognition.current === rec) { recognition.current = null; marcar(false); } };
    try { rec.start(); recognition.current = rec; marcar(true); }
    catch { setErro("Não foi possível iniciar o microfone. Você pode escrever o relato e organizar com IA."); }
  };

  const parar = () => { if (recognition.current) recognition.current.stop(); };

  return (
    <>
      {!gravando ? (
        <button type="button" onClick={iniciar} disabled={disabled} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: RED, color: "#fff", fontWeight: 800, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1, marginBottom: 8, boxShadow: "0 3px 10px #dc262644", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {rotuloFalar}
        </button>
      ) : (
        <button type="button" onClick={parar} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: RED, color: "#fff", fontWeight: 800, cursor: "pointer", marginBottom: 8, animation: "pulse 1.5s infinite", boxShadow: "0 3px 10px #dc262688", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, /* ponto branco piscando sobre botão vermelho: não segue o tema */ background: "#fff", borderRadius: 5, animation: "blink 0.8s infinite" }}></span>
          {rotuloParar}
        </button>
      )}
      {gravando && mostrarEstado && <div role="status" style={{ fontSize: 11, color: T.infoTexto, margin: "-2px 0 8px", textAlign: "center" }}>🔴 Ouvindo… fale perto do celular. Toque em Parar quando terminar.</div>}
      {erro && <div role="alert" style={{ background: T.erroFundo, color: RED, padding: "6px 10px", borderRadius: 6, fontSize: 11, marginBottom: 8 }}>⚠️ {erro}</div>}
      <style>{`@keyframes blink { 50% { opacity: 0.3; } } @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.02); } }`}</style>
    </>
  );
}
