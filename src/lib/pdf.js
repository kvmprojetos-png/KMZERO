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

/* ── EXIBIR DOCUMENTO + GERAR PDF REAL ── */
/* ════════════════════════════════════════════════════
   PADRÃO PROFISSIONAL — Cabeçalho e Rodapé pra PDFs
   Usado em RDO ABNT, RDO Semanal, Folha, Ficha, Exames
══════════════════════════════════════════════════════ */
export const KM_PDF_PAGE_CSS = `
  /* ═══ PADRÃO A4 (210x297mm) ═══ */
  @page { size: A4 portrait; margin: 12mm 10mm; }
  @media print { body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  body { max-width: 190mm; margin: 0 auto; padding: 8mm 0; box-sizing: border-box; }

  /* ═══ Quebra de página inteligente — itens nunca cortam no meio ═══ */
  h1, h2, h3, h4, h5, h6 { page-break-after: avoid; break-after: avoid; page-break-inside: avoid; break-inside: avoid; }
  table { page-break-inside: auto; break-inside: auto; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr, td, th { page-break-inside: avoid; break-inside: avoid; }
  li { page-break-inside: avoid; break-inside: avoid; }
  img, figure { page-break-inside: avoid; break-inside: avoid; max-width: 100%; }
  blockquote, pre { page-break-inside: avoid; break-inside: avoid; }

  /* Classes específicas do app — blocos que não podem cortar */
  .kpi, .kpis, .card, .card-pedido, .card-rdo, .card-trab,
  .secao, .secao-item, .item-pedido, .item-rdo, .resumo-final,
  .info-box, .item-foto, .grupo-fotos, .ficha-item,
  .km-header, .km-footer, .assinatura-bloco, .resumo-financeiro,
  .bloco-pedido, .bloco-mov, .bloco-despesa, .bloco-diario {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  /* Garante margem mínima antes de quebrar */
  p, div { orphans: 3; widows: 3; }
`;

export const KM_PDF_CSS = `
  /* CABEÇALHO PADRÃO */
  .km-header {
    display: flex; align-items: stretch;
    margin: 0 0 12px 0; padding: 0;
    border-left: 6px solid #C0A040;
    background: linear-gradient(90deg, #fafbfd 0%, #fff 100%);
  }
  .km-header-logo {
    padding: 14px 18px 14px 14px;
    border-right: 1px solid #e5e5e5;
    min-width: 130px;
  }
  .km-header-logo .logo {
    font-size: 22pt; font-weight: 900; letter-spacing: -0.5px; line-height: 1;
  }
  .km-header-logo .logo .km { color: #0f2151; }
  .km-header-logo .logo .zero { color: #C0A040; }
  .km-header-logo .tagline {
    font-size: 7pt; color: #888; text-transform: uppercase; letter-spacing: 1.5px;
    margin-top: 4px; font-weight: 600;
  }
  .km-header-info {
    flex: 1; padding: 12px 16px; display: flex; flex-direction: column; justify-content: space-between;
  }
  .km-header-info .doc-title {
    font-size: 13pt; color: #0f2151; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;
  }
  .km-header-info .doc-num {
    font-size: 9pt; color: #888; margin-top: 2px;
  }
  .km-header-info .empresa {
    font-size: 8pt; color: #555; margin-top: 4px; line-height: 1.4;
  }
  .km-header-info .empresa b { color: #0f2151; }
  .km-header-meta {
    text-align: right; padding: 12px 16px;
    border-left: 1px solid #e5e5e5;
    font-size: 8pt; color: #666; line-height: 1.5;
  }
  .km-header-meta b { color: #0f2151; }

  /* RODAPÉ PADRÃO */
  .km-footer {
    margin-top: 18px; padding-top: 10px;
    border-top: 2px solid #C0A040;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 7.5pt; color: #888;
    page-break-inside: avoid;
  }
  .km-footer .left { display: flex; align-items: center; gap: 6px; }
  .km-footer .left .logo-mini {
    color: #0f2151; font-weight: 900; font-size: 9pt; letter-spacing: -0.5px;
  }
  .km-footer .left .logo-mini span { color: #C0A040; }
  .km-footer .center { color: #aaa; }
  .km-footer .right { color: #666; text-align: right; }

  /* ASSINATURAS */
  .km-assinaturas {
    margin-top: 30px; display: flex; gap: 24px; page-break-inside: avoid;
  }
  .km-assinaturas .ass {
    flex: 1; text-align: center; padding-top: 50px;
    border-top: 1px solid #888;
  }
  .km-assinaturas .ass b { display: block; color: #0f2151; font-size: 9pt; }
  .km-assinaturas .ass span { display: block; color: #888; font-size: 8pt; margin-top: 2px; }
`;

