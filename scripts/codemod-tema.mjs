/* Codemod do tema escuro: troca cores FIXAS dos estilos inline das telas pelos tokens T.*
   (src/theme.js → var(--km-*)), por PROPRIEDADE, fora dos blocos de HTML de PDF/impressão.

   Uso:  node scripts/codemod-tema.mjs            (aplica)
         node scripts/codemod-tema.mjs --simular  (só mostra o que faria)
         node scripts/codemod-tema.mjs --so src/screens/home.jsx

   Proteções (ver docs no briefing "Não mudar"):
   - Template literals que contêm HTML (<div, <style, <table, style=" ...) ficam intocados:
     esse HTML vai para uma janela de impressão sem :root, onde var(--km-*) é inválido.
   - src/lib/pdf.js, src/data/catalogos.js, src/tema.css e a vitrine não entram.
   - As 8 constantes hex de theme.js (NAVY, GOLD...) nunca viram var(): há sufixos alfa
     (`${RED}33`) e parseInt do hex no código.
   - color: NAVY sobre fundo GOLD continua NAVY (texto escuro sobre ouro é o certo nos dois temas).
   Usa @babel/parser (vem com @vitejs/plugin-react) para achar os template literals com precisão. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");

const args = process.argv.slice(2);
const SIMULAR = args.includes("--simular");
const SO = (() => { const i = args.indexOf("--so"); return i >= 0 ? args[i + 1] : null; })();
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(RAIZ, "src");
const IGNORAR = new Set(["src/lib/pdf.js", "src/data/catalogos.js", "src/tema.css", "src/theme.js", "src/components/Icones.jsx"]);

/* ── Regras: [propriedades, valores aceitos, substituto, opções] ──
   `valores` são strings EXATAS entre aspas (com as aspas) ou identificadores (LIGHT).
   `para` é o código que substitui o valor inteiro. */
const S = v => `"${v}"`;
const REGRAS = [
  // fundos
  { props: ["background", "backgroundColor"], valores: [S("#fff"), S("#ffffff"), S("#FFF"), S("#FFFFFF")], para: "T.superficie" },
  { props: ["background", "backgroundColor"], valores: ["LIGHT"], para: (linha) => /overflowY/.test(linha) || /minHeight: "100vh"/.test(linha) ? "T.fundo" : "T.superficie2", nota: "LIGHT" },
  { props: ["background", "backgroundColor"], valores: [S("#f9fafb"), S("#f3f4f6"), S("#eee"), S("#f5f8fc"), S("#f8fafc"), S("#f0f0f0"), S("#f5f5f5"), S("#fafafa")], para: "T.superficie2" },
  { props: ["background", "backgroundColor"], valores: [S("#ccc")], para: "T.desabilitadoFundo" },
  { props: ["background", "backgroundColor"], valores: [S("#888")], para: "T.texto3" },
  { props: ["background", "backgroundColor"], valores: [S("#f0fdf4"), S("#dcfce7")], para: "T.sucessoFundo" },
  { props: ["background", "backgroundColor"], valores: [S("#fef2f2"), S("#fee2e2")], para: "T.erroFundo" },
  { props: ["background", "backgroundColor"], valores: [S("#fef9e7"), S("#fff8f0"), S("#fff7e6"), S("#fff8e1"), S("#fffaeb"), S("#fef3c7"), S("#fffbeb")], para: "T.avisoFundo" },
  { props: ["background", "backgroundColor"], valores: [S("#f0f7ff"), S("#dde6f5"), S("#eff6ff"), S("#eef2ff"), S("#e6f3f6"), S("#ecfeff")], para: "T.infoFundo" },
  { props: ["background", "backgroundColor"], valores: [S("#f3e8ff"), S("#f5f3ff")], para: "T.roxoFundo" },
  { props: ["background", "backgroundColor"], valores: [S("#0a1535")], para: "T.fundoExterno" },
  { props: ["background", "backgroundColor"], valores: [S("#0f2151"), S("#0F2151")], para: "NAVY" },
  // textos
  { props: ["color"], valores: ["NAVY"], para: "T.titulo", pular: (linha) => /background:\s*GOLD|background:\s*"#ffb830"|bigBtn\(GOLD\)/.test(linha), nota: "NAVY sobre GOLD" },
  { props: ["color"], valores: [S("#0f2151"), S("#0F2151")], para: "T.titulo" },
  { props: ["color"], valores: [S("#444"), S("#333"), S("#222"), S("#1a1a1a"), S("#374151"), S("#1f2937")], para: "T.texto" },
  { props: ["color"], valores: [S("#666"), S("#888"), S("#555"), S("#777"), S("#4b5563"), S("#475569"), S("#6b7280"), S("#64748b")], para: "T.texto2" },
  { props: ["color"], valores: [S("#999"), S("#aaa"), S("#94a3b8"), S("#9ca3af")], para: "T.texto3" },
  { props: ["color"], valores: [S("#bbb"), S("#ccc"), S("#ddd"), S("#cbd5e1")], para: "T.desabilitado" },
  { props: ["color"], valores: [S("#14532d"), S("#15803d"), S("#166534")], para: "T.sucessoTexto" },
  { props: ["color"], valores: [S("#991b1b"), S("#7f1d1d"), S("#b91c1c")], para: "T.erroTexto" },
  { props: ["color"], valores: [S("#8b6f00"), S("#7b5800"), S("#7c6f3a"), S("#92400e"), S("#854d0e"), S("#9a6a1a"), S("#8a6d1a"), S("#9a6200")], para: "T.avisoTexto" },
  { props: ["color"], valores: [S("#0c4a6e"), S("#004080"), S("#1e40af"), S("#155e63"), S("#1e3a8a")], para: "T.infoTexto" },
  { props: ["color"], valores: [S("#7c3aed"), S("#5b21b6"), S("#6d28d9")], para: "T.roxoTexto" },
  // paletas antigas → constantes (continuam iguais nos dois temas)
  { props: ["color", "background", "backgroundColor"], valores: [S("#f5a623"), S("#F5A623"), S("#c0a040"), S("#C0A040")], para: "GOLD" },
  { props: ["color", "background", "backgroundColor"], valores: [S("#d63b3b"), S("#dc2626")], para: "RED" },
  { props: ["color", "background", "backgroundColor"], valores: [S("#2aa84f"), S("#16a34a")], para: "GREEN" },
  // sombras
  { props: ["boxShadow"], valores: [S("0 1px 5px rgba(0,0,0,0.06)"), S("0 2px 8px rgba(0,0,0,0.06)"), S("0 2px 10px rgba(15,33,81,0.06)"), S("0 2px 8px rgba(0,0,0,0.05)"), S("0 1px 4px rgba(0,0,0,0.06)"), S("0 2px 6px rgba(0,0,0,0.06)")], para: "T.sombra" },
  { props: ["boxShadow"], valores: [S("0 20px 60px rgba(0,0,0,0.3)"), S("0 20px 60px rgba(0,0,0,0.30)")], para: "T.sombra2" },
];
// Bordas: "1px solid #eee" → `1px solid ${T.borda}` (vira template literal)
const BORDAS = [
  { cores: ["eee", "e5e7eb", "dde2ef", "ddd", "f0f0f0", "f3f4f6", "f0f2f5", "eef1f4", "e6edf0", "f1f5f9", "e2e8f0", "d5dce6", "e3e9ee", "d0d4dc", "c9ced6", "e6eef2", "dbe6ea", "e0e9ed", "f5f5f5"], para: "T.borda" },
  { cores: ["ccc", "c5d0e5", "bbb", "cbd5e1"], para: "T.borda2" },
  { cores: ["fecaca", "fca5a5", "f5c2c2"], para: "T.erroBorda" },
  { cores: ["bae6fd", "c7d2fe", "bfdcf7"], para: "T.infoBorda" },
  { cores: ["fde68a", "f5dfa0"], para: "T.avisoBorda" },
  { cores: ["16a34a55", "bbf0d2", "86efac"], para: "T.sucessoBorda" },
];
const PROPS_BORDA = ["border", "borderTop", "borderBottom", "borderLeft", "borderRight"];

