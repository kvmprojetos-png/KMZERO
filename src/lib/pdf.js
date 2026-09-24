/* ═══════════════════════════════════════════════════════════════════════════
   KMZERO — camada comum dos documentos de saída (PDF / impressão)

   - KM_DOC_CSS: identidade e classes compartilhadas (papel branco, cores fixas).
   - gerarHeaderHTML / gerarFooterHTML / gerarAssinaturasHTML: blocos padrão.
   - abrirOuBaixarHTML: visualizador PAGINADO (páginas reais .km-pagina), PDF
     página a página (html2canvas + jsPDF) e impressão das mesmas páginas.

   Regra de produto: os documentos levam SÓ dados da empresa cliente (objeto
   "empresa"). A marca do produto aparece apenas como o lockup pequeno KMZERO.
═══════════════════════════════════════════════════════════════════════════ */

export const carregarScript = (src) => new Promise((resolve, reject) => {
  if ([...document.scripts].some(s => s.src === src)) return resolve();
  const s = document.createElement("script");
  s.src = src;
  s.onload = () => resolve();
  s.onerror = () => reject(new Error("Falha ao carregar " + src));
  document.head.appendChild(s);
});

export const carregarPDFLibs = async () => {
  if (window.jspdf && window.html2canvas) return;
  await carregarScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
  await carregarScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
};

/* ── Paleta FIXA dos documentos (papel branco). Nunca var(--km-*) nem constantes de tema. ── */
export const KM_DOC_CORES = Object.freeze({
  navy: "#052f3d", ouro: "#ffb830", teal: "#0b7285", cinza: "#5c6b73",
  borda: "#d5dce6", fundo: "#f7fbfc", texto: "#1c2a30",
  cabecalho: "#eef4f6", total: "#fff7df",
  ok: "#1e7f4f", alerta: "#b7791f", erro: "#b42318",
});

export const KM_DOC_FONTES_URL = "https://fonts.googleapis.com/css2?family=Barlow:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap";

/* ═══ CSS ÚNICO DOS DOCUMENTOS ═══
   Vale para o HTML bruto (impressão/arquivo) e para o visualizador (que o escopa em #km-doc-page). */
export const KM_DOC_CSS = `
  /* KMZERO — padrão dos documentos de saída. navy #052f3d · ouro #ffb830 · teal #0b7285 · cinza #5c6b73 · bordas #d5dce6 · fundo #f7fbfc · texto #1c2a30 */
  /* Base de elementos com :where() (especificidade zero): qualquer regra do template vence, em qualquer ordem */
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Inter", Arial, Helvetica, sans-serif; font-size: 9pt; line-height: 1.35; color: #1c2a30; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  :where(h1, h2, h3, h4) { line-height: 1.2; margin: 0 0 6px; } /* sem cor: herda do bloco (títulos de seção usam .sec) */
  :where(h1) { font-size: 13pt; font-weight: 800; }
  :where(h2) { font-size: 10.5pt; font-weight: 800; }
  :where(h3) { font-size: 9.5pt; font-weight: 700; }
  :where(p) { margin: 0 0 6px; }
  :where(img) { max-width: 100%; }
  :where(a) { color: #0b7285; text-decoration: none; }
  :where(b, strong) { font-weight: 700; }

  /* Lockup do produto (único lugar em que a marca KMZERO aparece) */
  .km-lockup { font-family: "Barlow", "Inter", Arial, sans-serif; font-weight: 800; letter-spacing: -0.02em; color: #052f3d; white-space: nowrap; line-height: 1; }
  .km-lockup span { color: #ffb830; }
  .km-lockup small { display: block; font-family: "Inter", Arial, sans-serif; font-size: 5.5pt; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #5c6b73; margin-top: 3px; }

  /* Rótulo pequeno em caixa alta */
  .rotulo { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #5c6b73; }

  /* ── Cabeçalho (1ª página) ── */
  .km-header { display: flex; align-items: flex-start; gap: 12px; margin: 0 0 10px; padding: 0 0 8px; border-bottom: 2px solid #052f3d; break-inside: avoid; page-break-inside: avoid; }
  .km-header-empresa { flex: 1 1 42%; min-width: 0; display: flex; align-items: center; gap: 10px; }
  .km-header-empresa img { max-height: 16mm; max-width: 38mm; object-fit: contain; flex: 0 0 auto; }
  .km-empresa-nome { font-size: 12pt; font-weight: 800; color: #052f3d; line-height: 1.15; overflow-wrap: anywhere; }
  .km-empresa-linhas { font-size: 7.5pt; color: #5c6b73; line-height: 1.4; margin-top: 2px; overflow-wrap: anywhere; }
  .km-empresa-linhas b { color: #1c2a30; font-weight: 600; }
  /* cada dado (CNPJ, registro, telefone) é indivisível: a linha só quebra nos separadores " · "; endereço e e-mail podem quebrar */
  .km-empresa-linhas .km-dado { white-space: nowrap; }
  .km-empresa-linhas .km-dado.km-dado-texto { white-space: normal; }
  .km-header-doc { flex: 1 1 38%; min-width: 0; border-left: 3px solid #ffb830; padding-left: 10px; }
  .km-doc-tipo { font-size: 10.5pt; font-weight: 800; color: #052f3d; text-transform: uppercase; letter-spacing: 0.4px; line-height: 1.2; overflow-wrap: anywhere; }
  .km-doc-num { font-size: 8.5pt; color: #1c2a30; font-weight: 600; margin-top: 2px; }
  .km-doc-sub { font-size: 7.5pt; color: #5c6b73; margin-top: 2px; overflow-wrap: anywhere; }
  .km-header-meta { flex: 0 0 auto; max-width: 34%; text-align: right; font-size: 7pt; color: #5c6b73; }
  .km-header-meta .km-emitido { display: block; color: #1c2a30; font-weight: 600; font-size: 7.5pt; margin-top: 1px; }
  .km-header-meta .km-lockup { display: inline-block; font-size: 11pt; margin-top: 6px; text-align: right; }
  /* variante compacta (A6 e documentos curtos) */
  .km-header.compacto { display: block; padding-bottom: 5px; margin-bottom: 6px; }
  .km-header.compacto .km-header-linha { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .km-header.compacto .km-empresa-nome { font-size: 9.5pt; }
  .km-header.compacto .km-empresa-linhas { font-size: 6.5pt; margin: 1px 0 4px; }
  .km-header.compacto .km-doc-tipo { font-size: 9pt; }
  .km-header.compacto .km-doc-num { font-size: 8pt; margin: 0; }
  .km-header.compacto .km-doc-sub { font-size: 6.5pt; }
  .km-header.compacto .km-lockup { font-size: 8.5pt; }

  /* ── Cabeçalho de continuação (páginas 2+) — gerado pelo visualizador ── */
  .km-continua { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-size: 7.5pt; color: #5c6b73; border-bottom: 1px solid #d5dce6; padding-bottom: 4px; margin-bottom: 8px; break-inside: avoid; page-break-inside: avoid; }
  .km-continua > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .km-continua > span:first-child { flex: 1 1 auto; }
  .km-continua > span:last-child { flex: 0 0 auto; } /* o lockup nunca é cortado */
  .km-continua b { color: #052f3d; }
  .km-continua .km-lockup { font-size: 8.5pt; }

  /* ── Rodapé (todas as páginas) ── */
  .km-footer { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 7pt; color: #5c6b73; border-top: 1px solid #d5dce6; padding-top: 4px; margin-top: 3.5mm; break-inside: avoid; page-break-inside: avoid; }
  .km-footer > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .km-footer b { color: #052f3d; font-weight: 700; }
  .km-footer .km-footer-pag { flex: 0 0 auto; color: #1c2a30; font-weight: 600; }
  .km-footer .km-footer-dir { flex: 0 0 auto; text-align: right; }
  .km-footer .km-footer-esq { flex: 1 1 auto; }
  .km-footer .km-lockup { font-size: 7.5pt; }

  /* ── Assinaturas ── */
  .km-assinaturas { display: flex; gap: 24px; margin-top: 22px; break-inside: avoid; page-break-inside: avoid; }
  .km-assinaturas .ass { flex: 1 1 0; min-width: 0; text-align: center; margin-top: 40px; padding-top: 4px; border-top: 1px solid #5c6b73; }
  .km-assinaturas .ass b { display: block; color: #052f3d; font-size: 8.5pt; overflow-wrap: anywhere; }
  .km-assinaturas .ass span { display: block; color: #5c6b73; font-size: 7.5pt; margin-top: 1px; }

  /* ── Título de seção ── */
  .sec { font-size: 9.5pt; font-weight: 800; color: #052f3d; text-transform: uppercase; letter-spacing: 0.4px; margin: 12px 0 5px; padding: 0 0 3px; border-bottom: 1.5px solid #ffb830; break-after: avoid; page-break-after: avoid; break-inside: avoid; page-break-inside: avoid; }
  .sec small { font-weight: 600; font-size: 7.5pt; color: #5c6b73; text-transform: none; letter-spacing: 0; margin-left: 6px; }
  .km-header + .sec, .km-continua + .sec, .km-pagina-corpo > .sec:first-child { margin-top: 0; }

  /* ── Tabela padrão ── */
  .quadro { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 8.5pt; margin: 0 0 8px; }
  .quadro thead th { background: #eef4f6; color: #052f3d; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; text-align: left; padding: 4px 6px; border: 1px solid #d5dce6; vertical-align: bottom; overflow-wrap: normal; line-height: 1.25; } /* cabeçalho quebra só nos espaços, nunca no meio da palavra */
  .quadro td { padding: 4px 6px; border: 1px solid #d5dce6; vertical-align: top; overflow-wrap: anywhere; line-height: 1.3; }
  .quadro tbody tr:nth-child(even):not(.total) td { background: #f7fbfc; } /* a zebra nunca toca a linha de total */
  .quadro tr.total td, .quadro tbody tr.total td { background: #fff7df; font-weight: 700; color: #052f3d; border-top: 1.5px solid #ffb830; }
  .quadro th.num, .quadro td.num, .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .quadro th.num, .quadro thead th.num { white-space: normal; } /* o cabeçalho da coluna numérica pode quebrar em duas linhas; nowrap só nos números */
  .quadro th.centro, .quadro td.centro, .centro { text-align: center; }
  .quadro td.vazio, .vazio { text-align: center; color: #5c6b73; font-style: italic; padding: 8px 6px; }
  div.vazio { border: 1px dashed #d5dce6; border-radius: 3px; margin: 0 0 8px; background: #fff; }
  .quadro.compacto { font-size: 7.5pt; }
  .quadro.compacto thead th { font-size: 6.8pt; padding: 3px 4px; }
  .quadro.compacto td { padding: 3px 4px; }
  .quadro tbody tr, .quadro thead { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }

  /* ── Indicadores ── */
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(34mm, 1fr)); gap: 6px; margin: 0 0 10px; break-inside: avoid; page-break-inside: avoid; }
  .kpi { border: 1px solid #d5dce6; border-radius: 4px; background: #f7fbfc; padding: 6px 8px; text-align: center; min-width: 0; break-inside: avoid; page-break-inside: avoid; }
  .kpi b { display: block; font-size: 14pt; font-weight: 800; color: #052f3d; line-height: 1.15; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .kpi span { display: block; font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #5c6b73; margin-top: 2px; }
  .kpi.ok b { color: #1e7f4f; } .kpi.alerta b { color: #b7791f; } .kpi.erro b { color: #b42318; }

  /* ── Caixa de texto (observações, ocorrências) e nota ── */
  .bloco { border: 1px solid #d5dce6; border-left: 3px solid #0b7285; background: #f7fbfc; border-radius: 3px; padding: 6px 8px; margin: 0 0 8px; font-size: 8.5pt; overflow-wrap: anywhere; break-inside: avoid; page-break-inside: avoid; }
  .bloco .rotulo { display: block; margin-bottom: 2px; }
  .bloco.alerta { border-left-color: #ffb830; background: #fff7df; }
  .bloco.ok { border-left-color: #1e7f4f; }
  .bloco.erro { border-left-color: #b42318; }
  .nota { font-size: 7pt; color: #5c6b73; margin: 4px 0 8px; break-inside: avoid; page-break-inside: avoid; }

  /* ── Fotos: grade de 3 com legenda ── */
  .fotos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 0 0 8px; }
  .fotos.f4 { grid-template-columns: repeat(4, 1fr); }
  .fotos.f2 { grid-template-columns: repeat(2, 1fr); }
  .fotos > * { margin: 0; min-width: 0; border: 1px solid #d5dce6; border-radius: 3px; padding: 3px; background: #fff; break-inside: avoid; page-break-inside: avoid; }
  .fotos img { display: block; width: 100%; height: 40mm; object-fit: cover; border-radius: 2px; }
  .fotos.f4 img { height: 30mm; }
  .fotos figcaption, .fotos .legenda { font-size: 7pt; color: #5c6b73; margin-top: 3px; text-align: center; overflow-wrap: anywhere; }

  /* ── Grade de pares rótulo/valor (fichas, identificação) ── */
  .grade-dados { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; background: #d5dce6; border: 1px solid #d5dce6; margin: 0 0 8px; break-inside: avoid; page-break-inside: avoid; }
  .grade-dados.g3 { grid-template-columns: repeat(3, 1fr); }
  .grade-dados.g4 { grid-template-columns: repeat(4, 1fr); }
  .grade-dados > div { background: #fff; padding: 4px 7px; min-width: 0; overflow-wrap: anywhere; }
  .grade-dados .rotulo { display: block; }
  .grade-dados b { display: block; font-size: 8.5pt; font-weight: 600; color: #1c2a30; margin-top: 1px; }
  .grade-dados .c2 { grid-column: span 2; }
  .grade-dados .c3 { grid-column: span 3; }
  .grade-dados .cheio { grid-column: 1 / -1; }

  /* ── Selo (situação) e cores de texto ── */
  .selo { display: inline-block; font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; padding: 1px 5px; border-radius: 3px; border: 1px solid #d5dce6; color: #5c6b73; background: #f7fbfc; white-space: nowrap; }
  .selo.ok { color: #1e7f4f; border-color: #1e7f4f; background: #fff; }
  .selo.alerta { color: #b7791f; border-color: #ffb830; background: #fff7df; }
  .selo.erro { color: #b42318; border-color: #b42318; background: #fff; }
  .txt-ok { color: #1e7f4f; } .txt-alerta { color: #b7791f; } .txt-erro { color: #b42318; } .txt-cinza { color: #5c6b73; }

  /* ── Paginação: quebra forçada, "não separar do próximo" e "fica com o anterior" ── */
  .quebra { break-before: page; page-break-before: always; }
  .junto { break-after: avoid; page-break-after: avoid; break-inside: avoid; page-break-inside: avoid; }
  .km-com-anterior { break-before: avoid; page-break-before: avoid; break-inside: avoid; page-break-inside: avoid; } /* .km-assinaturas já se comporta assim no visualizador */
`;

