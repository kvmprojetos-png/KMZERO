export const NAVY  = "#0f2151";
export const NAVY2 = "#1a3370";
export const GOLD  = "#f5a623";
export const GREEN = "#2aa84f";
export const RED   = "#d63b3b";
export const ORANGE= "#e87722";
export const BLUE  = "#1e6bbf";
export const LIGHT = "#f2f4f8";

export const labelS = { fontSize: 12, color: "#666", marginBottom: 4, display: "block" };
export const inputS = { width: "100%", boxSizing: "border-box", border: "1.5px solid #dde2ef", borderRadius: 10, padding: "12px 13px", fontSize: 14, outline: "none", marginBottom: 12, background: "#f9fafb", fontFamily: "inherit", minHeight: 44 };
// Estilo específico para inputs type=date — corrige bug do iOS Safari que ignora width:100% e estoura a margem
export const dateS = { ...inputS, appearance: "none", WebkitAppearance: "none", minWidth: 0, maxWidth: "100%", display: "block" };
export const selS   = { ...inputS, appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23666' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 13px center" };
export const bigBtn = (color) => ({ background: color, color: "#fff", border: "none", borderRadius: 10, padding: "13px 0", fontSize: 15, fontWeight: 800, cursor: "pointer", width: "100%", letterSpacing: 0.8, boxShadow: `0 3px 10px ${color}55` });
export const css = (...objs) => Object.assign({}, ...objs);