export function gerarHeaderHTML({ tipo, numero, empresa = {}, periodo, info_extra }) {
  const numeroFmt = numero ? `Nº ${typeof numero === "number" ? String(numero).padStart(3, "0") : numero}` : "";
  const dataAgora = new Date().toLocaleString("pt-BR");
  const logoEmpresa = empresa.logoBase64
    ? `<img src="${empresa.logoBase64}" alt="Logo" style="max-height:54px;max-width:150px;object-fit:contain;margin-left:14px;" />`
    : "";
  return `
    <div class="km-header">
      <div class="km-header-logo" style="display:flex;align-items:center;">
        <div>
          <div class="logo"><span class="km">KM</span><span class="zero">ZERO</span></div>
          <div class="tagline">Gestão de Obras</div>
        </div>
        ${logoEmpresa}
      </div>
      <div class="km-header-info">
        <div>
          <div class="doc-title">${tipo || "Documento"}</div>
          ${numeroFmt ? `<div class="doc-num">${numeroFmt}${periodo ? " · " + periodo : ""}</div>` : ""}
          ${info_extra ? `<div class="doc-num">${info_extra}</div>` : ""}
        </div>
        <div class="empresa">
          <b>${empresa.razaoSocial || "KM Consultoria, Assessoria e Serviços de Engenharia Ltda"}</b><br/>
          ${empresa.responsavel || "Kleber Vieira Martins"} · ${empresa.registro || "CREA-ES"}<br/>
          ${empresa.email || "kvmprojetos@gmail.com"} · ${empresa.telefone || "(28) 99925-8172"}
        </div>
      </div>
      <div class="km-header-meta">
        <b>EMITIDO EM</b><br/>
        ${dataAgora}
      </div>
    </div>
  `;
}

export function gerarFooterHTML({ empresa = {}, autor }) {
  const dataAgora = new Date().toLocaleString("pt-BR");
  return `
    <div class="km-footer">
      <div class="left">
        <span class="logo-mini">KM<span>ZERO</span></span>
        · ${empresa.razaoSocial ? empresa.razaoSocial.substring(0, 50) : "KM Consultoria"}
      </div>
      <div class="center">Documento gerado pelo KMZERO</div>
      <div class="right">${autor ? autor + " · " : ""}${dataAgora}</div>
    </div>
  `;
}

