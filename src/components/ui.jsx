import { useState, useEffect, useCallback, useMemo } from "react";
import { NAVY, NAVY2, GOLD, GREEN, RED, ORANGE, BLUE, LIGHT, labelS, inputS, dateS, selS, bigBtn, css } from "../theme.js";

export const Badge = ({ label, color, small }) => (
  <span style={{ background: color, color: "#fff", borderRadius: 20, padding: small ? "3px 9px" : "5px 13px", fontSize: small ? 11 : 13, fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>
);

export const Btn = ({ label, color = NAVY, text = "#fff", onClick, disabled, style: sx, danger }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={css({
      background: disabled ? "#ccc" : color,
      color: text,
      border: danger ? "2px solid " + RED : "none",
      borderRadius: 10,
      padding: "14px 0",
      fontSize: 15,
      fontWeight: 800,
      cursor: disabled ? "default" : "pointer",
      width: "100%",
      minHeight: 48,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      boxShadow: disabled ? "none" : `0 3px 10px ${color}55`,
      touchAction: "manipulation",
    }, sx || {})}
  >{label}</button>
);

// ════ EmptyState — componente reutilizável para listas vazias ════
export function EmptyState({ icon = "📦", titulo, subtitulo, botaoLabel, onBotao, cor = NAVY }) {
  return (
    <div className="km-card-anim" style={{
      background: "#fff",
      borderRadius: 16,
      padding: "28px 20px",
      textAlign: "center",
      boxShadow: "0 2px 10px rgba(15,33,81,0.06)",
      border: "1px dashed #e5e7eb",
      margin: "8px 0",
    }}>
      <div style={{
        fontSize: 48,
        marginBottom: 8,
        opacity: 0.5,
      }}>{icon}</div>
      <div style={{
        fontSize: 15,
        fontWeight: 800,
        color: cor,
        marginBottom: 4,
      }}>{titulo}</div>
      {subtitulo && (
        <div style={{
          fontSize: 12,
          color: "#94a3b8",
          marginBottom: botaoLabel ? 14 : 0,
          lineHeight: 1.5,
          maxWidth: 280,
          marginLeft: "auto",
          marginRight: "auto",
        }}>{subtitulo}</div>
      )}
      {botaoLabel && onBotao && (
        <button onClick={onBotao} style={{
          background: cor,
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "10px 18px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          marginTop: 6,
          boxShadow: `0 3px 10px ${cor}40`,
        }}>
          {botaoLabel}
        </button>
      )}
    </div>
  );
}

export function KMHeader({ title, sub, onBack, right }) {
  return (
    <div style={{ background: `linear-gradient(180deg,${NAVY} 0%,${NAVY2} 100%)`, padding: "0 14px", flexShrink: 0, paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div style={{ display: "flex", alignItems: "center", paddingTop: 12, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Voltar"
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "none",
              color: "#fff",
              fontSize: 26,
              cursor: "pointer",
              width: 40,
              height: 40,
              minWidth: 40,
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
              lineHeight: 1,
              padding: 0,
              flexShrink: 0,
              touchAction: "manipulation",
              WebkitTapHighlightColor: "rgba(255,255,255,0.3)",
            }}
          >
            ‹
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div><span style={{ fontWeight: 900, fontSize: 22, color: "#fff", letterSpacing: -1 }}>KM</span><span style={{ fontWeight: 900, fontSize: 22, color: GOLD, letterSpacing: -1 }}>ZERO</span></div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: 2.5, marginTop: -2 }}>GESTÃO DE OBRAS</div>
        </div>
        {right !== undefined ? right : <div style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>👷</div>}
      </div>
      {(title || sub) && (
        <div style={{ paddingTop: 8, paddingBottom: 10 }}>
          {title && <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{title}</div>}
          {sub   && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 1 }}>{sub}</div>}
        </div>
      )}
    </div>
  );
}

export function KMFooter() {
  return (
    <div style={{ background: `linear-gradient(180deg,${NAVY2} 0%,${NAVY} 100%)`, padding: "10px 0", paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))", textAlign: "center", flexShrink: 0 }}>
      <span style={{ fontWeight: 900, fontSize: 16, color: "#fff", letterSpacing: -0.5 }}>KM</span>
      <span style={{ fontWeight: 900, fontSize: 16, color: GOLD, letterSpacing: -0.5 }}>ZERO</span>
      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.45)", letterSpacing: 2, marginTop: -1 }}>GESTÃO DE OBRAS</div>
      <a
        href="https://instagram.com/km_engenharias"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 10,
          color: "rgba(255,255,255,0.55)",
          textDecoration: "none",
          marginTop: 4,
          padding: "2px 8px",
          borderRadius: 10,
          minHeight: 20,
        }}
        title="Siga a KM no Instagram"
      >
        <span style={{ fontSize: 11 }}>📷</span>
        <span style={{ fontWeight: 600 }}>@km_engenharias</span>
      </a>
    </div>
  );
}