/* Compatibilidade: os templates antigos importam KM_PDF_CSS — passa a ser o mesmo CSS. */
export const KM_PDF_CSS = KM_DOC_CSS;

/* @page + regras de impressão. Os templates incluem no <style>; quem precisa de outro papel
   acrescenta o próprio "@page { size: A4 landscape }" ou "@page { size: A6 }" DEPOIS. */
export const KM_PDF_PAGE_CSS = `
  @page { size: A4 portrait; margin: 12mm 10mm; }
  @media print { body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  h1, h2, h3, h4, .sec, .junto { break-after: avoid; page-break-after: avoid; }
  tr, .kpi, .kpis, .bloco, .nota, .fotos > *, img, figure, .km-header, .km-continua, .km-footer, .km-assinaturas, .grade-dados { break-inside: avoid; page-break-inside: avoid; }
  .quebra { break-before: page; page-break-before: always; }
`;

/* ─────────────────────────── utilidades ─────────────────────────── */
const esc = v => String(v ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const semEmoji = s => String(s ?? "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim();
const fmtDataHora = (d = new Date()) => {
  const p = n => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fmtNumeroDoc = numero => (numero === null || numero === undefined || numero === "") ? "" : (typeof numero === "number" ? String(numero).padStart(3, "0") : String(numero));
const LOCKUP = `<span class="km-lockup">KM<span>ZERO</span></span>`;

/* Dados da EMPRESA CLIENTE nos documentos (RDO, relatórios, PDFs). Nunca completa com
   dados da KM Consultoria: o KMZERO é vendido para várias empresas e cada documento
   leva só o que a própria empresa cadastrou em Sistema → Empresa. Campo vazio = omitido. */
export const nomeEmpresa = (empresa = {}) => String(empresa.razaoSocial || empresa.nomeFantasia || "").trim();
/* Cada dado vira um <span class="km-dado"> indivisível (CNPJ, registro, telefone nunca quebram no meio);
   { texto: true } marca os que podem quebrar em várias linhas (endereço, nome do responsável, e-mail). */
const juntarDados = partes => partes
  .map(p => (p && typeof p === "object") ? { v: String(p.v || "").trim(), texto: !!p.texto } : { v: String(p || "").trim(), texto: false })
  .filter(p => p.v)
  .map(p => `<span class="km-dado${p.texto ? " km-dado-texto" : ""}">${esc(p.v)}</span>`)
  .join(" · ");
export function linhasEmpresaHTML(empresa = {}) {
  const linhas = [
    nomeEmpresa(empresa) ? `<b>${esc(nomeEmpresa(empresa))}</b>` : "",
    juntarDados([empresa.cnpj ? "CNPJ " + empresa.cnpj : "", { v: empresa.responsavel, texto: true }, empresa.registro]),
    juntarDados([{ v: empresa.email, texto: true }, empresa.telefone]),
  ].filter(Boolean);
  return linhas.join("<br/>");
}
/* Só as linhas de contato (sem o nome, que o cabeçalho já destaca) */
function linhasContatoEmpresaHTML(empresa = {}) {
  return [
    juntarDados([empresa.cnpj ? "CNPJ " + empresa.cnpj : "", { v: empresa.responsavel, texto: true }, empresa.registro]),
    juntarDados([{ v: empresa.endereco, texto: true }, { v: empresa.email, texto: true }, empresa.telefone]),
  ].filter(Boolean).join("<br/>");
}
const logoEmpresaHTML = (empresa = {}) => {
  const src = empresa.logo || empresa.logoBase64 || "";
  return src ? `<img src="${esc(src)}" alt="" />` : "";
};

/* ═══ CABEÇALHO ═══
   gerarHeaderHTML({ tipo, numero, empresa, periodo, info_extra, subtitulo, compacto, emitido })
   - empresa em destaque (nome + linhas), tipo do documento, Nº e/ou período, "emitido em", lockup do produto.
   - compacto: true → duas linhas (A6 / documentos curtos).
   Os data-* alimentam o cabeçalho de continuação e o rodapé do visualizador. */
export function gerarHeaderHTML({ tipo, numero, empresa = {}, periodo, info_extra, subtitulo, compacto = false, emitido } = {}) {
  const tipoTxt = semEmoji(tipo || "Documento");
  const numeroTxt = fmtNumeroDoc(numero);
  const periodoTxt = String(periodo || "").trim();
  const emitidoTxt = emitido || fmtDataHora();
  const nome = nomeEmpresa(empresa);
  const linhaNum = [numeroTxt ? "Nº " + esc(numeroTxt) : "", periodoTxt ? esc(periodoTxt) : ""].filter(Boolean).join(" · ");
  const sub = [subtitulo, info_extra].map(s => String(s || "").trim()).filter(Boolean).map(esc).join(" · ");
  const dados = `class="km-header${compacto ? " compacto" : ""}" data-tipo="${esc(tipoTxt)}" data-numero="${esc(numeroTxt)}" data-periodo="${esc(periodoTxt)}" data-empresa="${esc(nome)}" data-emitido="${esc(emitidoTxt)}"`;
  if (compacto) {
    return `
    <div ${dados}>
      <div class="km-header-linha"><span class="km-empresa-nome">${esc(nome) || "&nbsp;"}</span>${LOCKUP}</div>
      ${linhasContatoEmpresaHTML(empresa) ? `<div class="km-empresa-linhas">${linhasContatoEmpresaHTML(empresa)}</div>` : ""}
      <div class="km-header-linha"><span class="km-doc-tipo">${esc(tipoTxt)}</span>${linhaNum ? `<span class="km-doc-num">${linhaNum}</span>` : ""}</div>
      <div class="km-doc-sub">${sub ? sub + " · " : ""}Emitido em <span class="km-emitido">${esc(emitidoTxt)}</span></div>
    </div>`;
  }
  return `
    <div ${dados}>
      <div class="km-header-empresa">
        ${logoEmpresaHTML(empresa)}
        <div>
          ${nome ? `<div class="km-empresa-nome">${esc(nome)}</div>` : ""}
          ${linhasContatoEmpresaHTML(empresa) ? `<div class="km-empresa-linhas">${linhasContatoEmpresaHTML(empresa)}</div>` : ""}
        </div>
      </div>
      <div class="km-header-doc">
        <div class="km-doc-tipo">${esc(tipoTxt)}</div>
        ${linhaNum ? `<div class="km-doc-num">${linhaNum}</div>` : ""}
        ${sub ? `<div class="km-doc-sub">${sub}</div>` : ""}
      </div>
      <div class="km-header-meta">
        <span class="rotulo">Emitido em</span>
        <span class="km-emitido">${esc(emitidoTxt)}</span>
        ${LOCKUP.replace("</span>", "</span><small>Gestão de obras</small>")}
      </div>
    </div>`;
}

/* ═══ RODAPÉ ═══  empresa · documento · Página N de M · emitido em · Sistema KMZERO
   No visualizador o rodapé é repetido em todas as páginas e "Página N de M" é preenchido depois de paginar. */
export function gerarFooterHTML({ empresa = {}, autor, documento, emitido, pagina, total } = {}) {
  const nome = nomeEmpresa(empresa);
  const emitidoTxt = emitido || fmtDataHora();
  const esq = [nome ? `<b>${esc(nome)}</b>` : "", documento ? esc(documento) : "", autor ? esc(autor) : ""].filter(Boolean).join(" · ");
  const pag = `Página ${pagina || 1} de ${total || 1}`;
  return `
    <div class="km-footer" data-empresa="${esc(nome)}" data-autor="${esc(autor || "")}" data-documento="${esc(documento || "")}" data-emitido="${esc(emitidoTxt)}">
      <span class="km-footer-esq">${esq || "&nbsp;"}</span>
      <span class="km-footer-pag">${pag}</span>
      <span class="km-footer-dir">Emitido em ${esc(emitidoTxt)} · Sistema ${LOCKUP}</span>
    </div>`;
}

/* ═══ ASSINATURAS ═══  padrão: responsável (autor ou empresa.responsavel) + fiscalização.
   assinantes: [{ nome, cargo }] substitui os blocos padrão. */
export function gerarAssinaturasHTML({ empresa = {}, autor, assinantes } = {}) {
  const lista = Array.isArray(assinantes) && assinantes.length ? assinantes : [
    { nome: autor || empresa.responsavel || "", cargo: "Responsável técnico" + (empresa.registro ? " · " + empresa.registro : "") },
    { nome: "Fiscalização", cargo: "Visto / Carimbo" },
  ];
  return `
    <div class="km-assinaturas">
      ${lista.map(a => `<div class="ass"><b>${esc(a.nome) || "&nbsp;"}</b><span>${esc(a.cargo || "")}</span></div>`).join("")}
    </div>`;
}

/* ════════════════════════════════════════════════════
   FORMATAR QUANTIDADE — padrão brasileiro com 2 casas
   Ex: 5 → "5,00" | 2.5 → "2,50" | "10kg" → "10,00 kg"
   Separa o número da unidade pra formatar só o número
══════════════════════════════════════════════════════ */
export function fmtQtd(qtd) {
  if (qtd === null || qtd === undefined || qtd === "") return "—";
  const str = String(qtd).trim();

  // Tenta extrair número + unidade (ex: "10 kg", "2.5m³", "100un")
  const match = str.match(/^([\d.,]+)\s*(.*)$/);
  if (!match) return str; // não é número, retorna como veio

  const numStr = match[1].replace(",", "."); // 10,5 → 10.5
  const unidade = match[2].trim();
  const num = parseFloat(numStr);

  if (isNaN(num)) return str; // não conseguiu converter

  // Formata em padrão BR: 2 casas decimais com vírgula
  const formatado = num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return unidade ? `${formatado} ${unidade}` : formatado;
}

/* ═══ SVG em data-URI sem tamanho intrínseco ═══
   html2canvas 1.4.1 usa img.naturalWidth/naturalHeight (300×150 num SVG só com viewBox) como recorte de
   origem no drawImage, e a imagem sai cortada no PDF. Se a raiz <svg> não tiver width/height, injeta os
   dois a partir do viewBox (padrão 800×600) e reencoda. Outros src voltam como vieram.
   gerarBlobPDF aplica isso sozinho em todas as <img> do documento; os templates podem usar
   diretamente (ex.: normalizarSvgDataUri(foto.src)) quando quiserem o mesmo no HTML bruto. */
export function normalizarSvgDataUri(src) {
  src = String(src || "");
  const m = /^data:image\/svg\+xml(;[^,]*)?,/i.exec(src);
  if (!m) return src;
  const cab = m[0], corpo = src.slice(cab.length), b64 = /;base64/i.test(cab);
  let svg;
  try { svg = b64 ? new TextDecoder().decode(Uint8Array.from(atob(corpo), c => c.charCodeAt(0))) : decodeURIComponent(corpo); } catch { return src; }
  const raiz = /<svg\b[^>]*>/i.exec(svg);
  if (!raiz) return src;
  const semW = !/\swidth\s*=/i.test(raiz[0]), semH = !/\sheight\s*=/i.test(raiz[0]);
  if (!semW && !semH) return src;
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(raiz[0]);
  const w = vb ? vb[1] : "800", h = vb ? vb[2] : "600";
  const novaRaiz = raiz[0].replace(/<svg\b/i, `<svg${semW ? ` width="${w}"` : ""}${semH ? ` height="${h}"` : ""}`);
  const novo = svg.replace(raiz[0], () => novaRaiz);
  try {
    if (!b64) return cab + encodeURIComponent(novo);
    let bin = ""; new TextEncoder().encode(novo).forEach(b => { bin += String.fromCharCode(b); });
    return cab + btoa(bin);
  } catch { return src; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   VISUALIZADOR PAGINADO
═══════════════════════════════════════════════════════════════════════════ */

/* Papéis: dimensões em mm e padding das páginas */
const PAPEIS = {
  a4: { id: "a4", largura: 210, altura: 297, padding: "12mm 14mm", page: "A4 portrait", jspdf: ["p", "a4"] },
  a4p: { id: "a4p", largura: 297, altura: 210, padding: "10mm 12mm", page: "A4 landscape", jspdf: ["l", "a4"] },
  a6: { id: "a6", largura: 105, altura: 148, padding: "5mm", page: "A6 portrait", jspdf: ["p", "a6"] },
};
const detectarPapel = html => (/size:\s*A6\b/i.test(html) ? PAPEIS.a6 : (/size:\s*A4\s+landscape/i.test(html) ? PAPEIS.a4p : PAPEIS.a4));

/* px por mm, medido no navegador */
const pxPorMM = () => {
  try {
    const d = document.createElement("div");
    d.style.cssText = "position:absolute;visibility:hidden;width:100mm;height:0;padding:0;border:0;";
    document.body.appendChild(d);
    const px = d.getBoundingClientRect().width / 100;
    d.remove();
    return px > 0 ? px : 3.7795;
  } catch { return 3.7795; }
};

/* ── Escopo do CSS do template pelo CSSOM ──
   Reescreve cada seletor prefixando o escopo (#km-doc-page); "body"/"html" viram ".km-pagina"/escopo;
   descarta @page, @font-face e @import; mantém @media/@supports (recursivo) e @keyframes. */
export function escoparCSS(css, escopo = "#km-doc-page") {
  if (!css || !String(css).trim()) return "";
  const reescrever = sel => String(sel).split(/,(?![^(]*\))/).map(s => {
    s = s.trim();
    if (!s) return "";
    if (/^html$/i.test(s) || /^:root$/i.test(s)) return escopo;
    s = s.replace(/^html\s+body\b/i, "body").replace(/^:root\s+body\b/i, "body");
    if (/^body\b/i.test(s)) return escopo + " " + s.replace(/^body/i, ".km-pagina");
    if (s === "*") return escopo + " *";
    return escopo + " " + s;
  }).filter(Boolean).join(", ");
  const percorrer = (regras, saida) => {
    for (const r of regras) {
      const tipo = r.type;
      if (tipo === 1) { saida.push(`${reescrever(r.selectorText)} { ${r.style.cssText} }`); continue; }          // regra comum
      if (tipo === 4) { const d = []; percorrer(r.cssRules, d); if (d.length) saida.push(`@media ${r.conditionText || r.media.mediaText} { ${d.join("\n")} }`); continue; } // @media
      if (tipo === 12) { const d = []; percorrer(r.cssRules, d); if (d.length) saida.push(`@supports ${r.conditionText} { ${d.join("\n")} }`); continue; } // @supports
      if (tipo === 3 || tipo === 5 || tipo === 6) continue;                                                        // @import, @font-face, @page
      if (tipo === 7 || tipo === 8) { saida.push(r.cssText); continue; }                                           // @keyframes
      if (r.cssRules && r.cssRules.length) { const d = []; percorrer(r.cssRules, d); if (d.length) saida.push(d.join("\n")); continue; }
      if (r.cssText && !/^@(page|font-face|import)/i.test(r.cssText)) saida.push(r.cssText);
    }
  };
  const st = document.createElement("style");
  st.setAttribute("data-km-escopo-temp", "1");
  st.media = "not all"; // não aplica ao app enquanto é lido
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
  const saida = [];
  try {
    percorrer(st.sheet.cssRules, saida);
  } catch (e) {
    console.warn("[KMZERO documentos] não foi possível escopar o CSS do template:", e);
    st.remove();
    return "";
  }
  st.remove();
  return saida.join("\n");
}

/* CSS do próprio visualizador (fora do escopo dos templates) */
const CSS_VISUALIZADOR = `
  #km-doc-viewer .km-rolagem { flex: 1 1 auto; overflow: auto; padding: 12px; padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px)); -webkit-overflow-scrolling: touch; touch-action: pan-x pan-y pinch-zoom; }
  #km-doc-viewer .km-zoom-caixa { position: relative; margin: 0 auto; }
  #km-doc-page { transform-origin: top left; width: max-content; }
  #km-doc-page .km-pagina { box-shadow: 0 3px 16px rgba(0,0,0,0.45); }
  #km-doc-page.km-capturando .km-pagina { box-shadow: none; }
  #km-doc-page .km-pagina.a6 .km-footer { font-size: 6pt; margin-top: 2mm; }
  #km-doc-page .km-pagina.a6 .km-continua { font-size: 6.5pt; margin-bottom: 4px; }
  #km-doc-page .km-parte { min-height: 0 !important; height: auto !important; max-height: none !important; }
  #km-doc-viewer .km-barra button { border: none; border-radius: 8px; padding: 10px 12px; font-family: Inter, Arial, sans-serif; font-weight: 800; font-size: 13px; color: #fff; cursor: pointer; }
  #km-doc-viewer .km-barra button:disabled { opacity: 0.7; cursor: wait; }
`;

/* CSS da janela de impressão: cada .km-pagina é exatamente uma folha */
const cssImpressao = papel => `
  @page { size: ${papel.largura}mm ${papel.altura}mm; margin: 0; } /* em mm: "A6" não é palavra-chave válida de @page */
  html, body { margin: 0; padding: 0; background: #fff; }
  #km-doc-page { transform: none !important; width: auto !important; margin: 0 !important; }
  #km-doc-page .km-pagina { margin: 0 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
  #km-doc-page .km-pagina:last-child { break-after: auto; page-break-after: auto; }
  #km-doc-page .km-pagina * { break-before: auto !important; break-after: auto !important; break-inside: auto !important; page-break-before: auto !important; page-break-after: auto !important; page-break-inside: auto !important; }
  #km-doc-page .km-parte { min-height: 0 !important; height: auto !important; max-height: none !important; }
  #km-doc-page .km-pagina.a6 .km-footer { font-size: 6pt; margin-top: 2mm; }
  #km-doc-page .km-pagina.a6 .km-continua { font-size: 6.5pt; margin-bottom: 4px; }
`;

/* ── Metadados do documento (para continuação e rodapé) ──
   Fonte: data-* do .km-header (gerarHeaderHTML), o .km-footer do template (removido do fluxo),
   window.__kmzeroDocumentoMeta (se o template definir) e o 3º parâmetro de abrirOuBaixarHTML. */
function extrairMeta(fonte, extra) {
  const texto = el => (el ? semEmoji(el.textContent) : "");
  const meta = { tipo: "", numero: "", periodo: "", empresa: "", empresaObj: null, emitido: fmtDataHora(), autor: "", subtitulo: "", documentoTemplate: "" };
  const h = fonte.querySelector(".km-header");
  if (h) {
    meta.tipo = h.dataset.tipo || texto(h.querySelector(".km-doc-tipo"));
    meta.numero = h.dataset.numero || "";
    meta.periodo = h.dataset.periodo || "";
    meta.empresa = h.dataset.empresa || texto(h.querySelector(".km-empresa-nome"));
    meta.emitido = h.dataset.emitido || texto(h.querySelector(".km-emitido")) || meta.emitido;
  } else {
    const h1 = fonte.querySelector("h1");
    if (h1) meta.tipo = texto(h1);
  }
  fonte.querySelectorAll(".km-footer").forEach(f => {
    meta.empresa = meta.empresa || f.dataset.empresa || "";
    meta.autor = meta.autor || f.dataset.autor || "";
    meta.documentoTemplate = meta.documentoTemplate || semEmoji(f.dataset.documento || "");
    if (f.dataset.emitido) meta.emitido = f.dataset.emitido;
    f.remove(); // o visualizador repõe o rodapé em todas as páginas
  });
  let global = null;
  try { global = window.__kmzeroDocumentoMeta || null; if (global) delete window.__kmzeroDocumentoMeta; } catch {}
  for (const fonteExtra of [global, extra]) {
    if (!fonteExtra || typeof fonteExtra !== "object") continue;
    for (const k of ["tipo", "numero", "periodo", "emitido", "autor", "subtitulo"]) {
      if (fonteExtra[k] !== undefined && fonteExtra[k] !== null && fonteExtra[k] !== "") meta[k] = k === "numero" ? fmtNumeroDoc(fonteExtra[k]) : String(fonteExtra[k]);
    }
    if (fonteExtra.empresa && typeof fonteExtra.empresa === "object") { meta.empresaObj = fonteExtra.empresa; meta.empresa = nomeEmpresa(fonteExtra.empresa) || meta.empresa; }
    else if (fonteExtra.empresa) meta.empresa = String(fonteExtra.empresa);
  }
  meta.tipo = semEmoji(meta.tipo);
  meta.referencia = [meta.numero ? "Nº " + meta.numero : "", meta.periodo].filter(Boolean).join(" · ");
  // rodapé: o "documento" que o template passou a gerarFooterHTML; senão tipo + Nº (o período fica no cabeçalho e na continuação)
  meta.documento = meta.documentoTemplate || [meta.tipo, meta.numero ? "Nº " + meta.numero : ""].filter(Boolean).join(" ");
  return meta;
}

/* Template sem .km-header: o primeiro <h1> DE PRIMEIRO NÍVEL vira um cabeçalho mínimo (e sai do fluxo).
   h1 aninhado em outro bloco só alimenta a continuação e o rodapé. */
function prepararCabecalhoMinimo(fonte, meta) {
  if (fonte.querySelector(".km-header")) return;
  const h1 = fonte.querySelector("h1");
  if (!h1 || h1.parentNode !== fonte) return;
  const empresa = meta.empresaObj || (meta.empresa ? { razaoSocial: meta.empresa } : {});
  const tmp = document.createElement("div");
  tmp.innerHTML = gerarHeaderHTML({ tipo: meta.tipo || semEmoji(h1.textContent), numero: meta.numero, periodo: meta.periodo, empresa, subtitulo: meta.subtitulo, emitido: meta.emitido });
  const cab = tmp.querySelector(".km-header");
  if (cab) h1.replaceWith(cab);
}

/* Cabeçalho de continuação: tipo · Nº/período · empresa · continuação. No A6 a empresa sai (já está no rodapé de toda página). */
function montarContinua(meta, papel = PAPEIS.a4) {
  const d = document.createElement("div");
  d.className = "km-continua";
  const curto = papel.id === "a6";
  const partes = [meta.tipo ? `<b>${esc(meta.tipo)}</b>` : "", meta.referencia ? esc(meta.referencia) : "", meta.empresa && !curto ? esc(meta.empresa) : "", "continuação"].filter(Boolean);
  d.innerHTML = `<span>${partes.join(" · ")}</span><span>${LOCKUP}</span>`;
  return d;
}

/* Rodapé: empresa · documento | Página N de M | Emitido em … · Sistema KMZERO.
   No A6: empresa · Nº | Página N de M | Sistema KMZERO (a hora de emissão já está no cabeçalho). */
function montarFooter(meta, papel) {
  const d = document.createElement("div");
  const curto = papel.id === "a6";
  const esq = [meta.empresa ? `<b>${esc(meta.empresa)}</b>` : "", curto ? (meta.numero ? "Nº " + esc(meta.numero) : "") : (meta.documento ? esc(meta.documento) : "")].filter(Boolean).join(" · ");
  d.innerHTML = `
    <div class="km-footer" data-empresa="${esc(meta.empresa)}" data-documento="${esc(meta.documento)}" data-emitido="${esc(meta.emitido)}">
      <span class="km-footer-esq">${esq || "&nbsp;"}</span>
      <span class="km-footer-pag">Página 1 de 1</span>
      <span class="km-footer-dir">${curto ? "" : "Emitido em " + esc(meta.emitido) + " · "}Sistema ${LOCKUP}</span>
    </div>`;
  return d.firstElementChild;
}

/* ── O paginador ──
   Distribui os blocos de primeiro nível da fonte em páginas reais, medindo no DOM.
   - bloco que cabe entra; que não cabe vai para a próxima página;
   - tabela maior que o espaço é dividida por linhas (thead clonado; tr.total junto da anterior; mínimo 1 linha);
   - contêiner (div/section…) maior que o espaço é ABERTO: filhos viram blocos dentro de um clone do contêiner por página;
   - títulos (.sec, h1-h4, .junto) nunca ficam por último na página; .quebra força nova página;
   - .km-assinaturas (ou .km-com-anterior) que não cabe leva junto o último bloco da página (se ele tiver
     menos de 60 mm e a página não ficar vazia), para não abrir uma página só com as assinaturas;
   - bloco indivisível maior que uma página fica sozinho (aviso no console). */
function paginarDocumento({ raiz, fonte, papel, meta, classesPagina = [] }) {
  const TOL = pxPorMM() * 2;
  const ALTURA_LEVAR = pxPorMM() * 60; // bloco de até 60 mm acompanha as assinaturas para a página seguinte
  const TAGS_FOLHA = new Set(["TABLE", "IMG", "SVG", "CANVAS", "VIDEO", "IFRAME", "HR", "BR", "INPUT", "BUTTON", "SELECT", "TEXTAREA", "PRE", "THEAD", "TBODY", "TFOOT", "TR", "FIGURE"]);
  const paginas = [];
  let atual = null;

  const novaPagina = () => {
    const pg = document.createElement("div");
    pg.className = ["km-pagina", papel.id, ...classesPagina].join(" ");
    pg.dataset.pagina = String(paginas.length + 1);
    // geometria inline: vence qualquer "body { max-width / padding / margin }" do template (que vira .km-pagina)
    pg.style.cssText = `width:${papel.largura}mm;min-width:${papel.largura}mm;max-width:${papel.largura}mm;height:${papel.altura}mm;min-height:${papel.altura}mm;max-height:${papel.altura}mm;padding:${papel.padding};margin:0 auto 12px;box-sizing:border-box;overflow:hidden;background:#fff;position:relative;display:flex;flex-direction:column;float:none;transform:none;`;
    const corpo = document.createElement("div");
    corpo.className = "km-pagina-corpo";
    corpo.style.cssText = "flex:1 1 0;min-height:0;position:relative;";
    if (paginas.length) corpo.appendChild(montarContinua(meta, papel));
    const rodape = montarFooter(meta, papel);
    rodape.style.flex = "0 0 auto";
    pg.appendChild(corpo);
    pg.appendChild(rodape);
    raiz.appendChild(pg);
    const p = { el: pg, corpo, rodape, mapa: new Map(), blocos: [] };
    paginas.push(p);
    return p;
  };
  const descartarPaginaVazia = p => { // página que ficou vazia (todos os blocos migraram para a próxima)
    if (!p || p.blocos.length) return;
    p.el.remove();
    const i = paginas.indexOf(p);
    if (i >= 0) paginas.splice(i, 1);
  };
  const limite = p => p.corpo.getBoundingClientRect().bottom + TOL;
  const alvoPara = (p, item) => {
    let pai = p.corpo;
    for (const anc of item.cadeia) {
      let clone = p.mapa.get(anc);
      if (!clone) {
        clone = anc.cloneNode(false);
        clone.classList.add("km-parte");
        if (anc.tagName === "OL" && item.indiceLista) clone.setAttribute("start", String((parseInt(anc.getAttribute("start"), 10) || 1) + item.indiceLista));
        pai.appendChild(clone);
        p.mapa.set(anc, clone);
      }
      pai = clone;
    }
    return pai;
  };
  const topoDe = (p, item) => (item.cadeia.length ? p.mapa.get(item.cadeia[0]) : item.el);
  const cabe = (p, item) => {
    const el = topoDe(p, item);
    if (!el) return true;
    const r = el.getBoundingClientRect();
    if (!r.height) return true;
    return r.bottom <= limite(p);
  };
  const removerItem = (p, item) => {
    item.el.remove();
    const i = p.blocos.lastIndexOf(item);
    if (i >= 0) p.blocos.splice(i, 1);
    for (let k = item.cadeia.length - 1; k >= 0; k--) {
      const anc = item.cadeia[k];
      const clone = p.mapa.get(anc);
      if (clone && !clone.childNodes.length) { clone.remove(); p.mapa.delete(anc); }
    }
  };
  const ehTitulo = el => el.nodeType === 1 && (el.matches("h1, h2, h3, h4, .sec, .junto") || /avoid/.test(getComputedStyle(el).breakAfter));
  const exigeQuebra = el => el.nodeType === 1 && (el.classList.contains("quebra") || /page|always|left|right/.test(getComputedStyle(el).breakBefore));
  const podeAbrir = el => {
    if (el.nodeType !== 1 || TAGS_FOLHA.has(el.tagName) || el.classList.contains("km-solto")) return false;
    const cs = getComputedStyle(el);
    if (/avoid/.test(cs.breakInside) || cs.position === "absolute" || cs.position === "fixed" || cs.display === "none") return false;
    // linha flex horizontal (filhos lado a lado) é indivisível: abrir separaria as colunas entre páginas
    if (/flex/.test(cs.display) && /^row/.test(cs.flexDirection) && cs.flexWrap === "nowrap") return false;
    const uteis = [...el.childNodes].filter(n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim()));
    if (!uteis.length) return false;
    if (uteis.length === 1 && uteis[0].nodeType === 3) return false;
    return true;
  };
  const abrir = item => {
    const el = item.el;
    const filhos = [];
    let li = 0;
    for (const n of [...el.childNodes]) {
      if (n.nodeType === 3) {
        if (!n.textContent.trim()) continue;
        const s = document.createElement("span");
        s.className = "km-solto";
        s.textContent = n.textContent;
        filhos.push({ el: s, cadeia: [...item.cadeia, el] });
        continue;
      }
      if (n.nodeType !== 1) continue;
      const f = { el: n, cadeia: [...item.cadeia, el] };
      if (n.tagName === "LI") f.indiceLista = li++;
      filhos.push(f);
    }
    return filhos;
  };
  const retirarOrfaos = p => {
    const orfaos = [];
    while (p.blocos.length) {
      const ultimo = p.blocos[p.blocos.length - 1];
      if (!ehTitulo(ultimo.el)) break;
      removerItem(p, ultimo);
      ultimo.orfaoMovido = true;
      orfaos.unshift(ultimo);
    }
    return orfaos;
  };
  const temConteudo = p => p.blocos.some(b => !b.orfaoMovido);
  const ficaComAnterior = el => el.nodeType === 1 && (el.classList.contains("km-assinaturas") || el.classList.contains("km-com-anterior"));
  /* Assinaturas (ou .km-com-anterior) que não couberam: leva também o último bloco de conteúdo da página,
     se for curto (< 60 mm) e sobrar conteúdo na página; devolve os itens a repor na fila, na ordem. */
  const levarAnterior = p => {
    const conteudo = p.blocos.filter(b => !b.orfaoMovido && !ehTitulo(b.el));
    if (conteudo.length < 2) return [];
    const ultimo = p.blocos[p.blocos.length - 1];
    if (!ultimo || ultimo.orfaoMovido || ehTitulo(ultimo.el)) return [];
    const h = ultimo.el.getBoundingClientRect().height;
    if (!h || h >= ALTURA_LEVAR) return [];
    removerItem(p, ultimo);
    const orfaos = retirarOrfaos(p);
    return [...orfaos, ultimo];
  };

  /* Divide a tabela pelas linhas que cabem. Devolve true se colocou uma parte (o resto volta para a fila). */
  const dividirTabela = (p, item, fresca, fila) => {
    const tabela = item.el;
    const corpos = [...tabela.tBodies];
    const linhas = corpos.flatMap(tb => [...tb.rows]);
    const cabecalhoSintetico = [];
    if (!tabela.tHead) while (linhas.length && linhas[0].cells.length && [...linhas[0].cells].every(c => c.tagName === "TH")) cabecalhoSintetico.push(linhas.shift());
    if (linhas.length < 2 && !fresca) return false;
    const pai = alvoPara(p, item);
    pai.appendChild(tabela);
    p.blocos.push(item);
    const lim = limite(p);
    let k = 0;
    for (const tr of linhas) { if (tr.getBoundingClientRect().bottom <= lim) k++; else break; }
    if (k > 0 && k < linhas.length && linhas[k].classList.contains("total")) k--;
    if (k >= linhas.length) return true; // coube (ex.: tfoot é que estourava)
    if (k < 1) {
      if (!fresca) { removerItem(p, item); return false; }
      k = 1;
      console.warn("[KMZERO documentos] linha de tabela maior que a página; seguiu cortada:", linhas[0]);
    }
    // monta o resto: clone da tabela + caption/colgroup/thead clonados + linhas restantes (movidas)
    const resto = tabela.cloneNode(false);
    resto.classList.add("km-continuacao");
    for (const filho of [...tabela.children]) if (filho.tagName === "CAPTION" || filho.tagName === "COLGROUP" || filho.tagName === "THEAD") resto.appendChild(filho.cloneNode(true));
    if (cabecalhoSintetico.length) {
      const tb = document.createElement("tbody");
      tb.className = "km-cabecalho-repetido";
      cabecalhoSintetico.forEach(tr => tb.appendChild(tr.cloneNode(true)));
      resto.appendChild(tb);
    }
    const origemDe = new Map(linhas.map(tr => [tr, tr.parentElement]));
    const clonesTbody = new Map();
    const tbodyDestino = tbOrig => {
      let c = clonesTbody.get(tbOrig);
      if (!c) { c = tbOrig.cloneNode(false); clonesTbody.set(tbOrig, c); resto.appendChild(c); }
      return c;
    };
    for (let i = k; i < linhas.length; i++) tbodyDestino(origemDe.get(linhas[i])).appendChild(linhas[i]);
    if (tabela.tFoot) resto.appendChild(tabela.tFoot);
    corpos.forEach(tb => { if (!tb.rows.length) tb.remove(); });
    // confere a parte que ficou (larguras podem mudar sem table-layout fixed); recua linhas se preciso
    let guarda = 0;
    while (k > 0 && !cabe(p, item) && guarda++ < 200) {
      const tr = linhas[k - 1];
      const destino = tbodyDestino(origemDe.get(tr));
      destino.insertBefore(tr, destino.firstChild);
      corpos.forEach(tb => { if (!tb.rows.length) tb.remove(); });
      k--;
    }
    if (k < 1) {
      if (fresca) { // não há como caber nem 1 linha: fica com 1 cortada
        const tr = linhas[0];
        const tbOrig = origemDe.get(tr);
        if (!tbOrig.parentNode) tabela.insertBefore(tbOrig, tabela.tFoot || null);
        tbOrig.appendChild(tr);
        k = 1;
      } else {
        // desfaz: devolve as linhas às tabelas de origem, na ordem original
        for (const [tbOrig, c] of clonesTbody) [...c.rows].forEach(tr => tbOrig.appendChild(tr));
        corpos.forEach(tb => tabela.appendChild(tb));
        if (resto.tFoot) tabela.appendChild(resto.tFoot);
        removerItem(p, item);
        return false;
      }
    }
    fila.unshift({ el: resto, cadeia: item.cadeia, continuacao: true });
    return true;
  };

  /* Fila inicial: os nós de primeiro nível da fonte */
  const fila = [];
  for (const n of [...fonte.childNodes]) {
    if (n.nodeType === 3) {
      if (!n.textContent.trim()) continue;
      const s = document.createElement("span"); s.className = "km-solto"; s.textContent = n.textContent;
      fila.push({ el: s, cadeia: [] });
    } else if (n.nodeType === 1) fila.push({ el: n, cadeia: [] });
  }

  let guardaLaco = 0;
  while (fila.length) {
    if (++guardaLaco > 20000) { console.error("[KMZERO documentos] paginação interrompida (laço)"); break; }
    const item = fila.shift();
    const el = item.el;
    if (!atual) atual = novaPagina();
    const tinhaConteudo = temConteudo(atual);
    const pai = alvoPara(atual, item);
    pai.appendChild(el);
    atual.blocos.push(item);
    // quebra forçada (.quebra ou break-before: page) com conteúdo na página → próxima página
    if (!item.jaQuebrou && tinhaConteudo && exigeQuebra(el)) {
      item.jaQuebrou = true;
      removerItem(atual, item);
      fila.unshift(item);
      atual = null;
      continue;
    }
    if (cabe(atual, item)) continue;

    // não coube: decide enquanto ainda está no DOM (estilos computados)
    const ehTabela = el.nodeType === 1 && el.tagName === "TABLE";
    const abrivel = !ehTabela && podeAbrir(el);
    removerItem(atual, item);
    const fresca = !temConteudo(atual);

    if (ehTabela) {
      if (dividirTabela(atual, item, fresca, fila)) { atual = null; continue; }
      if (fresca) { // tabela sem linhas para dividir e maior que a página: fica sozinha
        alvoPara(atual, item).appendChild(el);
        atual.blocos.push(item);
        console.warn("[KMZERO documentos] tabela maior que a página, sem linhas para dividir:", el);
        atual = null;
        continue;
      }
    } else if (abrivel) {
      fila.unshift(...abrir(item));
      continue;
    } else if (fresca) {
      alvoPara(atual, item).appendChild(el);
      atual.blocos.push(item);
      console.warn("[KMZERO documentos] bloco indivisível maior que a página; ficou sozinho (cortado):", el);
      atual = null;
      continue;
    }
    // vai para a próxima página, levando títulos órfãos do fim desta (e, para assinaturas, o último bloco curto)
    const orfaos = retirarOrfaos(atual);
    const anteriores = ficaComAnterior(el) ? levarAnterior(atual) : [];
    fila.unshift(...anteriores, ...orfaos, item);
    descartarPaginaVazia(atual);
    atual = null;
  }

  if (!paginas.length) novaPagina(); // documento vazio: ainda assim uma página (com rodapé)

  // numera os rodapés
  const total = paginas.length;
  paginas.forEach((p, i) => {
    p.el.dataset.pagina = String(i + 1);
    const pag = p.el.querySelector(".km-footer-pag");
    if (pag) pag.textContent = `Página ${i + 1} de ${total}`;
  });
  return paginas.map(p => p.el);
}

export async function abrirOuBaixarHTML(html, filename = "documento", opcoes = {}) {
  try {
    // Conferência automatizada (demo/testes): o último documento gerado fica acessível ao robô de captura
    try { window.__kmzeroUltimoDocumento = { html, filename, quando: Date.now() }; } catch {}
    const papel = detectarPapel(html);

    // Remove visualizador anterior (devolvendo a rolagem do app)
    const existente = document.getElementById("km-doc-viewer");
    if (existente) { try { existente.__kmFechar?.(); } catch {} existente.remove(); }

    // Trava a rolagem do app enquanto o visualizador (tela cheia) está aberto; devolve ao fechar
    const rolagemAnterior = { x: window.scrollX, y: window.scrollY, html: document.documentElement.style.overflow, body: document.body.style.overflow };
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    try { window.scrollTo(0, 0); } catch {}
    const devolverRolagem = () => {
      document.documentElement.style.overflow = rolagemAnterior.html;
      document.body.style.overflow = rolagemAnterior.body;
      try { window.scrollTo(rolagemAnterior.x, rolagemAnterior.y); } catch {}
    };

    // Extrai <style> e <body> do HTML do template. Os blocos <script>/<style>/<head> saem ANTES de procurar
    // o <body>: um comentário de CSS com "<body>" dentro não confunde a busca.
    const estilosTemplate = [...String(html).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join("\n");
    const semCabecalho = String(html)
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<head[\s\S]*?<\/head>/gi, "");
    const matchBody = semCabecalho.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
    // classes do <body> do template (ex.: <body class="folha">) passam para cada .km-pagina: CSS escopado por elas continua valendo
    const classesBody = matchBody ? (String(matchBody[1]).match(/\bclass\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i) || [])
      .slice(2).filter(Boolean).join(" ").split(/\s+/).filter(c => c && !/^(a4|a4p|a6|km-pagina)$/.test(c)) : [];
    const corpoHTML = (matchBody ? matchBody[2] : semCabecalho)
      .replace(/<\/?(html|body)[^>]*>/gi, "");

    /* ── Moldura do visualizador ── */
    const container = document.createElement("div");
    container.id = "km-doc-viewer";
    container.style.cssText = `
      position: fixed !important; top: 0 !important; left: 0 !important;
      width: 100vw !important; height: 100vh !important;
      background: #3c454b !important; z-index: 2147483647 !important;
      display: flex !important; flex-direction: column !important;
      font-family: Inter, Arial, Helvetica, sans-serif !important;
    `;

    const barra = document.createElement("div");
    barra.className = "km-barra";
    barra.style.cssText = `
      background: #052f3d !important; color: #fff !important;
      padding: 8px 10px !important; padding-top: calc(8px + env(safe-area-inset-top, 0px)) !important;
      display: flex !important; gap: 6px !important; flex-wrap: wrap !important; align-items: center !important;
      flex-shrink: 0 !important; box-shadow: 0 2px 10px rgba(0,0,0,0.35) !important;
    `;
    const botao = (texto, cor, largo) => {
      const b = document.createElement("button");
      b.innerHTML = texto;
      b.style.cssText = `background:${cor};${largo ? "flex:1;min-width:100px;" : ""}`;
      return b;
    };
    const btnBaixar = botao("📥 BAIXAR", "#b42318", true);
    const btnCompartilhar = botao("📤 ENVIAR", "#1e7f4f", true);
    const btnImprimir = botao("🖨️ IMPRIMIR", "#0b7285", true);
    btnImprimir.title = "Imprimir";
    const btnZoomIn = botao("🔍+", "#5c6b73");
    const btnZoomOut = botao("🔍−", "#5c6b73");
    const btnFechar = botao("✕", "#5c6b73");
    barra.append(btnBaixar, btnCompartilhar, btnImprimir, btnZoomIn, btnZoomOut, btnFechar);

    const scrollArea = document.createElement("div");
    scrollArea.className = "km-rolagem";
    const caixaZoom = document.createElement("div");
    caixaZoom.className = "km-zoom-caixa";
    const paginasEl = document.createElement("div");
    paginasEl.id = "km-doc-page";
    caixaZoom.appendChild(paginasEl);
    scrollArea.appendChild(caixaZoom);

    const styleViewer = document.createElement("style");
    styleViewer.textContent = CSS_VISUALIZADOR;
    const styleDoc = document.createElement("style");
    styleDoc.setAttribute("data-km-doc-css", "1");
    const cssEscopado = escoparCSS(KM_DOC_CSS) + "\n" + escoparCSS(estilosTemplate);
    styleDoc.textContent = cssEscopado;
    container.append(styleViewer, styleDoc, barra, scrollArea);
    container.__kmFechar = devolverRolagem;
    document.body.appendChild(container);

    /* ── Fonte do documento e metadados ── */
    const fonte = document.createElement("div");
    fonte.innerHTML = corpoHTML;
    const meta = extrairMeta(fonte, opcoes);
    prepararCabecalhoMinimo(fonte, meta);

    let zoom = 1;
    const aplicarZoom = () => {
      paginasEl.style.transform = zoom === 1 ? "" : `scale(${zoom})`;
      caixaZoom.style.width = Math.ceil(paginasEl.offsetWidth * zoom) + "px";
      caixaZoom.style.height = Math.ceil(paginasEl.offsetHeight * zoom) + "px";
    };
    const paginar = () => {
      paginasEl.innerHTML = "";
      paginasEl.style.transform = "";
      const copia = fonte.cloneNode(true);
      const paginas = paginarDocumento({ raiz: paginasEl, fonte: copia, papel, meta, classesPagina: classesBody });
      try { window.__kmzeroPaginas = paginas.length; } catch {}
      aplicarZoom();
      return paginas;
    };
    paginasEl.style.visibility = "hidden";
    let fontesCarregando = !!(document.fonts && document.fonts.status !== "loaded");
    paginar();
    paginasEl.style.visibility = "";
    fontesCarregando = fontesCarregando || !!(document.fonts && document.fonts.status !== "loaded"); // o layout pode ter pedido fontes novas
    // zoom inicial: cabe na largura da tela (telefone)
    const disponivel = scrollArea.clientWidth - 24;
    if (disponivel > 0 && paginasEl.offsetWidth > disponivel) { zoom = Math.max(0.3, disponivel / paginasEl.offsetWidth); aplicarZoom(); }

    // repagina quando fontes/imagens terminarem de carregar (as alturas mudam)
    const imgsPendentes = [...paginasEl.querySelectorAll("img")].filter(i => !i.complete);
    if (fontesCarregando || imgsPendentes.length) {
      Promise.all([
        document.fonts ? document.fonts.ready : Promise.resolve(),
        ...imgsPendentes.map(i => new Promise(r => { i.addEventListener("load", r, { once: true }); i.addEventListener("error", r, { once: true }); })),
      ]).then(() => { if (container.isConnected) paginar(); }).catch(() => {});
    }

    btnZoomIn.onclick = () => { zoom = Math.min(3, zoom + 0.15); aplicarZoom(); };
    btnZoomOut.onclick = () => { zoom = Math.max(0.3, zoom - 0.15); aplicarZoom(); };
    btnFechar.onclick = () => { container.remove(); devolverRolagem(); };

    /* ── IMPRIMIR: janela com as MESMAS páginas já paginadas ── */
    const montarHTMLImpressao = (comLinkFontes = false) => `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${esc(String(filename).replace(/\.html$/, ""))}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>${comLinkFontes ? `<link rel="stylesheet" href="${KM_DOC_FONTES_URL}">` : ""}
<style>${cssEscopado}\n${cssImpressao(papel)}</style></head><body><div id="km-doc-page">${paginasEl.innerHTML}</div></body></html>`;
    // Conferência automatizada: o mesmo HTML que vai para a janela de impressão
    try { window.__kmzeroHTMLImpressao = () => montarHTMLImpressao(true); } catch {}
    btnImprimir.onclick = () => {
      try {
        const janela = window.open("", "_blank", "width=900,height=700");
        if (!janela) {
          alert("⚠️ Popup bloqueado.\n\nLibere popups deste site nas configurações do navegador para usar a impressão.\n\nAlternativa: toque em 📥 BAIXAR e abra o PDF no aplicativo do celular para imprimir de lá.");
          return;
        }
        janela.document.open();
        janela.document.write(montarHTMLImpressao(false));
        janela.document.close();
        let feito = false;
        const imprimir = () => {
          if (feito) return;
          feito = true;
          setTimeout(() => { try { janela.focus(); janela.print(); } catch (e) { console.error("Erro ao imprimir:", e); } }, 250);
        };
        const esperarImagens = () => Promise.all([...janela.document.images].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
        const esperarFontes = () => {
          const f = janela.document.fonts;
          if (!f) return Promise.resolve();
          return Promise.all(["800 12pt Barlow", "400 9pt Inter", "600 9pt Inter", "700 9pt Inter", "800 9pt Inter"].map(x => f.load(x).catch(() => null))).then(() => f.ready);
        };
        const link = janela.document.createElement("link");
        link.rel = "stylesheet";
        link.href = KM_DOC_FONTES_URL;
        link.onload = link.onerror = () => { Promise.all([esperarFontes(), esperarImagens()]).then(imprimir, imprimir); };
        janela.document.head.appendChild(link);
        setTimeout(imprimir, 5000); // garantia: imprime mesmo se a fonte não vier
      } catch (e) {
        console.error("Erro ao imprimir:", e);
        alert("⚠️ Não foi possível abrir o diálogo de impressão neste navegador.\n\nUse o botão 📥 BAIXAR para salvar o PDF e imprimir pelo aplicativo de PDF do seu aparelho.");
      }
    };

    /* ── PDF: uma captura por página, uma página do PDF por .km-pagina ── */
    const gerarBlobPDF = async () => {
      const zoomAnterior = zoom;
      zoom = 1;
      aplicarZoom();
      paginasEl.classList.add("km-capturando");
      // SVG em data-URI sem width/height sai cortado no html2canvas: troca pelo mesmo SVG com tamanho
      // (normalizarSvgDataUri) só durante a captura, congelando o tamanho renderizado para o layout não mudar
      const svgsTrocados = [];
      try {
        for (const img of paginasEl.querySelectorAll('img[src^="data:image/svg"]')) {
          const novo = normalizarSvgDataUri(img.src);
          if (novo === img.src) continue;
          const r = img.getBoundingClientRect();
          svgsTrocados.push({ img, src: img.src, largura: img.style.width, altura: img.style.height });
          if (r.width && r.height) { img.style.width = r.width + "px"; img.style.height = r.height + "px"; }
          img.src = novo;
        }
        await Promise.all(svgsTrocados.map(({ img }) => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
      } catch (e) { console.warn("[KMZERO documentos] não foi possível normalizar SVG para o PDF:", e); }
      try {
        await carregarPDFLibs();
        const html2canvas = window.html2canvas;
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF(papel.jspdf[0], "mm", papel.jspdf[1]);
        const lista = [...paginasEl.querySelectorAll(".km-pagina")];
        for (let i = 0; i < lista.length; i++) {
          const pg = lista[i];
          try { pg.scrollIntoView({ block: "start" }); } catch {}
          const canvas = await html2canvas(pg, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
            width: pg.offsetWidth,
            height: pg.offsetHeight,
          });
          const imgData = canvas.toDataURL("image/jpeg", 0.92);
          if (i > 0) pdf.addPage(papel.jspdf[1], papel.jspdf[0]);
          pdf.addImage(imgData, "JPEG", 0, 0, papel.largura, papel.altura, undefined, "FAST");
        }
        return pdf;
      } finally {
        for (const { img, src, largura, altura } of svgsTrocados) { try { img.src = src; img.style.width = largura; img.style.height = altura; } catch {} }
        paginasEl.classList.remove("km-capturando");
        zoom = zoomAnterior;
        aplicarZoom();
      }
    };

    // Conferência automatizada (demo/testes): o robô de captura pede o PDF sem passar pelos botões
    try { window.__kmzeroGerarPDF = async () => (await gerarBlobPDF()).output("datauristring"); } catch {}

    const ehIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // Mostra overlay de instrução com botões pra abrir PDF (iPhone)
    const mostrarOverlayPDF = (blob, nomeArq, modo) => {
      const blobUrl = URL.createObjectURL(blob);
      const overlay = document.createElement("div");
      overlay.id = "km-pdf-ios-overlay";
      overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,Inter,Arial,sans-serif;";

      const corBtn = modo === "compartilhar" ? "#1e7f4f" : "#b42318";
      const tituloModo = modo === "compartilhar" ? "📤 Compartilhar PDF" : "📥 Salvar PDF";
      const subtitulo = modo === "compartilhar"
        ? "Para enviar pro fornecedor / WhatsApp:"
        : "Para salvar nos Arquivos:";

      overlay.innerHTML = `
        <div style="background:#fff;border-radius:18px;padding:18px;max-width:380px;width:100%;max-height:92vh;overflow-y:auto;color:#1c2a30;">
          <div style="text-align:center;font-size:42px;">📄</div>
          <div style="text-align:center;font-size:17px;font-weight:800;color:#052f3d;margin:4px 0;">${tituloModo}</div>
          <div style="text-align:center;font-size:10px;color:#5c6b73;margin-bottom:12px;word-break:break-all;">${esc(nomeArq)}</div>

          <div style="background:#f0fdf4;border-radius:10px;padding:12px;font-size:13px;color:#14532d;margin-bottom:12px;line-height:1.6;">
            <b style="font-size:13px;">📱 ${subtitulo}</b><br/>
            <b>1.</b> Toca em <b>"Abrir PDF"</b> abaixo (vai abrir em nova aba)<br/>
            <b>2.</b> Toca no botão <b>↗️ Compartilhar</b> do Safari (parte de baixo da tela)<br/>
            <b>3.</b> Escolhe o destino:<br/>
            ${modo === "compartilhar" ? `
              &nbsp;&nbsp;• 💚 <b>WhatsApp</b> → contato do fornecedor<br/>
              &nbsp;&nbsp;• 📧 <b>Mail</b> → email do dono da empresa<br/>
              &nbsp;&nbsp;• 💬 <b>Mensagens</b> (SMS)<br/>
              &nbsp;&nbsp;• 💾 <b>AirDrop</b> (compartilhar Apple)
            ` : `
              &nbsp;&nbsp;• 📁 <b>Salvar em Arquivos</b><br/>
              &nbsp;&nbsp;• 📷 <b>Salvar Imagem</b> (galeria)<br/>
              &nbsp;&nbsp;• 💾 <b>AirDrop</b>
            `}
          </div>

          <a href="${blobUrl}" target="_blank" rel="noopener" style="display:block;background:${corBtn};color:#fff;text-align:center;border-radius:12px;padding:14px;width:100%;font-weight:800;text-decoration:none;font-size:15px;margin-bottom:8px;box-shadow:0 4px 12px ${corBtn}66;">📄 Abrir PDF em nova aba</a>

          <button id="km-pdf-fechar" style="background:#e5e7eb;color:#374151;border:none;border-radius:12px;padding:11px;width:100%;font-weight:700;cursor:pointer;font-size:13px;">Fechar</button>
        </div>
      `;
      document.body.appendChild(overlay);

      document.getElementById("km-pdf-fechar").onclick = () => { URL.revokeObjectURL(blobUrl); overlay.remove(); };
      overlay.onclick = (ev) => { if (ev.target === overlay) { URL.revokeObjectURL(blobUrl); overlay.remove(); } };
      setTimeout(() => { try { URL.revokeObjectURL(blobUrl); } catch (e) {} }, 5 * 60 * 1000);
    };

    const nomeArquivoPDF = () => String(filename).replace(/\.html$/, "") + ".pdf";

    // 📥 BAIXAR — salvar arquivo localmente
    btnBaixar.onclick = async () => {
      try {
        btnBaixar.textContent = "⏳ Gerando...";
        btnBaixar.disabled = true;

        const pdf = await gerarBlobPDF();
        const nomeArq = nomeArquivoPDF();

        if (ehIOS) {
          // iOS: overlay com instruções (não consegue download direto)
          const blob = pdf.output("blob");
          mostrarOverlayPDF(blob, nomeArq, "baixar");
        } else {
          // Desktop/Android: download direto
          pdf.save(nomeArq);
        }

        btnBaixar.innerHTML = "📥 BAIXAR";
        btnBaixar.disabled = false;
      } catch (e) {
        console.error("Erro ao baixar PDF:", e);
        alert("⚠️ Erro: " + e.message);
        btnBaixar.innerHTML = "📥 BAIXAR";
        btnBaixar.disabled = false;
      }
    };

    // 📤 ENVIAR — compartilhar via WhatsApp/Email/etc
    btnCompartilhar.onclick = async () => {
      try {
        btnCompartilhar.textContent = "⏳ Gerando...";
        btnCompartilhar.disabled = true;

        const pdf = await gerarBlobPDF();
        const nomeArq = nomeArquivoPDF();
        const blob = pdf.output("blob");
        const file = new File([blob], nomeArq, { type: "application/pdf" });

        // ESTRATÉGIA 1: Web Share API (Android moderno + iOS 15+)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: nomeArq,
              text: "📄 " + nomeArq,
            });
            btnCompartilhar.innerHTML = "📤 ENVIAR";
            btnCompartilhar.disabled = false;
            return;
          } catch (e) {
            if (e.name === "AbortError") {
              btnCompartilhar.innerHTML = "📤 ENVIAR";
              btnCompartilhar.disabled = false;
              return;
            }
            // Continua pro fallback se outro erro
          }
        }

        // ESTRATÉGIA 2: iOS sem Share API ou desktop — overlay com instruções
        if (ehIOS) {
          mostrarOverlayPDF(blob, nomeArq, "compartilhar");
        } else {
          // Desktop sem Share API — abre PDF em nova aba
          const blobUrl = URL.createObjectURL(blob);
          const w = window.open(blobUrl, "_blank");
          if (!w) {
            alert("⚠️ Popup bloqueado.\n\nLibere popups deste site nas configurações do navegador, ou use o botão 📥 BAIXAR e depois compartilhe o arquivo.");
          } else {
            setTimeout(() => {
              alert("📄 PDF aberto em nova aba.\n\nUse o menu do navegador pra:\n• Salvar como\n• Imprimir\n• Enviar por email");
            }, 500);
          }
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        }

        btnCompartilhar.innerHTML = "📤 ENVIAR";
        btnCompartilhar.disabled = false;
      } catch (e) {
        console.error("Erro ao compartilhar:", e);
        alert("⚠️ Erro: " + e.message);
        btnCompartilhar.innerHTML = "📤 ENVIAR";
        btnCompartilhar.disabled = false;
      }
    };

    return { ok: true };
  } catch (e) {
    console.error("Erro ao exibir documento:", e);
    alert("Erro ao exibir: " + e.message);
    return { ok: false };
  }
}
