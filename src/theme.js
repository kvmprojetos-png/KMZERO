export const NAVY  = "#052f3d"; // deep teal
export const NAVY2 = "#0b7285"; // accent teal
export const GOLD  = "#ffb830"; // warm gold
export const GREEN = "#25b579"; // fresh green
export const RED   = "#ef476f"; // coral red
export const ORANGE= "#ff9f1c"; // bright orange
export const BLUE  = "#2094ff"; // vivid blue
export const LIGHT = "#f7fbfc"; // very light background

const DEFAULT_FONT = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial";

export const labelS = { fontSize: 13, color: "#4b5563", marginBottom: 6, display: "block", fontFamily: DEFAULT_FONT };
export const inputS = { width: "100%", boxSizing: "border-box", border: "1.5px solid #e6eef2", borderRadius: 12, padding: "12px 14px", fontSize: 15, outline: "none", marginBottom: 12, background: "#ffffff", fontFamily: DEFAULT_FONT, minHeight: 46 };
// Estilo específico para inputs type=date — corrige bug do iOS Safari que ignora width:100% e estoura a margem
export const dateS = { ...inputS, appearance: "none", WebkitAppearance: "none", minWidth: 0, maxWidth: "100%", display: "block" };
export const selS   = { ...inputS, appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%234b5563' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" };
export const bigBtn = (color) => ({ background: color, color: "#fff", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 15, fontWeight: 800, cursor: "pointer", width: "100%", letterSpacing: 0.6, boxShadow: `0 6px 20px ${color}33`, fontFamily: DEFAULT_FONT });
export const css = (...objs) => Object.assign({}, ...objs);
