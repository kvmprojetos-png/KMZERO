export const NAVY  = "#052f3d"; // deep teal
export const NAVY2 = "#0b7285"; // accent teal
export const GOLD  = "#ffb830"; // warm gold
export const GREEN = "#25b579"; // fresh green
export const RED   = "#ef476f"; // coral red
export const ORANGE= "#ff9f1c"; // bright orange
export const BLUE  = "#2094ff"; // vivid blue
export const LIGHT = "#f7fbfc"; // very light background

export const DEFAULT_FONT = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial";
// Só para display (lockup KM|ZERO, títulos da vitrine/login); o corpo continua em Inter
export const DISPLAY_FONT = "Barlow, Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial";

/* Tokens que mudam entre tema claro e escuro (valores em src/tema.css).
   As constantes hex acima ficam fixas: várias telas colam sufixo alfa (`${RED}33`)
   e home.jsx faz parseInt do hex — var() quebraria isso. Use T.* só em estilos CSS;
   para Recharts/SVG use a paleta hex de src/lib/useTema.js. */
export const T = {
  fundo: "var(--km-fundo)",
  fundoExterno: "var(--km-fundo-externo)",
  superficie: "var(--km-superficie)",
  superficie2: "var(--km-superficie2)",
  superficie3: "var(--km-superficie3)",
  borda: "var(--km-borda)",
  borda2: "var(--km-borda2)",
  contorno: "var(--km-contorno)",
  titulo: "var(--km-titulo)",
  texto: "var(--km-texto)",
  texto2: "var(--km-texto2)",
  texto3: "var(--km-texto3)",
  desabilitado: "var(--km-desabilitado)",
  desabilitadoFundo: "var(--km-desabilitado-fundo)",
  inputFundo: "var(--km-input-fundo)",
  inputBorda: "var(--km-input-borda)",
  inputTexto: "var(--km-input-texto)",
  placeholder: "var(--km-placeholder)",
  setaSelect: "var(--km-seta-select)",
  sombra: "var(--km-sombra)",
  sombra2: "var(--km-sombra2)",
  acento: "var(--km-acento)",
  barra: "var(--km-barra)",
  menuFundo: "var(--km-menu-fundo)",
  menuFundo2: "var(--km-menu-fundo2)",
  menuBorda: "var(--km-menu-borda)",
  menuTexto: "var(--km-menu-texto)",
  menuTexto2: "var(--km-menu-texto2)",
  menuHover: "var(--km-menu-hover)",
  menuAtivo: "var(--km-menu-ativo)",
  infoFundo: "var(--km-info-fundo)",
  infoBorda: "var(--km-info-borda)",
  infoTexto: "var(--km-info-texto)",
  sucessoFundo: "var(--km-sucesso-fundo)",
  sucessoBorda: "var(--km-sucesso-borda)",
  sucessoTexto: "var(--km-sucesso-texto)",
  avisoFundo: "var(--km-aviso-fundo)",
  avisoBorda: "var(--km-aviso-borda)",
  avisoTexto: "var(--km-aviso-texto)",
  erroFundo: "var(--km-erro-fundo)",
  erroBorda: "var(--km-erro-borda)",
  erroTexto: "var(--km-erro-texto)",
  roxoFundo: "var(--km-roxo-fundo)",
  roxoBorda: "var(--km-roxo-borda)",
  roxoTexto: "var(--km-roxo-texto)",
};

/* Paleta fixa do login e do splash: sempre escura, nos dois temas
   (a entrada é "engenharia à noite" mesmo no celular). */
export const ESCURO = {
  fundo: "#081a21",
  fundo2: NAVY,
  cartao: "rgba(255,255,255,0.05)",
  borda: "rgba(255,255,255,0.12)",
  texto: LIGHT,
  texto2: "rgba(247,251,252,0.65)",
};

export const labelS = { fontSize: 13, color: T.texto2, marginBottom: 6, display: "block", fontFamily: DEFAULT_FONT };
export const inputS = { width: "100%", boxSizing: "border-box", border: `1.5px solid ${T.inputBorda}`, borderRadius: 12, padding: "12px 14px", fontSize: 15, outline: "none", marginBottom: 12, background: T.inputFundo, color: T.inputTexto, fontFamily: DEFAULT_FONT, minHeight: 46 };
// Estilo específico para inputs type=date — corrige bug do iOS Safari que ignora width:100% e estoura a margem
export const dateS = { ...inputS, appearance: "none", WebkitAppearance: "none", minWidth: 0, maxWidth: "100%", display: "block" };
export const selS   = { ...inputS, appearance: "none", backgroundImage: T.setaSelect, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" };
export const bigBtn = (color) => ({ background: color, color: "#fff", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 15, fontWeight: 800, cursor: "pointer", width: "100%", letterSpacing: 0.6, boxShadow: `0 6px 20px ${color}33`, fontFamily: DEFAULT_FONT });
export const css = (...objs) => Object.assign({}, ...objs);
