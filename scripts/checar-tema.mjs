/* Levanta as cores FIXAS nos estilos inline do app (style={{ ... }}), por propriedade.
   Uso: node scripts/checar-tema.mjs [--por-arquivo] [--prop background] [--valor "#fff"]
   Serve para medir o tema escuro: o que ainda está "cravado" em claro nas telas.
   Ignora (de forma aproximada) trechos dentro de template strings de HTML (PDF/impressão),
   que devem continuar claros. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const porArquivo = args.includes("--por-arquivo");
const filtroProp = opt("--prop");
const filtroValor = opt("--valor");

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const arquivos = [];
(function andar(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) andar(p);
    else if (/\.(jsx|js)$/.test(e.name)) arquivos.push(p);
  }
})(RAIZ);

const PROPS = "background|backgroundColor|color|border|borderTop|borderBottom|borderLeft|borderRight|borderColor|boxShadow|outline";
const RE = new RegExp(`\\b(${PROPS})\\s*:\\s*(\"[^\"]*\"|'[^']*'|\`[^\`]*\`|[A-Z][A-Z0-9_]*)`, "g");
const CONSTANTES = new Set(["NAVY", "NAVY2", "GOLD", "GREEN", "RED", "ORANGE", "BLUE", "LIGHT"]);

const contagem = new Map(); // "prop → valor" → { n, arquivos: Map }
let dentroHTML = false;
for (const arq of arquivos) {
  const rel = path.relative(path.join(RAIZ, ".."), arq).replace(/\\/g, "/");
  const linhas = fs.readFileSync(arq, "utf8").split(/\r?\n/);
  dentroHTML = false;
  for (const linha of linhas) {
    // Template string de HTML (PDF/impressão): começa numa linha com crase + tag e fecha com crase
    const crases = (linha.match(/(?<!\\)`/g) || []).length;
    const pareceHTML = /<(html|div|table|style|body|span|h\d|td|tr)\b/i.test(linha);
    if (!dentroHTML && crases % 2 === 1 && pareceHTML) { dentroHTML = true; continue; }
    if (dentroHTML) { if (crases % 2 === 1) dentroHTML = false; continue; }
    if (!/style=|Style|\bstyle\b|S = \{|const \w+S\b/.test(linha) && !/\{\s*\w+:\s*("|')#/.test(linha)) {
      // fora de objeto de estilo: ainda conta cores em objetos literais (ex.: css({...}))
      if (!/(background|color|border)\s*:/.test(linha)) continue;
    }
    let m;
    while ((m = RE.exec(linha))) {
      const prop = m[1];
      let valor = m[2];
      if (/^[A-Z]/.test(valor) && !CONSTANTES.has(valor)) continue; // outra constante qualquer
      if (/var\(--km-/.test(valor)) continue; // já é token
      if (/^"(transparent|inherit|none|currentColor)"$/.test(valor)) continue;
      const chave = `${prop} → ${valor}`;
      if (filtroProp && prop !== filtroProp) continue;
      if (filtroValor && !valor.includes(filtroValor)) continue;
      const c = contagem.get(chave) || { n: 0, arquivos: new Map() };
      c.n++;
      c.arquivos.set(rel, (c.arquivos.get(rel) || 0) + 1);
      contagem.set(chave, c);
    }
  }
}

const lista = [...contagem.entries()].sort((a, b) => b[1].n - a[1].n);
const total = lista.reduce((s, [, c]) => s + c.n, 0);
console.log(`Cores fixas em estilos inline (fora do HTML de PDF): ${total} ocorrências, ${lista.length} combinações\n`);
for (const [chave, c] of lista.slice(0, porArquivo ? lista.length : 60)) {
  console.log(String(c.n).padStart(5), " ", chave);
  if (porArquivo) for (const [a, n] of [...c.arquivos.entries()].sort((x, y) => y[1] - x[1])) console.log("         ", String(n).padStart(4), a);
}
if (!porArquivo && lista.length > 60) console.log(`… e mais ${lista.length - 60} combinações (use --por-arquivo para ver tudo)`);

/* ── Prova: nenhum token dentro do HTML de PDF/impressão (template literals com tags) ── */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");
let vazamentos = 0;
for (const arq of arquivos) {
  const codigo = fs.readFileSync(arq, "utf8");
  let ast; try { ast = parse(codigo, { sourceType: "module", plugins: ["jsx"], errorRecovery: true }); } catch { continue; }
  const rel = path.relative(path.join(RAIZ, ".."), arq).replace(/\\/g, "/");
  (function andar(no) {
    if (!no || typeof no !== "object") return;
    if (Array.isArray(no)) return no.forEach(andar);
    if (no.type === "TemplateLiteral") {
      const texto = codigo.slice(no.start, no.end);
      // Só documentos/tabelas de impressão contam: o HTML do confirmar()/Modal (div/button no DOM do app) pode usar var().
      const ehHTML = /<\s*(html|head|style|table|thead|tbody|tr|td|th)\b|@page|<!doctype/i.test(texto);
      if (ehHTML && /var\(--km-|\bT\.[a-zA-Z]/.test(texto)) { vazamentos++; console.log("  ! token dentro de HTML de PDF:", rel + ":" + codigo.slice(0, no.start).split("\n").length); }
      if (ehHTML) return;
    }
    for (const k of Object.keys(no)) { if (k !== "loc") { const v = no[k]; if (v && typeof v === "object") andar(v); } }
  })(ast.program);
}
console.log(vazamentos ? "\n❌ " + vazamentos + " vazamento(s) de token em HTML de PDF" : "\n✅ Nenhum token dentro do HTML de PDF/impressão");