export function gerarAssinaturasHTML({ empresa = {}, autor }) {
  return `
    <div class="km-assinaturas">
      <div class="ass">
        <b>${autor || empresa.responsavel || "Kleber Vieira Martins"}</b>
        <span>Engenheiro Responsável · ${empresa.registro || "CREA-ES"}</span>
      </div>
      <div class="ass">
        <b>Fiscalização</b>
        <span>Visto / Carimbo</span>
      </div>
    </div>
  `;
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

export async function abrirOuBaixarHTML(html, filename = "documento") {
  try {
    // Detecta tamanho do papel
    const ehPaisagem = /size:\s*A4\s+landscape/i.test(html);
    const ehA6 = /size:\s*A6\b/i.test(html);

    // Remove overlay anterior
    const existente = document.getElementById("km-doc-viewer");
    if (existente) existente.remove();

    // Container fullscreen com scroll livre e zoom permitido
    const container = document.createElement("div");
    container.id = "km-doc-viewer";
    container.style.cssText = `
      position: fixed !important;
      top: 0 !important; left: 0 !important;
      width: 100vw !important; height: 100vh !important;
      background: #525659 !important;
      z-index: 2147483647 !important;
      display: flex !important;
      flex-direction: column !important;
    `;

    // Barra superior fixa com botões grandes
    const barra = document.createElement("div");
    barra.style.cssText = `
      background: #0f2151 !important;
      color: #fff !important;
      padding: 10px !important;
      padding-top: calc(10px + env(safe-area-inset-top, 0px)) !important;
      display: flex !important;
      gap: 6px !important;
      flex-wrap: wrap !important;
      align-items: center !important;
      flex-shrink: 0 !important;
      box-shadow: 0 2px 10px rgba(0,0,0,0.4) !important;
    `;

    const btnBaixar = document.createElement("button");
    btnBaixar.innerHTML = "📥 BAIXAR";
    btnBaixar.style.cssText = "background:#dc2626; color:#fff; border:none; border-radius:8px; padding:10px 12px; font-weight:800; cursor:pointer; font-size:13px; flex:1; min-width:100px;";

    const btnCompartilhar = document.createElement("button");
    btnCompartilhar.innerHTML = "📤 ENVIAR";
    btnCompartilhar.style.cssText = "background:#16a34a; color:#fff; border:none; border-radius:8px; padding:10px 12px; font-weight:800; cursor:pointer; font-size:13px; flex:1; min-width:100px;";

    const btnZoomIn = document.createElement("button");
    btnZoomIn.textContent = "🔍+";
    btnZoomIn.style.cssText = "background:#475569; color:#fff; border:none; border-radius:8px; padding:10px 10px; font-weight:800; cursor:pointer; font-size:12px;";

    const btnZoomOut = document.createElement("button");
    btnZoomOut.textContent = "🔍−";
    btnZoomOut.style.cssText = "background:#475569; color:#fff; border:none; border-radius:8px; padding:10px 10px; font-weight:800; cursor:pointer; font-size:12px;";

    const btnImprimir = document.createElement("button");
    btnImprimir.innerHTML = "🖨️ IMPRIMIR";
    btnImprimir.title = "Imprimir relatório";
    btnImprimir.style.cssText = "background:#0891b2; color:#fff; border:none; border-radius:8px; padding:10px 12px; font-weight:800; cursor:pointer; font-size:13px; flex:1; min-width:100px;";

    const btnFechar = document.createElement("button");
    btnFechar.textContent = "✕";
    btnFechar.style.cssText = "background:#6b7280; color:#fff; border:none; border-radius:8px; padding:10px 10px; font-weight:800; cursor:pointer; font-size:12px;";

    barra.appendChild(btnBaixar);
    barra.appendChild(btnCompartilhar);
    barra.appendChild(btnImprimir);
    barra.appendChild(btnZoomIn);
    barra.appendChild(btnZoomOut);
    barra.appendChild(btnFechar);

    // Área scroll livre (zoom funciona)
    const scrollArea = document.createElement("div");
    scrollArea.style.cssText = `
      flex: 1;
      overflow: auto;
      padding: 12px;
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      -webkit-overflow-scrolling: touch;
      touch-action: pan-x pan-y pinch-zoom;
    `;

    // Wrapper que segura a página A4 (permite zoom via transform)
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display: flex; justify-content: center; min-width: max-content;";

    // Dimensões do papel
    const larguraMM = ehA6 ? "105mm" : (ehPaisagem ? "297mm" : "210mm");
    const alturaMM  = ehA6 ? "148mm" : (ehPaisagem ? "210mm" : "297mm");
    const paddingPg = ehA6 ? "4mm" : "12mm 14mm";
    const pagina = document.createElement("div");
    pagina.id = "km-doc-page";
    pagina.style.cssText = `
      background: #fff;
      width: ${larguraMM};
      min-height: ${alturaMM};
      padding: ${paddingPg};
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      box-sizing: border-box;
      font-family: Arial, Helvetica, sans-serif;
      color: #222;
      font-size: 10pt;
      line-height: 1.4;
      transform-origin: top center;
      transition: transform 0.15s ease;
    `;

    // Extrai conteúdo
    const matchStyle = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    const matchBody = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyHTML = matchBody ? matchBody[1] : html;
    const styleHTML = matchStyle ? matchStyle.join("") : "";
    let bodyLimpo = bodyHTML.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

    // Conta colunas de cada tabela e aplica classes
    bodyLimpo = bodyLimpo.replace(/<table([^>]*)>([\s\S]*?)<\/table>/g, (match, attrs, content) => {
      const firstRow = content.match(/<tr[^>]*>([\s\S]*?)<\/tr>/);
      if (!firstRow) return match;
      const cols = (firstRow[1].match(/<t[hd]/gi) || []).length;
      let classe = "";
      if (cols >= 12) classe = "tab-12-col";
      else if (cols >= 8) classe = "tab-many-col";
      else if (cols <= 3) classe = "tab-small";
      if (!classe) return match;
      const newAttrs = attrs.includes("class=")
        ? attrs.replace(/class="([^"]*)"/, `class="$1 ${classe}"`)
        : attrs + ` class="${classe}"`;
      return `<table${newAttrs}>${content}</table>`;
    });

    // CSS robusto que sobrescreve qualquer estilo interno
    const estiloBase = `
      <style>
        #km-doc-page * { box-sizing: border-box; }

        /* Tabela padrão */
        #km-doc-page table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin: 6px 0 !important;
          font-size: 9pt !important;
          page-break-inside: avoid;
        }
        #km-doc-page th, #km-doc-page td {
          padding: 6px 8px !important;
          border: 1px solid #bbb !important;
          word-wrap: break-word;
          overflow-wrap: break-word;
          vertical-align: middle !important;
          line-height: 1.35 !important;
        }
        #km-doc-page th {
          background: #0f2151 !important;
          color: #fff !important;
          font-weight: 700 !important;
          font-size: 8.5pt !important;
          text-align: center !important;
          padding: 6px 4px !important;
        }

        /* Tabela com 8-11 colunas: fonte 8pt */
        #km-doc-page table.tab-many-col { font-size: 7.5pt !important; table-layout: fixed !important; }
        #km-doc-page table.tab-many-col th { font-size: 7pt !important; padding: 4px 3px !important; }
        #km-doc-page table.tab-many-col td { padding: 3px 4px !important; }

        /* Tabela com 12+ colunas: fonte ainda menor */
        #km-doc-page table.tab-12-col { font-size: 6.8pt !important; table-layout: fixed !important; }
        #km-doc-page table.tab-12-col th { font-size: 6.5pt !important; padding: 3px 2px !important; }
        #km-doc-page table.tab-12-col td { padding: 2px 3px !important; }

        /* Tabela pequena (3 cols) */
        #km-doc-page table.tab-small { font-size: 10pt !important; }
        #km-doc-page table.tab-small td { padding: 8px 10px !important; }

        #km-doc-page td b { font-weight: 700; }
        #km-doc-page h1 { color: #0f2151 !important; font-size: 16pt !important; margin: 0 0 8px !important; }
        #km-doc-page h2 { color: #0f2151 !important; font-size: 11pt !important; margin: 12px 0 4px !important; padding: 5px 8px; background: #f5f8fc; border-left: 3px solid #C0A040; }
        #km-doc-page p { margin: 6px 0 !important; font-size: 10pt; }
        #km-doc-page .head { background: #0f2151 !important; color: #fff !important; padding: 12px 14px !important; }
        #km-doc-page .footer { font-size: 8pt !important; color: #888 !important; margin-top: 16px !important; padding-top: 8px !important; border-top: 1px solid #ddd !important; text-align: center; }
        #km-doc-page .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; color: #fff; font-size: 8pt; font-weight: bold; }
        #km-doc-page .right { text-align: right !important; }
        #km-doc-page .num { text-align: center !important; }
        #km-doc-page .total td { background: #f0f0f0 !important; font-weight: 800 !important; }
      </style>
    `;

    pagina.innerHTML = estiloBase + styleHTML + bodyLimpo;
    wrapper.appendChild(pagina);
    scrollArea.appendChild(wrapper);
    container.appendChild(barra);
    container.appendChild(scrollArea);
    document.body.appendChild(container);

    // Sistema de ZOOM
    let zoomNivel = 1;
    const ajustarZoom = (delta) => {
      zoomNivel = Math.max(0.4, Math.min(3, zoomNivel + delta));
      pagina.style.transform = `scale(${zoomNivel})`;
    };
    btnZoomIn.onclick = () => ajustarZoom(0.15);
    btnZoomOut.onclick = () => ajustarZoom(-0.15);

    // 🖨️ IMPRIMIR — abre janela de impressão do navegador
    btnImprimir.onclick = () => {
      try {
        // Salva o zoom atual e reseta para impressão
        const zoomAnterior = zoomNivel;
        pagina.style.transform = "scale(1)";

        // Cria janela de impressão com o HTML original
        const janelaImpressao = window.open("", "_blank", "width=900,height=700");
        if (!janelaImpressao) {
          alert("⚠️ Popup bloqueado.\n\nLibere popups deste site nas configurações do navegador para usar a impressão.\n\nAlternativa: toque em 📥 BAIXAR e abra o PDF no aplicativo do celular para imprimir de lá.");
          // Restaura zoom
          setTimeout(() => { pagina.style.transform = `scale(${zoomAnterior})`; }, 100);
          return;
        }

        // Monta documento limpo para impressão
        janelaImpressao.document.open();
        janelaImpressao.document.write(html);
        janelaImpressao.document.close();

        // Aguarda carregamento e abre o diálogo de impressão
        janelaImpressao.onload = () => {
          setTimeout(() => {
            try {
              janelaImpressao.focus();
              janelaImpressao.print();
            } catch (e) {
              console.error("Erro ao imprimir:", e);
            }
          }, 300);
        };

        // Restaura zoom da tela original
        setTimeout(() => { pagina.style.transform = `scale(${zoomAnterior})`; }, 200);
      } catch (e) {
        console.error("Erro ao imprimir:", e);
        alert("⚠️ Não foi possível abrir o diálogo de impressão neste navegador.\n\nUse o botão 📥 BAIXAR para salvar o PDF e imprimir pelo aplicativo de PDF do seu aparelho.");
      }
    };

    btnFechar.onclick = () => container.remove();

    // Função que gera o PDF (compartilhada por baixar e compartilhar)
    const gerarBlobPDF = async () => {
      // Reset zoom antes de gerar (evita PDF distorcido)
      const zoomAnterior = zoomNivel;
      pagina.style.transform = "scale(1)";
      try {
        await carregarPDFLibs();
        const html2canvas = window.html2canvas;
        const { jsPDF } = window.jspdf;

        const canvas = await html2canvas(pagina, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#fff",
          windowWidth: pagina.scrollWidth,
          windowHeight: pagina.scrollHeight,
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        const pdf = new jsPDF(ehPaisagem ? "l" : "p", "mm", ehA6 ? "a6" : "a4");
        const pdfW = ehA6 ? 105 : (ehPaisagem ? 297 : 210);
        const pdfH = ehA6 ? 148 : (ehPaisagem ? 210 : 297);
        const imgW = pdfW;
        const imgH = (canvas.height * imgW) / canvas.width;

        let heightLeft = imgH;
        let position = 0;
        pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
        heightLeft -= pdfH;

        while (heightLeft > 0) {
          position = heightLeft - imgH;
          pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
          heightLeft -= pdfH;
        }

        return pdf;
      } finally {
        pagina.style.transform = `scale(${zoomAnterior})`;
      }
    };

    const ehIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // Mostra overlay de instrução com botões pra abrir PDF (iPhone)
    const mostrarOverlayPDF = (blob, nomeArq, modo) => {
      const blobUrl = URL.createObjectURL(blob);
      const overlay = document.createElement("div");
      overlay.id = "km-pdf-ios-overlay";
      overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,Arial,sans-serif;";

      const corBtn = modo === "compartilhar" ? "#16a34a" : "#dc2626";
      const tituloModo = modo === "compartilhar" ? "📤 Compartilhar PDF" : "📥 Salvar PDF";
      const subtitulo = modo === "compartilhar"
        ? "Para enviar pro fornecedor / WhatsApp:"
        : "Para salvar nos Arquivos:";

      overlay.innerHTML = `
        <div style="background:#fff;border-radius:18px;padding:18px;max-width:380px;width:100%;max-height:92vh;overflow-y:auto;color:#222;">
          <div style="text-align:center;font-size:42px;">📄</div>
          <div style="text-align:center;font-size:17px;font-weight:800;color:#0f2151;margin:4px 0;">${tituloModo}</div>
          <div style="text-align:center;font-size:10px;color:#888;margin-bottom:12px;word-break:break-all;">${nomeArq}</div>

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

    // 📥 BAIXAR — salvar arquivo localmente
    btnBaixar.onclick = async () => {
      try {
        btnBaixar.textContent = "⏳ Gerando...";
        btnBaixar.disabled = true;

        const pdf = await gerarBlobPDF();
        const nomeArq = filename.replace(/\.html$/, "") + ".pdf";

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
        const nomeArq = filename.replace(/\.html$/, "") + ".pdf";
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
    alert("Erro ao exibir: " + e.message);
    return { ok: false };
  }
}

/* ── DEFAULT DATA ── */