/* ── Regiões protegidas: template literals com HTML ── */
function regioesProtegidas(codigo) {
  let ast;
  try {
    ast = parse(codigo, { sourceType: "module", plugins: ["jsx"], errorRecovery: true, ranges: true });
  } catch (e) { console.error("  ! não consegui parsear, arquivo pulado:", e.message); return null; }
  const regioes = [];
  const pareceHTML = t => /<\s*(html|div|style|table|body|span|h\d|td|tr|p|section|header|footer|ul|li|img|br)\b/i.test(t) || /style="/.test(t) || /<\/[a-z]+>/i.test(t);
  (function andar(no) {
    if (!no || typeof no !== "object") return;
    if (Array.isArray(no)) { no.forEach(andar); return; }
    if (no.type === "TemplateLiteral") {
      const texto = no.quasis.map(q => q.value.raw).join(" ");
      if (pareceHTML(texto)) { regioes.push([no.start, no.end]); return; } // não desce: tudo dentro é HTML
    }
    for (const k of Object.keys(no)) { if (k === "loc" || k === "range") continue; const v = no[k]; if (v && typeof v === "object") andar(v); }
  })(ast.program);
  return regioes;
}

/* ── Aplica as regras linha a linha, pulando as regiões protegidas ── */
function processar(rel, codigo) {
  const regioes = regioesProtegidas(codigo);
  if (!regioes) return null;
  const protegido = (ini, fim) => regioes.some(([a, b]) => ini < b && fim > a);
  const eol = codigo.includes("\r\n") ? "\r\n" : "\n";
  const linhas = codigo.split(/\r?\n/);
  const trocas = {}; const notas = [];
  let usaT = false, usaNAVY = false, usaGOLD = false, usaRED = false, usaGREEN = false;
  let pos = 0;
  const novas = linhas.map((linha, idx) => {
    const ini = pos; pos += linha.length + eol.length;
    if (protegido(ini, ini + linha.length)) return linha;
    let nova = linha;
    // 1) botão vazado: border `1.5px solid ${NAVY}` + background branco + color NAVY na mesma linha
    if (/border:\s*`1\.5px solid \$\{NAVY\}`/.test(nova) && /background:\s*"#fff"/.test(nova) && /color:\s*NAVY/.test(nova)) {
      nova = nova.replace(/border:\s*`1\.5px solid \$\{NAVY\}`/, "border: `1.5px solid ${T.contorno}`").replace(/color:\s*NAVY\b/, "color: T.contorno");
      trocas["botão vazado → T.contorno"] = (trocas["botão vazado → T.contorno"] || 0) + 1; usaT = true;
    }
    // 2) bordas com hex claro
    for (const p of PROPS_BORDA) {
      const re = new RegExp(`\\b(${p})\\s*:\\s*"(\\d+(?:\\.5)?px)\\s+(solid|dashed|dotted)\\s+#([0-9a-fA-F]{3,8})"`, "g");
      nova = nova.replace(re, (m, prop, larg, estilo, hex) => {
        const regra = BORDAS.find(b => b.cores.includes(hex.toLowerCase()));
        if (!regra) return m;
        const chave = `${prop}: #${hex} → ${regra.para}`; trocas[chave] = (trocas[chave] || 0) + 1; usaT = true;
        return `${prop}: \`${larg} ${estilo} \${${regra.para}}\``;
      });
    }
    // 3) regras por propriedade/valor
    for (const r of REGRAS) {
      for (const p of r.props) {
        for (const v of r.valores) {
          const vEsc = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const re = new RegExp(`\\b${p}\\s*:\\s*${vEsc}(?![\\w"'\`])`, "g");
          if (!re.test(nova)) continue;
          if (r.pular && r.pular(nova)) { notas.push(`${rel}:${idx + 1} mantido (${r.nota})`); continue; }
          const para = typeof r.para === "function" ? r.para(nova) : r.para;
          if (r.nota === "LIGHT") notas.push(`${rel}:${idx + 1} LIGHT → ${para}`);
          nova = nova.replace(re, `${p}: ${para}`);
          const chave = `${p}: ${v} → ${para}`; trocas[chave] = (trocas[chave] || 0) + 1;
          if (para.startsWith("T.")) usaT = true;
          if (para === "NAVY") usaNAVY = true; if (para === "GOLD") usaGOLD = true; if (para === "RED") usaRED = true; if (para === "GREEN") usaGREEN = true;
        }
      }
    }
    return nova;
  });
  let saida = novas.join(eol);
  // Garante os imports de theme.js
  const precisa = [usaT && "T", usaNAVY && "NAVY", usaGOLD && "GOLD", usaRED && "RED", usaGREEN && "GREEN"].filter(Boolean);
  if (precisa.length) {
    const m = saida.match(/import\s*\{([^}]*)\}\s*from\s*"([./]*theme\.js)";?/);
    if (m) {
      const nomes = m[1].split(",").map(s => s.trim()).filter(Boolean);
      const faltam = precisa.filter(n => !nomes.includes(n));
      if (faltam.length) saida = saida.replace(m[0], `import { ${[...nomes, ...faltam].join(", ")} } from "${m[2]}";`);
    } else {
      const prof = rel.split("/").length - 2; // src/x.jsx → 0; src/screens/x.jsx → 1
      const caminho = (prof === 0 ? "./" : "../".repeat(prof)) + "theme.js";
      saida = saida.replace(/^(import[^\n]*\n)/, `$1import { ${precisa.join(", ")} } from "${caminho}";\n`);
      notas.push(`${rel}: import de theme.js adicionado (${precisa.join(", ")})`);
    }
  }
  return { saida, trocas, notas, mudou: saida !== codigo };
}