/* ════════════════════════════════════
   VIEWER DE FOTOS — Fullscreen reutilizável
   Toca em qualquer foto do app → abre em tela cheia
════════════════════════════════════ */
export function FotoViewer({ src, legenda, onClose }) {
  if (!src) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.95)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      padding: 20,
      flexDirection: "column",
    }}>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{
        position: "absolute",
        top: 14,
        right: 14,
        background: "rgba(255,255,255,0.15)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.3)",
        color: "#fff",
        width: 44,
        height: 44,
        borderRadius: 22,
        fontSize: 22,
        cursor: "pointer",
        fontWeight: 800,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2,
      }}>✕</button>
      <img src={src} alt={legenda || ""} style={{ maxWidth: "100%", maxHeight: "85%", objectFit: "contain", borderRadius: 10, boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }} />
      {legenda && (
        <div style={{ color: "#fff", marginTop: 14, fontSize: 13, textAlign: "center", maxWidth: "90%", lineHeight: 1.5, padding: "8px 16px", background: "rgba(255,255,255,0.1)", borderRadius: 8, backdropFilter: "blur(10px)" }}>
          {legenda}
        </div>
      )}
      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 8 }}>
        Toque em qualquer lugar pra fechar
      </div>
    </div>
  );
}

export function Modal({ show, title, children, onClose }) {
  if (!show) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16, overscrollBehavior: "contain" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, padding: 20, width: "100%", maxWidth: 400, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, position: "sticky", top: -20, background: "#fff", padding: "16px 0 12px 0", marginTop: -20, borderBottom: "1px solid #eee", zIndex: 1 }}>
          <div style={{ fontWeight: 800, color: NAVY, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", fontSize: 18, cursor: "pointer", color: "#666", width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>✕</button>
        </div>
        <div style={{ paddingTop: 4 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── CONFIRMAR — substituto do confirm() que funciona no iPhone iframe ──
   Cria modal visual via DOM. Sempre usa overlay próprio (mais confiável). */
export function confirmar(mensagem, onConfirm) {
  // Remove overlay anterior se houver
  const existente = document.getElementById("km-confirm-overlay");
  if (existente) existente.remove();

  const overlay = document.createElement("div");
  overlay.id = "km-confirm-overlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,Arial,sans-serif;-webkit-tap-highlight-color:transparent;";

  const card = document.createElement("div");
  card.style.cssText = "background:#fff;border-radius:16px;padding:24px 20px;max-width:340px;width:100%;color:#222;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.3);";
  card.innerHTML = `
    <div style="font-size:42px;margin-bottom:10px;">⚠️</div>
    <div style="font-size:14px;color:#333;margin-bottom:18px;line-height:1.5;white-space:pre-line;font-weight:500;">${String(mensagem).replace(/</g, "&lt;")}</div>
    <div style="display:flex;gap:8px;">
      <button id="km-cnf-no" type="button" style="flex:1;padding:14px;background:#e5e7eb;color:#333;border:none;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;touch-action:manipulation;">Cancelar</button>
      <button id="km-cnf-yes" type="button" style="flex:1;padding:14px;background:#d63b3b;color:#fff;border:none;border-radius:12px;font-weight:800;font-size:14px;cursor:pointer;touch-action:manipulation;">Confirmar</button>
    </div>
  `;
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const fechar = () => { try { overlay.remove(); } catch (e) {} };

  // Múltiplos handlers pra garantir que funciona em qualquer browser/iOS
  const btnNo = document.getElementById("km-cnf-no");
  const btnYes = document.getElementById("km-cnf-yes");

  btnNo.onclick = fechar;
  btnNo.ontouchend = (e) => { e.preventDefault(); fechar(); };

  btnYes.onclick = () => { fechar(); try { onConfirm(); } catch (err) { console.error("Erro ao confirmar:", err); alert("Erro: " + err.message); } };
  btnYes.ontouchend = (e) => { e.preventDefault(); fechar(); try { onConfirm(); } catch (err) { console.error("Erro:", err); } };

  overlay.onclick = (e) => { if (e.target === overlay) fechar(); };
}

/* ── ASSINATURA DIGITAL EM CANVAS ── */
export function Assinatura({ valor, onChange, label = "Assine abaixo" }) {
  const canvasRef = useMemo(() => ({ current: null }), []);
  const [desenhando, setDesenhando] = useState(false);

  const setupCanvas = (canvas) => {
    if (!canvas || canvasRef.current === canvas) return;
    canvasRef.current = canvas;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f2151";
    if (valor) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
      img.src = valor;
    }
  };

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const t = e.touches?.[0];
    return { x: (t?.clientX ?? e.clientX) - rect.left, y: (t?.clientY ?? e.clientY) - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    setDesenhando(true);
    const { x, y } = pos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e) => {
    if (!desenhando) return;
    e.preventDefault();
    const { x, y } = pos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    if (!desenhando) return;
    setDesenhando(false);
    if (canvasRef.current) onChange(canvasRef.current.toDataURL());
  };

  const limpar = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    onChange(null);
  };

  return (
    <div>
      <label style={labelS}>{label}</label>
      <div style={{ background: "#f9fafb", border: "1.5px dashed #c5d0e5", borderRadius: 10, position: "relative" }}>
        <canvas
          ref={setupCanvas}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
          style={{ width: "100%", height: 140, display: "block", cursor: "crosshair", touchAction: "none" }}
        />
        {!valor && !desenhando && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb", fontSize: 13, pointerEvents: "none" }}>✍️ Assine aqui com o dedo ou mouse</div>}
      </div>
      <button onClick={limpar} style={{ background: "none", border: "none", color: BLUE, fontSize: 12, cursor: "pointer", marginTop: 4, fontWeight: 600 }}>🗑️ Limpar</button>
    </div>
  );
}

/* ════════════════════════════════════
   LOGIN
════════════════════════════════════ */
/* ════════════════════════════════════
   PERFIL — PIN e Biometria
════════════════════════════════════ */