/* ── Roda ── */
const arquivos = [];
(function andar(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) andar(p); else if (/\.(jsx|js)$/.test(e.name)) arquivos.push(p);
  }
})(SRC);
const totalTrocas = {}; const todasNotas = [];
let arquivosMudados = 0;
for (const arq of arquivos) {
  const rel = path.relative(RAIZ, arq).replace(/\\/g, "/");
  if (IGNORAR.has(rel)) continue;
  if (SO && rel !== SO.replace(/\\/g, "/")) continue;
  const codigo = fs.readFileSync(arq, "utf8");
  const r = processar(rel, codigo);
  if (!r || !r.mudou) continue;
  arquivosMudados++;
  const n = Object.values(r.trocas).reduce((s, x) => s + x, 0);
  console.log(`${SIMULAR ? "[simular] " : ""}${rel}: ${n} trocas`);
  for (const [k, v] of Object.entries(r.trocas)) totalTrocas[k] = (totalTrocas[k] || 0) + v;
  todasNotas.push(...r.notas);
  if (!SIMULAR) fs.writeFileSync(arq, r.saida);
}
console.log(`\n${arquivosMudados} arquivo(s), ${Object.values(totalTrocas).reduce((s, x) => s + x, 0)} trocas:`);
for (const [k, v] of Object.entries(totalTrocas).sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(5), " ", k);
if (todasNotas.length) { console.log(`\nNotas para revisão (${todasNotas.length}):`); todasNotas.forEach(n => console.log("  -", n)); }
