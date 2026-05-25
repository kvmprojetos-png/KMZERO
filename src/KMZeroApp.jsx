import { useState, useEffect, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { loginFirebase, logoutFirebase, observarAutenticacao, recuperarSenha, atualizarSenha, usuarioAtual } from "./firebase.js";

/* ── HELPERS DATA ── */
const hojeStr = () => new Date().toISOString().split("T")[0]; // YYYY-MM-DD
const fmtData = (iso) => { const d = new Date(iso + "T00:00:00"); return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); };
const ultimosDias = (n) => {
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    arr.push(d.toISOString().split("T")[0]);
  }
  return arr;
};

/* ── PALETTE ── */
const NAVY  = "#0f2151";
const NAVY2 = "#1a3370";
const GOLD  = "#f5a623";
const GREEN = "#2aa84f";
const RED   = "#d63b3b";
const ORANGE= "#e87722";
const BLUE  = "#1e6bbf";
const LIGHT = "#f2f4f8";

/* ── FERIADOS NACIONAIS BRASILEIROS ── */
// Calcula a data da Páscoa pelo algoritmo de Gauss (mais preciso)
function dataPascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function feriadosDoAno(ano) {
  const pascoa = dataPascoa(ano);
  // Carnaval = 47 dias antes da Páscoa
  const carnavalSeg = new Date(pascoa); carnavalSeg.setDate(carnavalSeg.getDate() - 48);
  const carnavalTer = new Date(pascoa); carnavalTer.setDate(carnavalTer.getDate() - 47);
  // Sexta-feira Santa = 2 dias antes da Páscoa
  const sextaSanta = new Date(pascoa); sextaSanta.setDate(sextaSanta.getDate() - 2);
  // Corpus Christi = 60 dias após Páscoa
  const corpusChristi = new Date(pascoa); corpusChristi.setDate(corpusChristi.getDate() + 60);

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return {
    [`${ano}-01-01`]: { nome: "Confraternização Universal", tipo: "nacional", emoji: "🎉" },
    [iso(carnavalSeg)]: { nome: "Carnaval (Segunda)", tipo: "facultativo", emoji: "🎭" },
    [iso(carnavalTer)]: { nome: "Carnaval (Terça)", tipo: "facultativo", emoji: "🎭" },
    [iso(sextaSanta)]: { nome: "Sexta-feira Santa", tipo: "nacional", emoji: "✝️" },
    [iso(pascoa)]: { nome: "Páscoa", tipo: "nacional", emoji: "🥚" },
    [`${ano}-04-21`]: { nome: "Tiradentes", tipo: "nacional", emoji: "⚒️" },
    [`${ano}-05-01`]: { nome: "Dia do Trabalho", tipo: "nacional", emoji: "👷" },
    [iso(corpusChristi)]: { nome: "Corpus Christi", tipo: "facultativo", emoji: "🍞" },
    [`${ano}-09-07`]: { nome: "Independência do Brasil", tipo: "nacional", emoji: "🇧🇷" },
    [`${ano}-10-12`]: { nome: "Nossa Senhora Aparecida", tipo: "nacional", emoji: "🙏" },
    [`${ano}-11-02`]: { nome: "Finados", tipo: "nacional", emoji: "🕯️" },
    [`${ano}-11-15`]: { nome: "Proclamação da República", tipo: "nacional", emoji: "🇧🇷" },
    [`${ano}-11-20`]: { nome: "Consciência Negra", tipo: "nacional", emoji: "✊🏿" },
    [`${ano}-12-25`]: { nome: "Natal", tipo: "nacional", emoji: "🎄" },
  };
}

// Cache de feriados por ano para evitar recalcular
const _cacheFeriados = {};
function feriadoEm(dataISO) {
  // dataISO: "YYYY-MM-DD"
  if (!dataISO || !dataISO.includes("-")) return null;
  const ano = parseInt(dataISO.split("-")[0]);
  if (isNaN(ano)) return null;
  if (!_cacheFeriados[ano]) _cacheFeriados[ano] = feriadosDoAno(ano);
  return _cacheFeriados[ano][dataISO] || null;
}

/* ── STORAGE ── */
const store = {
  async get(key) {
    try {
      // Tenta localStorage primeiro (Vercel/produção)
      const v = localStorage.getItem("kmzero_" + key);
      if (v) return JSON.parse(v);
      // Fallback pra storage do Claude.ai (durante desenvolvimento)
      if (typeof window !== "undefined" && window.storage && window.storage.get) {
        const r = await window.storage.get(key);
        return r ? JSON.parse(r.value) : null;
      }
      return null;
    } catch (e) { console.warn("store.get error:", e); return null; }
  },
  async set(key, val) {
    try {
      const json = JSON.stringify(val);
      // Salva no localStorage (Vercel/produção)
      localStorage.setItem("kmzero_" + key, json);
      // Espelha no storage do Claude.ai se disponível
      if (typeof window !== "undefined" && window.storage && window.storage.set) {
        try { await window.storage.set(key, json); } catch {}
      }
    } catch (e) {
      console.warn("store.set error:", e);
      // localStorage cheio? Tenta limpar e salvar
      if (e.name === "QuotaExceededError") {
        alert("⚠️ Armazenamento cheio! Faça backup e limpe dados antigos.");
      }
    }
  },
  async clear() {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith("kmzero_"));
      keys.forEach(k => localStorage.removeItem(k));
    } catch (e) { console.warn(e); }
  }
};

/* ════════════════════════════════════════════════════
   FILE STORE — Armazenamento de arquivos via IndexedDB
   Preparado para migração futura ao Firebase/Supabase Storage
══════════════════════════════════════════════════════ */
const FILE_DB_NAME = "kmzero_files";
const FILE_DB_VERSION = 1;
const FILE_STORE_NAME = "anexos";

let _dbInstance = null;

function openFileDB() {
  if (_dbInstance) return Promise.resolve(_dbInstance);
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB não disponível neste navegador"));
      return;
    }
    const req = indexedDB.open(FILE_DB_NAME, FILE_DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { _dbInstance = req.result; resolve(req.result); };
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(FILE_STORE_NAME)) {
        const os = db.createObjectStore(FILE_STORE_NAME, { keyPath: "id" });
        os.createIndex("obraId", "obraId", { unique: false });
        os.createIndex("uploadedAt", "uploadedAt", { unique: false });
      }
    };
  });
}

const fileStore = {
  async save(arquivo) {
    try {
      const db = await openFileDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([FILE_STORE_NAME], "readwrite");
        const os = tx.objectStore(FILE_STORE_NAME);
        const req = os.put(arquivo);
        req.onsuccess = () => resolve(arquivo);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { console.error("fileStore.save:", e); throw e; }
  },

  async get(id) {
    try {
      const db = await openFileDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([FILE_STORE_NAME], "readonly");
        const os = tx.objectStore(FILE_STORE_NAME);
        const req = os.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { console.error("fileStore.get:", e); return null; }
  },

  async listByObra(obraId) {
    try {
      const db = await openFileDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([FILE_STORE_NAME], "readonly");
        const os = tx.objectStore(FILE_STORE_NAME);
        const idx = os.index("obraId");
        const req = idx.getAll(obraId);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { console.error("fileStore.listByObra:", e); return []; }
  },

  async delete(id) {
    try {
      const db = await openFileDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([FILE_STORE_NAME], "readwrite");
        const os = tx.objectStore(FILE_STORE_NAME);
        const req = os.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { console.error("fileStore.delete:", e); return false; }
  },

  async getQuotaInfo() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        return {
          usado: est.usage || 0,
          total: est.quota || 0,
          percentual: est.quota ? (est.usage / est.quota * 100) : 0,
        };
      }
      return null;
    } catch { return null; }
  },
};

function lerArquivoComoBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatarTamanhoBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function iconePorTipoArquivo(mime, nome) {
  const n = (nome || "").toLowerCase();
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp)$/.test(n)) return "🖼️";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "📕";
  if (m.includes("spreadsheet") || m.includes("excel") || /\.(xlsx|xls|csv|ods)$/.test(n)) return "📊";
  if (m.includes("word") || m.includes("document") || /\.(docx|doc|odt|rtf)$/.test(n)) return "📝";
  if (m.includes("presentation") || /\.(pptx|ppt|odp)$/.test(n)) return "📈";
  if (m.startsWith("video/") || /\.(mp4|mov|avi|mkv|webm)$/.test(n)) return "🎬";
  if (m.startsWith("audio/") || /\.(mp3|wav|m4a|ogg)$/.test(n)) return "🎵";
  if (/\.(zip|rar|7z|tar|gz)$/.test(n)) return "🗜️";
  if (/\.(dwg|dxf|rvt|ifc)$/.test(n)) return "📐";
  return "📄";
}

/* ── CARREGAR BIBLIOTECAS PDF DINAMICAMENTE ── */
const carregarScript = (src) => new Promise((resolve, reject) => {
  if ([...document.scripts].some(s => s.src === src)) return resolve();
  const s = document.createElement("script");
  s.src = src;
  s.onload = () => resolve();
  s.onerror = () => reject(new Error("Falha ao carregar " + src));
  document.head.appendChild(s);
});

const carregarPDFLibs = async () => {
  if (window.jspdf && window.html2canvas) return;
  await carregarScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
  await carregarScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
};

/* ── EXIBIR DOCUMENTO + GERAR PDF REAL ── */
/* ════════════════════════════════════════════════════
   PADRÃO PROFISSIONAL — Cabeçalho e Rodapé pra PDFs
   Usado em RDO ABNT, RDO Semanal, Folha, Ficha, Exames
══════════════════════════════════════════════════════ */
const KM_PDF_PAGE_CSS = `
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

const KM_PDF_CSS = `
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

function gerarHeaderHTML({ tipo, numero, empresa = {}, periodo, info_extra }) {
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

function gerarFooterHTML({ empresa = {}, autor }) {
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

function gerarAssinaturasHTML({ empresa = {}, autor }) {
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
function fmtQtd(qtd) {
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

async function abrirOuBaixarHTML(html, filename = "documento") {
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
const DEFAULT_FORNECEDORES = [
  // LOJAS DE MATERIAL DE CONSTRUÇÃO — ALEGRE/ES
  {
    id: 1,
    nome: "Leal Material de Construção",
    razaoSocial: "Everaldo Leal Domingos",
    cnpj: "08.074.253/0001-11",
    categoria: "Material de construção",
    contato: "Everaldo Leal",
    telefone: "(28) 3552-1416",
    whatsapp: "(28) 99886-0000",
    email: "",
    endereco: "Rua Monsenhor Pavesi, 134 - Centro, Alegre - ES",
    obs: "Loja referência em Alegre. Materiais diversos da base ao acabamento. Entrega em toda a região. Possui filiais (Av. Oscar de Almeida Gama, 31). Instagram @lealmaterial",
  },
  {
    id: 2,
    nome: "Treze Material de Construção",
    razaoSocial: "Treze Material de Construcao Ltda",
    cnpj: "01.070.171/0001-50",
    categoria: "Material de construção",
    contato: "",
    telefone: "(28) 3552-1201",
    whatsapp: "",
    email: "",
    endereco: "Rua Treze de Maio, 98 - Centro, Alegre - ES",
    obs: "Empresa tradicional de Alegre, fundada em 1996. Comércio varejista de materiais de construção em geral.",
  },
  {
    id: 3,
    nome: "Alternativa Material de Construção",
    razaoSocial: "Alternativa - Materiais De Construcao Ltda",
    cnpj: "",
    categoria: "Material de construção",
    contato: "",
    telefone: "(28) 3552-0000",
    whatsapp: "",
    email: "",
    endereco: "Rua Monsenhor Pavesi, 193 - Centro, Alegre - ES",
    obs: "Atendimento por telefone e email.",
  },
  {
    id: 4,
    nome: "Solução Material de Construção",
    razaoSocial: "Solucao Material De Construcao",
    cnpj: "",
    categoria: "Material de construção",
    contato: "",
    telefone: "(28) 3552-0000",
    whatsapp: "",
    email: "",
    endereco: "Av. Haroldo Bastos Valbão, S/N - Rive, Alegre - ES",
    obs: "Localizada no distrito de Rive. Bom pra obras na região do Rive/IFES.",
  },
  {
    id: 5,
    nome: "Casa do Construtor (Construforte)",
    razaoSocial: "Casa Do Construtor Construforte Ltda",
    cnpj: "",
    categoria: "Locação de equipamentos",
    contato: "",
    telefone: "(28) 3552-0000",
    whatsapp: "",
    email: "",
    endereco: "Rua Euclides Jaccoud Junior, 67 - Rive, Alegre - ES",
    obs: "Locação de equipamentos. Próximo ao IFES.",
  },
  {
    id: 6,
    nome: "Ney Dalrio Material de Construção",
    razaoSocial: "Ney Dalrio Material de Construção Ltda",
    cnpj: "",
    categoria: "Material de construção",
    contato: "",
    telefone: "(28) 3552-3661",
    whatsapp: "",
    email: "",
    endereco: "Rua Joaquim Borges - Alegre, ES",
    obs: "",
  },
  {
    id: 7,
    nome: "Form Material de Construção",
    razaoSocial: "Form",
    cnpj: "",
    categoria: "Material de construção",
    contato: "",
    telefone: "(28) 3552-0000",
    whatsapp: "",
    email: "",
    endereco: "Rua Felicio Alcuri, 10 - Térreo, Centro, Alegre - ES",
    obs: "",
  },
  {
    id: 8,
    nome: "Casa Rogai Leal",
    razaoSocial: "Casa Rogai Leal",
    cnpj: "",
    categoria: "Material de construção",
    contato: "",
    telefone: "(28) 3552-0000",
    whatsapp: "",
    email: "",
    endereco: "Rua Principal, 64 - Ararai, Alegre - ES",
    obs: "Distrito de Ararai.",
  },
  {
    id: 9,
    nome: "F. F. Comercial",
    razaoSocial: "F. F. Comercial",
    cnpj: "",
    categoria: "Material de construção",
    contato: "",
    telefone: "(28) 3552-0000",
    whatsapp: "",
    email: "",
    endereco: "Rua Monsenhor Pavesi, 100 - Centro, Alegre - ES",
    obs: "",
  },
  {
    id: 10,
    nome: "Monteiro Material de Construção",
    razaoSocial: "Monteiro",
    cnpj: "",
    categoria: "Material de construção",
    contato: "",
    telefone: "(28) 3552-0000",
    whatsapp: "",
    email: "",
    endereco: "Praça Antônio Correa Monteiro, 195 - Triângulo, Alegre - ES",
    obs: "Bairro Triângulo.",
  },
  {
    id: 11,
    nome: "Coelho Material de Construção",
    razaoSocial: "Coelho Material de Construção",
    cnpj: "",
    categoria: "Material de construção",
    contato: "",
    telefone: "(28) 3552-0000",
    whatsapp: "",
    email: "",
    endereco: "Alegre - ES",
    obs: "Slogan: Do campo a cidade construindo sonhos. Facebook: materialcoelho",
  },
];

const DEFAULT_OBRAS = [
  { id: 1, nome: "Drenagem e Pavimentação - Rua Emílio Marins (Trecho 2)", local: "Alegre - ES", endereco: "Rua Emílio Marins, Trecho 2, Alegre - ES", refLocal: "", lat: null, lng: null, status: "Ativa", tipo: "Pavimentação" },
  { id: 2, nome: "Reforma e Ampliação - IFES",                              local: "Alegre - ES", endereco: "Campus do IFES, Alegre - ES", refLocal: "Próximo ao bloco principal", lat: null, lng: null, status: "Ativa", tipo: "Edificação" },
  { id: 3, nome: "Drenagem e Pavimentação - Rua Projetada Antônio Lemos Jr", local: "Alegre - ES", endereco: "Rua Projetada Antônio Lemos Jr, Alegre - ES", refLocal: "", lat: null, lng: null, status: "Ativa", tipo: "Pavimentação" },
  { id: 4, nome: "Quadra Poliesportiva Jerônimo Monteiro",                  local: "Jerônimo Monteiro - ES", endereco: "Jerônimo Monteiro - ES", refLocal: "", lat: null, lng: null, status: "Ativa", tipo: "Edificação" },
];

const DEFAULT_TRABALHADORES = [
  // OBRA 1 — Emílio Marins
  { id: 1,  nome: "Geovane Pereira de Souza",      cargo: "Encarregado / Operador Retroescavadeira", obraId: 1,
    cpf: "108.453.227-89", rg: "2.345.678 SPTC/ES", nasc: "15/03/1982",
    tel: "(28) 99988-1234", endereco: "Rua das Acácias, 145 - Centro, Alegre - ES",
    tamCalca: "44", tamCamisa: "GG", tamBota: "42",
    diaria: "145" },

  { id: 2,  nome: "Adão Cortezes da Silva", cargo: "Pedreiro", obraId: 1,
    cpf: "092.614.037-00", rg: "1.876.345 SPTC/ES", nasc: "11/09/1976",
    tel: "(28) 99926-2485", endereco: "Rua João Pessoa, 234 - Bairro Triângulo, Alegre - ES",
    tamCalca: "42", tamCamisa: "G", tamBota: "41",
    diaria: "145" },

  { id: 3,  nome: "Tico (Antônio Carlos da Silva)", cargo: "Pedreiro", obraId: 1,
    cpf: "057.892.346-12", rg: "1.234.567 SPTC/ES", nasc: "22/06/1985",
    tel: "(28) 99815-6724", endereco: "Rua Bela Vista, 89 - Vila do Sul, Alegre - ES",
    tamCalca: "40", tamCamisa: "G", tamBota: "40",
    diaria: "145" },

  { id: 4,  nome: "Wilian dos Santos Pereira", cargo: "Pedreiro", obraId: 1,
    cpf: "143.567.892-44", rg: "2.156.789 SPTC/ES", nasc: "08/12/1988",
    tel: "(28) 99764-3812", endereco: "Rua Treze de Maio, 156 - Centro, Alegre - ES",
    tamCalca: "44", tamCamisa: "GG", tamBota: "42",
    diaria: "145" },

  { id: 5,  nome: "Ramom Ferreira Lima", cargo: "Pedreiro", obraId: 1,
    cpf: "176.234.567-91", rg: "2.987.654 SPTC/ES", nasc: "30/04/1990",
    tel: "(28) 99623-4571", endereco: "Rua Felício Alcuri, 45 - Bairro Gioia, Alegre - ES",
    tamCalca: "40", tamCamisa: "G", tamBota: "40",
    diaria: "145" },

  { id: 6,  nome: "Carlos Eduardo Moreira", cargo: "Pedreiro", obraId: 1,
    cpf: "098.765.432-15", rg: "1.654.321 SPTC/ES", nasc: "17/02/1979",
    tel: "(28) 99812-5634", endereco: "Av. Oscar de Almeida Gama, 78 - Centro, Alegre - ES",
    tamCalca: "42", tamCamisa: "G", tamBota: "41",
    diaria: "145" },

  { id: 7,  nome: "João Victor Ribeiro Machado", cargo: "Auxiliar", obraId: 1,
    cpf: "192.327.167-98", rg: "3.456.789 SPTC/ES", nasc: "14/08/2002",
    tel: "(28) 99942-3427",
    endereco: "Rua Loteamento Lúcio Chavier, Vila do Sul, Alegre - ES",
    tamCalca: "42", tamCamisa: "G", tamBota: "41/42",
    diaria: "100" },

  { id: 8,  nome: "João Paulo (João Capeta)", cargo: "Auxiliar",  obraId: 1,
    cpf: "165.432.871-26", rg: "2.564.789 SPTC/ES", nasc: "05/11/1995",
    tel: "(28) 99756-2348", endereco: "Rua Ararai, 234 - Distrito de Ararai, Alegre - ES",
    tamCalca: "40", tamCamisa: "M", tamBota: "39",
    diaria: "100" },

  { id: 9,  nome: "Jhonatan Souza Almeida", cargo: "Auxiliar", obraId: 1,
    cpf: "187.654.321-08", rg: "3.234.567 SPTC/ES", nasc: "27/07/1998",
    tel: "(28) 99687-4521", endereco: "Rua Monsenhor Pavesi, 67 - Centro, Alegre - ES",
    tamCalca: "40", tamCamisa: "G", tamBota: "40",
    diaria: "100" },

  { id: 10, nome: "Roney Carvalho Santos", cargo: "Pintor", obraId: 1,
    cpf: "121.345.678-32", rg: "1.987.654 SPTC/ES", nasc: "12/05/1983",
    tel: "(28) 99834-5612", endereco: "Rua Joaquim Borges, 123 - Centro, Alegre - ES",
    tamCalca: "42", tamCamisa: "GG", tamBota: "41",
    diaria: "145" },

  { id: 11, nome: "Nego (Nelson Marques)", cargo: "Auxiliar", obraId: 1,
    cpf: "134.567.890-44", rg: "2.345.612 SPTC/ES", nasc: "19/09/1992",
    tel: "(28) 99578-3421", endereco: "Rua Principal, 89 - Distrito do Café, Alegre - ES",
    tamCalca: "44", tamCamisa: "G", tamBota: "42",
    diaria: "100" },

  // OBRA 2 — IFES
  { id: 12, nome: "Rhiard Cavalcante Mendes", cargo: "Encarregado", obraId: 2,
    cpf: "156.789.012-65", rg: "2.876.543 SPTC/ES", nasc: "08/01/1986",
    tel: "(28) 99812-6743", endereco: "Av. Haroldo Bastos Valbão, 234 - Rive, Alegre - ES",
    tamCalca: "42", tamCamisa: "G", tamBota: "41",
    diaria: "145" },

  { id: 13, nome: "Bidão (Sebastião Ribeiro)", cargo: "Pintor", obraId: 2,
    cpf: "143.876.543-21", rg: "1.456.789 SPTC/ES", nasc: "23/10/1974",
    tel: "(28) 99645-2387", endereco: "Rua Euclides Jaccoud Junior, 78 - Rive, Alegre - ES",
    tamCalca: "44", tamCamisa: "GG", tamBota: "42",
    diaria: "145" },

  { id: 14, nome: "Bruno Henrique Costa", cargo: "Eletricista", obraId: 2,
    cpf: "176.543.210-87", rg: "2.654.321 SPTC/ES", nasc: "16/06/1989",
    tel: "(28) 99723-8456", endereco: "Rua Antônio Correa, 45 - Bairro Boa Vista, Alegre - ES",
    tamCalca: "40", tamCamisa: "G", tamBota: "40",
    diaria: "145" },

  // OBRA 4 — Quadra Poliesportiva Jerônimo Monteiro
  { id: 15, nome: "Marcos Oliveira Cardoso", cargo: "Encarregado", obraId: 4,
    cpf: "198.234.567-43", rg: "3.012.345 SPTC/ES", nasc: "11/04/1981",
    tel: "(28) 99845-6712", endereco: "Rua Floriano Peixoto, 156 - Centro, Jerônimo Monteiro - ES",
    tamCalca: "42", tamCamisa: "G", tamBota: "41",
    diaria: "145" },

  { id: 16, nome: "Marcelo Pereira da Silva", cargo: "Pedreiro", obraId: 4,
    cpf: "165.789.234-78", rg: "2.789.012 SPTC/ES", nasc: "29/07/1987",
    tel: "(28) 99578-3412", endereco: "Rua João Rita, 78 - Centro, Jerônimo Monteiro - ES",
    tamCalca: "42", tamCamisa: "GG", tamBota: "42",
    diaria: "145" },

  // ESCRITÓRIO / GERÊNCIA
  { id: 17, nome: "Kleber Vieira Martins", cargo: "Engenheiro / Diretor", obraId: 0,
    cpf: "075.345.678-90", rg: "1.234.567 SPTC/ES", nasc: "—",
    tel: "(28) 99925-8172", endereco: "Alegre - ES",
    diaria: "170" },

  { id: 18, nome: "Mozart Andrade Silveira", cargo: "Mestre de Obras", obraId: 0,
    cpf: "143.234.567-12", rg: "2.456.789 SPTC/ES", nasc: "14/02/1972",
    tel: "(28) 99812-3456", endereco: "Centro, Alegre - ES",
    diaria: "250" },
];

/* ════════════════════════════════════
   GERADOR DE 30 DIAS — pré-popula tudo
   Isso roda uma vez quando o app abre vazio
════════════════════════════════════ */
function gerarDadosMes30Dias() {
  const hoje = new Date();
  const trabs = [
    { id: 1, obraId: 1 }, { id: 2, obraId: 1 }, { id: 3, obraId: 1 }, { id: 4, obraId: 1 },
    { id: 5, obraId: 1 }, { id: 6, obraId: 1 }, { id: 7, obraId: 1 }, { id: 8, obraId: 1 },
    { id: 9, obraId: 1 }, { id: 10, obraId: 1 }, { id: 11, obraId: 1 },
    { id: 12, obraId: 2 }, { id: 13, obraId: 2 }, { id: 14, obraId: 2 },
    { id: 15, obraId: 4 }, { id: 16, obraId: 4 },
  ];
  const obrasAtivas = [
    { id: 1, nome: "Drenagem Rua Emílio Marins (Trecho 2)", encarregado: "Geovane" },
    { id: 2, nome: "Reforma e Ampliação - IFES", encarregado: "Rhiard" },
    { id: 4, nome: "Quadra Poliesportiva Jerônimo Monteiro", encarregado: "Marcos" },
  ];

  // Materiais e despesas
  const materiais = [
    { nome: "Cimento CP-II", unid: "saco", marca: "Mizu", catg: "Cimentos" },
    { nome: "Areia Lavada", unid: "m³", marca: "—", catg: "Agregados" },
    { nome: "Brita 1", unid: "m³", marca: "—", catg: "Agregados" },
    { nome: "Bloco Cerâmico 14x19x39", unid: "milheiro", marca: "—", catg: "Alvenaria" },
    { nome: "Vergalhão 10mm", unid: "barra", marca: "Gerdau", catg: "Aço" },
    { nome: "Pó de pedra", unid: "m³", marca: "—", catg: "Agregados" },
    { nome: "Tubo PVC 100mm", unid: "barra", marca: "Tigre", catg: "Hidráulica" },
    { nome: "Tinta Acrílica Branca", unid: "lata 18L", marca: "Suvinil", catg: "Tintas" },
    { nome: "Argamassa AC-II", unid: "saco", marca: "Quartzolit", catg: "Cimentos" },
    { nome: "Cal Hidratada", unid: "saco", marca: "Itaú", catg: "Cimentos" },
  ];
  const despesasModelo = [
    { categoria: "PIPA d'água", descricao: "Pipa 8.000L para concretagem", valor: 280 },
    { categoria: "Frete avulso", descricao: "Caçamba caminhão de areia", valor: 150 },
    { categoria: "Almoço terceiros", descricao: "Almoço motorista da betoneira", valor: 35 },
    { categoria: "Solo/bica", descricao: "1 carrada de bica corrida", valor: 220 },
    { categoria: "Manutenção avulsa", descricao: "Conserto da betoneira", valor: 180 },
    { categoria: "Hospedagem", descricao: "Pernoite operador retroescavadeira", valor: 120 },
    { categoria: "Diária extra", descricao: "Hora extra fim de semana", valor: 145 },
    { categoria: "Taxas", descricao: "Taxa Prefeitura — alvará", valor: 95 },
  ];
  const ocorrencias = [
    "Chuva forte interrompeu a concretagem por 2h. Equipe aproveitou pra organizar o canteiro.",
    "Visita técnica do fiscal hoje. Tudo aprovado.",
    "Falta de material no almoxarifado. Já solicitei pedido novo.",
    "Treinamento de segurança realizado com toda a equipe (NR-18).",
    "Caminhão de concreto atrasou 1h. Sem prejuízo grande.",
    "Vazamento detectado na tubulação principal. Já comuniquei o gestor.",
    "Concretagem da viga V1 concluída com sucesso.",
    "Equipe completa hoje. Produtividade ótima.",
    "Recebimento de material da Leal Material — tudo conferido.",
    "Bate-bate com o concreto, fizemos correção no nivel.",
  ];
  const legendasFotos = [
    "Mobilização da equipe", "Concretagem em andamento", "Almoço da equipe",
    "Verificação de qualidade", "Final do expediente",
    "Locação de canteiro", "Forma da viga V2", "Armação pronta pra concretar",
    "Limpeza do terreno", "Equipe trabalhando"
  ];

  const historico = {};
  const fotosObras = [];
  const rdosEmitidos = [];
  const pedidos = [];
  const movimentacoes = [];
  const movEquip = [];
  const diario = [];
  const despesasAvulsas = [];
  const adiantamentos = [];
  const recebimentos = [];
  const abastecimentos = [];
  const produtividade = [];

  let pedidoNum = 1;
  let movNum = 1;
  let movEqNum = 1;
  let rdoNum = 1;
  let fotoId = 1;
  let despId = 1;
  let diaId = 1;
  const fotosPorObra = {};

  // 30 dias atrás até hoje
  for (let d = 29; d >= 0; d--) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() - d);
    const isoData = data.toISOString().split("T")[0];
    const dataStr = data.toLocaleDateString("pt-BR");
    const ts = data.getTime();
    const diaSemana = data.getDay();

    if (diaSemana === 0) continue; // pula domingos

    // PRESENÇAS (70/20/10)
    historico[isoData] = {};
    trabs.forEach(t => {
      const r = Math.random();
      if (r < 0.70) historico[isoData][t.id] = "Presente";
      else if (r < 0.90) historico[isoData][t.id] = "Falta";
      else historico[isoData][t.id] = "Atestado";
    });

    // RDO + 5 fotos por obra (apenas dias úteis com obras ativas)
    obrasAtivas.forEach((obra, idxObra) => {
      const trabsObra = trabs.filter(t => t.obraId === obra.id);
      if (trabsObra.length === 0) return;

      const presentes = trabsObra.filter(t => historico[isoData][t.id] === "Presente").length;
      const faltas = trabsObra.filter(t => historico[isoData][t.id] === "Falta").length;
      const atestados = trabsObra.filter(t => historico[isoData][t.id] === "Atestado").length;

      // 5 fotos
      if (!fotosPorObra[obra.id]) fotosPorObra[obra.id] = 0;
      const fotosDia = [];
      for (let f = 0; f < 5; f++) {
        fotosPorObra[obra.id]++;
        const numero = fotosPorObra[obra.id];
        const horaFoto = ["08:30", "10:15", "12:30", "14:45", "16:50"][f];
        // Placeholder em texto (sem canvas, leve)
        const placeholderUrl = `data:image/svg+xml;utf8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><linearGradient id="g${numero}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${["#0f2151","#0891b2","#16a34a","#7c3aed"][idxObra % 4]}"/><stop offset="1" stop-color="#000"/></linearGradient></defs><rect width="800" height="600" fill="url(#g${numero})"/><text x="400" y="240" font-size="120" text-anchor="middle" fill="rgba(255,255,255,0.2)" font-family="Arial">${["🏗️","🏛️","🏟️","🛣️"][idxObra % 4]}</text><text x="400" y="350" font-size="34" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-weight="bold">${obra.nome.substring(0, 28)}</text><text x="400" y="395" font-size="22" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="Arial">Foto #${String(numero).padStart(3, "0")} — ${dataStr}</text><rect x="40" y="490" width="720" height="80" rx="10" fill="rgba(0,0,0,0.6)" stroke="#f5a623" stroke-width="3"/><text x="60" y="525" font-size="22" fill="#f5a623" font-family="Arial,sans-serif" font-weight="bold">KMZERO</text><text x="60" y="555" font-size="16" fill="#fff" font-family="Arial">Foto #${String(numero).padStart(3, "0")} — ${horaFoto}</text><text x="740" y="525" font-size="14" fill="#fff" text-anchor="end" font-family="Arial">📅 ${dataStr}</text><text x="740" y="555" font-size="14" fill="#fff" text-anchor="end" font-family="Arial">👷 ${obra.encarregado}</text></svg>`
        )}`;
        fotosObras.push({
          id: fotoId++,
          numero,
          obraId: obra.id,
          obraNome: obra.nome,
          foto: placeholderUrl,
          legenda: legendasFotos[(numero + f) % legendasFotos.length],
          autor: obra.encarregado,
          data: dataStr,
          hora: horaFoto,
          origemRDO: rdoNum,
        });
        fotosDia.push(placeholderUrl);
      }

      // RDO
      const presencas = {};
      const horasTrabalhadas = {};
      const alimentacao = {};
      trabsObra.forEach(t => {
        presencas[t.id] = historico[isoData][t.id];
        if (presencas[t.id] === "Presente") {
          horasTrabalhadas[t.id] = 9 + (Math.random() < 0.2 ? 1 : 0);
          alimentacao[t.id] = { cafeManha: true, marmita: true, cafeTarde: false, lanche: false };
        }
      });
      let totalHE = 0;
      Object.values(horasTrabalhadas).forEach(h => { if (h > 9) totalHE += h - 9; });

      rdosEmitidos.push({
        id: ts + rdoNum,
        numero: rdoNum++,
        obraId: obra.id,
        data: dataStr,
        dataIso: isoData,
        encarregado: obra.encarregado,
        clima: ["Bom", "Bom", "Bom", "Nublado", "Chuvoso"][Math.floor(Math.random() * 5)],
        observacoes: `Equipe trabalhou normalmente. ${presentes} presente(s), ${faltas} falta(s), ${atestados} atestado(s). 5 foto(s) registrada(s).`,
        ts,
        autoGerado: true,
        horasTrabalhadas,
        totalHE: +totalHE.toFixed(1),
        horimetros: obra.id === 1 ? { 1: { inicio: 1234 + (29 - d) * 8, fim: 1234 + (29 - d) * 8 + 7, horas: 7 } } : {},
        fotos: fotosDia,
        presencas,
        alimentacao,
        totalAlimentacao: presentes * 23,
      });
    });

    // PEDIDOS: 1-2 por obra por dia útil (volume real de obra ativa)
    obrasAtivas.forEach(obraEsc => {
      const trabsObra = trabs.filter(t => t.obraId === obraEsc.id);
      if (trabsObra.length === 0) return;

      // 60% chance de ter 1 pedido + 30% chance de ter 2 pedidos
      const r1 = Math.random();
      const qtdPedidos = r1 < 0.6 ? 1 : (r1 < 0.9 ? 2 : 0);

      for (let p = 0; p < qtdPedidos; p++) {
        const numItens = Math.floor(Math.random() * 4) + 1; // 1-4 itens
        const itens = [];
        for (let i = 0; i < numItens; i++) {
          const m = materiais[Math.floor(Math.random() * materiais.length)];
          itens.push({
            material: m.nome,
            qtd: (Math.floor(Math.random() * 20) + 1) + " " + m.unid,
            marca: m.marca,
            categoria: m.catg,
            obs: ""
          });
        }
        const r2 = Math.random();
        // Pedidos recentes (últimos 3 dias) tendem a estar aguardando
        const status = d <= 3 ? (r2 < 0.5 ? "Aguardando" : "Aprovado") : (r2 < 0.80 ? "Aprovado" : r2 < 0.92 ? "Negado" : "Aguardando");

        pedidos.push({
          id: ts + pedidoNum + p * 100,
          numero: pedidoNum++,
          obraId: obraEsc.id,
          obra: obraEsc.nome,
          encarregado: obraEsc.encarregado,
          itens,
          material: itens[0].material,
          qtd: itens[0].qtd,
          marca: itens[0].marca,
          categoria: itens[0].categoria,
          obs: "",
          status,
          dataSolicitacao: dataStr,
          formaPagamento: status === "Aprovado" ? ["À vista", "Boleto 30 dias", "Boleto 15 dias", "PIX antecipado"][Math.floor(Math.random() * 4)] : "",
          prazo: status === "Aprovado" ? new Date(ts + (Math.floor(Math.random() * 5) + 2) * 86400000).toLocaleDateString("pt-BR") : "",
          prazoEntrega: status === "Aprovado" ? new Date(ts + (Math.floor(Math.random() * 5) + 2) * 86400000).toLocaleDateString("pt-BR") : "",
          ts,
        });
      }
    });

    // DESPESAS AVULSAS: 1 a cada 2 dias por obra (PIPA, frete, lanches, etc)
    if (d % 2 === 0) {
      obrasAtivas.forEach(obraEsc => {
        const desp = despesasModelo[Math.floor(Math.random() * despesasModelo.length)];
        despesasAvulsas.push({
          id: ts + despId++,
          obraId: obraEsc.id,
          obraNome: obraEsc.nome,
          categoria: desp.categoria,
          descricao: desp.descricao,
          valor: desp.valor,
          data: dataStr,
          autor: "Kleber Vieira Martins",
          ts,
        });
      });
    }

    // DIÁRIO a cada 5 dias
    if (d % 5 === 0) {
      const obraEsc = obrasAtivas[Math.floor(Math.random() * obrasAtivas.length)];
      diario.push({
        id: ts + diaId++,
        obraId: obraEsc.id,
        autor: obraEsc.encarregado,
        texto: ocorrencias[Math.floor(Math.random() * ocorrencias.length)],
        foto: null,
        ts,
      });
    }

    // MOVIMENTAÇÃO de pessoal a cada 7 dias
    if (d % 7 === 0 && d > 0) {
      const trabsEM = trabs.filter(t => t.obraId === 1);
      if (trabsEM.length > 1) {
        const trabEsc = trabsEM[Math.floor(Math.random() * trabsEM.length)];
        movimentacoes.push({
          id: ts + movNum,
          numero: movNum++,
          trabId: trabEsc.id,
          trabNome: ["Adão Cortezes da Silva", "Tico", "Wilian", "Carlos", "Roney"][Math.floor(Math.random() * 5)],
          obraOrigem: 1,
          obraDestino: 2,
          tipo: Math.random() < 0.6 ? "hoje" : "definitiva",
          motivo: ["Reforço para a concretagem", "Apoio na alvenaria", "Substituir falta da equipe"][Math.floor(Math.random() * 3)],
          solicitante: "Geovane",
          status: d <= 1 ? "Aguardando" : "Aprovado",
          data: dataStr,
          ts,
        });
      }
    }

    // MOV. EQUIPAMENTO ocasional (a cada 10 dias)
    if (d % 10 === 0 && d > 0) {
      movEquip.push({
        id: ts + movEqNum,
        numero: movEqNum++,
        tipoItem: "equipamento",
        itemId: 1,
        itemNome: "Betoneira 400L",
        itemCodigo: "BET-001",
        obraOrigemId: 1,
        obraOrigemNome: "Drenagem Rua Emílio Marins (Trecho 2)",
        obraDestinoId: 2,
        obraDestinoNome: "Reforma e Ampliação - IFES",
        tipo: "emprestimo",
        prazo: new Date(ts + 7 * 86400000).toISOString().split("T")[0],
        motivo: "Concretagem da fundação",
        solicitante: "Rhiard",
        status: d <= 2 ? "Aguardando" : "Aprovado",
        dataSolicitacao: dataStr,
        ts,
      });
    }

    // ABASTECIMENTOS a cada 5 dias (para retroescavadeira e carro)
    if (d % 5 === 0) {
      abastecimentos.push({
        id: ts + d,
        ativoId: 1, // Retroescavadeira
        obraId: 1, // Emílio Marins (onde tá a retro)
        data: dataStr,
        ts,
        litros: 30 + Math.floor(Math.random() * 20),
        valor: 180 + Math.floor(Math.random() * 80),
        kmAtual: 1234 + (29 - d) * 25,
        posto: "Posto Rive",
        obs: "",
      });
    }

    // RECEBIMENTOS — 1 por semana
    if (d % 7 === 0 && d > 0) {
      const obraEsc = obrasAtivas[Math.floor(Math.random() * obrasAtivas.length)];
      recebimentos.push({
        id: ts + d,
        obraId: obraEsc.id,
        obraNome: obraEsc.nome,
        descricao: `Medição #${4 - Math.floor(d / 7)} — ${obraEsc.nome}`,
        valor: 15000 + Math.floor(Math.random() * 25000),
        data: dataStr,
        forma: "Transferência",
        observacao: "",
      });
    }

    // ADIANTAMENTOS — 2 ao longo do mês
    if (d === 22 || d === 8) {
      const trabId = d === 22 ? 2 : 5;
      adiantamentos.push({
        id: ts,
        trabId,
        trabNome: d === 22 ? "Adão Cortezes da Silva" : "Ramom",
        valor: 200,
        data: dataStr,
        descontado: false,
        observacao: "Adiantamento solicitado pelo trabalhador",
      });
    }
  }

  // PRODUTIVIDADE — várias entradas espalhadas no mês (1 a cada 4-5 dias por obra)
  const tiposProduzidos = [
    { tipo: "Alvenaria",    unidade: "m²", base: 28, var: 12 },
    { tipo: "Concretagem",  unidade: "m³", base: 12, var: 6  },
    { tipo: "Reboco",       unidade: "m²", base: 35, var: 15 },
    { tipo: "Pintura",      unidade: "m²", base: 42, var: 18 },
    { tipo: "Escavação",    unidade: "m³", base: 25, var: 10 },
    { tipo: "Piso",         unidade: "m²", base: 30, var: 12 },
    { tipo: "Forro",        unidade: "m²", base: 18, var: 8  },
  ];
  const obsExemplos = [
    "Parede norte do bloco A",
    "Laje do segundo pavimento",
    "Sala 03 e corredor",
    "Fundação trecho 2",
    "Trecho da rua entre PV1 e PV2",
    "Concretagem da viga V12",
    "Acabamento da fachada",
  ];
  let prodIdCounter = 1;
  for (let d = 28; d >= 1; d -= 4) {
    obrasAtivas.forEach((obra, idx) => {
      const data = new Date(hoje);
      data.setDate(hoje.getDate() - d);
      // Pula domingo
      if (data.getDay() === 0) return;
      const tp = tiposProduzidos[(d + idx) % tiposProduzidos.length];
      const qtd = +(tp.base + Math.random() * tp.var).toFixed(1);
      produtividade.push({
        id: data.getTime() + prodIdCounter++,
        obraId: obra.id,
        tipo: tp.tipo,
        qtd,
        unidade: tp.unidade,
        obs: obsExemplos[(d + idx) % obsExemplos.length],
        autor: obra.encarregado,
        ts: data.getTime(),
        data: data.toLocaleDateString("pt-BR"),
      });
    });
  }

  return { historico, fotosObras, rdosEmitidos, pedidos, movimentacoes, movEquip, diario, despesasAvulsas, adiantamentos, recebimentos, abastecimentos, produtividade };
}

const DEFAULT_EQUIPS = [
  // EMÍLIO MARINS — equipe grande, mais equipamentos
  { id: 1,  nome: "Betoneira 400L",          codigo: "BET-001", status: "Em Uso",     obraId: 1, icon: "🔄", valorAprox: 2500 },
  { id: 2,  nome: "Vibrador de Concreto",    codigo: "VIB-001", status: "Em Uso",     obraId: 1, icon: "⚙️", valorAprox: 1800 },
  { id: 3,  nome: "Compactador de Placa",    codigo: "CPL-001", status: "Em Uso",     obraId: 1, icon: "🛠️", valorAprox: 5000 },
  { id: 4,  nome: "Martelete / Rompedor",    codigo: "MAR-001", status: "Em Uso",     obraId: 1, icon: "🔨", valorAprox: 1200 },
  { id: 5,  nome: "Serra Circular",          codigo: "SER-001", status: "Em Uso",     obraId: 1, icon: "⚙️", valorAprox: 600 },
  { id: 6,  nome: "Furadeira de Impacto",    codigo: "FUR-001", status: "Em Uso",     obraId: 1, icon: "🔧", valorAprox: 400 },
  { id: 7,  nome: "Esmerilhadeira",          codigo: "ESM-001", status: "Em Uso",     obraId: 1, icon: "⚙️", valorAprox: 350 },
  { id: 8,  nome: "Régua Vibratória",        codigo: "REG-001", status: "Em Uso",     obraId: 1, icon: "🔄", valorAprox: 2200 },

  // IFES — reforma, mais equipamentos finos
  { id: 9,  nome: "Furadeira de Impacto",    codigo: "FUR-002", status: "Em Uso",     obraId: 2, icon: "🔧", valorAprox: 400 },
  { id: 10, nome: "Esmerilhadeira",          codigo: "ESM-002", status: "Em Uso",     obraId: 2, icon: "⚙️", valorAprox: 350 },
  { id: 11, nome: "Serra Mármore",           codigo: "SMA-001", status: "Em Uso",     obraId: 2, icon: "⚙️", valorAprox: 700 },
  { id: 12, nome: "Lixadeira de Parede",     codigo: "LIX-001", status: "Em Uso",     obraId: 2, icon: "🛠️", valorAprox: 850 },
  { id: 13, nome: "Betoneira 150L",          codigo: "BET-002", status: "Em Uso",     obraId: 2, icon: "🔄", valorAprox: 1800 },

  // ANTÔNIO LEMOS — pavimentação iniciando
  { id: 14, nome: "Betoneira 400L",          codigo: "BET-003", status: "Disponível", obraId: 3, icon: "🔄", valorAprox: 2500 },
  { id: 15, nome: "Compactador de Placa",    codigo: "CPL-002", status: "Disponível", obraId: 3, icon: "🛠️", valorAprox: 5000 },

  // QUADRA JERÔNIMO MONTEIRO
  { id: 16, nome: "Betoneira 400L",          codigo: "BET-004", status: "Em Uso",     obraId: 4, icon: "🔄", valorAprox: 2500 },
  { id: 17, nome: "Vibrador de Concreto",    codigo: "VIB-002", status: "Em Uso",     obraId: 4, icon: "⚙️", valorAprox: 1800 },
  { id: 18, nome: "Furadeira de Impacto",    codigo: "FUR-003", status: "Em Uso",     obraId: 4, icon: "🔧", valorAprox: 400 },
];

const CARGOS = ["Pedreiro","Armador","Servente","Auxiliar","Eletricista","Encanador","Mestre de Obras","Encarregado","Encarregado / Operador Retroescavadeira","Operador de Máquina","Carpinteiro","Pintor","Azulejista","Motorista","Vigia"];
// Banco completo de materiais — 500+ itens organizados por categoria
// Função utilitária: detecta unidade ideal a partir do nome do material
const detectarUnidade = (nome) => {
  const n = (nome || "").toLowerCase();
  // Específicas
  if (/\bm[³3]\b|\b³\b/.test(n)) return "m³";
  if (/\bm[²2]\b|\b²\b/.test(n)) return "m²";
  if (/\bton\b|\btonelada/.test(n)) return "ton";
  if (/\bkg\b/.test(n) && !/saco/.test(n)) return "kg";
  if (/\b\d+\s?l\b|\blitro/.test(n)) return "unidades";
  // Materiais embalados
  if (/cimento|argamassa|rejunte|gesso|cal|massa corrida|massa acrílica|massa epóxi/.test(n)) return "sacos";
  // Tubos / barras / vergalhão
  if (/vergalhão|barra de aço|tirante/.test(n)) return "barras";
  if (/tubo |cano |eletroduto/.test(n)) return "barras";
  // Rolos / mantas
  if (/cabo |fio |fita |arame |bidim|geotêxtil|geomembrana|manta|lona|tela mosquiteiro|tela de prote/.test(n)) return "rolos";
  // Telhas / tijolos / blocos / pisos / revestimentos
  if (/telha|tijolo|bloco|piso |porcelanato|azulejo|pastilha|paralelepípedo|pedra portuguesa|meio-fio|sarjeta|cordão|cumeeira|calha|rufo/.test(n)) return "unidades";
  // Madeira / tábuas / sarrafos
  if (/tábua|sarrafo|caibro|ripa|madeirite|compensado|mdf|pontalete|viga de eucalipto|estaca/.test(n)) return "peças";
  // Areia / brita / pedra
  if (/areia|brita|saibro|pó de pedra|bica|rachão|pedrisco|pedra-mãe|graduada/.test(n)) return "m³";
  // Concreto
  if (/concreto/.test(n) && !/peças|estrutural/.test(n)) return "m³";
  // Pintura
  if (/tinta|verniz|selador|aditivo|hidrofugante|cola |veda |solução|emulsão asfáltica|pintura de ligação/.test(n)) return "unidades";
  // EPI / Ferramentas / Pequenos
  if (/luva|capacete|óculos|protetor|máscara|cinto|abafador|bota /.test(n)) return "unidades";
  if (/martelo|marreta|talhadeira|picareta|pá |carrinho|caçamba|colher de pedreiro|desempenadeira|régua|trena|nível|prumo|esquadro|linha de pedreiro|bisnaga/.test(n)) return "unidades";
  if (/lâmina|disco|broca|parafuso|prego|pino/.test(n)) return "unidades";
  // Caixa d'água
  if (/caixa d.água/.test(n)) return "unidades";
  // Default
  return "unidades";
};

// Banco estruturado de materiais
// formato: { nome, unidadePadrao, marcas?, categoria }

/* ════════════════════════════════════
   CATÁLOGO PROFISSIONAL — versão essencial
   (Versão completa de 999 mat. removida pra não estourar limite do Claude.ai)
════════════════════════════════════ */
const CATALOGO_KM_FULL = [
  ["01.100.0001", "Solo de Empréstimo", "m³", "Infraestrutura", "Terraplenagem"],
  ["01.100.0002", "Areia de Aterro", "m³", "Infraestrutura", "Terraplenagem"],
  ["01.100.0003", "Bica Corrida", "m³", "Infraestrutura", "Terraplenagem"],
  ["01.100.0004", "Pedra Rachão", "m³", "Infraestrutura", "Terraplenagem"],
  ["01.100.0005", "Pedra de Mão", "m³", "Infraestrutura", "Terraplenagem"],
  ["01.100.0006", "Cascalho", "m³", "Infraestrutura", "Terraplenagem"],
  ["01.100.0007", "Saibro", "m³", "Infraestrutura", "Terraplenagem"],
  ["01.100.0008", "Geotêxtil RT-7 200g/m²", "m²", "Infraestrutura", "Terraplenagem"],
  ["01.100.0009", "Geotêxtil RT-10 300g/m²", "m²", "Infraestrutura", "Terraplenagem"],
  ["01.100.0010", "Geotêxtil RT-14 400g/m²", "m²", "Infraestrutura", "Terraplenagem"],
  ["01.100.0011", "Geogrelha Biaxial 30/30 kN/m", "m²", "Infraestrutura", "Terraplenagem"],
  ["01.100.0012", "Geogrelha Biaxial 40/40 kN/m", "m²", "Infraestrutura", "Terraplenagem"],
  ["01.100.0013", "Geogrelha Uniaxial 60 kN/m", "m²", "Infraestrutura", "Terraplenagem"],
  ["01.100.0014", "Geogrelha Uniaxial 110 kN/m", "m²", "Infraestrutura", "Terraplenagem"],
  ["01.100.0015", "Geomembrana PEAD 0,8mm", "m²", "Infraestrutura", "Terraplenagem"],
  ["01.200.0001", "Tubo Concreto Armado PA-1 DN 200mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0002", "Tubo Concreto Armado PA-2 DN 200mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0003", "Tubo Concreto Armado PA-3 DN 200mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0004", "Tubo Concreto Armado PA-4 DN 200mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0005", "Tubo Concreto Armado PA-1 DN 300mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0006", "Tubo Concreto Armado PA-2 DN 300mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0007", "Tubo Concreto Armado PA-3 DN 300mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0008", "Tubo Concreto Armado PA-4 DN 300mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0009", "Tubo Concreto Armado PA-1 DN 400mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0010", "Tubo Concreto Armado PA-2 DN 400mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0011", "Tubo Concreto Armado PA-3 DN 400mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0012", "Tubo Concreto Armado PA-4 DN 400mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0013", "Tubo Concreto Armado PA-1 DN 500mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0014", "Tubo Concreto Armado PA-2 DN 500mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.200.0015", "Tubo Concreto Armado PA-3 DN 500mm L=1,00m", "un", "Infraestrutura", "Drenagem"],
  ["01.300.0001", "CBUQ Faixa A", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0002", "CBUQ Faixa B", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0003", "CBUQ Faixa C", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0004", "CBUQ Faixa D", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0005", "CAP 30/45", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0006", "CAP 50/70", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0007", "CAP 85/100", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0008", "Asfalto Borracha AB-22", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0009", "Asfalto Polímero SBS", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0010", "Emulsão Asfáltica RR-1C", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0011", "Emulsão Asfáltica RR-2C", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0012", "Emulsão Asfáltica RM-1C", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0013", "Emulsão Catiônica RC-1C", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0014", "Asfalto Diluído CM-30", "t", "Infraestrutura", "Pavimentação"],
  ["01.300.0015", "Asfalto Diluído CM-70", "t", "Infraestrutura", "Pavimentação"],
  ["02.100.0001", "Vergalhão CA-50 6.3mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0002", "Vergalhão CA-50 8.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0003", "Vergalhão CA-50 10.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0004", "Vergalhão CA-50 12.5mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0005", "Vergalhão CA-50 16.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0006", "Vergalhão CA-50 20.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0007", "Vergalhão CA-50 25.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0008", "Vergalhão CA-50 32.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0009", "Vergalhão CA-50 40.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0010", "Vergalhão CA-60 4.2mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0011", "Vergalhão CA-60 5.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0012", "Vergalhão CA-60 6.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0013", "Vergalhão CA-60 7.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0014", "Vergalhão CA-60 8.0mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.100.0015", "Vergalhão CA-60 9.5mm – Barra 12m", "kg", "Estrutura e Alvenaria", "Aços"],
  ["02.200.0001", "Cimento CP I-S-32 – Saco 50kg", "sc", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0002", "Cimento CP I-S-32 – Big Bag 1t", "tb", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0003", "Cimento CP II-E-32 – Saco 50kg", "sc", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0004", "Cimento CP II-E-32 – Big Bag 1t", "tb", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0005", "Cimento CP II-E-40 – Saco 50kg", "sc", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0006", "Cimento CP II-E-40 – Big Bag 1t", "tb", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0007", "Cimento CP II-F-32 – Saco 50kg", "sc", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0008", "Cimento CP II-F-32 – Big Bag 1t", "tb", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0009", "Cimento CP II-F-40 – Saco 50kg", "sc", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0010", "Cimento CP II-F-40 – Big Bag 1t", "tb", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0011", "Cimento CP II-Z-32 – Saco 50kg", "sc", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0012", "Cimento CP II-Z-32 – Big Bag 1t", "tb", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0013", "Cimento CP III-32-RS – Saco 50kg", "sc", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0014", "Cimento CP III-32-RS – Big Bag 1t", "tb", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0015", "Cimento CP III-40 – Saco 50kg", "sc", "Estrutura e Alvenaria", "Cimentos"],
  ["02.200.0035", "Concreto Usinado fck 15 MPa Convencional Brita 1", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0036", "Concreto Usinado fck 15 MPa Convencional Brita 0", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0037", "Concreto Usinado fck 15 MPa Bombeável Brita 0", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0038", "Concreto Usinado fck 15 MPa Autoadensável (CAA)", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0039", "Concreto Usinado fck 15 MPa Alto Desempenho (CAD)", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0040", "Concreto Usinado fck 15 MPa com Microfibra", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0041", "Concreto Usinado fck 15 MPa com Macrofibra Aço", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0042", "Concreto Usinado fck 15 MPa Leve com Argila Expandida", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0043", "Concreto Usinado fck 15 MPa Projetado", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0044", "Concreto Usinado fck 15 MPa Subaquático", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0045", "Concreto Usinado fck 18 MPa Convencional Brita 1", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0046", "Concreto Usinado fck 18 MPa Convencional Brita 0", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0047", "Concreto Usinado fck 18 MPa Bombeável Brita 0", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0048", "Concreto Usinado fck 18 MPa Autoadensável (CAA)", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0049", "Concreto Usinado fck 18 MPa Alto Desempenho (CAD)", "m³", "Estrutura e Alvenaria", "Concretos"],
  ["02.200.0159", "Brita 0 (Pedrisco)", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0160", "Brita 1", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0161", "Brita 2", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0162", "Brita 3", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0163", "Brita 4", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0164", "Brita 5", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0165", "Pó de Pedra", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0166", "Pedrisco Lavado", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0167", "Areia Grossa Lavada", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0168", "Areia Média Lavada", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0169", "Areia Fina Lavada", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0170", "Areia Reciclada", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0171", "Areia Industrial", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0172", "Areia para Reboco", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0173", "Areia para Filtro", "m³", "Estrutura e Alvenaria", "Agregados"],
  ["02.200.0189", "Argamassa AC-I Cinza Saco 20kg", "sc", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0190", "Argamassa AC-I Branca Saco 20kg", "sc", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0191", "Argamassa AC-II Cinza Saco 20kg", "sc", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0192", "Argamassa AC-II Branca Saco 20kg", "sc", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0193", "Argamassa AC-III Porcelanato Cinza Saco 20kg", "sc", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0194", "Argamassa AC-III Porcelanato Branca Saco 20kg", "sc", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0195", "Argamassa AC-III Externa Cinza Saco 20kg", "sc", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0196", "Argamassa AC-III Externa Branca Saco 20kg", "sc", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0197", "Argamassa Polimérica MultiUso Saco 20kg", "sc", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0198", "Argamassa Estabilizada de Assentamento", "kg", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0199", "Argamassa Estabilizada de Reboco", "kg", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0200", "Argamassa Industrializada para Bloco Estrutural", "kg", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0201", "Argamassa Refratária", "kg", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0202", "Argamassa para Pedra Natural", "kg", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.200.0203", "Argamassa Decorativa Grafiato", "kg", "Estrutura e Alvenaria", "Argamassas e Rejuntes"],
  ["02.300.0001", "Bloco Cerâmico Vedação 6 Furos 9x14x19", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0002", "Bloco Cerâmico Vedação 6 Furos 9x14x24", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0003", "Bloco Cerâmico Vedação 8 Furos 9x19x19", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0004", "Bloco Cerâmico Vedação 8 Furos 9x19x24", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0005", "Bloco Cerâmico Vedação 9 Furos 11,5x19x24", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0006", "Bloco Cerâmico Vedação 11,5x19x39", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0007", "Bloco Cerâmico Estrutural 14x19x29", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0008", "Bloco Cerâmico Estrutural 14x19x39", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0009", "Tijolo Cerâmico Maciço 5x10x20", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0010", "Tijolo Cerâmico Maciço 5x10x23", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0011", "Tijolo Cerâmico Aparente Refratário", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0012", "Tijolo Refratário Comum", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0013", "Tijolo Baiano 9x14x19", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0014", "Tijolo de Vidro 19x19x8cm", "un", "Estrutura e Alvenaria", "Vedação"],
  ["02.300.0015", "Bloco de Concreto Vedação 9x19x19", "un", "Estrutura e Alvenaria", "Vedação"],
  ["03.100.0001", "Tubo PVC Soldável Marrom DN 20mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0002", "Tubo PVC Soldável Marrom DN 25mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0003", "Tubo PVC Soldável Marrom DN 32mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0004", "Tubo PVC Soldável Marrom DN 40mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0005", "Tubo PVC Soldável Marrom DN 50mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0006", "Tubo PVC Soldável Marrom DN 60mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0007", "Tubo PVC Soldável Marrom DN 75mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0008", "Tubo PVC Soldável Marrom DN 85mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0009", "Tubo PVC Soldável Marrom DN 100mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0010", "Tubo PVC Soldável Marrom DN 110mm Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0011", "Tubo PVC Roscável Branco DN 1/2\" Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0012", "Tubo PVC Roscável Branco DN 3/4\" Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0013", "Tubo PVC Roscável Branco DN 1\" Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0014", "Tubo PVC Roscável Branco DN 1.1/4\" Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0015", "Tubo PVC Roscável Branco DN 1.1/2\" Barra 6m", "br", "Hidrossanitária", "Água Fria – Tubos e Conexões"],
  ["03.100.0148", "Registro Gaveta Bruto 15mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0149", "Registro Gaveta Bruto 20mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0150", "Registro Gaveta Bruto 25mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0151", "Registro Gaveta Bruto 32mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0152", "Registro Gaveta Bruto 40mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0153", "Registro Gaveta Bruto 50mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0154", "Registro Gaveta Bruto 65mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0155", "Registro Gaveta Bruto 80mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0156", "Registro Esfera Soldável VS 15mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0157", "Registro Esfera Soldável VS 20mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0158", "Registro Esfera Soldável VS 25mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0159", "Registro Esfera Soldável VS 32mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0160", "Registro Esfera Soldável VS 40mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0161", "Registro Esfera Soldável VS 50mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0162", "Registro Esfera Soldável VS 65mm", "un", "Hidrossanitária", "Água Fria – Registros e Válvulas"],
  ["03.100.0196", "Caixa d'Água Polietileno 100L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0197", "Caixa d'Água Polietileno 150L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0198", "Caixa d'Água Polietileno 250L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0199", "Caixa d'Água Polietileno 310L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0200", "Caixa d'Água Polietileno 500L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0201", "Caixa d'Água Polietileno 750L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0202", "Caixa d'Água Polietileno 1000L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0203", "Caixa d'Água Polietileno 1500L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0204", "Caixa d'Água Polietileno 2000L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0205", "Caixa d'Água Polietileno 3000L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0206", "Caixa d'Água Polietileno 5000L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0207", "Caixa d'Água Polietileno 7500L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0208", "Caixa d'Água Polietileno 10000L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0209", "Caixa d'Água Polietileno 15000L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0210", "Caixa d'Água Polietileno 20000L com Tampa", "un", "Hidrossanitária", "Água Fria – Reservatórios"],
  ["03.100.0234", "Aquecedor Solar Coletor 1,0m²", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0235", "Aquecedor Solar Coletor 1,5m²", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0236", "Aquecedor Solar Coletor 2,0m²", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0237", "Reservatório Térmico 200L", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0238", "Reservatório Térmico 400L", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0239", "Reservatório Térmico 600L", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0240", "Aquecedor a Gás Passagem 6L", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0241", "Aquecedor a Gás Passagem 10L", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0242", "Aquecedor a Gás Passagem 13L Digital", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0243", "Aquecedor a Gás Passagem 18L", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0244", "Aquecedor a Gás Passagem 22L Inox", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0245", "Aquecedor a Gás Passagem 32L", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0246", "Aquecedor de Acumulação 100L Elétrico", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0247", "Aquecedor de Acumulação 200L Elétrico", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0248", "Boiler Elétrico 200L Inox", "un", "Hidrossanitária", "Água Fria – Aquecimento"],
  ["03.100.0256", "Bacia Convencional", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0257", "Bacia c/ Caixa Acoplada Branca", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0258", "Bacia c/ Caixa Acoplada Cinza", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0259", "Bacia c/ Caixa Acoplada Preta", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0260", "Bacia Suspensa Cerâmica", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0261", "Bacia Turca", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0262", "Bacia Infantil", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0263", "Lavatório c/ Coluna 45cm", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0264", "Lavatório c/ Coluna 50cm", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0265", "Lavatório Suspenso", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0266", "Lavatório Semi-Coluna", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0267", "Cuba de Embutir Oval", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0268", "Cuba de Embutir Retangular", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0269", "Cuba de Sobrepor Redonda", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0270", "Cuba de Sobrepor Quadrada", "un", "Hidrossanitária", "Louças Sanitárias"],
  ["03.100.0285", "Torneira Lavatório Bica Baixa Mesa", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0286", "Torneira Lavatório Bica Alta Mesa", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0287", "Torneira Lavatório Cromada de Parede", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0288", "Torneira Cozinha Bica Móvel Mesa", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0289", "Torneira Cozinha Bica Móvel Parede", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0290", "Torneira Cozinha Gourmet Pia Cromada", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0291", "Torneira de Jardim 1/2\"", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0292", "Torneira de Jardim 3/4\"", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0293", "Torneira Tanque Cromada", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0294", "Misturador Lavatório Mesa", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0295", "Misturador Cozinha Mesa Bica Móvel", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0296", "Misturador Cozinha Parede", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0297", "Monocomando Lavatório Cromado", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0298", "Monocomando Cozinha Bica Móvel", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.100.0299", "Monocomando Cozinha Gourmet", "un", "Hidrossanitária", "Metais Sanitários"],
  ["03.200.0001", "Tubo PVC Esgoto Série Normal DN 40mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0002", "Tubo PVC Esgoto Série Normal DN 50mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0003", "Tubo PVC Esgoto Série Normal DN 75mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0004", "Tubo PVC Esgoto Série Normal DN 100mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0005", "Tubo PVC Esgoto Série Normal DN 150mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0006", "Tubo PVC Esgoto Série Normal DN 200mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0007", "Tubo PVC Esgoto Série Reforçada DN 40mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0008", "Tubo PVC Esgoto Série Reforçada DN 50mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0009", "Tubo PVC Esgoto Série Reforçada DN 75mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0010", "Tubo PVC Esgoto Série Reforçada DN 100mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0011", "Tubo PVC Esgoto Série Reforçada DN 150mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0012", "Tubo PVC Esgoto Série Reforçada DN 200mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0013", "Tubo PVC Esgoto Série Reforçada DN 250mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0014", "Tubo PVC Esgoto Série Reforçada DN 300mm Barra 6m", "br", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0015", "Joelho 90° Esgoto 40mm", "un", "Hidrossanitária", "Esgoto – Tubos e Conexões"],
  ["03.200.0075", "Caixa Sifonada PVC 100x100x50 c/ Grelha", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0076", "Caixa Sifonada PVC 100x150x50 c/ Grelha", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0077", "Caixa Sifonada PVC 150x150x50 c/ Grelha", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0078", "Caixa Sifonada Inox 100x150x50", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0079", "Caixa de Inspeção Esgoto 30x30", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0080", "Caixa de Inspeção Esgoto 40x40", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0081", "Caixa de Inspeção Esgoto 60x60", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0082", "Caixa de Gordura PVC Pequena", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0083", "Caixa de Gordura PVC Grande", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0084", "Caixa de Gordura Concreto", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0085", "Caixa de Passagem 30x30", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0086", "Caixa de Passagem 40x40", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0087", "Ralo Sifonado PVC 100x40", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0088", "Ralo Sifonado PVC 100x53", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.200.0089", "Ralo Linear Inox 5x50cm", "un", "Hidrossanitária", "Esgoto – Caixas e Ralos"],
  ["03.300.0001", "Tubo Galvanizado Schedule 40 DN 1/2\" Barra 6m", "br", "Hidrossanitária", "Incêndio"],
  ["03.300.0002", "Tubo Galvanizado Schedule 40 DN 3/4\" Barra 6m", "br", "Hidrossanitária", "Incêndio"],
  ["03.300.0003", "Tubo Galvanizado Schedule 40 DN 1\" Barra 6m", "br", "Hidrossanitária", "Incêndio"],
  ["03.300.0004", "Tubo Galvanizado Schedule 40 DN 1.1/4\" Barra 6m", "br", "Hidrossanitária", "Incêndio"],
  ["03.300.0005", "Tubo Galvanizado Schedule 40 DN 1.1/2\" Barra 6m", "br", "Hidrossanitária", "Incêndio"],
  ["03.300.0006", "Tubo Galvanizado Schedule 40 DN 2\" Barra 6m", "br", "Hidrossanitária", "Incêndio"],
  ["03.300.0007", "Tubo Galvanizado Schedule 40 DN 2.1/2\" Barra 6m", "br", "Hidrossanitária", "Incêndio"],
  ["03.300.0008", "Tubo Galvanizado Schedule 40 DN 3\" Barra 6m", "br", "Hidrossanitária", "Incêndio"],
  ["03.300.0009", "Tubo Galvanizado Schedule 40 DN 4\" Barra 6m", "br", "Hidrossanitária", "Incêndio"],
];

// Helpers do catálogo
const CAT_KM_BUSCA = (termo) => {
  if (!termo || termo.length < 2) return [];
  const t = termo.toLowerCase();
  return CATALOGO_KM_FULL.filter(m =>
    m[1].toLowerCase().includes(t) ||
    m[0].includes(termo) ||
    m[3].toLowerCase().includes(t) ||
    m[4].toLowerCase().includes(t)
  ).slice(0, 30);
};
const CAT_KM_CATEGORIAS = [...new Set(CATALOGO_KM_FULL.map(m => m[3]))];
const CAT_KM_SUBCATEGORIAS = (cat) => [...new Set(CATALOGO_KM_FULL.filter(m => m[3] === cat).map(m => m[4]))];

const MATERIAIS_BANCO_DETALHADO = [
  // ═══ CIMENTO ═══
  { nome: "Cimento CP-II 50kg", un: "sacos", marcas: ["Votorantim", "Itambé", "Mizu", "Holcim", "InterCement"], cat: "Cimento" },
  { nome: "Cimento CP-III 50kg", un: "sacos", marcas: ["Votorantim", "Mizu", "Holcim", "Itambé"], cat: "Cimento" },
  { nome: "Cimento CP-IV 50kg", un: "sacos", marcas: ["Votorantim", "Mizu", "Itambé"], cat: "Cimento" },
  { nome: "Cimento CP-V ARI 50kg", un: "sacos", marcas: ["Votorantim", "Holcim", "Mizu"], cat: "Cimento" },
  { nome: "Cimento branco 25kg", un: "sacos", marcas: ["Votorantim", "Itambé"], cat: "Cimento" },

  // ═══ ARGAMASSA / REJUNTE ═══
  { nome: "Argamassa colante AC-I 20kg (interno)", un: "sacos", marcas: ["Quartzolit", "Votomassa", "Cimentcola", "Fortaleza"], cat: "Argamassa" },
  { nome: "Argamassa colante AC-II 20kg (semi-úmido)", un: "sacos", marcas: ["Quartzolit", "Votomassa", "Cimentcola"], cat: "Argamassa" },
  { nome: "Argamassa colante AC-III 20kg (externo/molhado)", un: "sacos", marcas: ["Quartzolit ACIII", "Votomassa AC-III", "Cimentcola Plus"], cat: "Argamassa" },
  { nome: "Argamassa polimérica flexível 20kg", un: "sacos", marcas: ["Quartzolit", "Votomassa"], cat: "Argamassa" },
  { nome: "Argamassa industrializada de assentamento 20kg", un: "sacos", marcas: ["Quartzolit", "Votomassa"], cat: "Argamassa" },
  { nome: "Argamassa preparada para revestimento 20kg", un: "sacos", marcas: ["Quartzolit", "Votomassa"], cat: "Argamassa" },
  { nome: "Rejunte cinza 1kg", un: "unidades", marcas: ["Quartzolit", "Cera Master", "Portokoll"], cat: "Argamassa" },
  { nome: "Rejunte branco 1kg", un: "unidades", marcas: ["Quartzolit", "Cera Master", "Portokoll"], cat: "Argamassa" },
  { nome: "Rejunte colorido 1kg", un: "unidades", marcas: ["Quartzolit", "Cera Master", "Portokoll"], cat: "Argamassa" },
  { nome: "Rejunte epóxi 1kg", un: "unidades", marcas: ["Quartzolit Epóxi", "Portokoll Epóxi"], cat: "Argamassa" },

  // ═══ CAL / GESSO ═══
  { nome: "Cal hidratada 20kg", un: "sacos", marcas: ["Itaú", "Vimasa", "Hidrocal"], cat: "Cal/Gesso" },
  { nome: "Cal virgem 20kg", un: "sacos", marcas: ["Itaú", "Vimasa"], cat: "Cal/Gesso" },
  { nome: "Gesso 40kg", un: "sacos", marcas: ["Gesso Brasil", "Gypsum"], cat: "Cal/Gesso" },
  { nome: "Massa corrida 18L (PVA)", un: "unidades", marcas: ["Suvinil", "Coral", "Sherwin-Williams", "Iquine"], cat: "Pintura" },
  { nome: "Massa acrílica 18L", un: "unidades", marcas: ["Suvinil", "Coral", "Sherwin-Williams"], cat: "Pintura" },

  // ═══ ADITIVOS ═══
  { nome: "Aditivo plastificante 1L", un: "unidades", marcas: ["Vedacit", "Sika", "Otto Baumgart"], cat: "Aditivo" },
  { nome: "Aditivo impermeabilizante 1L", un: "unidades", marcas: ["Vedacit", "Sika", "Otto Baumgart"], cat: "Aditivo" },
  { nome: "Aditivo acelerador de pega 1L", un: "unidades", marcas: ["Vedacit", "Sika"], cat: "Aditivo" },
  { nome: "Aditivo retardador 1L", un: "unidades", marcas: ["Vedacit", "Sika"], cat: "Aditivo" },
  { nome: "Hidrofugante 5L", un: "unidades", marcas: ["Vedacit", "Sika", "Wolf"], cat: "Aditivo" },
  { nome: "Liga para argamassa 1L", un: "unidades", marcas: ["Vedacit", "Sika"], cat: "Aditivo" },

  // ═══ AREIA / BRITA / PEDRA ═══
  { nome: "Areia média lavada", un: "m³", cat: "Agregado" },
  { nome: "Areia grossa", un: "m³", cat: "Agregado" },
  { nome: "Areia fina", un: "m³", cat: "Agregado" },
  { nome: "Areia de reboco", un: "m³", cat: "Agregado" },
  { nome: "Saibro", un: "m³", cat: "Agregado" },
  { nome: "Brita 0", un: "m³", cat: "Agregado" },
  { nome: "Brita 1", un: "m³", cat: "Agregado" },
  { nome: "Brita 2", un: "m³", cat: "Agregado" },
  { nome: "Brita 3", un: "m³", cat: "Agregado" },
  { nome: "Brita 4", un: "m³", cat: "Agregado" },
  { nome: "Pó de pedra", un: "m³", cat: "Agregado" },
  { nome: "Bica corrida", un: "m³", cat: "Agregado" },
  { nome: "Rachão", un: "m³", cat: "Agregado" },
  { nome: "Pedrisco", un: "m³", cat: "Agregado" },
  { nome: "Brita graduada", un: "m³", cat: "Agregado" },

  // ═══ CONCRETO ═══
  { nome: "Concreto FCK 15 MPa (usinado)", un: "m³", marcas: ["Polimix", "Engemix", "Cimport"], cat: "Concreto" },
  { nome: "Concreto FCK 20 MPa (usinado)", un: "m³", marcas: ["Polimix", "Engemix", "Cimport"], cat: "Concreto" },
  { nome: "Concreto FCK 25 MPa (usinado)", un: "m³", marcas: ["Polimix", "Engemix", "Cimport"], cat: "Concreto" },
  { nome: "Concreto FCK 30 MPa (usinado)", un: "m³", marcas: ["Polimix", "Engemix", "Cimport"], cat: "Concreto" },
  { nome: "Concreto FCK 35 MPa (usinado)", un: "m³", marcas: ["Polimix", "Engemix"], cat: "Concreto" },
  { nome: "Concreto bombeável FCK 25 MPa", un: "m³", marcas: ["Polimix", "Engemix"], cat: "Concreto" },
  { nome: "Microconcreto autonivelante", un: "m³", marcas: ["Polimix", "Engemix"], cat: "Concreto" },

  // ═══ AÇO / VERGALHÃO ═══
  { nome: "Vergalhão CA-50 4,2mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal", "Belgo"], cat: "Aço" },
  { nome: "Vergalhão CA-50 5,0mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal", "Belgo"], cat: "Aço" },
  { nome: "Vergalhão CA-50 6,3mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal", "Belgo"], cat: "Aço" },
  { nome: "Vergalhão CA-50 8,0mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal", "Belgo"], cat: "Aço" },
  { nome: "Vergalhão CA-50 10,0mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal", "Belgo"], cat: "Aço" },
  { nome: "Vergalhão CA-50 12,5mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal", "Belgo"], cat: "Aço" },
  { nome: "Vergalhão CA-50 16,0mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal"], cat: "Aço" },
  { nome: "Vergalhão CA-50 20,0mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal"], cat: "Aço" },
  { nome: "Vergalhão CA-50 25,0mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal"], cat: "Aço" },
  { nome: "Vergalhão CA-60 5,0mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal"], cat: "Aço" },
  { nome: "Vergalhão CA-60 6,0mm × 12m", un: "barras", marcas: ["Gerdau", "ArcelorMittal"], cat: "Aço" },
  { nome: "Tela soldada Q-138 (2,45×6m)", un: "peças", marcas: ["Gerdau", "Belgo"], cat: "Aço" },
  { nome: "Tela soldada Q-159 (2,45×6m)", un: "peças", marcas: ["Gerdau", "Belgo"], cat: "Aço" },
  { nome: "Tela soldada Q-196 (2,45×6m)", un: "peças", marcas: ["Gerdau", "Belgo"], cat: "Aço" },
  { nome: "Tela soldada Q-246 (2,45×6m)", un: "peças", marcas: ["Gerdau", "Belgo"], cat: "Aço" },
  { nome: "Tela soldada Q-283 (2,45×6m)", un: "peças", marcas: ["Gerdau", "Belgo"], cat: "Aço" },
  { nome: "Estribo pronto 5mm CA-60", un: "unidades", marcas: ["Gerdau"], cat: "Aço" },
  { nome: "Estribo pronto 6,3mm CA-60", un: "unidades", marcas: ["Gerdau"], cat: "Aço" },
  { nome: "Estribo pronto 8mm CA-50", un: "unidades", marcas: ["Gerdau"], cat: "Aço" },
  { nome: "Arame recozido nº 18 1kg", un: "kg", marcas: ["Belgo", "Gerdau"], cat: "Aço" },
  { nome: "Arame galvanizado 1kg", un: "kg", marcas: ["Belgo", "Gerdau"], cat: "Aço" },
  { nome: "Arame farpado 500m", un: "rolos", marcas: ["Belgo", "Gerdau"], cat: "Aço" },
  { nome: "Espaçador plástico para ferragem", un: "unidades", cat: "Aço" },

  // ═══ TIJOLOS / BLOCOS ═══
  { nome: "Tijolo cerâmico 9×14×19 (8 furos)", un: "unidades", cat: "Bloco" },
  { nome: "Tijolo cerâmico 9×19×19 (vedação)", un: "unidades", cat: "Bloco" },
  { nome: "Tijolo cerâmico 11,5×14×19", un: "unidades", cat: "Bloco" },
  { nome: "Tijolo baiano 9×14×24", un: "unidades", cat: "Bloco" },
  { nome: "Tijolo maciço comum", un: "unidades", cat: "Bloco" },
  { nome: "Tijolo de vidro 19×19×8", un: "unidades", marcas: ["Cebrace", "Vimar"], cat: "Bloco" },
  { nome: "Bloco de concreto estrutural 14×19×39", un: "unidades", marcas: ["Tatu", "Glasser"], cat: "Bloco" },
  { nome: "Bloco de concreto vedação 9×19×39", un: "unidades", marcas: ["Tatu", "Glasser"], cat: "Bloco" },
  { nome: "Bloco de concreto 14×19×39", un: "unidades", marcas: ["Tatu", "Glasser"], cat: "Bloco" },
  { nome: "Bloco de concreto 19×19×39", un: "unidades", marcas: ["Tatu", "Glasser"], cat: "Bloco" },
  { nome: "Bloco celular autoclavado (Sical)", un: "unidades", marcas: ["Sical", "Celucon"], cat: "Bloco" },

  // ═══ TELHAS ═══
  { nome: "Telha cerâmica colonial", un: "unidades", marcas: ["Telha Forte", "Telhanorte"], cat: "Telha" },
  { nome: "Telha cerâmica francesa", un: "unidades", cat: "Telha" },
  { nome: "Telha cerâmica romana", un: "unidades", cat: "Telha" },
  { nome: "Telha cerâmica portuguesa", un: "unidades", cat: "Telha" },
  { nome: "Telha cerâmica plan", un: "unidades", cat: "Telha" },
  { nome: "Telha de fibrocimento 6mm 2,44m", un: "unidades", marcas: ["Eternit", "Brasilit", "Imbralit"], cat: "Telha" },
  { nome: "Telha de fibrocimento 6mm 3,05m", un: "unidades", marcas: ["Eternit", "Brasilit", "Imbralit"], cat: "Telha" },
  { nome: "Telha de fibrocimento 6mm 3,66m", un: "unidades", marcas: ["Eternit", "Brasilit", "Imbralit"], cat: "Telha" },
  { nome: "Telha de fibrocimento 8mm 4,27m", un: "unidades", marcas: ["Eternit", "Brasilit"], cat: "Telha" },
  { nome: "Telha shingle (madeirada)", un: "unidades", marcas: ["Owens Corning", "IKO"], cat: "Telha" },
  { nome: "Telha translúcida", un: "unidades", marcas: ["Onduline"], cat: "Telha" },
  { nome: "Telha termoacústica", un: "m²", cat: "Telha" },
  { nome: "Telha sanduíche", un: "m²", cat: "Telha" },
  { nome: "Telha galvanizada", un: "m²", cat: "Telha" },
  { nome: "Cumeeira cerâmica", un: "unidades", cat: "Telha" },
  { nome: "Cumeeira fibrocimento", un: "unidades", marcas: ["Eternit", "Brasilit"], cat: "Telha" },
  { nome: "Calha galvanizada 6m", un: "barras", cat: "Telha" },
  { nome: "Rufo galvanizado 6m", un: "barras", cat: "Telha" },

  // ═══ MADEIRA ═══
  { nome: "Caibro 5×6cm × 4m (eucalipto)", un: "peças", cat: "Madeira" },
  { nome: "Caibro 5×6cm × 6m (eucalipto)", un: "peças", cat: "Madeira" },
  { nome: "Sarrafo 2,5×10cm × 4m", un: "peças", cat: "Madeira" },
  { nome: "Sarrafo 2,5×10cm × 6m", un: "peças", cat: "Madeira" },
  { nome: "Ripa 1,5×5cm × 4m", un: "peças", cat: "Madeira" },
  { nome: "Tábua de pinus 2,5×30cm", un: "peças", cat: "Madeira" },
  { nome: "Tábua de cedrinho", un: "peças", cat: "Madeira" },
  { nome: "Madeirite plastificado 14mm 1,10×2,20m", un: "peças", cat: "Madeira" },
  { nome: "Madeirite plastificado 17mm 1,10×2,20m", un: "peças", cat: "Madeira" },
  { nome: "Madeirite plastificado 20mm 1,10×2,20m", un: "peças", cat: "Madeira" },
  { nome: "Madeirite resinado 12mm 1,10×2,20m", un: "peças", cat: "Madeira" },
  { nome: "Madeirite resinado 15mm 1,10×2,20m", un: "peças", cat: "Madeira" },
  { nome: "Madeirite resinado 18mm 1,10×2,20m", un: "peças", cat: "Madeira" },
  { nome: "Compensado naval 15mm", un: "peças", cat: "Madeira" },
  { nome: "Compensado virola 15mm", un: "peças", cat: "Madeira" },
  { nome: "MDF cru 15mm", un: "peças", marcas: ["Duratex", "Eucatex", "Berneck"], cat: "Madeira" },
  { nome: "MDF cru 18mm", un: "peças", marcas: ["Duratex", "Eucatex", "Berneck"], cat: "Madeira" },
  { nome: "Pontalete 7×7cm × 3m", un: "peças", cat: "Madeira" },
  { nome: "Estaca de madeira 4m", un: "peças", cat: "Madeira" },

  // ═══ ESQUADRIAS ═══
  { nome: "Porta de madeira semi-oca 0,80×2,10m", un: "unidades", cat: "Esquadria" },
  { nome: "Porta de madeira semi-oca 0,70×2,10m", un: "unidades", cat: "Esquadria" },
  { nome: "Porta de madeira semi-oca 0,60×2,10m", un: "unidades", cat: "Esquadria" },
  { nome: "Porta maciça 0,80×2,10m", un: "unidades", cat: "Esquadria" },
  { nome: "Porta maciça 0,90×2,10m", un: "unidades", cat: "Esquadria" },
  { nome: "Batente de madeira 14cm", un: "unidades", cat: "Esquadria" },
  { nome: "Guarnição/alizar (jogo)", un: "unidades", cat: "Esquadria" },
  { nome: "Fechadura interna", un: "unidades", marcas: ["Pado", "La Fonte", "Stam"], cat: "Esquadria" },
  { nome: "Fechadura externa", un: "unidades", marcas: ["Pado", "La Fonte", "Stam"], cat: "Esquadria" },
  { nome: "Fechadura banheiro", un: "unidades", marcas: ["Pado", "La Fonte"], cat: "Esquadria" },
  { nome: "Dobradiça 3 polegadas (par)", un: "unidades", marcas: ["Pado", "La Fonte"], cat: "Esquadria" },
  { nome: "Maçaneta esfera", un: "unidades", marcas: ["Pado", "La Fonte"], cat: "Esquadria" },
  { nome: "Maçaneta alavanca", un: "unidades", marcas: ["Pado", "La Fonte"], cat: "Esquadria" },
  { nome: "Janela de alumínio 1,00×1,00m", un: "unidades", marcas: ["Sasazaki", "Belmetal"], cat: "Esquadria" },
  { nome: "Janela de alumínio 1,20×1,00m", un: "unidades", marcas: ["Sasazaki", "Belmetal"], cat: "Esquadria" },
  { nome: "Janela basculante alumínio 0,60×0,40m", un: "unidades", marcas: ["Sasazaki"], cat: "Esquadria" },
  { nome: "Janela maxim-ar alumínio", un: "unidades", marcas: ["Sasazaki", "Belmetal"], cat: "Esquadria" },
  { nome: "Janela de correr 2 folhas alumínio", un: "unidades", marcas: ["Sasazaki"], cat: "Esquadria" },
  { nome: "Janela veneziana alumínio", un: "unidades", marcas: ["Sasazaki"], cat: "Esquadria" },
  { nome: "Vidro temperado 8mm", un: "m²", marcas: ["Cebrace", "Guardian"], cat: "Esquadria" },
  { nome: "Vidro comum 4mm", un: "m²", marcas: ["Cebrace"], cat: "Esquadria" },
  { nome: "Vidro fantasia", un: "m²", marcas: ["Cebrace"], cat: "Esquadria" },
  { nome: "Box de vidro temperado para banheiro", un: "unidades", cat: "Esquadria" },

  // ═══ PINTURA ═══
  { nome: "Tinta látex PVA 18L branca", un: "unidades", marcas: ["Suvinil", "Coral", "Sherwin-Williams", "Iquine"], cat: "Pintura" },
  { nome: "Tinta látex PVA 18L colorida", un: "unidades", marcas: ["Suvinil", "Coral", "Sherwin-Williams"], cat: "Pintura" },
  { nome: "Tinta látex acrílica premium 18L", un: "unidades", marcas: ["Suvinil", "Coral Decora", "Sherwin-Williams"], cat: "Pintura" },
  { nome: "Tinta látex acrílica standard 18L", un: "unidades", marcas: ["Suvinil", "Coral", "Iquine"], cat: "Pintura" },
  { nome: "Tinta semi-brilho 18L", un: "unidades", marcas: ["Suvinil", "Coral"], cat: "Pintura" },
  { nome: "Tinta esmalte sintético 3,6L", un: "unidades", marcas: ["Suvinil", "Coralit", "Sherwin-Williams"], cat: "Pintura" },
  { nome: "Tinta esmalte base d'água 3,6L", un: "unidades", marcas: ["Coralar", "Suvinil"], cat: "Pintura" },
  { nome: "Tinta para piso 18L", un: "unidades", marcas: ["Suvinil", "Coral"], cat: "Pintura" },
  { nome: "Tinta para telhado 18L", un: "unidades", marcas: ["Suvinil", "Coral"], cat: "Pintura" },
  { nome: "Tinta epóxi 3,6L", un: "unidades", marcas: ["Sherwin-Williams", "Renner"], cat: "Pintura" },
  { nome: "Tinta antiferrugem 3,6L", un: "unidades", marcas: ["Suvinil", "Coralit"], cat: "Pintura" },
  { nome: "Verniz marítimo 3,6L", un: "unidades", marcas: ["Coral", "Sayerlack"], cat: "Pintura" },
  { nome: "Selador acrílico 3,6L", un: "unidades", marcas: ["Suvinil", "Coral"], cat: "Pintura" },
  { nome: "Fundo preparador 18L", un: "unidades", marcas: ["Suvinil", "Coral"], cat: "Pintura" },
  { nome: "Lixa para parede nº 100", un: "unidades", marcas: ["3M", "Norton"], cat: "Pintura" },
  { nome: "Lixa para parede nº 150", un: "unidades", marcas: ["3M", "Norton"], cat: "Pintura" },
  { nome: "Lixa para parede nº 220", un: "unidades", marcas: ["3M", "Norton"], cat: "Pintura" },
  { nome: "Lixa para madeira nº 80", un: "unidades", marcas: ["3M", "Norton"], cat: "Pintura" },
  { nome: "Rolo de lã 23cm", un: "unidades", marcas: ["Atlas", "Tigre"], cat: "Pintura" },
  { nome: "Rolo de espuma 15cm", un: "unidades", marcas: ["Atlas", "Tigre"], cat: "Pintura" },
  { nome: "Rolo de espuma 23cm", un: "unidades", marcas: ["Atlas", "Tigre"], cat: "Pintura" },
  { nome: "Pincel 1 polegada", un: "unidades", marcas: ["Atlas", "Tigre"], cat: "Pintura" },
  { nome: "Pincel 2 polegadas", un: "unidades", marcas: ["Atlas", "Tigre"], cat: "Pintura" },
  { nome: "Pincel 3 polegadas", un: "unidades", marcas: ["Atlas", "Tigre"], cat: "Pintura" },
  { nome: "Pincel 4 polegadas", un: "unidades", marcas: ["Atlas", "Tigre"], cat: "Pintura" },
  { nome: "Trincha", un: "unidades", marcas: ["Atlas"], cat: "Pintura" },
  { nome: "Bandeja para tinta", un: "unidades", cat: "Pintura" },
  { nome: "Fita crepe 18mm × 50m", un: "unidades", marcas: ["3M", "Adelbras"], cat: "Pintura" },
  { nome: "Fita crepe 24mm × 50m", un: "unidades", marcas: ["3M", "Adelbras"], cat: "Pintura" },
  { nome: "Fita crepe 48mm × 50m", un: "unidades", marcas: ["3M", "Adelbras"], cat: "Pintura" },

  // ═══ HIDRÁULICA — TUBOS PVC ESGOTO ═══
  { nome: "Tubo PVC esgoto Ø 40mm × 6m", un: "barras", marcas: ["Tigre", "Amanco", "Krona"], cat: "Hidráulica" },
  { nome: "Tubo PVC esgoto Ø 50mm × 6m", un: "barras", marcas: ["Tigre", "Amanco", "Krona"], cat: "Hidráulica" },
  { nome: "Tubo PVC esgoto Ø 75mm × 6m", un: "barras", marcas: ["Tigre", "Amanco", "Krona"], cat: "Hidráulica" },
  { nome: "Tubo PVC esgoto Ø 100mm × 6m", un: "barras", marcas: ["Tigre", "Amanco", "Krona"], cat: "Hidráulica" },
  { nome: "Tubo PVC esgoto Ø 150mm × 6m", un: "barras", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Tubo PVC esgoto Ø 200mm × 6m", un: "barras", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },

  // ═══ HIDRÁULICA — TUBOS PVC SOLDÁVEL ═══
  { nome: "Tubo PVC marrom soldável Ø 20mm × 6m", un: "barras", marcas: ["Tigre", "Amanco", "Krona"], cat: "Hidráulica" },
  { nome: "Tubo PVC marrom soldável Ø 25mm × 6m", un: "barras", marcas: ["Tigre", "Amanco", "Krona"], cat: "Hidráulica" },
  { nome: "Tubo PVC marrom soldável Ø 32mm × 6m", un: "barras", marcas: ["Tigre", "Amanco", "Krona"], cat: "Hidráulica" },
  { nome: "Tubo PVC marrom soldável Ø 40mm × 6m", un: "barras", marcas: ["Tigre", "Amanco", "Krona"], cat: "Hidráulica" },
  { nome: "Tubo PVC marrom soldável Ø 50mm × 6m", un: "barras", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Tubo PVC marrom soldável Ø 60mm × 6m", un: "barras", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Tubo PVC marrom soldável Ø 75mm × 6m", un: "barras", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },

  // ═══ CONEXÕES PVC ═══
  { nome: "Joelho 90° PVC soldável Ø 25mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Joelho 90° PVC soldável Ø 32mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Joelho 90° PVC soldável Ø 40mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Joelho 45° PVC soldável Ø 25mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Joelho 45° PVC soldável Ø 32mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Tê PVC soldável Ø 25mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Tê PVC soldável Ø 32mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Tê PVC soldável Ø 40mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Luva PVC soldável Ø 25mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Luva PVC soldável Ø 32mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Cap PVC soldável Ø 25mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Adaptador soldável-roscável", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Curva PVC 90° Ø 100mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Curva PVC 45° Ø 100mm", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },

  // ═══ HIDRÁULICA — LOUÇAS / METAIS ═══
  { nome: "Vaso sanitário com caixa acoplada", un: "unidades", marcas: ["Deca", "Roca", "Celite", "Incepa"], cat: "Hidráulica" },
  { nome: "Vaso sanitário convencional", un: "unidades", marcas: ["Deca", "Celite", "Incepa"], cat: "Hidráulica" },
  { nome: "Caixa acoplada para vaso", un: "unidades", marcas: ["Deca", "Celite"], cat: "Hidráulica" },
  { nome: "Assento sanitário", un: "unidades", marcas: ["Astra", "Tupan"], cat: "Hidráulica" },
  { nome: "Lavatório com coluna", un: "unidades", marcas: ["Deca", "Celite", "Incepa"], cat: "Hidráulica" },
  { nome: "Pia inox 1,20m com cuba", un: "unidades", marcas: ["Tramontina", "Mekal"], cat: "Hidráulica" },
  { nome: "Cuba de embutir 35×40cm", un: "unidades", marcas: ["Tramontina", "Mekal"], cat: "Hidráulica" },
  { nome: "Tanque de mármore sintético", un: "unidades", marcas: ["Tanque Mor"], cat: "Hidráulica" },
  { nome: "Torneira de mesa lavatório", un: "unidades", marcas: ["Deca", "Lorenzetti", "Hydra"], cat: "Hidráulica" },
  { nome: "Torneira de parede pia", un: "unidades", marcas: ["Deca", "Lorenzetti", "Hydra"], cat: "Hidráulica" },
  { nome: "Torneira para jardim", un: "unidades", marcas: ["Deca", "Hydra"], cat: "Hidráulica" },
  { nome: "Torneira para tanque", un: "unidades", marcas: ["Deca", "Lorenzetti"], cat: "Hidráulica" },
  { nome: "Misturador monocomando lavatório", un: "unidades", marcas: ["Deca", "Docol", "Lorenzetti"], cat: "Hidráulica" },
  { nome: "Chuveiro elétrico", un: "unidades", marcas: ["Lorenzetti", "Hydra", "Cardal"], cat: "Hidráulica" },
  { nome: "Ducha higiênica", un: "unidades", marcas: ["Deca", "Lorenzetti"], cat: "Hidráulica" },
  { nome: "Registro de gaveta 3/4", un: "unidades", marcas: ["Deca", "Docol", "Hydra"], cat: "Hidráulica" },
  { nome: "Registro de gaveta 1\"", un: "unidades", marcas: ["Deca", "Docol", "Hydra"], cat: "Hidráulica" },
  { nome: "Registro de pressão", un: "unidades", marcas: ["Deca", "Docol", "Hydra"], cat: "Hidráulica" },
  { nome: "Registro esfera 3/4", un: "unidades", marcas: ["Tigre", "Hydra"], cat: "Hidráulica" },
  { nome: "Sifão sanfonado", un: "unidades", marcas: ["Astra", "Blukit"], cat: "Hidráulica" },
  { nome: "Sifão copo", un: "unidades", marcas: ["Astra", "Blukit"], cat: "Hidráulica" },
  { nome: "Engate flexível 30cm", un: "unidades", marcas: ["Astra", "Blukit"], cat: "Hidráulica" },
  { nome: "Caixa sifonada 100×40", un: "unidades", marcas: ["Tigre", "Astra"], cat: "Hidráulica" },
  { nome: "Ralo seco 100mm", un: "unidades", marcas: ["Tigre", "Astra"], cat: "Hidráulica" },
  { nome: "Ralo sifonado", un: "unidades", marcas: ["Tigre", "Astra"], cat: "Hidráulica" },
  { nome: "Cola PVC 75g", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Cola PVC 175g", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Cola PVC 850g", un: "unidades", marcas: ["Tigre", "Amanco"], cat: "Hidráulica" },
  { nome: "Veda rosca 18m", un: "unidades", marcas: ["Tigre", "3M"], cat: "Hidráulica" },
  { nome: "Caixa d'água 250L", un: "unidades", marcas: ["Fortlev", "Acqualimp", "Tigre"], cat: "Hidráulica" },
  { nome: "Caixa d'água 500L", un: "unidades", marcas: ["Fortlev", "Acqualimp", "Tigre"], cat: "Hidráulica" },
  { nome: "Caixa d'água 1000L", un: "unidades", marcas: ["Fortlev", "Acqualimp", "Tigre"], cat: "Hidráulica" },
  { nome: "Caixa d'água 2000L", un: "unidades", marcas: ["Fortlev", "Acqualimp"], cat: "Hidráulica" },
  { nome: "Caixa d'água 5000L", un: "unidades", marcas: ["Fortlev", "Acqualimp"], cat: "Hidráulica" },
  { nome: "Boia para caixa d'água", un: "unidades", marcas: ["Astra", "Blukit"], cat: "Hidráulica" },

  // ═══ ELÉTRICA — ELETRODUTOS / CAIXAS ═══
  { nome: "Eletroduto corrugado 20mm × 25m", un: "rolos", marcas: ["Tigre", "Amanco", "Krona"], cat: "Elétrica" },
  { nome: "Eletroduto corrugado 25mm × 25m", un: "rolos", marcas: ["Tigre", "Amanco", "Krona"], cat: "Elétrica" },
  { nome: "Eletroduto corrugado 32mm × 25m", un: "rolos", marcas: ["Tigre", "Amanco"], cat: "Elétrica" },
  { nome: "Eletroduto rígido PVC 20mm × 3m", un: "barras", marcas: ["Tigre", "Amanco"], cat: "Elétrica" },
  { nome: "Eletroduto rígido PVC 25mm × 3m", un: "barras", marcas: ["Tigre", "Amanco"], cat: "Elétrica" },
  { nome: "Caixa 4×2 PVC", un: "unidades", marcas: ["Tigre", "Pial Legrand"], cat: "Elétrica" },
  { nome: "Caixa 4×4 PVC", un: "unidades", marcas: ["Tigre", "Pial Legrand"], cat: "Elétrica" },
  { nome: "Caixa octogonal PVC para teto", un: "unidades", marcas: ["Tigre"], cat: "Elétrica" },
  { nome: "Caixa de passagem 10×10", un: "unidades", marcas: ["Tigre"], cat: "Elétrica" },
  { nome: "Caixa de passagem 15×15", un: "unidades", marcas: ["Tigre"], cat: "Elétrica" },

  // ═══ ELÉTRICA — CABOS ═══
  { nome: "Cabo flexível 1,5mm² × 100m (azul)", un: "rolos", marcas: ["Sil", "Prysmian", "Cobrecom"], cat: "Elétrica" },
  { nome: "Cabo flexível 1,5mm² × 100m (preto)", un: "rolos", marcas: ["Sil", "Prysmian", "Cobrecom"], cat: "Elétrica" },
  { nome: "Cabo flexível 1,5mm² × 100m (vermelho)", un: "rolos", marcas: ["Sil", "Prysmian"], cat: "Elétrica" },
  { nome: "Cabo flexível 2,5mm² × 100m", un: "rolos", marcas: ["Sil", "Prysmian", "Cobrecom"], cat: "Elétrica" },
  { nome: "Cabo flexível 4mm² × 100m", un: "rolos", marcas: ["Sil", "Prysmian", "Cobrecom"], cat: "Elétrica" },
  { nome: "Cabo flexível 6mm² × 100m", un: "rolos", marcas: ["Sil", "Prysmian"], cat: "Elétrica" },
  { nome: "Cabo flexível 10mm² × 100m", un: "rolos", marcas: ["Sil", "Prysmian"], cat: "Elétrica" },
  { nome: "Cabo flexível 16mm² × 100m", un: "rolos", marcas: ["Sil", "Prysmian"], cat: "Elétrica" },
  { nome: "Cabo paralelo 2×1,5mm² × 100m", un: "rolos", marcas: ["Sil", "Prysmian"], cat: "Elétrica" },
  { nome: "Cabo paralelo 2×2,5mm² × 100m", un: "rolos", marcas: ["Sil", "Prysmian"], cat: "Elétrica" },
  { nome: "Cabo PP 3×2,5mm² × 100m", un: "rolos", marcas: ["Sil", "Prysmian"], cat: "Elétrica" },
  { nome: "Cabo coaxial × 100m", un: "rolos", marcas: ["Furukawa"], cat: "Elétrica" },
  { nome: "Cabo de rede UTP cat5e × 100m", un: "rolos", marcas: ["Furukawa", "Nexans"], cat: "Elétrica" },
  { nome: "Cabo de rede UTP cat6 × 100m", un: "rolos", marcas: ["Furukawa", "Nexans"], cat: "Elétrica" },

  // ═══ ELÉTRICA — DISJUNTORES ═══
  { nome: "Disjuntor monopolar 10A", un: "unidades", marcas: ["Schneider", "Siemens", "Steck", "ABB"], cat: "Elétrica" },
  { nome: "Disjuntor monopolar 16A", un: "unidades", marcas: ["Schneider", "Siemens", "Steck", "ABB"], cat: "Elétrica" },
  { nome: "Disjuntor monopolar 20A", un: "unidades", marcas: ["Schneider", "Siemens", "Steck"], cat: "Elétrica" },
  { nome: "Disjuntor monopolar 25A", un: "unidades", marcas: ["Schneider", "Siemens", "Steck"], cat: "Elétrica" },
  { nome: "Disjuntor monopolar 32A", un: "unidades", marcas: ["Schneider", "Siemens", "Steck"], cat: "Elétrica" },
  { nome: "Disjuntor monopolar 40A", un: "unidades", marcas: ["Schneider", "Siemens", "Steck"], cat: "Elétrica" },
  { nome: "Disjuntor monopolar 50A", un: "unidades", marcas: ["Schneider", "Siemens", "Steck"], cat: "Elétrica" },
  { nome: "Disjuntor monopolar 63A", un: "unidades", marcas: ["Schneider", "Siemens"], cat: "Elétrica" },
  { nome: "Disjuntor bipolar 25A", un: "unidades", marcas: ["Schneider", "Siemens", "Steck"], cat: "Elétrica" },
  { nome: "Disjuntor bipolar 32A", un: "unidades", marcas: ["Schneider", "Siemens", "Steck"], cat: "Elétrica" },
  { nome: "Disjuntor bipolar 40A", un: "unidades", marcas: ["Schneider", "Siemens"], cat: "Elétrica" },
  { nome: "Disjuntor tripolar 32A", un: "unidades", marcas: ["Schneider", "Siemens"], cat: "Elétrica" },
  { nome: "Disjuntor tripolar 50A", un: "unidades", marcas: ["Schneider", "Siemens"], cat: "Elétrica" },
  { nome: "Disjuntor tripolar 63A", un: "unidades", marcas: ["Schneider", "Siemens"], cat: "Elétrica" },
  { nome: "Disjuntor DR bipolar 25A 30mA", un: "unidades", marcas: ["Schneider", "Siemens"], cat: "Elétrica" },
  { nome: "Disjuntor DR bipolar 40A 30mA", un: "unidades", marcas: ["Schneider", "Siemens"], cat: "Elétrica" },
  { nome: "DPS 175V Classe II", un: "unidades", marcas: ["Schneider", "Siemens", "Clamper"], cat: "Elétrica" },
  { nome: "DPS 275V Classe II", un: "unidades", marcas: ["Schneider", "Clamper"], cat: "Elétrica" },
  { nome: "Quadro de distribuição 6 disjuntores", un: "unidades", marcas: ["Cemar", "Steck"], cat: "Elétrica" },
  { nome: "Quadro de distribuição 12 disjuntores", un: "unidades", marcas: ["Cemar", "Steck"], cat: "Elétrica" },
  { nome: "Quadro de distribuição 18 disjuntores", un: "unidades", marcas: ["Cemar", "Steck"], cat: "Elétrica" },
  { nome: "Quadro de distribuição 24 disjuntores", un: "unidades", marcas: ["Cemar", "Steck"], cat: "Elétrica" },
  { nome: "Quadro de medição padrão concessionária", un: "unidades", cat: "Elétrica" },

  // ═══ ELÉTRICA — TOMADAS / INTERRUPTORES ═══
  { nome: "Tomada 2P+T 10A (kit completo)", un: "unidades", marcas: ["Pial Legrand", "Steck", "Siemens"], cat: "Elétrica" },
  { nome: "Tomada 2P+T 20A (kit completo)", un: "unidades", marcas: ["Pial Legrand", "Steck"], cat: "Elétrica" },
  { nome: "Tomada dupla 2P+T", un: "unidades", marcas: ["Pial Legrand", "Steck"], cat: "Elétrica" },
  { nome: "Tomada externa IP44", un: "unidades", marcas: ["Pial Legrand", "Steck"], cat: "Elétrica" },
  { nome: "Tomada USB", un: "unidades", marcas: ["Pial Legrand"], cat: "Elétrica" },
  { nome: "Tomada de telefone RJ-11", un: "unidades", marcas: ["Pial Legrand"], cat: "Elétrica" },
  { nome: "Tomada de TV (coaxial)", un: "unidades", marcas: ["Pial Legrand"], cat: "Elétrica" },
  { nome: "Interruptor simples 10A", un: "unidades", marcas: ["Pial Legrand", "Steck"], cat: "Elétrica" },
  { nome: "Interruptor duplo 10A", un: "unidades", marcas: ["Pial Legrand", "Steck"], cat: "Elétrica" },
  { nome: "Interruptor triplo 10A", un: "unidades", marcas: ["Pial Legrand", "Steck"], cat: "Elétrica" },
  { nome: "Interruptor paralelo 10A", un: "unidades", marcas: ["Pial Legrand", "Steck"], cat: "Elétrica" },
  { nome: "Interruptor intermediário 10A", un: "unidades", marcas: ["Pial Legrand"], cat: "Elétrica" },
  { nome: "Interruptor com tomada", un: "unidades", marcas: ["Pial Legrand", "Steck"], cat: "Elétrica" },
  { nome: "Dimmer giratório", un: "unidades", marcas: ["Pial Legrand"], cat: "Elétrica" },

  // ═══ ELÉTRICA — ILUMINAÇÃO ═══
  { nome: "Lâmpada LED 9W bivolt E27", un: "unidades", marcas: ["Philips", "Osram", "Empalux", "Avant"], cat: "Elétrica" },
  { nome: "Lâmpada LED 12W bivolt E27", un: "unidades", marcas: ["Philips", "Osram", "Empalux", "Avant"], cat: "Elétrica" },
  { nome: "Lâmpada LED 15W bivolt E27", un: "unidades", marcas: ["Philips", "Osram", "Empalux"], cat: "Elétrica" },
  { nome: "Lâmpada LED 20W bivolt E27", un: "unidades", marcas: ["Philips", "Osram"], cat: "Elétrica" },
  { nome: "Lâmpada LED 30W bivolt E27", un: "unidades", marcas: ["Philips", "Osram"], cat: "Elétrica" },
  { nome: "Refletor LED 30W bivolt", un: "unidades", marcas: ["Philips", "Empalux", "Avant"], cat: "Elétrica" },
  { nome: "Refletor LED 50W bivolt", un: "unidades", marcas: ["Philips", "Empalux"], cat: "Elétrica" },
  { nome: "Refletor LED 100W bivolt", un: "unidades", marcas: ["Philips", "Empalux"], cat: "Elétrica" },
  { nome: "Refletor LED 200W bivolt", un: "unidades", marcas: ["Philips", "Empalux"], cat: "Elétrica" },
  { nome: "Plafon redondo embutir", un: "unidades", cat: "Elétrica" },
  { nome: "Plafon quadrado embutir", un: "unidades", cat: "Elétrica" },
  { nome: "Spot embutir", un: "unidades", cat: "Elétrica" },
  { nome: "Pendente para cozinha", un: "unidades", cat: "Elétrica" },
  { nome: "Arandela parede", un: "unidades", cat: "Elétrica" },
  { nome: "Luminária de emergência LED", un: "unidades", marcas: ["Intelbras", "Segurimax"], cat: "Elétrica" },
  { nome: "Sensor de presença teto", un: "unidades", marcas: ["Intelbras", "Margirius"], cat: "Elétrica" },
  { nome: "Sensor de movimento parede", un: "unidades", marcas: ["Intelbras", "Margirius"], cat: "Elétrica" },
  { nome: "Foto-célula 1000W bivolt", un: "unidades", marcas: ["Margirius", "Exatron"], cat: "Elétrica" },

  // ═══ ELÉTRICA — DIVERSOS ═══
  { nome: "Fita isolante 19mm × 20m", un: "unidades", marcas: ["3M", "Pirelli"], cat: "Elétrica" },
  { nome: "Fita isolante alta tensão", un: "unidades", marcas: ["3M"], cat: "Elétrica" },
  { nome: "Fita autofusão 10m", un: "unidades", marcas: ["3M"], cat: "Elétrica" },
  { nome: "Abraçadeira nylon 100mm (pct 100)", un: "unidades", cat: "Elétrica" },
  { nome: "Abraçadeira nylon 200mm (pct 100)", un: "unidades", cat: "Elétrica" },
  { nome: "Abraçadeira nylon 300mm (pct 100)", un: "unidades", cat: "Elétrica" },
  { nome: "Bucha S6 (pct 100)", un: "unidades", marcas: ["Tigre", "Tramontina"], cat: "Elétrica" },
  { nome: "Bucha S8 (pct 100)", un: "unidades", marcas: ["Tigre", "Tramontina"], cat: "Elétrica" },
  { nome: "Bucha S10 (pct 100)", un: "unidades", marcas: ["Tigre"], cat: "Elétrica" },

  // ═══ DRENAGEM / PAVIMENTAÇÃO ═══
  { nome: "Manilha cerâmica Ø 200mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Manilha cerâmica Ø 300mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Manilha cerâmica Ø 400mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Manilha cerâmica Ø 600mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Manilha de concreto Ø 400mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Manilha de concreto Ø 600mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Manilha de concreto Ø 800mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Manilha de concreto Ø 1000mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Manilha de concreto Ø 1200mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Manilha de concreto Ø 1500mm × 1m", un: "unidades", cat: "Drenagem" },
  { nome: "Tubo de concreto armado PA-1 Ø 600mm", un: "unidades", cat: "Drenagem" },
  { nome: "Tubo de concreto armado PA-2 Ø 800mm", un: "unidades", cat: "Drenagem" },
  { nome: "Tubo de concreto armado PA-3 Ø 1000mm", un: "unidades", cat: "Drenagem" },
  { nome: "Tubo de concreto armado Ø 1200mm", un: "unidades", cat: "Drenagem" },
  { nome: "Tubo de concreto armado Ø 1500mm", un: "unidades", cat: "Drenagem" },
  { nome: "Boca de lobo simples", un: "unidades", cat: "Drenagem" },
  { nome: "Boca de lobo dupla", un: "unidades", cat: "Drenagem" },
  { nome: "Boca de leão", un: "unidades", cat: "Drenagem" },
  { nome: "Caixa de captação 60×60", un: "unidades", cat: "Drenagem" },
  { nome: "Caixa de captação 80×80", un: "unidades", cat: "Drenagem" },
  { nome: "Caixa de inspeção 60×60", un: "unidades", cat: "Drenagem" },
  { nome: "Caixa de inspeção 80×80", un: "unidades", cat: "Drenagem" },
  { nome: "Tampão de ferro fundido", un: "unidades", cat: "Drenagem" },
  { nome: "Grelha de ferro fundido", un: "unidades", cat: "Drenagem" },
  { nome: "Grelha pluvial concreto", un: "unidades", cat: "Drenagem" },

  // ═══ PAVIMENTAÇÃO ═══
  { nome: "Bloco intertravado 16 faces (paver)", un: "m²", marcas: ["Tatu", "Glasser"], cat: "Pavimentação" },
  { nome: "Bloco intertravado retangular", un: "m²", cat: "Pavimentação" },
  { nome: "Bloco intertravado raquete", un: "m²", cat: "Pavimentação" },
  { nome: "Bloco intertravado sextavado", un: "m²", cat: "Pavimentação" },
  { nome: "Paralelepípedo granito", un: "unidades", cat: "Pavimentação" },
  { nome: "Paralelepípedo basalto", un: "unidades", cat: "Pavimentação" },
  { nome: "Pedra portuguesa 5×5", un: "m²", cat: "Pavimentação" },
  { nome: "Pedra portuguesa 7×7", un: "m²", cat: "Pavimentação" },
  { nome: "Meio-fio comum 100×15×30", un: "unidades", cat: "Pavimentação" },
  { nome: "Meio-fio com sarjeta", un: "unidades", cat: "Pavimentação" },
  { nome: "Sarjeta de concreto pré-moldada", un: "unidades", cat: "Pavimentação" },
  { nome: "Guia rebaixada para acesso", un: "unidades", cat: "Pavimentação" },
  { nome: "Cordão de concreto", un: "unidades", cat: "Pavimentação" },
  { nome: "Asfalto CBUQ (massa quente)", un: "ton", cat: "Pavimentação" },
  { nome: "Massa asfáltica fria 20kg", un: "sacos", cat: "Pavimentação" },
  { nome: "Asfalto a frio 20L", un: "unidades", cat: "Pavimentação" },
  { nome: "Pintura de ligação RR-1C", un: "unidades", cat: "Pavimentação" },
  { nome: "Pintura de ligação CM-30", un: "unidades", cat: "Pavimentação" },
  { nome: "Emulsão asfáltica RR-1C", un: "unidades", cat: "Pavimentação" },
  { nome: "Emulsão asfáltica RR-2C", un: "unidades", cat: "Pavimentação" },
  { nome: "Bidim (geotêxtil)", un: "m²", marcas: ["Bidim"], cat: "Pavimentação" },
  { nome: "Geotêxtil não-tecido", un: "m²", cat: "Pavimentação" },
  { nome: "Geomembrana", un: "m²", cat: "Pavimentação" },
  { nome: "Manta asfáltica 4mm", un: "m²", marcas: ["Vedacit", "Denver", "Sika"], cat: "Pavimentação" },
  { nome: "Manta asfáltica 3mm", un: "m²", marcas: ["Vedacit", "Denver", "Sika"], cat: "Pavimentação" },
  { nome: "Geogrelha", un: "m²", cat: "Pavimentação" },
  { nome: "Tinta para sinalização viária", un: "unidades", cat: "Pavimentação" },
  { nome: "Termoplástico para pintura viária", un: "kg", cat: "Pavimentação" },
  { nome: "Tachão refletivo bidirecional", un: "unidades", cat: "Pavimentação" },
  { nome: "Tacha refletiva monodirecional", un: "unidades", cat: "Pavimentação" },

  // ═══ REVESTIMENTO ═══
  { nome: "Porcelanato 60×60 (m²)", un: "m²", marcas: ["Portobello", "Eliane", "Cecrisa", "Portinari"], cat: "Revestimento" },
  { nome: "Porcelanato 80×80 (m²)", un: "m²", marcas: ["Portobello", "Eliane", "Portinari"], cat: "Revestimento" },
  { nome: "Porcelanato retificado 90×90", un: "m²", marcas: ["Portobello", "Eliane"], cat: "Revestimento" },
  { nome: "Cerâmica 30×30 (m²)", un: "m²", marcas: ["Cecrisa", "Eliane", "Incepa"], cat: "Revestimento" },
  { nome: "Cerâmica 40×40 (m²)", un: "m²", marcas: ["Cecrisa", "Eliane", "Incepa"], cat: "Revestimento" },
  { nome: "Cerâmica 45×45 (m²)", un: "m²", marcas: ["Cecrisa", "Eliane"], cat: "Revestimento" },
  { nome: "Cerâmica 60×60 (m²)", un: "m²", marcas: ["Cecrisa", "Eliane"], cat: "Revestimento" },
  { nome: "Azulejo 20×20 (m²)", un: "m²", marcas: ["Eliane", "Incepa"], cat: "Revestimento" },
  { nome: "Azulejo 30×40 (m²)", un: "m²", marcas: ["Eliane", "Incepa"], cat: "Revestimento" },
  { nome: "Azulejo 30×60 (m²)", un: "m²", marcas: ["Eliane", "Incepa", "Portobello"], cat: "Revestimento" },
  { nome: "Pastilha de vidro (m²)", un: "m²", marcas: ["Atlas", "Vidrotil"], cat: "Revestimento" },
  { nome: "Piso vinílico (m²)", un: "m²", marcas: ["Tarkett", "Eucafloor"], cat: "Revestimento" },
  { nome: "Piso laminado (m²)", un: "m²", marcas: ["Eucafloor", "Quick Step"], cat: "Revestimento" },
  { nome: "Forro de PVC (m²)", un: "m²", marcas: ["Plasbil"], cat: "Revestimento" },
  { nome: "Forro de gesso (m²)", un: "m²", cat: "Revestimento" },
  { nome: "Drywall ST 1,80m × 1,20m × 12,5mm", un: "peças", marcas: ["Knauf", "Placo"], cat: "Revestimento" },
  { nome: "Drywall RU (resistente à umidade)", un: "peças", marcas: ["Knauf", "Placo"], cat: "Revestimento" },
  { nome: "Drywall RF (resistente ao fogo)", un: "peças", marcas: ["Knauf"], cat: "Revestimento" },
  { nome: "Perfil drywall montante", un: "barras", marcas: ["Knauf"], cat: "Revestimento" },
  { nome: "Massa drywall 20kg", un: "sacos", marcas: ["Knauf"], cat: "Revestimento" },
  { nome: "Soleira granito 0,15m", un: "unidades", cat: "Revestimento" },
  { nome: "Soleira mármore 0,15m", un: "unidades", cat: "Revestimento" },
  { nome: "Pingadeira", un: "unidades", cat: "Revestimento" },
  { nome: "Peitoril granito", un: "m²", cat: "Revestimento" },
  { nome: "Bancada granito (m²)", un: "m²", cat: "Revestimento" },
  { nome: "Bancada mármore (m²)", un: "m²", cat: "Revestimento" },

  // ═══ EPI ═══
  { nome: "Capacete branco com jugular CA", un: "unidades", marcas: ["3M", "MSA", "Plastcor"], cat: "EPI" },
  { nome: "Capacete amarelo CA", un: "unidades", marcas: ["3M", "MSA", "Plastcor"], cat: "EPI" },
  { nome: "Capacete azul CA", un: "unidades", marcas: ["3M", "MSA"], cat: "EPI" },
  { nome: "Capacete vermelho CA", un: "unidades", marcas: ["3M", "MSA"], cat: "EPI" },
  { nome: "Luva de raspa de couro CA", un: "unidades", marcas: ["Volk"], cat: "EPI" },
  { nome: "Luva nitrílica preta CA", un: "unidades", marcas: ["3M", "Volk"], cat: "EPI" },
  { nome: "Luva PVC cano longo CA", un: "unidades", marcas: ["Volk"], cat: "EPI" },
  { nome: "Luva latex pigmentada CA", un: "unidades", marcas: ["Volk"], cat: "EPI" },
  { nome: "Luva anticorte CA", un: "unidades", marcas: ["3M"], cat: "EPI" },
  { nome: "Bota de couro com bico de aço CA", un: "unidades", marcas: ["Marluvas", "Vulcabras"], cat: "EPI" },
  { nome: "Bota de borracha cano longo CA", un: "unidades", marcas: ["Marluvas", "Vulcabras"], cat: "EPI" },
  { nome: "Bota PVC cano curto CA", un: "unidades", marcas: ["Marluvas"], cat: "EPI" },
  { nome: "Óculos de proteção incolor CA", un: "unidades", marcas: ["3M", "MSA"], cat: "EPI" },
  { nome: "Óculos de proteção fumê CA", un: "unidades", marcas: ["3M", "MSA"], cat: "EPI" },
  { nome: "Protetor auricular plug CA", un: "unidades", marcas: ["3M", "MSA"], cat: "EPI" },
  { nome: "Abafador de ruído CA", un: "unidades", marcas: ["3M", "MSA"], cat: "EPI" },
  { nome: "Máscara PFF1 CA", un: "unidades", marcas: ["3M", "MSA"], cat: "EPI" },
  { nome: "Máscara PFF2 CA", un: "unidades", marcas: ["3M", "MSA"], cat: "EPI" },
  { nome: "Máscara descartável (pct)", un: "unidades", marcas: ["3M"], cat: "EPI" },
  { nome: "Máscara semifacial CA", un: "unidades", marcas: ["3M", "MSA"], cat: "EPI" },
  { nome: "Cinto de segurança paraquedista CA", un: "unidades", marcas: ["3M Protecta", "MSA"], cat: "EPI" },

  // ═══ FERRAMENTAS ═══
  { nome: "Trena 5m", un: "unidades", marcas: ["Tramontina", "Vonder", "Stanley"], cat: "Ferramenta" },
  { nome: "Trena 7,5m", un: "unidades", marcas: ["Tramontina", "Vonder", "Stanley"], cat: "Ferramenta" },
  { nome: "Trena 10m", un: "unidades", marcas: ["Tramontina", "Vonder"], cat: "Ferramenta" },
  { nome: "Trena 30m fibra de vidro", un: "unidades", marcas: ["Vonder"], cat: "Ferramenta" },
  { nome: "Trena 50m fibra de vidro", un: "unidades", marcas: ["Vonder"], cat: "Ferramenta" },
  { nome: "Trena a laser 30m", un: "unidades", marcas: ["Bosch", "Vonder", "DeWalt"], cat: "Ferramenta" },
  { nome: "Esquadro de pedreiro", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Nível bolha 30cm", un: "unidades", marcas: ["Tramontina", "Vonder"], cat: "Ferramenta" },
  { nome: "Nível bolha 60cm", un: "unidades", marcas: ["Tramontina", "Vonder"], cat: "Ferramenta" },
  { nome: "Nível a laser linha", un: "unidades", marcas: ["Bosch", "Vonder", "DeWalt"], cat: "Ferramenta" },
  { nome: "Prumo de centro", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Martelo de unha 27mm", un: "unidades", marcas: ["Tramontina", "Vonder", "Stanley"], cat: "Ferramenta" },
  { nome: "Martelo de pedreiro 1kg", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Marreta 1kg cabo madeira", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Marreta 2kg cabo madeira", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Marreta 5kg cabo madeira", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Talhadeira", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Picareta com cabo", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Enxada com cabo", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Enxadão com cabo", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Pá quadrada com cabo", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Pá de bico com cabo", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Carrinho de mão 60L", un: "unidades", marcas: ["Tramontina", "Metasul"], cat: "Ferramenta" },
  { nome: "Carrinho de mão reforçado", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Caçamba metálica", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Colher de pedreiro 8\"", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Colher de pedreiro 10\"", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Desempenadeira de aço", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Desempenadeira de PVC", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Desempenadeira dentada", un: "unidades", marcas: ["Tramontina"], cat: "Ferramenta" },
  { nome: "Régua de alumínio 2m", un: "unidades", cat: "Ferramenta" },
  { nome: "Régua de alumínio 3m", un: "unidades", cat: "Ferramenta" },
  { nome: "Linha de pedreiro 100m", un: "unidades", cat: "Ferramenta" },
  { nome: "Bisnaga para rejunte", un: "unidades", cat: "Ferramenta" },

  // ═══ FERRAMENTAS ELÉTRICAS ═══
  { nome: "Furadeira de impacto 650W", un: "unidades", marcas: ["Bosch", "Makita", "DeWalt", "Vonder"], cat: "Ferramenta" },
  { nome: "Parafusadeira 12V", un: "unidades", marcas: ["Bosch", "Makita", "DeWalt"], cat: "Ferramenta" },
  { nome: "Esmerilhadeira angular 4 1/2", un: "unidades", marcas: ["Bosch", "Makita", "DeWalt", "Vonder"], cat: "Ferramenta" },
  { nome: "Esmerilhadeira 7\"", un: "unidades", marcas: ["Bosch", "Makita", "DeWalt"], cat: "Ferramenta" },
  { nome: "Serra circular 7 1/4", un: "unidades", marcas: ["Bosch", "Makita", "DeWalt"], cat: "Ferramenta" },
  { nome: "Serra mármore 4 3/8", un: "unidades", marcas: ["Bosch", "Makita"], cat: "Ferramenta" },
  { nome: "Martelete rompedor 800W", un: "unidades", marcas: ["Bosch", "Makita", "DeWalt"], cat: "Ferramenta" },

  // ═══ DISCOS / BROCAS / LÂMINAS ═══
  { nome: "Disco de corte 4 1/2 metal", un: "unidades", marcas: ["Norton", "Bosch", "3M"], cat: "Ferramenta" },
  { nome: "Disco de corte 7\" metal", un: "unidades", marcas: ["Norton", "Bosch"], cat: "Ferramenta" },
  { nome: "Disco diamantado 4 1/2", un: "unidades", marcas: ["Norton", "Bosch"], cat: "Ferramenta" },
  { nome: "Disco diamantado 7\"", un: "unidades", marcas: ["Norton", "Bosch"], cat: "Ferramenta" },
  { nome: "Disco de desbaste 4 1/2", un: "unidades", marcas: ["Norton", "Bosch"], cat: "Ferramenta" },
  { nome: "Broca para concreto 6mm", un: "unidades", marcas: ["Bosch", "Makita"], cat: "Ferramenta" },
  { nome: "Broca para concreto 8mm", un: "unidades", marcas: ["Bosch", "Makita"], cat: "Ferramenta" },
  { nome: "Broca para concreto 10mm", un: "unidades", marcas: ["Bosch", "Makita"], cat: "Ferramenta" },
  { nome: "Broca para concreto 12mm", un: "unidades", marcas: ["Bosch", "Makita"], cat: "Ferramenta" },
  { nome: "Broca para metal HSS 5mm", un: "unidades", marcas: ["Bosch", "Makita"], cat: "Ferramenta" },
  { nome: "Broca para madeira 8mm", un: "unidades", marcas: ["Bosch"], cat: "Ferramenta" },
  { nome: "Lâmina de serra de mão", un: "unidades", marcas: ["Starrett", "Bosch"], cat: "Ferramenta" },

  // ═══ FIXAÇÃO ═══
  { nome: "Parafuso autobrocante 4,2×13mm (cx 100)", un: "unidades", cat: "Fixação" },
  { nome: "Parafuso para madeira 3×30mm (cx 100)", un: "unidades", cat: "Fixação" },
  { nome: "Parafuso para drywall 25mm (cx 100)", un: "unidades", cat: "Fixação" },
  { nome: "Prego 17×21 (1kg)", un: "kg", cat: "Fixação" },
  { nome: "Prego 17×27 (1kg)", un: "kg", cat: "Fixação" },
  { nome: "Prego 18×30 (1kg)", un: "kg", cat: "Fixação" },
  { nome: "Prego 19×36 (1kg)", un: "kg", cat: "Fixação" },
  { nome: "Prego 20×42 (1kg)", un: "kg", cat: "Fixação" },
  { nome: "Prego 22×48 (1kg)", un: "kg", cat: "Fixação" },
  { nome: "Prego sem cabeça 17×24 (1kg)", un: "kg", cat: "Fixação" },
  { nome: "Pino de aço para fixação", un: "unidades", cat: "Fixação" },

  // ═══ DIVERSOS ═══
  { nome: "Saco de cimento vazio", un: "unidades", cat: "Diversos" },
  { nome: "Saco de ráfia", un: "unidades", cat: "Diversos" },
  { nome: "Saco de lixo industrial 100L (pct)", un: "unidades", cat: "Diversos" },
  { nome: "Lona plástica preta 4×100m", un: "rolos", cat: "Diversos" },
  { nome: "Lona plástica branca 4×100m", un: "rolos", cat: "Diversos" },
  { nome: "Lona azul reforçada", un: "m²", cat: "Diversos" },
  { nome: "Tela mosquiteiro fibra", un: "m²", cat: "Diversos" },
  { nome: "Tela de proteção fachada", un: "m²", cat: "Diversos" },
  { nome: "Andaime metálico tubular 1×1m", un: "unidades", marcas: ["Mills", "Megalux"], cat: "Diversos" },
  { nome: "Andaime fachadeiro multidirecional", un: "unidades", marcas: ["Mills"], cat: "Diversos" },
  { nome: "Plataforma metálica", un: "unidades", cat: "Diversos" },
  { nome: "Cola branca PVA 1kg", un: "unidades", marcas: ["Cascola", "Tekbond"], cat: "Diversos" },
  { nome: "Cola de contato 750g", un: "unidades", marcas: ["Cascola", "Tekbond"], cat: "Diversos" },
  { nome: "Cola epóxi 12g (par)", un: "unidades", marcas: ["Tekbond", "Loctite"], cat: "Diversos" },
  { nome: "Massa epóxi 100g", un: "unidades", marcas: ["Tekbond"], cat: "Diversos" },
  { nome: "Selante PU (cartucho 310ml)", un: "unidades", marcas: ["Sika", "Vedacit"], cat: "Diversos" },
  { nome: "Selante silicone neutro 280g", un: "unidades", marcas: ["Sika", "Tekbond"], cat: "Diversos" },
  { nome: "Espuma de poliuretano expansiva 750ml", un: "unidades", marcas: ["Sika", "Soudal"], cat: "Diversos" },
  { nome: "Manta isolante térmica subcobertura", un: "m²", cat: "Diversos" },
  { nome: "Lã de rocha 50mm", un: "m²", marcas: ["Rockfibras", "Isover"], cat: "Diversos" },
  { nome: "Lã de vidro 50mm", un: "m²", marcas: ["Isover"], cat: "Diversos" },
  { nome: "Isopor 50mm placa", un: "peças", cat: "Diversos" },
  { nome: "Placa OSB 11,1mm × 1,22×2,44m", un: "peças", marcas: ["LP Building"], cat: "Diversos" },

  // ═══ FÔRMAS ═══
  { nome: "Tábua para fôrma de pinus", un: "peças", cat: "Fôrma" },
  { nome: "Sarrafo para escoramento", un: "peças", cat: "Fôrma" },
  { nome: "Pino metálico para fôrma", un: "unidades", cat: "Fôrma" },
  { nome: "Tirante para fôrma", un: "unidades", cat: "Fôrma" },
  { nome: "Cone para fôrma", un: "unidades", cat: "Fôrma" },
  { nome: "Espaçador plástico para concreto", un: "unidades", cat: "Fôrma" },
  { nome: "Pontalete metálico ajustável", un: "unidades", marcas: ["Mills"], cat: "Fôrma" },
];

// Lista plana só com nomes — pra busca textual
const MATERIAIS_BANCO = MATERIAIS_BANCO_DETALHADO.map(m => m.nome);
const MATERIAIS = MATERIAIS_BANCO; // mantém compatibilidade

/* ════════════════════════════════════════════════════
   CATÁLOGO PROFISSIONAL — FROTA / ATIVOS
   Máquinas pesadas, veículos, equipamentos motorizados
══════════════════════════════════════════════════════ */
const CATALOGO_FROTA = [
  // 🚚 CAMINHÕES
  { nome: "Caminhão Basculante 6m³", tipo: "Caminhão", icon: "🚚", combustivel: "Diesel", consumoMedio: 3.5, valorHora: 150 },
  { nome: "Caminhão Basculante 10m³", tipo: "Caminhão", icon: "🚚", combustivel: "Diesel", consumoMedio: 2.8, valorHora: 180 },
  { nome: "Caminhão Basculante 12m³", tipo: "Caminhão", icon: "🚚", combustivel: "Diesel", consumoMedio: 2.5, valorHora: 200 },
  { nome: "Caminhão Carroceria 4 ton", tipo: "Caminhão", icon: "🚛", combustivel: "Diesel", consumoMedio: 5, valorHora: 120 },
  { nome: "Caminhão Carroceria 8 ton", tipo: "Caminhão", icon: "🚛", combustivel: "Diesel", consumoMedio: 4, valorHora: 140 },
  { nome: "Caminhão Munck 6 ton", tipo: "Caminhão", icon: "🏗️", combustivel: "Diesel", consumoMedio: 3.5, valorHora: 180 },
  { nome: "Caminhão Munck 10 ton", tipo: "Caminhão", icon: "🏗️", combustivel: "Diesel", consumoMedio: 3, valorHora: 220 },
  { nome: "Caminhão Pipa 8.000L", tipo: "Caminhão", icon: "💧", combustivel: "Diesel", consumoMedio: 3.5, valorHora: 160 },
  { nome: "Caminhão Pipa 10.000L", tipo: "Caminhão", icon: "💧", combustivel: "Diesel", consumoMedio: 3, valorHora: 180 },
  { nome: "Caminhão Pipa 15.000L", tipo: "Caminhão", icon: "💧", combustivel: "Diesel", consumoMedio: 2.5, valorHora: 220 },
  { nome: "Caminhão Betoneira 8m³", tipo: "Caminhão", icon: "🚧", combustivel: "Diesel", consumoMedio: 2.5, valorHora: 250 },
  { nome: "Caminhão de Combustível", tipo: "Caminhão", icon: "⛽", combustivel: "Diesel", consumoMedio: 4, valorHora: 180 },
  { nome: "Caminhão Plataforma", tipo: "Caminhão", icon: "🚚", combustivel: "Diesel", consumoMedio: 4, valorHora: 150 },
  { nome: "Caminhão Toco", tipo: "Caminhão", icon: "🚛", combustivel: "Diesel", consumoMedio: 5, valorHora: 110 },
  { nome: "Caminhão Truck", tipo: "Caminhão", icon: "🚚", combustivel: "Diesel", consumoMedio: 3, valorHora: 170 },

  // 🚜 MÁQUINAS PESADAS
  { nome: "Retroescavadeira", tipo: "Retroescavadeira", icon: "🚜", combustivel: "Diesel", consumoMedio: 8, valorHora: 130 },
  { nome: "Retroescavadeira 4x4", tipo: "Retroescavadeira", icon: "🚜", combustivel: "Diesel", consumoMedio: 9, valorHora: 150 },
  { nome: "Escavadeira Hidráulica 14 ton", tipo: "Escavadeira", icon: "⛏️", combustivel: "Diesel", consumoMedio: 14, valorHora: 180 },
  { nome: "Escavadeira Hidráulica 20 ton", tipo: "Escavadeira", icon: "⛏️", combustivel: "Diesel", consumoMedio: 18, valorHora: 220 },
  { nome: "Escavadeira Hidráulica 30 ton", tipo: "Escavadeira", icon: "⛏️", combustivel: "Diesel", consumoMedio: 25, valorHora: 280 },
  { nome: "Mini Escavadeira", tipo: "Escavadeira", icon: "⛏️", combustivel: "Diesel", consumoMedio: 5, valorHora: 110 },
  { nome: "Pá Carregadeira", tipo: "Pá Carregadeira", icon: "🚜", combustivel: "Diesel", consumoMedio: 12, valorHora: 160 },
  { nome: "Pá Carregadeira Compacta (Bobcat)", tipo: "Mini Carregadeira", icon: "🚜", combustivel: "Diesel", consumoMedio: 6, valorHora: 120 },
  { nome: "Motoniveladora (Patrol)", tipo: "Motoniveladora", icon: "🚜", combustivel: "Diesel", consumoMedio: 15, valorHora: 200 },
  { nome: "Rolo Compactador Vibratório", tipo: "Rolo", icon: "🚧", combustivel: "Diesel", consumoMedio: 8, valorHora: 140 },
  { nome: "Rolo Compactador Pé de Carneiro", tipo: "Rolo", icon: "🚧", combustivel: "Diesel", consumoMedio: 9, valorHora: 150 },
  { nome: "Rolo Compactador Pneu", tipo: "Rolo", icon: "🚧", combustivel: "Diesel", consumoMedio: 7, valorHora: 130 },
  { nome: "Trator de Esteira", tipo: "Trator", icon: "🚜", combustivel: "Diesel", consumoMedio: 18, valorHora: 220 },
  { nome: "Trator Agrícola", tipo: "Trator", icon: "🚜", combustivel: "Diesel", consumoMedio: 8, valorHora: 100 },
  { nome: "Empilhadeira Diesel", tipo: "Empilhadeira", icon: "🏗️", combustivel: "Diesel", consumoMedio: 4, valorHora: 80 },
  { nome: "Empilhadeira Elétrica", tipo: "Empilhadeira", icon: "🏗️", combustivel: "Elétrico", consumoMedio: 0, valorHora: 70 },

  // 🏗️ EQUIPAMENTOS ESPECIAIS
  { nome: "Grua / Guindaste", tipo: "Grua", icon: "🏗️", combustivel: "Diesel", consumoMedio: 8, valorHora: 280 },
  { nome: "Plataforma Elevatória Tesoura", tipo: "Plataforma", icon: "🏗️", combustivel: "Elétrico", consumoMedio: 0, valorHora: 100 },
  { nome: "Plataforma Elevatória Articulada", tipo: "Plataforma", icon: "🏗️", combustivel: "Diesel", consumoMedio: 4, valorHora: 130 },
  { nome: "Usina de Asfalto Portátil", tipo: "Usina", icon: "🏗️", combustivel: "Diesel", consumoMedio: 20, valorHora: 400 },
  { nome: "Acabadora de Asfalto", tipo: "Acabadora", icon: "🚧", combustivel: "Diesel", consumoMedio: 14, valorHora: 250 },
  { nome: "Espargidor de Asfalto", tipo: "Espargidor", icon: "🚧", combustivel: "Diesel", consumoMedio: 6, valorHora: 140 },
  { nome: "Compressor Diesel Móvel", tipo: "Compressor", icon: "💨", combustivel: "Diesel", consumoMedio: 4, valorHora: 80 },
  { nome: "Gerador Diesel 50 KVA", tipo: "Gerador", icon: "⚡", combustivel: "Diesel", consumoMedio: 6, valorHora: 90 },
  { nome: "Gerador Diesel 150 KVA", tipo: "Gerador", icon: "⚡", combustivel: "Diesel", consumoMedio: 15, valorHora: 150 },

  // 🚗 VEÍCULOS LEVES
  { nome: "Carro / Veículo de Apoio", tipo: "Carro", icon: "🚗", combustivel: "Gasolina", consumoMedio: 10, valorHora: 0 },
  { nome: "Caminhonete (Pick-up)", tipo: "Caminhonete", icon: "🛻", combustivel: "Diesel", consumoMedio: 8, valorHora: 0 },
  { nome: "Van / Furgão", tipo: "Van", icon: "🚐", combustivel: "Diesel", consumoMedio: 9, valorHora: 0 },
  { nome: "Moto / Motocicleta", tipo: "Moto", icon: "🏍️", combustivel: "Gasolina", consumoMedio: 35, valorHora: 0 },
];

const CATALOGO_FROTA_NOMES = CATALOGO_FROTA.map(f => f.nome);

/* ════════════════════════════════════════════════════
   CATÁLOGO PROFISSIONAL — EQUIPAMENTOS
   Ferramentas e equipamentos menores de obra
══════════════════════════════════════════════════════ */
const CATALOGO_EQUIPAMENTOS = [
  // 🔄 CONCRETAGEM
  { nome: "Betoneira 150L", icon: "🔄", valorAprox: 1800 },
  { nome: "Betoneira 250L", icon: "🔄", valorAprox: 2200 },
  { nome: "Betoneira 400L", icon: "🔄", valorAprox: 2500 },
  { nome: "Betoneira 600L", icon: "🔄", valorAprox: 3200 },
  { nome: "Vibrador de Concreto Elétrico", icon: "⚙️", valorAprox: 1800 },
  { nome: "Vibrador de Concreto Gasolina", icon: "⚙️", valorAprox: 2500 },
  { nome: "Régua Vibratória", icon: "🔄", valorAprox: 2200 },
  { nome: "Acabadora de Concreto (Helicóptero)", icon: "⚙️", valorAprox: 4500 },
  { nome: "Bomba de Concreto Manual", icon: "🔧", valorAprox: 1200 },

  // 🛠️ DEMOLIÇÃO E PERFURAÇÃO
  { nome: "Martelete / Rompedor Elétrico", icon: "🔨", valorAprox: 1200 },
  { nome: "Martelete Pneumático", icon: "🔨", valorAprox: 1800 },
  { nome: "Marreta Demolidora", icon: "🔨", valorAprox: 850 },
  { nome: "Furadeira de Impacto", icon: "🔧", valorAprox: 400 },
  { nome: "Furadeira Industrial", icon: "🔧", valorAprox: 850 },
  { nome: "Parafusadeira", icon: "🔧", valorAprox: 350 },
  { nome: "Perfuratriz", icon: "🔧", valorAprox: 2500 },

  // 🪚 CORTE E DESBASTE
  { nome: "Serra Circular", icon: "⚙️", valorAprox: 600 },
  { nome: "Serra Mármore", icon: "⚙️", valorAprox: 700 },
  { nome: "Serra Tico-tico", icon: "⚙️", valorAprox: 400 },
  { nome: "Serra de Bancada", icon: "⚙️", valorAprox: 1500 },
  { nome: "Serra Policorte", icon: "⚙️", valorAprox: 1200 },
  { nome: "Esmerilhadeira Angular", icon: "⚙️", valorAprox: 350 },
  { nome: "Esmerilhadeira Grande", icon: "⚙️", valorAprox: 650 },
  { nome: "Lixadeira Orbital", icon: "🛠️", valorAprox: 450 },
  { nome: "Lixadeira de Parede", icon: "🛠️", valorAprox: 850 },
  { nome: "Lixadeira de Cinta", icon: "🛠️", valorAprox: 600 },
  { nome: "Plaina Elétrica", icon: "🛠️", valorAprox: 550 },

  // 🚧 COMPACTAÇÃO
  { nome: "Compactador de Placa (Sapinho)", icon: "🛠️", valorAprox: 5000 },
  { nome: "Compactador Tipo Sapo", icon: "🛠️", valorAprox: 5500 },
  { nome: "Mini Rolo Compactador", icon: "🚧", valorAprox: 8000 },
  { nome: "Soquete Pneumático", icon: "🔨", valorAprox: 1500 },

  // ⚡ ELÉTRICOS E PNEUMÁTICOS
  { nome: "Gerador Gasolina 2,5 KVA", icon: "⚡", valorAprox: 2000 },
  { nome: "Gerador Gasolina 5 KVA", icon: "⚡", valorAprox: 3500 },
  { nome: "Gerador Diesel 10 KVA", icon: "⚡", valorAprox: 12000 },
  { nome: "Compressor de Ar 10pcm", icon: "💨", valorAprox: 2500 },
  { nome: "Compressor de Ar 20pcm", icon: "💨", valorAprox: 4500 },
  { nome: "Soldadora Inversora", icon: "⚡", valorAprox: 1500 },
  { nome: "Soldadora a Diesel", icon: "⚡", valorAprox: 8000 },
  { nome: "Transformador 220/110V", icon: "⚡", valorAprox: 800 },

  // 💧 BOMBAS E ÁGUA
  { nome: "Bomba Submersa Pequena", icon: "💧", valorAprox: 850 },
  { nome: "Bomba Submersa Grande", icon: "💧", valorAprox: 2200 },
  { nome: "Motobomba Centrífuga", icon: "💧", valorAprox: 1200 },
  { nome: "Motobomba de Lama", icon: "💧", valorAprox: 2800 },
  { nome: "Bomba Recalque", icon: "💧", valorAprox: 1500 },
  { nome: "Lavadora de Alta Pressão", icon: "💧", valorAprox: 1800 },

  // 📏 MEDIÇÃO
  { nome: "Trena Laser", icon: "📏", valorAprox: 350 },
  { nome: "Nível a Laser", icon: "📏", valorAprox: 800 },
  { nome: "Nível de Mangueira", icon: "📏", valorAprox: 80 },
  { nome: "Esquadro Magnético", icon: "📏", valorAprox: 120 },
  { nome: "Teodolito", icon: "📏", valorAprox: 6500 },
  { nome: "Estação Total", icon: "📏", valorAprox: 25000 },
  { nome: "Nível Óptico", icon: "📏", valorAprox: 2200 },
  { nome: "GPS Topográfico", icon: "📏", valorAprox: 18000 },

  // 🏗️ ANDAIMES E ESTRUTURAS
  { nome: "Andaime Tubular (módulo)", icon: "🏗️", valorAprox: 280 },
  { nome: "Andaime Fachadeiro (módulo)", icon: "🏗️", valorAprox: 350 },
  { nome: "Andaime Multidirecional (módulo)", icon: "🏗️", valorAprox: 450 },
  { nome: "Escora Metálica Regulável", icon: "🏗️", valorAprox: 85 },
  { nome: "Escora Metálica Tubular", icon: "🏗️", valorAprox: 120 },
  { nome: "Escada Extensível Alumínio", icon: "🪜", valorAprox: 600 },
  { nome: "Escada Industrial 13 degraus", icon: "🪜", valorAprox: 350 },

  // 🛒 TRANSPORTE
  { nome: "Carrinho de Mão", icon: "🛒", valorAprox: 180 },
  { nome: "Carrinho Plataforma", icon: "🛒", valorAprox: 280 },
  { nome: "Carrinho Hidráulico (Paleteira)", icon: "🛒", valorAprox: 1500 },
  { nome: "Padiola", icon: "🛒", valorAprox: 60 },
  { nome: "Giricos / Caçamba Plástica", icon: "🛒", valorAprox: 120 },

  // 🔧 FERRAMENTAS MANUAIS
  { nome: "Pá Quadrada", icon: "🔧", valorAprox: 35 },
  { nome: "Pá Curva (de bico)", icon: "🔧", valorAprox: 35 },
  { nome: "Enxada", icon: "🔧", valorAprox: 30 },
  { nome: "Picareta", icon: "🔧", valorAprox: 45 },
  { nome: "Marreta", icon: "🔧", valorAprox: 40 },
  { nome: "Chave de Fenda Industrial", icon: "🔧", valorAprox: 35 },
  { nome: "Alicate Industrial", icon: "🔧", valorAprox: 50 },
  { nome: "Jogo de Chaves Combinadas", icon: "🔧", valorAprox: 180 },

  // 🛡️ EPIs E SEGURANÇA
  { nome: "Capacete Aba Frontal", icon: "🛡️", valorAprox: 25 },
  { nome: "Capacete com Jugular", icon: "🛡️", valorAprox: 35 },
  { nome: "Cinto Paraquedista", icon: "🛡️", valorAprox: 280 },
  { nome: "Talabarte Y", icon: "🛡️", valorAprox: 180 },
  { nome: "Linha de Vida", icon: "🛡️", valorAprox: 350 },
  { nome: "Cone Sinalização 75cm", icon: "🛡️", valorAprox: 35 },
  { nome: "Cone Sinalização 100cm", icon: "🛡️", valorAprox: 55 },
  { nome: "Tela de Sinalização (m)", icon: "🛡️", valorAprox: 8 },
  { nome: "Fita Zebrada (rolo)", icon: "🛡️", valorAprox: 25 },

  // 💡 ILUMINAÇÃO
  { nome: "Refletor LED Obra 50W", icon: "💡", valorAprox: 120 },
  { nome: "Refletor LED Obra 100W", icon: "💡", valorAprox: 200 },
  { nome: "Refletor LED Obra 200W", icon: "💡", valorAprox: 380 },
  { nome: "Holofote (Balizador)", icon: "💡", valorAprox: 850 },
  { nome: "Lâmpada Portátil c/ Gancho", icon: "💡", valorAprox: 65 },

  // 🧰 OUTROS
  { nome: "Caixa Ferramenta Profissional", icon: "🧰", valorAprox: 280 },
  { nome: "Bancada de Marceneiro", icon: "🪚", valorAprox: 1200 },
  { nome: "Cavalete de Apoio", icon: "🪚", valorAprox: 180 },
  { nome: "Container 6 metros", icon: "📦", valorAprox: 8500 },
  { nome: "Container 12 metros", icon: "📦", valorAprox: 15000 },
];

const CATALOGO_EQUIPAMENTOS_NOMES = CATALOGO_EQUIPAMENTOS.map(e => e.nome);
// Acesso rápido por nome -> objeto detalhado
const MATERIAL_INFO = {};
MATERIAIS_BANCO_DETALHADO.forEach(m => { MATERIAL_INFO[m.nome] = m; });
const EQUIP_COLOR = { "Em Uso": BLUE, "Quebrada": RED, "Disponível": GREEN };
const STATUS_COLOR = { "Presente": GREEN, "Falta": RED, "Atestado": ORANGE };

const DEFAULT_USUARIOS = [
  { id: 1, nome: "Kleber Vieira Martins", email: "kleber@km.com",   senha: "123", pin: "", biometriaAtiva: false, perfil: "gestor",      obraId: null, tel: "(28) 99925-8172" },
];

const EMPRESA_PADRAO = {
  razaoSocial: "KM CONSULTORIA, ASSESSORIA E SERVICOS DE ENGENHARIA LTDA",
  nomeFantasia: "KM SERVICOS",
  cnpj: "60.368.233/0001-73",
  inscEstadual: "",
  porte: "ME",
  natureza: "Sociedade Empresária Limitada",
  atividadePrincipal: "71.12-0-00 - Serviços de engenharia",
  dataAbertura: "11/04/2025",
  responsavel: "Kleber Vieira Martins",
  email: "kvmprojetos@gmail.com",
  telefone: "(28) 99925-8172",
  registro: "CREA-ES",
  // Endereço completo
  logradouro: "R Pastor da Silva Colares",
  numero: "148",
  complemento: "",
  bairro: "Guararema",
  cidade: "Alegre",
  uf: "ES",
  cep: "29.500-000",
  endereco: "R Pastor da Silva Colares, 148 - Guararema, Alegre - ES, 29.500-000",
  instagram: "km_engenharias",
  // Alimentação (valores configuráveis)
  valorCafeManha: 13,
  valorCafeTarde: 0,
  valorMarmita: 18,
  valorLanche: 0,
};

// Funcionários do escritório (custo INDIRETO, rateado entre obras ativas)
const DEFAULT_FUNC_ESCRITORIO = [
  { id: 1, nome: "Mozart", cargo: "Engenheiro Orçamentista", salarioMensal: 0, ativo: true, dataAdmissao: "" },
];

const DEFAULT_ATIVOS = [
  // Retroescavadeiras
  { id: 1, tipo: "Retroescavadeira", nome: "Retroescavadeira 01", placa: "", marca: "", modelo: "", ano: "", obraId: 1, horimetro: 0, valorHora: 80, responsavel: "Geovane", combustivel: "Diesel", consumoMedio: 8, status: "Ativo" },

  // Carro do Kleber (placeholder pra ser editado)
  { id: 2, tipo: "Carro", nome: "Carro do Kleber", placa: "", marca: "", modelo: "", ano: "", cor: "", obraId: null, km: 0, valorHora: 0, responsavel: "Kleber Vieira Martins", combustivel: "Gasolina", consumoMedio: 10, status: "Ativo" },
];

// Valores-hora por cargo (R$/h) para apropriação de custo
const VALOR_HORA_CARGO = {
  "Pedreiro": 18, "Armador": 16, "Servente": 12, "Auxiliar": 12,
  "Eletricista": 22, "Encanador": 22, "Pintor": 16,
  "Mestre de Obras": 30, "Encarregado": 28, "Encarregado / Operador Retroescavadeira": 32,
  "Operador de Máquina": 25, "Carpinteiro": 18, "Azulejista": 20,
  "Motorista": 18, "Vigia": 12,
};

/* ── SHARED STYLES ── */
const labelS = { fontSize: 12, color: "#666", marginBottom: 4, display: "block" };
const inputS = { width: "100%", boxSizing: "border-box", border: "1.5px solid #dde2ef", borderRadius: 10, padding: "12px 13px", fontSize: 14, outline: "none", marginBottom: 12, background: "#f9fafb", fontFamily: "inherit", minHeight: 44 };
const selS   = { ...inputS, appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23666' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 13px center" };
const bigBtn = (color) => ({ background: color, color: "#fff", border: "none", borderRadius: 10, padding: "13px 0", fontSize: 15, fontWeight: 800, cursor: "pointer", width: "100%", letterSpacing: 0.8, boxShadow: `0 3px 10px ${color}55` });
const css = (...objs) => Object.assign({}, ...objs);

/* ── COMPONENTS ── */
const Badge = ({ label, color, small }) => (
  <span style={{ background: color, color: "#fff", borderRadius: 20, padding: small ? "3px 9px" : "5px 13px", fontSize: small ? 11 : 13, fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>
);

const Btn = ({ label, color = NAVY, text = "#fff", onClick, disabled, style: sx, danger }) => (
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
function EmptyState({ icon = "📦", titulo, subtitulo, botaoLabel, onBotao, cor = NAVY }) {
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

function KMHeader({ title, sub, onBack, right }) {
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

function KMFooter() {
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
function FotoViewer({ src, legenda, onClose }) {
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

function Modal({ show, title, children, onClose }) {
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
function confirmar(mensagem, onConfirm) {
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
function Assinatura({ valor, onChange, label = "Assine abaixo" }) {
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
function TelaPerfilPIN({ usuario, onBack, onAtualizar }) {
  const [biometriaSuportada, setBiometriaSuportada] = useState(false);

  useEffect(() => {
    biometriaDisponivel().then(setBiometriaSuportada);
  }, []);

  const removerPIN = () => {
    if (!confirm("Remover seu PIN? Você precisará criá-lo novamente no próximo login.")) return;
    onAtualizar({ ...usuario, pin: "", biometriaAtiva: false });
    alert("✅ PIN removido. No próximo login, será solicitado um novo PIN.");
  };

  const trocarBiometria = () => {
    if (!biometriaSuportada) {
      alert("ℹ️ Seu dispositivo não suporta biometria ou o app está rodando dentro do Claude.ai (que bloqueia).\n\nPra usar Face ID / Touch ID, é necessário publicar o app como PWA (Vercel/Netlify).");
      return;
    }
    onAtualizar({ ...usuario, biometriaAtiva: !usuario.biometriaAtiva });
    alert(usuario.biometriaAtiva ? "✓ Biometria desativada" : "✓ Biometria ativada");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Meu PIN" sub={usuario.nome} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* Card usuário */}
        <div style={{ background: `linear-gradient(135deg,${NAVY},#1e3a8a)`, color: "#fff", borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
              {usuario.perfil === "gestor" ? "🏢" : "👷"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{usuario.nome}</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>{usuario.perfil === "gestor" ? "Gestor" : "Encarregado"}</div>
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{usuario.email}</div>
            </div>
          </div>
        </div>

        {/* Status do PIN */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${usuario.pin ? GREEN : ORANGE}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>🔐 PIN de Acesso</div>
            <div style={{ background: usuario.pin ? GREEN : ORANGE, color: "#fff", padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 800 }}>
              {usuario.pin ? "✓ ATIVO" : "⚠️ NÃO CADASTRADO"}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#666" }}>
            {usuario.pin
              ? "Seu PIN de 4 dígitos está ativo. É solicitado a cada login."
              : "Sem PIN ainda. Será criado no próximo login."}
          </div>
          {usuario.pin && (
            <button onClick={removerPIN} style={{ width: "100%", marginTop: 10, padding: 10, background: "#fef2f2", color: RED, border: `1px solid ${RED}33`, borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
              🗑️ Remover PIN (criar novo no próximo login)
            </button>
          )}
        </div>

        {/* Status biometria */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${usuario.biometriaAtiva ? GREEN : "#ccc"}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>😊 Face ID / Touch ID</div>
            <div style={{ background: usuario.biometriaAtiva ? GREEN : "#ccc", color: "#fff", padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 800 }}>
              {usuario.biometriaAtiva ? "✓ ATIVA" : "DESATIVADA"}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>
            {biometriaSuportada
              ? (usuario.biometriaAtiva
                  ? "Login automático com Face ID / Touch ID está ativo."
                  : "Seu dispositivo suporta biometria. Ative pra login mais rápido.")
              : "Dispositivo ou ambiente não suporta biometria."}
          </div>
          {biometriaSuportada && (
            <button onClick={trocarBiometria} style={{ width: "100%", padding: 10, background: usuario.biometriaAtiva ? "#fef2f2" : GREEN, color: usuario.biometriaAtiva ? RED : "#fff", border: usuario.biometriaAtiva ? `1px solid ${RED}33` : "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
              {usuario.biometriaAtiva ? "🔓 Desativar biometria" : "🔒 Ativar biometria"}
            </button>
          )}
          {!biometriaSuportada && (
            <div style={{ background: "#fef9e7", borderRadius: 8, padding: "8px 10px", fontSize: 10, color: "#8b6f00", marginTop: 4 }}>
              💡 Pra usar biometria: publique o app como PWA (Vercel) e abra no Safari. Dentro do Claude.ai não funciona.
            </div>
          )}
        </div>

        {/* Info segurança */}
        <div style={{ background: "#f0f7ff", borderRadius: 12, padding: 12, fontSize: 11, color: "#0c4a6e", lineHeight: 1.5 }}>
          🔒 <b>Segurança:</b><br/>
          • PIN é salvo localmente no dispositivo<br/>
          • Cada usuário tem PIN próprio<br/>
          • Email/senha ainda funcionam como fallback<br/>
          • Após 3 tentativas erradas, app sugere usar email/senha
        </div>
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   PIN — Login com 4 dígitos + biometria preparada
════════════════════════════════════ */

// Detecta se o dispositivo SUPORTA biometria via WebAuthn
async function biometriaDisponivel() {
  try {
    if (!window.PublicKeyCredential) return false;
    if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") return false;
    const ok = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return !!ok;
  } catch (e) {
    return false;
  }
}

// Dispara biometria nativa (Face ID / Touch ID) — SÓ funciona em PWA/HTTPS
async function autenticarComBiometria(usuario) {
  try {
    if (!window.PublicKeyCredential) throw new Error("WebAuthn não suportado");

    // Em produção isso seria challenge servidor. Aqui é demo local.
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const credentialOptions = {
      publicKey: {
        challenge,
        rp: { name: "KMZERO" },
        user: {
          id: new TextEncoder().encode(String(usuario.id)),
          name: usuario.email,
          displayName: usuario.nome,
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 30000,
      }
    };

    const credential = await navigator.credentials.create(credentialOptions);
    return !!credential;
  } catch (e) {
    console.warn("Biometria falhou:", e);
    return false;
  }
}

function TelaPIN({ usuario, modo, onSucesso, onCancelar, onCriarPIN }) {
  // modo: "digitar" (já tem pin), "criar" (sem pin ainda), "confirmar" (após criar)
  const [pin, setPin] = useState("");
  const [pinNovo, setPinNovo] = useState("");
  const [pinConfirma, setPinConfirma] = useState("");
  const [etapa, setEtapa] = useState(modo === "criar" ? "novo" : modo === "confirmar" ? "confirmar" : "digitar");
  const [erro, setErro] = useState("");
  const [tentativas, setTentativas] = useState(0);
  const [biometriaSuportada, setBiometriaSuportada] = useState(false);

  // Detecta biometria ao carregar
  useEffect(() => {
    biometriaDisponivel().then(setBiometriaSuportada);
  }, []);

  // Se já tem PIN e biometria ativa, tenta biometria primeiro
  useEffect(() => {
    if (etapa === "digitar" && usuario.biometriaAtiva && biometriaSuportada) {
      setTimeout(async () => {
        const ok = await autenticarComBiometria(usuario);
        if (ok) onSucesso();
      }, 300);
    }
  }, [biometriaSuportada]);

  const valorAtual = etapa === "digitar" ? pin : etapa === "novo" ? pinNovo : pinConfirma;

  const adicionar = (n) => {
    setErro("");
    if (etapa === "digitar") {
      if (pin.length >= 4) return;
      const novoPin = pin + n;
      setPin(novoPin);
      if (novoPin.length === 4) {
        // Valida
        setTimeout(() => {
          if (novoPin === usuario.pin) {
            onSucesso();
          } else {
            setTentativas(t => t + 1);
            setErro("PIN incorreto");
            setPin("");
            // Vibração no celular se disponível
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          }
        }, 150);
      }
    } else if (etapa === "novo") {
      if (pinNovo.length >= 4) return;
      const novo = pinNovo + n;
      setPinNovo(novo);
      if (novo.length === 4) {
        setTimeout(() => setEtapa("confirmar"), 200);
      }
    } else if (etapa === "confirmar") {
      if (pinConfirma.length >= 4) return;
      const conf = pinConfirma + n;
      setPinConfirma(conf);
      if (conf.length === 4) {
        setTimeout(() => {
          if (conf === pinNovo) {
            // Pergunta sobre biometria se suportada
            if (biometriaSuportada) {
              if (confirm("✅ PIN criado!\n\n📱 Seu dispositivo suporta Face ID / Touch ID.\nDeseja ativar biometria pra login mais rápido?\n\n(Funciona quando o app estiver publicado no Vercel/PWA)")) {
                onCriarPIN(pinNovo, true);
              } else {
                onCriarPIN(pinNovo, false);
              }
            } else {
              onCriarPIN(pinNovo, false);
            }
          } else {
            setErro("PINs não coincidem. Tente novamente.");
            setPinNovo("");
            setPinConfirma("");
            setEtapa("novo");
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          }
        }, 150);
      }
    }
  };

  const apagar = () => {
    setErro("");
    if (etapa === "digitar") setPin(p => p.slice(0, -1));
    else if (etapa === "novo") setPinNovo(p => p.slice(0, -1));
    else setPinConfirma(p => p.slice(0, -1));
  };

  const limpar = () => {
    setErro("");
    if (etapa === "digitar") setPin("");
    else if (etapa === "novo") setPinNovo("");
    else setPinConfirma("");
  };

  const titulo = etapa === "digitar" ? "Digite seu PIN" : etapa === "novo" ? "Criar PIN de 4 dígitos" : "Confirme seu PIN";
  const subtitulo = etapa === "digitar" ? "Para acessar o app" : etapa === "novo" ? "Escolha 4 números fáceis de lembrar" : "Digite o mesmo PIN de novo";

  return (
    <div style={{ flex: 1, background: `linear-gradient(175deg,${NAVY} 0%,#071030 100%)`, display: "flex", flexDirection: "column", justifyContent: "center", padding: "20px 24px", color: "#fff" }}>
      {/* Cabeçalho */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ width: 68, height: 68, borderRadius: 34, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 10px" }}>
          {usuario.perfil === "gestor" ? "🏢" : "👷"}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{usuario.nome}</div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>{usuario.perfil === "gestor" ? "Gestor" : "Encarregado"}</div>
      </div>

      {/* Título do estado */}
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{titulo}</div>
        <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>{subtitulo}</div>
      </div>

      {/* Indicador dos 4 dígitos */}
      <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 14 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: 8,
            border: `2px solid ${erro ? RED : "rgba(255,255,255,0.4)"}`,
            background: valorAtual.length > i ? (erro ? RED : "#fff") : "transparent",
            transition: "all 0.15s",
          }} />
        ))}
      </div>

      {/* Erro */}
      {erro && (
        <div style={{ textAlign: "center", color: "#ff8a8a", fontSize: 12, marginBottom: 8, fontWeight: 600 }}>
          ⚠️ {erro} {tentativas >= 3 && "(Tente o login com email/senha)"}
        </div>
      )}

      {/* Biometria — botão se disponível e estiver no modo digitar */}
      {etapa === "digitar" && biometriaSuportada && usuario.biometriaAtiva && (
        <button onClick={async () => { const ok = await autenticarComBiometria(usuario); if (ok) onSucesso(); else setErro("Biometria falhou. Use o PIN."); }} style={{
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.2)",
          color: "#fff", padding: "10px 14px", borderRadius: 12, marginBottom: 14,
          cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8
        }}>
          😊 Entrar com Face ID / Touch ID
        </button>
      )}

      {/* Teclado numérico */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, maxWidth: 280, margin: "0 auto", width: "100%" }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <button key={n} onClick={() => adicionar(String(n))} style={{
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff", fontSize: 22, fontWeight: 700,
            padding: "16px 0", borderRadius: 14, cursor: "pointer",
            transition: "all 0.1s",
          }}>{n}</button>
        ))}
        <button onClick={limpar} style={{
          background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700,
          padding: "16px 0", borderRadius: 14, cursor: "pointer",
        }}>LIMPAR</button>
        <button onClick={() => adicionar("0")} style={{
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#fff", fontSize: 22, fontWeight: 700,
          padding: "16px 0", borderRadius: 14, cursor: "pointer",
        }}>0</button>
        <button onClick={apagar} style={{
          background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.7)", fontSize: 18, fontWeight: 700,
          padding: "16px 0", borderRadius: 14, cursor: "pointer",
        }}>⌫</button>
      </div>

      {/* Voltar */}
      <button onClick={onCancelar} style={{
        background: "transparent", border: "none", color: "rgba(255,255,255,0.5)",
        marginTop: 18, cursor: "pointer", fontSize: 12, fontWeight: 600,
      }}>← Trocar usuário</button>

      {/* Aviso biometria pra quando tiver suporte mas não estiver ativa */}
      {etapa === "digitar" && biometriaSuportada && !usuario.biometriaAtiva && tentativas === 0 && (
        <div style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 14 }}>
          💡 Seu dispositivo suporta biometria
        </div>
      )}
    </div>
  );
}

function TelaLogin({ usuarios, obras = [], onLogin, onAtualizarUsuario, onCadastrar }) {
  const [tipo, setTipo] = useState("encarregado");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [modoForm, setModoForm] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [modoPIN, setModoPIN] = useState(null);
  const [tela, setTelaInterna] = useState("inicial"); // "inicial" | "gestor" | "primeiro_acesso"
  const [emailPrim, setEmailPrim] = useState("");
  const [senhaPrim, setSenhaPrim] = useState("");
  const [emailGestor, setEmailGestor] = useState("");
  const [senhaGestor, setSenhaGestor] = useState("");

  // Busca último usuário logado pra mostrar de cara o PIN
  const [ultimoUsuario, setUltimoUsuario] = useState(null);
  useEffect(() => {
    const u = usuarios.find(x => x.ultimoLogin);
    if (u) setUltimoUsuario(u);
  }, [usuarios]);

  const [carregando, setCarregando] = useState(false);

  const entrarGestor = async () => {
    setErro("");
    if (!emailGestor || !senhaGestor) {
      return setErro("Preencha email e senha.");
    }
    setCarregando(true);

    // Tenta primeiro autenticar via Firebase (login real com senha criptografada)
    const r = await loginFirebase(emailGestor.trim(), senhaGestor);
    if (r.ok) {
      // Sucesso no Firebase: busca o usuário gestor correspondente no cadastro local
      let u = usuarios.find(x => x.email.toLowerCase() === r.user.email.toLowerCase() && x.perfil === "gestor");
      if (!u) {
        // Caso ainda não exista cadastro local para este email, cria um perfil de gestor padrão
        u = {
          id: r.user.uid,
          nome: "Gestor",
          email: r.user.email,
          perfil: "gestor",
          ativo: true,
          firebaseUid: r.user.uid,
        };
      }
      setCarregando(false);
      onLogin({ ...u, firebaseUid: r.user.uid, ultimoLogin: Date.now() });
      return;
    }

    // Se o erro foi de email não cadastrado no Firebase, tenta o sistema antigo como fallback
    if (r.codigo === "auth/user-not-found" || r.codigo === "auth/invalid-credential") {
      const u = usuarios.find(u => u.email.toLowerCase() === emailGestor.toLowerCase().trim() && u.senha === senhaGestor && u.perfil === "gestor");
      if (u) {
        setCarregando(false);
        onLogin(u);
        return;
      }
    }

    setCarregando(false);
    setErro(r.erro || "Email ou senha incorretos.");
  };

  const entrarPrimeiroAcesso = () => {
    setErro("");
    const u = usuarios.find(u => u.email.toLowerCase() === emailPrim.toLowerCase().trim() && u.senha === senhaPrim && u.perfil === "encarregado");
    if (!u) return setErro("Acesso não encontrado. Confirme com o gestor o e-mail e senha cadastrados.");
    // Login direto, sem PIN
    onLogin({ ...u, ultimoLogin: Date.now() });
  };

  const entrarComPIN = (u) => {
    // Se for gestor, manda para a tela de senha (autenticação Firebase obrigatória)
    if (u.perfil === "gestor") {
      setEmailGestor(u.email || "");
      setTelaInterna("gestor");
      return;
    }
    // Encarregado entra direto pelo card "Continuar como"
    onLogin({ ...u, ultimoLogin: Date.now() });
  };

  if (modoPIN && usuarioSelecionado) {
    return (
      <TelaPIN
        usuario={usuarioSelecionado}
        modo={modoPIN}
        onSucesso={() => onLogin({ ...usuarioSelecionado, ultimoLogin: Date.now() })}
        onCancelar={() => { setUsuarioSelecionado(null); setModoPIN(null); setTelaInterna("inicial"); }}
        onCriarPIN={(pin, biometriaAtiva) => {
          const atualizado = { ...usuarioSelecionado, pin, biometriaAtiva, ultimoLogin: Date.now() };
          if (onAtualizarUsuario) onAtualizarUsuario(atualizado);
          onLogin(atualizado);
        }}
      />
    );
  }

  return (
    <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", padding: "28px 24px", paddingTop: "max(28px, env(safe-area-inset-top, 28px))", paddingBottom: "max(28px, env(safe-area-inset-bottom, 28px))", overflow: "hidden" }}>
      {/* CSS animation injetado */}
      <style>{`
        @keyframes kmGradiente {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes kmFlutua {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(2deg); }
        }
        @keyframes kmPulsa {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.08); }
        }
        @keyframes kmFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes kmBrilhoLogo {
          0%, 100% { text-shadow: 0 4px 20px rgba(245,166,35,0.4), 0 0 30px rgba(245,166,35,0.2); }
          50% { text-shadow: 0 4px 30px rgba(245,166,35,0.7), 0 0 50px rgba(245,166,35,0.4); }
        }
        @keyframes kmRaioLuz {
          0% { transform: translateX(-150%) skewX(-20deg); opacity: 0; }
          40%, 60% { opacity: 1; }
          100% { transform: translateX(250%) skewX(-20deg); opacity: 0; }
        }
        @keyframes kmParticula {
          0% { transform: translateY(100vh) translateX(0); opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.3; }
          100% { transform: translateY(-10vh) translateX(20px); opacity: 0; }
        }
        @keyframes kmLinhaBrilho {
          0% { box-shadow: 0 0 8px rgba(245,166,35,0.4); transform: scaleX(0.8); }
          50% { box-shadow: 0 0 18px rgba(245,166,35,0.9); transform: scaleX(1.1); }
          100% { box-shadow: 0 0 8px rgba(245,166,35,0.4); transform: scaleX(0.8); }
        }
        .km-bg-anim {
          background: linear-gradient(125deg, #0f2151 0%, #1e3a8a 25%, #0f2151 50%, #2a1a4e 75%, #0f2151 100%);
          background-size: 300% 300%;
          animation: kmGradiente 18s ease infinite;
        }
        .km-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(40px);
          pointer-events: none;
        }
        .km-orb-1 {
          width: 240px; height: 240px;
          background: radial-gradient(circle, rgba(245,166,35,0.4), transparent 70%);
          top: -60px; right: -60px;
          animation: kmFlutua 9s ease-in-out infinite, kmPulsa 6s ease-in-out infinite;
        }
        .km-orb-2 {
          width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(124,58,237,0.35), transparent 70%);
          bottom: -40px; left: -40px;
          animation: kmFlutua 11s ease-in-out infinite reverse, kmPulsa 7s ease-in-out infinite;
        }
        .km-orb-3 {
          width: 180px; height: 180px;
          background: radial-gradient(circle, rgba(56,189,248,0.3), transparent 70%);
          top: 40%; left: -50px;
          animation: kmFlutua 13s ease-in-out infinite, kmPulsa 8s ease-in-out infinite;
        }
        .km-card-anim { animation: kmFadeIn 0.5s ease-out; }
        .km-btn-glow {
          transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(245,166,35,0.4);
        }
        .km-btn-glow:active {
          transform: scale(0.97);
          box-shadow: 0 2px 10px rgba(245,166,35,0.6);
        }
        /* Acessibilidade mobile: melhor toque e área mínima em campos */
        button { touch-action: manipulation; }
        input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
        select, textarea { min-height: 44px; box-sizing: border-box; }
        /* Botão destrutivo: borda vermelha discreta + animação no hover */
        .km-btn-danger {
          border: 2px solid rgba(220,38,38,0.6) !important;
          transition: all 0.15s ease;
        }
        .km-btn-danger:hover:not([disabled]) {
          border-color: rgba(220,38,38,1) !important;
          box-shadow: 0 0 0 3px rgba(220,38,38,0.15) !important;
        }
        .km-btn-danger:active:not([disabled]) {
          transform: scale(0.97);
        }
        /* ONDA 2 — Efeitos sofisticados da tela de boas-vindas */
        .km-logo-zero {
          animation: kmBrilhoLogo 4s ease-in-out infinite;
        }
        .km-linha-dourada {
          animation: kmLinhaBrilho 3s ease-in-out infinite;
          transform-origin: center;
        }
        .km-raio-container {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }
        .km-raio {
          position: absolute;
          top: 0; left: 0;
          width: 200px; height: 100%;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 40%, rgba(245,166,35,0.08) 50%, rgba(255,255,255,0.04) 60%, transparent 100%);
          animation: kmRaioLuz 12s ease-in-out infinite;
        }
        .km-raio-2 {
          animation-delay: 6s;
          animation-duration: 16s;
          opacity: 0.6;
        }
        .km-particula {
          position: absolute;
          width: 3px; height: 3px;
          background: rgba(245,166,35,0.6);
          border-radius: 50%;
          pointer-events: none;
          filter: blur(0.5px);
        }
        .km-particula-1 { left: 10%; animation: kmParticula 14s linear infinite; }
        .km-particula-2 { left: 25%; animation: kmParticula 18s linear infinite 3s; }
        .km-particula-3 { left: 45%; animation: kmParticula 12s linear infinite 7s; }
        .km-particula-4 { left: 65%; animation: kmParticula 16s linear infinite 1s; }
        .km-particula-5 { left: 80%; animation: kmParticula 20s linear infinite 5s; }
        .km-particula-6 { left: 92%; animation: kmParticula 15s linear infinite 9s; }
        /* Cartão de continuar como — efeito de glassmorphism elevado */
        .km-card-glass {
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,0.18);
          transition: all 0.3s ease;
        }
        .km-card-glass:hover {
          background: rgba(255,255,255,0.12);
          border-color: rgba(245,166,35,0.5);
          box-shadow: 0 6px 30px rgba(245,166,35,0.15);
          transform: translateY(-2px);
        }
        .km-card-glass:active { transform: translateY(0); }
        /* Botão Sou Gestor com aura dourada animada */
        .km-btn-gestor {
          position: relative;
          overflow: hidden;
        }
        .km-btn-gestor::before {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          padding: 2px;
          background: linear-gradient(135deg, rgba(245,166,35,0.8), rgba(255,200,80,0.4), rgba(245,166,35,0.8));
          background-size: 200% 200%;
          animation: kmGradiente 6s ease infinite;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          opacity: 0.7;
        }
        /* Respeita preferência de redução de movimento */
        @media (prefers-reduced-motion: reduce) {
          .km-bg-anim, .km-orb, .km-logo-zero, .km-linha-dourada,
          .km-raio, .km-particula, .km-btn-gestor::before {
            animation: none !important;
          }
        }
      `}</style>

      {/* Background animado */}
      <div className="km-bg-anim" style={{ position: "absolute", inset: 0, zIndex: 0 }} />
      <div className="km-orb km-orb-1" />
      <div className="km-orb km-orb-2" />
      <div className="km-orb km-orb-3" />

      {/* ONDA 2 — Raios de luz cruzando o fundo (sutis) */}
      <div className="km-raio-container">
        <div className="km-raio" />
        <div className="km-raio km-raio-2" />
      </div>

      {/* ONDA 2 — Partículas douradas subindo (efeito canteiro de obra) */}
      <div className="km-raio-container">
        <div className="km-particula km-particula-1" />
        <div className="km-particula km-particula-2" />
        <div className="km-particula km-particula-3" />
        <div className="km-particula km-particula-4" />
        <div className="km-particula km-particula-5" />
        <div className="km-particula km-particula-6" />
      </div>

      {/* Conteúdo */}
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* LOGO */}
        <div style={{ textAlign: "center", marginBottom: 28 }} className="km-card-anim">
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", letterSpacing: 4, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>
            🏗️ Gestão de Obras
          </div>
          <div>
            <span style={{ fontWeight: 900, fontSize: 56, color: "#fff", letterSpacing: -2, textShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>KM</span>
            <span className="km-logo-zero" style={{ fontWeight: 900, fontSize: 56, color: GOLD, letterSpacing: -2, display: "inline-block" }}>ZERO</span>
          </div>
          <div className="km-linha-dourada" style={{ height: 2, width: 60, background: GOLD, margin: "10px auto", borderRadius: 2 }} />
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontStyle: "italic" }}>
            KM Consultoria · Engenharia Civil
          </div>
        </div>

        {/* TELA INICIAL — MOSTRA ÚLTIMO USUÁRIO + BOTÕES */}
        {tela === "inicial" && (
          <div className="km-card-anim">

            {/* Se tem último usuário logado, mostra acesso direto */}
            {ultimoUsuario && (
              <div onClick={() => entrarComPIN(ultimoUsuario)} className="km-card-glass" style={{
                borderRadius: 16,
                padding: "16px 18px",
                marginBottom: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 14,
                boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
              }}>
                <div style={{ width: 50, height: 50, borderRadius: 25, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, boxShadow: "0 4px 14px rgba(245,166,35,0.5)" }}>
                  {ultimoUsuario.perfil === "gestor" ? "🏢" : "👷"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", letterSpacing: 1, fontWeight: 600, textTransform: "uppercase" }}>Continuar como</div>
                  <div style={{ fontSize: 16, color: "#fff", fontWeight: 800, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ultimoUsuario.nome}</div>
                  <div style={{ fontSize: 10, color: GOLD, fontWeight: 600, marginTop: 2 }}>👆 Toque pra entrar</div>
                </div>
                <span style={{ color: "#fff", fontSize: 24, opacity: 0.7 }}>›</span>
              </div>
            )}

            {/* Texto de boas-vindas */}
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 18, marginBottom: 14, lineHeight: 1.6 }}>
              👤 Toque no seu perfil pra entrar:
            </div>

            {/* LISTA DE ENCARREGADOS — perfis cadastrados pelo gestor */}
            {(() => {
              const encarregados = usuarios.filter(u => u.perfil === "encarregado");
              if (encarregados.length === 0) {
                return (
                  <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 11, color: "rgba(255,255,255,0.7)", textAlign: "center", lineHeight: 1.6, border: "1px dashed rgba(255,255,255,0.15)" }}>
                    👷 Nenhum encarregado cadastrado ainda.<br/>
                    O gestor pode cadastrar em <b>👥 Equipe → + Adicionar</b>
                  </div>
                );
              }
              return (
                <div style={{ marginBottom: 14 }}>
                  {encarregados.map(u => {
                    const obra = obras.find(o => o.id === u.obraId);
                    const cores = ["#0891b2", "#7c3aed", "#16a34a", "#dc2626", "#e87722", "#0284c7", "#9333ea"];
                    const cor = cores[u.id % cores.length];
                    const iniciais = u.nome.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
                    return (
                      <button key={u.id} onClick={() => onLogin({ ...u, ultimoLogin: Date.now() })} className="km-btn-glow" style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.1)",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        marginBottom: 8,
                        backdropFilter: "blur(10px)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        textAlign: "left",
                      }}>
                        <div style={{ width: 42, height: 42, borderRadius: 21, background: cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0, color: "#fff", boxShadow: `0 2px 8px ${cor}80` }}>
                          {iniciais}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.nome}</div>
                          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            👷 {u.cargo || "Encarregado"}{obra ? ` · ${obra.nome.substring(0, 30)}` : ""}
                          </div>
                        </div>
                        <span style={{ opacity: 0.6, fontSize: 16 }}>›</span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* Divisor */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 10px", color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
              GESTÃO
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
            </div>

            {/* Botão: Sou gestor — abre a tela de email/senha (Firebase) */}
            <button onClick={() => setTelaInterna("gestor")} className="km-btn-glow" style={{
              width: "100%",
              padding: "16px 18px",
              borderRadius: 14,
              border: "none",
              background: GOLD,
              color: NAVY,
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 12,
              textAlign: "left",
              boxShadow: "0 4px 20px rgba(245,166,35,0.5)",
            }}>
              <div style={{ width: 38, height: 38, borderRadius: 19, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", flexShrink: 0 }}>🏢</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Sou o Gestor</div>
                <div style={{ fontSize: 10, opacity: 0.8, marginTop: 1 }}>Kleber · KM Consultoria</div>
              </div>
              <span style={{ opacity: 0.7 }}>›</span>
            </button>

            <div style={{ marginTop: 24, padding: 14, background: "rgba(255,255,255,0.05)", borderRadius: 12, fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "center", lineHeight: 1.6 }}>
              💡 Equipe sem acesso? Peça pro gestor cadastrar você na <b>👥 Equipe</b>
            </div>
          </div>
        )}

        {/* TELA GESTOR — login email + senha */}
        {tela === "gestor" && (
          <div className="km-card-anim" style={{
            background: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 18,
            padding: 22,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <button onClick={() => { setTelaInterna("inicial"); setErro(""); }} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 14 }}>‹</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Acesso Gestor</div>
                <div style={{ fontSize: 16, color: "#fff", fontWeight: 800, marginTop: 2 }}>🏢 Entrar na Empresa</div>
              </div>
            </div>

            <label style={{ ...labelS, color: "rgba(255,255,255,0.85)" }}>📧 E-mail</label>
            <input value={emailGestor} onChange={e => setEmailGestor(e.target.value)} type="email" placeholder="seu@email.com" autoComplete="email" style={{ ...inputS, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }} />

            <label style={{ ...labelS, color: "rgba(255,255,255,0.85)" }}>🔑 Senha</label>
            <input value={senhaGestor} onChange={e => setSenhaGestor(e.target.value)} type="password" placeholder="••••••" autoComplete="current-password" style={{ ...inputS, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }} />

            {erro && (
              <div style={{ background: "rgba(214,59,59,0.2)", color: "#fca5a5", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10, border: "1px solid rgba(214,59,59,0.4)" }}>
                ⚠️ {erro}
              </div>
            )}

            <button
              onClick={entrarGestor}
              disabled={carregando}
              className="km-btn-glow"
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 12,
                border: "none",
                background: carregando ? "rgba(192,160,64,0.5)" : GOLD,
                color: NAVY,
                fontWeight: 800,
                cursor: carregando ? "wait" : "pointer",
                fontSize: 15,
              }}
            >
              {carregando ? "Verificando..." : "▶  ENTRAR"}
            </button>

            <button
              onClick={async () => {
                if (!emailGestor) {
                  setErro("Digite seu email para receber o link de recuperação.");
                  return;
                }
                const r = await recuperarSenha(emailGestor.trim());
                if (r.ok) {
                  alert("Enviamos um link de recuperação para " + emailGestor + ". Verifique sua caixa de entrada e a pasta de spam.");
                } else {
                  setErro(r.erro || "Não foi possível enviar o email de recuperação.");
                }
              }}
              style={{
                width: "100%",
                marginTop: 10,
                padding: 8,
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.7)",
                fontSize: 12,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Esqueci minha senha
            </button>
          </div>
        )}

        {/* TELA PRIMEIRO ACESSO ENCARREGADO */}
        {tela === "primeiro_acesso" && (
          <div className="km-card-anim" style={{
            background: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 18,
            padding: 22,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <button onClick={() => { setTelaInterna("inicial"); setErro(""); }} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 14 }}>‹</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Acesso Equipe</div>
                <div style={{ fontSize: 16, color: "#fff", fontWeight: 800, marginTop: 2 }}>👷 Primeiro Acesso</div>
              </div>
            </div>

            <div style={{ background: "rgba(56,189,248,0.15)", color: "#bae6fd", padding: 12, borderRadius: 10, fontSize: 11, marginBottom: 14, border: "1px solid rgba(56,189,248,0.3)", lineHeight: 1.5 }}>
              💡 Use o e-mail e senha que o <b>gestor te passou</b>. No primeiro acesso, você cria seu PIN de 4 dígitos.
            </div>

            <label style={{ ...labelS, color: "rgba(255,255,255,0.85)" }}>📧 E-mail (informado pelo gestor)</label>
            <input value={emailPrim} onChange={e => setEmailPrim(e.target.value)} type="email" placeholder="exemplo@km.com" autoComplete="email" style={{ ...inputS, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }} />

            <label style={{ ...labelS, color: "rgba(255,255,255,0.85)" }}>🔑 Senha temporária</label>
            <input value={senhaPrim} onChange={e => setSenhaPrim(e.target.value)} type="password" placeholder="123" autoComplete="current-password" style={{ ...inputS, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }} />

            {erro && (
              <div style={{ background: "rgba(214,59,59,0.2)", color: "#fca5a5", padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10, border: "1px solid rgba(214,59,59,0.4)" }}>
                ⚠️ {erro}
              </div>
            )}

            <button onClick={entrarPrimeiroAcesso} className="km-btn-glow" style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: BLUE, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 15 }}>
              CRIAR MEU PIN  ▶
            </button>

            <div style={{ marginTop: 14, fontSize: 10, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.5 }}>
              Não tem acesso? Pede pro gestor te cadastrar em <b>👥 Equipe → + Adicionar</b>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


/* ════════════════════════════════════
   HOME ENCARREGADO
════════════════════════════════════ */
function TelaHome({ obra, usuario, mensagens, trabalhadores, presencasHoje, onNav, onLogout }) {
  const presentes = Object.values(presencasHoje).filter(v => v === "Presente").length;
  const faltas    = Object.values(presencasHoje).filter(v => v === "Falta").length;
  const atestados = Object.values(presencasHoje).filter(v => v === "Atestado").length;
  const novasMsgs = (mensagens || []).filter(m => m.para === usuario?.id && !m.lida).length;
  // Saudação inteligente por horário
  const h = new Date().getHours();
  const saudacao = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const emojiSaudacao = h < 6 ? "🌙" : h < 12 ? "☀️" : h < 18 ? "🌤️" : "🌆";
  const totalPresencas = presentes + faltas + atestados;
  const equipeTotal = (trabalhadores || []).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ background: `linear-gradient(180deg,${NAVY} 0%,${NAVY2} 100%)`, padding: "10px 14px 12px", paddingTop: "max(10px, env(safe-area-inset-top, 10px))", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <div><span style={{ fontWeight: 900, fontSize: 20, color: "#fff", letterSpacing: -1 }}>KM</span><span style={{ fontWeight: 900, fontSize: 20, color: GOLD, letterSpacing: -1 }}>ZERO</span></div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.5)", letterSpacing: 2.5 }}>GESTÃO DE OBRAS</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => onNav("mensagens")} style={{ position: "relative", background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 18, width: 36, height: 36, cursor: "pointer", fontSize: 16 }}>
              💬
              {novasMsgs > 0 && <span style={{ position: "absolute", top: -2, right: -2, background: RED, color: "#fff", borderRadius: 10, padding: "1px 5px", fontSize: 9, fontWeight: 800 }}>{novasMsgs}</span>}
            </button>
            <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Sair</button>
          </div>
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>Obra: {obra?.nome}</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ marginBottom: 14 }} className="km-card-anim">
          <div style={{ fontSize: 22, fontWeight: 800, color: NAVY }}>
            {emojiSaudacao} {saudacao}, {usuario?.nome?.split(" ")[0] || "Marcos"}!
          </div>
          <div style={{ fontSize: 13, color: "#888" }}>Encarregado • {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</div>
          {/* Card resumo do dia */}
          {totalPresencas > 0 && (
            <div style={{
              marginTop: 10,
              background: "linear-gradient(135deg, #0f2151 0%, #1a3370 100%)",
              borderRadius: 12,
              padding: "12px 14px",
              color: "#fff",
              boxShadow: "0 4px 14px rgba(15,33,81,0.2)",
            }}>
              <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600, letterSpacing: 2, marginBottom: 6 }}>📊 RESUMO DO DIA</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: GREEN }}>{presentes}</div>
                    <div style={{ fontSize: 10, opacity: 0.75 }}>Presentes</div>
                  </div>
                  {faltas > 0 && (
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: RED }}>{faltas}</div>
                      <div style={{ fontSize: 10, opacity: 0.75 }}>Faltas</div>
                    </div>
                  )}
                  {atestados > 0 && (
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: ORANGE }}>{atestados}</div>
                      <div style={{ fontSize: 10, opacity: 0.75 }}>Atestados</div>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>de {equipeTotal} {equipeTotal === 1 ? "pessoa" : "pessoas"}</div>
                </div>
              </div>
            </div>
          )}
          {totalPresencas === 0 && equipeTotal > 0 && (
            <div onClick={() => onNav("fluxo")} style={{
              marginTop: 10,
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              borderRadius: 12,
              padding: "12px 14px",
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(245,158,11,0.3)",
            }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>⏰ Hora de registrar presença!</div>
              <div style={{ fontSize: 11, opacity: 0.95, marginTop: 2 }}>Toque para começar o registro da equipe</div>
            </div>
          )}
        </div>
        {novasMsgs > 0 && (
          <div onClick={() => onNav("mensagens")} style={{ background: `linear-gradient(135deg,#db2777,#9d174d)`, color: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 14, cursor: "pointer", boxShadow: "0 3px 10px #db277744" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>💬 Você tem {novasMsgs} mensagem(ns) nova(s)</div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>Toque para ler</div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          {[
            { icon: "✅", label: "Registrar\nPresença", color: GREEN,  nav: "fluxo" },
            { icon: "📦", label: "Solicitar\nMaterial",  color: ORANGE, nav: "material" },
            { icon: "📷", label: "Enviar\nFotos",        color: BLUE,   nav: "fotos_solo" },
            { icon: "⚙️", label: "Controle de\nEquip.", color: NAVY,   nav: "equip_solo" },
          ].map(b => (
            <button key={b.nav} onClick={() => onNav(b.nav)} style={{ background: b.color, color: "#fff", border: "none", borderRadius: 14, padding: "18px 8px", cursor: "pointer", textAlign: "center", boxShadow: `0 4px 14px ${b.color}44` }}>
              <div style={{ fontSize: 32 }}>{b.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, whiteSpace: "pre-line", lineHeight: 1.35 }}>{b.label}</div>
            </button>
          ))}
        </div>
        <button onClick={() => onNav("diario")} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 14, padding: "14px", cursor: "pointer", textAlign: "center", boxShadow: "0 4px 14px #2563eb44", marginBottom: 10, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>📓</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Diário de Obra (com Voz 🎤)</span>
        </button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <button onClick={() => onNav("produtividade")} style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 14, padding: "14px 8px", cursor: "pointer", textAlign: "center", boxShadow: "0 4px 14px #16a34a44" }}>
            <div style={{ fontSize: 28 }}>📐</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>Produtividade</div>
          </button>
          <button onClick={() => onNav("recebimento")} style={{ background: "#0891b2", color: "#fff", border: "none", borderRadius: 14, padding: "14px 8px", cursor: "pointer", textAlign: "center", boxShadow: "0 4px 14px #0891b244" }}>
            <div style={{ fontSize: 28 }}>📥</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>Recebimento</div>
          </button>
          <button onClick={() => onNav("solicitar_mov")} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 14, padding: "14px 8px", cursor: "pointer", textAlign: "center", boxShadow: "0 4px 14px #7c3aed44" }}>
            <div style={{ fontSize: 28 }}>🔄</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>Mov. Pessoal</div>
          </button>
          <button onClick={() => onNav("mov_equip")} style={{ background: "#0e7490", color: "#fff", border: "none", borderRadius: 14, padding: "14px 8px", cursor: "pointer", textAlign: "center", boxShadow: "0 4px 14px #0e749044" }}>
            <div style={{ fontSize: 28 }}>🔧</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>Mov. Equipamentos</div>
          </button>
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: "12px 14px", marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Resumo de Hoje</span>
            <span style={{ fontSize: 9, color: "#888", fontStyle: "italic" }}>👆 toque pra ver detalhes</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ v: presentes, l: "Presentes", c: GREEN, dest: "fluxo" }, { v: faltas, l: "Faltas", c: RED, dest: "fluxo" }, { v: atestados, l: "Atestados", c: ORANGE, dest: "fluxo" }].map(s => (
              <div key={s.l} onClick={() => onNav(s.dest)} style={{ flex: 1, textAlign: "center", background: LIGHT, borderRadius: 10, padding: "8px 4px", cursor: "pointer", border: `1px solid ${s.c}33` }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 10, color: "#666" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div onClick={() => onNav("equipe")} style={{ background: "#fff", borderRadius: 14, padding: "12px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", cursor: "pointer" }}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Equipe da Obra ({trabalhadores.length})</span>
            <span style={{ color: "#bbb", fontSize: 16 }}>›</span>
          </div>
          {trabalhadores.slice(0, 3).map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 8 }}>👷</div>
              <div style={{ flex: 1, fontSize: 13, color: NAVY, fontWeight: 600 }}>{t.nome}</div>
              <div style={{ fontSize: 11, color: "#888" }}>{t.cargo}</div>
            </div>
          ))}
          {trabalhadores.length > 3 && <div style={{ fontSize: 12, color: BLUE, marginTop: 4 }}>+{trabalhadores.length - 3} trabalhadores — toque pra ver todos</div>}
        </div>
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   FLUXO DIÁRIO
════════════════════════════════════ */
function FluxoEncarregado({ obra, trabalhadores, equips, ativos, abastecimentos, pedidos, diario, usuario, empresa, historico, rdosEmitidos, fotosObras = [], onBack, onSavePresencas, onAutoEmitirRDO, onSalvarFotoObra }) {
  const [etapa, setEtapa] = useState(0);
  const [presencas, setPresencas] = useState(() => {
    const m = {}; trabalhadores.forEach(t => { m[t.id] = "Presente"; }); return m;
  });
  // horas trabalhadas: { trabId: 9 }  (padrão 9h: 7-11h + 12-17h, sex 8h)
  const [horasTrabalhadas, setHorasTrabalhadas] = useState(() => {
    const m = {};
    const eSexta = new Date().getDay() === 5;
    const padrao = eSexta ? 8 : 9; // sexta termina às 16h
    trabalhadores.forEach(t => { m[t.id] = padrao; });
    return m;
  });
  const [editandoHoras, setEditandoHoras] = useState(null); // trabId em edição

  // ALIMENTAÇÃO: por padrão, todo presente recebe café manhã + café tarde
  const [alimentacao, setAlimentacao] = useState(() => {
    const m = {};
    trabalhadores.forEach(t => {
      m[t.id] = { cafeManha: true, cafeTarde: true, marmita: false, lanche: false };
    });
    return m;
  });

  const [fotos, setFotos] = useState([]);
  const [equipsLocal, setEquipsLocal] = useState(equips.filter(e => e.obraId === obra.id));
  const [confirmando, setConfirmando] = useState(false);
  const [localizacao, setLocalizacao] = useState(null);
  const [pegandoLoc, setPegandoLoc] = useState(false);

  // Horímetro das máquinas (início/fim)
  const ativosObra = (ativos || []).filter(a => a.obraId === obra.id);
  const [horimetros, setHorimetros] = useState(() => {
    const m = {};
    ativosObra.forEach(a => { m[a.id] = { inicio: a.horimetro || "", fim: "" }; });
    return m;
  });

  const ICONS = ["🏗️", "🧱", "🔨", "⚙️", "💡"];
  const ciclo = { "Em Uso": "Disponível", "Disponível": "Em Uso", "Quebrada": "Disponível" };
  const presentes = Object.values(presencas).filter(v => v === "Presente").length;
  const faltas = Object.values(presencas).filter(v => v === "Falta").length;

  const pegarLocalizacao = () => {
    setPegandoLoc(true);
    if (!navigator.geolocation) {
      setLocalizacao({ erro: "Seu navegador não suporta GPS." });
      setPegandoLoc(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocalizacao({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
          ts: new Date().toLocaleTimeString("pt-BR"),
          precisao: Math.round(pos.coords.accuracy),
        });
        setPegandoLoc(false);
      },
      err => {
        let msg = "Erro ao obter localização";
        if (err.code === 1) msg = "🚫 Permissão negada. Toque no cadeado/info do navegador e libere localização.";
        else if (err.code === 2) msg = "📡 GPS indisponível. Verifique se está ligado.";
        else if (err.code === 3) msg = "⏱️ Tempo esgotado. Tente novamente em local aberto.";
        setLocalizacao({ erro: msg });
        setPegandoLoc(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  if (etapa === 0) return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Presença" sub={`${obra.nome} — ${obra.local}`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 12 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 13, color: NAVY, fontWeight: 700 }}>📅 {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          {!localizacao && (
            <button onClick={pegarLocalizacao} disabled={pegandoLoc} style={{ width: "100%", padding: "8px", borderRadius: 8, border: `1.5px dashed ${BLUE}`, background: "#f0f7ff", color: BLUE, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              {pegandoLoc ? "📍 Obtendo localização..." : "📍 Registrar localização (check-in)"}
            </button>
          )}
          {localizacao && !localizacao.erro && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>📍</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: GREEN, fontWeight: 700 }}>Check-in registrado às {localizacao.ts}</div>
                <div style={{ fontSize: 10, color: "#888" }}>Lat: {localizacao.lat}, Lng: {localizacao.lng} • Precisão: ±{localizacao.precisao}m</div>
                <a href={`https://maps.google.com/?q=${localizacao.lat},${localizacao.lng}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: BLUE, fontWeight: 600 }}>🗺️ Ver no Google Maps</a>
              </div>
            </div>
          )}
          {localizacao?.erro && (
            <div>
              <div style={{ fontSize: 12, color: RED, fontWeight: 600, marginBottom: 6 }}>{localizacao.erro}</div>
              <button onClick={() => { setLocalizacao(null); pegarLocalizacao(); }} style={{ background: BLUE, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🔄 Tentar novamente</button>
            </div>
          )}
        </div>
        {trabalhadores.map(t => {
          const eHE = (horasTrabalhadas[t.id] || 0) > 9;
          return (
            <div key={t.id} style={{ background: "#fff", borderRadius: 12, padding: "10px 12px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ width: 34, height: 34, borderRadius: 17, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginRight: 10, flexShrink: 0 }}>👷</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: NAVY }}>{t.nome}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{t.cargo}</div>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  {["Presente", "Falta", "Atestado"].map(s => (
                    <button key={s} onClick={() => setPresencas(p => ({ ...p, [t.id]: s }))} style={{ padding: "5px 7px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 700, background: presencas[t.id] === s ? STATUS_COLOR[s] : "#eee", color: presencas[t.id] === s ? "#fff" : "#aaa" }}>{s}</button>
                  ))}
                </div>
              </div>
              {presencas[t.id] === "Presente" && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed #eee", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#666", flex: 1 }}>⏱️ Horas trabalhadas:</span>
                  <select
                    value={horasTrabalhadas[t.id] || 9}
                    onChange={e => setHorasTrabalhadas(h => ({ ...h, [t.id]: parseFloat(e.target.value) }))}
                    style={{ padding: "4px 6px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12, fontWeight: 700, color: eHE ? RED : NAVY, background: eHE ? "#fef2f2" : "#fff" }}
                  >
                    {[2,3,4,4.5,5,6,7,8,8.5,9,9.5,10,10.5,11,12].map(h => <option key={h} value={h}>{h}h{h > 9 ? " (HE!)" : ""}</option>)}
                  </select>
                  {eHE && (
                    <span style={{ background: RED, color: "#fff", padding: "2px 6px", borderRadius: 5, fontSize: 9, fontWeight: 700 }}>+{((horasTrabalhadas[t.id] - 9) * 1.5).toFixed(1)}h ext (50%)</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {trabalhadores.length === 0 && (
          <EmptyState
            icon="👷"
            titulo="Nenhum trabalhador nesta obra"
            subtitulo="Cadastre trabalhadores em Recursos Humanos → Equipe e vincule-os a esta obra."
            cor={NAVY}
          />
        )}

        {/* ALIMENTAÇÃO */}
        {trabalhadores.filter(t => presencas[t.id] === "Presente").length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, letterSpacing: 0.5, marginBottom: 6 }}>☕ ALIMENTAÇÃO DO DIA</div>
            <div style={{ background: "#fff8e1", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#8b6f00", marginBottom: 10 }}>
              💡 Por padrão, todos os presentes recebem café da manhã (R$ {empresa.valorCafeManha}) e da tarde (R$ {empresa.valorCafeTarde}). Marque exceções e adicione marmita/lanche se for o caso.
            </div>
            {trabalhadores.filter(t => presencas[t.id] === "Presente").map(t => {
              const a = alimentacao[t.id] || {};
              const totalDia = (a.cafeManha ? empresa.valorCafeManha : 0) + (a.cafeTarde ? empresa.valorCafeTarde : 0) + (a.marmita ? empresa.valorMarmita : 0) + (a.lanche ? empresa.valorLanche : 0);
              const toggle = (campo) => setAlimentacao(al => ({ ...al, [t.id]: { ...al[t.id], [campo]: !al[t.id]?.[campo] } }));
              return (
                <div key={t.id} style={{ background: "#fff", borderRadius: 10, padding: "8px 12px", marginBottom: 6, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ flex: 1, fontWeight: 700, color: NAVY, fontSize: 12 }}>{t.nome}</div>
                    <div style={{ fontSize: 11, color: GREEN, fontWeight: 800 }}>R$ {totalDia.toFixed(2)}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
                    {[
                      { k: "cafeManha", l: "☕ Manhã", c: "#92400e" },
                      { k: "cafeTarde", l: "☕ Tarde", c: "#b45309" },
                      { k: "marmita",   l: "🍱 Marmita", c: "#dc2626" },
                      { k: "lanche",    l: "🥪 Lanche", c: "#0891b2" },
                    ].map(b => (
                      <button key={b.k} onClick={() => toggle(b.k)} style={{
                        padding: "5px 4px", borderRadius: 6,
                        border: a[b.k] ? `2px solid ${b.c}` : "1px solid #ddd",
                        background: a[b.k] ? b.c : "#fff",
                        color: a[b.k] ? "#fff" : "#aaa",
                        fontSize: 9, fontWeight: 700, cursor: "pointer"
                      }}>{b.l}</button>
                    ))}
                  </div>
                </div>
              );
            })}
            <div style={{ background: NAVY, color: "#fff", borderRadius: 10, padding: "10px 14px", marginTop: 8, display: "flex", alignItems: "center" }}>
              <div style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>💰 Total do dia em alimentação</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: GOLD }}>
                R$ {trabalhadores.filter(t => presencas[t.id] === "Presente").reduce((s, t) => {
                  const a = alimentacao[t.id] || {};
                  return s + (a.cafeManha ? empresa.valorCafeManha : 0) + (a.cafeTarde ? empresa.valorCafeTarde : 0) + (a.marmita ? empresa.valorMarmita : 0) + (a.lanche ? empresa.valorLanche : 0);
                }, 0).toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: "10px 14px", background: "#fff", boxShadow: "0 -2px 10px rgba(0,0,0,0.07)" }}>
        <Btn label="CONFIRMAR PRESENÇA" color={GOLD} onClick={() => { onSavePresencas(presencas); setEtapa(1); }} />
      </div>
      <KMFooter />
    </div>
  );

  if (etapa === 1) return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Fotos" sub={`${obra.local}  ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`} onBack={() => setEtapa(0)} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <label style={{ ...bigBtn(BLUE), display: "block", textAlign: "center", marginBottom: 8 }}>
          📷  Tirar Foto
          <input type="file" accept="image/*" capture="environment" multiple onChange={(e) => {
            const files = Array.from(e.target.files || []);
            files.forEach(f => {
              if (fotos.length >= 5) return;
              const reader = new FileReader();
              reader.onload = ev => setFotos(fs => fs.length < 5 ? [...fs, ev.target.result] : fs);
              reader.readAsDataURL(f);
            });
            e.target.value = "";
          }} style={{ display: "none" }} />
        </label>
        <div style={{ fontSize: 12, color: "#999", textAlign: "center", margin: "8px 0" }}>{fotos.length}/5 fotos adicionadas</div>
        {fotos.length > 0 && (
          <div style={{ background: "#f0f7ff", borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontSize: 11, color: "#0c4a6e", textAlign: "center" }}>
            💡 Fotos serão <b>carimbadas com data, hora, obra e número</b> ao finalizar o dia
          </div>
        )}
        {fotos.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 10 }}>
            {fotos.map((f, i) => (
              <div key={i} style={{ background: "#dde6f5", borderRadius: 10, height: 90, position: "relative", overflow: "hidden" }}>
                <img src={f} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => setFotos(fs => fs.filter((_, j) => j !== i))} style={{ position: "absolute", top: 4, right: 4, background: RED, color: "#fff", border: "none", borderRadius: 10, width: 22, height: 22, fontSize: 12, cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>✕</button>
              </div>
            ))}
          </div>
        )}
        {fotos.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: 30, fontSize: 13 }}>Nenhuma foto ainda.</div>}
      </div>
      <div style={{ padding: "10px 14px", background: "#fff", boxShadow: "0 -2px 10px rgba(0,0,0,0.07)" }}>
        <Btn label="AVANÇAR" color={BLUE} onClick={() => setEtapa(2)} />
      </div>
      <KMFooter />
    </div>
  );

  if (etapa === 2) return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Equipamentos" sub={`${obra.local}  ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`} onBack={() => setEtapa(1)} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 12 }}>
        {equipsLocal.map(eq => (
          <div key={eq.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 30, marginRight: 12 }}>{eq.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{eq.nome}</div>
              <div style={{ fontSize: 11, color: "#999" }}>{eq.codigo}</div>
            </div>
            <button onClick={() => setEquipsLocal(es => es.map(e => e.id === eq.id ? { ...e, status: ciclo[e.status] } : e))} style={{ background: EQUIP_COLOR[eq.status], color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{eq.status}</button>
          </div>
        ))}
        {equipsLocal.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: 30 }}>Nenhum equipamento nesta obra.</div>}

        {/* HORÍMETRO DAS MÁQUINAS — início e fim */}
        {ativosObra.length > 0 && (
          <>
            <div style={{ marginTop: 14, marginBottom: 6, fontSize: 12, fontWeight: 800, color: NAVY, letterSpacing: 0.5 }}>🚜 HORÍMETRO DAS MÁQUINAS</div>
            <div style={{ background: "#fff8e1", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#8b6f00", marginBottom: 10 }}>
              💡 Anote a leitura do horímetro no início e no fim do dia. O sistema calcula automaticamente quantas horas a máquina rodou.
            </div>
            {ativosObra.map(a => {
              const h = horimetros[a.id] || { inicio: "", fim: "" };
              const ini = parseFloat(h.inicio);
              const fim = parseFloat(h.fim);
              const horasRodadas = !isNaN(ini) && !isNaN(fim) && fim >= ini ? (fim - ini).toFixed(1) : null;
              return (
                <div key={a.id} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 22, marginRight: 8 }}>🚜</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{a.nome}</div>
                      <div style={{ fontSize: 10, color: "#999" }}>{a.placa || a.tipo}</div>
                    </div>
                    {horasRodadas !== null && (
                      <div style={{ background: parseFloat(horasRodadas) > 9 ? RED : GREEN, color: "#fff", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 800 }}>
                        {horasRodadas}h
                      </div>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 10, color: "#666", fontWeight: 700, display: "block", marginBottom: 2 }}>📈 Início</label>
                      <input value={h.inicio} onChange={e => setHorimetros(hs => ({ ...hs, [a.id]: { ...h, inicio: e.target.value } }))} type="number" placeholder="Ex: 1250.0" style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "#666", fontWeight: 700, display: "block", marginBottom: 2 }}>📉 Fim</label>
                      <input value={h.fim} onChange={e => setHorimetros(hs => ({ ...hs, [a.id]: { ...h, fim: e.target.value } }))} type="number" placeholder="Ex: 1258.5" style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12 }} />
                    </div>
                  </div>
                  {!isNaN(ini) && !isNaN(fim) && fim < ini && (
                    <div style={{ fontSize: 10, color: RED, marginTop: 4, fontWeight: 600 }}>⚠️ Fim deve ser maior que o início</div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
      <div style={{ padding: "10px 14px", background: "#fff", boxShadow: "0 -2px 10px rgba(0,0,0,0.07)" }}>
        <Btn label="FINALIZAR DIA" color={GREEN} onClick={() => setEtapa(3)} />
      </div>
      <KMFooter />
    </div>
  );

  if (etapa === 3) return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Finalizar Dia" sub={`${obra.nome} — ${obra.local}`} onBack={() => setEtapa(2)} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 12 }}>
        {[
          { icon: "✅", label: "Presença",              detail: `${presentes} Presentes / ${faltas} Faltas`, color: GREEN },
          { icon: "📷", label: "Fotos Enviadas",         detail: `${fotos.length} foto(s)`,                  color: BLUE },
          { icon: "⚙️", label: "Equipamentos Utilizados",detail: equipsLocal.map(e => `${e.nome}: ${e.status}`).join(" | "), color: ORANGE },
        ].map((item, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", borderLeft: `4px solid ${item.color}`, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
            <span style={{ fontSize: 26, marginRight: 12 }}>{item.icon}</span>
            <div><div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{item.label}</div><div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>{item.detail}</div></div>
          </div>
        ))}
        <div style={{ background: "#fff8e1", borderRadius: 12, padding: "10px 14px", fontSize: 12, color: "#7b5800", marginTop: 4 }}>⚠️ Finalizando o dia você confirma o envio do relatório.</div>
      </div>
      <div style={{ padding: "10px 14px", background: "#fff", boxShadow: "0 -2px 10px rgba(0,0,0,0.07)" }}>
        <Btn label="FINALIZAR DIA" color={GREEN} onClick={() => setConfirmando(true)} />
      </div>
      <KMFooter />
      {confirmando && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 28, margin: 24, textAlign: "center", maxWidth: 320 }}>
            <div style={{ fontSize: 48 }}>❓</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginTop: 10 }}>Deseja finalizar o dia e enviar o relatório?</div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setConfirmando(false)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "#eee", color: NAVY, fontWeight: 800, cursor: "pointer", fontSize: 14 }}>CANCELAR</button>
              <button onClick={async () => {
                setConfirmando(false);

                // ⚡ AUTO-GERAR RDO ao finalizar
                const numero = (rdosEmitidos?.length || 0) + 1;
                const dataStr = new Date().toLocaleDateString("pt-BR");
                const horaStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                const hojeIso = hojeStr();
                const autorNome = usuario?.nome || "Encarregado";

                // 📸 CARIMBA E ENVIA FOTOS PRA GALERIA
                const totalFotosObra = (fotosObras || []).filter(f => f.obraId === obra.id).length;
                const fotosCarimbadas = [];
                for (let i = 0; i < fotos.length; i++) {
                  const numeroFoto = totalFotosObra + i + 1;
                  const fotoOriginal = fotos[i].url || fotos[i];
                  const carimbada = await carimbarFoto(fotoOriginal, {
                    numero: numeroFoto,
                    obra: obra.nome,
                    autor: autorNome,
                    data: dataStr,
                    hora: horaStr,
                  });
                  fotosCarimbadas.push(carimbada);

                  // Manda pra galeria
                  if (onSalvarFotoObra) {
                    onSalvarFotoObra({
                      id: Date.now() + i,
                      numero: numeroFoto,
                      obraId: obra.id,
                      obraNome: obra.nome,
                      foto: carimbada,
                      legenda: "📅 Foto do dia (RDO)",
                      autor: autorNome,
                      data: dataStr,
                      hora: horaStr,
                      origemRDO: numero,
                    });
                  }
                }

                // Calcula horas extras totais
                let totalHE = 0;
                trabalhadores.forEach(t => {
                  if (presencas[t.id] === "Presente") {
                    const h = horasTrabalhadas[t.id] || 9;
                    if (h > 9) totalHE += (h - 9);
                  }
                });

                // Salva horímetros
                const horimetrosFinais = {};
                Object.entries(horimetros).forEach(([id, h]) => {
                  const ini = parseFloat(h.inicio);
                  const fim = parseFloat(h.fim);
                  if (!isNaN(ini) && !isNaN(fim) && fim >= ini) {
                    horimetrosFinais[id] = { inicio: ini, fim, horas: +(fim - ini).toFixed(1) };
                  }
                });

                const rdo = {
                  id: Date.now(),
                  numero,
                  obraId: obra.id,
                  data: dataStr,
                  dataIso: hojeIso,
                  encarregado: autorNome,
                  clima: "Bom",
                  observacoes: `Relatório gerado automaticamente ao finalizar o dia. ${presentes} presente(s), ${faltas} falta(s). ${fotos.length} foto(s) registrada(s).`,
                  ts: Date.now(),
                  autoGerado: true,
                  horasTrabalhadas: { ...horasTrabalhadas },
                  totalHE: +totalHE.toFixed(1),
                  horimetros: horimetrosFinais,
                  fotos: fotosCarimbadas,
                  presencas: { ...presencas },
                  alimentacao: { ...alimentacao },
                  totalAlimentacao: trabalhadores.filter(t => presencas[t.id] === "Presente").reduce((s, t) => {
                    const a = alimentacao[t.id] || {};
                    return s + (a.cafeManha ? empresa.valorCafeManha : 0) + (a.cafeTarde ? empresa.valorCafeTarde : 0) + (a.marmita ? empresa.valorMarmita : 0) + (a.lanche ? empresa.valorLanche : 0);
                  }, 0),
                };
                if (onAutoEmitirRDO) onAutoEmitirRDO(rdo);

                setEtapa(4);
              }} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>CONFIRMAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ flex: 1, background: `linear-gradient(160deg,${NAVY},#071030)`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 32 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 72 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginTop: 16 }}>Relatório Enviado!</div>
        <div style={{ color: "rgba(255,255,255,0.7)", marginTop: 8, fontSize: 14 }}>Ótimo trabalho hoje!</div>
        <div style={{ background: "rgba(245,166,35,0.15)", border: `1px solid ${GOLD}55`, color: GOLD, borderRadius: 10, padding: "10px 14px", fontSize: 12, fontWeight: 600, marginTop: 16 }}>
          📄 RDO Nº {String((rdosEmitidos?.length || 0)).padStart(3, "0")} gerado e salvo automaticamente.<br/>
          <span style={{ fontSize: 10, opacity: 0.85 }}>O gestor poderá baixar o PDF no painel.</span>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 40, width: "calc(100% - 48px)" }}>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <span style={{ fontWeight: 900, fontSize: 28, color: "#fff", letterSpacing: -1 }}>KM</span>
          <span style={{ fontWeight: 900, fontSize: 28, color: GOLD, letterSpacing: -1 }}>ZERO</span>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 2.5 }}>GESTÃO DE OBRAS</div>
        </div>
        <Btn label="VOLTAR AO INÍCIO" color={GOLD} onClick={onBack} />
      </div>
    </div>
  );
}

/* ════════════════════════════════════
   SOLICITAR MATERIAL
════════════════════════════════════ */
function TelaMaterial({ obra, usuario, onBack, onAddPedido }) {
  const [itens, setItens] = useState([]); // CESTA: lista de itens do pedido
  const [mat, setMat] = useState("");
  const [busca, setBusca] = useState("");
  const [qtd, setQtd] = useState("");
  const [unid, setUnid] = useState("unidades");
  const [marca, setMarca] = useState("");
  const [obs, setObs] = useState("");
  const [obsGeral, setObsGeral] = useState("");
  const [ok, setOk] = useState(false);

  // Quando seleciona um material, ajusta unidade automaticamente
  const selecionarMaterial = (nome) => {
    setMat(nome);
    setBusca("");
    const info = MATERIAL_INFO[nome];
    if (info?.un) {
      setUnid(info.un);
    } else {
      // Tenta achar no catálogo profissional
      const noPro = (CATALOGO_KM_FULL || []).find(m => m[1] === nome);
      if (noPro) setUnid(noPro[2]);
      else setUnid(detectarUnidade(nome));
    }
    setMarca("");
  };

  // Info do material selecionado (categoria, marcas)
  const infoMaterial = mat ? MATERIAL_INFO[mat] : null;
  const marcasDisponiveis = infoMaterial?.marcas || [];

  // Busca inteligente
  const normalizar = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const termoNorm = normalizar(busca);
  const palavras = termoNorm.split(/\s+/).filter(p => p.length > 0);

  // Sugestões do banco principal (com marcas)
  const sugestoesPrincipal = busca.length === 0 ? [] : MATERIAIS_BANCO_DETALHADO
    .map(item => {
      const mNorm = normalizar(item.nome);
      const catNorm = normalizar(item.cat || "");
      let score = 0;
      for (const p of palavras) {
        if (mNorm.includes(p)) score += 1;
        if (catNorm.includes(p)) score += 0.5;
      }
      if (mNorm.startsWith(termoNorm)) score += 2;
      return { item, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(x => x.item);

  // Sugestões do CATÁLOGO PROFISSIONAL (sem duplicar com o banco principal)
  const nomesJaListados = new Set(sugestoesPrincipal.map(s => normalizar(s.nome)));
  const sugestoesCatalogo = busca.length < 2 ? [] : (CATALOGO_KM_FULL || [])
    .map(m => {
      // m = [id, nome, unidade, categoria, subcategoria]
      const mNorm = normalizar(m[1]);
      const catNorm = normalizar(m[3] || "");
      const subNorm = normalizar(m[4] || "");
      let score = 0;
      for (const p of palavras) {
        if (mNorm.includes(p)) score += 1;
        if (catNorm.includes(p)) score += 0.4;
        if (subNorm.includes(p)) score += 0.4;
      }
      if (mNorm.startsWith(termoNorm)) score += 2;
      return { m, score };
    })
    .filter(x => x.score > 0 && !nomesJaListados.has(normalizar(x.m[1])))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(x => ({
      // Adapta pro formato do banco principal
      nome: x.m[1],
      un: x.m[2],
      cat: x.m[3],
      subcat: x.m[4],
      idCatalogo: x.m[0],
      marcas: [],
      doCatalogo: true, // flag pra mostrar visualmente
    }));

  // Combina os dois (principal primeiro)
  const sugestoes = [...sugestoesPrincipal, ...sugestoesCatalogo];

  // Adiciona item à cesta (não envia ainda)
  const adicionarNaCesta = () => {
    if (!mat || !qtd) return;
    const matComMarca = marca ? `${mat} (${marca})` : mat;
    const novo = {
      idLocal: Date.now() + Math.random(),
      material: matComMarca,
      materialBase: mat,
      marca,
      categoria: infoMaterial?.cat || "",
      qtdNum: parseFloat(qtd),
      unidade: unid,
      qtd: `${qtd} ${unid}`,
      obs,
    };
    setItens(its => [...its, novo]);
    // Limpa pra próximo item
    setMat(""); setBusca(""); setQtd(""); setMarca(""); setObs("");
  };

  const removerItem = (idLocal) => setItens(its => its.filter(i => i.idLocal !== idLocal));

  // ENVIA todo o pedido (cesta) de uma vez
  const enviarPedido = () => {
    if (itens.length === 0) return;
    onAddPedido({
      id: Date.now(),
      obra: obra.nome,
      obraId: obra.id,
      itens, // múltiplos itens!
      // Compatibilidade com pedidos antigos (1 item):
      material: itens.length === 1 ? itens[0].material : `${itens.length} itens`,
      qtd: itens.length === 1 ? itens[0].qtd : `${itens.length} itens`,
      obsGeral,
      enc: usuario?.nome?.split(" ")[0] || "Encarregado",
      status: "Aguardando",
      data: new Date().toLocaleDateString("pt-BR"),
    });
    setOk(true);
  };

  const totalItens = itens.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Solicitar Material" sub={obra.nome} onBack={onBack} right={
        totalItens > 0 ? <div style={{ background: GOLD, color: "#fff", borderRadius: 14, padding: "4px 10px", fontWeight: 800, fontSize: 12 }}>🛒 {totalItens}</div> : null
      } />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {ok ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 64 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: GREEN, marginTop: 12 }}>Pedido Enviado!</div>
            <div style={{ color: "#666", marginTop: 6, fontSize: 13 }}><b>{itens.length} item(ns)</b> aguardando aprovação do gestor.</div>
            <div style={{ background: "#f0fdf4", borderRadius: 10, padding: 12, marginTop: 16, textAlign: "left" }}>
              {itens.map((i, idx) => (
                <div key={i.idLocal} style={{ fontSize: 11, color: "#444", paddingBottom: 4 }}>
                  {idx + 1}) <b>{i.material}</b> — {i.qtd}
                </div>
              ))}
            </div>
            <Btn label="Novo Pedido" color={NAVY} onClick={() => { setOk(false); setItens([]); setObsGeral(""); }} style={{ marginTop: 24 }} />
            <Btn label="Voltar" color="#eee" text={NAVY} onClick={onBack} style={{ marginTop: 10 }} />
          </div>
        ) : (
          <>
            {/* CESTA — itens já adicionados */}
            {itens.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 14, padding: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12, borderLeft: `4px solid ${GREEN}` }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ flex: 1, fontWeight: 800, color: NAVY, fontSize: 13 }}>🛒 Cesta de pedido ({totalItens})</div>
                  <button onClick={() => { confirmar("Limpar todos os itens?", () => { setItens([]); }); }} style={{ background: "none", border: "none", color: RED, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Limpar</button>
                </div>
                {itens.map((i, idx) => (
                  <div key={i.idLocal} style={{ display: "flex", alignItems: "flex-start", padding: "8px 0", borderBottom: idx < itens.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: NAVY, fontWeight: 700 }}>{idx + 1}) {i.material}</div>
                      <div style={{ fontSize: 11, color: GREEN, fontWeight: 700, marginTop: 2 }}>📏 {i.qtd}</div>
                      {i.obs && <div style={{ fontSize: 10, color: "#888", marginTop: 2, fontStyle: "italic" }}>obs: {i.obs}</div>}
                    </div>
                    <button onClick={() => removerItem(i.idLocal)} style={{ background: "none", border: "none", color: "#bbb", fontSize: 16, cursor: "pointer", padding: 4 }}>🗑️</button>
                  </div>
                ))}
              </div>
            )}

            {/* FORM ADICIONAR ITEM */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: NAVY, fontWeight: 800, marginBottom: 8 }}>➕ Adicionar item</div>
              <label style={labelS}>🔍 Buscar material</label>
              <input
                value={mat || busca}
                onChange={e => { setBusca(e.target.value); setMat(""); setMarca(""); }}
                placeholder="Ex: cimento, brita, tubo 50mm..."
                style={inputS}
                autoFocus={!mat && itens.length === 0}
              />
              {mat && (
                <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "8px 12px", marginBottom: 8, display: "flex", alignItems: "center" }}>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, color: GREEN, fontWeight: 700 }}>✓ {mat}</span>
                    {infoMaterial?.cat && <span style={{ fontSize: 9, color: "#888", marginLeft: 6, background: "#fff", padding: "2px 6px", borderRadius: 6 }}>{infoMaterial.cat}</span>}
                  </span>
                  <button onClick={() => { setMat(""); setBusca(""); setMarca(""); }} style={{ background: "none", border: "none", color: RED, fontSize: 13, cursor: "pointer", fontWeight: 700 }}>Trocar</button>
                </div>
              )}
              {!mat && busca.length > 0 && (
                <div style={{ background: "#f9fafb", borderRadius: 8, marginTop: 4, maxHeight: 280, overflowY: "auto" }}>
                  {sugestoes.length === 0 ? (
                    <div style={{ padding: 12, color: "#888", fontSize: 12, fontStyle: "italic" }}>
                      Nada encontrado. Toque em "Pedir mesmo assim" abaixo:
                    </div>
                  ) : (
                    sugestoes.map(s => (
                      <div key={(s.idCatalogo || "") + s.nome} onClick={() => selecionarMaterial(s.nome)} style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #eee", background: s.doCatalogo ? "#fefce8" : "transparent" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                          {s.doCatalogo && <span style={{ fontSize: 9, background: "#854d0e", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>PRO</span>}
                          <div style={{ flex: 1, fontSize: 13, color: NAVY, fontWeight: 600, lineHeight: 1.3 }}>{s.nome}</div>
                        </div>
                        <div style={{ fontSize: 10, color: "#888", marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {s.idCatalogo && <span style={{ fontFamily: "monospace", background: "#fef3c7", padding: "1px 5px", borderRadius: 3, color: "#854d0e", fontWeight: 700 }}>{s.idCatalogo}</span>}
                          <span style={{ background: "#eff6ff", padding: "1px 6px", borderRadius: 4, color: BLUE }}>{s.cat}</span>
                          <span style={{ color: ORANGE, fontWeight: 600 }}>📏 {s.un}</span>
                          {s.marcas && s.marcas.length > 0 && <span>🏷️ {s.marcas.length} marca(s)</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              {!mat && busca.length > 0 && sugestoes.length === 0 && (
                <button onClick={() => { setMat(busca); setUnid(detectarUnidade(busca)); }} style={{ background: ORANGE, color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", marginTop: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, width: "100%" }}>
                  ➕ Pedir "{busca}" mesmo assim
                </button>
              )}

              {/* MARCA */}
              {mat && marcasDisponiveis.length > 0 && (
                <>
                  <label style={labelS}>🏷️ Marca preferida (opcional)</label>
                  <select value={marca} onChange={e => setMarca(e.target.value)} style={selS}>
                    <option value="">— Sem preferência (qualquer marca) —</option>
                    {marcasDisponiveis.map(mk => <option key={mk} value={mk}>{mk}</option>)}
                  </select>
                </>
              )}

              {/* QUANTIDADE */}
              {mat && (
                <>
                  <label style={labelS}>📏 Quantidade <span style={{ color: ORANGE, fontSize: 10, fontWeight: 600 }}>(unidade detectada)</span></label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={qtd} onChange={e => setQtd(e.target.value)} placeholder="Ex: 10" type="number" style={{ ...inputS, flex: 1, marginBottom: 0 }} />
                    <select value={unid} onChange={e => setUnid(e.target.value)} style={{ ...selS, flex: 1, marginBottom: 0 }}>
                      {["sacos", "m²", "m³", "kg", "ton", "unidades", "litros", "barras", "rolos", "metros", "peças"].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <label style={labelS}>📝 Observação do item (opcional)</label>
                  <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: cor branca, urgente..." style={inputS} />

                  <button onClick={adicionarNaCesta} disabled={!mat || !qtd} style={{
                    width: "100%", padding: 12, borderRadius: 10, border: "none",
                    background: mat && qtd ? GOLD : "#ccc",
                    color: "#fff", fontWeight: 800, fontSize: 13, cursor: mat && qtd ? "pointer" : "default"
                  }}>
                    ➕ Adicionar à cesta
                  </button>
                </>
              )}
            </div>

            {/* OBSERVAÇÃO GERAL DO PEDIDO + ENVIAR */}
            {itens.length > 0 && (
              <>
                <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
                  <label style={labelS}>📝 Observação geral do pedido (opcional)</label>
                  <textarea value={obsGeral} onChange={e => setObsGeral(e.target.value)} rows={2} placeholder="Ex: entregar até sexta, urgente, etc." style={{ ...inputS, resize: "none", fontFamily: "inherit", marginBottom: 0 }} />
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={onBack} style={{ flex: 1, padding: "14px", borderRadius: 10, border: "none", background: "#eee", color: NAVY, fontWeight: 800, cursor: "pointer", fontSize: 14 }}>Cancelar</button>
                  <button onClick={enviarPedido} style={{ flex: 2, padding: "14px", borderRadius: 10, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14, boxShadow: "0 4px 14px rgba(42,168,79,0.3)" }}>
                    📤 Enviar Pedido ({totalItens} {totalItens === 1 ? "item" : "itens"})
                  </button>
                </div>

                <div style={{ background: "#f0f7ff", borderRadius: 8, padding: 10, marginTop: 10, fontSize: 11, color: "#0c4a6e", textAlign: "center" }}>
                  💡 Continue adicionando quantos itens precisar antes de enviar
                </div>
              </>
            )}

            {itens.length === 0 && (
              <div style={{ textAlign: "center", padding: 16, color: "#888", fontSize: 11, fontStyle: "italic" }}>
                Nenhum item na cesta ainda. Adicione o primeiro item acima.
              </div>
            )}
          </>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   FOTOS SOLO (com câmera real)
════════════════════════════════════ */
/* ════════════════════════════════════
   CARIMBAR FOTO — adiciona data/hora/obra/numeração na imagem
════════════════════════════════════ */
async function carimbarFoto(dataUrl, info) {
  // info: { numero, obra, autor, data, hora }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      // Desenha imagem original
      ctx.drawImage(img, 0, 0);

      // Tamanho do rodapé proporcional à imagem
      const fontePx = Math.max(16, Math.round(img.width / 50));
      const padding = Math.round(fontePx * 0.7);
      const linhaAltura = Math.round(fontePx * 1.4);
      const rodapeAltura = linhaAltura * 3 + padding * 2;
      const margemBottom = Math.round(fontePx * 0.4);

      // Posiciona rodapé no canto inferior esquerdo (com margem)
      const rodapeY = img.height - rodapeAltura - margemBottom;
      const rodapeX = margemBottom;
      const rodapeLargura = img.width - margemBottom * 2;

      // Sombra/fundo translúcido escuro com gradiente
      const grad = ctx.createLinearGradient(0, rodapeY, 0, rodapeY + rodapeAltura);
      grad.addColorStop(0, "rgba(0,0,0,0.55)");
      grad.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = grad;
      // Cantos arredondados
      const radius = Math.round(fontePx * 0.4);
      ctx.beginPath();
      ctx.moveTo(rodapeX + radius, rodapeY);
      ctx.lineTo(rodapeX + rodapeLargura - radius, rodapeY);
      ctx.quadraticCurveTo(rodapeX + rodapeLargura, rodapeY, rodapeX + rodapeLargura, rodapeY + radius);
      ctx.lineTo(rodapeX + rodapeLargura, rodapeY + rodapeAltura - radius);
      ctx.quadraticCurveTo(rodapeX + rodapeLargura, rodapeY + rodapeAltura, rodapeX + rodapeLargura - radius, rodapeY + rodapeAltura);
      ctx.lineTo(rodapeX + radius, rodapeY + rodapeAltura);
      ctx.quadraticCurveTo(rodapeX, rodapeY + rodapeAltura, rodapeX, rodapeY + rodapeAltura - radius);
      ctx.lineTo(rodapeX, rodapeY + radius);
      ctx.quadraticCurveTo(rodapeX, rodapeY, rodapeX + radius, rodapeY);
      ctx.closePath();
      ctx.fill();

      // Borda dourada fina
      ctx.strokeStyle = "#f5a623";
      ctx.lineWidth = Math.max(2, Math.round(fontePx / 12));
      ctx.stroke();

      // Texto — Linha 1: KMZERO + data/hora
      ctx.fillStyle = "#f5a623";
      ctx.font = `bold ${fontePx}px Arial, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText("KMZERO", rodapeX + padding, rodapeY + padding);

      // Data/hora à direita da linha 1
      const dataHoraTexto = `📅 ${info.data}   🕐 ${info.hora}`;
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.round(fontePx * 0.85)}px Arial, sans-serif`;
      const dhWidth = ctx.measureText(dataHoraTexto).width;
      ctx.fillText(dataHoraTexto, rodapeX + rodapeLargura - dhWidth - padding, rodapeY + padding + Math.round(fontePx * 0.1));

      // Linha 2: Foto #N — Obra
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.round(fontePx * 0.95)}px Arial, sans-serif`;
      const numeroTxt = `Foto #${String(info.numero).padStart(3, "0")}`;
      ctx.fillStyle = "#f5a623";
      ctx.fillText(numeroTxt, rodapeX + padding, rodapeY + padding + linhaAltura);
      const numWidth = ctx.measureText(numeroTxt).width;

      ctx.fillStyle = "#fff";
      const obraTxt = `— ${info.obra}`;
      // Quebra obra se for muito grande
      const maxObraLargura = rodapeLargura - padding * 2 - numWidth - 10;
      const obraExibida = obraTxt.length * (fontePx * 0.5) > maxObraLargura
        ? obraTxt.substring(0, Math.floor(maxObraLargura / (fontePx * 0.55))) + "..."
        : obraTxt;
      ctx.fillText(obraExibida, rodapeX + padding + numWidth + 8, rodapeY + padding + linhaAltura);

      // Linha 3: 👷 Autor
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.round(fontePx * 0.85)}px Arial, sans-serif`;
      ctx.fillText(`👷 ${info.autor}`, rodapeX + padding, rodapeY + padding + linhaAltura * 2);

      // Converte de volta pra DataURL
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => resolve(dataUrl); // fallback: retorna sem carimbo se falhar
    img.src = dataUrl;
  });
}


function TelaFotos({ obra, usuario, onBack, onSalvar, totalFotosObra = 0 }) {
  const [fotos, setFotos] = useState([]);
  const [legenda, setLegenda] = useState("");
  const [ok, setOk] = useState(false);

  const handleArquivo = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => {
      if (fotos.length >= 5) return;
      const reader = new FileReader();
      reader.onload = ev => setFotos(fs => fs.length < 5 ? [...fs, ev.target.result] : fs);
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };

  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setEnviando(true);
    try {
      const agora = Date.now();
      const dataAtual = new Date().toLocaleDateString("pt-BR");
      const horaAtual = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const autorNome = usuario?.nome || "Encarregado";

      // Carimba cada foto antes de salvar
      for (let i = 0; i < fotos.length; i++) {
        const numeroSequencial = totalFotosObra + i + 1;
        const fotoCarimbada = await carimbarFoto(fotos[i], {
          numero: numeroSequencial,
          obra: obra.nome,
          autor: autorNome,
          data: dataAtual,
          hora: horaAtual,
        });

        onSalvar({
          id: agora + i,
          numero: numeroSequencial,
          obraId: obra.id,
          obraNome: obra.nome,
          foto: fotoCarimbada,
          legenda,
          autor: autorNome,
          data: dataAtual,
          hora: horaAtual,
        });
      }
      setOk(true);
    } catch (e) {
      alert("⚠️ Erro ao processar fotos: " + e.message);
    }
    setEnviando(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Enviar Fotos" sub={obra.nome} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {ok ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 64 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: GREEN, marginTop: 12 }}>{fotos.length} foto(s) enviada(s)!</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Salvas na galeria da obra. Você e o gestor podem acessá-las depois.</div>
            <Btn label="📷 Mais Fotos" color={BLUE} onClick={() => { setOk(false); setFotos([]); setLegenda(""); }} style={{ marginTop: 24 }} />
            <Btn label="Voltar" color="#eee" text={NAVY} onClick={onBack} style={{ marginTop: 8 }} />
          </div>
        ) : (
          <>
            <label style={{ ...bigBtn(BLUE), display: "block", textAlign: "center", marginBottom: 8 }}>
              📷  Tirar Foto
              <input type="file" accept="image/*" capture="environment" multiple onChange={handleArquivo} style={{ display: "none" }} />
            </label>
            <label style={{ ...bigBtn("#475569"), display: "block", textAlign: "center", marginBottom: 8 }}>
              🖼️  Escolher da Galeria
              <input type="file" accept="image/*" multiple onChange={handleArquivo} style={{ display: "none" }} />
            </label>
            <div style={{ fontSize: 12, color: "#999", textAlign: "center", margin: "8px 0" }}>{fotos.length}/5 fotos</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
              {fotos.map((f, i) => (
                <div key={i} style={{ background: "#dde6f5", borderRadius: 10, height: 90, position: "relative", overflow: "hidden" }}>
                  <img src={f} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button onClick={() => setFotos(fs => fs.filter((_, j) => j !== i))} style={{ position: "absolute", top: 4, right: 4, background: RED, color: "#fff", border: "none", borderRadius: 10, width: 22, height: 22, fontSize: 12, cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>✕</button>
                </div>
              ))}
            </div>
            {fotos.length > 0 && (
              <>
                <label style={labelS}>📝 Legenda (opcional, vale pra todas)</label>
                <input value={legenda} onChange={e => setLegenda(e.target.value)} placeholder="Ex: Concretagem da viga V1, sondagem do solo..." style={inputS} />
              </>
            )}
            {fotos.length > 0 && (
              <div style={{ background: "#f0f7ff", borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 11, color: "#0c4a6e" }}>
                💡 As fotos serão <b>carimbadas automaticamente</b> com data, hora, obra, número e autor.
              </div>
            )}
            <Btn label={enviando ? "⏳ Carimbando..." : "📤 Enviar"} color={fotos.length > 0 && !enviando ? GREEN : "#ccc"} disabled={fotos.length === 0 || enviando} onClick={enviar} />
          </>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   FORNECEDORES — CRUD simples
════════════════════════════════════ */
const CATEGORIAS_FORNECEDOR = [
  "Material de construção",
  "Concreto / Argamassa",
  "Aço / Ferragem",
  "Madeira",
  "Tubos e conexões",
  "Elétrica",
  "Hidráulica",
  "Tintas",
  "Cerâmica / Pisos",
  "Areia / Brita / Solo",
  "Locação de equipamentos",
  "Frete / Transporte",
  "Combustível",
  "Alimentação",
  "Manutenção / Serviços",
  "Outros",
];

function TelaFornecedores({ fornecedores = [], onBack, onAdd, onEditar, onRemover }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtroCat, setFiltroCat] = useState("todas");
  const [form, setForm] = useState({
    nome: "", razaoSocial: "", cnpj: "", categoria: "",
    contato: "", telefone: "", whatsapp: "", email: "",
    endereco: "", obs: ""
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const abrirNovo = () => {
    setEditandoId(null);
    setForm({ nome: "", razaoSocial: "", cnpj: "", categoria: "", contato: "", telefone: "", whatsapp: "", email: "", endereco: "", obs: "" });
    setModal(true);
  };

  const abrirEdit = (f) => {
    setEditandoId(f.id);
    setForm({ ...f });
    setModal(true);
  };

  const salvar = () => {
    if (!form.nome) { alert("⚠️ Informe o nome do fornecedor"); return; }
    const dados = { ...form, id: editandoId || Date.now() };
    if (editandoId) onEditar(dados);
    else onAdd(dados);
    setModal(false);
  };

  // Filtro
  const filtrados = fornecedores
    .filter(f => filtroCat === "todas" || f.categoria === filtroCat)
    .filter(f => {
      if (!busca) return true;
      const q = busca.toLowerCase();
      return f.nome?.toLowerCase().includes(q)
        || f.razaoSocial?.toLowerCase().includes(q)
        || f.contato?.toLowerCase().includes(q)
        || f.cnpj?.includes(q)
        || f.telefone?.includes(q);
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Fornecedores" sub={`${fornecedores.length} cadastrado(s)`} onBack={onBack} right={
        <button onClick={abrirNovo} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ Novo</button>
      } />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* Busca + filtro */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por nome, CNPJ, contato..." style={inputS} />
          <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} style={{ ...selS, marginBottom: 0 }}>
            <option value="todas">Todas as categorias</option>
            {CATEGORIAS_FORNECEDOR.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {filtrados.length === 0 ? (
          <EmptyState
            icon="🏪"
            titulo={fornecedores.length === 0 ? "Nenhum fornecedor cadastrado" : "Nenhum fornecedor neste filtro"}
            subtitulo={fornecedores.length === 0 ? "Cadastre seus fornecedores com CNPJ, contatos e condições de pagamento. Eles ficarão disponíveis ao criar pedidos de compra." : "Tente outro filtro ou limpe a busca."}
            botaoLabel={fornecedores.length === 0 ? "+ Cadastrar primeiro" : null}
            onBotao={fornecedores.length === 0 ? abrirNovo : null}
            cor={BLUE}
          />
        ) : (
          filtrados.map(f => (
            <div key={f.id} onClick={() => abrirEdit(f)} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${BLUE}`, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>🏪 {f.nome}</div>
                  </div>
                  {f.razaoSocial && <div style={{ fontSize: 11, color: "#666" }}>{f.razaoSocial}</div>}
                  {f.cnpj && <div style={{ fontSize: 10, color: "#888" }}>CNPJ: {f.cnpj}</div>}
                  {f.categoria && <div style={{ fontSize: 9, color: "#fff", background: BLUE, padding: "2px 6px", borderRadius: 4, fontWeight: 700, display: "inline-block", marginTop: 4 }}>{f.categoria}</div>}
                  {f.contato && <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>👤 {f.contato}</div>}
                  {(f.telefone || f.whatsapp) && (
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }} onClick={e => e.stopPropagation()}>
                      {f.telefone && <a href={`tel:${f.telefone.replace(/\D/g, "")}`} style={{ fontSize: 10, color: BLUE, textDecoration: "none", fontWeight: 600 }}>📞 {f.telefone}</a>}
                      {f.whatsapp && <a href={`https://wa.me/55${f.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener" style={{ fontSize: 10, color: GREEN, textDecoration: "none", fontWeight: 600 }}>💬 WhatsApp</a>}
                      {f.email && <a href={`mailto:${f.email}`} style={{ fontSize: 10, color: ORANGE, textDecoration: "none", fontWeight: 600 }}>📧 Email</a>}
                    </div>
                  )}
                </div>
                <span style={{ color: "#bbb", fontSize: 16 }}>›</span>
              </div>
            </div>
          ))
        )}
      </div>
      <KMFooter />

      {/* MODAL */}
      <Modal show={modal} title={editandoId ? "Editar Fornecedor" : "Novo Fornecedor"} onClose={() => setModal(false)}>
        <label style={labelS}>🏪 Nome (apelido / como você chama)</label>
        <input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: Casa do Pedreiro" style={inputS} />

        <label style={labelS}>📋 Razão Social</label>
        <input value={form.razaoSocial} onChange={e => set("razaoSocial", e.target.value)} placeholder="Ex: Casa do Pedreiro Comércio LTDA" style={inputS} />

        <label style={labelS}>🏛️ CNPJ</label>
        <input value={form.cnpj} onChange={e => set("cnpj", e.target.value)} placeholder="00.000.000/0001-00" style={inputS} />

        <label style={labelS}>🏷️ Categoria</label>
        <select value={form.categoria} onChange={e => set("categoria", e.target.value)} style={selS}>
          <option value="">— Selecione —</option>
          {CATEGORIAS_FORNECEDOR.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <label style={labelS}>👤 Pessoa de contato</label>
        <input value={form.contato} onChange={e => set("contato", e.target.value)} placeholder="Ex: João, vendedor" style={inputS} />

        <label style={labelS}>📞 Telefone fixo</label>
        <input value={form.telefone} onChange={e => set("telefone", e.target.value)} placeholder="(28) 0000-0000" style={inputS} />

        <label style={labelS}>💬 WhatsApp</label>
        <input value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)} placeholder="(28) 9 0000-0000" style={inputS} />

        <label style={labelS}>📧 Email</label>
        <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="contato@fornecedor.com.br" type="email" style={inputS} />

        <label style={labelS}>📍 Endereço</label>
        <input value={form.endereco} onChange={e => set("endereco", e.target.value)} placeholder="Rua, cidade" style={inputS} />

        <label style={labelS}>📝 Observações</label>
        <textarea value={form.obs} onChange={e => set("obs", e.target.value)} rows={2} placeholder="Forma de pagamento usual, prazo médio, etc" style={{ ...inputS, fontFamily: "inherit", resize: "none" }} />

        {editandoId && (
          <button onClick={() => { confirmar(`Excluir "${form.nome}"?`, () => { onRemover(editandoId); setModal(false); }) }} style={{ width: "100%", padding: 10, background: "#fef2f2", color: RED, border: `1px solid ${RED}33`, borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 12, marginBottom: 8 }}>🗑️ Excluir Fornecedor</button>
        )}
        <Btn label="💾 SALVAR" color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   GALERIA DE FOTOS POR OBRA
════════════════════════════════════ */
function TelaGaleria({ obras, fotos = [], usuario, onBack, onRemover }) {
  const isGestor = usuario && usuario.perfil === "gestor";
  const [filtroObra, setFiltroObra] = useState("todas");
  const [filtroData, setFiltroData] = useState("");
  const [fotoExpandida, setFotoExpandida] = useState(null);

  const fotosFiltradas = fotos
    .filter(f => filtroObra === "todas" || f.obraId === parseInt(filtroObra))
    .filter(f => !filtroData || f.data === filtroData)
    .sort((a, b) => b.id - a.id);

  // agrupar por data
  const porData = {};
  fotosFiltradas.forEach(f => {
    if (!porData[f.data]) porData[f.data] = [];
    porData[f.data].push(f);
  });
  const datasOrdenadas = Object.keys(porData).sort((a, b) => {
    const [da, ma, ya] = a.split("/");
    const [db, mb, yb] = b.split("/");
    return new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da);
  });

  const baixarFoto = (foto) => {
    const link = document.createElement("a");
    link.href = foto.foto;
    link.download = `${foto.obraNome.replace(/[^a-z0-9]/gi, "_")}-${foto.data.replace(/\//g, "-")}-${foto.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Galeria de Fotos" sub={`${fotos.length} foto(s) total`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* KPI */}
        <div style={{ background: `linear-gradient(135deg,${BLUE},#0d4f8c)`, color: "#fff", borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>📷 Total de fotos</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{fotosFiltradas.length}</div>
          <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>
            {datasOrdenadas.length} {datasOrdenadas.length === 1 ? "dia com registro" : "dias com registro"}
          </div>
        </div>

        {/* Filtros */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <label style={labelS}>🏗️ Obra</label>
          <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={selS}>
            <option value="todas">Todas as obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
          <label style={labelS}>📅 Data específica (opcional)</label>
          <input value={filtroData} onChange={e => setFiltroData(e.target.value)} placeholder="DD/MM/AAAA" style={{ ...inputS, marginBottom: 0 }} />
        </div>

        {/* Lista por data */}
        {fotosFiltradas.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 30, textAlign: "center", color: "#aaa" }}>
            📷 Nenhuma foto neste filtro.
          </div>
        ) : (
          datasOrdenadas.map(data => (
            <div key={data} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 6, padding: "0 4px" }}>
                📅 {data} ({porData[data].length} foto{porData[data].length === 1 ? "" : "s"})
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {porData[data].map(f => (
                  <div key={f.id} onClick={() => setFotoExpandida(f)} style={{ position: "relative", aspectRatio: "1", background: "#ddd", borderRadius: 8, overflow: "hidden", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                    <img src={f.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {f.numero && (
                      <div style={{ position: "absolute", top: 4, left: 4, background: "rgba(15,33,81,0.9)", color: "#f5a623", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 800 }}>#{String(f.numero).padStart(3, "0")}</div>
                    )}
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.7))", padding: "8px 4px 4px", color: "#fff" }}>
                      <div style={{ fontSize: 8, opacity: 0.85 }}>{f.hora}</div>
                      {filtroObra === "todas" && (
                        <div style={{ fontSize: 8, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.obraNome.substring(0, 18)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      <KMFooter />

      {/* MODAL FOTO EXPANDIDA */}
      {fotoExpandida && (
        <div onClick={() => setFotoExpandida(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 9999, display: "flex", flexDirection: "column", padding: 14 }}>
          <div onClick={e => e.stopPropagation()} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <div style={{ flex: 1, color: "#fff" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {fotoExpandida.numero && <span style={{ background: "#f5a623", color: "#0f2151", padding: "2px 8px", borderRadius: 4, fontSize: 11, marginRight: 8, fontWeight: 900 }}>#{String(fotoExpandida.numero).padStart(3, "0")}</span>}
                  {fotoExpandida.obraNome}
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>📅 {fotoExpandida.data} • 🕐 {fotoExpandida.hora} • 👷 {fotoExpandida.autor}</div>
              </div>
              <button onClick={() => setFotoExpandida(null)} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 18, width: 36, height: 36, fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={fotoExpandida.foto} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
            </div>
            {fotoExpandida.legenda && (
              <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: 10, marginTop: 10, color: "#fff", fontSize: 12, textAlign: "center" }}>
                📝 {fotoExpandida.legenda}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => baixarFoto(fotoExpandida)} style={{ flex: 1, background: BLUE, color: "#fff", border: "none", borderRadius: 10, padding: 12, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>📥 Baixar</button>
              {isGestor && <button onClick={() => { confirmar("Excluir esta foto da galeria?", () => { onRemover(fotoExpandida.id); setFotoExpandida(null); }) }} style={{ background: RED, color: "#fff", border: "none", borderRadius: 10, padding: "12px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>🗑️</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════
   EQUIP SOLO
════════════════════════════════════ */
function TelaEquip({ obra, equips, onBack, onSaveEquips }) {
  const obraEquips = equips.filter(e => e.obraId === obra.id);
  const [local, setLocal] = useState(obraEquips);
  const ciclo = { "Em Uso": "Disponível", "Disponível": "Em Uso", "Quebrada": "Disponível" };
  const toggle = (id) => setLocal(es => es.map(e => e.id === id ? { ...e, status: ciclo[e.status] } : e));

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Controle de Equipamentos" sub={obra.nome} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 12 }}>
        {local.map(eq => (
          <div key={eq.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 30, marginRight: 12 }}>{eq.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{eq.nome}</div>
              <div style={{ fontSize: 11, color: "#999" }}>Cód: {eq.codigo}</div>
            </div>
            <button onClick={() => toggle(eq.id)} style={{ background: EQUIP_COLOR[eq.status], color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{eq.status}</button>
          </div>
        ))}
        {local.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: 30 }}>Nenhum equipamento nesta obra.</div>}
        <Btn label="💾 Salvar Alterações" color={GREEN} onClick={() => { onSaveEquips(local); onBack(); }} style={{ marginTop: 8 }} />
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   PAINEL GESTOR
════════════════════════════════════ */
/* ════════════════════════════════════
   TABELA RESUMO DA EQUIPE (Padrão Elite) — na home do gestor
════════════════════════════════════ */
function TabelaResumoEquipe({ obras, trabalhadores, historico, onNav }) {
  const [filtroObra, setFiltroObra] = useState("todas");
  const [colapsada, setColapsada] = useState(true);

  const hoje = new Date();
  const mes = hoje.getMonth();
  const ano = hoje.getFullYear();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  const calcularDiasMes = (t) => {
    let pres = 0, falt = 0, atest = 0;
    for (let d = 1; d <= totalDias; d++) {
      const iso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const s = (historico[iso] || {})[t.id];
      if (s === "Presente") pres++;
      else if (s === "Falta") falt++;
      else if (s === "Atestado") atest++;
    }
    const diasPagos = pres + atest;
    const diaria = parseFloat(t.diaria) || 0;
    return { pres, falt, atest, diasPagos, diaria, total: diaria * diasPagos };
  };

  const trabFiltro = filtroObra === "todas" ? trabalhadores : trabalhadores.filter(t => t.obraId === parseInt(filtroObra));
  const dados = trabFiltro.map(t => ({ ...t, _calc: calcularDiasMes(t), _obra: obras.find(o => o.id === t.obraId) })).sort((a, b) => b._calc.total - a._calc.total);
  const totalGeral = dados.reduce((s, d) => s + d._calc.total, 0);

  return (
    <div style={{ background: "#fff", borderRadius: 14, marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div onClick={() => setColapsada(c => !c)} style={{ background: `linear-gradient(135deg,${NAVY},${NAVY2 || "#243b7a"})`, color: "#fff", padding: "10px 14px", display: "flex", alignItems: "center", cursor: "pointer" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>📊 Resumo da Equipe — {meses[mes]}/{ano}</div>
          <div style={{ fontSize: 10, opacity: 0.85 }}>{dados.length} trabalhador(es) • Total: R$ {totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
        </div>
        <div style={{ fontSize: 18 }}>{colapsada ? "▸" : "▾"}</div>
      </div>

      {!colapsada && (
        <>
          <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "none", borderBottom: "1px solid #eee", fontSize: 12, fontWeight: 600, color: NAVY, background: "#fafbfc" }}>
            <option value="todas">🏗️ Todas as obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: NAVY, fontWeight: 700, fontSize: 10, borderBottom: "2px solid #e5e7eb" }}>Trabalhador</th>
                  <th style={{ padding: "8px 6px", textAlign: "center", color: GREEN, fontWeight: 700, fontSize: 10, borderBottom: "2px solid #e5e7eb" }}>P</th>
                  <th style={{ padding: "8px 6px", textAlign: "center", color: RED, fontWeight: 700, fontSize: 10, borderBottom: "2px solid #e5e7eb" }}>F</th>
                  <th style={{ padding: "8px 6px", textAlign: "center", color: ORANGE, fontWeight: 700, fontSize: 10, borderBottom: "2px solid #e5e7eb" }}>A</th>
                  <th style={{ padding: "8px 8px", textAlign: "right", color: NAVY, fontWeight: 700, fontSize: 10, borderBottom: "2px solid #e5e7eb" }}>Diária</th>
                  <th style={{ padding: "8px 8px", textAlign: "right", color: NAVY, fontWeight: 700, fontSize: 10, borderBottom: "2px solid #e5e7eb" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {dados.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "#aaa", fontSize: 12 }}>Nenhum trabalhador.</td></tr>
                )}
                {dados.map(d => (
                  <tr key={d.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ fontWeight: 700, color: NAVY, fontSize: 11 }}>{d.nome}</div>
                      <div style={{ fontSize: 9, color: "#888" }}>{d.cargo} • {d._obra?.nome?.substring(0, 22) || "—"}</div>
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "center", color: GREEN, fontWeight: 700, fontSize: 11 }}>{d._calc.pres}</td>
                    <td style={{ padding: "8px 6px", textAlign: "center", color: d._calc.falt > 0 ? RED : "#ccc", fontWeight: 700, fontSize: 11 }}>{d._calc.falt}</td>
                    <td style={{ padding: "8px 6px", textAlign: "center", color: d._calc.atest > 0 ? ORANGE : "#ccc", fontWeight: 700, fontSize: 11 }}>{d._calc.atest}</td>
                    <td style={{ padding: "8px 8px", textAlign: "right", color: d._calc.diaria === 0 ? "#ccc" : "#666", fontSize: 10, fontStyle: d._calc.diaria === 0 ? "italic" : "normal" }}>{d._calc.diaria === 0 ? "—" : "R$ " + d._calc.diaria.toFixed(2)}</td>
                    <td style={{ padding: "8px 8px", textAlign: "right", color: GREEN, fontWeight: 800, fontSize: 11 }}>R$ {d._calc.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f3f4f6" }}>
                  <td colSpan={5} style={{ padding: "10px", textAlign: "right", color: NAVY, fontWeight: 800, fontSize: 11 }}>TOTAL DO MÊS</td>
                  <td style={{ padding: "10px", textAlign: "right", color: GREEN, fontWeight: 900, fontSize: 13 }}>R$ {totalGeral.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ padding: "8px 12px", background: "#f9fafb", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #eee", fontSize: 10, color: "#888" }}>
            <span>P=Presença • F=Falta • A=Atestado</span>
            <button onClick={() => onNav("folha_quinzenal")} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Ver Folha →</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════
   CRONOGRAMA DA OBRA — etapas e progresso
════════════════════════════════════ */
const MODELOS_CRONOGRAMA = {
  Pavimentação: [
    { nome: "Mobilização e canteiro", duracao: 7 },
    { nome: "Sondagem e topografia", duracao: 7 },
    { nome: "Limpeza e terraplanagem", duracao: 14 },
    { nome: "Sub-base", duracao: 14 },
    { nome: "Base", duracao: 14 },
    { nome: "Drenagem (manilhas + bocas de lobo)", duracao: 21 },
    { nome: "Meio-fio e sarjetas", duracao: 14 },
    { nome: "Pavimentação asfáltica / blocos", duracao: 14 },
    { nome: "Sinalização", duracao: 7 },
    { nome: "Limpeza final e entrega", duracao: 5 },
  ],
  Edificação: [
    { nome: "Mobilização e canteiro", duracao: 5 },
    { nome: "Demolições / preparação", duracao: 7 },
    { nome: "Fundações", duracao: 21 },
    { nome: "Estrutura", duracao: 30 },
    { nome: "Alvenaria", duracao: 30 },
    { nome: "Instalações elétricas", duracao: 21 },
    { nome: "Instalações hidráulicas", duracao: 21 },
    { nome: "Revestimentos", duracao: 21 },
    { nome: "Pintura e acabamentos", duracao: 14 },
    { nome: "Limpeza final e entrega", duracao: 5 },
  ],
};

function TelaCronograma({ obras, cronogramas, onBack, onSalvar }) {
  const [obraId, setObraId] = useState(obras[0]?.id || 1);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);

  const obra = obras.find(o => o.id === obraId);
  const etapas = cronogramas[obraId] || [];
  const obraTipo = obra?.tipo || "Edificação";

  const aplicarModelo = (tipo) => {
    if (etapas.length > 0 && !confirm(`Já existem ${etapas.length} etapas. Substituir tudo pelo modelo ${tipo}?`)) return;
    const dataInicio = new Date();
    let dataAtual = new Date(dataInicio);
    const novas = MODELOS_CRONOGRAMA[tipo].map((e, i) => {
      const ini = new Date(dataAtual);
      const fim = new Date(dataAtual);
      fim.setDate(fim.getDate() + e.duracao);
      dataAtual = new Date(fim);
      dataAtual.setDate(dataAtual.getDate() + 1);
      return {
        id: Date.now() + i,
        nome: e.nome,
        ordem: i,
        inicio: ini.toISOString().split("T")[0],
        fim: fim.toISOString().split("T")[0],
        progresso: 0,
        responsavel: "",
        obs: "",
      };
    });
    onSalvar(obraId, novas);
  };

  const salvarEtapa = (etapa) => {
    const ja = etapas.find(e => e.id === etapa.id);
    let novas;
    if (ja) {
      novas = etapas.map(e => e.id === etapa.id ? etapa : e);
    } else {
      novas = [...etapas, { ...etapa, ordem: etapas.length, id: Date.now() }];
    }
    onSalvar(obraId, novas);
    setModal(false);
    setEditando(null);
  };

  const removerEtapa = (id) => {
    if (!confirm("Remover esta etapa?")) return;
    onSalvar(obraId, etapas.filter(e => e.id !== id));
  };

  const moverEtapa = (id, direcao) => {
    const idx = etapas.findIndex(e => e.id === id);
    if (idx < 0) return;
    const novoIdx = idx + direcao;
    if (novoIdx < 0 || novoIdx >= etapas.length) return;
    const arr = [...etapas];
    [arr[idx], arr[novoIdx]] = [arr[novoIdx], arr[idx]];
    onSalvar(obraId, arr.map((e, i) => ({ ...e, ordem: i })));
  };

  const setProgresso = (id, valor) => {
    onSalvar(obraId, etapas.map(e => e.id === id ? { ...e, progresso: valor } : e));
  };

  const progressoGeral = etapas.length > 0
    ? Math.round(etapas.reduce((s, e) => s + (e.progresso || 0), 0) / etapas.length)
    : 0;

  const exportarPDF = () => {
    if (etapas.length === 0) { alert("Nenhuma etapa cadastrada."); return; }
    const html = `<html><head><title>Cronograma - ${obra.nome}</title></head><body>
      <h1 style="color:#0f2151;border-bottom:3px solid #C0A040;padding-bottom:8px;">📅 Cronograma da Obra</h1>
      <p><b>Obra:</b> ${obra.nome}<br/>
      <b>Local:</b> ${obra.local}<br/>
      <b>Status:</b> ${obra.status}<br/>
      <b>Progresso geral:</b> ${progressoGeral}%<br/>
      <b>Total de etapas:</b> ${etapas.length}<br/>
      <b>Gerado em:</b> ${new Date().toLocaleString("pt-BR")}</p>

      <h2>📋 Etapas do Projeto</h2>
      <table>
        <tr>
          <th style="width:5%">Nº</th>
          <th>Etapa</th>
          <th style="width:10%">Início</th>
          <th style="width:10%">Fim</th>
          <th style="width:8%">Dias</th>
          <th style="width:10%">Progresso</th>
          <th style="width:14%">Responsável</th>
        </tr>
        ${etapas.map((e, i) => {
          const ini = e.inicio ? new Date(e.inicio).toLocaleDateString("pt-BR") : "—";
          const fim = e.fim ? new Date(e.fim).toLocaleDateString("pt-BR") : "—";
          let dias = "—";
          if (e.inicio && e.fim) {
            const d = Math.round((new Date(e.fim) - new Date(e.inicio)) / (1000 * 60 * 60 * 24));
            dias = d + "d";
          }
          const cor = e.progresso === 100 ? "#2aa84f" : e.progresso > 0 ? "#e87722" : "#999";
          return `<tr>
            <td style="text-align:center"><b>${i + 1}</b></td>
            <td><b>${e.nome}</b>${e.obs ? '<br/><span style="font-size:8pt;color:#888">' + e.obs + '</span>' : ''}</td>
            <td style="text-align:center">${ini}</td>
            <td style="text-align:center">${fim}</td>
            <td style="text-align:center">${dias}</td>
            <td style="text-align:center;color:${cor};font-weight:700">${e.progresso || 0}%</td>
            <td>${e.responsavel || "—"}</td>
          </tr>`;
        }).join("")}
      </table>
      <div class="footer">Sistema KMZERO • Cronograma gerado automaticamente</div>
    </body></html>`;
    abrirOuBaixarHTML(html, `Cronograma-${obra.nome.replace(/[^a-z0-9]/gi, "_").substring(0, 25)}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Cronograma" sub="Etapas da obra" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <label style={labelS}>Obra</label>
        <select value={obraId} onChange={e => setObraId(parseInt(e.target.value))} style={selS}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        {/* Card de progresso geral */}
        <div style={{ background: `linear-gradient(135deg,${NAVY},${NAVY2})`, color: "#fff", borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 11, opacity: 0.85 }}>Progresso geral da obra</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: GOLD }}>{progressoGeral}%</div>
          <div style={{ height: 8, background: "rgba(255,255,255,0.2)", borderRadius: 4, marginTop: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progressoGeral}%`, background: GOLD, transition: "width 0.3s" }}></div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 6 }}>{etapas.filter(e => e.progresso === 100).length} de {etapas.length} etapas concluídas</div>
        </div>

        {/* Modelos prontos */}
        {etapas.length === 0 && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, color: NAVY, fontSize: 13, marginBottom: 8 }}>🚀 Começar com modelo pronto</div>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 10 }}>Aplica um modelo padrão de etapas baseado no tipo da obra (você pode editar depois).</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => aplicarModelo("Pavimentação")} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: ORANGE, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>🛣️ Pavimentação</button>
              <button onClick={() => aplicarModelo("Edificação")} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: BLUE, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>🏢 Edificação</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button onClick={() => { setEditando({ nome: "", inicio: "", fim: "", progresso: 0, responsavel: "", obs: "" }); setModal(true); }} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: NAVY, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>➕ Nova Etapa</button>
          {etapas.length > 0 && (
            <button onClick={exportarPDF} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: GOLD, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>📄 PDF</button>
          )}
        </div>

        {/* Lista de etapas */}
        {etapas.length === 0 ? (
          <EmptyState
            icon="📋"
            titulo="Nenhuma etapa cadastrada"
            subtitulo="Use um modelo pronto (Casa, Sobrado, Prédio) ou adicione manualmente. Cada etapa terá controle de progresso e prazo."
            cor={ORANGE}
          />
        ) : etapas.map((e, i) => {
          const cor = e.progresso === 100 ? GREEN : e.progresso > 0 ? ORANGE : "#aaa";
          const concluida = e.progresso === 100;
          return (
            <div key={e.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${cor}`, opacity: concluida ? 0.75 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 14, background: cor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, marginRight: 10 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 13, textDecoration: concluida ? "line-through" : "none" }}>{e.nome}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>
                    {e.inicio && new Date(e.inicio).toLocaleDateString("pt-BR")}
                    {e.inicio && e.fim && " → "}
                    {e.fim && new Date(e.fim).toLocaleDateString("pt-BR")}
                    {e.responsavel && ` • ${e.responsavel}`}
                  </div>
                </div>
                <button onClick={() => moverEtapa(e.id, -1)} disabled={i === 0} style={{ background: "none", border: "none", color: i === 0 ? "#ddd" : "#666", cursor: i === 0 ? "default" : "pointer", fontSize: 16 }}>↑</button>
                <button onClick={() => moverEtapa(e.id, 1)} disabled={i === etapas.length - 1} style={{ background: "none", border: "none", color: i === etapas.length - 1 ? "#ddd" : "#666", cursor: i === etapas.length - 1 ? "default" : "pointer", fontSize: 16 }}>↓</button>
              </div>

              {/* Barra de progresso */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <input
                  type="range" min="0" max="100" step="10"
                  value={e.progresso || 0}
                  onChange={ev => setProgresso(e.id, parseInt(ev.target.value))}
                  style={{ flex: 1, accentColor: cor }}
                />
                <span style={{ fontSize: 12, fontWeight: 800, color: cor, minWidth: 40, textAlign: "right" }}>{e.progresso || 0}%</span>
              </div>

              {e.obs && <div style={{ fontSize: 11, color: "#666", fontStyle: "italic", marginTop: 4, paddingLeft: 38 }}>"{e.obs}"</div>}

              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button onClick={() => { setEditando(e); setModal(true); }} style={{ flex: 1, padding: 6, borderRadius: 6, border: `1px solid ${BLUE}`, background: "#fff", color: BLUE, fontWeight: 700, cursor: "pointer", fontSize: 10 }}>✏️ Editar</button>
                <button onClick={() => removerEtapa(e.id)} style={{ padding: 6, borderRadius: 6, border: `1px solid ${RED}`, background: "#fff", color: RED, fontWeight: 700, cursor: "pointer", fontSize: 10, width: 50 }}>🗑️</button>
              </div>
            </div>
          );
        })}
      </div>
      <KMFooter />

      <Modal show={modal} title={editando?.id ? "Editar Etapa" : "Nova Etapa"} onClose={() => { setModal(false); setEditando(null); }}>
        {editando && (
          <>
            <label style={labelS}>Nome da etapa</label>
            <input value={editando.nome || ""} onChange={ev => setEditando(e => ({ ...e, nome: ev.target.value }))} placeholder="Ex: Sondagem e topografia" style={inputS} />
            <label style={labelS}>Data início</label>
            <input value={editando.inicio || ""} onChange={ev => setEditando(e => ({ ...e, inicio: ev.target.value }))} type="date" style={inputS} />
            <label style={labelS}>Data fim prevista</label>
            <input value={editando.fim || ""} onChange={ev => setEditando(e => ({ ...e, fim: ev.target.value }))} type="date" style={inputS} />
            <label style={labelS}>Progresso (%)</label>
            <select value={editando.progresso || 0} onChange={ev => setEditando(e => ({ ...e, progresso: parseInt(ev.target.value) }))} style={selS}>
              {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => <option key={p} value={p}>{p}%</option>)}
            </select>
            <label style={labelS}>Responsável (opcional)</label>
            <input value={editando.responsavel || ""} onChange={ev => setEditando(e => ({ ...e, responsavel: ev.target.value }))} placeholder="Ex: Geovane" style={inputS} />
            <label style={labelS}>Observações (opcional)</label>
            <textarea value={editando.obs || ""} onChange={ev => setEditando(e => ({ ...e, obs: ev.target.value }))} rows={3} placeholder="Detalhes, obs técnicas..." style={{ ...inputS, fontFamily: "inherit" }} />
            <Btn label="💾 SALVAR" color={GREEN} onClick={() => { if (editando.nome) salvarEtapa(editando); }} />
          </>
        )}
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CRONOGRAMA PRO — Curva S, IDP, alertas, caminho crítico
   Visão executiva pra fiscalização e relatórios profissionais
══════════════════════════════════════════════════════════════════════ */

const _parseISO = (s) => { const d = new Date(s + "T00:00:00"); return isNaN(d) ? new Date() : d; };
const _diasEntre = (a, b) => Math.round((_parseISO(b) - _parseISO(a)) / 86400000);
const _fmtDia = (d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

function calcularKPIsCronograma(etapas, hojeIso) {
  if (!etapas || etapas.length === 0) {
    return { idp: 1, pctPrev: 0, pctExec: 0, atrasoCritico: 0, custoTotal: 0, vp: 0, va: 0 };
  }
  const custoTotal = etapas.reduce((s, e) => s + (parseFloat(e.custoBase) || 0), 0);
  const vp = etapas.reduce((s, e) => s + (parseFloat(e.custoBase) || 0) * ((e.pctPrevisto || 0) / 100), 0);
  const va = etapas.reduce((s, e) => s + (parseFloat(e.custoBase) || 0) * ((e.progresso || 0) / 100), 0);
  const idp = vp > 0 ? va / vp : 1;
  const pctPrev = custoTotal > 0 ? (vp / custoTotal) * 100 : 0;
  const pctExec = custoTotal > 0 ? (va / custoTotal) * 100 : 0;
  let atrasoCritico = 0;
  etapas.filter(e => e.critica).forEach(e => {
    if (e.fim && e.fimReal) {
      const dias = _diasEntre(e.fim, e.fimReal);
      if (dias > atrasoCritico) atrasoCritico = dias;
    }
  });
  return { idp, pctPrev, pctExec, atrasoCritico, custoTotal, vp, va };
}

function detectarInconsistenciasCronograma(etapas, hojeIso) {
  const alertas = [];
  const hojeD = new Date(hojeIso + "T00:00:00");
  etapas.forEach(e => {
    if (e.critica && e.fim && e.fimReal) {
      const dias = _diasEntre(e.fim, e.fimReal);
      if (dias > 7) alertas.push({ tipo: "prazo", severidade: "alta", etapa: e.nome, msg: `Etapa crítica com ${dias} dias de atraso projetado — impacto direto no caminho crítico` });
    }
    if (e.pctPrevisto !== undefined && e.progresso !== undefined) {
      const def = e.pctPrevisto - e.progresso;
      if (def > 12 && e.progresso < 100) alertas.push({ tipo: "ritmo", severidade: "media", etapa: e.nome, msg: `Defasagem de ${def.toFixed(0)} pontos — produtividade abaixo do plano` });
      if (e.progresso > e.pctPrevisto + 15) alertas.push({ tipo: "antecipacao", severidade: "media", etapa: e.nome, msg: `Execução ${e.progresso}% acima do previsto (${e.pctPrevisto}%) — validar pedidos de material` });
    }
    if (e.inicio && e.fim && hojeD >= _parseISO(e.inicio) && hojeD <= _parseISO(e.fim)) {
      if ((e.progresso || 0) === 0) alertas.push({ tipo: "parada", severidade: "alta", etapa: e.nome, msg: `Etapa deveria ter começado mas progresso ainda em 0%` });
    }
  });
  return alertas;
}

function calcularPctPrevistoEtapa(etapa, hojeIso) {
  if (!etapa.inicio || !etapa.fim) return etapa.pctPrevisto || 0;
  const ini = _parseISO(etapa.inicio);
  const fim = _parseISO(etapa.fim);
  const hoje = new Date(hojeIso + "T00:00:00");
  if (hoje < ini) return 0;
  if (hoje >= fim) return 100;
  const total = (fim - ini) / 86400000;
  const decorrido = (hoje - ini) / 86400000;
  return Math.round((decorrido / total) * 100);
}

function gerarPontosCurvaS(etapas, hojeIso) {
  if (!etapas || etapas.length === 0) return [];
  const datasI = etapas.filter(e => e.inicio).map(e => _parseISO(e.inicio).getTime());
  const datasF = etapas.filter(e => e.fim).map(e => _parseISO(e.fim).getTime());
  if (datasI.length === 0 || datasF.length === 0) return [];
  const inicio = new Date(Math.min(...datasI));
  const fim = new Date(Math.max(...datasF));
  const totalDias = Math.max(1, Math.round((fim - inicio) / 86400000));
  const hoje = new Date(hojeIso + "T00:00:00");
  const pontos = [];
  const passos = 12;
  for (let i = 0; i <= passos; i++) {
    const data = new Date(inicio.getTime() + (totalDias / passos) * i * 86400000);
    const fracao = i / passos;
    const x = (fracao - 0.5) * 6;
    const sig = 1 / (1 + Math.exp(-x));
    const planejado = sig * 100;
    let executado = null;
    if (data <= hoje) {
      const pctReal = etapas.reduce((s, e) => {
        if (!e.inicio || !e.fim) return s;
        const eIni = _parseISO(e.inicio);
        const eFim = _parseISO(e.fim);
        const peso = 1 / etapas.length;
        if (data >= eFim) return s + (e.progresso || 0) * peso;
        if (data >= eIni) {
          const fr = (data - eIni) / (eFim - eIni);
          return s + Math.min(e.progresso || 0, fr * 100) * peso;
        }
        return s;
      }, 0);
      executado = pctReal;
    }
    pontos.push({
      data: _fmtDia(data),
      ts: data.getTime(),
      planejado: +planejado.toFixed(1),
      executado: executado !== null ? +executado.toFixed(1) : null,
      ehHoje: Math.abs((data - hoje) / 86400000) < (totalDias / passos) / 2,
    });
  }
  return pontos;
}

function CurvaSChart({ pontos }) {
  if (!pontos || pontos.length === 0) {
    return <div style={{ padding: 30, textAlign: "center", color: "#888", fontSize: 12 }}>Adicione etapas com datas pra ver a curva.</div>;
  }
  const W = 360, H = 180, padX = 30, padY = 20;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const px = (i) => padX + (i / (pontos.length - 1)) * innerW;
  const py = (v) => padY + innerH - (v / 100) * innerH;
  const pathPlan = pontos.map((p, i) => `${i === 0 ? "M" : "L"} ${px(i)} ${py(p.planejado)}`).join(" ");
  const pontosExec = pontos.filter(p => p.executado !== null);
  const pathExec = pontosExec.map((p, idx) => `${idx === 0 ? "M" : "L"} ${px(pontos.indexOf(p))} ${py(p.executado)}`).join(" ");
  const idxHoje = pontos.findIndex(p => p.ehHoje);
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ background: "#fff", borderRadius: 8 }}>
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line x1={padX} y1={py(v)} x2={W - padX} y2={py(v)} stroke="#e5e7eb" strokeDasharray="2 2" />
          <text x={padX - 4} y={py(v) + 3} fontSize="9" fill="#999" textAnchor="end">{v}%</text>
        </g>
      ))}
      {idxHoje >= 0 && (
        <g>
          <line x1={px(idxHoje)} y1={padY} x2={px(idxHoje)} y2={H - padY} stroke={GOLD} strokeWidth="1.5" strokeDasharray="3 3" />
          <text x={px(idxHoje) + 3} y={padY + 8} fontSize="9" fill={GOLD} fontWeight="700">HOJE</text>
        </g>
      )}
      <path d={pathPlan} fill="none" stroke="#94a3b8" strokeWidth="2" />
      {pathExec && <path d={pathExec} fill="none" stroke={GOLD} strokeWidth="2.5" />}
      {pontosExec.map((p, i) => (
        <circle key={i} cx={px(pontos.indexOf(p))} cy={py(p.executado)} r="3" fill={GOLD} />
      ))}
      {pontos.filter((_, i) => i % 3 === 0).map((p, i) => (
        <text key={i} x={px(pontos.indexOf(p))} y={H - 4} fontSize="8" fill="#888" textAnchor="middle">{p.data}</text>
      ))}
    </svg>
  );
}

function TelaCronogramaPro({ obras, cronogramas, onBack, onSalvar }) {
  const [obraId, setObraId] = useState(obras[0]?.id || 1);
  const [aba, setAba] = useState("gantt");
  const [etapaSel, setEtapaSel] = useState(null);
  const [custoInput, setCustoInput] = useState("");
  const [criticaInput, setCriticaInput] = useState(false);
  const [progressoInput, setProgressoInput] = useState(0);

  const obra = obras.find(o => o.id === obraId);
  const hojeIso = new Date().toISOString().split("T")[0];
  const etapasRaw = cronogramas[obraId] || [];

  const etapas = etapasRaw.map(e => ({
    ...e,
    pctPrevisto: calcularPctPrevistoEtapa(e, hojeIso),
    fimReal: e.fimReal || e.fim,
    custoBase: e.custoBase || 0,
  }));

  const kpis = calcularKPIsCronograma(etapas, hojeIso);
  const alertas = detectarInconsistenciasCronograma(etapas, hojeIso);
  const pontosCurvaS = gerarPontosCurvaS(etapas, hojeIso);

  const abrirEtapa = (e) => {
    setEtapaSel(e);
    setCustoInput(String(e.custoBase || ""));
    setCriticaInput(!!e.critica);
    setProgressoInput(e.progresso || 0);
  };

  const salvarEtapa = () => {
    const novas = etapasRaw.map(et => et.id === etapaSel.id ? {
      ...et,
      custoBase: parseFloat(custoInput) || 0,
      critica: criticaInput,
      progresso: parseInt(progressoInput) || 0,
    } : et);
    onSalvar(obraId, novas);
    setEtapaSel(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Cronograma Pro" sub={obra?.nome || "—"} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        <select value={obraId} onChange={e => setObraId(parseInt(e.target.value))} style={{ ...selS, marginBottom: 10 }}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 12 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", borderLeft: `4px solid ${kpis.idp >= 0.95 ? GREEN : kpis.idp >= 0.85 ? ORANGE : RED}` }}>
            <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>IDP · Prazo</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: NAVY, marginTop: 2 }}>{kpis.idp.toFixed(2)}</div>
            <div style={{ fontSize: 10, color: kpis.idp >= 1 ? GREEN : RED, fontWeight: 700 }}>
              {kpis.idp >= 1 ? "✓ No ritmo" : `${((1 - kpis.idp) * 100).toFixed(1)}% abaixo`}
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", borderLeft: `4px solid ${BLUE}` }}>
            <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Avanço Físico</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: NAVY, marginTop: 2 }}>{kpis.pctExec.toFixed(1)}%</div>
            <div style={{ fontSize: 10, color: "#888" }}>Plan. {kpis.pctPrev.toFixed(1)}%</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", borderLeft: `4px solid ${kpis.atrasoCritico > 7 ? RED : kpis.atrasoCritico > 0 ? ORANGE : GREEN}` }}>
            <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Δ Crítico</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: NAVY, marginTop: 2 }}>
              {kpis.atrasoCritico > 0 ? `+${kpis.atrasoCritico}d` : "0d"}
            </div>
            <div style={{ fontSize: 10, color: kpis.atrasoCritico > 0 ? RED : GREEN, fontWeight: 700 }}>
              {kpis.atrasoCritico > 0 ? "Atrasado" : "Em dia"}
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", borderLeft: `4px solid #7c3aed` }}>
            <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Custo Base</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: NAVY, marginTop: 2 }}>
              R$ {(kpis.custoTotal / 1000).toFixed(2)}k
            </div>
            <div style={{ fontSize: 10, color: "#888" }}>EV: R$ {(kpis.va / 1000).toFixed(2)}k</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[
            { id: "gantt", label: "📊 Gantt" },
            { id: "curva", label: "📈 Curva S" },
            { id: "alertas", label: `🚨 Alertas${alertas.length > 0 ? ` (${alertas.length})` : ""}` },
          ].map(t => (
            <button key={t.id} onClick={() => setAba(t.id)} style={{
              flex: 1, padding: "8px 4px", borderRadius: 8,
              background: aba === t.id ? NAVY : "#fff",
              color: aba === t.id ? "#fff" : NAVY,
              border: aba === t.id ? "none" : "1px solid #ddd",
              cursor: "pointer", fontSize: 11, fontWeight: 700,
            }}>{t.label}</button>
          ))}
        </div>

        {aba === "gantt" && (
          etapas.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 36 }}>📅</div>
              <div style={{ color: "#888", fontSize: 13, marginTop: 8 }}>
                Nenhuma etapa nessa obra. Crie etapas no <b>Cronograma simples</b> primeiro.
              </div>
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
              {etapas.map(e => {
                const def = (e.pctPrevisto || 0) - (e.progresso || 0);
                const corBarra = e.critica ? GOLD : BLUE;
                return (
                  <div key={e.id} onClick={() => abrirEtapa(e)} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #eee", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                        {e.critica && <span style={{ color: GOLD, fontSize: 11 }}>●</span>}
                        <span style={{ fontSize: 12, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.nome}</span>
                      </div>
                      <span style={{ fontSize: 10, color: "#888", marginLeft: 6, flexShrink: 0 }}>{e.progresso || 0}%</span>
                    </div>
                    <div style={{ position: "relative", height: 14, background: "#f5f5f5", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ position: "absolute", inset: 0, background: corBarra + "22" }} />
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${e.progresso || 0}%`, background: corBarra }} />
                      <div style={{ position: "absolute", left: `${e.pctPrevisto || 0}%`, top: 0, bottom: 0, width: 2, background: "#0f2151" }} title="Previsto" />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 9, color: "#888" }}>
                      <span>{e.inicio || "—"} → {e.fim || "—"}</span>
                      <span style={{ color: def > 12 ? RED : def > 5 ? ORANGE : GREEN, fontWeight: 700 }}>
                        {def === 0 ? "No ritmo" : def > 0 ? `${def.toFixed(0)} pts atrás` : `${Math.abs(def).toFixed(0)} pts à frente`}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize: 10, color: "#888", marginTop: 8, padding: "6px 8px", background: "#f9fafb", borderRadius: 6 }}>
                ● Etapa crítica • | Linha vertical = % previsto pra hoje
              </div>
            </div>
          )
        )}

        {aba === "curva" && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Curva S — Avanço Físico Acumulado</div>
            <CurvaSChart pontos={pontosCurvaS} />
            <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: "#888" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 12, height: 2, background: "#94a3b8" }} /> Planejado
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 12, height: 2, background: GOLD }} /> Executado
              </span>
            </div>
          </div>
        )}

        {aba === "alertas" && (
          alertas.length === 0 ? (
            <div style={{ background: "#f0fdf4", borderRadius: 12, padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 36 }}>✅</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, marginTop: 8 }}>Tudo em ordem!</div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>Nenhuma inconsistência detectada.</div>
            </div>
          ) : (
            <div>
              {alertas.map((a, i) => {
                const cor = a.severidade === "alta" ? RED : a.severidade === "media" ? ORANGE : BLUE;
                return (
                  <div key={i} style={{ background: "#fff", borderRadius: 10, padding: 12, marginBottom: 8, borderLeft: `4px solid ${cor}`, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: NAVY }}>{a.etapa}</div>
                      <span style={{ background: cor, color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: 8, fontWeight: 800, textTransform: "uppercase" }}>{a.severidade}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#444", lineHeight: 1.4 }}>{a.msg}</div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
      <KMFooter />

      <Modal show={!!etapaSel} title={etapaSel?.nome || ""} onClose={() => setEtapaSel(null)}>
        {etapaSel && (
          <>
            <div style={{ background: "#f9fafb", borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 11, color: "#666" }}>
              📅 {etapaSel.inicio || "—"} → {etapaSel.fim || "—"}<br/>
              📊 Previsto pra hoje: <b>{etapaSel.pctPrevisto || 0}%</b>
            </div>
            <label style={labelS}>📈 Progresso Real (%)</label>
            <input type="number" min="0" max="100" value={progressoInput} onChange={e => setProgressoInput(e.target.value)} style={inputS} />
            <label style={labelS}>💰 Custo Base (R$)</label>
            <input type="number" value={custoInput} onChange={e => setCustoInput(e.target.value)} placeholder="0" style={inputS} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, background: criticaInput ? "#fef9e7" : "#f9fafb", borderRadius: 8, cursor: "pointer", marginBottom: 10 }}>
              <input type="checkbox" checked={criticaInput} onChange={e => setCriticaInput(e.target.checked)} />
              <span style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>⚠️ Etapa do Caminho Crítico</span>
            </label>
            <Btn label="💾 SALVAR" color={GREEN} onClick={salvarEtapa} />
          </>
        )}
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   PAINEL GESTOR
════════════════════════════════════ */
/* ════════════════════════════════════
   PAINEL GESTOR
════════════════════════════════════ */
function TelaPainelGestor({ obras, trabalhadores, pedidos, equips, historico, mensagens, movimentacoes, manutencoes, cronogramas, movEquip, ativos, abastecimentos, empresa, usuario, onNav, onLogout, onAprovar, onNegar }) {
  const pendentes = pedidos.filter(p => p.status === "Aguardando").length;
  const movPendentes = (movimentacoes || []).filter(m => m.status === "Aguardando").length;
  const movEquipPendentes = (movEquip || []).filter(m => m.status === "Aguardando").length;
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const pedidosFiltrados = filtroStatus === "todos" ? pedidos : pedidos.filter(p => p.status === filtroStatus);
  const totalAlertas = gerarAlertas({ obras, trabalhadores, equips, pedidos, historico, manutencoes, cronogramas, movEquip, ativos, abastecimentos }).length;
  const novasMsgs = mensagens?.filter(m => !m.lida && m.para === usuario?.id).length || 0;

  // Modal de aprovação com forma pagamento + prazo
  const [pedidoAprovando, setPedidoAprovando] = useState(null);
  const [formaPag, setFormaPag] = useState("");
  const [prazo, setPrazo] = useState("");

  const abrirAprovacao = (p) => {
    setPedidoAprovando(p);
    setFormaPag(p.formaPagamento || "");
    setPrazo(p.prazoEntrega || "");
  };

  const confirmarAprovacao = () => {
    if (!pedidoAprovando) return;
    const obraDoPedido = obras.find(o => o.id === pedidoAprovando.obraId);
    const pedidoCompleto = { ...pedidoAprovando, formaPagamento: formaPag, prazoEntrega: prazo, status: "Aprovado" };
    onAprovar(pedidoAprovando.id, { formaPagamento: formaPag, prazoEntrega: prazo });
    // Gera PDF DIRETO (sem confirm — o usuário pode fechar se não quiser)
    setTimeout(() => {
      try {
        gerarSolicitacaoPedidoPDF(pedidoCompleto, obraDoPedido, empresa);
      } catch (e) {
        console.error("Erro ao gerar PDF:", e);
        alert("✅ Pedido aprovado!\n\n⚠️ Não foi possível gerar o PDF agora. Tente abrir o pedido novamente para baixar.");
      }
    }, 200);
    setPedidoAprovando(null);
    setFormaPag("");
    setPrazo("");
  };

  // Categorias do menu — ordenadas por uso/importância
  const categorias = [
    {
      titulo: "📋 Operação Diária",
      cor: GOLD,
      desc: "Relatórios, presenças e custos",
      itens: [
        { icon: "📄", l: "RDO ABNT",      nav: "rdo",         c: GOLD,         destaque: true },
        { icon: "📦", l: "Pedidos",       nav: "pedidos",     c: pendentes > 0 ? RED : "#0891b2", badge: pendentes },
        { icon: "💵", l: "Custos/Obra",   nav: "custos",      c: "#16a34a" },
        { icon: "💸", l: "Desp. Avulsas", nav: "despesas",    c: "#ea580c" },
        { icon: "📷", l: "Galeria Fotos", nav: "galeria",     c: "#7c3aed" },
        { icon: "📊", l: "Dashboard",     nav: "dashboard",   c: "#0d9488" },
        { icon: "📅", l: "Calendário",    nav: "calendario",  c: "#7c3aed" },
        { icon: "🗺️", l: "Mapa Obras",   nav: "mapa",        c: "#16a34a" },
        { icon: "🚨", l: "Alertas",       nav: "alertas",     c: totalAlertas > 0 ? RED : "#9ca3af", badge: totalAlertas },
      ],
    },
    {
      titulo: "👥 Recursos Humanos",
      cor: BLUE,
      desc: "Equipe, folha e gestão de pessoas",
      itens: [
        { icon: "💰", l: "Folha de Pagamento", nav: "folha_quinzenal", c: "#15803d" },
        { icon: "📋", l: "Histórico Folhas", nav: "hist_folha",      c: "#059669" },
        { icon: "💸", l: "Adiantamentos",   nav: "adiantamentos",   c: "#ea580c" },
        { icon: "🔄", l: "Movimentações",   nav: "aprovar_mov",     c: movPendentes > 0 ? RED : "#0e7490", badge: movPendentes },
        { icon: "👥", l: "Equipe",          nav: "equipe",          c: BLUE },
        { icon: "📋", l: "Fichas",          nav: "ficha",           c: ORANGE },
        { icon: "📞", l: "Contatos",        nav: "contatos",        c: "#0284c7" },
        { icon: "🏥", l: "Exames (ASO)",    nav: "exames",          c: "#dc2626" },
        { icon: "🎂", l: "Aniv. / EPI",     nav: "rh",              c: "#f59e0b" },
        { icon: "🌴", l: "Férias",          nav: "ferias",          c: "#0e7490" },
        { icon: "💵", l: "Folha Mensal",    nav: "folha",           c: "#059669" },
      ],
    },
    {
      titulo: "🏗️ Obras & Recursos",
      cor: NAVY,
      desc: "Obras, máquinas e materiais",
      itens: [
        { icon: "🏗️", l: "Obras",          nav: "obras",         c: NAVY },
        { icon: "📅", l: "Cronograma",      nav: "cronograma",    c: "#7c3aed" },
        { icon: "🎯", l: "Cronograma Pro",  nav: "cronograma_pro", c: "#5b21b6" },
        { icon: "🔄", l: "Mov. Equip.",      nav: "mov_equip",     c: movEquipPendentes > 0 ? RED : "#0e7490", badge: movEquipPendentes },
        { icon: "🚜", l: "Ativos/Frota",    nav: "ativos",        c: "#ea580c" },
        { icon: "⛽", l: "Combustível",     nav: "frota",         c: "#dc7e00" },
        { icon: "🔧", l: "Manutenções",     nav: "manutencao",    c: "#dc2626" },
        { icon: "⚙️", l: "Equipamentos",   nav: "equip_gestao",  c: "#475569" },
        { icon: "🔨", l: "Ferramentas",     nav: "ferramentas",   c: "#7c2d12" },
        { icon: "🏪", l: "Fornecedores",    nav: "fornecedores",  c: "#16a34a" },
        { icon: "📥", l: "Recebimentos",    nav: "recebimento",   c: "#0891b2" },
      ],
    },
    {
      titulo: "📈 Análise & Comunicação",
      cor: "#a855f7",
      desc: "Relatórios e mensagens",
      itens: [
        { icon: "📐", l: "Produtividade",   nav: "produtividade", c: "#15803d" },
        { icon: "📈", l: "Consolidado",     nav: "consolidado",   c: "#a855f7" },
        { icon: "📓", l: "Diário Obra",     nav: "diario",        c: "#2563eb" },
        { icon: "💬", l: "Mensagens",       nav: "mensagens",     c: "#db2777", badge: novasMsgs },
      ],
    },
    {
      titulo: "⚙️ Sistema",
      cor: "#475569",
      desc: "Configurações e segurança",
      itens: [
        { icon: "👤", l: "Minha Conta",   nav: "minha_conta", c: "#0891b2" },
        { icon: "🆘", l: "Ajuda & Suporte", nav: "ajuda", c: "#16a34a" },
        { icon: "🔗", l: "Links Úteis",   nav: "links",   c: "#0284c7" },
        { icon: "🔑", l: "Usuários e Permissões", nav: "acessos", c: "#0891b2" },
        { icon: "🏢", l: "Empresa",       nav: "empresa", c: "#334155" },
        { icon: "💾", l: "Exportar Dados",        nav: "backup",  c: "#6b7280" },
        // Itens abaixo só aparecem para o desenvolvedor (Kleber)
        ...(usuario?.email === "kvmprojetos@gmail.com" ? [
          { icon: "🔧", l: "Painel Técnico",  nav: "diagnostico", c: "#dc2626" },
          { icon: "🎬", l: "Popular Demo",  nav: "gerar_simulacao", c: "#7c3aed" },
          { icon: "🧹", l: "Limpar Banco",    nav: "zerar_tudo", c: "#dc2626" },
        ] : []),
      ],
    },
  ];

  // Total de avisos pra mostrar no resumo
  const totalAvisos = totalAlertas + movPendentes + pendentes + novasMsgs;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader right={
        <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Sair</button>
      } />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {/* Saudação */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "12px 14px", marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 12, color: "#888" }}>Painel do Gestor</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>{usuario?.nome || "Gestor"}</div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>

        {/* Stats rápidas — CLICÁVEIS */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div onClick={() => onNav("obras")} style={{ flex: 1, background: BLUE, borderRadius: 12, padding: "10px 6px", textAlign: "center", cursor: "pointer", boxShadow: `0 3px 10px ${BLUE}40` }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{obras.filter(o => o.status === "Ativa").length}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)" }}>🏗️ Obras</div>
          </div>
          <div onClick={() => onNav("equipe")} style={{ flex: 1, background: ORANGE, borderRadius: 12, padding: "10px 6px", textAlign: "center", cursor: "pointer", boxShadow: `0 3px 10px ${ORANGE}40` }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{trabalhadores.length}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)" }}>👥 Equipe</div>
          </div>
          <div onClick={() => onNav("alertas")} style={{ flex: 1, background: totalAvisos > 0 ? RED : GREEN, borderRadius: 12, padding: "10px 6px", textAlign: "center", cursor: "pointer", boxShadow: `0 3px 10px ${totalAvisos > 0 ? RED + "40" : GREEN + "40"}` }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{totalAvisos}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)" }}>🚨 Avisos</div>
          </div>
        </div>

        {/* Atalhos rápidos (4 mais usados) */}
        <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>⚡ Acesso Rápido</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
          {[
            { icon: "📄", l: "RDO ABNT",       nav: "rdo",           c: GOLD },
            { icon: "💰", l: "Folha de Pagamento", nav: "folha_quinzenal", c: "#15803d" },
            { icon: "📋", l: "Cadastrar Ficha", nav: "ficha",         c: ORANGE },
            { icon: "🚨", l: "Alertas",         nav: "alertas",       c: totalAlertas > 0 ? RED : "#9ca3af", badge: totalAlertas },
          ].map(b => (
            <button key={b.nav} onClick={() => onNav(b.nav)} style={{ background: b.c, color: "#fff", border: "none", borderRadius: 14, padding: "16px 8px", cursor: "pointer", textAlign: "center", boxShadow: `0 4px 14px ${b.c}55`, position: "relative" }}>
              <div style={{ fontSize: 32 }}>{b.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4 }}>{b.l}</div>
              {b.badge > 0 && <div style={{ position: "absolute", top: 6, right: 8, background: "#fff", color: RED, borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 800 }}>{b.badge}</div>}
            </button>
          ))}
        </div>

        {/* TABELA RESUMO DA EQUIPE — padrão elite */}
        <TabelaResumoEquipe obras={obras} trabalhadores={trabalhadores} historico={historico} onNav={onNav} />

        {/* Categorias agrupadas */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          margin: "18px 0 10px",
          padding: "0 4px",
        }}>
          <div style={{ fontSize: 18 }}>📂</div>
          <div style={{
            fontSize: 12,
            color: NAVY,
            textTransform: "uppercase",
            letterSpacing: 1.5,
            fontWeight: 800,
          }}>Todas as Funções</div>
          <div style={{
            flex: 1,
            height: 1,
            background: "linear-gradient(90deg, rgba(15,33,81,0.15) 0%, transparent 100%)",
          }} />
          <div style={{ fontSize: 10, color: "#888", fontWeight: 600 }}>
            {categorias.length} categorias
          </div>
        </div>
        {categorias.map((cat, idx) => (
          <CategoriaCard key={idx} categoria={cat} onNav={onNav} />
        ))}

        {/* Pedidos pendentes resumo */}
        {pendentes > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              📦 Pedidos Aguardando Aprovação
              <span style={{ background: RED, color: "#fff", borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 800 }}>{pendentes}</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "#888", fontStyle: "italic" }}>👆 toque pra ver</span>
            </div>
            {pedidos.filter(p => p.status === "Aguardando").slice(0, 3).map(p => {
              const itens = p.itens || [{ material: p.material, qtd: p.qtd }];
              return (
                <div key={p.id} onClick={() => onNav("pedidos")} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer", transition: "all 0.2s", borderLeft: `4px solid ${ORANGE}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{p.obra}</div>
                      <div style={{ fontSize: 10, color: "#888" }}>👷 {p.enc} • {p.data} • <b style={{ color: NAVY }}>{itens.length} {itens.length === 1 ? "item" : "itens"}</b></div>
                      <div style={{ marginTop: 6, background: "#f9fafb", borderRadius: 6, padding: "6px 8px" }}>
                        {itens.slice(0, 3).map((it, i) => (
                          <div key={i} style={{ fontSize: 11, color: "#444" }}>• <b>{it.material}</b> — <span style={{ color: GREEN, fontWeight: 700 }}>{it.qtd}</span></div>
                        ))}
                        {itens.length > 3 && <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>+ {itens.length - 3} item(ns)...</div>}
                      </div>
                      {p.obsGeral && <div style={{ fontSize: 10, color: "#888", fontStyle: "italic", marginTop: 4 }}>📝 {p.obsGeral}</div>}
                    </div>
                    <span style={{ color: "#bbb", fontSize: 16 }}>›</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => onNegar(p.id)} style={{ flex: 1, padding: 8, borderRadius: 8, border: "none", background: RED, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 11 }}>✕ NEGAR</button>
                    <button onClick={() => abrirAprovacao(p)} style={{ flex: 2, padding: 8, borderRadius: 8, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 11 }}>✓ APROVAR</button>
                  </div>
                </div>
              );
            })}
            {pendentes > 3 && (
              <button onClick={() => onNav("pedidos")} style={{ width: "100%", padding: 10, borderRadius: 10, border: `1.5px solid ${NAVY}`, background: "#fff", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                Ver todos os {pendentes} pedidos →
              </button>
            )}
          </div>
        )}
      </div>
      <KMFooter />

      {/* MODAL APROVAÇÃO COM PAGAMENTO E PRAZO */}
      <Modal show={!!pedidoAprovando} title="✓ Aprovar Pedido" onClose={() => setPedidoAprovando(null)}>
        {pedidoAprovando && (() => {
          const itens = pedidoAprovando.itens || [{ material: pedidoAprovando.material, qtd: pedidoAprovando.qtd }];
          const obraDoPedido = obras.find(o => o.id === pedidoAprovando.obraId);
          return (
            <>
              <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "10px 12px", marginBottom: 12, borderLeft: `3px solid ${GREEN}` }}>
                <div style={{ fontSize: 11, color: "#166534", fontWeight: 700, marginBottom: 4 }}>📋 Pedido</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{pedidoAprovando.obra}</div>
                <div style={{ fontSize: 10, color: "#666", marginBottom: 6 }}>👷 {pedidoAprovando.enc} • {pedidoAprovando.data}</div>
                {itens.map((it, i) => (
                  <div key={i} style={{ fontSize: 11, color: "#444", paddingLeft: 8 }}>{i + 1}) <b>{it.material}</b> — <span style={{ color: GREEN, fontWeight: 700 }}>{it.qtd}</span></div>
                ))}
              </div>

              <div style={{ background: "#fef9e7", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 11, color: "#8b6f00" }}>
                💡 Preencha forma de pagamento e prazo para o fornecedor. Após aprovar, o app pergunta se você quer gerar a <b>Solicitação de Pedido de Compra</b> em PDF para enviar.
              </div>

              <label style={labelS}>💰 Forma de pagamento</label>
              <select value={formaPag} onChange={e => setFormaPag(e.target.value)} style={selS}>
                <option value="">— Selecione —</option>
                <option>À vista</option>
                <option>Boleto 7 dias</option>
                <option>Boleto 15 dias</option>
                <option>Boleto 30 dias</option>
                <option>30/60 dias</option>
                <option>30/60/90 dias</option>
                <option>Faturado mensal</option>
                <option>PIX antecipado</option>
                <option>A combinar</option>
              </select>

              <label style={labelS}>📅 Prazo de entrega</label>
              <input value={prazo} onChange={e => setPrazo(e.target.value)} placeholder="Ex: até 02/05/2026 ou 3 dias úteis" style={inputS} />

              {!obraDoPedido?.endereco && (
                <div style={{ background: "#fef2f2", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 11, color: RED }}>
                  ⚠️ Atenção: a obra <b>{pedidoAprovando.obra}</b> ainda não tem endereço completo cadastrado. Edite a obra para incluir endereço de entrega.
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setPedidoAprovando(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#eee", color: NAVY, fontWeight: 800, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
                <button onClick={confirmarAprovacao} style={{ flex: 2, padding: 12, borderRadius: 10, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 13 }}>✓ Aprovar Pedido</button>
              </div>
            </>
          );
        })()}
      </Modal>
    </div>
  );
}

// Card de categoria com expansão
function CategoriaCard({ categoria, onNav }) {
  const [aberto, setAberto] = useState(false);
  const totalBadges = categoria.itens.reduce((s, i) => s + (i.badge || 0), 0);

  // Separa emoji do título para destacar visualmente
  const tituloPartes = categoria.titulo.match(/^(\S+)\s+(.+)$/);
  const emoji = tituloPartes ? tituloPartes[1] : "";
  const nomeCategoria = tituloPartes ? tituloPartes[2] : categoria.titulo;

  // Converte hex para rgba (para gradiente sutil de fundo)
  const corRGBA = (hex, a) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  return (
    <div style={{
      background: "#fff",
      borderRadius: 14,
      marginBottom: 10,
      overflow: "hidden",
      boxShadow: aberto ? `0 4px 20px ${corRGBA(categoria.cor, 0.18)}` : "0 2px 8px rgba(0,0,0,0.06)",
      transition: "all 0.25s ease",
      border: aberto ? `1.5px solid ${corRGBA(categoria.cor, 0.3)}` : "1.5px solid transparent",
    }}>
      <button onClick={() => setAberto(!aberto)} style={{
        width: "100%",
        padding: "14px 16px",
        border: "none",
        background: aberto
          ? `linear-gradient(90deg, ${corRGBA(categoria.cor, 0.08)} 0%, transparent 100%)`
          : "#fff",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        textAlign: "left",
        borderBottom: aberto ? `1px solid ${corRGBA(categoria.cor, 0.15)}` : "none",
        transition: "background 0.25s ease",
      }}>
        {/* Ícone grande com fundo colorido */}
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${categoria.cor} 0%, ${corRGBA(categoria.cor, 0.7)} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          marginRight: 12,
          flexShrink: 0,
          boxShadow: `0 3px 10px ${corRGBA(categoria.cor, 0.35)}`,
        }}>
          {emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: NAVY, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
            {nomeCategoria}
            {totalBadges > 0 && (
              <span style={{
                background: RED,
                color: "#fff",
                borderRadius: 10,
                padding: "2px 8px",
                fontSize: 10,
                fontWeight: 800,
                boxShadow: `0 2px 6px ${RED}50`,
              }}>{totalBadges}</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
            {categoria.desc} <span style={{ color: categoria.cor, fontWeight: 700 }}>• {categoria.itens.length} opções</span>
          </div>
        </div>
        <span style={{
          color: categoria.cor,
          fontSize: 22,
          fontWeight: 700,
          transition: "transform 0.25s ease",
          transform: aberto ? "rotate(90deg)" : "rotate(0)",
          marginLeft: 4,
        }}>›</span>
      </button>
      {aberto && (
        <div style={{
          padding: 12,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          background: corRGBA(categoria.cor, 0.03),
        }}>
          {categoria.itens.map(b => (
            <button
              key={b.nav}
              onClick={() => onNav(b.nav)}
              style={{
                background: b.c,
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "14px 8px",
                cursor: "pointer",
                textAlign: "center",
                boxShadow: `0 3px 10px ${b.c}40`,
                position: "relative",
                gridColumn: b.destaque ? "span 2" : "span 1",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                minHeight: 76,
              }}
              onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
              onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
              onTouchStart={e => e.currentTarget.style.transform = "scale(0.97)"}
              onTouchEnd={e => e.currentTarget.style.transform = "scale(1)"}
            >
              <div style={{ fontSize: b.destaque ? 30 : 24 }}>{b.icon}</div>
              <div style={{ fontSize: b.destaque ? 13 : 12, fontWeight: 700, marginTop: 4 }}>{b.l}</div>
              {b.badge > 0 && (
                <div style={{
                  position: "absolute",
                  top: 6,
                  right: 8,
                  background: "#fff",
                  color: RED,
                  borderRadius: 10,
                  padding: "2px 7px",
                  fontSize: 10,
                  fontWeight: 800,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                }}>{b.badge}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════
   OBRAS (GESTOR)
════════════════════════════════════ */
function TelaObras({ obras, trabalhadores, ativos, equips, ferramentas, pedidos, abastecimentos, manutencoes, cronogramas, historico, recebimentos, rdosEmitidos, onBack, onAdd, onEditar, onRemover, onNav, onNavAnexos }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [obraSelecionada, setObraSelecionada] = useState(null);
  const [form, setForm] = useState({ nome: "", local: "", status: "Ativa", tipo: "Edificação" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const abrirNovo = () => { setEditandoId(null); setForm({ nome: "", local: "", status: "Ativa", tipo: "Edificação" }); setModal(true); };
  const abrirEdit = (o) => { setEditandoId(o.id); setForm(o); setModal(true); };
  const salvar = () => {
    if (!form.nome || !form.local) return;
    if (editandoId) onEditar({ ...form, id: editandoId });
    else onAdd({ id: Date.now(), ...form });
    setModal(false);
  };

  // Se uma obra está selecionada, mostra os detalhes
  if (obraSelecionada) {
    return <TelaObraDetalhe
      obra={obraSelecionada}
      trabalhadores={trabalhadores}
      ativos={ativos}
      equips={equips}
      ferramentas={ferramentas}
      pedidos={pedidos}
      abastecimentos={abastecimentos}
      manutencoes={manutencoes}
      cronogramas={cronogramas}
      historico={historico}
      recebimentos={recebimentos}
      rdosEmitidos={rdosEmitidos}
      onBack={() => setObraSelecionada(null)}
      onEditar={() => {
        // FIX: fechar tela de detalhe ANTES de abrir o modal
        // Antes: o modal abria mas ficava escondido atrás do detalhe
        const obraParaEditar = obraSelecionada;
        setObraSelecionada(null);
        // Pequeno delay para garantir que o detalhe fechou antes do modal abrir
        setTimeout(() => abrirEdit(obraParaEditar), 0);
      }}
      onNav={(destino) => {
        if (destino === "anexos_obra" && onNavAnexos) {
          onNavAnexos(obraSelecionada);
        } else if (onNav) {
          onNav(destino);
        }
      }}
    />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Obras" sub={`${obras.filter(o => o.status === "Ativa").length} ativas • Toque para ver detalhes`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {obras.map(o => {
          const nTrab = trabalhadores.filter(t => t.obraId === o.id).length;
          const nAtivos = (ativos || []).filter(a => a.obraId === o.id).length;
          const nPedidos = (pedidos || []).filter(p => p.obraId === o.id).length;
          const cron = (cronogramas || {})[o.id] || [];
          const progresso = cron.length > 0 ? Math.round(cron.reduce((s, e) => s + (e.progresso || 0), 0) / cron.length) : 0;
          return (
            <div key={o.id} onClick={() => setObraSelecionada(o)} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 10, borderLeft: `5px solid ${o.status === "Ativa" ? GREEN : "#ccc"}`, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 15 }}>{o.nome}</div>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>📍 {o.local}</div>
                  {progresso > 0 && (
                    <div style={{ marginTop: 8, marginBottom: 4 }}>
                      <div style={{ height: 5, background: "#eee", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: progresso + "%", height: "100%", background: progresso === 100 ? GREEN : ORANGE, transition: "width 0.3s" }}></div>
                      </div>
                      <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>📅 Cronograma: {progresso}%</div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <Badge label={o.status} color={o.status === "Ativa" ? GREEN : "#888"} small />
                    <Badge label={`👷 ${nTrab}`} color={BLUE} small />
                    {nAtivos > 0 && <Badge label={`🚜 ${nAtivos}`} color={ORANGE} small />}
                    {nPedidos > 0 && <Badge label={`📦 ${nPedidos}`} color="#7c3aed" small />}
                    {o.tipo && <Badge label={o.tipo === "Pavimentação" ? "🛣️ " + o.tipo : "🏢 " + o.tipo} color="#475569" small />}
                  </div>
                </div>
                <span style={{ color: "#bbb", fontSize: 24, marginLeft: 8 }}>›</span>
              </div>
            </div>
          );
        })}
        <Btn label="➕ Nova Obra" color={NAVY} onClick={abrirNovo} />
      </div>
      <KMFooter />
      <Modal show={modal} title={editandoId ? "Editar Obra" : "Nova Obra"} onClose={() => setModal(false)}>
        <label style={labelS}>Nome da Obra</label>
        <input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: Residencial Paraíso" style={inputS} />

        <label style={labelS}>Cidade / UF</label>
        <input value={form.local} onChange={e => set("local", e.target.value)} placeholder="Ex: Alegre - ES" style={inputS} />

        <label style={labelS}>📍 Endereço completo de entrega</label>
        <input value={form.endereco || ""} onChange={e => set("endereco", e.target.value)} placeholder="Rua, número, bairro" style={inputS} />

        <label style={labelS}>🚩 Ponto de referência (opcional)</label>
        <input value={form.refLocal || ""} onChange={e => set("refLocal", e.target.value)} placeholder="Ex: Próximo ao posto, esquina com farmácia" style={inputS} />

        <div style={{ background: "#f0f7ff", borderRadius: 10, padding: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#0c4a6e", fontWeight: 700, marginBottom: 4 }}>📡 Localização GPS (opcional)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input value={form.lat || ""} onChange={e => set("lat", e.target.value)} placeholder="Latitude" type="number" step="any" style={{ ...inputS, marginBottom: 0, fontSize: 12 }} />
            <input value={form.lng || ""} onChange={e => set("lng", e.target.value)} placeholder="Longitude" type="number" step="any" style={{ ...inputS, marginBottom: 0, fontSize: 12 }} />
          </div>
          <button onClick={() => {
            if (!navigator.geolocation) { alert("Geolocalização não disponível"); return; }
            navigator.geolocation.getCurrentPosition(
              p => { set("lat", p.coords.latitude.toFixed(6)); set("lng", p.coords.longitude.toFixed(6)); },
              () => alert("Não foi possível obter a localização"),
              { enableHighAccuracy: true }
            );
          }} style={{ width: "100%", marginTop: 6, padding: 8, background: BLUE, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>📡 Capturar localização atual</button>
        </div>

        <label style={labelS}>Tipo de Obra</label>
        <select value={form.tipo || "Edificação"} onChange={e => set("tipo", e.target.value)} style={selS}>
          <option>Edificação</option><option>Pavimentação</option><option>Drenagem</option><option>Reforma</option><option>Outra</option>
        </select>

        {/* ════ CONTRATO DA OBRA ════ */}
        <div style={{ background: "#fff7e6", border: `1px solid ${GOLD}30`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#8a6d1a", letterSpacing: 1, marginBottom: 8 }}>📋 CONTRATO DA OBRA</div>

          <label style={labelS}>Cliente / Contratante</label>
          <input
            value={form.cliente || ""}
            onChange={e => set("cliente", e.target.value)}
            placeholder="Nome do cliente ou empresa contratante"
            style={inputS}
          />

          <label style={labelS}>CNPJ / CPF do contratante (opcional)</label>
          <input
            value={form.clienteDoc || ""}
            onChange={e => set("clienteDoc", e.target.value)}
            placeholder="00.000.000/0000-00 ou 000.000.000-00"
            style={inputS}
          />

          <label style={labelS}>💰 Valor do Contrato (R$)</label>
          <input
            value={form.valorContrato || ""}
            onChange={e => set("valorContrato", e.target.value)}
            type="number"
            step="0.01"
            placeholder="Ex: 250000.00"
            style={inputS}
          />
          {form.valorContrato && parseFloat(form.valorContrato) > 0 && (
            <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, marginTop: -8, marginBottom: 12 }}>
              ✓ R$ {parseFloat(form.valorContrato).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          )}

          <label style={labelS}>📅 Data de início do contrato</label>
          <input
            type="date"
            value={form.dataInicioContrato || ""}
            onChange={e => set("dataInicioContrato", e.target.value)}
            style={{ ...inputS, boxSizing: "border-box", width: "100%" }}
          />

          <label style={labelS}>🏁 Prazo final do contrato</label>
          <input
            type="date"
            value={form.dataFimContrato || ""}
            onChange={e => set("dataFimContrato", e.target.value)}
            style={{ ...inputS, boxSizing: "border-box", width: "100%" }}
          />

          <label style={labelS}>Forma de Pagamento</label>
          <select value={form.formaPagContrato || "À vista"} onChange={e => set("formaPagContrato", e.target.value)} style={selS}>
            <option>À vista</option>
            <option>Parcelado em medições</option>
            <option>Empreitada total</option>
            <option>Por etapas</option>
            <option>Mensal</option>
            <option>Outra</option>
          </select>

          <label style={labelS}>Observações do contrato (opcional)</label>
          <textarea
            value={form.obsContrato || ""}
            onChange={e => set("obsContrato", e.target.value)}
            rows={2}
            placeholder="Cláusulas especiais, garantias, multas, retenções..."
            style={{ ...inputS, fontFamily: "inherit", resize: "none" }}
          />
        </div>

        <label style={labelS}>Status</label>
        <select value={form.status} onChange={e => set("status", e.target.value)} style={selS}>
          <option>Ativa</option><option>Pausada</option><option>Concluída</option>
        </select>

        {editandoId && (
          <button onClick={() => { confirmar(`Remover ${form.nome}? Esta ação não pode ser desfeita.`, () => { onRemover(editandoId); setModal(false); }) }} style={{ width: "100%", padding: 10, background: "#fef2f2", color: RED, border: `1px solid ${RED}33`, borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 12, marginBottom: 8 }}>🗑️ Excluir Obra</button>
        )}
        <Btn label={editandoId ? "SALVAR" : "ADICIONAR"} color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   DETALHE DA OBRA — tudo relacionado
════════════════════════════════════ */
function TelaObraDetalhe({ obra, trabalhadores, ativos, equips, ferramentas, pedidos, abastecimentos, manutencoes, cronogramas, historico, recebimentos, rdosEmitidos, onBack, onEditar, onNav }) {
  const trabObra = trabalhadores.filter(t => t.obraId === obra.id);
  const ativosObra = (ativos || []).filter(a => a.obraId === obra.id);
  const equipsObra = (equips || []).filter(e => e.obraId === obra.id);
  const ferramentasObra = (ferramentas || []).filter(f => f.obraId === obra.id);
  const pedidosObra = (pedidos || []).filter(p => p.obraId === obra.id);
  const abastObra = (abastecimentos || []).filter(a => a.obraId === obra.id);
  const manutObra = (manutencoes || []).filter(m => m.obraId === obra.id || ativosObra.some(a => a.id == m.itemId && m.tipoItem === "ativo"));
  const recebObra = (recebimentos || []).filter(r => r.obraId === obra.id);
  const rdosObra = (rdosEmitidos || []).filter(r => r.obraId === obra.id);
  const cron = (cronogramas || {})[obra.id] || [];
  const progresso = cron.length > 0 ? Math.round(cron.reduce((s, e) => s + (e.progresso || 0), 0) / cron.length) : 0;

  // Cálculos do mês
  const hoje = new Date();
  const mes = hoje.getMonth();
  const ano = hoje.getFullYear();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  let totalCustoMaoObra = 0;
  let diasTrabalhados = 0;
  trabObra.forEach(t => {
    let dias = 0;
    for (let d = 1; d <= totalDias; d++) {
      const iso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const s = (historico[iso] || {})[t.id];
      if (s === "Presente" || s === "Atestado") dias++;
    }
    totalCustoMaoObra += dias * (parseFloat(t.diaria) || 0);
    diasTrabalhados += dias;
  });

  const totalCombustivel = abastObra.filter(a => {
    if (!a.data) return false;
    try { const [d, m, y] = a.data.split("/"); return parseInt(m) - 1 === mes && parseInt(y) === ano; } catch { return false; }
  }).reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);

  // Custo de alimentação do mês — soma de todos os RDOs da obra no mês
  const totalAlimentacaoMes = rdosObra.filter(r => {
    if (!r.data) return false;
    try { const [d, m, y] = r.data.split("/"); return parseInt(m) - 1 === mes && parseInt(y) === ano; } catch { return false; }
  }).reduce((s, r) => s + (parseFloat(r.totalAlimentacao) || 0), 0);

  const totalMaterialAprov = pedidosObra.filter(p => p.status === "Aprovado" && p.data && p.data.includes(`/${String(mes + 1).padStart(2, "0")}/${ano}`)).length * 100;
  const custoTotalMes = totalCustoMaoObra + totalCombustivel + totalMaterialAprov + totalAlimentacaoMes;

  const Secao = ({ titulo, icone, valor, cor, onClickAcao, acaoLabel, children }) => (
    <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 20, marginRight: 8 }}>{icone}</div>
        <div style={{ flex: 1, fontWeight: 800, color: NAVY, fontSize: 13 }}>{titulo}</div>
        {valor !== undefined && <div style={{ background: cor, color: "#fff", padding: "3px 10px", borderRadius: 6, fontWeight: 800, fontSize: 12 }}>{valor}</div>}
      </div>
      {children}
      {onClickAcao && (
        <button onClick={onClickAcao} style={{ width: "100%", marginTop: 8, padding: 8, background: "#f3f4f6", color: NAVY, border: "none", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{acaoLabel} →</button>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title={obra.nome} sub="Detalhes completos" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* CABEÇALHO DA OBRA */}
        <div style={{ background: `linear-gradient(135deg,${NAVY},${NAVY2})`, color: "#fff", borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{obra.tipo === "Pavimentação" ? "🛣️" : "🏢"} {obra.nome}</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>📍 {obra.local} • {obra.status}</div>
            </div>
            <button onClick={onEditar} style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️ Editar</button>
          </div>
          {cron.length > 0 && (
            <>
              <div style={{ fontSize: 10, opacity: 0.85, marginTop: 4 }}>Progresso do cronograma</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.2)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: progresso + "%", height: "100%", background: GOLD, transition: "width 0.3s" }}></div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, color: GOLD }}>{progresso}%</div>
              </div>
            </>
          )}
        </div>

        {/* CARD CONTRATO (só aparece se tem valor cadastrado) */}
        {obra.valorContrato && parseFloat(obra.valorContrato) > 0 && (
          <div style={{
            background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY2} 100%)`,
            borderRadius: 14, padding: 14, marginBottom: 12,
            color: "#fff", boxShadow: "0 4px 14px rgba(15,33,81,0.3)",
            border: `2px solid ${GOLD}`,
          }}>
            <div style={{ fontSize: 10, color: GOLD, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 800, marginBottom: 4 }}>📋 CONTRATO DA OBRA</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 6 }}>
              R$ {parseFloat(obra.valorContrato).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            {obra.cliente && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", marginBottom: 6 }}>
                👤 <b>{obra.cliente}</b>{obra.clienteDoc && <span style={{ opacity: 0.7 }}> · {obra.clienteDoc}</span>}
              </div>
            )}
            {(obra.dataInicioContrato || obra.dataFimContrato) && (
              <div style={{ display: "flex", gap: 10, fontSize: 11, color: "rgba(255,255,255,0.85)", marginBottom: 4 }}>
                {obra.dataInicioContrato && <span>📅 Início: <b>{new Date(obra.dataInicioContrato + "T12:00:00").toLocaleDateString("pt-BR")}</b></span>}
                {obra.dataFimContrato && <span>🏁 Prazo: <b>{new Date(obra.dataFimContrato + "T12:00:00").toLocaleDateString("pt-BR")}</b></span>}
              </div>
            )}
            {/* Margem estimada (Valor contrato - custo do mês × meses estimados) */}
            {(() => {
              const valor = parseFloat(obra.valorContrato);
              if (custoTotalMes > 0 && obra.dataInicioContrato && obra.dataFimContrato) {
                const ini = new Date(obra.dataInicioContrato + "T12:00:00");
                const fim = new Date(obra.dataFimContrato + "T12:00:00");
                const mesesObra = Math.max(1, Math.round((fim - ini) / (1000 * 60 * 60 * 24 * 30)));
                const custoTotalProjetado = custoTotalMes * mesesObra;
                const margem = valor - custoTotalProjetado;
                const margemPct = (margem / valor) * 100;
                return (
                  <div style={{ marginTop: 8, background: "rgba(0,0,0,0.2)", padding: "6px 10px", borderRadius: 8, fontSize: 11 }}>
                    💼 Margem estimada: <b style={{ color: margem > 0 ? "#10b981" : "#ef4444" }}>R$ {margem.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b> ({margemPct.toFixed(1)}%)
                    <div style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>Estimativa baseada no custo do mês × {mesesObra} mês(es) de obra</div>
                  </div>
                );
              }
              return null;
            })()}
            {obra.formaPagContrato && (
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>💳 Pagamento: {obra.formaPagContrato}</div>
            )}
          </div>
        )}

        {/* RESUMO FINANCEIRO DO MÊS */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>💰 CUSTO ESTIMADO DO MÊS</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: GREEN, marginBottom: 10 }}>R$ {custoTotalMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div style={{ background: "#f0fdf4", padding: 8, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#888" }}>👷 Mão de obra</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: GREEN }}>R$ {totalCustoMaoObra.toFixed(2)}</div>
              <div style={{ fontSize: 9, color: "#888" }}>{diasTrabalhados} dias</div>
            </div>
            <div style={{ background: "#fff8f0", padding: 8, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#888" }}>⛽ Combustível</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: ORANGE }}>R$ {totalCombustivel.toFixed(2)}</div>
            </div>
            <div style={{ background: "#fef9e7", padding: 8, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#888" }}>☕ Alimentação</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#dc7e00" }}>R$ {totalAlimentacaoMes.toFixed(2)}</div>
            </div>
            <div style={{ background: "#f0f7ff", padding: 8, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#888" }}>📦 Materiais (est.)</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: BLUE }}>R$ {totalMaterialAprov.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* EQUIPE */}
        <Secao titulo="Equipe nesta obra" icone="👷" valor={trabObra.length} cor={BLUE} onClickAcao={() => onNav && onNav("equipe")} acaoLabel="Ver todos">
          {trabObra.length === 0 ? (
            <div style={{ color: "#aaa", fontSize: 12, fontStyle: "italic", padding: 6 }}>Sem equipe alocada.</div>
          ) : trabObra.slice(0, 5).map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f3f4f6" }}>
              {t.foto ? (
                <img src={t.foto} alt="" style={{ width: 28, height: 28, borderRadius: 14, objectFit: "cover", marginRight: 8 }} />
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: 14, background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, marginRight: 8 }}>👷</div>
              )}
              <div style={{ flex: 1, fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: NAVY }}>{t.nome}</div>
                <div style={{ fontSize: 10, color: "#888" }}>{t.cargo}</div>
              </div>
              {t.diaria && <div style={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>R$ {t.diaria}/dia</div>}
            </div>
          ))}
          {trabObra.length > 5 && <div style={{ fontSize: 11, color: "#888", textAlign: "center", padding: 4 }}>... e mais {trabObra.length - 5}</div>}
        </Secao>

        {/* ATIVOS / FROTA */}
        {ativosObra.length > 0 && (
          <Secao titulo="Ativos e Frota" icone="🚜" valor={ativosObra.length} cor={ORANGE} onClickAcao={() => onNav && onNav("ativos")} acaoLabel="Gerenciar">
            {ativosObra.map(a => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f3f4f6", fontSize: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, color: NAVY }}>{a.nome}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>{a.placa || a.tipo}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 10, color: "#666" }}>
                  {a.horimetro && <div>{a.horimetro}h</div>}
                  <div style={{ color: GREEN, fontWeight: 700 }}>R$ {(a.valorHora || 0)}/h</div>
                </div>
              </div>
            ))}
          </Secao>
        )}

        {/* EQUIPAMENTOS */}
        {equipsObra.length > 0 && (
          <Secao titulo="Equipamentos" icone="⚙️" valor={equipsObra.length} cor="#475569" onClickAcao={() => onNav && onNav("equip_gestao")} acaoLabel="Gerenciar">
            {equipsObra.slice(0, 5).map(e => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f3f4f6", fontSize: 12 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 16, marginRight: 6 }}>{e.icon || "⚙️"}</span>
                  <span style={{ fontWeight: 600, color: NAVY }}>{e.nome}</span>
                  <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>{e.codigo}</span>
                </div>
                <Badge label={e.status} color={EQUIP_COLOR[e.status]} small />
              </div>
            ))}
            {equipsObra.length > 5 && <div style={{ fontSize: 11, color: "#888", textAlign: "center", padding: 4 }}>... e mais {equipsObra.length - 5}</div>}
          </Secao>
        )}

        {/* PEDIDOS DE MATERIAL */}
        {pedidosObra.length > 0 && (
          <Secao titulo="Pedidos de Material" icone="📦" valor={pedidosObra.length} cor="#7c3aed">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 4 }}>
              <div style={{ background: "#f0fdf4", padding: 6, borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: GREEN }}>{pedidosObra.filter(p => p.status === "Aprovado").length}</div>
                <div style={{ fontSize: 9, color: "#666" }}>Aprovados</div>
              </div>
              <div style={{ background: "#fff8f0", padding: 6, borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: ORANGE }}>{pedidosObra.filter(p => p.status === "Aguardando").length}</div>
                <div style={{ fontSize: 9, color: "#666" }}>Aguardando</div>
              </div>
              <div style={{ background: "#fef2f2", padding: 6, borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: RED }}>{pedidosObra.filter(p => p.status === "Negado").length}</div>
                <div style={{ fontSize: 9, color: "#666" }}>Negados</div>
              </div>
            </div>
          </Secao>
        )}

        {/* ANEXOS */}
        <Secao titulo="Anexos" icone="📎" valor="" cor="#0891b2" onClickAcao={() => onNav && onNav("anexos_obra")} acaoLabel="Gerenciar anexos">
          <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5 }}>
            Projetos, contratos, ART/RRT, planilhas, licenças e demais documentos da obra.
          </div>
        </Secao>

        {/* CRONOGRAMA */}
        {cron.length > 0 ? (
          <Secao titulo="Cronograma" icone="📅" valor={`${progresso}%`} cor="#7c3aed" onClickAcao={() => onNav && onNav("cronograma")} acaoLabel="Editar cronograma">
            {cron.slice(0, 5).map((e, i) => {
              const cor = e.progresso === 100 ? GREEN : e.progresso > 0 ? ORANGE : "#aaa";
              return (
                <div key={e.id} style={{ display: "flex", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #f3f4f6", fontSize: 12 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 11, background: cor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 10, marginRight: 8 }}>{i + 1}</div>
                  <div style={{ flex: 1, color: NAVY, fontSize: 11 }}>{e.nome}</div>
                  <div style={{ fontSize: 10, color: cor, fontWeight: 700 }}>{e.progresso || 0}%</div>
                </div>
              );
            })}
            {cron.length > 5 && <div style={{ fontSize: 11, color: "#888", textAlign: "center", padding: 4 }}>... e mais {cron.length - 5} etapas</div>}
          </Secao>
        ) : (
          <Secao titulo="Cronograma" icone="📅" valor="—" cor="#aaa" onClickAcao={() => onNav && onNav("cronograma")} acaoLabel="Criar cronograma">
            <div style={{ color: "#aaa", fontSize: 11, fontStyle: "italic" }}>Cronograma ainda não criado.</div>
          </Secao>
        )}

        {/* RDOs */}
        {rdosObra.length > 0 && (
          <Secao titulo="RDOs Emitidos" icone="📄" valor={rdosObra.length} cor={BLUE} onClickAcao={() => onNav && onNav("rdo")} acaoLabel="Ver todos">
            {rdosObra.slice(0, 3).map(r => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f3f4f6", fontSize: 12 }}>
                <div>
                  <span style={{ fontWeight: 600, color: NAVY }}>RDO Nº {String(r.numero).padStart(3, "0")}</span>
                  {r.autoGerado && <span style={{ fontSize: 9, color: GREEN, fontWeight: 700, marginLeft: 6 }}>⚡ AUTO</span>}
                </div>
                <span style={{ fontSize: 11, color: "#666" }}>{r.data}</span>
              </div>
            ))}
          </Secao>
        )}

        {/* MANUTENÇÕES */}
        {manutObra.length > 0 && (
          <Secao titulo="Manutenções" icone="🔧" valor={manutObra.filter(m => !m.realizada).length} cor={RED} onClickAcao={() => onNav && onNav("manutencao")} acaoLabel="Gerenciar">
            <div style={{ fontSize: 11, color: "#666" }}>
              {manutObra.filter(m => !m.realizada).length} pendente(s) • {manutObra.filter(m => m.realizada).length} concluída(s)
            </div>
          </Secao>
        )}

      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   EQUIPE (GESTOR)
════════════════════════════════════ */
function TelaEquipe({ obras, trabalhadores, usuarios = [], onBack, onAdd, onRemove, onVerDetalhe, onEditar }) {
  const [modal, setModal] = useState(false);
  const [filtroObra, setFiltroObra] = useState("todas");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos"); // todos | aso_vencido | sem_epi | inapto
  const [form, setForm] = useState({ nome: "", cargo: "", obraId: "", cpf: "", tel: "", diaria: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const checaASO = (t) => {
    if (!t.asoValidade) return { vencido: false, vencendo: false, dias: null };
    try {
      const v = new Date(t.asoValidade);
      const dias = Math.ceil((v - new Date()) / (1000 * 60 * 60 * 24));
      return { vencido: dias < 0, vencendo: dias >= 0 && dias <= 30, dias };
    } catch { return { vencido: false, vencendo: false, dias: null }; }
  };

  const lista = trabalhadores
    .filter(t => filtroObra === "todas" || t.obraId === parseInt(filtroObra))
    .filter(t => !busca || t.nome.toLowerCase().includes(busca.toLowerCase()) || (t.cargo || "").toLowerCase().includes(busca.toLowerCase()))
    .filter(t => {
      if (filtroStatus === "todos") return true;
      const aso = checaASO(t);
      if (filtroStatus === "aso_vencido") return aso.vencido || aso.vencendo;
      if (filtroStatus === "sem_epi") return !t.epiEntregue;
      if (filtroStatus === "inapto") return t.asoStatus === "Inapto" || t.asoStatus === "Apto com restrições";
      return true;
    });

  const totalAsoVencido = trabalhadores.filter(t => { const a = checaASO(t); return a.vencido || a.vencendo; }).length;
  const totalSemEPI = trabalhadores.filter(t => !t.epiEntregue).length;
  const totalInapto = trabalhadores.filter(t => t.asoStatus === "Inapto" || t.asoStatus === "Apto com restrições").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Equipe" sub={`${trabalhadores.length} trabalhador(es)`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 12 }}>

        {/* Indicadores rápidos clicáveis (filtros) */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button onClick={() => setFiltroStatus("todos")} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: filtroStatus === "todos" ? `2px solid ${NAVY}` : "1px solid #dde2ef", background: filtroStatus === "todos" ? "#dde6f5" : "#fff", cursor: "pointer" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>{trabalhadores.length}</div>
            <div style={{ fontSize: 9, color: "#666" }}>Todos</div>
          </button>
          <button onClick={() => setFiltroStatus(filtroStatus === "aso_vencido" ? "todos" : "aso_vencido")} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: filtroStatus === "aso_vencido" ? `2px solid ${RED}` : "1px solid #dde2ef", background: filtroStatus === "aso_vencido" ? "#fef2f2" : "#fff", cursor: "pointer" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: totalAsoVencido > 0 ? RED : "#888" }}>{totalAsoVencido}</div>
            <div style={{ fontSize: 9, color: "#666" }}>ASO 30d</div>
          </button>
          <button onClick={() => setFiltroStatus(filtroStatus === "sem_epi" ? "todos" : "sem_epi")} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: filtroStatus === "sem_epi" ? `2px solid ${ORANGE}` : "1px solid #dde2ef", background: filtroStatus === "sem_epi" ? "#fff8f0" : "#fff", cursor: "pointer" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: totalSemEPI > 0 ? ORANGE : "#888" }}>{totalSemEPI}</div>
            <div style={{ fontSize: 9, color: "#666" }}>S/ EPI</div>
          </button>
          <button onClick={() => setFiltroStatus(filtroStatus === "inapto" ? "todos" : "inapto")} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: filtroStatus === "inapto" ? `2px solid ${RED}` : "1px solid #dde2ef", background: filtroStatus === "inapto" ? "#fef2f2" : "#fff", cursor: "pointer" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: totalInapto > 0 ? RED : "#888" }}>{totalInapto}</div>
            <div style={{ fontSize: 9, color: "#666" }}>Inapto</div>
          </button>
        </div>

        <div style={{ position: "relative", marginBottom: 8 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>🔍</span>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou cargo..." style={{ ...inputS, paddingLeft: 38, marginBottom: 0 }} />
        </div>
        <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ ...selS, marginBottom: 12, marginTop: 8 }}>
          <option value="todas">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        {lista.map(t => {
          const obra = obras.find(o => o.id === t.obraId);
          const aso = checaASO(t);
          const indicadores = [];
          // Indicador: tem conta de login no sistema
          const temLogin = usuarios.some(u => u.nome.toLowerCase().trim() === t.nome.toLowerCase().trim() && u.perfil !== "gestor");
          if (temLogin) indicadores.push({ icon: "🔑", label: "Tem login", cor: BLUE });
          if (aso.vencido) indicadores.push({ icon: "🏥", label: `ASO vencido`, cor: RED });
          else if (aso.vencendo) indicadores.push({ icon: "🏥", label: `ASO em ${aso.dias}d`, cor: ORANGE });
          if (!t.epiEntregue) indicadores.push({ icon: "👕", label: "Sem EPI", cor: ORANGE });
          if (t.asoStatus === "Inapto") indicadores.push({ icon: "❌", label: "Inapto", cor: RED });
          else if (t.asoStatus === "Apto com restrições") indicadores.push({ icon: "⚠️", label: "Restrições", cor: ORANGE });

          return (
            <div key={t.id} onClick={() => onVerDetalhe && onVerDetalhe(t)} style={{ background: "#fff", borderRadius: 12, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer" }}>
              {t.foto ? (
                <img src={t.foto} alt="" style={{ width: 44, height: 44, borderRadius: 22, objectFit: "cover", border: `2px solid ${NAVY}`, marginRight: 10, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 22, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginRight: 10, flexShrink: 0, color: "#fff" }}>👷</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nome}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{t.cargo} • {obra ? obra.nome : "-"}</div>
                {indicadores.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                    {indicadores.map((i, idx) => (
                      <span key={idx} style={{ background: i.cor + "22", color: i.cor, padding: "2px 6px", borderRadius: 6, fontSize: 9, fontWeight: 700 }}>{i.icon} {i.label}</span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onPointerDown={(e) => { e.stopPropagation(); }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Confirmação simples e direta — sem confirm() nativo
                  confirmar(`Remover ${t.nome}?\n\nEsta ação não pode ser desfeita.`, () => {
                    onRemove(t.id);
                  });
                }}
                style={{
                  background: "#fee2e2",
                  border: `2px solid ${RED}`,
                  color: RED,
                  fontSize: 18,
                  cursor: "pointer",
                  marginRight: 6,
                  borderRadius: 8,
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "rgba(214,59,59,0.3)",
                  flexShrink: 0,
                }}
              >🗑️</button>
              <span style={{ color: "#ccc", fontSize: 18 }}>›</span>
            </div>
          );
        })}
        {lista.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: 20 }}>Nenhum resultado.</div>}
        <Btn label="➕ Adicionar Trabalhador" color={NAVY} onClick={() => setModal(true)} style={{ marginTop: 8 }} />
      </div>
      <KMFooter />
      <Modal show={modal} title="Novo Trabalhador" onClose={() => setModal(false)}>
        {[{ l: "Nome Completo", k: "nome", p: "Nome" }, { l: "CPF", k: "cpf", p: "000.000.000-00" }, { l: "Telefone", k: "tel", p: "(27) 9 0000-0000" }, { l: "💰 Diária (R$/dia)", k: "diaria", p: "100" }].map(f => (
          <div key={f.k}><label style={labelS}>{f.l}</label><input value={form[f.k]} onChange={e => set(f.k, e.target.value)} placeholder={f.p} style={inputS} /></div>
        ))}
        <label style={labelS}>Cargo</label>
        <select value={form.cargo} onChange={e => set("cargo", e.target.value)} style={selS}>
          <option value="">Selecione</option>
          {CARGOS.map(c => <option key={c}>{c}</option>)}
        </select>
        <label style={labelS}>Obra</label>
        <select value={form.obraId} onChange={e => set("obraId", parseInt(e.target.value))} style={selS}>
          <option value="">Selecione a obra</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ background: "#fffaeb", borderRadius: 8, padding: "10px 12px", fontSize: 11, color: "#8b6f00", marginBottom: 10, lineHeight: 1.5 }}>
          💡 Esta tela cadastra <b>trabalhador</b> (folha, presença, frequência).<br/>
          Pra dar <b>acesso ao app</b> (login do encarregado), vá em <b>⚙️ Sistema → 🔑 Acessos do App</b>.
        </div>
        <Btn label="SALVAR" color={GREEN} onClick={() => {
          if (!form.nome || !form.cargo || !form.obraId) return;
          const novo = { id: Date.now(), nome: form.nome, cargo: form.cargo, obraId: form.obraId, cpf: form.cpf, tel: form.tel, diaria: form.diaria };
          onAdd(novo, null); // sempre sem login — é só pra folha
          setModal(false);
          setForm({ nome: "", cargo: "", obraId: "", cpf: "", tel: "", diaria: "" });
        }} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   FICHA CADASTRAL
════════════════════════════════════ */
function TelaFicha({ obras, onBack, onAdd }) {
  const [form, setForm] = useState({
    nome: "", cpf: "", rg: "", nasc: "", tel: "", cargo: "", obraId: "", inicio: "",
    diaria: "",
    tamCamisa: "", tamCalca: "", tamBota: "", tamLuva: "", tamCapacete: "",
    epiEntregue: false, epiData: "",
    foto: null,
    asoData: "", asoValidade: "", asoStatus: "Apto",
    docCtps: null, docCpf: null, docComprov: null,
  });
  const [salvo, setSalvo] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Sugerir diária por cargo
  const SUGESTAO_DIARIA = {
    "Auxiliar": "90", "Servente": "90",
    "Pedreiro": "150", "Carpinteiro": "150", "Pintor": "140", "Armador": "140", "Azulejista": "150",
    "Eletricista": "180", "Encanador": "180",
    "Encarregado": "200", "Mestre de Obras": "220",
    "Encarregado / Operador Retroescavadeira": "250",
    "Operador de Máquina": "200", "Motorista": "150", "Vigia": "100",
  };

  const aplicarSugestao = () => {
    if (form.cargo && SUGESTAO_DIARIA[form.cargo] && !form.diaria) {
      set("diaria", SUGESTAO_DIARIA[form.cargo]);
    }
  };

  const handleFoto = (e, campo) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set(campo, ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Ficha Cadastral" sub="Novo Colaborador" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {salvo ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 64 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: GREEN, marginTop: 12 }}>Ficha Salva!</div>
            <div style={{ color: "#666", marginTop: 6, fontSize: 13 }}>{form.nome} cadastrado com sucesso.</div>
            <Btn label="Nova Ficha" color={NAVY} onClick={() => { setSalvo(false); setForm({ nome: "", cpf: "", rg: "", nasc: "", tel: "", cargo: "", obraId: "", inicio: "", diaria: "", tamCamisa: "", tamCalca: "", tamBota: "", tamLuva: "", tamCapacete: "", epiEntregue: false, epiData: "", foto: null, asoData: "", asoValidade: "", asoStatus: "Apto", docCtps: null, docCpf: null, docComprov: null }); }} style={{ marginTop: 24 }} />
            <Btn label="Voltar" color="#eee" text={NAVY} onClick={onBack} style={{ marginTop: 10 }} />
          </div>
        ) : (
          <>
            {/* FOTO DO ROSTO */}
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              {form.foto ? (
                <div style={{ position: "relative", display: "inline-block" }}>
                  <img src={form.foto} alt="" style={{ width: 96, height: 96, borderRadius: 48, objectFit: "cover", border: `3px solid ${NAVY}` }} />
                  <button onClick={() => set("foto", null)} style={{ position: "absolute", top: 0, right: 0, background: RED, color: "#fff", border: "none", borderRadius: 14, width: 28, height: 28, fontSize: 14, cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>✕</button>
                </div>
              ) : (
                <div style={{ width: 96, height: 96, borderRadius: 48, background: "#dde6f5", border: `3px solid ${NAVY}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 42 }}>👤</div>
              )}
              <div style={{ marginTop: 8 }}>
                <label style={{ background: "#eef2ff", border: "none", borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 700, color: NAVY, cursor: "pointer", display: "inline-block" }}>
                  📷 {form.foto ? "Trocar Foto" : "Tirar Foto"}
                  <input type="file" accept="image/*" capture="user" onChange={(e) => handleFoto(e, "foto")} style={{ display: "none" }} />
                </label>
              </div>
            </div>

            {/* DADOS PESSOAIS */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>👤 Dados Pessoais</div>
              {[{ l: "Nome Completo", k: "nome", p: "Nome completo" }, { l: "CPF", k: "cpf", p: "000.000.000-00" }, { l: "RG", k: "rg", p: "00.000.000-0" }, { l: "Data de Nascimento", k: "nasc", p: "DD/MM/AAAA" }, { l: "Telefone / WhatsApp", k: "tel", p: "(27) 9 0000-0000" }].map(f => (
                <div key={f.k}><label style={labelS}>{f.l}</label><input value={form[f.k]} onChange={e => set(f.k, e.target.value)} placeholder={f.p} style={inputS} /></div>
              ))}
            </div>

            {/* CONTRATUAIS */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>💼 Informações Contratuais</div>
              <label style={labelS}>Cargo / Função</label>
              <select value={form.cargo} onChange={e => { set("cargo", e.target.value); setTimeout(aplicarSugestao, 0); }} style={selS}>
                <option value="">Selecione</option>
                {CARGOS.map(c => <option key={c}>{c}</option>)}
              </select>
              <label style={labelS}>Obra Atual</label>
              <select value={form.obraId} onChange={e => set("obraId", parseInt(e.target.value))} style={selS}>
                <option value="">Selecione a obra</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
              <label style={labelS}>Data de Início</label>
              <input value={form.inicio} onChange={e => set("inicio", e.target.value)} type="date" style={inputS} />
              <label style={labelS}>💰 Valor da Diária (R$/dia)</label>
              <input value={form.diaria} onChange={e => set("diaria", e.target.value)} type="number" placeholder="Ex: 100" style={inputS} />
              {form.cargo && SUGESTAO_DIARIA[form.cargo] && !form.diaria && (
                <button onClick={() => set("diaria", SUGESTAO_DIARIA[form.cargo])} style={{ background: "#dde6f5", color: NAVY, border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>
                  💡 Usar sugestão para {form.cargo}: R$ {SUGESTAO_DIARIA[form.cargo]}
                </button>
              )}
              {form.diaria && (
                <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: GREEN, fontWeight: 600 }}>
                  💰 Diária: R$ {parseFloat(form.diaria).toFixed(2)} • Quinzena cheia (10 dias úteis): R$ {(parseFloat(form.diaria) * 10).toFixed(2)}
                </div>
              )}
            </div>

            {/* EXAME MÉDICO ASO */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>🏥 Exame Médico (ASO)</div>
              <label style={labelS}>Data do exame</label>
              <input value={form.asoData} onChange={e => set("asoData", e.target.value)} type="date" style={inputS} />
              <label style={labelS}>Validade</label>
              <input value={form.asoValidade} onChange={e => set("asoValidade", e.target.value)} type="date" style={inputS} />
              <label style={labelS}>Status / Aptidão</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {[
                  { v: "Apto", c: GREEN, icon: "✅" },
                  { v: "Apto com restrições", c: ORANGE, icon: "⚠️" },
                  { v: "Inapto", c: RED, icon: "❌" },
                ].map(s => (
                  <button key={s.v} onClick={() => set("asoStatus", s.v)} style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: `2px solid ${form.asoStatus === s.v ? s.c : "#dde2ef"}`, background: form.asoStatus === s.v ? s.c : "#fff", color: form.asoStatus === s.v ? "#fff" : "#666", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>
                    <div style={{ fontSize: 18 }}>{s.icon}</div>
                    {s.v}
                  </button>
                ))}
              </div>
            </div>

            {/* EPI / UNIFORME */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>👕 EPI / Uniforme</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelS}>Camisa</label>
                  <select value={form.tamCamisa} onChange={e => set("tamCamisa", e.target.value)} style={selS}>
                    <option value="">—</option>
                    {["PP", "P", "M", "G", "GG", "XGG", "XXGG"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelS}>Calça</label>
                  <select value={form.tamCalca} onChange={e => set("tamCalca", e.target.value)} style={selS}>
                    <option value="">—</option>
                    {["36", "38", "40", "42", "44", "46", "48", "50", "52"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelS}>Bota</label>
                  <select value={form.tamBota} onChange={e => set("tamBota", e.target.value)} style={selS}>
                    <option value="">—</option>
                    {["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelS}>Luva</label>
                  <select value={form.tamLuva} onChange={e => set("tamLuva", e.target.value)} style={selS}>
                    <option value="">—</option>
                    {["P", "M", "G", "GG"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelS}>Capacete</label>
                  <select value={form.tamCapacete} onChange={e => set("tamCapacete", e.target.value)} style={selS}>
                    <option value="">—</option>
                    <option>Único (ajustável)</option>
                    <option>Pequeno</option>
                    <option>Médio</option>
                    <option>Grande</option>
                  </select>
                </div>
              </div>
              <div style={{ background: "#f0f7ff", borderRadius: 10, padding: "10px 12px", marginTop: 6 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: NAVY, fontWeight: 600 }}>
                  <input type="checkbox" checked={form.epiEntregue} onChange={e => set("epiEntregue", e.target.checked)} style={{ width: 18, height: 18 }} />
                  EPI/Uniforme já entregue
                </label>
                {form.epiEntregue && (
                  <div style={{ marginTop: 8 }}>
                    <label style={labelS}>Data de entrega</label>
                    <input value={form.epiData} onChange={e => set("epiData", e.target.value)} type="date" style={{ ...inputS, marginBottom: 0 }} />
                  </div>
                )}
              </div>
            </div>

            {/* DOCUMENTOS DIGITAIS */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📋 Documentos (foto)</div>
              {[
                { k: "docCtps", l: "CTPS / Carteira de Trabalho", icon: "📘" },
                { k: "docCpf", l: "CPF / RG", icon: "🆔" },
                { k: "docComprov", l: "Comprovante de Residência", icon: "🏠" },
              ].map(d => (
                <div key={d.k} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{d.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{d.l}</span>
                  </div>
                  {form[d.k] ? (
                    <div style={{ position: "relative" }}>
                      <img src={form[d.k]} alt="" style={{ width: "100%", maxHeight: 140, objectFit: "cover", borderRadius: 8, border: "1px solid #dde2ef" }} />
                      <button onClick={() => set(d.k, null)} style={{ position: "absolute", top: 4, right: 4, background: RED, color: "#fff", border: "none", borderRadius: 14, width: 26, height: 26, fontSize: 13, cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>✕</button>
                    </div>
                  ) : (
                    <label style={{ display: "block", padding: 10, borderRadius: 8, border: "1.5px dashed #c5d0e5", background: "#f9fafb", textAlign: "center", cursor: "pointer", fontSize: 11, color: "#666" }}>
                      📷 Tirar foto / escolher
                      <input type="file" accept="image/*" onChange={(e) => handleFoto(e, d.k)} style={{ display: "none" }} />
                    </label>
                  )}
                </div>
              ))}
            </div>

            <Btn label="SALVAR FICHA COMPLETA" color={GOLD} onClick={() => { if (form.nome && form.cpf) { onAdd({ id: Date.now(), ...form }); setSalvo(true); } }} style={{ marginBottom: 24 }} />
          </>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   RELATÓRIO DIÁRIO
════════════════════════════════════ */
function TelaRelatorio({ obras, trabalhadores, pedidos, presencasHoje, onBack }) {
  const [obraId, setObraId] = useState(obras[0]?.id);
  const obra = obras.find(o => o.id === obraId) || obras[0];
  const equips = DEFAULT_EQUIPS.filter(e => e.obraId === obraId);
  const trab = trabalhadores.filter(t => t.obraId === obraId);
  const pedidosObra = pedidos.filter(p => p.obraId === obraId);
  const hoje = new Date().toLocaleDateString("pt-BR");

  const presentes = trab.filter(t => presencasHoje[t.id] === "Presente").length;
  const faltas    = trab.filter(t => presencasHoje[t.id] === "Falta").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Relatório Diário" sub={`${obra?.nome || ""} — ${hoje}`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <select value={obraId} onChange={e => setObraId(parseInt(e.target.value))} style={{ ...selS, marginBottom: 14 }}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>👷 Mão de Obra</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, textAlign: "center", background: "#f0fdf4", borderRadius: 10, padding: "8px 4px" }}><div style={{ fontSize: 18, fontWeight: 900, color: GREEN }}>{presentes}</div><div style={{ fontSize: 10, color: "#666" }}>Presentes</div></div>
            <div style={{ flex: 1, textAlign: "center", background: "#fef2f2", borderRadius: 10, padding: "8px 4px" }}><div style={{ fontSize: 18, fontWeight: 900, color: RED }}>{faltas}</div><div style={{ fontSize: 10, color: "#666" }}>Faltas</div></div>
            <div style={{ flex: 1, textAlign: "center", background: "#fff8f0", borderRadius: 10, padding: "8px 4px" }}><div style={{ fontSize: 18, fontWeight: 900, color: ORANGE }}>{trab.length - presentes - faltas}</div><div style={{ fontSize: 10, color: "#666" }}>Atestados</div></div>
          </div>
          {trab.map((t, i, arr) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", paddingBottom: 6, marginBottom: 6, borderBottom: i < arr.length - 1 ? "1px solid #f0f0f0" : "none" }}>
              <span style={{ fontSize: 14, marginRight: 8 }}>{presencasHoje[t.id] === "Presente" ? "✅" : presencasHoje[t.id] === "Falta" ? "❌" : "📋"}</span>
              <span style={{ flex: 1, fontSize: 13, color: NAVY }}>{t.nome} — {t.cargo}</span>
              <Badge label={presencasHoje[t.id] || "—"} color={STATUS_COLOR[presencasHoje[t.id]] || "#888"} small />
            </div>
          ))}
          {trab.length === 0 && <div style={{ color: "#aaa", fontSize: 13 }}>Sem trabalhadores.</div>}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>⚙️ Equipamentos</div>
          {equips.map(eq => (
            <div key={eq.id} style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 22, marginRight: 10 }}>{eq.icon}</span>
              <span style={{ flex: 1, fontSize: 14, color: NAVY }}>{eq.nome}</span>
              <Badge label={eq.status} color={EQUIP_COLOR[eq.status]} small />
            </div>
          ))}
        </div>

        {pedidosObra.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📦 Pedidos de Material</div>
            {pedidosObra.map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ fontSize: 13, color: NAVY }}>{p.material} — {fmtQtd(p.qtd)}</div>
                <Badge label={p.status} color={p.status === "Aprovado" ? GREEN : p.status === "Negado" ? RED : ORANGE} small />
              </div>
            ))}
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📷 Fotos da Obra</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {["🏗️", "🧱", "🔨"].map((f, i) => (
              <div key={i} style={{ background: "#dde6f5", borderRadius: 10, height: 68, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>{f}</div>
            ))}
          </div>
        </div>

        <Btn label="📤 Exportar Relatório PDF" color={NAVY} onClick={() => {
          const html = `
            <html><head><title>Relatório ${obra?.nome} - ${hoje}</title>
            <style>
              body{font-family:Arial,sans-serif;padding:30px;color:#222;}
              h1{color:${NAVY};border-bottom:3px solid ${GOLD};padding-bottom:8px;}
              h2{color:${NAVY};margin-top:24px;}
              table{width:100%;border-collapse:collapse;margin:10px 0;}
              th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px;}
              th{background:${NAVY};color:#fff;}
              .badge{display:inline-block;padding:3px 8px;border-radius:10px;color:#fff;font-size:11px;font-weight:bold;}
              .footer{margin-top:40px;text-align:center;color:#888;font-size:11px;border-top:1px solid #ddd;padding-top:10px;}
            </style></head><body>
              <h1>📋 Relatório Diário — ${obra?.nome || ""}</h1>
              <p><b>Data:</b> ${hoje} &nbsp;|&nbsp; <b>Local:</b> ${obra?.local || ""}</p>
              <h2>👷 Mão de Obra</h2>
              <table><tr><th>Trabalhador</th><th>Cargo</th><th>Status</th></tr>
              ${trab.map(t => `<tr><td>${t.nome}</td><td>${t.cargo}</td><td><span class="badge" style="background:${STATUS_COLOR[presencasHoje[t.id]] || "#888"}">${presencasHoje[t.id] || "—"}</span></td></tr>`).join("")}
              </table>
              <p><b>Resumo:</b> ${presentes} Presentes • ${faltas} Faltas • ${trab.length - presentes - faltas} Atestados/Sem registro</p>
              <h2>⚙️ Equipamentos</h2>
              <table><tr><th>Equipamento</th><th>Código</th><th>Status</th></tr>
              ${equips.map(eq => `<tr><td>${eq.nome}</td><td>${eq.codigo}</td><td><span class="badge" style="background:${EQUIP_COLOR[eq.status]}">${eq.status}</span></td></tr>`).join("")}
              </table>
              ${pedidosObra.length > 0 ? `
                <h2>📦 Pedidos de Material</h2>
                <table><tr><th>Pedido Nº</th><th>Material</th><th>Quantidade</th><th>Status</th></tr>
                ${pedidosObra.map(p => `<tr><td><b>${String(p.id).slice(-6)}</b></td><td>${p.material}</td><td>${fmtQtd(p.qtd)}</td><td><span class="badge" style="background:${p.status === "Aprovado" ? GREEN : p.status === "Negado" ? RED : ORANGE}">${p.status}</span></td></tr>`).join("")}
                </table>
              ` : ""}
              <div class="footer"><b>KM ZERO</b> — Gestão de Obras &nbsp;|&nbsp; KM Consultoria e Serviços &nbsp;|&nbsp; Gerado em ${new Date().toLocaleString("pt-BR")}</div>
              <script>window.onload=()=>{setTimeout(()=>window.print(),300);}</script>
            </body></html>`;
          abrirOuBaixarHTML(html, `Relatorio-${(obra?.nome || "obra").replace(/[^a-z0-9]/gi, "_").substring(0, 25)}-${hoje.replace(/\//g, "-")}.html`);
        }} style={{ marginBottom: 4 }} />
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   DASHBOARD GESTOR — gráficos
════════════════════════════════════ */
function TelaDashboard({ obras, trabalhadores, pedidos, historico, onBack }) {
  const [obraId, setObraId] = useState("todas");
  const dias = ultimosDias(7);
  const trabFiltro = obraId === "todas" ? trabalhadores : trabalhadores.filter(t => t.obraId === parseInt(obraId));

  const dadosPresenca = dias.map(d => {
    const pres = historico[d] || {};
    let p = 0, f = 0, a = 0;
    trabFiltro.forEach(t => {
      const s = pres[t.id];
      if (s === "Presente") p++;
      else if (s === "Falta") f++;
      else if (s === "Atestado") a++;
    });
    return { dia: fmtData(d), Presentes: p, Faltas: f, Atestados: a };
  });

  const totalPedidos = obraId === "todas" ? pedidos : pedidos.filter(p => p.obraId === parseInt(obraId));
  const dadosPedidos = [
    { name: "Aprovados",  value: totalPedidos.filter(p => p.status === "Aprovado").length,  color: GREEN },
    { name: "Aguardando", value: totalPedidos.filter(p => p.status === "Aguardando").length, color: ORANGE },
    { name: "Negados",    value: totalPedidos.filter(p => p.status === "Negado").length,    color: RED },
  ].filter(x => x.value > 0);

  const cargosCount = {};
  trabFiltro.forEach(t => { cargosCount[t.cargo] = (cargosCount[t.cargo] || 0) + 1; });
  const dadosCargos = Object.entries(cargosCount).map(([k, v]) => ({ name: k, qtd: v }));

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Dashboard" sub="Visão geral" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <select value={obraId} onChange={e => setObraId(e.target.value)} style={{ ...selS, marginBottom: 14 }}>
          <option value="todas">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📊 Presenças (últimos 7 dias)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dadosPresenca}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="Presentes" fill={GREEN} />
              <Bar dataKey="Faltas" fill={RED} />
              <Bar dataKey="Atestados" fill={ORANGE} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {dadosPedidos.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📦 Status dos Pedidos</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={dadosPedidos} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, value }) => `${name}: ${value}`}>
                  {dadosPedidos.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {dadosCargos.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>👥 Distribuição por Cargo</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dadosCargos} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                <Tooltip />
                <Bar dataKey="qtd" fill={BLUE} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>💰 Folha Total (mês)</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: GREEN }}>
            R$ {trabFiltro.reduce((s, t) => s + (parseFloat(t.salario) || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Soma dos salários base de {trabFiltro.length} trabalhador(es)</div>
        </div>
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   TRABALHADOR DETALHE
════════════════════════════════════ */
/* ════════════════════════════════════
   FICHA CADASTRAL IMPRIMÍVEL — A4 oficial pra arquivo físico
════════════════════════════════════ */
/* ════════════════════════════════════
   PEDIDOS — Lista completa com filtro, detalhes e download
════════════════════════════════════ */
/* ════════════════════════════════════
   DETALHE DE 1 PEDIDO — visualização completa antes de decidir
════════════════════════════════════ */
function TelaPedidoDetalhe({ pedido, obras, empresa, onBack, onAprovar, onNegar, onRemover, onEditar }) {
  const [modal, setModal] = useState(false);
  const [formaPag, setFormaPag] = useState(pedido.formaPagamento || "");
  const [prazo, setPrazo] = useState(pedido.prazoEntrega || "");

  // EDIÇÃO de itens antes de aprovar/negar
  const [modalEdicao, setModalEdicao] = useState(false);
  const [itensEdit, setItensEdit] = useState(pedido.itens || [{ material: pedido.material || "", qtd: pedido.qtd || "", obs: pedido.obs || "" }]);
  const [obsGeralEdit, setObsGeralEdit] = useState(pedido.obsGeral || "");

  const abrirEdicao = () => {
    setItensEdit(JSON.parse(JSON.stringify(pedido.itens || [{ material: pedido.material || "", qtd: pedido.qtd || "", obs: pedido.obs || "" }])));
    setObsGeralEdit(pedido.obsGeral || "");
    setModalEdicao(true);
  };

  const setItem = (i, campo, valor) => {
    setItensEdit(prev => prev.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it));
  };

  const adicionarItem = () => setItensEdit(prev => [...prev, { material: "", qtd: "", obs: "" }]);
  const removerItem = (i) => setItensEdit(prev => prev.filter((_, idx) => idx !== i));

  const salvarEdicao = () => {
    const itensLimpos = itensEdit.filter(it => it.material && it.material.trim());
    if (itensLimpos.length === 0) {
      alert("⚠️ Adicione pelo menos um item");
      return;
    }
    onEditar({ ...pedido, itens: itensLimpos, obsGeral: obsGeralEdit });
    setModalEdicao(false);
    alert("✅ Pedido atualizado!");
  };

  const obra = obras.find(o => o.id === pedido.obraId);
  const itens = pedido.itens || [{ material: pedido.material, qtd: pedido.qtd, obs: pedido.obs }];
  const numeroPedido = String(pedido.id).slice(-6);
  const cor = pedido.status === "Aprovado" ? GREEN : pedido.status === "Negado" ? RED : ORANGE;
  const statusLabel = pedido.status === "Aprovado" ? "✓ Aprovado" : pedido.status === "Negado" ? "✕ Negado" : "⏳ Aguardando";

  const aprovar = () => {
    const pedidoCompleto = { ...pedido, formaPagamento: formaPag, prazoEntrega: prazo, status: "Aprovado" };
    onAprovar(pedido.id, { formaPagamento: formaPag, prazoEntrega: prazo });
    setTimeout(() => {
      try { gerarSolicitacaoPedidoPDF(pedidoCompleto, obra, empresa); }
      catch (e) { alert("✅ Aprovado! Erro ao gerar PDF: " + e.message); }
    }, 200);
    setModal(false);
    onBack();
  };

  const baixarPDF = () => {
    try { gerarSolicitacaoPedidoPDF(pedido, obra, empresa); }
    catch (e) { alert("⚠️ Erro: " + e.message); }
  };

  const negarPedido = () => {
    confirmar("Negar este pedido? O encarregado será notificado.", () => {
      onNegar(pedido.id);
      onBack();
    });
  };

  const removerPedido = () => {
    confirmar(`Excluir pedido Nº ${numeroPedido}?\n\nEsta ação não pode ser desfeita.`, () => {
      onRemover(pedido.id);
      onBack();
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title={`Pedido Nº ${numeroPedido}`} sub={pedido.status} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* CABEÇALHO */}
        <div style={{ background: `linear-gradient(135deg,${cor},${cor}cc)`, color: "#fff", borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Pedido Nº {numeroPedido}</div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>{pedido.obra}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.25)", padding: "4px 10px", borderRadius: 10, fontSize: 11, fontWeight: 800 }}>{statusLabel}</div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.9 }}>
            👷 Solicitado por <b>{pedido.enc}</b> em {pedido.data}
          </div>
        </div>

        {/* INFO DA OBRA / ENTREGA */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>📍 Entregar em</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{obra?.nome || "—"}</div>
          {obra?.endereco && <div style={{ fontSize: 12, color: "#444", marginTop: 4 }}>📌 {obra.endereco}</div>}
          {obra?.refLocal && <div style={{ fontSize: 11, color: "#666", marginTop: 2, fontStyle: "italic" }}>Ref: {obra.refLocal}</div>}
          {obra?.local && <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>📍 {obra.local}</div>}
          {(obra?.lat && obra?.lng) && (
            <a href={`https://maps.google.com/?q=${obra.lat},${obra.lng}`} target="_blank" rel="noopener" style={{ display: "inline-block", marginTop: 6, padding: "4px 10px", background: BLUE, color: "#fff", borderRadius: 6, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>📡 Ver no Mapa</a>
          )}
          {!obra?.endereco && (
            <div style={{ background: "#fef2f2", borderRadius: 6, padding: "6px 8px", marginTop: 8, fontSize: 10, color: RED }}>
              ⚠️ Obra sem endereço cadastrado. Recomendado completar antes de aprovar.
            </div>
          )}
        </div>

        {/* ITENS DO PEDIDO */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 8 }}>📦 Itens solicitados ({itens.length})</div>
          {itens.map((it, i) => (
            <div key={i} style={{ padding: "10px 0", borderBottom: i < itens.length - 1 ? "1px solid #f0f0f0" : "none" }}>
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <div style={{ background: NAVY, color: "#fff", width: 22, height: 22, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, marginRight: 8, flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{it.materialBase || it.material}</div>
                  {it.marca && <div style={{ fontSize: 11, color: BLUE, fontWeight: 600, marginTop: 2 }}>🏷️ Marca: {it.marca}</div>}
                  {it.categoria && <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{it.categoria}</div>}
                  {it.obs && <div style={{ fontSize: 11, color: "#666", marginTop: 4, fontStyle: "italic" }}>📝 {it.obs}</div>}
                </div>
                <div style={{ background: "#f0fdf4", padding: "4px 10px", borderRadius: 6, fontSize: 13, fontWeight: 800, color: GREEN, whiteSpace: "nowrap" }}>{it.qtd}</div>
              </div>
            </div>
          ))}
        </div>

        {/* OBSERVAÇÃO GERAL */}
        {pedido.obsGeral && (
          <div style={{ background: "#fef9e7", borderRadius: 12, padding: 14, marginBottom: 10, borderLeft: `4px solid ${ORANGE}` }}>
            <div style={{ fontSize: 11, color: "#8b6f00", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>📝 Observação Geral</div>
            <div style={{ fontSize: 13, color: "#444" }}>{pedido.obsGeral}</div>
          </div>
        )}

        {/* DADOS DE PAGAMENTO (se aprovado) */}
        {pedido.status === "Aprovado" && (pedido.formaPagamento || pedido.prazoEntrega) && (
          <div style={{ background: "#f0fdf4", borderRadius: 12, padding: 14, marginBottom: 10, borderLeft: `4px solid ${GREEN}` }}>
            <div style={{ fontSize: 11, color: "#14532d", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>💰 Pagamento e prazo</div>
            <div style={{ fontSize: 12, color: "#14532d" }}>
              <div><b>Forma:</b> {pedido.formaPagamento || "—"}</div>
              <div><b>Prazo:</b> {pedido.prazoEntrega || "—"}</div>
            </div>
          </div>
        )}

        {/* AÇÕES */}
        <div style={{ marginTop: 12 }}>
          {pedido.status === "Aguardando" ? (
            <>
              <button onClick={abrirEdicao} style={{ width: "100%", padding: 12, borderRadius: 12, border: `1.5px solid ${BLUE}`, background: "#eff6ff", color: BLUE, fontWeight: 800, cursor: "pointer", fontSize: 13, marginBottom: 8 }}>
                ✏️ Editar Itens do Pedido
              </button>
              <button onClick={() => setModal(true)} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14, marginBottom: 8, boxShadow: "0 4px 12px rgba(42,168,79,0.3)" }}>
                ✓ APROVAR E GERAR PDF DO PEDIDO
              </button>
              <button onClick={negarPedido} style={{ width: "100%", padding: 12, borderRadius: 12, border: `1.5px solid ${RED}`, background: "#fff", color: RED, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                ✕ Negar Pedido
              </button>
            </>
          ) : pedido.status === "Aprovado" ? (
            <>
              <button onClick={baixarPDF} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: NAVY, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14, marginBottom: 8, boxShadow: "0 4px 12px rgba(15,33,81,0.3)" }}>
                📥 Baixar / Enviar Pedido (PDF A6)
              </button>
              <button onClick={removerPedido} style={{ width: "100%", padding: 10, borderRadius: 12, border: `1px solid ${RED}33`, background: "#fff", color: RED, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                🗑️ Excluir Pedido
              </button>
            </>
          ) : (
            <button onClick={removerPedido} style={{ width: "100%", padding: 12, borderRadius: 12, border: `1px solid ${RED}33`, background: "#fff", color: RED, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              🗑️ Excluir Pedido
            </button>
          )}
        </div>
      </div>
      <KMFooter />

      {/* MODAL APROVAÇÃO */}
      <Modal show={modal} title="✓ Aprovar Pedido" onClose={() => setModal(false)}>
        <div style={{ background: "#fef9e7", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 11, color: "#8b6f00" }}>
          💡 Preencha forma de pagamento e prazo para gerar a Solicitação de Pedido (PDF A6) que vai pro fornecedor.
        </div>

        <label style={labelS}>💰 Forma de pagamento</label>
        <select value={formaPag} onChange={e => setFormaPag(e.target.value)} style={selS}>
          <option value="">— Selecione —</option>
          <option>À vista</option>
          <option>Boleto 7 dias</option>
          <option>Boleto 15 dias</option>
          <option>Boleto 30 dias</option>
          <option>30/60 dias</option>
          <option>30/60/90 dias</option>
          <option>Faturado mensal</option>
          <option>PIX antecipado</option>
          <option>A combinar</option>
        </select>

        <label style={labelS}>📅 Prazo de entrega</label>
        <input value={prazo} onChange={e => setPrazo(e.target.value)} placeholder="Ex: até 05/05/2026" style={inputS} />

        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setModal(false)} style={{ flex: 1, padding: 11, borderRadius: 8, border: "none", background: "#eee", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Cancelar</button>
          <button onClick={aprovar} style={{ flex: 2, padding: 11, borderRadius: 8, border: "none", background: GREEN, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>✓ Aprovar e Gerar PDF</button>
        </div>
      </Modal>

      {/* MODAL EDIÇÃO */}
      <Modal show={modalEdicao} title="✏️ Editar Pedido" onClose={() => setModalEdicao(false)}>
        <div style={{ background: "#eff6ff", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 11, color: "#1e40af", lineHeight: 1.5 }}>
          💡 Pode ajustar materiais, quantidades e observações antes de aprovar ou negar.
        </div>

        {itensEdit.map((it, i) => (
          <div key={i} style={{ background: "#f9fafb", borderRadius: 10, padding: 10, marginBottom: 8, border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "#666", fontWeight: 700 }}>ITEM {i + 1}</div>
              {itensEdit.length > 1 && (
                <button onClick={() => removerItem(i)} style={{ background: "#fee2e2", color: RED, border: "none", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✕</button>
              )}
            </div>

            <label style={labelS}>📦 Material</label>
            <input value={it.material} onChange={e => setItem(i, "material", e.target.value)} placeholder="Ex: Cimento CP-II" style={inputS} />

            <label style={labelS}>📏 Quantidade (ex: 10 sacos, 2,5 m³)</label>
            <input value={it.qtd} onChange={e => setItem(i, "qtd", e.target.value)} placeholder="Ex: 10 sacos" style={inputS} />

            <label style={labelS}>📝 Observação (opcional)</label>
            <input value={it.obs || ""} onChange={e => setItem(i, "obs", e.target.value)} placeholder="Marca, especificação, etc." style={inputS} />
          </div>
        ))}

        <button onClick={adicionarItem} style={{ width: "100%", padding: 10, background: "#f3f4f6", color: NAVY, border: `1px dashed ${NAVY}66`, borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12, marginBottom: 12 }}>
          ➕ Adicionar Item
        </button>

        <label style={labelS}>📝 Observação Geral do Pedido</label>
        <textarea value={obsGeralEdit} onChange={e => setObsGeralEdit(e.target.value)} placeholder="Observações pro fornecedor" rows="2" style={{ ...inputS, resize: "vertical", minHeight: 50 }} />

        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button onClick={() => setModalEdicao(false)} style={{ flex: 1, padding: 11, borderRadius: 8, border: "none", background: "#eee", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Cancelar</button>
          <button onClick={salvarEdicao} style={{ flex: 2, padding: 11, borderRadius: 8, border: "none", background: GREEN, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>💾 Salvar Alterações</button>
        </div>
      </Modal>
    </div>
  );
}

function TelaPedidos({ obras, pedidos, empresa, onBack, onVerDetalhe, onAprovar, onNegar, onRemover, onCriar, usuario, fornecedores = [] }) {
  const [filtro, setFiltro] = useState("todos");
  const [pedidoEdit, setPedidoEdit] = useState(null);
  const [formaPag, setFormaPag] = useState("");
  const [prazo, setPrazo] = useState("");

  // ════ NOVO PEDIDO PELO GESTOR ════
  const [modalNovo, setModalNovo] = useState(false);
  const [novoObraId, setNovoObraId] = useState(obras[0]?.id || "");
  const [novoFornecedorId, setNovoFornecedorId] = useState("");
  const [novoItens, setNovoItens] = useState([{ material: "", qtd: "1", unidade: "un" }]);
  const [novoObs, setNovoObs] = useState("");
  const [novoPrioridade, setNovoPrioridade] = useState("Normal");

  const abrirNovoPedido = () => {
    setNovoObraId(obras[0]?.id || "");
    setNovoFornecedorId("");
    setNovoItens([{ material: "", qtd: "1", unidade: "un" }]);
    setNovoObs("");
    setNovoPrioridade("Normal");
    setModalNovo(true);
  };

  const addItemNovo = () => setNovoItens([...novoItens, { material: "", qtd: "1", unidade: "un" }]);
  const removerItemNovo = (i) => setNovoItens(novoItens.filter((_, idx) => idx !== i));
  const updateItemNovo = (i, campo, valor) => {
    setNovoItens(novoItens.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it));
  };

  const salvarNovoPedido = () => {
    if (!novoObraId) { alert("Selecione uma obra."); return; }
    const itensValidos = novoItens.filter(i => i.material && i.material.trim());
    if (itensValidos.length === 0) { alert("Adicione pelo menos um item com nome."); return; }
    const fornecedor = fornecedores.find(f => f.id === parseInt(novoFornecedorId));
    const obraSelecionada = obras.find(o => o.id === parseInt(novoObraId));
    const novoPedido = {
      id: Date.now(),
      obraId: parseInt(novoObraId),
      obraNome: obraSelecionada?.nome || "",
      itens: itensValidos,
      material: itensValidos[0].material, // compatibilidade legado
      qtd: itensValidos[0].qtd,
      fornecedorId: fornecedor ? fornecedor.id : null,
      fornecedorNome: fornecedor ? fornecedor.nome : "",
      observacaoGeral: novoObs,
      prioridade: novoPrioridade,
      status: "Aguardando",
      data: new Date().toLocaleString("pt-BR"),
      criadoPor: usuario?.nome || "Gestor",
      criadoPorTipo: "Gestor",
    };
    if (onCriar) onCriar(novoPedido);
    setModalNovo(false);
  };

  const filtrados = filtro === "todos" ? pedidos : pedidos.filter(p => p.status === filtro);

  const aprovar = () => {
    if (!pedidoEdit) return;
    const obraDoPedido = obras.find(o => o.id === pedidoEdit.obraId);
    const pedidoCompleto = { ...pedidoEdit, formaPagamento: formaPag, prazoEntrega: prazo, status: "Aprovado" };
    onAprovar(pedidoEdit.id, { formaPagamento: formaPag, prazoEntrega: prazo });
    setTimeout(() => {
      try { gerarSolicitacaoPedidoPDF(pedidoCompleto, obraDoPedido, empresa); }
      catch (e) { alert("✅ Aprovado! Erro ao gerar PDF: " + e.message); }
    }, 200);
    setPedidoEdit(null);
    setFormaPag("");
    setPrazo("");
  };

  const baixar = (p) => {
    const obraDoPedido = obras.find(o => o.id === p.obraId);
    try {
      gerarSolicitacaoPedidoPDF(p, obraDoPedido, empresa);
    } catch (e) {
      alert("⚠️ Não foi possível gerar o PDF: " + e.message);
    }
  };

  const total = pedidos.length;
  const totalPendentes = pedidos.filter(p => p.status === "Aguardando").length;
  const totalAprovados = pedidos.filter(p => p.status === "Aprovado").length;
  const totalNegados = pedidos.filter(p => p.status === "Negado").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Pedidos de Material" sub={`${total} total`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
          <div onClick={() => setFiltro("Aguardando")} style={{ background: filtro === "Aguardando" ? ORANGE : "#fff", color: filtro === "Aguardando" ? "#fff" : NAVY, borderRadius: 10, padding: 10, textAlign: "center", cursor: "pointer", border: `1.5px solid ${ORANGE}` }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{totalPendentes}</div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>⏳ Aguardando</div>
          </div>
          <div onClick={() => setFiltro("Aprovado")} style={{ background: filtro === "Aprovado" ? GREEN : "#fff", color: filtro === "Aprovado" ? "#fff" : NAVY, borderRadius: 10, padding: 10, textAlign: "center", cursor: "pointer", border: `1.5px solid ${GREEN}` }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{totalAprovados}</div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>✓ Aprovados</div>
          </div>
          <div onClick={() => setFiltro("Negado")} style={{ background: filtro === "Negado" ? RED : "#fff", color: filtro === "Negado" ? "#fff" : NAVY, borderRadius: 10, padding: 10, textAlign: "center", cursor: "pointer", border: `1.5px solid ${RED}` }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{totalNegados}</div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>✕ Negados</div>
          </div>
        </div>

        <button onClick={() => setFiltro("todos")} style={{
          width: "100%", padding: 8, background: filtro === "todos" ? NAVY : "#fff", color: filtro === "todos" ? "#fff" : NAVY,
          border: `1.5px solid ${NAVY}`, borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 11, marginBottom: 8
        }}>📋 Ver todos ({total})</button>

        {/* BOTÃO NOVO PEDIDO (gestor) */}
        {onCriar && (
          <button onClick={abrirNovoPedido} style={{
            width: "100%", padding: 12, marginBottom: 12,
            background: `linear-gradient(135deg, ${GOLD}, #d99517)`,
            color: "#fff", border: "none", borderRadius: 10,
            fontWeight: 800, fontSize: 13, cursor: "pointer",
            boxShadow: `0 4px 12px ${GOLD}40`,
          }}>
            ➕ NOVO PEDIDO DE COMPRA
          </button>
        )}

        {filtrados.length === 0 ? (
          <EmptyState
            icon="📦"
            titulo="Nenhum pedido neste filtro"
            subtitulo="Quando houver pedidos de compra criados pelos encarregados ou pelo gestor, eles aparecerão aqui."
            cor={ORANGE}
          />
        ) : filtrados.sort((a, b) => b.id - a.id).map(p => {
          const itens = p.itens || [{ material: p.material, qtd: p.qtd }];
          const cor = p.status === "Aprovado" ? GREEN : p.status === "Negado" ? RED : ORANGE;
          const numeroPedido = String(p.id).slice(-6);
          return (
            <div key={p.id} onClick={() => onVerDetalhe && onVerDetalhe(p)} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${cor}`, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: "#888", fontWeight: 600 }}>Nº {numeroPedido} • {p.data}</div>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 13, marginTop: 2 }}>{p.obra}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>👷 {p.enc} • <b style={{ color: NAVY }}>{itens.length} {itens.length === 1 ? "item" : "itens"}</b></div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ background: cor, color: "#fff", padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 800 }}>{p.status}</div>
                  <span style={{ color: "#bbb", fontSize: 16 }}>›</span>
                </div>
              </div>

              <div style={{ background: "#f9fafb", borderRadius: 6, padding: "6px 8px", marginBottom: 6 }}>
                {itens.slice(0, 3).map((it, i) => (
                  <div key={i} style={{ fontSize: 11, color: "#444", paddingBottom: 2 }}>
                    {i + 1}) <b>{it.material}</b> — <span style={{ color: GREEN, fontWeight: 700 }}>{it.qtd}</span>
                  </div>
                ))}
                {itens.length > 3 && <div style={{ fontSize: 10, color: BLUE, fontWeight: 600 }}>+ {itens.length - 3} item(ns) — toque pra ver todos</div>}
              </div>

              {p.obsGeral && <div style={{ fontSize: 10, color: "#888", fontStyle: "italic", marginBottom: 6 }}>📝 {p.obsGeral}</div>}

              {p.status === "Aprovado" && (p.formaPagamento || p.prazoEntrega) && (
                <div style={{ background: "#f0fdf4", borderRadius: 6, padding: "4px 8px", marginBottom: 6, fontSize: 10, color: "#14532d" }}>
                  💰 {p.formaPagamento || "—"} • 📅 {p.prazoEntrega || "—"}
                </div>
              )}

              <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                {p.status === "Aguardando" ? (
                  <>
                    <button onClick={() => onNegar(p.id)} style={{ flex: 1, padding: 7, borderRadius: 8, border: "none", background: RED, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>✕ Negar</button>
                    <button onClick={() => { setPedidoEdit(p); setFormaPag(""); setPrazo(""); }} style={{ flex: 2, padding: 7, borderRadius: 8, border: "none", background: GREEN, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>✓ Aprovar e Gerar Pedido</button>
                  </>
                ) : p.status === "Aprovado" ? (
                  <>
                    <button onClick={() => baixar(p)} style={{ flex: 2, padding: 7, borderRadius: 8, border: "none", background: NAVY, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>📥 Baixar Pedido (A6)</button>
                    <button onClick={() => { confirmar(`Excluir pedido Nº ${numeroPedido}?`, () => { onRemover(p.id); }); }} style={{ padding: 7, borderRadius: 8, border: `1px solid ${RED}33`, background: "#fff", color: RED, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>🗑️</button>
                  </>
                ) : (
                  <button onClick={() => { confirmar(`Excluir pedido Nº ${numeroPedido}?`, () => { onRemover(p.id); }); }} style={{ flex: 1, padding: 7, borderRadius: 8, border: `1px solid ${RED}33`, background: "#fff", color: RED, fontWeight: 700, cursor: "pointer", fontSize: 11 }}>🗑️ Excluir</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <KMFooter />

      {/* MODAL APROVAÇÃO */}
      <Modal show={!!pedidoEdit} title="✓ Aprovar Pedido" onClose={() => setPedidoEdit(null)}>
        {pedidoEdit && (() => {
          const itens = pedidoEdit.itens || [{ material: pedidoEdit.material, qtd: pedidoEdit.qtd }];
          const obraDoPedido = obras.find(o => o.id === pedidoEdit.obraId);
          return (
            <>
              <div style={{ background: "#f0fdf4", borderRadius: 10, padding: 10, marginBottom: 10, borderLeft: `3px solid ${GREEN}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{pedidoEdit.obra}</div>
                <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>{itens.length} {itens.length === 1 ? "item" : "itens"} • 👷 {pedidoEdit.enc}</div>
                {itens.map((it, i) => (
                  <div key={i} style={{ fontSize: 10, color: "#444" }}>{i + 1}) <b>{it.material}</b> — <span style={{ color: GREEN, fontWeight: 700 }}>{it.qtd}</span></div>
                ))}
              </div>

              <div style={{ background: "#fef9e7", borderRadius: 6, padding: 8, marginBottom: 10, fontSize: 10, color: "#8b6f00" }}>
                💡 Após aprovar, o PDF do pedido (A6) é gerado automaticamente.
              </div>

              <label style={labelS}>💰 Forma de pagamento</label>
              <select value={formaPag} onChange={e => setFormaPag(e.target.value)} style={selS}>
                <option value="">— Selecione —</option>
                <option>À vista</option>
                <option>Boleto 7 dias</option>
                <option>Boleto 15 dias</option>
                <option>Boleto 30 dias</option>
                <option>30/60 dias</option>
                <option>30/60/90 dias</option>
                <option>Faturado mensal</option>
                <option>PIX antecipado</option>
                <option>A combinar</option>
              </select>

              <label style={labelS}>📅 Prazo de entrega</label>
              <input value={prazo} onChange={e => setPrazo(e.target.value)} placeholder="Ex: até 05/05/2026" style={inputS} />

              {!obraDoPedido?.endereco && (
                <div style={{ background: "#fef2f2", borderRadius: 6, padding: 8, marginBottom: 10, fontSize: 10, color: RED }}>
                  ⚠️ A obra não tem endereço cadastrado. O PDF não terá detalhes de entrega completos.
                </div>
              )}

              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setPedidoEdit(null)} style={{ flex: 1, padding: 11, borderRadius: 8, border: "none", background: "#eee", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Cancelar</button>
                <button onClick={aprovar} style={{ flex: 2, padding: 11, borderRadius: 8, border: "none", background: GREEN, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>✓ Aprovar e Gerar PDF</button>
              </div>
            </>
          );
        })()}
      </Modal>

      {/* MODAL: NOVO PEDIDO PELO GESTOR */}
      <Modal show={modalNovo} title="➕ Novo Pedido de Compra" onClose={() => setModalNovo(false)}>
        <div style={{ background: "#fff7e6", borderRadius: 8, padding: "8px 10px", marginBottom: 12, fontSize: 11, color: "#8a6d1a", lineHeight: 1.4 }}>
          💡 Pedido criado pelo gestor já entra como <b>Aguardando aprovação</b>. Você pode aprovar em seguida na lista.
        </div>

        <label style={labelS}>🏗️ Obra</label>
        <select value={novoObraId} onChange={e => setNovoObraId(e.target.value)} style={selS}>
          <option value="">Selecione a obra...</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        {fornecedores.length > 0 && (
          <>
            <label style={labelS}>🏪 Fornecedor (opcional)</label>
            <select value={novoFornecedorId} onChange={e => setNovoFornecedorId(e.target.value)} style={selS}>
              <option value="">Não definir fornecedor agora</option>
              {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </>
        )}

        <label style={labelS}>🚨 Prioridade</label>
        <select value={novoPrioridade} onChange={e => setNovoPrioridade(e.target.value)} style={selS}>
          <option>Baixa</option>
          <option>Normal</option>
          <option>Alta</option>
          <option>Urgente</option>
        </select>

        <label style={labelS}>📦 Itens do Pedido</label>
        {novoItens.map((item, i) => (
          <div key={i} style={{ background: "#f9fafb", borderRadius: 8, padding: 8, marginBottom: 6, border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: NAVY }}>Item {i + 1}</span>
              {novoItens.length > 1 && (
                <button onClick={() => removerItemNovo(i)} style={{ background: "none", border: "none", color: RED, cursor: "pointer", fontSize: 14 }}>🗑️</button>
              )}
            </div>
            <input
              value={item.material}
              onChange={e => updateItemNovo(i, "material", e.target.value)}
              placeholder="Ex: Cimento CP-II"
              style={{ ...inputS, fontSize: 13, marginBottom: 4 }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <input
                value={item.qtd}
                onChange={e => updateItemNovo(i, "qtd", e.target.value)}
                type="number"
                placeholder="Qtd"
                style={{ ...inputS, fontSize: 13, marginBottom: 0 }}
              />
              <select
                value={item.unidade}
                onChange={e => updateItemNovo(i, "unidade", e.target.value)}
                style={{ ...selS, fontSize: 12, marginBottom: 0 }}
              >
                <option value="un">un</option>
                <option value="kg">kg</option>
                <option value="m">m</option>
                <option value="m²">m²</option>
                <option value="m³">m³</option>
                <option value="L">L</option>
                <option value="sc">sc (saco)</option>
                <option value="pç">pç (peça)</option>
              </select>
            </div>
          </div>
        ))}
        <button onClick={addItemNovo} style={{ width: "100%", padding: 8, marginBottom: 10, background: "#f0f7ff", color: BLUE, border: `1px dashed ${BLUE}`, borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
          ➕ Adicionar mais um item
        </button>

        <label style={labelS}>📝 Observações</label>
        <textarea
          value={novoObs}
          onChange={e => setNovoObs(e.target.value)}
          placeholder="Detalhes adicionais, urgência específica, local de entrega..."
          rows={2}
          style={{ ...inputS, fontFamily: "inherit", resize: "none" }}
        />

        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button onClick={() => setModalNovo(false)} style={{ flex: 1, padding: 11, borderRadius: 8, border: "none", background: "#eee", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Cancelar</button>
          <button onClick={salvarNovoPedido} style={{ flex: 2, padding: 11, borderRadius: 8, border: "none", background: GREEN, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>📦 Criar Pedido</button>
        </div>
      </Modal>
    </div>
  );
}


/* ════════════════════════════════════
   SOLICITAÇÃO DE PEDIDO DE COMPRA — documento NÃO FISCAL
════════════════════════════════════ */
function gerarSolicitacaoPedidoPDF(pedido, obra, empresa) {
  const itens = pedido.itens && pedido.itens.length > 0
    ? pedido.itens
    : [{ material: pedido.material, qtd: pedido.qtd, obs: pedido.obs }]; // compat com pedidos antigos

  const linkMaps = (obra?.lat && obra?.lng)
    ? `https://maps.google.com/?q=${obra.lat},${obra.lng}`
    : (obra?.endereco ? `https://maps.google.com/?q=${encodeURIComponent(obra.endereco + ", " + (obra.local || ""))}` : "");

  const numeroPedido = String(pedido.id).slice(-6); // últimos 6 dígitos do ID

  const html = `<html>
    <head>
      <title>Pedido Nº ${numeroPedido}</title>
      <style>
        ${KM_PDF_PAGE_CSS}
        @page { size: A6; margin: 4mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 7.5pt; line-height: 1.25; margin: 0; padding: 0; width: 97mm; }

        .topo { border: 2px solid #0f2151; border-radius: 4px; padding: 0; margin-bottom: 4px; }
        .topo-header { background: #0f2151; color: #fff; padding: 4px 6px; }
        .topo-header .razao { font-size: 8pt; font-weight: 800; line-height: 1.1; }
        .topo-header .sub { font-size: 6pt; opacity: 0.85; line-height: 1.2; }
        .topo-titulo { display: flex; justify-content: space-between; align-items: center; padding: 3px 6px; background: #f5f8fc; border-top: 1px solid #d0dae8; }
        .topo-titulo h1 { margin: 0; font-size: 9pt; color: #0f2151; letter-spacing: 0.5px; font-weight: 900; }
        .topo-titulo .num { font-size: 9pt; color: #C0A040; font-weight: 800; }

        .selo {
          background: #fef9e7; border: 1px dashed #f5a623;
          padding: 2px 5px; text-align: center; margin: 3px 0;
          font-size: 6pt; color: #8b6f00; font-weight: 700; letter-spacing: 0.3px;
        }

        .info-row { display: flex; gap: 4px; margin-bottom: 3px; }
        .info-cell {
          flex: 1; border: 1px solid #ccc; border-radius: 3px;
          padding: 3px 5px; font-size: 7pt;
        }
        .info-cell .label { font-size: 5.5pt; color: #888; text-transform: uppercase; letter-spacing: 0.2px; font-weight: 700; }
        .info-cell .val { font-size: 7.5pt; font-weight: 700; color: #1a1a1a; }

        .bloco-entrega {
          background: #eff6ff; border-left: 3px solid #1e6bbf;
          padding: 4px 6px; margin-bottom: 3px; border-radius: 0 3px 3px 0;
        }
        .bloco-entrega .h { font-size: 6pt; color: #0c4a6e; text-transform: uppercase; font-weight: 800; letter-spacing: 0.3px; margin-bottom: 1px; }
        .bloco-entrega .linha { font-size: 7pt; color: #1a1a1a; line-height: 1.3; }
        .bloco-entrega b { color: #0c4a6e; }
        .bloco-entrega a { color: #1e6bbf; text-decoration: none; word-break: break-all; }

        .h-secao {
          background: #0f2151; color: #fff;
          padding: 2px 6px; margin: 3px 0 2px;
          font-size: 6.5pt; letter-spacing: 0.3px; font-weight: 800;
          text-transform: uppercase;
        }
        table { width: 100%; border-collapse: collapse; font-size: 7pt; table-layout: auto; }
        th { background: #e8eef6; color: #003060; padding: 2px 4px; border: 1px solid #c5d0e0; text-align: left; font-size: 6pt; text-transform: uppercase; font-weight: 800; white-space: nowrap; }
        td { padding: 2px 4px; border: 1px solid #d5dce6; vertical-align: top; white-space: nowrap; }
        td.td-wrap { white-space: normal; overflow-wrap: break-word; word-break: normal; }
        td.num { width: 12px; text-align: center; color: #888; font-weight: 700; }
        td.qtd { text-align: right; font-weight: 700; color: #2aa84f; white-space: nowrap; width: 50px; }
        .marca { font-size: 6pt; color: #1e6bbf; font-weight: 600; }
        .obs-item { font-size: 6pt; color: #888; font-style: italic; }

        .pagamento {
          background: #f0fdf4; border-left: 3px solid #2aa84f;
          padding: 4px 6px; margin: 3px 0; border-radius: 0 3px 3px 0;
        }
        .pagamento .h { font-size: 6pt; color: #14532d; text-transform: uppercase; font-weight: 800; letter-spacing: 0.3px; }
        .pagamento .row { display: flex; gap: 6px; margin-top: 2px; }
        .pagamento .field { flex: 1; }
        .pagamento .field b { font-size: 6pt; color: #14532d; }
        .pagamento .preencher {
          border-bottom: 1px solid #888; min-height: 12px;
          padding: 1px 0; font-size: 8pt; font-weight: 600;
        }

        .obs-geral {
          background: #fef9e7; border-left: 3px solid #f5a623;
          padding: 3px 6px; margin: 3px 0; border-radius: 0 3px 3px 0;
          font-size: 7pt;
        }

        .ass {
          margin-top: 8px; text-align: center;
        }
        .ass-linha {
          border-top: 1px solid #000; padding-top: 2px;
          font-size: 6pt; color: #555; line-height: 1.3;
        }
        .ass-linha b { color: #0f2151; font-size: 7pt; }

        .footer-doc {
          margin-top: 4px; padding-top: 2px; border-top: 1px solid #ddd;
          font-size: 5pt; color: #888; text-align: center; line-height: 1.2;
        }

        /* Multi-página */
        h3, .h-secao { page-break-after: avoid; break-after: avoid; }
        tr, .bloco-entrega, .pagamento, .ass { page-break-inside: avoid; break-inside: avoid; }
      </style>
    </head>
    <body>
      <div class="topo">
        <div class="topo-header">
          <div class="razao">${empresa?.razaoSocial || "KM Consultoria, Assessoria e Serviços de Engenharia Ltda"}</div>
          <div class="sub">CNPJ: ${empresa?.cnpj || "—"} • ${empresa?.responsavel || "Kleber Vieira Martins"}</div>
          <div class="sub">📱 ${empresa?.telefone || ""} • 📧 ${empresa?.email || ""}</div>
        </div>
        <div class="topo-titulo">
          <h1>SOLICITAÇÃO DE PEDIDO</h1>
          <div class="num">Nº ${numeroPedido}</div>
        </div>
      </div>

      <div class="selo">⚠️ DOCUMENTO INTERNO — NÃO É NOTA FISCAL ⚠️</div>

      <div class="info-row">
        <div class="info-cell">
          <div class="label">📅 Data</div>
          <div class="val">${pedido.data || new Date().toLocaleDateString("pt-BR")}</div>
        </div>
        <div class="info-cell">
          <div class="label">👷 Solicitante</div>
          <div class="val">${pedido.enc || "—"}</div>
        </div>
      </div>

      <div class="bloco-entrega">
        <div class="h">📍 Entregar em</div>
        <div class="linha"><b>${obra?.nome || pedido.obra || "—"}</b></div>
        ${obra?.endereco ? `<div class="linha">${obra.endereco}</div>` : ""}
        ${obra?.refLocal ? `<div class="linha">📌 Ref: ${obra.refLocal}</div>` : ""}
        ${obra?.local ? `<div class="linha">${obra.local}</div>` : ""}
        ${linkMaps ? `<div class="linha"><a href="${linkMaps}">📡 Ver no mapa</a></div>` : ""}
      </div>

      <div class="h-secao">📦 Itens (${itens.length})</div>
      <table>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>Material</th>
            <th style="text-align:right;width:50px;">Qtd</th>
          </tr>
        </thead>
        <tbody>
          ${itens.map((item, i) => `
            <tr>
              <td class="num">${i + 1}</td>
              <td>
                <b>${item.materialBase || item.material}</b>
                ${item.marca ? `<br/><span class="marca">🏷️ ${item.marca}</span>` : ""}
                ${item.obs ? `<div class="obs-item">📝 ${item.obs}</div>` : ""}
              </td>
              <td class="qtd">${fmtQtd(item.qtd)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      ${pedido.obsGeral ? `
        <div class="obs-geral">
          <b style="font-size:6pt;color:#8b6f00;">📝 OBSERVAÇÃO GERAL:</b><br/>
          ${pedido.obsGeral}
        </div>
      ` : ""}

      <div class="pagamento">
        <div class="h">💰 Pagamento e Prazo</div>
        <div class="row">
          <div class="field">
            <b>Forma de pagto:</b>
            <div class="preencher">${pedido.formaPagamento || "&nbsp;"}</div>
          </div>
          <div class="field">
            <b>Prazo entrega:</b>
            <div class="preencher">${pedido.prazoEntrega || "&nbsp;"}</div>
          </div>
        </div>
      </div>

      <div class="ass">
        <div style="height:18px;"></div>
        <div class="ass-linha">
          <b>${empresa?.responsavel || "Kleber Vieira Martins"}</b><br/>
          ${empresa?.razaoSocial?.split(",")[0] || "KM Consultoria"} • ${empresa?.telefone || ""}
        </div>
      </div>

      <div class="footer-doc">
        Sistema KMZERO • Pedido Nº ${numeroPedido} • ${new Date().toLocaleString("pt-BR")}<br/>
        Esta solicitação não substitui nota fiscal
      </div>
    </body>
  </html>`;

  abrirOuBaixarHTML(html, `Pedido-${numeroPedido}-${(obra?.nome || "obra").substring(0, 20).replace(/[^a-z0-9]/gi, "_")}`);
}

/* ════════════════════════════════════
   FICHA CADASTRAL IMPRIMÍVEL — A4 oficial pra arquivo físico
════════════════════════════════════ */
function gerarFichaCadastralPDF(t, obra, empresa) {
  const fmtCPF = (cpf) => cpf ? cpf.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "—";
  const fmtTel = (tel) => tel || "—";
  const fmtData = (d) => {
    if (!d) return "—";
    if (d.includes("/")) return d;
    try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
  };
  const v = (val) => val && String(val).trim() ? val : "—";

  // Tipo de folha (badge)
  const tiposFolha = { semanal: "Semanal (7 dias)", quinzenal: "Quinzenal (15 dias)", mensal: "Mensal (30 dias)", personalizado: "Personalizado" };
  const tipoFolhaLabel = tiposFolha[t.tipoFolha] || "Quinzenal";

  // Formas de cálculo
  const formasCalculo = { diaria: "Por diária", mensal_fixo: "Salário mensal fixo", hora: "Por hora", producao: "Por produção" };
  const formaCalcLabel = formasCalculo[t.formaCalculo] || "Por diária";

  // Remuneração
  let remuneracao = "—";
  if (t.formaCalculo === "mensal_fixo" && t.salarioFixo) {
    remuneracao = `R$ ${parseFloat(t.salarioFixo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês (fixo)`;
  } else if (t.diaria) {
    remuneracao = `R$ ${parseFloat(t.diaria).toFixed(2).replace(".", ",")}/dia`;
  } else if (t.salarioMensal) {
    remuneracao = `R$ ${parseFloat(t.salarioMensal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês`;
  }

  // Detectar se é direto (obra) ou indireto (escritório)
  const ehIndireto = !t.obraId && !obra;
  const tipoVinculo = ehIndireto ? "Funcionário Indireto / Escritório" : "Funcionário Direto / Obra";

  // Data de emissão
  const dataEmissao = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const idTrab = String(t.id).padStart(5, "0");

  const html = `<html>
    <head>
      <title>Ficha Cadastral - ${t.nome}</title>
      <style>
        ${KM_PDF_PAGE_CSS}
        @page { size: A4 portrait; margin: 8mm 10mm; }
        @media print {
          body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break { page-break-before: always; }
        }
        body {
          font-family: 'Arial', 'Helvetica', sans-serif;
          color: #1a1a1a;
          font-size: 9pt;
          line-height: 1.25;
          margin: 0;
          padding: 0;
        }
        /* CABEÇALHO INSTITUCIONAL */
        .cabecalho {
          display: flex;
          justify-content: space-between;
          align-items: stretch;
          border-bottom: 3px solid #0f2151;
          padding-bottom: 5px;
          margin-bottom: 6px;
        }
        .cabecalho-empresa { flex: 1; padding-right: 8px; }
        .cabecalho-logo {
          font-size: 18pt;
          font-weight: 900;
          letter-spacing: -1px;
          line-height: 1;
          margin-bottom: 2px;
        }
        .cabecalho-logo .km { color: #0f2151; }
        .cabecalho-logo .zero { color: #F5A623; }
        .cabecalho-razao { font-size: 8.5pt; color: #1a1a1a; font-weight: 700; line-height: 1.2; }
        .cabecalho-dados { font-size: 7pt; color: #555; line-height: 1.3; margin-top: 1px; }
        .cabecalho-tagline { font-size: 6.5pt; color: #888; letter-spacing: 1.5px; font-weight: 600; margin-top: 1px; }
        .foto-3x4 {
          width: 72px; height: 92px;
          border: 1.5px solid #0f2151;
          display: flex; align-items: center; justify-content: center;
          flex-direction: column;
          color: #888; font-size: 7pt; text-align: center;
          background: repeating-linear-gradient(45deg, #fafafa, #fafafa 4px, #fff 4px, #fff 8px);
          flex-shrink: 0;
        }
        .foto-3x4 .label { font-weight: 700; letter-spacing: 0.5px; }

        /* TÍTULO PRINCIPAL */
        .titulo-doc {
          text-align: center;
          background: #0f2151;
          color: #fff;
          padding: 4px 8px;
          margin: 4px 0;
          letter-spacing: 1px;
        }
        .titulo-doc h1 {
          font-size: 11pt;
          font-weight: 900;
          margin: 0;
          letter-spacing: 1.5px;
        }
        .titulo-doc .sub { font-size: 7pt; color: #F5A623; margin-top: 1px; letter-spacing: 0.8px; }
        .ribbon-tipo {
          display: flex; justify-content: space-between;
          background: #FFF7E6; border: 1px solid #F5A623;
          padding: 2px 8px; font-size: 7.5pt;
          margin-bottom: 4px;
        }
        .ribbon-tipo b { color: #7c6f3a; }

        /* SEÇÕES */
        .secao-titulo {
          background: linear-gradient(90deg, #0f2151 0%, #1a3370 100%);
          color: #fff;
          padding: 2px 8px;
          font-size: 8pt;
          font-weight: 700;
          letter-spacing: 0.8px;
          margin: 4px 0 0 0;
        }
        .secao {
          border: 1px solid #0f2151;
          border-top: none;
          padding: 0;
          margin-bottom: 4px;
        }
        /* TABELA DE CAMPOS */
        table.dados {
          width: 100%;
          border-collapse: collapse;
          font-size: 8.5pt;
        }
        table.dados td {
          border: 1px solid #d0d4dc;
          padding: 2px 5px;
          vertical-align: top;
          line-height: 1.2;
        }
        table.dados td.label {
          background: #f4f6fa;
          font-size: 6.5pt;
          color: #555;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          font-weight: 700;
          width: 1px;
          white-space: nowrap;
          padding-right: 8px;
        }
        table.dados td.valor {
          font-size: 9pt;
          color: #000;
          font-weight: 500;
        }
        table.dados td.valor.destaque {
          font-weight: 800;
          color: #0f2151;
        }

        /* ASSINATURAS */
        .assinaturas {
          display: flex; gap: 16px; margin-top: 8px;
        }
        .ass-bloco { flex: 1; text-align: center; }
        .ass-bloco .linha-ass {
          border-top: 1px solid #000;
          margin-top: 22px;
          padding-top: 2px;
          font-size: 7.5pt;
          color: #444;
          font-weight: 600;
        }
        .ass-bloco .nome-ass { font-size: 7pt; color: #888; margin-top: 1px; }

        /* LGPD */
        .lgpd-alerta {
          background: #fff8e1; border-left: 3px solid #F5A623;
          padding: 3px 8px; font-size: 7pt; color: #7c6f3a;
          margin: 4px 0 2px 0;
          line-height: 1.3;
        }
        .lgpd-alerta b { color: #5c5210; }

        /* RODAPÉ */
        .rodape-doc {
          margin-top: 6px;
          border-top: 1px solid #ccc;
          padding-top: 3px;
          font-size: 6.5pt;
          color: #999;
          display: flex; justify-content: space-between;
          letter-spacing: 0.2px;
        }

        /* ═══ CRACHÁ ═══ */
        .cracha-page { padding-top: 20mm; }
        .cracha-grid {
          display: flex;
          gap: 10mm;
          flex-wrap: wrap;
          justify-content: center;
        }
        .cracha {
          width: 85mm; height: 54mm;
          border: 2px solid #0f2151;
          border-radius: 5px;
          padding: 0;
          background: #fff;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .cracha-header {
          background: linear-gradient(135deg, #0f2151 0%, #1a3370 100%);
          color: #fff;
          padding: 3px 6px;
          display: flex; justify-content: space-between; align-items: center;
        }
        .cracha-logo {
          font-size: 11pt; font-weight: 900; letter-spacing: -0.5px;
        }
        .cracha-logo .zero { color: #F5A623; }
        .cracha-tagline { font-size: 5pt; letter-spacing: 1.5px; opacity: 0.85; }
        .cracha-body {
          flex: 1;
          display: flex;
          padding: 4mm;
          gap: 3mm;
          background: #fff;
        }
        .cracha-foto {
          width: 22mm; height: 30mm;
          border: 1px solid #0f2151;
          background: repeating-linear-gradient(45deg, #f9f9f9, #f9f9f9 3px, #fff 3px, #fff 6px);
          display: flex; align-items: center; justify-content: center;
          font-size: 6pt; color: #aaa; text-align: center;
          flex-shrink: 0;
        }
        .cracha-info { flex: 1; font-size: 7pt; line-height: 1.3; }
        .cracha-nome { font-size: 9pt; font-weight: 900; color: #0f2151; line-height: 1.1; margin-bottom: 1mm; }
        .cracha-cargo { font-size: 7pt; color: #F5A623; font-weight: 700; margin-bottom: 1mm; letter-spacing: 0.3px; }
        .cracha-detalhe { font-size: 6pt; color: #444; line-height: 1.4; }
        .cracha-detalhe b { color: #0f2151; font-weight: 700; }
        .cracha-footer {
          background: #F5A623;
          color: #0f2151;
          font-size: 5.5pt;
          font-weight: 700;
          padding: 1.5mm 6px;
          letter-spacing: 0.8px;
          text-align: center;
          line-height: 1;
        }
        .cracha-titulo-pg {
          text-align: center;
          background: #0f2151;
          color: #fff;
          padding: 5px;
          margin-bottom: 10mm;
          letter-spacing: 1px;
        }
        .cracha-titulo-pg h1 { font-size: 13pt; margin: 0; font-weight: 900; }
        .cracha-titulo-pg .sub { font-size: 8pt; color: #F5A623; margin-top: 2px; letter-spacing: 0.6px; }
        .cracha-instrucoes {
          margin-top: 8mm;
          background: #f4f6fa;
          border-left: 3px solid #0f2151;
          padding: 4px 10px;
          font-size: 8pt;
          color: #555;
          line-height: 1.5;
        }
      </style>
    </head>
    <body>

      <!-- ════════ PÁGINA 1 — FICHA CADASTRAL A4 ════════ -->
      <div class="cabecalho">
        <div class="cabecalho-empresa">
          <div class="cabecalho-logo"><span class="km">KM</span><span class="zero">ZERO</span></div>
          <div class="cabecalho-tagline">GESTÃO DE OBRAS</div>
          <div class="cabecalho-razao">${v(empresa.razaoSocial) || "KM Consultoria, Assessoria e Serviços de Engenharia Ltda"}</div>
          <div class="cabecalho-dados">
            CNPJ: ${v(empresa.cnpj) || "60.368.233/0001-73"} &nbsp;•&nbsp;
            ${v(empresa.endereco) || "Alegre/ES"}<br>
            ${v(empresa.responsavel) || "Eng. Kleber Vieira Martins · CREA-ES"} &nbsp;•&nbsp;
            ${v(empresa.telefone) || "(28) 99925-8172"} &nbsp;•&nbsp;
            ${v(empresa.email) || "kvmprojetos@gmail.com"}
          </div>
        </div>
        <div class="foto-3x4">
          <div class="label">FOTO</div>
          <div style="font-size:6pt;margin-top:1px;">3x4</div>
        </div>
      </div>

      <div class="titulo-doc">
        <h1>FICHA CADASTRAL DE COLABORADOR</h1>
        <div class="sub">DOCUMENTO PARA ARQUIVO INTERNO</div>
      </div>

      <div class="ribbon-tipo">
        <span><b>📁 Vínculo:</b> ${tipoVinculo}</span>
        <span><b>🆔 Matrícula:</b> #${idTrab}</span>
        <span><b>📅 Emissão:</b> ${dataEmissao}</span>
      </div>

      <div class="secao-titulo">1. IDENTIFICAÇÃO PESSOAL</div>
      <div class="secao">
        <table class="dados">
          <tr>
            <td class="label">Nome Completo</td>
            <td class="valor destaque" colspan="3">${v(t.nome)}</td>
          </tr>
          <tr>
            <td class="label">CPF</td><td class="valor">${fmtCPF(t.cpf)}</td>
            <td class="label">RG</td><td class="valor">${v(t.rg)}</td>
          </tr>
          <tr>
            <td class="label">Data Nascimento</td><td class="valor">${fmtData(t.nasc)}</td>
            <td class="label">Estado Civil</td><td class="valor">${v(t.estadoCivil)}</td>
          </tr>
          <tr>
            <td class="label">Nacionalidade</td><td class="valor">${v(t.nacionalidade) || "Brasileira"}</td>
            <td class="label">Naturalidade</td><td class="valor">${v(t.naturalidade)}</td>
          </tr>
          <tr>
            <td class="label">Tipo Sanguíneo</td><td class="valor">${v(t.tipoSanguineo)}</td>
            <td class="label">Escolaridade</td><td class="valor">${v(t.escolaridade)}</td>
          </tr>
          <tr>
            <td class="label">Nome do Pai</td><td class="valor" colspan="3">${v(t.nomePai)}</td>
          </tr>
          <tr>
            <td class="label">Nome da Mãe</td><td class="valor" colspan="3">${v(t.nomeMae)}</td>
          </tr>
        </table>
      </div>

      <div class="secao-titulo">2. ENDEREÇO E CONTATO</div>
      <div class="secao">
        <table class="dados">
          <tr>
            <td class="label">Endereço</td>
            <td class="valor" colspan="3">${v(t.endereco)}</td>
          </tr>
          <tr>
            <td class="label">Bairro</td><td class="valor">${v(t.bairro)}</td>
            <td class="label">Cidade / UF</td><td class="valor">${v(t.cidade)}</td>
          </tr>
          <tr>
            <td class="label">CEP</td><td class="valor">${v(t.cep)}</td>
            <td class="label">Telefone Cel.</td><td class="valor">${fmtTel(t.tel)}</td>
          </tr>
          <tr>
            <td class="label">Tel. Recado</td><td class="valor">${fmtTel(t.telRecado)}</td>
            <td class="label">E-mail</td><td class="valor">${v(t.email)}</td>
          </tr>
        </table>
      </div>

      <div class="secao-titulo">3. DADOS PROFISSIONAIS E REMUNERAÇÃO</div>
      <div class="secao">
        <table class="dados">
          <tr>
            <td class="label">Cargo / Função</td><td class="valor destaque">${v(t.cargo)}</td>
            <td class="label">Obra Atual</td><td class="valor">${ehIndireto ? "Escritório (Indireto)" : (obra?.nome || "—")}</td>
          </tr>
          <tr>
            <td class="label">Data Admissão</td><td class="valor">${fmtData(t.admissao || t.inicio)}</td>
            <td class="label">CTPS / PIS</td><td class="valor">${v(t.ctps || t.pis)}</td>
          </tr>
          <tr>
            <td class="label">Tipo de Folha</td><td class="valor"><b>${tipoFolhaLabel}</b></td>
            <td class="label">Forma de Cálculo</td><td class="valor">${formaCalcLabel}</td>
          </tr>
          <tr>
            <td class="label">Remuneração</td><td class="valor destaque" colspan="3">${remuneracao}</td>
          </tr>
        </table>
      </div>

      <div class="secao-titulo">4. SAÚDE E SEGURANÇA — ASO</div>
      <div class="secao">
        <table class="dados">
          <tr>
            <td class="label">Data do ASO</td><td class="valor">${fmtData(t.asoData)}</td>
            <td class="label">Validade ASO</td><td class="valor destaque">${fmtData(t.asoValidade)}</td>
          </tr>
          <tr>
            <td class="label">Status</td><td class="valor"><b>${v(t.asoStatus) || "Apto"}</b></td>
            <td class="label">Convênio Saúde</td><td class="valor">${v(t.convenio)}</td>
          </tr>
          <tr>
            <td class="label">Alergias / Condições</td>
            <td class="valor" colspan="3">${v(t.condicoesMedicas)}</td>
          </tr>
        </table>
      </div>

      <div class="secao-titulo">5. UNIFORMES E EPI</div>
      <div class="secao">
        <table class="dados">
          <tr>
            <td class="label">Camisa</td><td class="valor">${v(t.tamCamisa)}</td>
            <td class="label">Calça</td><td class="valor">${v(t.tamCalca)}</td>
            <td class="label">Bota</td><td class="valor">${v(t.tamBota)}</td>
            <td class="label">Capacete</td><td class="valor">${v(t.tamCapacete)}</td>
          </tr>
          <tr>
            <td class="label">EPI Entregue</td>
            <td class="valor" colspan="7">${t.epiEntregue ? "✓ Sim — em " + fmtData(t.epiData) : "✗ Não entregue"}</td>
          </tr>
        </table>
      </div>

      <div class="secao-titulo">6. CONTATO DE EMERGÊNCIA</div>
      <div class="secao">
        <table class="dados">
          <tr>
            <td class="label">Nome</td><td class="valor">${v(t.emergenciaNome)}</td>
            <td class="label">Parentesco</td><td class="valor">${v(t.emergenciaParentesco)}</td>
            <td class="label">Telefone</td><td class="valor">${fmtTel(t.emergenciaTel)}</td>
          </tr>
        </table>
      </div>

      <div class="secao-titulo">7. DADOS BANCÁRIOS</div>
      <div class="secao">
        <table class="dados">
          <tr>
            <td class="label">Banco</td><td class="valor">${v(t.banco)}</td>
            <td class="label">Agência</td><td class="valor">${v(t.agencia)}</td>
            <td class="label">Conta</td><td class="valor">${v(t.conta)} ${v(t.tipoConta) !== "—" ? "(" + t.tipoConta + ")" : ""}</td>
          </tr>
          <tr>
            <td class="label">Chave PIX</td>
            <td class="valor" colspan="5">${v(t.pix)}</td>
          </tr>
        </table>
      </div>

      <div class="lgpd-alerta">
        <b>⚠️ Confidencialidade — LGPD:</b> Este documento contém dados pessoais protegidos pela Lei Geral de Proteção de Dados (Lei 13.709/2018). Uso restrito à empresa emissora. Não pode ser compartilhado sem autorização do titular.
      </div>

      <div class="assinaturas">
        <div class="ass-bloco">
          <div class="linha-ass">Assinatura do Colaborador</div>
          <div class="nome-ass">${v(t.nome)}<br>CPF: ${fmtCPF(t.cpf)}</div>
        </div>
        <div class="ass-bloco">
          <div class="linha-ass">Responsável pela Empresa</div>
          <div class="nome-ass">${v(empresa.responsavel) || "Eng. Kleber Vieira Martins"}<br>CREA-ES</div>
        </div>
      </div>

      <div style="text-align:right;margin-top:6px;font-size:8pt;color:#444;">
        Local e Data: _______________________________________ , _____ / _____ / _________
      </div>

      <div class="rodape-doc">
        <span><b>${v(empresa.razaoSocial)?.split(",")[0] || "KM Consultoria"}</b> · Matrícula #${idTrab}</span>
        <span>Documento emitido pelo KMZERO em ${dataEmissao}</span>
      </div>

      <!-- ════════ PÁGINA 2 — CRACHÁ A4 ════════ -->
      <div class="page-break cracha-page">
        <div class="cracha-titulo-pg">
          <h1>CARTEIRA DE IDENTIFICAÇÃO</h1>
          <div class="sub">RECORTE E PLASTIFIQUE PARA USO EM OBRA</div>
        </div>

        <div class="cracha-grid">
          <!-- 2 crachás iguais para arquivar 1 e usar 1 -->
          ${[1, 2].map(() => `
            <div class="cracha">
              <div class="cracha-header">
                <div class="cracha-logo">KM<span class="zero">ZERO</span></div>
                <div class="cracha-tagline">GESTÃO DE OBRAS</div>
              </div>
              <div class="cracha-body">
                <div class="cracha-foto">
                  <div>FOTO<br>3x4</div>
                </div>
                <div class="cracha-info">
                  <div class="cracha-nome">${v(t.nome).substring(0, 28)}</div>
                  <div class="cracha-cargo">${v(t.cargo)?.toUpperCase()}</div>
                  <div class="cracha-detalhe">
                    <b>CPF:</b> ${fmtCPF(t.cpf)}<br>
                    <b>Matrícula:</b> #${idTrab}<br>
                    <b>Admissão:</b> ${fmtData(t.admissao || t.inicio)}<br>
                    <b>Tipo Sang.:</b> ${v(t.tipoSanguineo)}<br>
                    <b>Emergência:</b> ${fmtTel(t.emergenciaTel)}
                  </div>
                </div>
              </div>
              <div class="cracha-footer">
                ${v(empresa.razaoSocial)?.split(",")[0]?.toUpperCase() || "KM CONSULTORIA"} · ${v(empresa.cnpj) || "60.368.233/0001-73"}
              </div>
            </div>
          `).join("")}
        </div>

        <div class="cracha-instrucoes">
          <b>📋 Instruções de uso:</b><br>
          1. Recorte os crachás na linha externa.<br>
          2. Cole uma foto 3x4 atual no espaço indicado.<br>
          3. Plastifique (recomenda-se laminação 125 microns).<br>
          4. Use cordão / clip da empresa.<br>
          5. Mantenha sempre visível durante as atividades em obra.<br>
          6. Em caso de perda, comunique ao responsável imediatamente.
        </div>

        <div class="rodape-doc" style="margin-top: 8mm;">
          <span><b>${v(empresa.razaoSocial)?.split(",")[0] || "KM Consultoria"}</b> · Carteira #${idTrab}</span>
          <span>Emitida em ${dataEmissao}</span>
        </div>
      </div>

    </body>
  </html>`;

  abrirOuBaixarHTML(html, `Ficha-${t.nome.replace(/[^a-z0-9]/gi, "_").substring(0, 30)}`);
}

/* ════════════════════════════════════
   DETALHE DO TRABALHADOR
════════════════════════════════════ */
function CalendarioPresenca({ trabalhador, historico }) {
  const [mesOffset, setMesOffset] = useState(0);

  const hoje = new Date();
  const ref = new Date(hoje.getFullYear(), hoje.getMonth() + mesOffset, 1);
  const ano = ref.getFullYear();
  const mes = ref.getMonth();

  const nomesMes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const diasSemana = ["D", "S", "T", "Q", "Q", "S", "S"];

  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  const statusDoDia = (dia) => {
    const mm = String(mes + 1).padStart(2, "0");
    const dd = String(dia).padStart(2, "0");
    const chaveISO = `${ano}-${mm}-${dd}`;
    const registro = historico[chaveISO] || {};
    return registro[trabalhador.id] || null;
  };

  const corFundo = (st) => {
    if (st === "Presente") return "#dcfce7";
    if (st === "Falta") return "#fee2e2";
    if (st === "Atestado") return "#fef3c7";
    return "#f8fafc";
  };
  const corTexto = (st) => {
    if (st === "Presente") return "#15803d";
    if (st === "Falta") return "#b91c1c";
    if (st === "Atestado") return "#a16207";
    return "#cbd5e1";
  };

  const celulas = [];
  for (let i = 0; i < primeiroDia; i++) celulas.push(null);
  for (let d = 1; d <= totalDias; d++) celulas.push(d);

  let contPresente = 0, contFalta = 0, contAtestado = 0;
  for (let d = 1; d <= totalDias; d++) {
    const st = statusDoDia(d);
    if (st === "Presente") contPresente++;
    else if (st === "Falta") contFalta++;
    else if (st === "Atestado") contAtestado++;
  }

  const ehMesAtual = mesOffset === 0;

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button
          onClick={() => setMesOffset(mesOffset - 1)}
          aria-label="Mês anterior"
          style={{ background: "#f1f5f9", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer", color: NAVY, fontWeight: 700 }}
        >
          ‹
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 800, color: NAVY, fontSize: 14 }}>📅 {nomesMes[mes]} {ano}</div>
          <div style={{ fontSize: 10, color: "#888" }}>Calendário de presença</div>
        </div>
        <button
          onClick={() => setMesOffset(Math.min(0, mesOffset + 1))}
          aria-label="Próximo mês"
          disabled={ehMesAtual}
          style={{ background: ehMesAtual ? "#f8fafc" : "#f1f5f9", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: ehMesAtual ? "default" : "pointer", color: ehMesAtual ? "#cbd5e1" : NAVY, fontWeight: 700 }}
        >
          ›
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {diasSemana.map((ds, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#94a3b8", padding: "2px 0" }}>{ds}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {celulas.map((dia, i) => {
          if (dia === null) return <div key={i} />;
          const st = statusDoDia(dia);
          const ehHoje = ehMesAtual && dia === hoje.getDate();
          return (
            <div
              key={i}
              style={{
                aspectRatio: "1",
                background: corFundo(st),
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                border: ehHoje ? `2px solid ${NAVY}` : "1px solid #f1f5f9",
                minHeight: 34,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: st ? corTexto(st) : "#94a3b8" }}>{dia}</div>
              {st && (
                <div style={{ fontSize: 9, lineHeight: 1 }}>
                  {st === "Presente" ? "✓" : st === "Falta" ? "✕" : "⚕"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-around", marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#15803d" }}>{contPresente}</div>
          <div style={{ fontSize: 9, color: "#888" }}>Presenças</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#b91c1c" }}>{contFalta}</div>
          <div style={{ fontSize: 9, color: "#888" }}>Faltas</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#a16207" }}>{contAtestado}</div>
          <div style={{ fontSize: 9, color: "#888" }}>Atestados</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 10, fontSize: 9, color: "#94a3b8" }}>
        <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#dcfce7", borderRadius: 2, marginRight: 3 }}></span>Presente</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#fee2e2", borderRadius: 2, marginRight: 3 }}></span>Falta</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#fef3c7", borderRadius: 2, marginRight: 3 }}></span>Atestado</span>
      </div>
    </div>
  );
}

function TelaTrabalhadorDetalhe({ trabalhador, obras, historico, rdosEmitidos = [], empresa = {}, onBack, onEditar }) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(trabalhador || {});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (!trabalhador) return null;
  const obra = obras.find(o => o.id === trabalhador.obraId);
  const dias = ultimosDias(30);
  const stats = { Presente: 0, Falta: 0, Atestado: 0, "Sem registro": 0 };
  dias.forEach(d => {
    const s = (historico[d] || {})[trabalhador.id] || "Sem registro";
    stats[s] = (stats[s] || 0) + 1;
  });
  const presPct = Math.round((stats.Presente / 30) * 100);

  const salvar = () => { onEditar(form); setEditando(false); };

  // ASO próximo do vencimento?
  let asoStatusInfo = null;
  if (trabalhador.asoValidade) {
    try {
      const validade = new Date(trabalhador.asoValidade);
      const hoje = new Date();
      const dias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
      if (dias < 0) asoStatusInfo = { texto: `Vencido há ${Math.abs(dias)} dias`, cor: RED, icon: "❌" };
      else if (dias <= 30) asoStatusInfo = { texto: `Vence em ${dias} dia(s)`, cor: ORANGE, icon: "⚠️" };
      else asoStatusInfo = { texto: `Válido por ${dias} dias`, cor: GREEN, icon: "✅" };
    } catch (e) {}
  }

  // Aniversário próximo?
  let aniversarioProximo = null;
  if (trabalhador.nasc) {
    try {
      const [d, m] = trabalhador.nasc.includes("/") ? trabalhador.nasc.split("/") : trabalhador.nasc.split("-").reverse();
      const hoje = new Date();
      const aniv = new Date(hoje.getFullYear(), parseInt(m) - 1, parseInt(d));
      if (aniv < hoje) aniv.setFullYear(hoje.getFullYear() + 1);
      const dias = Math.ceil((aniv - hoje) / (1000 * 60 * 60 * 24));
      if (dias <= 30) aniversarioProximo = dias;
    } catch (e) {}
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Detalhes" sub={trabalhador.nome} onBack={onBack} right={
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => gerarFichaCadastralPDF(trabalhador, obra, empresa)} title="Imprimir Ficha" style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>🖨️</button>
          <button onClick={() => setEditando(true)} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏️ Editar</button>
        </div>
      } />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 18, textAlign: "center", marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          {trabalhador.foto ? (
            <img src={trabalhador.foto} alt="" style={{ width: 90, height: 90, borderRadius: 45, objectFit: "cover", border: `3px solid ${NAVY}`, marginBottom: 8 }} />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: 40, background: NAVY, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 40, marginBottom: 8 }}>👷</div>
          )}
          <div style={{ fontWeight: 800, color: NAVY, fontSize: 20 }}>{trabalhador.nome}</div>
          <div style={{ fontSize: 13, color: "#666" }}>{trabalhador.cargo}</div>
          <div style={{ fontSize: 12, color: BLUE, marginTop: 4 }}>📍 {obra?.nome || "—"}</div>

          {/* Status ASO */}
          {trabalhador.asoStatus && (
            <div style={{ marginTop: 8 }}>
              <span style={{
                display: "inline-block", padding: "4px 12px", borderRadius: 14, fontSize: 11, fontWeight: 700,
                background: trabalhador.asoStatus === "Apto" ? "#f0fdf4" : trabalhador.asoStatus === "Inapto" ? "#fef2f2" : "#fff8f0",
                color: trabalhador.asoStatus === "Apto" ? GREEN : trabalhador.asoStatus === "Inapto" ? RED : ORANGE,
                border: `1px solid ${trabalhador.asoStatus === "Apto" ? GREEN : trabalhador.asoStatus === "Inapto" ? RED : ORANGE}33`,
              }}>
                {trabalhador.asoStatus === "Apto" ? "✅" : trabalhador.asoStatus === "Inapto" ? "❌" : "⚠️"} {trabalhador.asoStatus}
              </span>
            </div>
          )}

          {aniversarioProximo !== null && (
            <div style={{ marginTop: 8, background: "#fef3c7", color: "#92400e", borderRadius: 20, padding: "4px 12px", display: "inline-block", fontSize: 11, fontWeight: 700 }}>
              🎂 {aniversarioProximo === 0 ? "Aniversário hoje!" : aniversarioProximo === 1 ? "Aniversário amanhã!" : `Aniversário em ${aniversarioProximo} dias`}
            </div>
          )}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📋 Dados Pessoais</div>
          {[
            { l: "CPF", v: trabalhador.cpf || "—" },
            { l: "RG", v: trabalhador.rg || "—" },
            { l: "Nascimento", v: trabalhador.nasc || "—" },
            { l: "Telefone", v: trabalhador.tel || "—" },
            { l: "Data de início", v: trabalhador.inicio || "—" },
            { l: "💰 Diária", v: trabalhador.diaria ? `R$ ${parseFloat(trabalhador.diaria).toFixed(2)}/dia` : "—" },
            { l: "Quinzena cheia (10 dias)", v: trabalhador.diaria ? `R$ ${(parseFloat(trabalhador.diaria) * 10).toFixed(2)}` : "—" },
          ].map(d => (
            <div key={d.l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
              <span style={{ fontSize: 13, color: "#666" }}>{d.l}</span>
              <span style={{ fontSize: 13, color: NAVY, fontWeight: 600 }}>{d.v}</span>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>👕 EPI / Uniforme</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { l: "👕 Camisa", v: trabalhador.tamCamisa },
              { l: "👖 Calça", v: trabalhador.tamCalca },
              { l: "👢 Bota", v: trabalhador.tamBota },
              { l: "🧤 Luva", v: trabalhador.tamLuva },
              { l: "⛑️ Capacete", v: trabalhador.tamCapacete },
            ].map(d => (
              <div key={d.l} style={{ background: LIGHT, borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 10, color: "#888" }}>{d.l}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{d.v || "—"}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: trabalhador.epiEntregue ? "#f0fdf4" : "#fef2f2", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>{trabalhador.epiEntregue ? "✅" : "⚠️"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: trabalhador.epiEntregue ? GREEN : RED }}>
                {trabalhador.epiEntregue ? "EPI Entregue" : "EPI Pendente"}
              </div>
              {trabalhador.epiEntregue && trabalhador.epiData && (
                <div style={{ fontSize: 10, color: "#666" }}>Entregue em {new Date(trabalhador.epiData).toLocaleDateString("pt-BR")}</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📊 Frequência (30 dias)</div>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: presPct >= 80 ? GREEN : presPct >= 50 ? ORANGE : RED }}>{presPct}%</div>
            <div style={{ fontSize: 11, color: "#888" }}>Taxa de presença</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1, background: "#f0fdf4", borderRadius: 8, padding: "6px 4px", textAlign: "center" }}><div style={{ fontWeight: 800, color: GREEN }}>{stats.Presente}</div><div style={{ fontSize: 9, color: "#666" }}>Presente</div></div>
            <div style={{ flex: 1, background: "#fef2f2", borderRadius: 8, padding: "6px 4px", textAlign: "center" }}><div style={{ fontWeight: 800, color: RED }}>{stats.Falta}</div><div style={{ fontSize: 9, color: "#666" }}>Falta</div></div>
            <div style={{ flex: 1, background: "#fff8f0", borderRadius: 8, padding: "6px 4px", textAlign: "center" }}><div style={{ fontWeight: 800, color: ORANGE }}>{stats.Atestado}</div><div style={{ fontSize: 9, color: "#666" }}>Atestado</div></div>
          </div>
        </div>

        {/* CALENDÁRIO DE PRESENÇA DO MÊS */}
        <CalendarioPresenca trabalhador={trabalhador} historico={historico} />

        {/* ALIMENTAÇÃO DO MÊS */}
        {(() => {
          const hoje = new Date();
          const mes = hoje.getMonth();
          const ano = hoje.getFullYear();
          const rdosMes = rdosEmitidos.filter(r => {
            if (!r.data) return false;
            try { const [d, m, y] = r.data.split("/"); return parseInt(m) - 1 === mes && parseInt(y) === ano; } catch { return false; }
          });
          let qtdManha = 0, qtdTarde = 0, qtdMarmita = 0, qtdLanche = 0, totalAli = 0;
          rdosMes.forEach(r => {
            const ali = (r.alimentacao || {})[trabalhador.id];
            if (!ali) return;
            if (ali.cafeManha) { qtdManha++; totalAli += (empresa.valorCafeManha || 4); }
            if (ali.cafeTarde) { qtdTarde++; totalAli += (empresa.valorCafeTarde || 4); }
            if (ali.marmita) { qtdMarmita++; totalAli += (empresa.valorMarmita || 18); }
            if (ali.lanche) { qtdLanche++; totalAli += (empresa.valorLanche || 10); }
          });
          if (rdosMes.length === 0) return null;
          return (
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 800, color: NAVY, fontSize: 14, flex: 1 }}>☕ Alimentação no mês</div>
                <div style={{ background: "#dc7e00", color: "#fff", padding: "4px 10px", borderRadius: 6, fontWeight: 800, fontSize: 13 }}>R$ {totalAli.toFixed(2)}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                <div style={{ background: "#fef9e7", padding: 8, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#92400e" }}>{qtdManha}</div>
                  <div style={{ fontSize: 9, color: "#666" }}>☕ Manhã</div>
                </div>
                <div style={{ background: "#fef9e7", padding: 8, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#b45309" }}>{qtdTarde}</div>
                  <div style={{ fontSize: 9, color: "#666" }}>☕ Tarde</div>
                </div>
                <div style={{ background: "#fef2f2", padding: 8, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#dc2626" }}>{qtdMarmita}</div>
                  <div style={{ fontSize: 9, color: "#666" }}>🍱 Marmita</div>
                </div>
                <div style={{ background: "#f0f7ff", padding: 8, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0891b2" }}>{qtdLanche}</div>
                  <div style={{ fontSize: 9, color: "#666" }}>🥪 Lanche</div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: "#888", marginTop: 8, textAlign: "center", fontStyle: "italic" }}>Baseado em {rdosMes.length} RDO(s) no mês</div>
            </div>
          );
        })()}

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>🏥 Exame Médico (ASO)</div>
          {!trabalhador.asoData && !trabalhador.asoValidade ? (
            <div style={{ color: "#aaa", fontSize: 12, fontStyle: "italic", textAlign: "center", padding: 8 }}>Nenhum exame cadastrado.</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
                <span style={{ fontSize: 13, color: "#666" }}>Data do exame</span>
                <span style={{ fontSize: 13, color: NAVY, fontWeight: 600 }}>{trabalhador.asoData ? new Date(trabalhador.asoData).toLocaleDateString("pt-BR") : "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
                <span style={{ fontSize: 13, color: "#666" }}>Validade</span>
                <span style={{ fontSize: 13, color: NAVY, fontWeight: 600 }}>{trabalhador.asoValidade ? new Date(trabalhador.asoValidade).toLocaleDateString("pt-BR") : "—"}</span>
              </div>
              {asoStatusInfo && (
                <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: asoStatusInfo.cor === RED ? "#fef2f2" : asoStatusInfo.cor === ORANGE ? "#fff8f0" : "#f0fdf4", color: asoStatusInfo.cor, fontWeight: 700, fontSize: 13, textAlign: "center" }}>
                  {asoStatusInfo.icon} {asoStatusInfo.texto}
                </div>
              )}
            </>
          )}
        </div>

        {(trabalhador.docCtps || trabalhador.docCpf || trabalhador.docComprov) && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📋 Documentos Anexados</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { k: "docCtps", l: "CTPS", icon: "📘" },
                { k: "docCpf", l: "CPF/RG", icon: "🆔" },
                { k: "docComprov", l: "Residência", icon: "🏠" },
              ].map(d => (
                <div key={d.k} style={{ textAlign: "center" }}>
                  {trabalhador[d.k] ? (
                    <a href={trabalhador[d.k]} target="_blank" rel="noreferrer">
                      <img src={trabalhador[d.k]} alt={d.l} style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid #dde2ef", cursor: "pointer" }} />
                    </a>
                  ) : (
                    <div style={{ height: 80, background: LIGHT, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#ccc" }}>—</div>
                  )}
                  <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>{d.icon} {d.l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {trabalhador.tel && (
          <a href={`https://wa.me/55${trabalhador.tel.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ display: "block", textDecoration: "none", marginBottom: 12 }}>
            <div style={{ background: "#25D366", color: "#fff", borderRadius: 12, padding: "12px 16px", textAlign: "center", fontWeight: 700, fontSize: 14, boxShadow: "0 3px 10px #25D36644" }}>
              💬 Chamar no WhatsApp
            </div>
          </a>
        )}

        {/* IMPRIMIR FICHA CADASTRAL */}
        <button onClick={() => gerarFichaCadastralPDF(trabalhador, obra, empresa)} style={{ width: "100%", background: NAVY, color: "#fff", border: "none", borderRadius: 12, padding: "14px", marginTop: 10, fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 14px rgba(15,33,81,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          🖨️ IMPRIMIR FICHA CADASTRAL (A4)
        </button>
        <div style={{ fontSize: 10, color: "#888", textAlign: "center", marginTop: 4, fontStyle: "italic" }}>Documento oficial pra arquivo físico (gaveteiro)</div>
      </div>
      <KMFooter />

      <Modal show={editando} title="Editar Trabalhador" onClose={() => setEditando(false)}>
        {/* FOTO */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          {form.foto ? (
            <div style={{ position: "relative", display: "inline-block" }}>
              <img src={form.foto} alt="" style={{ width: 80, height: 80, borderRadius: 40, objectFit: "cover", border: `2px solid ${NAVY}` }} />
              <button onClick={() => set("foto", null)} style={{ position: "absolute", top: -4, right: -4, background: RED, color: "#fff", border: "none", borderRadius: 12, width: 24, height: 24, fontSize: 12, cursor: "pointer" }}>✕</button>
            </div>
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: 40, background: "#dde6f5", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>👤</div>
          )}
          <div style={{ marginTop: 6 }}>
            <label style={{ background: "#eef2ff", border: "none", borderRadius: 16, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: NAVY, cursor: "pointer", display: "inline-block" }}>
              📷 {form.foto ? "Trocar" : "Adicionar foto"}
              <input type="file" accept="image/*" capture="user" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => set("foto", ev.target.result); r.readAsDataURL(f); }} style={{ display: "none" }} />
            </label>
          </div>
        </div>

        <div style={{ fontSize: 13, color: "#666", marginBottom: 10, fontWeight: 700 }}>👤 Dados Pessoais</div>
        <label style={labelS}>Nome Completo</label>
        <input value={form.nome || ""} onChange={e => set("nome", e.target.value)} style={inputS} />
        <label style={labelS}>CPF</label>
        <input value={form.cpf || ""} onChange={e => set("cpf", e.target.value)} placeholder="000.000.000-00" style={inputS} />
        <label style={labelS}>RG</label>
        <input value={form.rg || ""} onChange={e => set("rg", e.target.value)} placeholder="00.000.000-0" style={inputS} />
        <label style={labelS}>Data de Nascimento</label>
        <input value={form.nasc || ""} onChange={e => set("nasc", e.target.value)} placeholder="DD/MM/AAAA" style={inputS} />
        <label style={labelS}>Estado Civil</label>
        <select value={form.estadoCivil || ""} onChange={e => set("estadoCivil", e.target.value)} style={selS}>
          <option value="">—</option><option>Solteiro(a)</option><option>Casado(a)</option><option>União Estável</option><option>Divorciado(a)</option><option>Viúvo(a)</option>
        </select>
        <label style={labelS}>Naturalidade (cidade-UF onde nasceu)</label>
        <input value={form.naturalidade || ""} onChange={e => set("naturalidade", e.target.value)} placeholder="Ex: Alegre - ES" style={inputS} />
        <label style={labelS}>Nome do Pai</label>
        <input value={form.nomePai || ""} onChange={e => set("nomePai", e.target.value)} style={inputS} />
        <label style={labelS}>Nome da Mãe</label>
        <input value={form.nomeMae || ""} onChange={e => set("nomeMae", e.target.value)} style={inputS} />

        <div style={{ fontSize: 13, color: "#666", marginBottom: 10, fontWeight: 700, marginTop: 10 }}>📞 Contato</div>
        <label style={labelS}>Telefone / WhatsApp</label>
        <input value={form.tel || ""} onChange={e => set("tel", e.target.value)} placeholder="(27) 9 0000-0000" style={inputS} />
        <label style={labelS}>Telefone para recado</label>
        <input value={form.telRecado || ""} onChange={e => set("telRecado", e.target.value)} placeholder="(27) 0000-0000" style={inputS} />
        <label style={labelS}>E-mail</label>
        <input value={form.email || ""} onChange={e => set("email", e.target.value)} placeholder="email@exemplo.com" style={inputS} />
        <label style={labelS}>Endereço completo</label>
        <input value={form.endereco || ""} onChange={e => set("endereco", e.target.value)} placeholder="Rua, número, complemento" style={inputS} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelS}>Bairro</label>
            <input value={form.bairro || ""} onChange={e => set("bairro", e.target.value)} style={inputS} />
          </div>
          <div>
            <label style={labelS}>Cidade / UF</label>
            <input value={form.cidade || ""} onChange={e => set("cidade", e.target.value)} placeholder="Alegre - ES" style={inputS} />
          </div>
        </div>
        <label style={labelS}>CEP</label>
        <input value={form.cep || ""} onChange={e => set("cep", e.target.value)} placeholder="29500-000" style={inputS} />

        <div style={{ fontSize: 13, color: "#666", marginBottom: 10, fontWeight: 700, marginTop: 10 }}>💼 Contratuais</div>
        <label style={labelS}>Cargo</label>
        <select value={form.cargo || ""} onChange={e => set("cargo", e.target.value)} style={selS}>
          <option value="">Selecione</option>
          {CARGOS.map(c => <option key={c}>{c}</option>)}
        </select>
        <label style={labelS}>Obra</label>
        <select value={form.obraId || ""} onChange={e => set("obraId", parseInt(e.target.value))} style={selS}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <label style={labelS}>Data de Admissão</label>
        <input value={form.admissao || form.inicio || ""} onChange={e => set("admissao", e.target.value)} type="date" style={inputS} />
        <label style={labelS}>💰 Valor da Diária (R$/dia)</label>
        <input value={form.diaria || ""} onChange={e => set("diaria", e.target.value)} type="number" placeholder="100" style={inputS} />
        <label style={labelS}>CTPS / PIS</label>
        <input value={form.ctps || ""} onChange={e => set("ctps", e.target.value)} placeholder="Carteira de Trabalho ou PIS" style={inputS} />

        <div style={{ fontSize: 13, color: "#666", marginBottom: 10, fontWeight: 700, marginTop: 10 }}>💼 Folha de Pagamento</div>
        <div style={{ background: "#fff7e6", border: `1px solid ${GOLD}`, borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontSize: 11, color: "#7c6f3a", lineHeight: 1.5 }}>
          💡 Defina como esse trabalhador será pago. Cada um pode ter seu próprio regime (semanal, quinzenal ou mensal).
        </div>
        <label style={labelS}>Tipo de folha</label>
        <select value={form.tipoFolha || "quinzenal"} onChange={e => set("tipoFolha", e.target.value)} style={selS}>
          <option value="semanal">📅 Semanal (7 dias)</option>
          <option value="quinzenal">📆 Quinzenal (15 dias) — padrão</option>
          <option value="mensal">🗓️ Mensal (30 dias)</option>
          <option value="personalizado">⚙️ Personalizado (cliente define)</option>
        </select>
        {form.tipoFolha === "semanal" && (
          <>
            <label style={labelS}>Dia de pagamento da semana</label>
            <select value={form.diaPagamento || "Sexta-feira"} onChange={e => set("diaPagamento", e.target.value)} style={selS}>
              <option>Segunda-feira</option>
              <option>Terça-feira</option>
              <option>Quarta-feira</option>
              <option>Quinta-feira</option>
              <option>Sexta-feira</option>
              <option>Sábado</option>
              <option>Domingo</option>
            </select>
          </>
        )}
        {form.tipoFolha === "quinzenal" && (
          <>
            <label style={labelS}>Dias de fechamento da quinzena</label>
            <select value={form.diaFechamento || "1_15"} onChange={e => set("diaFechamento", e.target.value)} style={selS}>
              <option value="1_15">Dia 1 ao 15 | Dia 16 ao último</option>
              <option value="3_17">Dia 3 ao 17 | Dia 18 ao 2 (mês seguinte)</option>
              <option value="5_20">Dia 5 ao 20 | Dia 21 ao 4 (mês seguinte)</option>
              <option value="custom">Personalizado (defino na folha)</option>
            </select>
          </>
        )}
        {form.tipoFolha === "mensal" && (
          <>
            <label style={labelS}>Dia de pagamento do mês</label>
            <input value={form.diaPagamentoMes || "5"} onChange={e => set("diaPagamentoMes", e.target.value)} type="number" min="1" max="31" placeholder="Ex: 5 (todo dia 5)" style={inputS} />
            <label style={labelS}>Início do período de cálculo</label>
            <select value={form.inicioMes || "1"} onChange={e => set("inicioMes", e.target.value)} style={selS}>
              <option value="1">Dia 1 ao último dia do mês</option>
              <option value="21_anterior">Dia 21 do mês anterior ao 20 do mês</option>
              <option value="custom">Personalizado</option>
            </select>
          </>
        )}
        {form.tipoFolha === "personalizado" && (
          <div style={{ background: "#eff6ff", border: `1px solid ${BLUE}`, borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontSize: 11, color: "#1e3a8a", lineHeight: 1.5 }}>
            ℹ️ O período da folha será definido manualmente cada vez que você gerar a folha desse trabalhador.
          </div>
        )}
        <label style={labelS}>Forma de cálculo do dia</label>
        <select value={form.formaCalculo || "diaria"} onChange={e => set("formaCalculo", e.target.value)} style={selS}>
          <option value="diaria">Por diária (R$ × dias trabalhados)</option>
          <option value="mensal_fixo">Salário mensal fixo (sem variação)</option>
          <option value="hora">Por hora trabalhada (em breve)</option>
          <option value="producao">Por produção / empreitada (em breve)</option>
        </select>
        {form.formaCalculo === "mensal_fixo" && (
          <>
            <label style={labelS}>Salário mensal fixo (R$)</label>
            <input value={form.salarioFixo || ""} onChange={e => set("salarioFixo", e.target.value)} type="number" placeholder="Ex: 3000" style={inputS} />
          </>
        )}

        <div style={{ fontSize: 13, color: "#666", marginBottom: 10, fontWeight: 700, marginTop: 10 }}>🏥 Saúde / ASO</div>
        <label style={labelS}>Data do exame</label>
        <input value={form.asoData || ""} onChange={e => set("asoData", e.target.value)} type="date" style={inputS} />
        <label style={labelS}>Validade</label>
        <input value={form.asoValidade || ""} onChange={e => set("asoValidade", e.target.value)} type="date" style={inputS} />
        <label style={labelS}>Status</label>
        <select value={form.asoStatus || "Apto"} onChange={e => set("asoStatus", e.target.value)} style={selS}>
          <option>Apto</option><option>Apto com restrições</option><option>Inapto</option>
        </select>
        <label style={labelS}>Tipo Sanguíneo</label>
        <select value={form.tipoSanguineo || ""} onChange={e => set("tipoSanguineo", e.target.value)} style={selS}>
          <option value="">—</option>{["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(t => <option key={t}>{t}</option>)}
        </select>
        <label style={labelS}>Alergias / Condições Médicas</label>
        <input value={form.condicoesMedicas || ""} onChange={e => set("condicoesMedicas", e.target.value)} placeholder="Ex: hipertensão, alergia a antibiótico" style={inputS} />
        <label style={labelS}>Convênio / Plano de Saúde</label>
        <input value={form.convenio || ""} onChange={e => set("convenio", e.target.value)} style={inputS} />

        <div style={{ fontSize: 13, color: "#666", marginBottom: 10, fontWeight: 700, marginTop: 10 }}>🚨 Contato de Emergência</div>
        <label style={labelS}>Nome</label>
        <input value={form.emergenciaNome || ""} onChange={e => set("emergenciaNome", e.target.value)} style={inputS} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelS}>Parentesco</label>
            <input value={form.emergenciaParentesco || ""} onChange={e => set("emergenciaParentesco", e.target.value)} placeholder="Esposa, Pai, Irmão..." style={inputS} />
          </div>
          <div>
            <label style={labelS}>Telefone</label>
            <input value={form.emergenciaTel || ""} onChange={e => set("emergenciaTel", e.target.value)} placeholder="(27) 9 0000-0000" style={inputS} />
          </div>
        </div>

        <div style={{ fontSize: 13, color: "#666", marginBottom: 10, fontWeight: 700, marginTop: 10 }}>🏦 Dados Bancários</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelS}>Banco</label>
            <input value={form.banco || ""} onChange={e => set("banco", e.target.value)} placeholder="Ex: Caixa, BB" style={inputS} />
          </div>
          <div>
            <label style={labelS}>Tipo</label>
            <select value={form.tipoConta || ""} onChange={e => set("tipoConta", e.target.value)} style={selS}>
              <option value="">—</option><option>Corrente</option><option>Poupança</option>
            </select>
          </div>
          <div>
            <label style={labelS}>Agência</label>
            <input value={form.agencia || ""} onChange={e => set("agencia", e.target.value)} style={inputS} />
          </div>
          <div>
            <label style={labelS}>Conta</label>
            <input value={form.conta || ""} onChange={e => set("conta", e.target.value)} style={inputS} />
          </div>
        </div>
        <label style={labelS}>Chave PIX</label>
        <input value={form.pix || ""} onChange={e => set("pix", e.target.value)} placeholder="CPF, telefone, email ou chave aleatória" style={inputS} />

        <div style={{ fontSize: 13, color: "#666", marginBottom: 10, fontWeight: 700, marginTop: 10 }}>👕 EPI / Uniforme</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelS}>Camisa</label>
            <select value={form.tamCamisa || ""} onChange={e => set("tamCamisa", e.target.value)} style={selS}>
              <option value="">—</option>{["PP", "P", "M", "G", "GG", "XGG", "XXGG"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelS}>Calça</label>
            <select value={form.tamCalca || ""} onChange={e => set("tamCalca", e.target.value)} style={selS}>
              <option value="">—</option>{["36", "38", "40", "42", "44", "46", "48", "50", "52"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelS}>Bota</label>
            <select value={form.tamBota || ""} onChange={e => set("tamBota", e.target.value)} style={selS}>
              <option value="">—</option>{["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelS}>Luva</label>
            <select value={form.tamLuva || ""} onChange={e => set("tamLuva", e.target.value)} style={selS}>
              <option value="">—</option>{["P", "M", "G", "GG"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <label style={labelS}>Capacete</label>
        <select value={form.tamCapacete || ""} onChange={e => set("tamCapacete", e.target.value)} style={selS}>
          <option value="">—</option>
          <option>Único (ajustável)</option><option>Pequeno</option><option>Médio</option><option>Grande</option>
        </select>

        <div style={{ background: "#f0f7ff", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: NAVY, fontWeight: 600 }}>
            <input type="checkbox" checked={!!form.epiEntregue} onChange={e => set("epiEntregue", e.target.checked)} style={{ width: 18, height: 18 }} />
            EPI/Uniforme entregue
          </label>
          {form.epiEntregue && (
            <div style={{ marginTop: 8 }}>
              <label style={labelS}>Data de entrega</label>
              <input value={form.epiData || ""} onChange={e => set("epiData", e.target.value)} type="date" style={{ ...inputS, marginBottom: 0 }} />
            </div>
          )}
        </div>

        <label style={labelS}>📝 Observações Gerais</label>
        <textarea value={form.observacoes || ""} onChange={e => set("observacoes", e.target.value)} rows={3} placeholder="Anotações importantes sobre o colaborador" style={{ ...inputS, fontFamily: "inherit" }} />

        <Btn label="💾 SALVAR" color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   MENSAGENS
════════════════════════════════════ */
function TelaMensagens({ usuario, usuarios, mensagens, onBack, onEnviar, onMarcarLida }) {
  const [composicao, setComposicao] = useState(false);
  const [destinatario, setDestinatario] = useState("");
  const [texto, setTexto] = useState("");
  const isGestor = usuario.perfil === "gestor";
  const minhasMsgs = mensagens
    .filter(m => m.para === usuario.id || m.de === usuario.id)
    .sort((a, b) => b.ts - a.ts);

  useEffect(() => {
    mensagens.forEach(m => { if (m.para === usuario.id && !m.lida) onMarcarLida(m.id); });
  }, []);

  const enviar = () => {
    if (!destinatario || !texto.trim()) return;
    onEnviar({ id: Date.now(), de: usuario.id, para: parseInt(destinatario), texto: texto.trim(), ts: Date.now(), lida: false });
    setTexto(""); setDestinatario(""); setComposicao(false);
  };

  const contatos = isGestor
    ? usuarios.filter(u => u.perfil === "encarregado")
    : usuarios.filter(u => u.perfil === "gestor");

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Mensagens" sub={isGestor ? "Comunique-se com encarregados" : "Avisos do gestor"} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {composicao ? (
          <>
            <label style={labelS}>Para</label>
            <select value={destinatario} onChange={e => setDestinatario(e.target.value)} style={selS}>
              <option value="">Selecione</option>
              {contatos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <label style={labelS}>Mensagem</label>
            <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={5} placeholder="Escreva sua mensagem..." style={{ ...inputS, resize: "none", fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setComposicao(false)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "#eee", color: NAVY, fontWeight: 800, cursor: "pointer" }}>Cancelar</button>
              <button onClick={enviar} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: destinatario && texto.trim() ? GREEN : "#ccc", color: "#fff", fontWeight: 800, cursor: "pointer" }}>📤 Enviar</button>
            </div>
          </>
        ) : (
          <>
            {isGestor && <Btn label="✏️ Nova Mensagem" color={NAVY} onClick={() => setComposicao(true)} style={{ marginBottom: 12 }} />}
            {minhasMsgs.length === 0 && <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", color: "#aaa" }}>📭 Nenhuma mensagem.</div>}
            {minhasMsgs.map(m => {
              const enviada = m.de === usuario.id;
              const outro = usuarios.find(u => u.id === (enviada ? m.para : m.de));
              return (
                <div key={m.id} style={{ background: enviada ? "#dde6f5" : "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, marginLeft: enviada ? 30 : 0, marginRight: enviada ? 0 : 30, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
                    {enviada ? `Para: ${outro?.nome}` : `De: ${outro?.nome}`} • {new Date(m.ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div style={{ fontSize: 14, color: NAVY }}>{m.texto}</div>
                </div>
              );
            })}
          </>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   CALENDÁRIO DE PRESENÇAS
════════════════════════════════════ */
function TelaCalendario({ obras, trabalhadores, historico, onBack }) {
  const [obraId, setObraId] = useState(obras[0]?.id || 1);
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [diaSel, setDiaSel] = useState(null);

  const trabObra = trabalhadores.filter(t => t.obraId === obraId);
  const primDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < primDia; i++) cells.push(null);
  for (let d = 1; d <= totalDias; d++) cells.push(d);

  const corDoDia = (d) => {
    if (!d) return "transparent";
    const iso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const pres = historico[iso];
    if (!pres) return "#f0f0f0";
    const total = trabObra.length;
    const presentes = trabObra.filter(t => pres[t.id] === "Presente").length;
    if (total === 0) return "#f0f0f0";
    const pct = presentes / total;
    if (pct >= 0.8) return GREEN;
    if (pct >= 0.5) return ORANGE;
    return RED;
  };

  const navMes = (delta) => {
    const novo = new Date(ano, mes + delta, 1);
    setMes(novo.getMonth()); setAno(novo.getFullYear());
  };

  const isoDia = diaSel ? `${ano}-${String(mes + 1).padStart(2, "0")}-${String(diaSel).padStart(2, "0")}` : null;
  const presenDia = isoDia ? historico[isoDia] || {} : {};
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Calendário" sub="Histórico de presenças" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <select value={obraId} onChange={e => setObraId(parseInt(e.target.value))} style={{ ...selS, marginBottom: 12 }}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button onClick={() => navMes(-1)} style={{ background: LIGHT, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 16 }}>‹</button>
            <div style={{ fontWeight: 800, color: NAVY, fontSize: 14 }}>{meses[mes]} {ano}</div>
            <button onClick={() => navMes(1)} style={{ background: LIGHT, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 16 }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 11, color: "#888", fontWeight: 700 }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
            {cells.map((d, i) => (
              <button key={i} disabled={!d} onClick={() => setDiaSel(d)} style={{
                aspectRatio: "1", border: diaSel === d ? `2px solid ${NAVY}` : "none", borderRadius: 8,
                background: corDoDia(d), color: !d || corDoDia(d) === "#f0f0f0" ? "#888" : "#fff",
                fontWeight: 700, fontSize: 13, cursor: d ? "pointer" : "default", opacity: d ? 1 : 0,
              }}>{d || ""}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 12, fontSize: 10, color: "#666", justifyContent: "center" }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: GREEN, borderRadius: 2, marginRight: 4 }}></span>≥80%</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: ORANGE, borderRadius: 2, marginRight: 4 }}></span>50-79%</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: RED, borderRadius: 2, marginRight: 4 }}></span>&lt;50%</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#f0f0f0", borderRadius: 2, marginRight: 4 }}></span>Sem dados</span>
          </div>
        </div>

        {diaSel && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📅 Dia {diaSel}/{mes + 1}/{ano}</div>
            {trabObra.length === 0 && <div style={{ color: "#aaa", fontSize: 13 }}>Sem trabalhadores nesta obra.</div>}
            {trabObra.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", paddingBottom: 6, marginBottom: 6, borderBottom: "1px solid #f0f0f0" }}>
                <span style={{ flex: 1, fontSize: 13, color: NAVY }}>{t.nome}</span>
                <Badge label={presenDia[t.id] || "—"} color={STATUS_COLOR[presenDia[t.id]] || "#888"} small />
              </div>
            ))}
          </div>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   FOLHA DE PAGAMENTO
════════════════════════════════════ */
function TelaFolha({ obras, trabalhadores, historico, onBack }) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [obraId, setObraId] = useState("todas");

  const totalDiasUteis = (() => {
    const total = new Date(ano, mes + 1, 0).getDate();
    let count = 0;
    for (let d = 1; d <= total; d++) {
      const dt = new Date(ano, mes, d).getDay();
      if (dt !== 0) count++; // dom = 0
    }
    return count;
  })();

  const trabFiltro = obraId === "todas" ? trabalhadores : trabalhadores.filter(t => t.obraId === parseInt(obraId));

  const calcular = (t) => {
    const total = new Date(ano, mes + 1, 0).getDate();
    let presentes = 0, faltas = 0, atestados = 0;
    for (let d = 1; d <= total; d++) {
      const iso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const s = (historico[iso] || {})[t.id];
      if (s === "Presente") presentes++;
      else if (s === "Falta") faltas++;
      else if (s === "Atestado") atestados++;
    }
    const diaria = parseFloat(t.diaria) || 0;
    const diasPagos = presentes + atestados;
    const bruto = diaria * diasPagos;
    return { presentes, faltas, atestados, diaria, diasPagos, bruto, liquido: bruto };
  };

  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const totalFolha = trabFiltro.reduce((s, t) => s + calcular(t).liquido, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Folha de Pagamento" sub={`${meses[mes]}/${ano}`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <select value={mes} onChange={e => setMes(parseInt(e.target.value))} style={{ ...selS, flex: 2, marginBottom: 0 }}>
            {meses.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(parseInt(e.target.value))} style={{ ...selS, flex: 1, marginBottom: 0 }}>
            {[ano - 1, ano, ano + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <select value={obraId} onChange={e => setObraId(e.target.value)} style={{ ...selS, marginBottom: 12 }}>
          <option value="todas">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ background: `linear-gradient(135deg,${GREEN},#1a8540)`, borderRadius: 14, padding: 16, marginBottom: 12, color: "#fff", boxShadow: "0 4px 14px #2aa84f44" }}>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Total da folha (líquido)</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>R$ {totalFolha.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>{trabFiltro.length} trabalhador(es) • {totalDiasUteis} dias úteis</div>
        </div>

        {trabFiltro.filter(t => { const c = calcular(t); return c.diasPagos > 0; }).map(t => {
          const c = calcular(t);
          return (
            <div key={t.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{t.nome}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{t.cargo}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: GREEN }}>R$ {c.liquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>{c.diasPagos} dias × R$ {c.diaria.toFixed(2)}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, fontSize: 10 }}>
                <span style={{ background: "#f0fdf4", color: GREEN, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>✓ {c.presentes}</span>
                <span style={{ background: "#fef2f2", color: RED, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>✗ {c.faltas}</span>
                <span style={{ background: "#fff8f0", color: ORANGE, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>📋 {c.atestados}</span>
              </div>
            </div>
          );
        })}
        {trabFiltro.filter(t => { const c = calcular(t); return c.diasPagos > 0; }).length === 0 && <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", color: "#aaa" }}>Nenhum trabalhador com dias trabalhados no mês.</div>}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   DIÁRIO DE OBRA — anotações livres
════════════════════════════════════ */
function TelaDiario({ obra, usuario, diario, fotosObras = [], onBack, onAdd, onRemove, onSalvarFotoObra }) {
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [erroVoz, setErroVoz] = useState("");
  const [fotoVer, setFotoVer] = useState(null); // visualização fullscreen
  const minhasObras = diario.filter(d => d.obraId === obra.id).sort((a, b) => b.ts - a.ts);

  const adicionar = async () => {
    if (!texto.trim() && !foto) return;
    setSalvando(true);

    let fotoFinal = foto;

    // Se tem foto, carimba antes de salvar
    if (foto) {
      const dataAtual = new Date().toLocaleDateString("pt-BR");
      const horaAtual = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const autorNome = usuario?.nome || "—";
      const totalFotosObra = (fotosObras || []).filter(f => f.obraId === obra.id).length;
      const numeroFoto = totalFotosObra + 1;

      try {
        fotoFinal = await carimbarFoto(foto, {
          numero: numeroFoto,
          obra: obra.nome,
          autor: autorNome,
          data: dataAtual,
          hora: horaAtual,
        });

        // Manda pra galeria também
        if (onSalvarFotoObra) {
          onSalvarFotoObra({
            id: Date.now(),
            numero: numeroFoto,
            obraId: obra.id,
            obraNome: obra.nome,
            foto: fotoFinal,
            legenda: texto.trim().substring(0, 80) || "📒 Diário de obra",
            autor: autorNome,
            data: dataAtual,
            hora: horaAtual,
            origemDiario: true,
          });
        }
      } catch (e) {
        console.warn("Carimbo falhou:", e);
      }
    }

    onAdd({ id: Date.now(), obraId: obra.id, autor: usuario?.nome || "—", texto: texto.trim(), foto: fotoFinal, ts: Date.now() });
    setTexto("");
    setFoto(null);
    setSalvando(false);
  };

  const tirarFoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => setFoto(ev.target.result);
    r.readAsDataURL(f);
  };

  const iniciarVoz = () => {
    setErroVoz("");
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setErroVoz("Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge no celular.");
      return;
    }
    const rec = new SpeechRec();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    let textoFinal = texto;
    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) textoFinal += transcript + " ";
        else interim += transcript;
      }
      setTexto(textoFinal + interim);
    };
    rec.onerror = (e) => { setErroVoz("Erro: " + e.error); setGravando(false); };
    rec.onend = () => setGravando(false);
    rec.start();
    setRecognition(rec);
    setGravando(true);
  };

  const pararVoz = () => {
    if (recognition) recognition.stop();
    setGravando(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Diário de Obra" sub={obra.nome} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={4} placeholder="Anote aqui ou use o botão de voz: incidentes, observações, mudanças, problemas..." style={{ ...inputS, resize: "none", fontFamily: "inherit", marginBottom: 8 }} />

          {!gravando ? (
            <button onClick={iniciarVoz} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontWeight: 800, cursor: "pointer", marginBottom: 8, boxShadow: "0 3px 10px #dc262644", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              🎤 Ditar por Voz
            </button>
          ) : (
            <button onClick={pararVoz} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontWeight: 800, cursor: "pointer", marginBottom: 8, animation: "pulse 1.5s infinite", boxShadow: "0 3px 10px #dc262688", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, background: "#fff", borderRadius: 5, animation: "blink 0.8s infinite" }}></span>
              ⏹️ Parar Gravação (gravando...)
            </button>
          )}

          {erroVoz && <div style={{ background: "#fef2f2", color: RED, padding: "6px 10px", borderRadius: 6, fontSize: 11, marginBottom: 8 }}>⚠️ {erroVoz}</div>}

          {/* Anexar foto na ocorrência */}
          {foto ? (
            <div style={{ position: "relative", marginBottom: 8 }}>
              <img src={foto} alt="Foto" style={{ width: "100%", borderRadius: 10, border: "1.5px solid #dde2ef" }} />
              <button onClick={() => setFoto(null)} style={{ position: "absolute", top: 6, right: 6, background: RED, color: "#fff", border: "none", borderRadius: 16, width: 28, height: 28, cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
          ) : (
            <label style={{ display: "block", textAlign: "center", padding: 10, marginBottom: 8, border: "1.5px dashed #dde2ef", borderRadius: 10, color: "#666", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              📷 Anexar foto (opcional)
              <input type="file" accept="image/*" capture="environment" onChange={tirarFoto} style={{ display: "none" }} />
            </label>
          )}

          {foto && (
            <div style={{ background: "#f0f7ff", borderRadius: 8, padding: "6px 10px", marginBottom: 8, fontSize: 10, color: "#0c4a6e", textAlign: "center" }}>
              💡 Foto será <b>carimbada</b> e enviada pra galeria
            </div>
          )}
          <Btn label={salvando ? "⏳ Carimbando foto..." : "📝 Adicionar Anotação"} color={salvando ? "#ccc" : NAVY} disabled={salvando} onClick={adicionar} />
        </div>

        <style>{`@keyframes blink { 50% { opacity: 0.3; } } @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.02); } }`}</style>

        {minhasObras.length === 0 && <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", color: "#aaa" }}>📓 Nenhuma anotação ainda.</div>}

        {minhasObras.map(d => (
          <div key={d.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${BLUE}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>📌 {d.autor} • {new Date(d.ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
              {(() => {
                const isGestor = usuario && usuario.perfil === "gestor";
                const ehMeuLancamentoDeHoje = usuario && d.autor === usuario.nome && (Date.now() - d.ts) < 24 * 60 * 60 * 1000;
                if (isGestor || ehMeuLancamentoDeHoje) {
                  return <button onClick={() => onRemove(d.id)} style={{ background: "#fee2e2", border: "2px solid #d63b3b", color: "#d63b3b", cursor: "pointer", fontSize: 16, padding: "6px 10px", borderRadius: 8, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>;
                }
                return null;
              })()}
            </div>
            {d.texto && <div style={{ fontSize: 14, color: NAVY, whiteSpace: "pre-wrap", lineHeight: 1.4, marginBottom: d.foto ? 8 : 0 }}>{d.texto}</div>}
            {d.foto && <img src={d.foto} alt="Foto da ocorrência" onClick={() => setFotoVer({ src: d.foto, legenda: d.texto })} style={{ width: "100%", borderRadius: 8, border: "1px solid #eee", cursor: "pointer" }} />}
          </div>
        ))}
      </div>
      <KMFooter />
      {fotoVer && <FotoViewer src={fotoVer.src} legenda={fotoVer.legenda} onClose={() => setFotoVer(null)} />}
    </div>
  );
}

/* ════════════════════════════════════
   GESTÃO DE EQUIPAMENTOS (adicionar/editar)
════════════════════════════════════ */
function TelaEquipamentosGestao({ obras, equips, onBack, onAdd, onEditar, onRemover }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [filtroObra, setFiltroObra] = useState("todas");
  const [form, setForm] = useState({ nome: "", codigo: "", obraId: "", status: "Disponível", icon: "🔧" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lista = filtroObra === "todas" ? equips : equips.filter(e => e.obraId === parseInt(filtroObra));

  const abrirNovo = () => { setEditandoId(null); setForm({ nome: "", codigo: "", obraId: "", status: "Disponível", icon: "🔧" }); setModal(true); };
  const abrirEdit = (eq) => { setEditandoId(eq.id); setForm(eq); setModal(true); };
  const salvar = () => {
    if (!form.nome || !form.codigo || !form.obraId) return;
    if (editandoId) onEditar({ ...form, id: editandoId });
    else onAdd({ ...form, id: Date.now(), obraId: parseInt(form.obraId) });
    setModal(false);
  };

  const ICONS = ["🔧", "🔄", "🏗️", "⚙️", "🔨", "🪓", "🧰", "🪛", "⛏️", "🪜"];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Equipamentos" sub="Gestão completa" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 12 }}>
        <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ ...selS, marginBottom: 12 }}>
          <option value="todas">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        {lista.map(eq => {
          const obra = obras.find(o => o.id === eq.obraId);
          return (
            <div key={eq.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 30, marginRight: 12 }}>{eq.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{eq.nome}</div>
                <div style={{ fontSize: 11, color: "#999" }}>{eq.codigo} • {obra?.nome}</div>
              </div>
              <Badge label={eq.status} color={EQUIP_COLOR[eq.status] || "#888"} small />
              <button onClick={() => abrirEdit(eq)} style={{ background: "none", border: "none", color: BLUE, fontSize: 16, marginLeft: 8, cursor: "pointer" }}>✏️</button>
              <button onClick={() => onRemover(eq.id)} style={{ background: "#fee2e2", border: "2px solid #d63b3b", color: "#d63b3b", fontSize: 16, marginLeft: 4, cursor: "pointer", padding: "6px 10px", borderRadius: 8, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>
            </div>
          );
        })}
        {lista.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: 20 }}>Nenhum equipamento.</div>}
        <Btn label="➕ Adicionar Equipamento" color={NAVY} onClick={abrirNovo} style={{ marginTop: 8 }} />
      </div>
      <KMFooter />

      <Modal show={modal} title={editandoId ? "Editar Equipamento" : "Novo Equipamento"} onClose={() => setModal(false)}>
        <label style={labelS}>Nome</label>
        <input
          value={form.nome}
          onChange={e => {
            const novoNome = e.target.value;
            set("nome", novoNome);
            // Auto-preenche o ícone se o nome bater com um do catálogo
            const itemCat = CATALOGO_EQUIPAMENTOS.find(c => c.nome === novoNome);
            if (itemCat) set("icon", itemCat.icon);
          }}
          list="catalogo-equipamentos"
          placeholder="Ex: Betoneira"
          style={inputS}
        />
        <datalist id="catalogo-equipamentos">
          {CATALOGO_EQUIPAMENTOS_NOMES.map(n => <option key={n} value={n} />)}
        </datalist>
        <label style={labelS}>Código</label>
        <input value={form.codigo} onChange={e => set("codigo", e.target.value)} placeholder="Ex: EQ045" style={inputS} />
        <label style={labelS}>Obra</label>
        <select value={form.obraId} onChange={e => set("obraId", parseInt(e.target.value))} style={selS}>
          <option value="">Selecione</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <label style={labelS}>Status</label>
        <select value={form.status} onChange={e => set("status", e.target.value)} style={selS}>
          <option>Disponível</option><option>Em Uso</option><option>Quebrada</option>
        </select>
        <label style={labelS}>Ícone</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {ICONS.map(i => (
            <button key={i} onClick={() => set("icon", i)} style={{ width: 40, height: 40, fontSize: 22, border: form.icon === i ? `2px solid ${NAVY}` : "1px solid #ddd", borderRadius: 8, background: form.icon === i ? "#dde6f5" : "#fff", cursor: "pointer" }}>{i}</button>
          ))}
        </div>
        <Btn label={editandoId ? "SALVAR ALTERAÇÕES" : "ADICIONAR"} color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   BACKUP/RESTAURAR
════════════════════════════════════ */
/* ════════════════════════════════════
   GERAR SIMULAÇÃO DE 30 DIAS
════════════════════════════════════ */
function TelaGerarSimulacao({ onGerar, onBack }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Gerar 30 Dias" sub="Modo demonstração" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        <div style={{ background: `linear-gradient(135deg,#7c3aed,#5b21b6)`, color: "#fff", borderRadius: 14, padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>🎬</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Simular 1 mês de operação</div>
          <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4 }}>
            Pré-popula o app com dados realistas pra você ver como tudo funciona depois de um mês de uso.
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 8 }}>📋 O que vai ser gerado:</div>
          <div style={{ fontSize: 12, color: "#444", lineHeight: 1.7 }}>
            ✅ <b>30 dias</b> de presença (70% Presente, 20% Falta, 10% Atestado)<br/>
            ✅ <b>~70 RDOs</b> (1 por obra ativa por dia útil)<br/>
            ✅ <b>~350 fotos</b> carimbadas (5 por obra/dia)<br/>
            ✅ <b>~10 pedidos</b> de material (com aprovados/negados/pendentes)<br/>
            ✅ <b>~7 despesas avulsas</b> (PIPA, frete, etc)<br/>
            ✅ <b>~6 anotações</b> no diário<br/>
            ✅ <b>~4 movimentações</b> de pessoal<br/>
            ✅ <b>~3 movimentações</b> de equipamento<br/>
            ✅ <b>~6 abastecimentos</b><br/>
            ✅ <b>~4 recebimentos</b> (medições)<br/>
            ✅ <b>2 adiantamentos</b><br/>
            ✅ <b>12 entradas</b> de produtividade
          </div>
        </div>

        <div style={{ background: "#fef9e7", borderRadius: 12, padding: 12, marginBottom: 10, fontSize: 11, color: "#8b6f00", lineHeight: 1.5 }}>
          ⚠️ <b>Cuidado:</b> Isto vai <b>SUBSTITUIR</b> todos os dados atuais (RDOs, pedidos, fotos, despesas, etc).<br/><br/>
          🗑️ Você pode <b>excluir cada um manualmente</b> depois pra ver o app vazio de novo.<br/><br/>
          💾 Antes de gerar, recomendo fazer um <b>Backup</b> em <i>Sistema → Backup</i>.
        </div>

        <Btn label="🎬 GERAR 30 DIAS DE DADOS" color="#7c3aed" onClick={onGerar} />
        <Btn label="Cancelar" color="#eee" text={NAVY} onClick={onBack} style={{ marginTop: 8 }} />
      </div>
      <KMFooter />
    </div>
  );
}

function TelaBackup({ todoEstado, onRestaurar, onBack }) {
  const [textoImport, setTextoImport] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [modoImportar, setModoImportar] = useState(false);

  const dataHoje = new Date().toISOString().split("T")[0];
  const filename = `kmzero-backup-${dataHoje}.json`;

  const exportar = () => {
    const json = JSON.stringify(todoEstado, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setSucesso("✅ Backup exportado!");
    setTimeout(() => setSucesso(""), 3000);
  };

  const compartilhar = async () => {
    const json = JSON.stringify(todoEstado, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const file = new File([blob], filename, { type: "application/json" });
    const data = {
      title: "Backup KMZERO",
      text: `Backup do KMZERO • ${new Date().toLocaleString("pt-BR")}\n\n📊 Resumo:\n• ${todoEstado.obras?.length || 0} obras\n• ${todoEstado.trabalhadores?.length || 0} trabalhadores\n• ${Object.keys(todoEstado.historico || {}).length} dias de histórico`,
    };
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ ...data, files: [file] });
        setSucesso("✅ Backup compartilhado!");
        setTimeout(() => setSucesso(""), 3000);
        return;
      } catch (e) { if (e.name !== "AbortError") setErro("Erro ao compartilhar"); return; }
    }
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch (e) {}
    }
    setErro("⚠️ Compartilhamento não suportado. Use 'Baixar Backup' e envie o arquivo manualmente.");
  };

  const enviarWhatsApp = () => {
    const resumo = `*Backup KMZERO* — ${new Date().toLocaleString("pt-BR")}\n\n📊 Resumo dos dados:\n• ${todoEstado.obras?.length || 0} obras\n• ${todoEstado.trabalhadores?.length || 0} trabalhadores\n• ${todoEstado.equips?.length || 0} equipamentos\n• ${todoEstado.pedidos?.length || 0} pedidos\n• ${Object.keys(todoEstado.historico || {}).length} dias com registro\n\n⚠️ Anexe o arquivo JSON baixado.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(resumo)}`, "_blank");
  };

  const enviarEmail = () => {
    const corpo = `Backup KMZERO — ${new Date().toLocaleString("pt-BR")}%0A%0A📊 Resumo dos dados:%0A• ${todoEstado.obras?.length || 0} obras%0A• ${todoEstado.trabalhadores?.length || 0} trabalhadores%0A• ${todoEstado.equips?.length || 0} equipamentos%0A• ${todoEstado.pedidos?.length || 0} pedidos%0A• ${Object.keys(todoEstado.historico || {}).length} dias com registro%0A%0A⚠️ Anexe o arquivo JSON baixado.`;
    window.location.href = `mailto:?subject=${encodeURIComponent("Backup KMZERO - " + dataHoje)}&body=${corpo}`;
  };

  const importarArquivo = (e) => {
    setErro(""); setSucesso("");
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const dados = JSON.parse(ev.target.result);
        if (!dados.obras || !dados.trabalhadores) throw new Error("inválido");
        if (!confirm("Tem certeza? Os dados atuais serão substituídos pelos do arquivo.")) return;
        onRestaurar(dados);
        setSucesso("✅ Dados restaurados com sucesso!");
      } catch {
        setErro("⚠️ Arquivo inválido. Verifique se é um backup do KMZERO.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const importarTexto = () => {
    setErro(""); setSucesso("");
    try {
      const dados = JSON.parse(textoImport);
      if (!dados.obras || !dados.trabalhadores) throw new Error("inválido");
      if (!confirm("Tem certeza? Os dados atuais serão substituídos.")) return;
      onRestaurar(dados);
      setSucesso("✅ Dados restaurados!");
      setTextoImport("");
    } catch {
      setErro("⚠️ JSON inválido.");
    }
  };

  const stats = {
    Obras: todoEstado.obras?.length || 0,
    Trabalhadores: todoEstado.trabalhadores?.length || 0,
    "Ativos/Frota": todoEstado.ativos?.length || 0,
    Equipamentos: todoEstado.equips?.length || 0,
    Ferramentas: todoEstado.ferramentas?.length || 0,
    Pedidos: todoEstado.pedidos?.length || 0,
    "Dias c/ presença": Object.keys(todoEstado.historico || {}).length,
    "RDOs emitidos": todoEstado.rdosEmitidos?.length || 0,
    "Anotações": todoEstado.diario?.length || 0,
    "Links salvos": todoEstado.links?.length || 0,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Backup & Restaurar" sub="Segurança dos seus dados" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📦 Resumo dos Dados</div>
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f0f0f0" }}>
              <span style={{ fontSize: 13, color: "#666" }}>{k}</span>
              <span style={{ fontSize: 13, color: NAVY, fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 4, fontSize: 14 }}>💾 Salvar Backup</div>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>Recomendação: faça backup ao menos 1× por semana.</div>

          <button onClick={compartilhar} style={{ width: "100%", padding: 14, marginBottom: 8, background: BLUE, color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: `0 4px 14px ${BLUE}44`, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            📲 Compartilhar (WhatsApp / Drive / Email)
          </button>
          <div style={{ fontSize: 10, color: "#888", textAlign: "center", marginBottom: 10 }}>Funciona melhor no celular</div>

          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button onClick={enviarWhatsApp} style={{ flex: 1, padding: 10, background: "#25D366", color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>💬 WhatsApp</button>
            <button onClick={enviarEmail} style={{ flex: 1, padding: 10, background: "#dc2626", color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>📧 E-mail</button>
          </div>
          <button onClick={exportar} style={{ width: "100%", padding: 12, background: GREEN, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>💾 Baixar Arquivo .json</button>
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 4, fontSize: 14 }}>📥 Restaurar Backup</div>
          <div style={{ fontSize: 11, color: ORANGE, marginBottom: 10, fontWeight: 600 }}>⚠️ Cuidado: substitui todos os dados atuais.</div>

          <label style={{ display: "block", padding: 12, borderRadius: 10, border: "1.5px dashed #c5d0e5", background: "#f9fafb", textAlign: "center", cursor: "pointer", fontSize: 13, color: NAVY, fontWeight: 600, marginBottom: 8 }}>
            📁 Escolher arquivo .json
            <input type="file" accept=".json,application/json" onChange={importarArquivo} style={{ display: "none" }} />
          </label>

          <button onClick={() => setModoImportar(!modoImportar)} style={{ background: "none", border: "none", color: BLUE, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
            {modoImportar ? "▲ Esconder" : "▼ Ou colar texto JSON"}
          </button>

          {modoImportar && (
            <div style={{ marginTop: 10 }}>
              <textarea value={textoImport} onChange={e => setTextoImport(e.target.value)} rows={5} placeholder='{"obras":[...],"trabalhadores":[...]}' style={{ ...inputS, resize: "none", fontFamily: "monospace", fontSize: 11 }} />
              <Btn label="⚠️ Restaurar do texto" color={ORANGE} onClick={importarTexto} />
            </div>
          )}
        </div>

        {sucesso && <div style={{ background: "#f0fdf4", color: GREEN, borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{sucesso}</div>}
        {erro && <div style={{ background: "#fef2f2", color: RED, borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{erro}</div>}

        <div style={{ background: "#fffaeb", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "#8b6f00", marginTop: 12 }}>
          💡 <b>Dica:</b> use o botão "Compartilhar" no celular pra enviar o backup direto pro Google Drive, e-mail ou WhatsApp num só toque.
        </div>
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   MAPA DE OBRAS (visualização simplificada)
════════════════════════════════════ */
function TelaMapa({ obras, trabalhadores, onBack, onEditar }) {
  const ativas = obras.filter(o => o.status === "Ativa");
  const totalTrab = trabalhadores.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Mapa de Obras" sub="Visão geral" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ background: `linear-gradient(135deg,${NAVY},#243b7a)`, borderRadius: 14, padding: 16, marginBottom: 14, color: "#fff", boxShadow: "0 4px 14px rgba(15,33,81,0.3)" }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Obras ativas</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{ativas.length}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Trabalhadores</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{totalTrab}</div>
            </div>
          </div>
        </div>

        {/* Mapa visual estilizado */}
        <div style={{ background: "#dde6f5", borderRadius: 14, padding: 14, marginBottom: 14, position: "relative", height: 200, overflow: "hidden", border: "1px solid #c5d0e5" }}>
          <div style={{ position: "absolute", top: 8, left: 12, fontSize: 11, color: "#888", fontWeight: 700 }}>📍 Mapa visual</div>
          {/* Grid de fundo */}
          <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0 }}>
            {[...Array(8)].map((_, i) => <line key={"h" + i} x1="0" y1={i * 25} x2="100%" y2={i * 25} stroke="#c5d0e5" strokeWidth="0.5" />)}
            {[...Array(10)].map((_, i) => <line key={"v" + i} x1={`${i * 10}%`} y1="0" x2={`${i * 10}%`} y2="100%" stroke="#c5d0e5" strokeWidth="0.5" />)}
          </svg>
          {/* Pinos das obras */}
          {ativas.map((o, i) => {
            const left = 15 + (i * 23) % 70;
            const top = 30 + (i * 37) % 130;
            return (
              <div key={o.id} style={{ position: "absolute", left: `${left}%`, top, fontSize: 32, cursor: "pointer", transform: "translate(-50%, -100%)" }} title={o.nome}>
                📍
              </div>
            );
          })}
        </div>

        {/* Lista de obras com info detalhada */}
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, fontSize: 14 }}>📋 Obras Cadastradas</div>
        {obras.map(o => {
          const nTrab = trabalhadores.filter(t => t.obraId === o.id).length;
          return (
            <div key={o.id} onClick={() => onEditar && onEditar(o)} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer", borderLeft: `5px solid ${o.status === "Ativa" ? GREEN : "#ccc"}` }}>
              <div style={{ fontSize: 28, marginRight: 12 }}>📍</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{o.nome}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{o.local}</div>
                <div style={{ fontSize: 11, color: BLUE, marginTop: 2 }}>👷 {nTrab} trabalhador(es)</div>
              </div>
              <Badge label={o.status} color={o.status === "Ativa" ? GREEN : "#888"} small />
            </div>
          );
        })}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   ALERTAS AUTOMÁTICOS
════════════════════════════════════ */
function gerarAlertas({ obras, trabalhadores, equips, pedidos, historico, manutencoes = [], cronogramas = {}, movEquip = [], ativos = [], abastecimentos = [] }) {
  const alertas = [];
  const agora = Date.now();

  // 1) Equipamentos quebrados há muito tempo
  equips.filter(e => e.status === "Quebrada").forEach(e => {
    const obra = obras.find(o => o.id === e.obraId);
    alertas.push({ id: `eq-${e.id}`, tipo: "Equipamento", icone: "🔧", titulo: `${e.nome} quebrada`, detalhe: `${obra?.nome || ""} • Cód: ${e.codigo}`, prio: "alta", color: RED, navegarPara: "equip_gestao" });
  });

  // 2) Pedidos aguardando há mais de 24h
  pedidos.filter(p => p.status === "Aguardando").forEach(p => {
    const idade = (agora - p.id) / (1000 * 60 * 60); // horas
    const itens = p.itens || [{ material: p.material, qtd: p.qtd }];
    const resumoItens = itens.length === 1 ? `${itens[0].material} — ${itens[0].qtd}` : `${itens.length} itens`;
    if (idade > 24) {
      alertas.push({ id: `ped-${p.id}`, tipo: "Pedido", icone: "📦", titulo: `Pedido pendente há ${Math.floor(idade / 24)} dia(s)`, detalhe: `${resumoItens} • ${p.obra}`, prio: "media", color: ORANGE, navegarPara: "pedidos", contextoId: p.id });
    } else {
      alertas.push({ id: `ped-${p.id}`, tipo: "Pedido", icone: "📦", titulo: `Pedido aguardando aprovação`, detalhe: `${resumoItens} • ${p.obra}`, prio: "baixa", color: BLUE, navegarPara: "pedidos", contextoId: p.id });
    }
  });

  // 3) Trabalhadores com muitas faltas (últimos 7 dias)
  const dias7 = ultimosDias(7);
  trabalhadores.forEach(t => {
    let faltas = 0;
    dias7.forEach(d => { if ((historico[d] || {})[t.id] === "Falta") faltas++; });
    if (faltas >= 3) {
      const obra = obras.find(o => o.id === t.obraId);
      alertas.push({ id: `falta-${t.id}`, tipo: "Frequência", icone: "⚠️", titulo: `${t.nome}: ${faltas} faltas em 7 dias`, detalhe: `${t.cargo} • ${obra?.nome || ""}`, prio: "alta", color: RED, navegarPara: "equipe", contextoId: t.id });
    }
  });

  // 4) ASO vencido ou próximo do vencimento
  trabalhadores.forEach(t => {
    if (!t.asoValidade) return;
    try {
      const validade = new Date(t.asoValidade);
      const hoje = new Date();
      const dias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
      if (dias < 0) {
        alertas.push({ id: `aso-${t.id}`, tipo: "ASO", icone: "🏥", titulo: `ASO de ${t.nome} VENCIDO`, detalhe: `Vencido há ${Math.abs(dias)} dia(s) • ${t.cargo}`, prio: "alta", color: RED, navegarPara: "aso", contextoId: t.id });
      } else if (dias <= 30) {
        alertas.push({ id: `aso-${t.id}`, tipo: "ASO", icone: "🏥", titulo: `ASO de ${t.nome} vence em ${dias} dia(s)`, detalhe: `${t.cargo}`, prio: "media", color: ORANGE, navegarPara: "aso", contextoId: t.id });
      }
    } catch (e) {}
  });

  // 5) Trabalhadores Inaptos
  trabalhadores.filter(t => t.asoStatus === "Inapto").forEach(t => {
    const obra = obras.find(o => o.id === t.obraId);
    alertas.push({ id: `inapto-${t.id}`, tipo: "ASO", icone: "❌", titulo: `${t.nome} está INAPTO`, detalhe: `${t.cargo} • ${obra?.nome || ""}`, prio: "alta", color: RED, navegarPara: "aso", contextoId: t.id });
  });

  // 6) Obras sem trabalhadores
  obras.filter(o => o.status === "Ativa").forEach(o => {
    const n = trabalhadores.filter(t => t.obraId === o.id).length;
    if (n === 0) alertas.push({ id: `obra-${o.id}`, tipo: "Obra", icone: "🏗️", titulo: `${o.nome} sem equipe`, detalhe: o.local, prio: "media", color: ORANGE, navegarPara: "obras", contextoId: o.id });
  });

  // 7) Sem registro de presença hoje
  const hoje = hojeStr();
  if (!historico[hoje] || Object.keys(historico[hoje]).length === 0) {
    if (trabalhadores.length > 0) alertas.push({ id: `pres-hoje`, tipo: "Presença", icone: "📅", titulo: "Sem registro de presença hoje", detalhe: "Encarregados ainda não confirmaram", prio: "alta", color: RED, navegarPara: "calendario" });
  }

  // 8) Manutenções atrasadas ou próximas
  const agoraD = new Date();
  manutencoes.filter(m => !m.realizada).forEach(m => {
    try {
      const d = new Date(m.proxData);
      const dias = Math.ceil((d - agoraD) / (1000 * 60 * 60 * 24));
      if (dias < 0) {
        alertas.push({ id: `man-${m.id}`, tipo: "Manutenção", icone: "🔧", titulo: `Manutenção atrasada (${Math.abs(dias)}d)`, detalhe: m.tipo, prio: "alta", color: RED, navegarPara: "manutencoes", contextoId: m.id });
      } else if (dias <= 7) {
        alertas.push({ id: `man-${m.id}`, tipo: "Manutenção", icone: "🔧", titulo: `Manutenção em ${dias}d`, detalhe: m.tipo, prio: "media", color: ORANGE, navegarPara: "manutencoes", contextoId: m.id });
      }
    } catch (e) {}
  });

  // 9) Etapas do cronograma atrasadas
  Object.entries(cronogramas || {}).forEach(([obraId, etapas]) => {
    const obra = obras.find(o => o.id === parseInt(obraId));
    if (!obra) return;
    (etapas || []).forEach(e => {
      if (e.progresso === 100) return;
      try {
        if (e.fim) {
          const fim = new Date(e.fim);
          const dias = Math.ceil((fim - agoraD) / (1000 * 60 * 60 * 24));
          if (dias < 0 && e.progresso < 100) {
            alertas.push({ id: `cron-${e.id}`, tipo: "Cronograma", icone: "📅", titulo: `${e.nome} atrasada ${Math.abs(dias)}d`, detalhe: `${obra.nome} • ${e.progresso || 0}% concluído`, prio: "alta", color: RED, navegarPara: "cronograma", contextoId: parseInt(obraId) });
          } else if (dias <= 7 && e.progresso < 80) {
            alertas.push({ id: `cron-${e.id}`, tipo: "Cronograma", icone: "📅", titulo: `${e.nome} vence em ${dias}d`, detalhe: `${obra.nome} • ${e.progresso || 0}% concluído`, prio: "media", color: ORANGE, navegarPara: "cronograma", contextoId: parseInt(obraId) });
          }
        }
      } catch (er) {}
    });
  });

  // 10) Empréstimos de equipamento atrasados/vencendo
  (movEquip || []).filter(m => m.status === "Aprovado" && m.tipo === "emprestimo" && m.prazo).forEach(m => {
    try {
      const fim = new Date(m.prazo);
      const dias = Math.ceil((fim - agoraD) / (1000 * 60 * 60 * 24));
      if (dias < 0) {
        alertas.push({ id: `me-${m.id}`, tipo: "Empréstimo", icone: "🔧", titulo: `${m.itemNome} não devolvido`, detalhe: `Atrasado ${Math.abs(dias)}d • ${m.obraDestinoNome}`, prio: "alta", color: RED, navegarPara: "mov_equip", contextoId: m.id });
      } else if (dias <= 2) {
        alertas.push({ id: `me-${m.id}`, tipo: "Empréstimo", icone: "🔧", titulo: `${m.itemNome} vence em ${dias}d`, detalhe: `Em ${m.obraDestinoNome}`, prio: "media", color: ORANGE, navegarPara: "mov_equip", contextoId: m.id });
      }
    } catch (e) {}
  });

  // 11) Movimentações aguardando aprovação (gestor precisa decidir)
  (movEquip || []).filter(m => m.status === "Aguardando").forEach(m => {
    alertas.push({ id: `mep-${m.id}`, tipo: "Aprovação", icone: "🔄", titulo: `Mov. de ${m.itemNome} aguardando`, detalhe: `${m.obraOrigemNome} → ${m.obraDestinoNome}`, prio: "media", color: ORANGE, navegarPara: "mov_equip", contextoId: m.id });
  });

  // 12) Veículos sem abastecer há muito tempo (>30 dias se está ativo)
  (ativos || []).filter(a => a.status === "Ativo" && a.tipo !== "Ferramenta").forEach(ativo => {
    const abasts = (abastecimentos || []).filter(x => x.ativoId === ativo.id);
    if (abasts.length === 0) return;
    const ultimaData = abasts
      .map(x => { try { const [d, m, y] = (x.data || "").split("/"); return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)); } catch { return null; } })
      .filter(Boolean)
      .sort((a, b) => b - a)[0];
    if (!ultimaData) return;
    const diasSemAbast = Math.floor((agoraD - ultimaData) / (1000 * 60 * 60 * 24));
    if (diasSemAbast > 30) {
      alertas.push({ id: `comb-${ativo.id}`, tipo: "Combustível", icone: "⛽", titulo: `${ativo.nome} sem abastecer ${diasSemAbast}d`, detalhe: ativo.tipo, prio: "media", color: ORANGE, navegarPara: "frota", contextoId: ativo.id });
    }
  });

  return alertas.sort((a, b) => ({ alta: 0, media: 1, baixa: 2 }[a.prio] - { alta: 0, media: 1, baixa: 2 }[b.prio]));
}

function TelaAlertas({ obras, trabalhadores, equips, pedidos, historico, manutencoes, cronogramas, movEquip, ativos, abastecimentos, onBack, onNav }) {
  const alertas = gerarAlertas({ obras, trabalhadores, equips, pedidos, historico, manutencoes, cronogramas, movEquip, ativos, abastecimentos });
  const altas = alertas.filter(a => a.prio === "alta").length;
  const medias = alertas.filter(a => a.prio === "media").length;
  const baixas = alertas.length - altas - medias;
  const [filtro, setFiltro] = useState("todas");

  const visiveis = filtro === "todas" ? alertas : alertas.filter(a => a.prio === filtro);

  const irParaAlerta = (alerta) => {
    if (alerta.navegarPara && onNav) {
      onNav(alerta.navegarPara);
    } else {
      alert(`📋 ${alerta.titulo}\n\n${alerta.detalhe}`);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Alertas" sub={`${alertas.length} alerta(s) ativo(s)`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {alertas.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: 32, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 64 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: GREEN, marginTop: 12 }}>Tudo em ordem!</div>
            <div style={{ color: "#666", marginTop: 6, fontSize: 13 }}>Nenhum alerta no momento.</div>
          </div>
        ) : (
          <>
            {/* KPIs CLICÁVEIS — funcionam como filtro */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div onClick={() => setFiltro(filtro === "alta" ? "todas" : "alta")} style={{ flex: 1, background: filtro === "alta" ? RED : "#fff", color: filtro === "alta" ? "#fff" : RED, border: `2px solid ${RED}`, borderRadius: 10, padding: "10px 6px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{altas}</div>
                <div style={{ fontSize: 10, fontWeight: 700 }}>🔴 ALTA</div>
              </div>
              <div onClick={() => setFiltro(filtro === "media" ? "todas" : "media")} style={{ flex: 1, background: filtro === "media" ? ORANGE : "#fff", color: filtro === "media" ? "#fff" : ORANGE, border: `2px solid ${ORANGE}`, borderRadius: 10, padding: "10px 6px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{medias}</div>
                <div style={{ fontSize: 10, fontWeight: 700 }}>🟠 MÉDIA</div>
              </div>
              <div onClick={() => setFiltro(filtro === "baixa" ? "todas" : "baixa")} style={{ flex: 1, background: filtro === "baixa" ? BLUE : "#fff", color: filtro === "baixa" ? "#fff" : BLUE, border: `2px solid ${BLUE}`, borderRadius: 10, padding: "10px 6px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{baixas}</div>
                <div style={{ fontSize: 10, fontWeight: 700 }}>🔵 BAIXA</div>
              </div>
            </div>
            {filtro !== "todas" && (
              <button onClick={() => setFiltro("todas")} style={{ width: "100%", padding: 8, background: NAVY, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 11, marginBottom: 10 }}>
                ✕ Limpar filtro (ver todas {alertas.length})
              </button>
            )}

            {/* Lista de alertas — cards clicáveis */}
            {visiveis.map(a => (
              <div key={a.id} onClick={() => irParaAlerta(a)} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${a.color}`, cursor: a.navegarPara ? "pointer" : "default" }}>
                <div style={{ fontSize: 26, marginRight: 12 }}>{a.icone}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{a.titulo}</div>
                  <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>{a.detalhe}</div>
                  {a.navegarPara && <div style={{ fontSize: 9, color: BLUE, marginTop: 3, fontWeight: 700 }}>👆 Toque pra resolver →</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Badge label={a.tipo} color={a.color} small />
                  {a.navegarPara && <span style={{ color: "#bbb", fontSize: 16 }}>›</span>}
                </div>
              </div>
            ))}

            {visiveis.length === 0 && (
              <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", color: "#aaa", fontSize: 12 }}>
                Nenhum alerta com prioridade {filtro}.
              </div>
            )}
          </>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   RELATÓRIO CONSOLIDADO (semana/mês)
════════════════════════════════════ */
function TelaRelatorioConsolidado({ obras, trabalhadores, pedidos, historico, onBack }) {
  const [periodo, setPeriodo] = useState("semana");
  const [obraId, setObraId] = useState("todas");

  const dias = ultimosDias(periodo === "semana" ? 7 : 30);
  const trabFiltro = obraId === "todas" ? trabalhadores : trabalhadores.filter(t => t.obraId === parseInt(obraId));
  const pedidosFiltro = obraId === "todas" ? pedidos : pedidos.filter(p => p.obraId === parseInt(obraId));

  let totalP = 0, totalF = 0, totalA = 0;
  dias.forEach(d => {
    const pres = historico[d] || {};
    trabFiltro.forEach(t => {
      const s = pres[t.id];
      if (s === "Presente") totalP++;
      else if (s === "Falta") totalF++;
      else if (s === "Atestado") totalA++;
    });
  });

  const ranking = trabFiltro.map(t => {
    let p = 0, f = 0;
    dias.forEach(d => {
      const s = (historico[d] || {})[t.id];
      if (s === "Presente") p++;
      else if (s === "Falta") f++;
    });
    return { ...t, presentes: p, faltas: f, taxa: dias.length > 0 ? Math.round((p / dias.length) * 100) : 0 };
  }).sort((a, b) => b.taxa - a.taxa);

  const tituloPeriodo = periodo === "semana" ? "Últimos 7 dias" : "Últimos 30 dias";

  const exportar = () => {
    const html = `<html><head><title>Relatório Consolidado - ${tituloPeriodo}</title>
      <style>
        ${KM_PDF_PAGE_CSS}
        body{font-family:Arial;padding:30px;color:#222;}
        h1{color:${NAVY};border-bottom:3px solid ${GOLD};padding-bottom:8px;}
        h2{color:${NAVY};margin-top:24px;}
        table{width:100%;border-collapse:collapse;margin:10px 0;}
        th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px;}
        th{background:${NAVY};color:#fff;}
        .stat{display:inline-block;padding:12px 20px;margin:5px;border-radius:8px;color:#fff;font-weight:bold;}
        .footer{margin-top:40px;text-align:center;color:#888;font-size:11px;border-top:1px solid #ddd;padding-top:10px;}
      </style></head><body>
      <h1>📊 Relatório Consolidado — ${tituloPeriodo}</h1>
      <p><b>Obra:</b> ${obraId === "todas" ? "Todas" : obras.find(o => o.id === parseInt(obraId))?.nome} &nbsp;|&nbsp; <b>Gerado em:</b> ${new Date().toLocaleString("pt-BR")}</p>
      <h2>Resumo</h2>
      <div>
        <span class="stat" style="background:${GREEN}">${totalP} Presenças</span>
        <span class="stat" style="background:${RED}">${totalF} Faltas</span>
        <span class="stat" style="background:${ORANGE}">${totalA} Atestados</span>
      </div>
      <h2>👥 Ranking de Frequência</h2>
      <table><tr><th>#</th><th>Nome</th><th>Cargo</th><th>Presenças</th><th>Faltas</th><th>Taxa</th></tr>
      ${ranking.map((t, i) => `<tr><td>${i + 1}</td><td>${t.nome}</td><td>${t.cargo}</td><td>${t.presentes}</td><td>${t.faltas}</td><td><b>${t.taxa}%</b></td></tr>`).join("")}
      </table>
      <h2>📦 Pedidos no Período</h2>
      <p>Total: ${pedidosFiltro.length} • Aprovados: ${pedidosFiltro.filter(p => p.status === "Aprovado").length} • Negados: ${pedidosFiltro.filter(p => p.status === "Negado").length} • Aguardando: ${pedidosFiltro.filter(p => p.status === "Aguardando").length}</p>
      <div class="footer"><b>KM ZERO</b> — Gestão de Obras &nbsp;|&nbsp; KM Consultoria e Serviços</div>
      <script>window.onload=()=>{setTimeout(()=>window.print(),300);}</script>
      </body></html>`;
    abrirOuBaixarHTML(html, `Consolidado-${tituloPeriodo.replace(/\s/g, "_")}.html`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Relatório Consolidado" sub={tituloPeriodo} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <select value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ ...selS, flex: 1, marginBottom: 0 }}>
            <option value="semana">Última semana</option>
            <option value="mes">Último mês</option>
          </select>
          <select value={obraId} onChange={e => setObraId(e.target.value)} style={{ ...selS, flex: 1, marginBottom: 0 }}>
            <option value="todas">Todas as obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, background: GREEN, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{totalP}</div>
            <div style={{ fontSize: 10 }}>Presenças</div>
          </div>
          <div style={{ flex: 1, background: RED, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{totalF}</div>
            <div style={{ fontSize: 10 }}>Faltas</div>
          </div>
          <div style={{ flex: 1, background: ORANGE, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{totalA}</div>
            <div style={{ fontSize: 10 }}>Atestados</div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>🏆 Ranking de Frequência</div>
          {ranking.length === 0 && <div style={{ color: "#aaa", fontSize: 13 }}>Sem dados.</div>}
          {ranking.map((t, i) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: i < ranking.length - 1 ? "1px solid #f0f0f0" : "none" }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: i === 0 ? GOLD : i === 1 ? "#cbd5e1" : i === 2 ? "#e29361" : "#eee", color: i < 3 ? "#fff" : "#888", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, marginRight: 10 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: NAVY, fontWeight: 600 }}>{t.nome}</div>
                <div style={{ fontSize: 10, color: "#888" }}>{t.cargo}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: t.taxa >= 80 ? GREEN : t.taxa >= 50 ? ORANGE : RED }}>{t.taxa}%</div>
                <div style={{ fontSize: 9, color: "#888" }}>{t.presentes}P / {t.faltas}F</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📦 Pedidos no Período</div>
          <div style={{ display: "flex", gap: 6, fontSize: 12, color: "#666" }}>
            <span style={{ background: "#dde6f5", padding: "4px 10px", borderRadius: 8, fontWeight: 700, color: NAVY }}>Total: {pedidosFiltro.length}</span>
            <span style={{ background: "#f0fdf4", padding: "4px 10px", borderRadius: 8, fontWeight: 700, color: GREEN }}>✓ {pedidosFiltro.filter(p => p.status === "Aprovado").length}</span>
            <span style={{ background: "#fef2f2", padding: "4px 10px", borderRadius: 8, fontWeight: 700, color: RED }}>✕ {pedidosFiltro.filter(p => p.status === "Negado").length}</span>
            <span style={{ background: "#fff8f0", padding: "4px 10px", borderRadius: 8, fontWeight: 700, color: ORANGE }}>⏳ {pedidosFiltro.filter(p => p.status === "Aguardando").length}</span>
          </div>
        </div>

        <Btn label="📤 Exportar PDF" color={NAVY} onClick={exportar} />
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   ATIVOS / FROTA (retroescavadeiras, caminhões)
════════════════════════════════════ */
function TelaAtivos({ obras, ativos, abastecimentos, onBack, onAdd, onEditar, onRemover, onAbastecer }) {
  const [modal, setModal] = useState(false);
  const [modalAbast, setModalAbast] = useState(null); // ativo selecionado
  const [editandoId, setEditandoId] = useState(null);
  const [filtroObra, setFiltroObra] = useState("todas");
  const [form, setForm] = useState({ tipo: "Retroescavadeira", nome: "", placa: "", obraId: "", horimetro: 0, valorHora: 80, status: "Ativo" });
  const [formAbast, setFormAbast] = useState({ litros: "", valor: "", horimetro: "", combustivel: "Diesel", fotoCupom: null });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setAB = (k, v) => setFormAbast(f => ({ ...f, [k]: v }));

  const handleFotoCupom = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setAB("fotoCupom", ev.target.result);
    reader.readAsDataURL(file);
  };

  const lista = filtroObra === "todas" ? ativos : ativos.filter(a => a.obraId === parseInt(filtroObra));
  const TIPOS = ["Retroescavadeira", "Caminhão", "Betoneira Móvel", "Empilhadeira", "Caminhão Pipa", "Caminhonete", "Outro"];

  const abrirNovo = () => { setEditandoId(null); setForm({ tipo: "Retroescavadeira", nome: "", placa: "", obraId: "", horimetro: 0, valorHora: 80, status: "Ativo" }); setModal(true); };
  const abrirEdit = (a) => { setEditandoId(a.id); setForm(a); setModal(true); };
  const salvar = () => {
    if (!form.nome || !form.placa || !form.obraId) return;
    if (editandoId) onEditar({ ...form, id: editandoId, obraId: parseInt(form.obraId), horimetro: parseFloat(form.horimetro) || 0, valorHora: parseFloat(form.valorHora) || 0 });
    else onAdd({ ...form, id: Date.now(), obraId: parseInt(form.obraId), horimetro: parseFloat(form.horimetro) || 0, valorHora: parseFloat(form.valorHora) || 0 });
    setModal(false);
  };

  const abastecer = () => {
    if (!formAbast.litros || !formAbast.valor) return;
    onAbastecer({
      id: Date.now(), ativoId: modalAbast.id, obraId: modalAbast.obraId,
      litros: parseFloat(formAbast.litros), valor: parseFloat(formAbast.valor),
      horimetro: parseFloat(formAbast.horimetro) || 0, combustivel: formAbast.combustivel,
      fotoCupom: formAbast.fotoCupom,
      data: new Date().toLocaleDateString("pt-BR"), ts: Date.now(),
    });
    setModalAbast(null);
    setFormAbast({ litros: "", valor: "", horimetro: "", combustivel: "Diesel", fotoCupom: null });
  };

  const ICONS = { "Retroescavadeira": "🚜", "Caminhão": "🚛", "Betoneira Móvel": "🚧", "Empilhadeira": "🏗️", "Caminhão Pipa": "🚿", "Caminhonete": "🛻", "Outro": "⚙️" };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Ativos & Frota" sub="Veículos e maquinário" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 12 }}>
        <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ ...selS, marginBottom: 12 }}>
          <option value="todas">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        {lista.map(a => {
          const obra = obras.find(o => o.id === a.obraId);
          const meusAbast = abastecimentos.filter(x => x.ativoId === a.id);
          const totalAbast = meusAbast.reduce((s, x) => s + x.valor, 0);
          return (
            <div key={a.id} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 32, marginRight: 12 }}>{ICONS[a.tipo] || "⚙️"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{a.nome}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{a.tipo} • {a.placa}</div>
                  <div style={{ fontSize: 11, color: BLUE }}>📍 {obra?.nome || "—"}</div>
                </div>
                <button onClick={() => abrirEdit(a)} style={{ background: "none", border: "none", color: BLUE, fontSize: 16, cursor: "pointer" }}>✏️</button>
                <button onClick={() => { confirmar(`Remover ${a.nome}?`, () => { onRemover(a.id); }); }} style={{ background: "#fee2e2", border: "2px solid #d63b3b", color: "#d63b3b", fontSize: 16, cursor: "pointer", marginLeft: 4, padding: "6px 10px", borderRadius: 8, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, fontSize: 11 }}>
                <span style={{ background: "#f0f7ff", color: BLUE, padding: "3px 8px", borderRadius: 4, fontWeight: 700 }}>⏱️ {a.horimetro}h</span>
                <span style={{ background: "#f0fdf4", color: GREEN, padding: "3px 8px", borderRadius: 4, fontWeight: 700 }}>R$ {a.valorHora}/h</span>
                {totalAbast > 0 && <span style={{ background: "#fff8f0", color: ORANGE, padding: "3px 8px", borderRadius: 4, fontWeight: 700 }}>⛽ R$ {totalAbast.toFixed(2)}</span>}
              </div>
              <button onClick={() => setModalAbast(a)} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "none", background: ORANGE, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>⛽ Registrar Abastecimento</button>
            </div>
          );
        })}
        {lista.length === 0 && (
          <EmptyState
            icon="🚜"
            titulo="Nenhum ativo cadastrado"
            subtitulo="Cadastre máquinas, veículos e equipamentos motorizados. Você poderá controlar combustível, manutenções e movimentação entre obras."
            cor={ORANGE}
          />
        )}
        <Btn label="➕ Cadastrar Ativo" color={NAVY} onClick={abrirNovo} style={{ marginTop: 8 }} />
      </div>
      <KMFooter />

      <Modal show={modal} title={editandoId ? "Editar Ativo" : "Novo Ativo"} onClose={() => setModal(false)}>
        <label style={labelS}>Tipo</label>
        <select value={form.tipo} onChange={e => set("tipo", e.target.value)} style={selS}>
          {TIPOS.map(t => <option key={t}>{t}</option>)}
        </select>
        <label style={labelS}>Nome / Identificação</label>
        <input
          value={form.nome}
          onChange={e => {
            const novoNome = e.target.value;
            set("nome", novoNome);
            // Auto-preenche tipo, combustível, valor-hora, etc se bater com catálogo
            const itemCat = CATALOGO_FROTA.find(c => c.nome === novoNome);
            if (itemCat) {
              set("tipo", itemCat.tipo);
              if (itemCat.combustivel) set("combustivel", itemCat.combustivel);
              if (itemCat.consumoMedio !== undefined) set("consumoMedio", itemCat.consumoMedio);
              if (itemCat.valorHora !== undefined) set("valorHora", itemCat.valorHora);
            }
          }}
          list="catalogo-frota"
          placeholder="Ex: Retro 01, Caminhão Pipa, Escavadeira..."
          style={inputS}
        />
        <datalist id="catalogo-frota">
          {CATALOGO_FROTA_NOMES.map(n => <option key={n} value={n} />)}
        </datalist>
        <label style={labelS}>Placa</label>
        <input value={form.placa} onChange={e => set("placa", e.target.value)} placeholder="ABC-1234" style={inputS} />
        <label style={labelS}>Obra</label>
        <select value={form.obraId} onChange={e => set("obraId", e.target.value)} style={selS}>
          <option value="">Selecione</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <label style={labelS}>Horímetro / Odômetro atual</label>
        <input value={form.horimetro} onChange={e => set("horimetro", e.target.value)} type="number" placeholder="0" style={inputS} />
        <label style={labelS}>Valor por hora (R$)</label>
        <input value={form.valorHora} onChange={e => set("valorHora", e.target.value)} type="number" placeholder="80" style={inputS} />
        <Btn label={editandoId ? "SALVAR" : "ADICIONAR"} color={GREEN} onClick={salvar} />
      </Modal>

      <Modal show={!!modalAbast} title={`⛽ Abastecer ${modalAbast?.nome || ""}`} onClose={() => setModalAbast(null)}>
        <label style={labelS}>Combustível</label>
        <select value={formAbast.combustivel} onChange={e => setAB("combustivel", e.target.value)} style={selS}>
          <option>Diesel</option><option>Gasolina</option><option>Etanol</option><option>Arla</option>
        </select>
        <label style={labelS}>Litros</label>
        <input value={formAbast.litros} onChange={e => setAB("litros", e.target.value)} type="number" placeholder="50" style={inputS} />
        <label style={labelS}>Valor total (R$)</label>
        <input value={formAbast.valor} onChange={e => setAB("valor", e.target.value)} type="number" placeholder="450,00" style={inputS} />
        <label style={labelS}>Horímetro / Odômetro atual</label>
        <input value={formAbast.horimetro} onChange={e => setAB("horimetro", e.target.value)} type="number" placeholder={modalAbast?.horimetro?.toString()} style={inputS} />

        <label style={labelS}>📸 Foto do Cupom</label>
        {formAbast.fotoCupom ? (
          <div style={{ position: "relative", marginBottom: 12 }}>
            <img src={formAbast.fotoCupom} alt="Cupom" style={{ width: "100%", borderRadius: 10, border: "1.5px solid #dde2ef" }} />
            <button onClick={() => setAB("fotoCupom", null)} style={{ position: "absolute", top: 6, right: 6, background: RED, color: "#fff", border: "none", borderRadius: 16, width: 28, height: 28, cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        ) : (
          <label style={{ display: "block", padding: 14, borderRadius: 10, border: "1.5px dashed #c5d0e5", background: "#f9fafb", textAlign: "center", cursor: "pointer", fontSize: 13, color: "#666", marginBottom: 12 }}>
            📷 Tirar foto do cupom fiscal
            <input type="file" accept="image/*" capture="environment" onChange={handleFotoCupom} style={{ display: "none" }} />
          </label>
        )}

        <Btn label="✓ REGISTRAR" color={GREEN} onClick={abastecer} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   APROPRIAÇÃO DE CUSTOS POR OBRA
════════════════════════════════════ */
/* ════════════════════════════════════
   FROTA & COMBUSTÍVEL — dashboard executivo
════════════════════════════════════ */
function TelaFrota({ obras, ativos, abastecimentos, onBack, onNav }) {
  const [periodo, setPeriodo] = useState("mes"); // semana | mes | trimestre | ano
  const [filtroAtivo, setFiltroAtivo] = useState("todos");

  const hoje = new Date();
  const calcDataInicio = () => {
    const d = new Date(hoje);
    if (periodo === "semana") d.setDate(d.getDate() - 7);
    else if (periodo === "mes") d.setMonth(d.getMonth() - 1);
    else if (periodo === "trimestre") d.setMonth(d.getMonth() - 3);
    else if (periodo === "ano") d.setFullYear(d.getFullYear() - 1);
    return d;
  };
  const dataInicio = calcDataInicio();

  const dataDeStr = (s) => {
    if (!s) return null;
    try { const [d, m, y] = s.split("/"); return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)); } catch { return null; }
  };

  // Filtrar abastecimentos por período
  const abastFiltrados = (abastecimentos || []).filter(a => {
    const d = dataDeStr(a.data);
    if (!d) return false;
    if (d < dataInicio || d > hoje) return false;
    if (filtroAtivo !== "todos" && a.ativoId !== parseInt(filtroAtivo)) return false;
    return true;
  });

  // KPIs gerais
  const totalGasto = abastFiltrados.reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);
  const totalLitros = abastFiltrados.reduce((s, a) => s + (parseFloat(a.litros) || 0), 0);
  const valorPorLitro = totalLitros > 0 ? totalGasto / totalLitros : 0;
  const totalAbastecimentos = abastFiltrados.length;

  // Por veículo
  const porVeiculo = (ativos || []).map(a => {
    const abasts = abastFiltrados.filter(x => x.ativoId === a.id);
    const gasto = abasts.reduce((s, x) => s + (parseFloat(x.valor) || 0), 0);
    const litros = abasts.reduce((s, x) => s + (parseFloat(x.litros) || 0), 0);
    return { ativo: a, gasto, litros, qtd: abasts.length };
  }).filter(v => v.gasto > 0).sort((a, b) => b.gasto - a.gasto);

  // Por obra
  const porObra = obras.map(o => {
    const abasts = abastFiltrados.filter(x => x.obraId === o.id);
    const gasto = abasts.reduce((s, x) => s + (parseFloat(x.valor) || 0), 0);
    return { obra: o, gasto, qtd: abasts.length };
  }).filter(o => o.gasto > 0).sort((a, b) => b.gasto - a.gasto);

  // Evolução por dia (últimos 14 dias)
  const evolucao = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    const dStr = d.toLocaleDateString("pt-BR");
    const gastoDia = abastFiltrados
      .filter(a => a.data === dStr)
      .reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);
    evolucao.push({
      dia: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      valor: gastoDia,
    });
  }

  const cores = ["#0f2151", "#f5a623", "#2aa84f", "#dc2626", "#7c3aed", "#0891b2", "#ea580c"];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Frota & Combustível" sub="Dashboard executivo" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* Filtros */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <label style={labelS}>📅 Período</label>
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {[
              { v: "semana", l: "7d" },
              { v: "mes", l: "30d" },
              { v: "trimestre", l: "90d" },
              { v: "ano", l: "1 ano" },
            ].map(p => (
              <button key={p.v} onClick={() => setPeriodo(p.v)} style={{
                flex: 1, padding: "6px 4px", borderRadius: 6,
                border: "none",
                background: periodo === p.v ? NAVY : "#f3f4f6",
                color: periodo === p.v ? "#fff" : "#666",
                fontSize: 11, fontWeight: 700, cursor: "pointer"
              }}>{p.l}</button>
            ))}
          </div>
          <label style={labelS}>🚗 Veículo</label>
          <select value={filtroAtivo} onChange={e => setFiltroAtivo(e.target.value)} style={selS}>
            <option value="todos">Todos os veículos</option>
            {(ativos || []).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          <div style={{ background: `linear-gradient(135deg,${ORANGE},#dc7e00)`, color: "#fff", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 10, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5 }}>💰 Total gasto</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>R$ {totalGasto.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>{totalAbastecimentos} abastecimentos</div>
          </div>
          <div style={{ background: `linear-gradient(135deg,${BLUE},#0c4a6e)`, color: "#fff", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 10, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5 }}>⛽ Litros</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{totalLitros.toFixed(0)}L</div>
            <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>R$ {valorPorLitro.toFixed(2)}/litro</div>
          </div>
        </div>

        {/* Gráfico evolução */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, fontSize: 13, marginBottom: 8 }}>📈 Evolução (últimos 14 dias)</div>
          {evolucao.every(e => e.valor === 0) ? (
            <div style={{ color: "#aaa", fontSize: 11, textAlign: "center", padding: 16 }}>Sem abastecimentos nos últimos 14 dias.</div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="dia" tick={{ fontSize: 9 }} interval={1} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => "R$ " + v} />
                <Tooltip formatter={(v) => "R$ " + v.toFixed(2)} />
                <Line type="monotone" dataKey="valor" stroke={ORANGE} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Por veículo (barras) */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, fontSize: 13, marginBottom: 8 }}>🚗 Gasto por veículo</div>
          {porVeiculo.length === 0 ? (
            <div style={{ color: "#aaa", fontSize: 11, textAlign: "center", padding: 16 }}>Nenhum abastecimento no período.</div>
          ) : (
            <>
              {porVeiculo.map((v, i) => {
                const max = porVeiculo[0].gasto;
                const pct = (v.gasto / max) * 100;
                return (
                  <div key={v.ativo.id} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: NAVY }}>
                        {v.ativo.tipo === "Carro" ? "🚗" : v.ativo.tipo === "Moto" ? "🏍️" : v.ativo.tipo === "Caminhão" ? "🚛" : "🚜"} {v.ativo.nome}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: NAVY }}>R$ {v.gasto.toFixed(2)}</div>
                    </div>
                    <div style={{ height: 8, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: pct + "%", height: "100%", background: cores[i % cores.length], transition: "width 0.3s" }}></div>
                    </div>
                    <div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>
                      {v.litros.toFixed(0)}L • {v.qtd} abastecimentos
                      {v.ativo.consumoMedio && v.litros > 0 && (
                        <span> • Consumo médio: <b style={{ color: GREEN }}>{v.ativo.consumoMedio} {v.ativo.tipo === "Retroescavadeira" ? "L/h" : "km/L"}</b></span>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Por obra */}
        {porObra.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, color: NAVY, fontSize: 13, marginBottom: 8 }}>🏗️ Gasto por obra</div>
            {porObra.map((o, i) => {
              const pct = (o.gasto / totalGasto) * 100;
              return (
                <div key={o.obra.id} style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: i < porObra.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <div style={{ width: 8, height: 36, borderRadius: 4, background: cores[i % cores.length], marginRight: 10 }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{o.obra.nome}</div>
                    <div style={{ fontSize: 9, color: "#888" }}>{o.qtd} abastecimentos • {pct.toFixed(1)}% do total</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>R$ {o.gasto.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Lista de veículos pra editar */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <div style={{ flex: 1, fontWeight: 800, color: NAVY, fontSize: 13 }}>🚙 Frota cadastrada ({(ativos || []).length})</div>
            <button onClick={() => onNav && onNav("ativos")} style={{ background: NAVY, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Gerenciar</button>
          </div>
          {(ativos || []).map(a => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 22, marginRight: 8 }}>{a.tipo === "Carro" ? "🚗" : a.tipo === "Moto" ? "🏍️" : a.tipo === "Caminhão" ? "🚛" : "🚜"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{a.nome}</div>
                <div style={{ fontSize: 9, color: "#888" }}>
                  {a.placa || "Sem placa"}
                  {a.responsavel && ` • ${a.responsavel}`}
                  {a.combustivel && ` • ⛽ ${a.combustivel}`}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   DESPESAS AVULSAS — Pipa, Frete, Almoço motorista, etc
════════════════════════════════════ */
const CATEGORIAS_DESPESA = [
  { id: "pipa",     nome: "💧 Pipa d'água",         cor: "#0891b2", desc: "Caminhão pipa pra molhar a obra" },
  { id: "frete",    nome: "🚛 Frete avulso",        cor: "#0f2151", desc: "Transporte de material/equipamento" },
  { id: "almoco",   nome: "🍱 Almoço de terceiros", cor: "#f97316", desc: "Almoço motorista/visita do fornecedor" },
  { id: "solo",     nome: "🚜 Viagem de solo/bica", cor: "#92400e", desc: "Caminhões trazendo material" },
  { id: "hospedagem", nome: "🏨 Hospedagem",        cor: "#7c3aed", desc: "Estadia equipe externa" },
  { id: "diaria_extra", nome: "💵 Diária extra",    cor: "#dc2626", desc: "Pagamento avulso fora da folha" },
  { id: "manutencao_avulsa", nome: "🔧 Manutenção avulsa", cor: "#525252", desc: "Conserto pontual" },
  { id: "taxas",    nome: "📋 Taxas / impostos",    cor: "#16a34a", desc: "Taxas, alvarás, ART" },
  { id: "outros",   nome: "💸 Outros",              cor: "#6b7280", desc: "Outras despesas avulsas" },
];

function TelaDespesasAvulsas({ obras, despesas = [], onBack, onAdd, onEditar, onRemover }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [filtroObra, setFiltroObra] = useState("todas");
  const [filtroMes, setFiltroMes] = useState(new Date().getMonth());
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear());
  const [fotoVer, setFotoVer] = useState(null);

  const [form, setForm] = useState({
    categoria: "", obraId: "", data: new Date().toLocaleDateString("pt-BR"),
    valor: "", descricao: "", quemPagou: "", foto: ""
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const abrirNovo = () => {
    setEditandoId(null);
    setForm({ categoria: "", obraId: filtroObra !== "todas" ? filtroObra : "", data: new Date().toLocaleDateString("pt-BR"), valor: "", descricao: "", quemPagou: "Caixa da obra", foto: "" });
    setModal(true);
  };

  const abrirEdit = (d) => {
    setEditandoId(d.id);
    setForm({ ...d });
    setModal(true);
  };

  const salvar = () => {
    if (!form.categoria || !form.obraId || !form.valor) {
      alert("⚠️ Preencha categoria, obra e valor");
      return;
    }
    const dados = {
      ...form,
      id: editandoId || Date.now(),
      valor: parseFloat(form.valor) || 0,
      obraId: parseInt(form.obraId),
    };
    if (editandoId) onEditar(dados);
    else onAdd(dados);
    setModal(false);
  };

  const tirarFoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => set("foto", ev.target.result);
    r.readAsDataURL(f);
  };

  // Filtrar despesas
  const despesasFiltradas = (despesas || []).filter(d => {
    if (filtroObra !== "todas" && d.obraId !== parseInt(filtroObra)) return false;
    try {
      const [dia, mes, ano] = (d.data || "").split("/");
      if (parseInt(mes) - 1 !== filtroMes) return false;
      if (parseInt(ano) !== filtroAno) return false;
    } catch { return false; }
    return true;
  });

  // KPIs
  const totalMes = despesasFiltradas.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
  const porCategoria = {};
  despesasFiltradas.forEach(d => {
    porCategoria[d.categoria] = (porCategoria[d.categoria] || 0) + (parseFloat(d.valor) || 0);
  });
  const topCategorias = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Despesas Avulsas" sub={`${despesasFiltradas.length} no período`} onBack={onBack} right={
        <button onClick={abrirNovo} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ Nova</button>
      } />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* KPI Total */}
        <div style={{ background: `linear-gradient(135deg,${ORANGE},#dc7e00)`, color: "#fff", borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>💸 Total no período</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>R$ {totalMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          {topCategorias.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 10, opacity: 0.9 }}>
              Top: {topCategorias.map(([cat, v]) => {
                const c = CATEGORIAS_DESPESA.find(x => x.id === cat);
                return `${c?.nome || cat} R$${v.toFixed(0)}`;
              }).join(" • ")}
            </div>
          )}
        </div>

        {/* Filtros */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <label style={labelS}>🏗️ Obra</label>
          <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={selS}>
            <option value="todas">Todas as obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 2 }}>
              <label style={labelS}>📅 Mês</label>
              <select value={filtroMes} onChange={e => setFiltroMes(parseInt(e.target.value))} style={{ ...selS, marginBottom: 0 }}>
                {meses.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelS}>Ano</label>
              <input type="number" value={filtroAno} onChange={e => setFiltroAno(parseInt(e.target.value))} style={{ ...inputS, marginBottom: 0 }} />
            </div>
          </div>
        </div>

        {/* Lista */}
        {despesasFiltradas.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", color: "#aaa" }}>
            💸 Nenhuma despesa avulsa neste período.
            <button onClick={abrirNovo} style={{ display: "block", margin: "12px auto 0", background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>+ Adicionar primeira</button>
          </div>
        ) : (
          despesasFiltradas.sort((a, b) => b.id - a.id).map(d => {
            const cat = CATEGORIAS_DESPESA.find(c => c.id === d.categoria) || { nome: d.categoria, cor: "#888" };
            const obra = obras.find(o => o.id === d.obraId);
            return (
              <div key={d.id} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${cat.cor}` }}>
                <div style={{ display: "flex", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ background: cat.cor, color: "#fff", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800 }}>{cat.nome}</span>
                      <span style={{ fontSize: 9, color: "#888" }}>{d.data}</span>
                    </div>
                    <div style={{ fontSize: 12, color: NAVY, fontWeight: 700, marginTop: 2 }}>{obra?.nome || "—"}</div>
                    {d.descricao && <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{d.descricao}</div>}
                    {d.quemPagou && <div style={{ fontSize: 10, color: "#888", marginTop: 2, fontStyle: "italic" }}>💰 Pago por: {d.quemPagou}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: cat.cor }}>R$ {(parseFloat(d.valor) || 0).toFixed(2)}</div>
                    <button onClick={() => abrirEdit(d)} style={{ background: "none", border: "none", color: BLUE, fontSize: 16, cursor: "pointer", marginTop: 4 }}>✏️</button>
                  </div>
                </div>
                {d.foto && (
                  <img src={d.foto} alt="Comprovante" onClick={() => setFotoVer({ src: d.foto, legenda: `Comprovante: ${d.descricao || d.categoria}` })} style={{ width: "100%", borderRadius: 8, marginTop: 8, border: "1px solid #eee", cursor: "pointer" }} />
                )}
              </div>
            );
          })
        )}
      </div>
      <KMFooter />

      {/* MODAL ADD/EDITAR */}
      <Modal show={modal} title={editandoId ? "Editar Despesa" : "Nova Despesa Avulsa"} onClose={() => setModal(false)}>
        <label style={labelS}>📋 Categoria</label>
        <select value={form.categoria} onChange={e => set("categoria", e.target.value)} style={selS}>
          <option value="">— Selecione —</option>
          {CATEGORIAS_DESPESA.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        {form.categoria && (
          <div style={{ fontSize: 10, color: "#888", marginTop: -8, marginBottom: 10, fontStyle: "italic" }}>
            {CATEGORIAS_DESPESA.find(c => c.id === form.categoria)?.desc}
          </div>
        )}

        <label style={labelS}>🏗️ Obra</label>
        <select value={form.obraId} onChange={e => set("obraId", e.target.value)} style={selS}>
          <option value="">— Selecione —</option>
          {obras.filter(o => o.status === "Ativa").map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <label style={labelS}>📅 Data</label>
        <input value={form.data} onChange={e => set("data", e.target.value)} placeholder="DD/MM/AAAA" style={inputS} />

        <label style={labelS}>💰 Valor (R$)</label>
        <input value={form.valor} onChange={e => set("valor", e.target.value)} type="number" placeholder="Ex: 250" style={inputS} />

        <label style={labelS}>📝 Descrição</label>
        <textarea value={form.descricao} onChange={e => set("descricao", e.target.value)} rows={2} placeholder="Ex: Pipa pra molhar pavimento Trecho 2 - Posto Shell BR-262" style={{ ...inputS, fontFamily: "inherit", resize: "none" }} />

        <label style={labelS}>💳 Pago por</label>
        <select value={form.quemPagou} onChange={e => set("quemPagou", e.target.value)} style={selS}>
          <option value="Caixa da obra">Caixa da obra</option>
          <option value="Adiantamento empresa">Adiantamento empresa</option>
          <option value="Kleber (reembolso)">Kleber (reembolso)</option>
          <option value="Encarregado (reembolso)">Encarregado (reembolso)</option>
          <option value="Cartão da empresa">Cartão da empresa</option>
          <option value="PIX direto">PIX direto</option>
        </select>

        <label style={labelS}>📷 Foto do comprovante (opcional)</label>
        {form.foto ? (
          <div style={{ position: "relative", marginBottom: 10 }}>
            <img src={form.foto} alt="" style={{ width: "100%", borderRadius: 10 }} />
            <button onClick={() => set("foto", "")} style={{ position: "absolute", top: 6, right: 6, background: RED, color: "#fff", border: "none", borderRadius: 16, width: 28, height: 28, cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        ) : (
          <label style={{ display: "block", textAlign: "center", padding: 12, border: "1.5px dashed #dde2ef", borderRadius: 10, color: "#666", cursor: "pointer", fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
            📷 Anexar foto do recibo/cupom
            <input type="file" accept="image/*" capture="environment" onChange={tirarFoto} style={{ display: "none" }} />
          </label>
        )}

        {editandoId && (
          <button onClick={() => { confirmar("Excluir esta despesa?", () => { onRemover(editandoId); setModal(false); }) }} style={{ width: "100%", padding: 10, background: "#fef2f2", color: RED, border: `1px solid ${RED}33`, borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 12, marginBottom: 8 }}>🗑️ Excluir</button>
        )}
        <Btn label="💾 SALVAR" color={GREEN} onClick={salvar} />
      </Modal>
      {fotoVer && <FotoViewer src={fotoVer.src} legenda={fotoVer.legenda} onClose={() => setFotoVer(null)} />}
    </div>
  );
}

function TelaCustos({ obras, trabalhadores, historico, ativos, abastecimentos, pedidos, despesasAvulsas = [], onBack }) {
  const [obraId, setObraId] = useState(obras[0]?.id || 1);
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const obra = obras.find(o => o.id === obraId);
  const trabObra = trabalhadores.filter(t => t.obraId === obraId);
  const ativosObra = ativos.filter(a => a.obraId === obraId);
  const abastObra = abastecimentos.filter(a => a.obraId === obraId);

  // Calcular custo de mão de obra: diária × dias trabalhados (presença + atestado)
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  let custoMaoObra = 0;
  let totalDiasTrab = 0;
  trabObra.forEach(t => {
    let diasPagos = 0;
    for (let d = 1; d <= totalDias; d++) {
      const iso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const s = (historico[iso] || {})[t.id];
      if (s === "Presente" || s === "Atestado") diasPagos++;
    }
    const diaria = parseFloat(t.diaria) || 0;
    custoMaoObra += diasPagos * diaria;
    totalDiasTrab += diasPagos;
  });

  // Custo de combustível (só dos abastecimentos da obra, mês/ano corretos)
  const custoCombustivel = abastObra
    .filter(a => {
      if (!a.ts && !a.data) return false;
      try {
        if (a.ts) {
          const d = new Date(a.ts);
          return d.getMonth() === mes && d.getFullYear() === ano;
        }
        const [dia, m, an] = (a.data || "").split("/");
        return parseInt(m) - 1 === mes && parseInt(an) === ano;
      } catch { return false; }
    })
    .reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);

  // Custo de materiais aprovados
  const custoMateriais = pedidos
    .filter(p => p.obraId === obraId && p.status === "Aprovado")
    .filter(p => {
      if (!p.data) return false;
      try {
        const partes = p.data.split("/");
        if (partes.length < 3) return false;
        return parseInt(partes[1]) - 1 === mes && parseInt(partes[2]) === ano;
      } catch { return false; }
    })
    .length * 100; // estimativa simples — pode ser refinado depois

  // 💸 Despesas avulsas (PIPA, frete, almoço motorista, etc)
  const despesasObra = (despesasAvulsas || []).filter(d => {
    if (d.obraId !== obraId) return false;
    if (!d.data) return false;
    try {
      const partes = d.data.split("/");
      if (partes.length < 3) return false;
      return parseInt(partes[1]) - 1 === mes && parseInt(partes[2]) === ano;
    } catch { return false; }
  });
  const custoDespesasAvulsas = despesasObra.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

  const total = custoMaoObra + custoCombustivel + custoMateriais + custoDespesasAvulsas;
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Custos por Obra" sub={`${meses[mes]}/${ano}`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <select value={obraId} onChange={e => setObraId(parseInt(e.target.value))} style={{ ...selS, marginBottom: 8 }}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <select value={mes} onChange={e => setMes(parseInt(e.target.value))} style={{ ...selS, flex: 2, marginBottom: 0 }}>
            {meses.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(parseInt(e.target.value))} style={{ ...selS, flex: 1, marginBottom: 0 }}>
            {[ano - 1, ano, ano + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div style={{ background: `linear-gradient(135deg,${NAVY},#243b7a)`, borderRadius: 14, padding: 16, marginBottom: 12, color: "#fff", boxShadow: "0 4px 14px rgba(15,33,81,0.3)" }}>
          <div style={{ fontSize: 11, opacity: 0.8 }}>📍 {obra?.nome}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Custo total apropriado</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: GOLD }}>R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderLeft: `4px solid ${GREEN}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>👷 Mão de Obra</div>
              <div style={{ fontSize: 11, color: "#888" }}>{totalDiasTrab} dias-homem • {trabObra.length} colaborador(es)</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: GREEN }}>R$ {custoMaoObra.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderLeft: `4px solid ${ORANGE}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>⛽ Combustível</div>
              <div style={{ fontSize: 11, color: "#888" }}>{ativosObra.length} ativo(s) • {abastObra.length} abastecimento(s)</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: ORANGE }}>R$ {custoCombustivel.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderLeft: `4px solid ${BLUE}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>📦 Materiais</div>
              <div style={{ fontSize: 11, color: "#888" }}>Pedidos aprovados (estimado)</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: BLUE }}>R$ {custoMateriais.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        {/* DESPESAS AVULSAS */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderLeft: `4px solid #ea580c` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>💸 Despesas avulsas</div>
              <div style={{ fontSize: 11, color: "#888" }}>{despesasObra.length} despesa{despesasObra.length === 1 ? "" : "s"} (PIPA, frete, almoço motorista...)</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#ea580c" }}>R$ {custoDespesasAvulsas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          </div>
          {despesasObra.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f0f0f0" }}>
              {despesasObra.slice(0, 5).map(d => {
                const cat = CATEGORIAS_DESPESA.find(c => c.id === d.categoria) || { nome: d.categoria, cor: "#888" };
                return (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", padding: "4px 0", fontSize: 11 }}>
                    <span style={{ background: cat.cor, color: "#fff", padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, marginRight: 6 }}>{cat.nome}</span>
                    <span style={{ flex: 1, color: "#666" }}>{d.descricao || cat.nome}</span>
                    <span style={{ fontWeight: 700, color: "#ea580c" }}>R$ {(parseFloat(d.valor) || 0).toFixed(2)}</span>
                  </div>
                );
              })}
              {despesasObra.length > 5 && <div style={{ fontSize: 10, color: "#888", marginTop: 4, textAlign: "center" }}>+ {despesasObra.length - 5} despesas...</div>}
            </div>
          )}
        </div>

        <div style={{ background: "#fffaeb", borderRadius: 12, padding: "10px 14px", fontSize: 11, color: "#8b6f00", marginTop: 8 }}>
          💡 Custo de mão de obra = diária × dias trabalhados (presença + atestado). Custos de materiais estimados em R$ 100/pedido aprovado. Despesas avulsas vêm do registro manual.
        </div>
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   FÉRIAS
════════════════════════════════════ */
function TelaFerias({ obras, trabalhadores, ferias, onBack, onAdd, onRemove }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ trabId: "", inicio: "", fim: "", obs: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const hoje = new Date();
  const emFerias = ferias.filter(f => new Date(f.inicio) <= hoje && new Date(f.fim) >= hoje);
  const futuras = ferias.filter(f => new Date(f.inicio) > hoje);
  const passadas = ferias.filter(f => new Date(f.fim) < hoje);

  const salvar = () => {
    if (!form.trabId || !form.inicio || !form.fim) return;
    onAdd({ id: Date.now(), trabId: parseInt(form.trabId), inicio: form.inicio, fim: form.fim, obs: form.obs });
    setModal(false);
    setForm({ trabId: "", inicio: "", fim: "", obs: "" });
  };

  const renderItem = (f, color) => {
    const t = trabalhadores.find(x => x.id === f.trabId);
    const obra = obras.find(o => o.id === t?.obraId);
    return (
      <div key={f.id} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${color}` }}>
        <div style={{ width: 30, height: 30, borderRadius: 15, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginRight: 10 }}>🌴</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{t?.nome || "—"}</div>
          <div style={{ fontSize: 11, color: "#888" }}>{t?.cargo} • {obra?.nome}</div>
          <div style={{ fontSize: 11, color, fontWeight: 700, marginTop: 2 }}>{new Date(f.inicio).toLocaleDateString("pt-BR")} → {new Date(f.fim).toLocaleDateString("pt-BR")}</div>
          {f.obs && <div style={{ fontSize: 10, color: "#999", fontStyle: "italic" }}>{f.obs}</div>}
        </div>
        <button onClick={() => onRemove(f.id)} style={{ background: "#fee2e2", border: "2px solid #d63b3b", color: "#d63b3b", cursor: "pointer", padding: "6px 10px", borderRadius: 8, fontSize: 16, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Férias" sub="Escala de descanso" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, background: GREEN, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{emFerias.length}</div>
            <div style={{ fontSize: 10 }}>Em férias</div>
          </div>
          <div style={{ flex: 1, background: BLUE, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{futuras.length}</div>
            <div style={{ fontSize: 10 }}>Programadas</div>
          </div>
          <div style={{ flex: 1, background: "#888", borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{passadas.length}</div>
            <div style={{ fontSize: 10 }}>Concluídas</div>
          </div>
        </div>

        {emFerias.length > 0 && <>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, fontSize: 13 }}>🌴 Em férias agora</div>
          {emFerias.map(f => renderItem(f, GREEN))}
        </>}
        {futuras.length > 0 && <>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, fontSize: 13, marginTop: 12 }}>📅 Programadas</div>
          {futuras.map(f => renderItem(f, BLUE))}
        </>}
        {passadas.length > 0 && <>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, fontSize: 13, marginTop: 12 }}>✓ Concluídas</div>
          {passadas.slice(0, 5).map(f => renderItem(f, "#888"))}
        </>}

        <Btn label="➕ Programar Férias" color={NAVY} onClick={() => setModal(true)} style={{ marginTop: 12 }} />
      </div>
      <KMFooter />

      <Modal show={modal} title="Programar Férias" onClose={() => setModal(false)}>
        <label style={labelS}>Trabalhador</label>
        <select value={form.trabId} onChange={e => set("trabId", e.target.value)} style={selS}>
          <option value="">Selecione</option>
          {trabalhadores.map(t => <option key={t.id} value={t.id}>{t.nome} — {t.cargo}</option>)}
        </select>
        <label style={labelS}>Data início</label>
        <input value={form.inicio} onChange={e => set("inicio", e.target.value)} type="date" style={inputS} />
        <label style={labelS}>Data fim</label>
        <input value={form.fim} onChange={e => set("fim", e.target.value)} type="date" style={inputS} />
        <label style={labelS}>Observação (opcional)</label>
        <input value={form.obs} onChange={e => set("obs", e.target.value)} placeholder="Férias regulares 30 dias..." style={inputS} />
        <Btn label="SALVAR" color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   RDO ABNT — Relatório Diário com numeração e PDF padrão ABNT
════════════════════════════════════ */
function gerarPDFRDORabnt({ numero, obra, data, clima, observacoes, presencas, trabalhadores, ativos, abastecimentos, pedidos, ocorrencias, encarregado, empresa, horasTrabalhadas, horimetros, fotos, alimentacao, totalAlimentacao, recebimentos }) {
  const trabObra = trabalhadores.filter(t => t.obraId === obra.id);
  const ativosObra = ativos.filter(a => a.obraId === obra.id);
  const abastDia = abastecimentos.filter(a => a.obraId === obra.id && a.data === data);
  const pedidosDia = pedidos.filter(p => p.obraId === obra.id && p.data === data);

  const presentes = trabObra.filter(t => presencas[t.id] === "Presente").length;
  const faltas    = trabObra.filter(t => presencas[t.id] === "Falta").length;
  const atestados = trabObra.filter(t => presencas[t.id] === "Atestado").length;
  // Calcula total de horas com horas trabalhadas reais (se passadas)
  let totalHoras = 0;
  let totalHE = 0;
  trabObra.forEach(t => {
    if (presencas[t.id] === "Presente") {
      const h = horasTrabalhadas?.[t.id] || 9;
      totalHoras += h;
      if (h > 9) totalHE += (h - 9);
    }
  });

  const html = `<html><head><title>RDO ${String(numero).padStart(3, "0")} — ${obra.nome}</title>
    <style>
      ${KM_PDF_PAGE_CSS}
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 9.5pt; line-height: 1.35; }
      .cabecalho { border: 2px solid #004080; padding: 0; margin-bottom: 12px; }
      .cabecalho-top { background: #004080; color: #fff; padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; }
      .logo { font-weight: 900; font-size: 22pt; letter-spacing: -1px; line-height: 1; }
      .logo-zero { color: #C0A040; }
      .logo-sub { font-size: 8pt; letter-spacing: 2.5px; opacity: 0.8; margin-top: 2px; }
      .titulo-rdo { font-size: 14pt; font-weight: 800; letter-spacing: 1px; }
      .num-rdo { font-size: 10pt; font-weight: 700; color: #C0A040; margin-top: 2px; text-align: right; }
      .empresa-info { padding: 8px 14px; background: #f5f8fc; font-size: 8.5pt; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; border-top: 1px solid #d0dae8; }
      .empresa-info b { color: #004080; }
      .info-obra { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 1px solid #ccc; margin-bottom: 12px; }
      .info-cell { padding: 6px 10px; border-right: 1px solid #ccc; }
      .info-cell:last-child { border-right: none; }
      .info-cell .lbl { font-size: 7.5pt; color: #777; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
      .info-cell .val { font-size: 11pt; color: #1a1a1a; font-weight: 700; margin-top: 1px; }
      h2 { color: #fff; background: #004080; font-size: 9.5pt; margin: 14px 0 0; padding: 5px 10px; letter-spacing: 0.5px; font-weight: 700; text-transform: uppercase; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 8.5pt; table-layout: auto; }
      th { background: #e8eef6; color: #003060; padding: 5px 6px; border: 1px solid #c5d0e0; text-align: left; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; white-space: nowrap; }
      td { padding: 4px 6px; border: 1px solid #d5dce6; vertical-align: top; overflow-wrap: break-word; word-break: normal; }
      /* Apenas em colunas de observação/texto longo permitimos quebra: usar classe .td-wrap */
      td.td-wrap, th.td-wrap { white-space: normal; overflow-wrap: break-word; word-break: normal; max-width: 280px; }
      /* Tabelas envolvidas em wrapper com scroll horizontal se passar */
      .table-scroll { overflow-x: auto; max-width: 100%; }
      /* Coluna 1 (numero): compacta */
      th:first-child, td:first-child { min-width: 28px; }
      /* Coluna 2 (nome): NÃO quebra, coluna se alarga ao texto */
      th:nth-child(2), td:nth-child(2) { white-space: nowrap; min-width: 100px; }
      td.num { text-align: right; white-space: nowrap; }
      tr:nth-child(even) td { background: #fafbfd; }
      .num { text-align: center; font-variant-numeric: tabular-nums; }
      .badge-p { color: #2aa84f; font-weight: 700; }
      .badge-f { color: #d63b3b; font-weight: 700; }
      .badge-a { color: #e87722; font-weight: 700; }
      .resumo { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 6px 0 12px; }
      .resumo-card { padding: 6px; border: 1px solid #d5dce6; text-align: center; background: #fafbfd; }
      .resumo-card .v { font-size: 14pt; font-weight: 800; color: #004080; }
      .resumo-card .l { font-size: 7.5pt; color: #666; text-transform: uppercase; letter-spacing: 0.4px; }
      .obs-bloco { border: 1px solid #ccc; padding: 8px 10px; min-height: 50px; font-size: 9pt; background: #fafbfd; margin-bottom: 12px; line-height: 1.5; }
      .ocorrencia { padding: 5px 10px; border-left: 3px solid #C0A040; background: #fffbf0; margin-bottom: 4px; font-size: 9pt; }
      .ocorrencia .ts { font-size: 7.5pt; color: #888; margin-bottom: 2px; }
      .vazio { color: #aaa; font-style: italic; font-size: 9pt; padding: 8px; text-align: center; }
      .footer { margin-top: 16px; border-top: 2px solid #004080; padding-top: 8px; text-align: center; font-size: 7.5pt; color: #666; }
      .footer b { color: #004080; }

      /* MULTI-PÁGINA: regras de quebra para A4 */
      h2 { page-break-after: avoid; break-after: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; break-inside: avoid; }
      thead { display: table-header-group; }
      .ocorrencia, .obs-bloco { page-break-inside: avoid; break-inside: avoid; }
      img { page-break-inside: avoid; break-inside: avoid; max-width: 100%; }

      @media print {
        h2 + table thead { display: table-header-group; }
        .footer { page-break-before: avoid; }
      }
      ${KM_PDF_CSS}
    </style></head><body>

    ${gerarHeaderHTML({ tipo: "Relatório Diário de Obra", numero, info_extra: `${obra.nome} · ${obra.local || ""} · ${data} · Clima: ${clima || "—"}`, empresa })}

    <div class="resumo">
      <div class="resumo-card"><div class="v">${trabObra.length}</div><div class="l">Efetivo</div></div>
      <div class="resumo-card"><div class="v" style="color:#2aa84f">${presentes}</div><div class="l">Presentes</div></div>
      <div class="resumo-card"><div class="v" style="color:#d63b3b">${faltas}</div><div class="l">Faltas</div></div>
      <div class="resumo-card"><div class="v" style="color:#004080">${totalHoras}h</div><div class="l">Total Horas</div></div>
    </div>

    <h2>1. Mão de Obra — Apropriação de Custo Direto</h2>
    <table>
      <tr><th style="width:5%" class="num">Nº</th><th>Nome</th><th style="width:22%">Cargo</th><th style="width:9%" class="num">Entrada</th><th style="width:9%" class="num">Saída</th><th style="width:9%" class="num">Total h</th><th style="width:9%" class="num">H.E. (50%)</th><th style="width:11%" class="num">Status</th></tr>
      ${trabObra.length === 0 ? '<tr><td colspan="8" class="vazio">Sem mão de obra registrada</td></tr>' : trabObra.map((t, i) => {
        const status = presencas[t.id] || "Sem registro";
        const presente = status === "Presente";
        const horas = horasTrabalhadas?.[t.id] ?? (presente ? 9 : 0);
        const he = horas > 9 ? (horas - 9) : 0;
        // Calcula entrada e saída com base nas horas trabalhadas (padrão 7-11 + 12-17)
        const entrada = presente ? "07:00" : "—";
        // saída: se 9h normal = 17:00, mais HE depois
        let saida = "—";
        if (presente) {
          const totalH = horas + 1; // +1h almoço
          // calcula saída com base em 7h início e horas trabalhadas + 1h almoço (12-13)
          const saidaH = 7 + totalH; // ex: 9h trabalhadas + 1h almoço = 17h
          saida = String(Math.floor(saidaH)).padStart(2, "0") + ":" + String(Math.round((saidaH - Math.floor(saidaH)) * 60)).padStart(2, "0");
        }
        const cls = status === "Presente" ? "badge-p" : status === "Falta" ? "badge-f" : status === "Atestado" ? "badge-a" : "";
        return `<tr><td class="num">${i + 1}</td><td>${t.nome}</td><td>${t.cargo}</td><td class="num">${entrada}</td><td class="num">${saida}</td><td class="num"><b>${horas}h</b></td><td class="num" style="color:${he > 0 ? '#dc2626' : '#999'};font-weight:${he > 0 ? '700' : '400'}">${he > 0 ? "+" + he + "h" : "—"}</td><td class="num ${cls}">${status}</td></tr>`;
      }).join("")}
    </table>

    <h2>2. Ativos e Logística — Maquinário e Frota</h2>
    <table>
      <tr><th style="width:5%" class="num">Nº</th><th>Identificação</th><th style="width:14%">Placa</th><th style="width:14%">Tipo</th><th style="width:10%" class="num">Início (h)</th><th style="width:10%" class="num">Fim (h)</th><th style="width:9%" class="num">Trabalhadas</th><th style="width:13%" class="num">Combustível</th></tr>
      ${ativosObra.length === 0 ? '<tr><td colspan="8" class="vazio">Sem ativos nesta obra</td></tr>' : ativosObra.map((a, i) => {
        const abastA = abastDia.filter(x => x.ativoId === a.id);
        const totalAbast = abastA.reduce((s, x) => s + x.valor, 0);
        const horim = horimetros?.[a.id] || null;
        const inicioH = horim ? horim.inicio.toFixed(1) : "—";
        const fimH = horim ? horim.fim.toFixed(1) : "—";
        const trabH = horim ? `<b>${horim.horas}h</b>` : "—";
        return `<tr><td class="num">${i + 1}</td><td><b>${a.nome}</b></td><td>${a.placa || "—"}</td><td>${a.tipo}</td><td class="num">${inicioH}</td><td class="num">${fimH}</td><td class="num">${trabH}</td><td class="num">R$ ${totalAbast.toFixed(2)}</td></tr>`;
      }).join("")}
    </table>

    ${abastDia.length > 0 ? `
    <h2>2.1. Abastecimentos do Dia</h2>
    <table>
      <tr><th style="width:5%" class="num">Nº</th><th>Veículo</th><th style="width:13%">Posto</th><th style="width:10%" class="num">Litros</th><th style="width:11%" class="num">R$/Litro</th><th style="width:13%" class="num">Valor</th><th style="width:11%" class="num">Km/Horímetro</th></tr>
      ${abastDia.map((a, i) => {
        const ativo = ativosObra.find(x => x.id === a.ativoId);
        const valorLitro = a.litros > 0 ? (a.valor / a.litros).toFixed(2) : "—";
        return `<tr>
          <td class="num">${i + 1}</td>
          <td><b>${ativo?.nome || "—"}</b>${ativo?.placa ? `<br/><span style="font-size:8pt;color:#666">${ativo.placa}</span>` : ""}</td>
          <td>${a.posto || "—"}</td>
          <td class="num">${(parseFloat(a.litros) || 0).toFixed(1)}</td>
          <td class="num">R$ ${valorLitro}</td>
          <td class="num"><b>R$ ${(parseFloat(a.valor) || 0).toFixed(2)}</b></td>
          <td class="num">${a.km || a.horimetro || "—"}</td>
        </tr>`;
      }).join("")}
      <tr style="background:#fef9e7;font-weight:800">
        <td colspan="3" style="text-align:right">TOTAL DO DIA</td>
        <td class="num">${abastDia.reduce((s, a) => s + (parseFloat(a.litros) || 0), 0).toFixed(1)}L</td>
        <td></td>
        <td class="num" style="color:#dc7e00">R$ ${abastDia.reduce((s, a) => s + (parseFloat(a.valor) || 0), 0).toFixed(2)}</td>
        <td></td>
      </tr>
    </table>
    ` : ""}

    ${pedidosDia.length > 0 ? `
      <h2>3. Materiais e Insumos</h2>
      <table>
        <tr><th style="width:11%" class="num">Pedido Nº</th><th>Material</th><th style="width:18%">Quantidade</th><th style="width:20%">Solicitante</th><th style="width:14%" class="num">Status</th></tr>
        ${pedidosDia.map((p, i) => {
          const cls = p.status === "Aprovado" ? "badge-p" : p.status === "Negado" ? "badge-f" : "badge-a";
          const numPed = String(p.id).slice(-6);
          return `<tr><td class="num"><b>${numPed}</b></td><td>${p.material}</td><td>${fmtQtd(p.qtd)}</td><td>${p.enc}</td><td class="num ${cls}">${p.status}</td></tr>`;
        }).join("")}
      </table>
    ` : ""}

    <h2>4. Observações Gerais</h2>
    <div class="obs-bloco">${observacoes ? observacoes.replace(/\n/g, "<br>") : '<span class="vazio">— Sem observações —</span>'}</div>

    ${alimentacao && Object.keys(alimentacao).length > 0 ? `
    <h2>5. Alimentação do Dia</h2>
    <table>
      <tr>
        <th style="width:30%">Trabalhador</th>
        <th style="width:14%" class="num">☕ Manhã</th>
        <th style="width:14%" class="num">☕ Tarde</th>
        <th style="width:14%" class="num">🍱 Marmita</th>
        <th style="width:14%" class="num">🥪 Lanche</th>
        <th style="width:14%" class="num">Total</th>
      </tr>
      ${trabalhadores.filter(t => presencas[t.id] === "Presente").map(t => {
        const a = alimentacao[t.id] || {};
        const totalDia = (a.cafeManha ? (empresa.valorCafeManha || 4) : 0)
          + (a.cafeTarde ? (empresa.valorCafeTarde || 4) : 0)
          + (a.marmita ? (empresa.valorMarmita || 18) : 0)
          + (a.lanche ? (empresa.valorLanche || 10) : 0);
        return `<tr>
          <td>${t.nome}</td>
          <td class="num" style="color:${a.cafeManha ? '#2aa84f' : '#ccc'}">${a.cafeManha ? "✓ R$ " + (empresa.valorCafeManha || 4).toFixed(2) : "—"}</td>
          <td class="num" style="color:${a.cafeTarde ? '#2aa84f' : '#ccc'}">${a.cafeTarde ? "✓ R$ " + (empresa.valorCafeTarde || 4).toFixed(2) : "—"}</td>
          <td class="num" style="color:${a.marmita ? '#dc2626' : '#ccc'}">${a.marmita ? "✓ R$ " + (empresa.valorMarmita || 18).toFixed(2) : "—"}</td>
          <td class="num" style="color:${a.lanche ? '#0891b2' : '#ccc'}">${a.lanche ? "✓ R$ " + (empresa.valorLanche || 10).toFixed(2) : "—"}</td>
          <td class="num"><b>R$ ${totalDia.toFixed(2)}</b></td>
        </tr>`;
      }).join("")}
      <tr style="background:#fef9e7;font-weight:800">
        <td colspan="5" style="text-align:right">TOTAL DO DIA</td>
        <td class="num" style="color:#dc7e00">R$ ${(totalAlimentacao || 0).toFixed(2)}</td>
      </tr>
    </table>
    ` : ""}

    <h2>${alimentacao && Object.keys(alimentacao).length > 0 ? "6" : "5"}. Ocorrências Técnicas do Dia</h2>
    ${ocorrencias && ocorrencias.length > 0 ? ocorrencias.map(o => `
      <div class="ocorrencia">
        <div class="ts">📌 ${o.autor || "—"} • ${new Date(o.ts).toLocaleString("pt-BR")}</div>
        ${o.texto.replace(/\n/g, "<br>")}
      </div>`).join("") : '<div class="vazio">Nenhuma ocorrência registrada.</div>'}

    ${(() => {
      // Coletar TODAS as fotos: do encarregado + cupons combustível + recebimentos + ocorrências
      const todasFotos = [];

      // 1) Fotos enviadas pelo encarregado na etapa "Fotos"
      (fotos || []).forEach((f, i) => {
        todasFotos.push({ src: f, tipo: "Obra", legenda: `Foto da obra ${i + 1}`, cor: "#0f2151" });
      });

      // 2) Cupons fiscais de combustível do dia
      (abastDia || []).forEach(a => {
        if (a.fotoCupom) {
          const ativo = ativos.find(x => x.id === a.ativoId);
          todasFotos.push({
            src: a.fotoCupom,
            tipo: "Combustível",
            legenda: `⛽ ${ativo?.nome || "Veículo"} — R$ ${(parseFloat(a.valor) || 0).toFixed(2)} (${a.posto || "posto"})`,
            cor: "#dc7e00"
          });
        }
      });

      // 3) Fotos de recebimentos do dia (se a função recebeu o array)
      if (typeof recebimentos !== "undefined" && Array.isArray(recebimentos)) {
        recebimentos.filter(r => r.obraId === obra.id && r.data === data).forEach(r => {
          if (r.foto) {
            todasFotos.push({
              src: r.foto,
              tipo: "Recebimento",
              legenda: `📦 ${r.material} — ${r.qtd} (${r.conformidade || "Conforme"})`,
              cor: "#0891b2"
            });
          }
        });
      }

      // 4) Fotos das ocorrências do diário do dia
      (ocorrencias || []).forEach(o => {
        if (o.foto) {
          todasFotos.push({
            src: o.foto,
            tipo: "Ocorrência",
            legenda: `📝 ${(o.texto || "").substring(0, 50)}${o.texto && o.texto.length > 50 ? "..." : ""}`,
            cor: "#7c3aed"
          });
        }
      });

      if (todasFotos.length === 0) return "";

      const numSecao = alimentacao && Object.keys(alimentacao).length > 0 ? "7" : "6";

      return `
        <h2>${numSecao}. Registro Fotográfico (${todasFotos.length} foto${todasFotos.length > 1 ? "s" : ""})</h2>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 6px;">
          ${todasFotos.map((f, i) => `
            <div style="break-inside: avoid; border: 1px solid #ccc; border-radius: 4px; overflow: hidden; page-break-inside: avoid;">
              <div style="background:${f.cor};color:#fff;padding:2px 5px;font-size:7pt;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:0.5px;">${f.tipo}</div>
              <img src="${f.src}" alt="Foto ${i + 1}" style="width: 100%; height: 110px; object-fit: cover; display: block;" />
              <div style="padding: 3px 5px; font-size: 7pt; color: #444; background: #f5f8fc; line-height: 1.2;">${f.legenda}</div>
            </div>
          `).join("")}
        </div>
      `;
    })()}

    <div class="footer">
      <b>${empresa.razaoSocial}</b> — Documento gerado eletronicamente pelo Sistema KMZERO em ${new Date().toLocaleString("pt-BR")}<br>
      RDO Nº ${String(numero).padStart(3, "0")} • Encarregado responsável: ${encarregado || "—"} • Padrão ABNT
    </div>

    <script>window.onload=()=>{setTimeout(()=>window.print(),300);}</script>
    </body></html>`;
  abrirOuBaixarHTML(html, `RDO-${String(numero).padStart(3, "0")}-${obra.nome.replace(/[^a-z0-9]/gi, "_").substring(0, 30)}.html`);
}

function TelaRDO({ obras, trabalhadores, ativos, abastecimentos, pedidos, historico, diario, usuario, empresa, rdosEmitidos, recebimentos = [], fotosObras = [], despesasAvulsas = [], movimentacoes = [], movEquip = [], produtividade = [], cronogramas = [], onBack, onEmitirRDO, onUpdateRDO, onRemoveRDO }) {
  const [obraId, setObraId] = useState(obras[0]?.id || 1);
  const [data, setData] = useState(new Date().toLocaleDateString("pt-BR"));
  const [clima, setClima] = useState("Bom");
  const [observacoes, setObservacoes] = useState("");
  const [editandoRdo, setEditandoRdo] = useState(null);
  const [fotoVer, setFotoVer] = useState(null); // foto fullscreen

  const obra = obras.find(o => o.id === obraId);
  const isoData = (() => { const [d, m, a] = data.split("/"); return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; })();
  const presencasDia = historico[isoData] || {};
  const ocorrenciasDia = diario.filter(d => d.obraId === obraId);

  const proxNumero = rdosEmitidos.length + 1;

  const emitir = () => {
    const numero = proxNumero;
    onEmitirRDO({ id: Date.now(), numero, obraId, data, dataIso: isoData, encarregado: usuario?.nome, clima, observacoes, ts: Date.now() });
    gerarPDFRDORabnt({ numero, obra, data, clima, observacoes, presencas: presencasDia, trabalhadores, ativos, abastecimentos, pedidos, ocorrencias: ocorrenciasDia, encarregado: usuario?.nome, empresa, recebimentos });
  };

  // RDO Semanal Consolidado: junta todos os RDOs da semana atual da obra selecionada
  const emitirSemanal = (oId) => {
    try {
      const obraSel = obras.find(o => o.id === oId);
      if (!obraSel) {
        alert("⚠️ Obra não encontrada");
        return;
      }
      const hoje = new Date();
      const dia = hoje.getDay();
      const seg = new Date(hoje); seg.setDate(hoje.getDate() - (dia === 0 ? 6 : dia - 1)); seg.setHours(0, 0, 0, 0);
      const sex = new Date(seg); sex.setDate(seg.getDate() + 6); sex.setHours(23, 59, 59, 999);

      let rdosSem = (rdosEmitidos || []).filter(r => {
        const isoR = r.dataIso || (() => { try { const [d, m, a] = r.data.split("/"); return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; } catch { return ""; } })();
        const dt = new Date(isoR);
        return r.obraId === oId && dt >= seg && dt <= sex;
      });

      let modoFallback = false;
      if (rdosSem.length === 0) {
        const todosObra = (rdosEmitidos || []).filter(r => r.obraId === oId);
        if (todosObra.length === 0) {
          alert("⚠️ Sem RDOs para esta obra ainda.\n\nObra: " + obraSel.nome + "\n\nFinalize pelo menos 1 dia de obra (RDO) para gerar o relatório semanal.");
          return;
        }
      // Pega últimos 7 RDOs por data (descendente)
      rdosSem = todosObra
        .sort((a, b) => {
          const dA = a.dataIso || a.data || "";
          const dB = b.dataIso || b.data || "";
          return dB.localeCompare(dA);
        })
        .slice(0, 7)
        .reverse(); // ordena ascendente pra exibição
      modoFallback = true;
    }

    // Calcula totais
    let totalPres = 0, totalFalt = 0, totalAtest = 0, totalHE = 0, totalAlimentacao = 0;
    const trabPres = {}; // { trabId: { presentes, faltas, atestados, horas, alimentacao } }
    rdosSem.forEach(r => {
      const pres = r.presencas || {};
      Object.entries(pres).forEach(([tid, st]) => {
        if (!trabPres[tid]) trabPres[tid] = { p: 0, f: 0, a: 0, horas: 0, alimentacao: 0 };
        if (st === "Presente") {
          trabPres[tid].p++; totalPres++;
          trabPres[tid].horas += (r.horasTrabalhadas?.[tid] || 9);
          // Soma alimentação por trabalhador
          const ali = (r.alimentacao || {})[tid] || {};
          const valDia = (ali.cafeManha ? (empresa.valorCafeManha || 4) : 0)
            + (ali.cafeTarde ? (empresa.valorCafeTarde || 4) : 0)
            + (ali.marmita ? (empresa.valorMarmita || 18) : 0)
            + (ali.lanche ? (empresa.valorLanche || 10) : 0);
          trabPres[tid].alimentacao += valDia;
        }
        else if (st === "Falta") { trabPres[tid].f++; totalFalt++; }
        else if (st === "Atestado") { trabPres[tid].a++; totalAtest++; }
      });
      totalHE += (r.totalHE || 0);
      totalAlimentacao += (r.totalAlimentacao || 0);
    });

    // Em modo fallback, ajusta seg/sex pras datas dos RDOs encontrados
    let segReal = seg, sexReal = sex;
    if (modoFallback && rdosSem.length > 0) {
      const datasRdos = [];
      for (let i = 0; i < rdosSem.length; i++) {
        const r = rdosSem[i];
        let iso = r.dataIso;
        if (!iso && r.data) {
          try {
            const partes = r.data.split("/");
            iso = partes[2] + "-" + partes[1].padStart(2, "0") + "-" + partes[0].padStart(2, "0");
          } catch (e) { iso = ""; }
        }
        const dt = new Date(iso);
        if (!isNaN(dt.getTime())) datasRdos.push(dt.getTime());
      }
      if (datasRdos.length > 0) {
        let minTs = datasRdos[0], maxTs = datasRdos[0];
        for (let i = 1; i < datasRdos.length; i++) {
          if (datasRdos[i] < minTs) minTs = datasRdos[i];
          if (datasRdos[i] > maxTs) maxTs = datasRdos[i];
        }
        segReal = new Date(minTs); segReal.setHours(0, 0, 0, 0);
        sexReal = new Date(maxTs); sexReal.setHours(23, 59, 59, 999);
      }
    }

    // ⛽ Combustível do período
    const abastSemana = (abastecimentos || []).filter(a => {
      if (a.obraId !== oId) return false;
      try {
        const [d, m, y] = (a.data || "").split("/");
        const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        return dt >= segReal && dt <= sexReal;
      } catch { return false; }
    });
    const totalCombustivel = abastSemana.reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);
    const totalLitros = abastSemana.reduce((s, a) => s + (parseFloat(a.litros) || 0), 0);

    // Por veículo
    const ativosObraSel = (ativos || []).filter(a => a.obraId === oId);
    const combPorVeic = ativosObraSel.map(a => {
      const aa = abastSemana.filter(x => x.ativoId === a.id);
      return {
        ativo: a,
        gasto: aa.reduce((s, x) => s + (parseFloat(x.valor) || 0), 0),
        litros: aa.reduce((s, x) => s + (parseFloat(x.litros) || 0), 0),
        qtd: aa.length,
      };
    }).filter(v => v.gasto > 0);

    const datas = rdosSem.map(r => r.data).sort();
    const periodo = `${datas[0]} a ${datas[datas.length - 1]}`;

    // 📷 FOTOS do período
    const fotosSem = (fotosObras || []).filter(f => {
      if (f.obraId !== oId) return false;
      try {
        const [d, m, y] = (f.data || "").split("/");
        const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        return dt >= segReal && dt <= sexReal;
      } catch { return false; }
    });

    // 📦 PEDIDOS do período
    const pedidosSem = (pedidos || []).filter(p => {
      if (p.obraId !== oId) return false;
      try {
        const [d, m, y] = (p.dataSolicitacao || p.data || "").split("/");
        const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        return dt >= segReal && dt <= sexReal;
      } catch { return false; }
    });
    const pedAprov = pedidosSem.filter(p => p.status === "Aprovado");
    const pedAguard = pedidosSem.filter(p => p.status === "Aguardando");
    const pedNeg = pedidosSem.filter(p => p.status === "Negado");

    // 💸 DESPESAS avulsas do período
    const despesasSem = (despesasAvulsas || []).filter(d => {
      if (d.obraId !== oId) return false;
      try {
        const [dia, m, y] = (d.data || "").split("/");
        const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(dia));
        return dt >= segReal && dt <= sexReal;
      } catch { return false; }
    });
    const totalDespesas = despesasSem.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

    // 📋 DIÁRIO do período
    const diarioSem = (diario || []).filter(d => {
      if (d.obraId !== oId) return false;
      const dt = new Date(d.ts || 0);
      return dt >= segReal && dt <= sexReal;
    });

    // 🔄 MOVIMENTAÇÕES do período (pessoal e equipamento)
    const movPessSem = (movimentacoes || []).filter(m => {
      const dt = new Date(m.ts || 0);
      const envolvida = m.obraOrigem === oId || m.obraDestino === oId;
      return envolvida && dt >= segReal && dt <= sexReal;
    });
    const movEquipSem = (movEquip || []).filter(m => {
      const dt = new Date(m.ts || 0);
      const envolvida = m.obraOrigemId === oId || m.obraDestinoId === oId;
      return envolvida && dt >= segReal && dt <= sexReal;
    });

    // 📈 PRODUTIVIDADE do período
    const prodSem = (produtividade || []).filter(p => {
      if (p.obraId !== oId) return false;
      const dt = new Date(p.ts || 0);
      return dt >= segReal && dt <= sexReal;
    });
    const prodTotal = {};
    prodSem.forEach(p => {
      const k = `${p.tipo}|${p.unidade}`;
      prodTotal[k] = (prodTotal[k] || 0) + (parseFloat(p.qtd) || 0);
    });

    // 💰 CUSTO consolidado da semana
    const custoMaoObra = Object.entries(trabPres).reduce((s, [tid, st]) => {
      const t = trabalhadores.find(x => x.id === parseInt(tid));
      const diaria = (t && parseFloat(t.diaria)) || 0;
      return s + (st.p + st.a) * diaria; // presença + atestado pagam
    }, 0);

    const custoTotalSem = custoMaoObra + totalAlimentacao + totalCombustivel + totalDespesas;

    // TESTE 1: contadores acumulados simples
    var totalRdosObra = 0;
    var totalPedidosObra = 0;
    for (var i = 0; i < (rdosEmitidos || []).length; i++) {
      if (rdosEmitidos[i].obraId === oId) totalRdosObra++;
    }
    for (var i = 0; i < (pedidos || []).length; i++) {
      if (pedidos[i].obraId === oId) totalPedidosObra++;
    }

    const html = `<html><head><title>RDO Semanal - ${obraSel.nome}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        h1 { color: #0f2151; border-bottom: 4px solid #C0A040; padding-bottom: 10px; margin: 0 0 6px 0; font-size: 22pt; }
        h2 { color: #0f2151; border-bottom: 2px solid #e5e5e5; padding-bottom: 6px; margin-top: 24px; font-size: 14pt; }
        h3 { color: #0f2151; margin-top: 16px; font-size: 11pt; }
        .header-info { background: linear-gradient(135deg,#0f2151,#1e3a8a); color: #fff; padding: 14px 18px; border-radius: 8px; margin-bottom: 16px; }
        .header-info p { margin: 4px 0; }
        .header-info b { color: #f5a623; }
        /* WRAPPER de tabela com scroll lateral no mobile */
        .table-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 6px; }
        .table-wrap::-webkit-scrollbar { height: 8px; }
        .table-wrap::-webkit-scrollbar-thumb { background: #C0A040; border-radius: 4px; }
        .table-wrap::-webkit-scrollbar-track { background: #f3f4f6; }
        .table-wrap table { margin-bottom: 0; }

        /* TABELA: cresce no tamanho do conteúdo (NÃO força width:100%) */
        table { border-collapse: collapse; font-size: 9pt; width: auto; }
        /* Quando explicitamente width:100%, permite quebra natural nas células */
        table[style*="width:100%"] { width: 100% !important; table-layout: fixed; }
        table[style*="width:100%"] td, table[style*="width:100%"] th { white-space: normal; overflow-wrap: break-word; word-break: keep-all; }
        table[style*="width:100%"] td[style*="text-align:right"], table[style*="width:100%"] td[style*="text-align:center"],
        table[style*="width:100%"] th[style*="text-align:right"], table[style*="width:100%"] th[style*="text-align:center"] { white-space: nowrap; }

        th { background: #0f2151; color: #fff; padding: 8px 12px; text-align: left; font-size: 9pt; white-space: nowrap; }
        td { padding: 6px 12px; border-bottom: 1px solid #eee; vertical-align: top; white-space: nowrap; }

        /* Classes específicas pras colunas */
        td.col-nome, th.col-nome { white-space: nowrap; }
        td.col-cargo, th.col-cargo { white-space: nowrap; }
        td.col-data, th.col-data { white-space: nowrap; }
        td.col-num, th.col-num { white-space: nowrap; text-align: right; }
        td.col-status, th.col-status { white-space: nowrap; text-align: center; }
        td.td-wrap, th.td-wrap { white-space: normal; overflow-wrap: break-word; word-break: normal; min-width: 180px; max-width: 280px; }

        th[style*="text-align:right"], td[style*="text-align:right"] { white-space: nowrap; }
        th[style*="text-align:center"], td[style*="text-align:center"] { white-space: nowrap; }
        tr:nth-child(even) td { background: #fafbfc; }
        .footer { margin-top: 30px; padding-top: 14px; border-top: 2px solid #C0A040; text-align: center; font-size: 9pt; color: #888; }
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0; }
        .kpi { background: #f5f7fa; padding: 12px; border-radius: 8px; border-left: 4px solid #C0A040; }
        .kpi-label { font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
        .kpi-value { font-size: 18pt; color: #0f2151; font-weight: 900; margin-top: 4px; }
        .kpi-sub { font-size: 8pt; color: #666; margin-top: 2px; }
        .fotos-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
        .foto-item img { width: 100%; height: 110px; object-fit: cover; border-radius: 6px; border: 1px solid #ddd; }
        .foto-item-info { font-size: 7.5pt; color: #666; margin-top: 3px; }
        .resumo-final { background: linear-gradient(135deg,#fef3c7,#fde68a); padding: 16px; border-radius: 10px; margin-top: 24px; border: 2px solid #C0A040; }
        .resumo-final h3 { color: #0f2151; margin-top: 0; }
        .badge-ok { background: #2aa84f; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 8pt; font-weight: 700; }
        .badge-pend { background: #e87722; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 8pt; font-weight: 700; }
        .badge-neg { background: #d63b3b; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 8pt; font-weight: 700; }

        /* ═══ PADRÃO A4 ═══ */
        @page { size: A4 portrait; margin: 12mm 10mm; }
        @media print { body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        body { max-width: 190mm; margin: 0 auto; padding: 8mm 0; box-sizing: border-box; }

        /* Quebra de página inteligente */
        h2 { page-break-after: avoid; break-after: avoid; }
        h3 { page-break-after: avoid; break-after: avoid; }
        table { page-break-inside: auto; break-inside: auto; }
        tr { page-break-inside: avoid; break-inside: avoid; }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        .km-header, .km-footer, .km-assinaturas { page-break-inside: avoid; break-inside: avoid; }
        .resumo-final, .kpis { page-break-inside: avoid; break-inside: avoid; }
        .fotos-grid { page-break-inside: auto; break-inside: auto; }
        .foto-item { page-break-inside: avoid; break-inside: avoid; }

        ${KM_PDF_CSS}
      </style>
      </head><body>

      ${gerarHeaderHTML({ tipo: "RDO Semanal Consolidado", periodo, info_extra: "Obra: " + obraSel.nome + " · " + rdosSem.length + " dia(s)", empresa })}

      <h2>📊 Indicadores da Semana</h2>
      <div class="kpis">
        <div class="kpi">
          <div class="kpi-label">👷 Presenças</div>
          <div class="kpi-value" style="color:#2aa84f">${totalPres}</div>
          <div class="kpi-sub">homens-dia</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">⚠️ Faltas</div>
          <div class="kpi-value" style="color:#d63b3b">${totalFalt}</div>
          <div class="kpi-sub">${totalAtest} atestado${totalAtest > 1 ? "s" : ""}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">⏱️ Horas Extras</div>
          <div class="kpi-value" style="color:#dc2626">${totalHE.toFixed(1)}h</div>
          <div class="kpi-sub">acréscimo 50%</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">📷 Fotos</div>
          <div class="kpi-value" style="color:#0891b2">${fotosSem.length}</div>
          <div class="kpi-sub">registros</div>
        </div>
      </div>

      <h2>👷 Frequência e Custos por Trabalhador</h2>
      <table style="width:100%">
        <tr>
          <th style="width:28%">Nome</th>
          <th style="width:18%">Cargo</th>
          <th style="width:7%;text-align:center">Pres.</th>
          <th style="width:7%;text-align:center">Falt.</th>
          <th style="width:7%;text-align:center">Atest.</th>
          <th style="width:7%;text-align:right">Horas</th>
          <th style="width:13%;text-align:right">☕ Alim.</th>
          <th style="width:13%;text-align:right">💰 A pagar</th>
        </tr>
        ${Object.entries(trabPres).map(([tid, st]) => {
          const t = trabalhadores.find(x => x.id === parseInt(tid));
          if (!t) return "";
          const diaria = parseFloat(t.diaria) || 0;
          const aPagar = (st.p + st.a) * diaria;
          return `<tr>
            <td><b>${t.nome}</b></td>
            <td>${t.cargo}</td>
            <td style="text-align:center;color:#2aa84f"><b>${st.p}</b></td>
            <td style="text-align:center;color:#d63b3b">${st.f}</td>
            <td style="text-align:center;color:#e87722">${st.a}</td>
            <td style="text-align:right">${st.horas}h</td>
            <td style="text-align:right;color:#dc7e00">R$ ${st.alimentacao.toFixed(2)}</td>
            <td style="text-align:right;color:#0f2151"><b>R$ ${aPagar.toFixed(2)}</b></td>
          </tr>`;
        }).join("")}
      </table>

      ${prodSem.length > 0 ? `
      <h2>📈 Produtividade Executada</h2>
      <div class="table-wrap"><table>
        <tr><th>Serviço</th><th style="text-align:right">Quantidade</th><th>Unidade</th></tr>
        ${Object.entries(prodTotal).map(([k, total]) => {
          const [tipo, un] = k.split("|");
          return `<tr><td><b>${tipo}</b></td><td style="text-align:right;color:#2aa84f"><b>${total.toFixed(1)}</b></td><td>${un}</td></tr>`;
        }).join("")}
      </table></div>
      ` : ""}

      <h2>📋 Atividades por Dia</h2>
      <div class="table-wrap"><table>
        <tr><th class="col-data">Data</th><th class="col-data">RDO Nº</th><th class="col-nome">Encarregado</th><th>Clima</th><th>Observações</th></tr>
        ${rdosSem.sort((a, b) => (a.data > b.data ? 1 : -1)).map(r => `
          <tr>
            <td class="col-data"><b>${r.data}</b></td>
            <td class="col-data">${String(r.numero).padStart(3, "0")}</td>
            <td class="col-nome">${r.encarregado || "—"}</td>
            <td>${r.clima || "—"}</td>
            <td class="td-wrap" style="font-size:8pt">${r.observacoes || "—"}</td>
          </tr>
        `).join("")}
      </table></div>

      ${diarioSem.length > 0 ? `
      <h2>📝 Anotações do Diário</h2>
      <div class="table-wrap"><table>
        <tr><th class="col-data">Data</th><th class="col-nome">Autor</th><th>Anotação</th></tr>
        ${diarioSem.sort((a, b) => a.ts - b.ts).map(d => `
          <tr>
            <td class="col-data">${new Date(d.ts).toLocaleDateString("pt-BR")}</td>
            <td class="col-nome">${d.autor || "—"}</td>
            <td class="td-wrap" style="font-size:8.5pt">${d.texto || "—"}</td>
          </tr>
        `).join("")}
      </table></div>
      ` : ""}

      ${pedidosSem.length > 0 ? `
      <h2>📦 Pedidos de Material (${pedidosSem.length})</h2>
      <p style="font-size:9pt">
        <span class="badge-ok">${pedAprov.length} APROVADO${pedAprov.length !== 1 ? "S" : ""}</span> &nbsp;
        <span class="badge-pend">${pedAguard.length} AGUARDANDO</span> &nbsp;
        <span class="badge-neg">${pedNeg.length} NEGADO${pedNeg.length !== 1 ? "S" : ""}</span>
      </p>
      <div class="table-wrap"><table>
        <tr><th class="col-data">Nº</th><th class="col-data">Data</th><th class="col-nome">Material</th><th>Qtd</th><th>Marca</th><th class="col-status">Status</th></tr>
        ${pedidosSem.sort((a, b) => a.ts - b.ts).map(p => {
          const cor = p.status === "Aprovado" ? "#2aa84f" : p.status === "Negado" ? "#d63b3b" : "#e87722";
          const numPed = String(p.id).slice(-6);
          return `<tr>
            <td class="col-data"><b>${numPed}</b></td>
            <td class="col-data">${p.dataSolicitacao || "—"}</td>
            <td class="col-nome"><b>${p.material || "—"}</b></td>
            <td>${p.qtd || "—"}</td>
            <td>${p.marca || "—"}</td>
            <td class="col-status" style="color:${cor}"><b>${p.status}</b></td>
          </tr>`;
        }).join("")}
      </table></div>
      ` : ""}

      ${(movPessSem.length > 0 || movEquipSem.length > 0) ? `
      <h2>🔄 Movimentações</h2>
      ${movPessSem.length > 0 ? `
        <h3>👷 Pessoal (${movPessSem.length})</h3>
        <div class="table-wrap"><table>
          <tr><th class="col-data">Data</th><th class="col-nome">Trabalhador</th><th>Origem → Destino</th><th>Motivo</th><th class="col-status">Status</th></tr>
          ${movPessSem.map(m => {
            const oOrig = obras.find(o => o.id === m.obraOrigem)?.nome || "—";
            const oDest = obras.find(o => o.id === m.obraDestino)?.nome || "—";
            return `<tr>
              <td class="col-data">${m.data || "—"}</td>
              <td class="col-nome"><b>${m.trabNome || "—"}</b></td>
              <td class="td-wrap" style="font-size:8pt">${oOrig} → ${oDest}</td>
              <td class="td-wrap" style="font-size:8pt">${m.motivo || "—"}</td>
              <td class="col-status">${m.status || "—"}</td>
            </tr>`;
          }).join("")}
        </table></div>
      ` : ""}
      ${movEquipSem.length > 0 ? `
        <h3>🔧 Equipamentos (${movEquipSem.length})</h3>
        <div class="table-wrap"><table>
          <tr><th class="col-data">Data</th><th class="col-nome">Item</th><th>Origem → Destino</th><th>Motivo</th><th class="col-status">Status</th></tr>
          ${movEquipSem.map(m => `<tr>
            <td class="col-data">${m.dataSolicitacao || "—"}</td>
            <td class="col-nome"><b>${m.itemNome || "—"}</b></td>
            <td class="td-wrap" style="font-size:8pt">${m.obraOrigemNome || "—"} → ${m.obraDestinoNome || "—"}</td>
            <td class="td-wrap" style="font-size:8pt">${m.motivo || "—"}</td>
            <td class="col-status">${m.status || "—"}</td>
          </tr>`).join("")}
        </table></div>
      ` : ""}
      ` : ""}

      ${despesasSem.length > 0 ? `
      <h2>💸 Despesas Avulsas</h2>
      <div class="table-wrap"><table>
        <tr><th class="col-data">Data</th><th class="col-nome">Categoria</th><th>Descrição</th><th style="text-align:right">Valor</th></tr>
        ${despesasSem.map(d => `<tr>
          <td class="col-data">${d.data || "—"}</td>
          <td class="col-nome">${d.categoria || "—"}</td>
          <td class="td-wrap" style="font-size:8.5pt">${d.descricao || "—"}</td>
          <td style="text-align:right;color:#dc7e00"><b>R$ ${(parseFloat(d.valor) || 0).toFixed(2)}</b></td>
        </tr>`).join("")}
        <tr style="background:#fef3c7;font-weight:700">
          <td colspan="3" style="text-align:right">TOTAL DESPESAS AVULSAS</td>
          <td style="text-align:right;color:#0f2151">R$ ${totalDespesas.toFixed(2)}</td>
        </tr>
      </table></div>
      ` : ""}

      ${combPorVeic.length > 0 ? `
      <h2>⛽ Combustível por Veículo</h2>
      <div class="table-wrap"><table>
        <tr><th class="col-nome">Veículo</th><th class="col-data">Placa</th><th style="text-align:center">Abastec.</th><th style="text-align:right">Litros</th><th style="text-align:right">Valor</th></tr>
        ${combPorVeic.map(v => `<tr>
          <td class="col-nome"><b>${v.ativo.nome}</b></td>
          <td class="col-data">${v.ativo.placa || "—"}</td>
          <td style="text-align:center">${v.qtd}</td>
          <td style="text-align:right">${v.litros.toFixed(1)}L</td>
          <td style="text-align:right;color:#dc7e00"><b>R$ ${v.gasto.toFixed(2)}</b></td>
        </tr>`).join("")}
      </table></div>
      ` : ""}

      ${fotosSem.length > 0 ? `
      <h2>📷 Registro Fotográfico (${fotosSem.length} fotos)</h2>
      <div class="fotos-grid">
        ${fotosSem.slice(0, 24).map(f => `
          <div class="foto-item">
            <img src="${f.foto}" alt="${f.legenda || ''}" />
            <div class="foto-item-info">
              <b>#${String(f.numero || 0).padStart(3, "0")}</b> · ${f.data || "—"} ${f.hora || ""}<br/>
              ${(f.legenda || "").substring(0, 35)}${(f.legenda || "").length > 35 ? "…" : ""}
            </div>
          </div>
        `).join("")}
      </div>
      ${fotosSem.length > 24 ? `<p style="font-size:9pt;color:#888;text-align:center">+ ${fotosSem.length - 24} foto(s) adicional(is) na galeria do app</p>` : ""}
      ` : ""}

      <h2>📊 Acumulado da Obra</h2>
      <table>
        <tr><th>Indicador</th><th style="text-align:right">Total</th></tr>
        <tr><td>📅 Total de RDOs emitidos</td><td style="text-align:right"><b>${totalRdosObra}</b></td></tr>
        <tr><td>📦 Total de pedidos da obra</td><td style="text-align:right"><b>${totalPedidosObra}</b></td></tr>
      </table>

      <div class="resumo-final">
        <h3>💰 RESUMO FINANCEIRO DA SEMANA</h3>
        <table style="margin:0;font-size:10pt">
          <tr><td><b>👷 Mão de Obra (diárias)</b></td><td style="text-align:right">R$ ${custoMaoObra.toFixed(2)}</td></tr>
          <tr><td><b>☕ Alimentação</b></td><td style="text-align:right">R$ ${totalAlimentacao.toFixed(2)}</td></tr>
          <tr><td><b>⛽ Combustível</b></td><td style="text-align:right">R$ ${totalCombustivel.toFixed(2)}</td></tr>
          <tr><td><b>💸 Despesas Avulsas</b></td><td style="text-align:right">R$ ${totalDespesas.toFixed(2)}</td></tr>
          <tr style="border-top:2px solid #0f2151;background:#0f2151;color:#f5a623;font-size:13pt;font-weight:900">
            <td style="padding:10px"><b>TOTAL DA SEMANA</b></td>
            <td style="text-align:right;padding:10px"><b>R$ ${custoTotalSem.toFixed(2)}</b></td>
          </tr>
        </table>
      </div>

      <div style="margin-top:30px">
        ${gerarAssinaturasHTML({ empresa, autor: empresa.responsavel })}
      </div>

      ${gerarFooterHTML({ empresa, autor: empresa.responsavel })}
    </body></html>`;

      abrirOuBaixarHTML(html, "RDO-Semanal-" + obraSel.nome.replace(/[^a-z0-9]/gi, "_").substring(0, 25) + "-" + periodo.replace(/\//g, "-").replace(/\s/g, ""));
    } catch (err) {
      console.error("Erro RDO Semanal:", err);
      alert("❌ ERRO no RDO Semanal:\n\n" + (err && err.message ? err.message : err) + "\n\nLinha: " + (err && err.stack ? err.stack.split("\n")[1] : "?"));
    }
  };

  const trabObra = trabalhadores.filter(t => t.obraId === obraId);
  const presentes = trabObra.filter(t => presencasDia[t.id] === "Presente").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="RDO ABNT" sub="Relatório Diário Auditável" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ background: `linear-gradient(135deg,${NAVY},${NAVY2})`, color: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: "0 4px 14px rgba(15,33,81,0.3)" }}>
          <div style={{ fontSize: 11, opacity: 0.7 }}>Próximo RDO</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: GOLD }}>Nº {String(proxNumero).padStart(3, "0")}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>{rdosEmitidos.length} RDO(s) já emitidos</div>
        </div>

        <label style={labelS}>Obra</label>
        <select value={obraId} onChange={e => setObraId(parseInt(e.target.value))} style={selS}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <label style={labelS}>Data do RDO</label>
        <input value={data} onChange={e => setData(e.target.value)} placeholder="DD/MM/AAAA" style={inputS} />

        <label style={labelS}>Condição climática</label>
        <select value={clima} onChange={e => setClima(e.target.value)} style={selS}>
          <option>Bom</option><option>Nublado</option><option>Chuva leve</option><option>Chuva forte</option><option>Vento forte</option><option>Calor extremo</option>
        </select>

        <label style={labelS}>Observações gerais (opcional)</label>
        <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} placeholder="Ex: serviço de alvenaria conforme cronograma..." style={{ ...inputS, resize: "none", fontFamily: "inherit" }} />

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📋 Conteúdo do RDO</div>
          <div style={{ fontSize: 12, color: "#666" }}>
            <div style={{ padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>👷 Mão de obra: <b>{trabObra.length}</b> ({presentes} presentes)</div>
            <div style={{ padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>🚜 Ativos: <b>{ativos.filter(a => a.obraId === obraId).length}</b></div>
            <div style={{ padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>📦 Pedidos do dia: <b>{pedidos.filter(p => p.obraId === obraId && p.data === data).length}</b></div>
            <div style={{ padding: "4px 0" }}>📌 Ocorrências: <b>{ocorrenciasDia.length}</b></div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 8, fontSize: 14 }}>🏢 Empresa Emissora</div>
          <div style={{ fontSize: 11, color: "#666" }}>
            <div><b>{empresa.razaoSocial}</b></div>
            <div>CNPJ: {empresa.cnpj}</div>
            <div>Resp. Técnico: {empresa.responsavel}</div>
            <div>{empresa.telefone} • {empresa.email}</div>
          </div>
        </div>

        <Btn label="📄 EMITIR RDO PADRÃO ABNT (PDF)" color={GOLD} onClick={emitir} />

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={() => emitirSemanal(obraId)} style={{ flex: 1, background: NAVY, color: "#fff", border: "none", borderRadius: 10, padding: "10px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>📅 RDO Semanal Consolidado</button>
        </div>

        {rdosEmitidos.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, fontSize: 13 }}>📜 RDOs Recentes ({rdosEmitidos.length})</div>
            {rdosEmitidos.slice(0, 10).map(r => {
              const o = obras.find(x => x.id === r.obraId);
              const baixar = () => {
                const isoDt = r.dataIso || (() => { const [d, m, a] = r.data.split("/"); return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; })();
                gerarPDFRDORabnt({
                  numero: r.numero,
                  obra: o,
                  data: r.data,
                  clima: r.clima || "Bom",
                  observacoes: r.observacoes || "",
                  presencas: r.presencas || historico[isoDt] || {},
                  trabalhadores, ativos, abastecimentos, pedidos,
                  ocorrencias: diario.filter(d => d.obraId === r.obraId),
                  encarregado: r.encarregado,
                  empresa,
                  horasTrabalhadas: r.horasTrabalhadas,
                  horimetros: r.horimetros,
                  fotos: r.fotos,
                  alimentacao: r.alimentacao,
                  totalAlimentacao: r.totalAlimentacao,
                  recebimentos,
                });
              };
              return (
                <div key={r.id} style={{ background: "#fff", borderRadius: 10, padding: "10px 14px", marginBottom: 6, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: r.autoGerado ? `4px solid ${GREEN}` : `4px solid ${BLUE}` }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 22, marginRight: 10 }}>📄</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>RDO Nº {String(r.numero).padStart(3, "0")}{r.autoGerado && <span style={{ fontSize: 9, color: GREEN, fontWeight: 700, marginLeft: 6 }}>⚡ AUTO</span>}</div>
                      <div style={{ fontSize: 10, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o?.nome} • {r.data} • {r.encarregado}</div>
                    </div>
                  </div>

                  {/* Mini-galeria de fotos do RDO — clicáveis */}
                  {r.fotos && r.fotos.length > 0 && (
                    <div style={{ display: "flex", gap: 4, marginBottom: 6, overflowX: "auto", paddingBottom: 4 }}>
                      {r.fotos.map((f, i) => (
                        <img
                          key={i}
                          src={f}
                          alt={`Foto ${i + 1}`}
                          onClick={() => setFotoVer({ src: f, legenda: `RDO Nº ${String(r.numero).padStart(3, "0")} • ${o?.nome} • ${r.data}` })}
                          style={{ width: 60, height: 60, borderRadius: 6, objectFit: "cover", flexShrink: 0, cursor: "pointer", border: "1px solid #ddd" }}
                        />
                      ))}
                      <div style={{ fontSize: 9, color: "#888", alignSelf: "center", marginLeft: 4, flexShrink: 0 }}>
                        {r.fotos.length} foto{r.fotos.length > 1 ? "s" : ""}
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={baixar} style={{ flex: 1, background: GOLD, color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", fontWeight: 700, fontSize: 10, cursor: "pointer" }}>📄 PDF</button>
                    <button onClick={() => setEditandoRdo(r)} style={{ flex: 1, background: BLUE, color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", fontWeight: 700, fontSize: 10, cursor: "pointer" }}>✏️ Editar</button>
                    <button onClick={() => { confirmar(`Excluir RDO Nº ${r.numero}?`, () => { onRemoveRDO(r.id); }); }} style={{ background: "#fef2f2", color: RED, border: `1px solid ${RED}33`, borderRadius: 6, padding: "6px 10px", fontWeight: 700, fontSize: 10, cursor: "pointer" }}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL EDITAR RDO */}
        {editandoRdo && (
          <Modal show={!!editandoRdo} title={`Editar RDO Nº ${String(editandoRdo.numero).padStart(3, "0")}`} onClose={() => setEditandoRdo(null)}>
            <label style={labelS}>Data</label>
            <input value={editandoRdo.data || ""} onChange={e => setEditandoRdo(r => ({ ...r, data: e.target.value }))} placeholder="DD/MM/AAAA" style={inputS} />
            <label style={labelS}>Clima</label>
            <select value={editandoRdo.clima || "Bom"} onChange={e => setEditandoRdo(r => ({ ...r, clima: e.target.value }))} style={selS}>
              {["Bom", "Nublado", "Chuvoso", "Sol forte", "Vento forte", "Garoa", "Tempestade"].map(c => <option key={c}>{c}</option>)}
            </select>
            <label style={labelS}>Observações / Atividades</label>
            <textarea value={editandoRdo.observacoes || ""} onChange={e => setEditandoRdo(r => ({ ...r, observacoes: e.target.value }))} rows={5} placeholder="Atividades realizadas, ocorrências, etc." style={{ ...inputS, fontFamily: "inherit" }} />
            <label style={labelS}>Encarregado</label>
            <input value={editandoRdo.encarregado || ""} onChange={e => setEditandoRdo(r => ({ ...r, encarregado: e.target.value }))} style={inputS} />
            <Btn label="💾 SALVAR ALTERAÇÕES" color={GREEN} onClick={() => {
              onUpdateRDO(editandoRdo);
              setEditandoRdo(null);
            }} />
          </Modal>
        )}
      </div>
      <KMFooter />
      {fotoVer && <FotoViewer src={fotoVer.src} legenda={fotoVer.legenda} onClose={() => setFotoVer(null)} />}
    </div>
  );
}

/* ════════════════════════════════════
   CONFIGURAÇÕES DA EMPRESA
════════════════════════════════════ */
/* ════════════════════════════════════
   ESCRITÓRIO — Funcionários indiretos (rateio entre obras)
════════════════════════════════════ */
function TelaEscritorio({ obras, funcEscritorio, onBack, onAdd, onEditar, onRemover }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ nome: "", cargo: "", salarioMensal: "", ativo: true, dataAdmissao: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const obrasAtivas = obras.filter(o => o.status === "Ativa");
  const numObrasAtivas = obrasAtivas.length || 1;

  const totalIndireto = funcEscritorio.filter(f => f.ativo).reduce((s, f) => s + (parseFloat(f.salarioMensal) || 0), 0);
  const rateioPorObra = totalIndireto / numObrasAtivas;

  const abrirNovo = () => { setEditandoId(null); setForm({ nome: "", cargo: "", salarioMensal: "", ativo: true, dataAdmissao: "" }); setModal(true); };
  const abrirEdit = (f) => { setEditandoId(f.id); setForm(f); setModal(true); };
  const salvar = () => {
    if (!form.nome) return;
    if (editandoId) onEditar({ ...form, id: editandoId, salarioMensal: parseFloat(form.salarioMensal) || 0 });
    else onAdd({ ...form, id: Date.now(), salarioMensal: parseFloat(form.salarioMensal) || 0 });
    setModal(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Escritório" sub="Funcionários indiretos" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* CARD EXPLICATIVO */}
        <div style={{ background: "#f3e8ff", borderRadius: 12, padding: 14, marginBottom: 12, border: `1px solid #7c3aed33` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#5b21b6", marginBottom: 4 }}>📐 Custo indireto / Rateio</div>
          <div style={{ fontSize: 11, color: "#5b21b6", lineHeight: 1.5 }}>
            Funcionários do escritório (engenheiro, secretária, contador, etc) têm o salário <b>rateado igualmente</b> entre as obras ativas. Aparece em cada obra como <b>"Mão de obra indireta"</b>.
          </div>
        </div>

        {/* RESUMO RATEIO */}
        <div style={{ background: `linear-gradient(135deg,${NAVY},${NAVY2 || "#243b7a"})`, color: "#fff", borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>💰 Custo total mensal indireto</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: GOLD, marginTop: 4 }}>R$ {totalIndireto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: 8, textAlign: "center" }}>
              <div style={{ fontSize: 10, opacity: 0.85 }}>🏗️ Obras ativas</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{numObrasAtivas}</div>
            </div>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: 8, textAlign: "center" }}>
              <div style={{ fontSize: 10, opacity: 0.85 }}>📊 Rateio por obra</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: GOLD }}>R$ {rateioPorObra.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <Btn label="➕ Adicionar Funcionário do Escritório" color={NAVY} onClick={abrirNovo} style={{ marginBottom: 12 }} />

        {/* LISTA */}
        {funcEscritorio.length === 0 ? (
          <EmptyState
            icon="📐"
            titulo="Nenhum funcionário do escritório"
            subtitulo="Cadastre engenheiros, mestres de obra, encarregados administrativos. Custos são rateados entre as obras ativas."
            cor="#7c3aed"
          />
        ) : funcEscritorio.map(f => (
          <div key={f.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${f.ativo ? "#7c3aed" : "#ccc"}`, opacity: f.ativo ? 1 : 0.6 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ fontSize: 32, marginRight: 12 }}>📐</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{f.nome}{!f.ativo && <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>(inativo)</span>}</div>
                <div style={{ fontSize: 11, color: "#666" }}>{f.cargo || "—"}</div>
                <div style={{ fontSize: 12, color: GREEN, fontWeight: 700, marginTop: 4 }}>R$ {(parseFloat(f.salarioMensal) || 0).toFixed(2)}/mês</div>
                {f.ativo && numObrasAtivas > 0 && (
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2, fontStyle: "italic" }}>
                    → R$ {((parseFloat(f.salarioMensal) || 0) / numObrasAtivas).toFixed(2)} por obra ativa
                  </div>
                )}
              </div>
              <button onClick={() => abrirEdit(f)} style={{ background: "none", border: "none", color: BLUE, fontSize: 18, cursor: "pointer" }}>✏️</button>
            </div>
          </div>
        ))}
      </div>
      <KMFooter />

      <Modal show={modal} title={editandoId ? "Editar Funcionário" : "Novo Funcionário"} onClose={() => setModal(false)}>
        <label style={labelS}>Nome</label>
        <input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: Mozart" style={inputS} />
        <label style={labelS}>Cargo / Função</label>
        <input value={form.cargo} onChange={e => set("cargo", e.target.value)} placeholder="Ex: Engenheiro Orçamentista" style={inputS} />
        <label style={labelS}>💰 Salário mensal (R$)</label>
        <input value={form.salarioMensal} onChange={e => set("salarioMensal", e.target.value)} type="number" placeholder="Ex: 5000" style={inputS} />
        <label style={labelS}>Data de Admissão</label>
        <input value={form.dataAdmissao} onChange={e => set("dataAdmissao", e.target.value)} type="date" style={inputS} />
        <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: NAVY, fontWeight: 600 }}>
            <input type="checkbox" checked={!!form.ativo} onChange={e => set("ativo", e.target.checked)} style={{ width: 18, height: 18 }} />
            Ativo (entrar no rateio)
          </label>
          <div style={{ fontSize: 10, color: "#888", marginTop: 4, marginLeft: 26 }}>Desmarque se ele estiver de férias ou afastado.</div>
        </div>
        {editandoId && (
          <button onClick={() => { confirmar(`Remover ${form.nome}?`, () => { onRemover(editandoId); setModal(false); }) }} style={{ width: "100%", padding: 10, background: "#fef2f2", color: RED, border: `1px solid ${RED}33`, borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 12, marginBottom: 8 }}>🗑️ Excluir</button>
        )}
        <Btn label="💾 SALVAR" color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   CONFIG EMPRESA
════════════════════════════════════ */
/* ════════════════════════════════════
   ACESSOS DO APP — Gerenciar usuários (gestor cria/edita/deleta lançadores)
════════════════════════════════════ */
function TelaAcessosApp({ usuarios, obras, onBack, onAdd, onEditar, onRemover }) {
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "123",
    cargo: "Encarregado",
    obraId: "",
    perfil: "encarregado",
    tel: "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const abrirNovo = () => {
    setEditando(null);
    setForm({ nome: "", email: "", senha: "123", cargo: "Encarregado", obraId: "", perfil: "encarregado", tel: "" });
    setModal(true);
  };

  const abrirEdicao = (u) => {
    setEditando(u);
    setForm({
      nome: u.nome || "",
      email: u.email || "",
      senha: u.senha || "123",
      cargo: u.cargo || "Encarregado",
      obraId: u.obraId || "",
      perfil: u.perfil || "encarregado",
      tel: u.tel || "",
    });
    setModal(true);
  };

  const salvar = () => {
    if (!form.nome.trim()) { alert("⚠️ Informe o nome"); return; }
    if (!form.email.trim()) { alert("⚠️ Informe o e-mail"); return; }
    if (!form.senha.trim()) { alert("⚠️ Informe a senha"); return; }

    if (editando) {
      // Edição
      onEditar({ ...editando, ...form, obraId: form.obraId ? parseInt(form.obraId) : null });
      alert(`✅ Acesso atualizado!\n\n${form.nome}\n📧 ${form.email}\n🔑 ${form.senha}`);
    } else {
      // Novo
      const jaExiste = usuarios.find(u => u.email.toLowerCase() === form.email.toLowerCase().trim());
      if (jaExiste) { alert("⚠️ Já existe um acesso com esse e-mail"); return; }
      const novo = {
        id: Date.now(),
        nome: form.nome.trim(),
        email: form.email.toLowerCase().trim(),
        senha: form.senha,
        cargo: form.cargo,
        obraId: form.obraId ? parseInt(form.obraId) : null,
        perfil: form.perfil,
        tel: form.tel,
        pin: "",
        biometriaAtiva: false,
      };
      onAdd(novo);
      alert(`✅ Acesso criado!\n\n👤 ${novo.nome}\n📧 ${novo.email}\n🔑 Senha: ${novo.senha}\n\nPasse esses dados pra pessoa.\nAo abrir o app, ela toca no perfil dela.`);
    }
    setModal(false);
  };

  const remover = (u) => {
    confirmar(`⚠️ Remover acesso de ${u.nome}?\n\nA pessoa NÃO conseguirá mais entrar no app.\n(Dados de presença, RDOs, etc continuam preservados)`, () => {
      onRemover(u.id);
    });
  };

  const cores = ["#0891b2", "#7c3aed", "#16a34a", "#dc2626", "#e87722", "#0284c7", "#9333ea", "#0d9488"];
  const gestores = usuarios.filter(u => u.perfil === "gestor");
  const lancadores = usuarios.filter(u => u.perfil === "encarregado");

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Acessos do App" sub={`${usuarios.length} usuário(s)`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* CARD EXPLICATIVO */}
        <div style={{ background: `linear-gradient(135deg,${NAVY},#1e3a8a)`, color: "#fff", borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>🔑</div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Acessos do App</div>
          <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4, lineHeight: 1.5 }}>
            Aqui você cria os perfis dos lançadores (encarregados, apontadores).
            Cada um vai aparecer na tela inicial do app.
          </div>
        </div>

        {/* BOTÃO ADICIONAR */}
        <button onClick={abrirNovo} style={{ width: "100%", padding: 14, background: GOLD, color: NAVY, border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer", marginBottom: 16, boxShadow: "0 3px 10px rgba(245,166,35,0.3)" }}>
          ➕ ADICIONAR LANÇADOR
        </button>

        {/* GESTORES */}
        {gestores.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, paddingLeft: 4 }}>
              🏢 GESTORES ({gestores.length})
            </div>
            {gestores.map(u => {
              const iniciais = u.nome.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
              return (
                <div key={u.id} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${GOLD}`, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 21, background: GOLD, color: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                    {iniciais}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.nome}</div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>📧 {u.email}</div>
                  </div>
                  <button onClick={() => abrirEdicao(u)} style={{ background: "#f5f7fa", border: "1px solid #ddd", color: NAVY, borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️</button>
                </div>
              );
            })}
          </>
        )}

        {/* LANÇADORES */}
        <div style={{ fontSize: 11, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, paddingLeft: 4, marginTop: 16 }}>
          👷 LANÇADORES ({lancadores.length})
        </div>

        {lancadores.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 30, textAlign: "center", border: "2px dashed #ddd" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
            <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>
              Nenhum lançador cadastrado.<br/>
              Toque em <b>"➕ ADICIONAR LANÇADOR"</b> acima.
            </div>
          </div>
        ) : (
          lancadores.map(u => {
            const iniciais = u.nome.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
            const cor = cores[u.id % cores.length];
            const obra = obras.find(o => o.id === u.obraId);
            return (
              <div key={u.id} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${cor}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 21, background: cor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                    {iniciais}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.nome}</div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      👷 {u.cargo || "Encarregado"}{obra ? ` · ${obra.nome}` : " · sem obra"}
                    </div>
                  </div>
                </div>
                <div style={{ background: "#f9fafb", borderRadius: 8, padding: 8, marginBottom: 8, fontSize: 10, color: "#666", fontFamily: "monospace" }}>
                  📧 {u.email}<br/>
                  🔑 Senha: <b>{u.senha}</b>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => abrirEdicao(u)} style={{ flex: 1, background: BLUE, color: "#fff", border: "none", borderRadius: 8, padding: "8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️ Editar</button>
                  <button onClick={() => remover(u)} style={{ background: "#fee2e2", color: RED, border: `2px solid ${RED}`, borderRadius: 8, padding: "8px 14px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>🗑️</button>
                </div>
              </div>
            );
          })
        )}
      </div>
      <KMFooter />

      {/* MODAL CRIAR / EDITAR */}
      <Modal show={modal} title={editando ? "Editar Acesso" : "Novo Lançador"} onClose={() => setModal(false)}>
        <label style={labelS}>👤 Nome Completo</label>
        <input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Nome do lançador" style={inputS} />

        <label style={labelS}>👷 Cargo / Função</label>
        <select value={form.cargo} onChange={e => set("cargo", e.target.value)} style={selS}>
          <option>Encarregado</option>
          <option>Apontador</option>
          <option>Mestre de Obras</option>
          <option>Técnico</option>
          <option>Supervisor</option>
          <option>Outro</option>
        </select>

        <label style={labelS}>🏗️ Obra que vai gerenciar</label>
        <select value={form.obraId} onChange={e => set("obraId", e.target.value)} style={selS}>
          <option value="">Sem obra fixa</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <label style={labelS}>📞 Telefone (opcional)</label>
        <input value={form.tel} onChange={e => set("tel", e.target.value)} placeholder="(28) 9 9999-9999" style={inputS} />

        <div style={{ background: "#f0f9ff", borderRadius: 10, padding: 12, marginBottom: 10, border: "1px solid #bae6fd" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, marginBottom: 8 }}>🔐 Dados de Acesso</div>

          <label style={labelS}>📧 E-mail (login)</label>
          <input value={form.email} onChange={e => set("email", e.target.value)} type="email" placeholder="exemplo@gmail.com" autoComplete="off" style={inputS} />

          <label style={labelS}>🔑 Senha temporária</label>
          <input value={form.senha} onChange={e => set("senha", e.target.value)} placeholder="123" autoComplete="off" style={inputS} />

          <div style={{ fontSize: 10, color: "#0c4a6e", lineHeight: 1.5 }}>
            💡 Anote pra passar pra pessoa. Ao abrir o app, ela vai aparecer na lista de perfis.
          </div>
        </div>

        <Btn label={editando ? "💾 SALVAR ALTERAÇÕES" : "➕ CRIAR ACESSO"} color={GREEN} onClick={salvar} />

        {editando && (
          <button onClick={() => { setModal(false); remover(editando); }} style={{ width: "100%", marginTop: 8, padding: 12, background: "#fee2e2", color: RED, border: `2px solid ${RED}`, borderRadius: 10, fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
            🗑️ EXCLUIR ESTE ACESSO
          </button>
        )}
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   MINHA CONTA — Segurança e Privacidade
   Permite ao gestor trocar senha, recuperar acesso,
   sair de todas as sessões e ver informações de segurança.
════════════════════════════════════ */
function TelaMinhaConta({ usuario, empresa, onBack, onLogout }) {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConfirma, setSenhaConfirma] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [modalSair, setModalSair] = useState(false);

  const isFirebase = !!usuario?.firebaseUid;

  const trocarSenha = async () => {
    setErro(""); setSucesso("");
    if (!senhaNova || senhaNova.length < 6) {
      return setErro("A nova senha deve ter pelo menos 6 caracteres.");
    }
    if (senhaNova !== senhaConfirma) {
      return setErro("A confirmação de senha não confere com a nova senha.");
    }
    if (!isFirebase) {
      return setErro("A troca de senha pelo aplicativo só funciona para contas autenticadas pelo Firebase.");
    }
    setCarregando(true);
    // Reautentica antes de trocar (boa prática Firebase)
    const r1 = await loginFirebase(usuario.email, senhaAtual);
    if (!r1.ok) {
      setCarregando(false);
      return setErro("Senha atual incorreta. Tente novamente.");
    }
    const r2 = await atualizarSenha(senhaNova);
    setCarregando(false);
    if (r2.ok) {
      setSucesso("Senha alterada com sucesso! Use a nova senha no próximo login.");
      setSenhaAtual(""); setSenhaNova(""); setSenhaConfirma("");
      setTimeout(() => setSucesso(""), 6000);
    } else {
      setErro(r2.erro || "Não foi possível alterar a senha. Tente novamente.");
    }
  };

  const enviarRecuperacao = async () => {
    setErro(""); setSucesso("");
    if (!usuario?.email) return setErro("E-mail da conta não encontrado.");
    setCarregando(true);
    const r = await recuperarSenha(usuario.email);
    setCarregando(false);
    if (r.ok) {
      setSucesso(`Link de recuperação enviado para ${usuario.email}. Verifique sua caixa de entrada e a pasta de spam.`);
      setTimeout(() => setSucesso(""), 8000);
    } else {
      setErro(r.erro || "Não foi possível enviar o link de recuperação.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Minha Conta" sub="Segurança e privacidade" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* CARD: Informações da conta */}
        <div style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, #1e3a8a 100%)`,
          color: "#fff",
          borderRadius: 14,
          padding: 16,
          marginBottom: 14,
          boxShadow: "0 4px 16px rgba(15,33,81,0.25)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              background: GOLD,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              boxShadow: "0 4px 14px rgba(245,166,35,0.5)",
            }}>👤</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {usuario?.nome || "Gestor"}
              </div>
              <div style={{ fontSize: 11, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {usuario?.email || "—"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{
              background: isFirebase ? "rgba(34,197,94,0.25)" : "rgba(234,179,8,0.25)",
              border: `1px solid ${isFirebase ? "rgba(34,197,94,0.5)" : "rgba(234,179,8,0.5)"}`,
              borderRadius: 14,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 700,
            }}>
              {isFirebase ? "🔒 Autenticado pelo Firebase" : "⚠️ Login local (sem nuvem)"}
            </div>
            <div style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 14,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 700,
            }}>
              {usuario?.perfil === "gestor" ? "👔 Gestor" : "👷 Encarregado"}
            </div>
          </div>
        </div>

        {/* CARD: Trocar Senha (apenas Firebase) */}
        {isFirebase ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              🔑 Trocar Senha
            </div>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 12, lineHeight: 1.5 }}>
              Para sua segurança, informe a senha atual antes de definir uma nova. A nova senha precisa ter no mínimo 6 caracteres.
            </div>

            <label style={labelS}>🔐 Senha atual</label>
            <input
              type="password"
              value={senhaAtual}
              onChange={e => setSenhaAtual(e.target.value)}
              placeholder="Sua senha atual"
              style={inputS}
              autoComplete="current-password"
            />

            <label style={labelS}>✨ Nova senha (mínimo 6 caracteres)</label>
            <input
              type="password"
              value={senhaNova}
              onChange={e => setSenhaNova(e.target.value)}
              placeholder="Nova senha"
              style={inputS}
              autoComplete="new-password"
            />

            <label style={labelS}>🔁 Confirme a nova senha</label>
            <input
              type="password"
              value={senhaConfirma}
              onChange={e => setSenhaConfirma(e.target.value)}
              placeholder="Repita a nova senha"
              style={inputS}
              autoComplete="new-password"
            />

            {erro && (
              <div style={{ background: "#fef2f2", color: RED, border: `1px solid ${RED}33`, borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 10, fontWeight: 600 }}>
                ⚠️ {erro}
              </div>
            )}
            {sucesso && (
              <div style={{ background: "#f0fdf4", color: GREEN, border: `1px solid ${GREEN}33`, borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 10, fontWeight: 600 }}>
                ✅ {sucesso}
              </div>
            )}

            <Btn
              label={carregando ? "PROCESSANDO..." : "💾 ALTERAR SENHA"}
              color={GREEN}
              onClick={trocarSenha}
              disabled={carregando || !senhaAtual || !senhaNova || !senhaConfirma}
            />
          </div>
        ) : (
          <div style={{ background: "#fef9e7", borderRadius: 14, padding: 14, marginBottom: 14, border: "1px solid rgba(234,179,8,0.4)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#8b6f00", marginBottom: 6 }}>
              ⚠️ Conta não está autenticada pelo Firebase
            </div>
            <div style={{ fontSize: 11, color: "#8b6f00", lineHeight: 1.5 }}>
              Você entrou com um login local antigo. A troca de senha pelo aplicativo só funciona para contas autenticadas pelo Firebase. Saia e entre novamente usando seu email e senha cadastrados.
            </div>
          </div>
        )}

        {/* CARD: Recuperação de senha */}
        {isFirebase && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              📧 Enviar link de recuperação
            </div>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 10, lineHeight: 1.5 }}>
              Caso você precise redefinir a senha sem lembrar da atual, enviamos um link de recuperação para o seu e-mail cadastrado: <b>{usuario.email}</b>.
            </div>
            <button
              onClick={enviarRecuperacao}
              disabled={carregando}
              style={{
                width: "100%",
                padding: 12,
                background: "#fff",
                color: BLUE,
                border: `2px solid ${BLUE}`,
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 13,
                cursor: carregando ? "default" : "pointer",
              }}
            >
              {carregando ? "Enviando..." : "✉️ Enviar link para meu e-mail"}
            </button>
          </div>
        )}

        {/* CARD: Sessões */}
        {isFirebase && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              🚪 Sair desta sessão
            </div>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 10, lineHeight: 1.5 }}>
              Encerra a sessão atual deste aparelho. Você pode entrar novamente quando quiser.
            </div>
            <button
              onClick={() => setModalSair(true)}
              className="km-btn-danger"
              style={{
                width: "100%",
                padding: 12,
                background: "#fff",
                color: RED,
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              🚪 Sair da conta
            </button>
          </div>
        )}

        {/* CARD: Informações da empresa (compacto) */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            🏢 Empresa vinculada
          </div>
          <div style={{ fontSize: 12, color: "#444", lineHeight: 1.6 }}>
            <div><b>Razão Social:</b> {empresa?.razaoSocial || "—"}</div>
            {empresa?.nomeFantasia && <div><b>Nome fantasia:</b> {empresa.nomeFantasia}</div>}
            <div><b>CNPJ:</b> {empresa?.cnpj || "—"}</div>
            {empresa?.registro && <div><b>Registro:</b> {empresa.registro}</div>}
            {empresa?.endereco && <div style={{ marginTop: 4 }}><b>📍</b> {empresa.endereco}</div>}
          </div>
        </div>

        {/* Dica de segurança */}
        <div style={{
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: 10,
          padding: 12,
          fontSize: 11,
          color: "#075985",
          lineHeight: 1.5,
        }}>
          💡 <b>Dica de segurança:</b> Use senhas com no mínimo 8 caracteres, misturando letras, números e símbolos. Não compartilhe sua senha com ninguém. Em caso de suspeita de acesso indevido, troque sua senha imediatamente.
        </div>
      </div>
      <KMFooter />

      {/* Modal: Confirmar Sair */}
      <Modal show={modalSair} title="🚪 Sair da conta?" onClose={() => setModalSair(false)}>
        <div style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 14 }}>
          Você vai precisar entrar com email e senha novamente neste aparelho. Confirma?
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setModalSair(false)}
            style={{ flex: 1, padding: 12, background: "#f3f4f6", color: NAVY, border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >Cancelar</button>
          <button
            onClick={() => { setModalSair(false); onLogout && onLogout(); }}
            className="km-btn-danger"
            style={{ flex: 1, padding: 12, background: RED, color: "#fff", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer" }}
          >🚪 Sair</button>
        </div>
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   AJUDA & SUPORTE — FAQ, Termos, LGPD, Contato
════════════════════════════════════ */
function TelaAjuda({ empresa, onBack }) {
  const [abertos, setAbertos] = useState({});
  const [aba, setAba] = useState("sobre"); // "sobre" | "faq" | "termos" | "lgpd"

  const toggleFaq = (id) => setAbertos(o => ({ ...o, [id]: !o[id] }));

  const faqs = [
    {
      id: "como_inicio",
      pergunta: "Como começo a usar o KMZERO?",
      resposta: "O KMZERO já vem com dados de exemplo. Como gestor, você acessa o Painel do Gestor pela tela inicial. Pelo menu Sistema → Empresa, configura os dados da sua empresa. Pelo menu Recursos Humanos → Equipe, cadastra trabalhadores e encarregados. Pelo menu Obras & Recursos → Obras, cadastra as obras em andamento. Os encarregados acessam pelo seu próprio cadastro (criado em Sistema → Acessos do App).",
    },
    {
      id: "como_rdo",
      pergunta: "Como faço um RDO (Relatório Diário de Obra)?",
      resposta: "No Painel do Gestor, toque em RDO ABNT (botão dourado em Acesso Rápido). Escolha a obra, depois confirme a presença dos trabalhadores marcando quem trabalhou. Em seguida o aplicativo registra serviços executados, equipamentos usados e fotos da obra. Ao finalizar, gera um relatório no padrão ABNT pronto para imprimir ou enviar.",
    },
    {
      id: "como_pedidos",
      pergunta: "Como aprovo um pedido de compra?",
      resposta: "Quando um encarregado faz um pedido pelo aplicativo, ele aparece no Painel do Gestor com etiqueta laranja \"Aguardando Aprovação\". Toque no pedido para ver os itens. Para aprovar, escolha a forma de pagamento, o prazo e o fornecedor. O aplicativo gera uma Solicitação de Pedido de Compra em PDF que você pode enviar diretamente ao fornecedor.",
    },
    {
      id: "como_folha",
      pergunta: "Como gero a folha quinzenal de pagamento?",
      resposta: "Em Recursos Humanos → Folha de Pagamento, selecione o período. O aplicativo calcula automaticamente os dias trabalhados, horas extras, descontos de adiantamentos e o valor líquido a pagar. Você pode exportar a folha em PDF para arquivo ou envio aos trabalhadores.",
    },
    {
      id: "esqueci_senha",
      pergunta: "Esqueci minha senha. O que fazer?",
      resposta: "Na tela de login do gestor, toque em \"Esqueci minha senha\" abaixo do botão ENTRAR. Digite seu email cadastrado. Você vai receber um link de recuperação no email para definir uma nova senha. Verifique a caixa de entrada e a pasta de spam. O email pode demorar até 3 minutos.",
    },
    {
      id: "trocar_senha",
      pergunta: "Como troco minha senha sem precisar do email?",
      resposta: "Acesse o menu Sistema → Minha Conta. Lá você encontra a opção de trocar senha. Informe a senha atual e defina uma nova. A troca acontece imediatamente, sem precisar do email.",
    },
    {
      id: "encarregado_acessar",
      pergunta: "Como os encarregados acessam o aplicativo?",
      resposta: "O gestor cadastra cada encarregado em Sistema → Acessos do App, definindo um email e uma senha simples. Esses dados são compartilhados com o encarregado, que entra na tela inicial selecionando o próprio perfil. Os encarregados só veem a obra à qual estão vinculados.",
    },
    {
      id: "offline",
      pergunta: "O aplicativo funciona sem internet?",
      resposta: "Sim. O KMZERO foi projetado para funcionar offline. Os dados ficam salvos localmente no aparelho e podem ser usados sem internet. Quando a conexão voltar, os dados serão sincronizados com a nuvem automaticamente.",
    },
    {
      id: "fotos",
      pergunta: "Onde ficam guardadas as fotos das obras?",
      resposta: "Todas as fotos tiradas pelo aplicativo (fotos do RDO, fotos de equipamentos, fotos de fichas de trabalhadores) ficam guardadas no próprio aplicativo e podem ser vistas em Operação Diária → Galeria Fotos, agrupadas por obra e data.",
    },
    {
      id: "backup",
      pergunta: "Como faço backup dos dados?",
      resposta: "Em Sistema → Backup, você pode exportar todos os dados em arquivo único para guardar no seu computador. Recomendamos fazer backup pelo menos uma vez por mês. Em breve, com a sincronização na nuvem ativa, o backup será automático.",
    },
    {
      id: "suporte",
      pergunta: "Como entro em contato com o suporte?",
      resposta: "Para falar com o suporte técnico do KMZERO, use o WhatsApp (28) 99925-8172, envie email para kvmprojetos@gmail.com, ou siga @km_engenharias no Instagram. O atendimento é de segunda a sexta, das 8h às 18h.",
    },
  ];

  const wppUrl = "https://wa.me/5528999258172?text=" + encodeURIComponent("Olá! Preciso de ajuda com o KMZERO.");

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Ajuda & Suporte" sub="FAQ, Termos e Contato" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* CARD CONTATO RÁPIDO */}
        <div style={{
          background: `linear-gradient(135deg, ${GREEN} 0%, #15803d 100%)`,
          color: "#fff",
          borderRadius: 14,
          padding: 16,
          marginBottom: 14,
          boxShadow: "0 4px 16px rgba(22,163,74,0.25)",
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>💬 Precisa de ajuda agora?</div>
          <div style={{ fontSize: 11, opacity: 0.95, marginBottom: 12, lineHeight: 1.5 }}>
            Entre em contato pelos canais oficiais da KM Consultoria. Atendimento de segunda a sexta, das 8h às 18h.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href={wppUrl} target="_blank" rel="noopener noreferrer" style={{
              flex: "1 1 130px",
              background: "rgba(255,255,255,0.18)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              textAlign: "center",
              backdropFilter: "blur(6px)",
            }}>💬 WhatsApp</a>
            <a href="mailto:kvmprojetos@gmail.com?subject=Suporte%20KMZERO" style={{
              flex: "1 1 130px",
              background: "rgba(255,255,255,0.18)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              textAlign: "center",
              backdropFilter: "blur(6px)",
            }}>✉️ E-mail</a>
            <a href="https://instagram.com/km_engenharias" target="_blank" rel="noopener noreferrer" style={{
              flex: "1 1 130px",
              background: "rgba(255,255,255,0.18)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              textAlign: "center",
              backdropFilter: "blur(6px)",
            }}>📷 Instagram</a>
          </div>
          <div style={{ fontSize: 10, opacity: 0.85, marginTop: 10, textAlign: "center" }}>
            📞 (28) 99925-8172 · ✉️ kvmprojetos@gmail.com
          </div>
        </div>

        {/* ABAS */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {[
            { k: "sobre", l: "ℹ️ Sobre", c: "#0F2151" },
            { k: "faq", l: "🆘 Perguntas", c: "#16a34a" },
            { k: "termos", l: "📄 Termos", c: "#0891b2" },
            { k: "lgpd", l: "🔒 LGPD", c: "#7c3aed" },
          ].map(t => (
            <button
              key={t.k}
              onClick={() => setAba(t.k)}
              style={{
                flex: "1 1 90px",
                padding: "10px 6px",
                background: aba === t.k ? t.c : "#fff",
                color: aba === t.k ? "#fff" : "#666",
                border: aba === t.k ? "none" : "1px solid #e5e7eb",
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: aba === t.k ? `0 3px 10px ${t.c}40` : "none",
              }}
            >{t.l}</button>
          ))}
        </div>

        {/* CONTEÚDO SOBRE */}
        {aba === "sobre" && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 0, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            {/* Header navy com logo */}
            <div style={{
              background: "linear-gradient(135deg, #0F2151 0%, #1e3a8a 100%)",
              padding: "24px 20px",
              textAlign: "center",
              color: "#fff",
            }}>
              <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: 3, fontWeight: 700, marginBottom: 6 }}>
                🏗️ GESTÃO DE OBRAS
              </div>
              <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: -1.5 }}>
                <span style={{ color: "#fff" }}>KM</span>
                <span style={{ color: "#F5A623" }}>ZERO</span>
              </div>
              <div style={{ height: 2, width: 50, background: "#F5A623", margin: "10px auto", borderRadius: 2 }} />
              <div style={{ fontSize: 13, fontStyle: "italic", opacity: 0.9 }}>
                KM Consultoria · Engenharia Civil
              </div>
            </div>

            {/* Quem desenvolveu */}
            <div style={{ padding: "20px 18px" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0F2151", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                👨‍💼 Quem desenvolve
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: 30,
                  background: "linear-gradient(135deg, #F5A623, #FFC857)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28, flexShrink: 0,
                  boxShadow: "0 4px 14px rgba(245,166,35,0.4)",
                }}>👷</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0F2151" }}>
                    Kleber Vieira Martins
                  </div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                    Engenheiro Civil · CREA-ES
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, lineHeight: 1.5 }}>
                    Fundador da KM Consultoria, em Alegre-ES. Atua há mais de 10 anos em obras civis no sul capixaba.
                  </div>
                </div>
              </div>

              <div style={{
                background: "#FFF7E6",
                borderLeft: "4px solid #F5A623",
                padding: "10px 14px",
                fontSize: 12,
                color: "#444",
                lineHeight: 1.6,
                borderRadius: "0 8px 8px 0",
                marginBottom: 16,
              }}>
                "O KMZERO nasceu de uma frustração real: gerir obras no papel, em planilhas e por WhatsApp não dava conta. Construí o que eu mesmo gostaria de ter em campo, com a linguagem e os processos de quem está no canteiro todo dia."
              </div>
            </div>

            {/* O que é */}
            <div style={{ padding: "0 18px 16px", borderTop: "1px solid #f3f4f6", paddingTop: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0F2151", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                🎯 O que é o KMZERO
              </div>
              <div style={{ fontSize: 12, color: "#444", lineHeight: 1.7 }}>
                O KMZERO é um aplicativo profissional de gestão de obras, desenvolvido em Engenharia Civil pela KM Consultoria. Centraliza em uma plataforma única o controle de equipes, materiais, custos, relatórios técnicos e comunicação entre canteiro e escritório.
              </div>
            </div>

            {/* Tecnologia */}
            <div style={{ padding: "0 18px 16px", borderTop: "1px solid #f3f4f6", paddingTop: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0F2151", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                ⚡ Tecnologia
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
                {[
                  ["🔒 Firebase Auth", "Google Cloud"],
                  ["☁️ Firestore", "Banco em São Paulo"],
                  ["📱 React + Vite", "Frontend moderno"],
                  ["🌐 Vercel", "CDN global"],
                  ["📄 jsPDF", "Relatórios ABNT"],
                  ["🔐 LGPD", "Conformidade legal"],
                ].map(([k, v], i) => (
                  <div key={i} style={{
                    background: "#f9fafb",
                    padding: "8px 10px",
                    borderRadius: 8,
                    borderLeft: "3px solid #0F2151",
                  }}>
                    <div style={{ fontWeight: 700, color: "#0F2151" }}>{k}</div>
                    <div style={{ color: "#64748b", fontSize: 10 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contato direto */}
            <div style={{ padding: "16px 18px", borderTop: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0F2151", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                💬 Fale com a KM
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                <a href="https://wa.me/5528999258172?text=Olá! Vim do app KMZERO." target="_blank" rel="noopener noreferrer" style={{ color: "#16a34a", textDecoration: "none", fontWeight: 700 }}>
                  💬 WhatsApp (28) 99925-8172
                </a>
                <a href="mailto:kvmprojetos@gmail.com?subject=Contato KMZERO" style={{ color: "#0891b2", textDecoration: "none", fontWeight: 700 }}>
                  ✉️ kvmprojetos@gmail.com
                </a>
                <a href="https://instagram.com/km_engenharias" target="_blank" rel="noopener noreferrer" style={{ color: "#E4405F", textDecoration: "none", fontWeight: 700 }}>
                  📷 @km_engenharias
                </a>
              </div>
            </div>

            {/* Footer da seção Sobre */}
            <div style={{
              background: "#f9fafb",
              padding: "12px 18px",
              textAlign: "center",
              fontSize: 10,
              color: "#94a3b8",
              borderTop: "1px solid #f3f4f6",
            }}>
              <div style={{ fontWeight: 700, color: "#475569", letterSpacing: 1 }}>KMZERO · Versão 1.0 · Maio/2026</div>
              <div style={{ marginTop: 4 }}>© 2026 KM Consultoria · CNPJ 60.368.233/0001-73</div>
              <div style={{ marginTop: 4 }}>Alegre · ES · Brasil</div>
            </div>
          </div>
        )}

        {/* CONTEÚDO FAQ */}
        {aba === "faq" && (
          <div>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 10, lineHeight: 1.5, padding: "0 4px" }}>
              Toque em uma pergunta para ver a resposta. Se não encontrar o que precisa, fale com o suporte pelos canais acima.
            </div>
            {faqs.map(f => (
              <div key={f.id} style={{ background: "#fff", borderRadius: 12, marginBottom: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                <button
                  onClick={() => toggleFaq(f.id)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: abertos[f.id] ? "#f0fdf4" : "#fff",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    transition: "background 0.2s ease",
                  }}
                >
                  <div style={{ fontSize: 16, color: GREEN }}>{abertos[f.id] ? "❓" : "❔"}</div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: NAVY }}>{f.pergunta}</div>
                  <div style={{
                    fontSize: 18,
                    color: GREEN,
                    transition: "transform 0.2s ease",
                    transform: abertos[f.id] ? "rotate(45deg)" : "rotate(0)",
                  }}>+</div>
                </button>
                {abertos[f.id] && (
                  <div style={{
                    padding: "0 14px 14px 38px",
                    fontSize: 12,
                    color: "#444",
                    lineHeight: 1.7,
                    background: "#f9fafb",
                    borderTop: "1px solid #e5e7eb",
                    paddingTop: 12,
                  }}>
                    {f.resposta}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* CONTEÚDO TERMOS */}
        {aba === "termos" && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 8 }}>📄 Termos de Uso</div>
            <div style={{ fontSize: 10, color: "#888", marginBottom: 14 }}>Última atualização: maio de 2026</div>

            <div style={{ fontSize: 12, color: "#333", lineHeight: 1.7 }}>
              <p style={{ marginTop: 0 }}>
                <b>1. Aceitação dos termos</b><br/>
                Ao usar o KMZERO, você concorda com estes termos. Se não concordar, por favor não utilize o aplicativo.
              </p>

              <p>
                <b>2. Sobre o aplicativo</b><br/>
                O KMZERO é um aplicativo de gestão de obras desenvolvido pela KM Consultoria (CNPJ 60.368.233/0001-73), destinado ao controle interno de canteiros, equipes, materiais, custos e relatórios. O aplicativo é fornecido "no estado em que se encontra", sem garantia de operação ininterrupta.
              </p>

              <p>
                <b>3. Conta e segurança</b><br/>
                Você é responsável por manter sigilo sobre sua senha e por todas as atividades realizadas com sua conta. Em caso de uso indevido suspeito, troque sua senha e informe o suporte imediatamente.
              </p>

              <p>
                <b>4. Uso permitido</b><br/>
                O KMZERO é destinado exclusivamente para gestão de obras civis. É proibido usar o aplicativo para qualquer finalidade ilícita, para fraudar registros oficiais, ou para qualquer atividade que viole a legislação brasileira.
              </p>

              <p>
                <b>5. Conteúdo do usuário</b><br/>
                Você é proprietário dos dados que insere no aplicativo (cadastros, fotos, relatórios, etc.). A KM Consultoria não reivindica nenhuma propriedade sobre esses dados. Você pode exportar ou apagar seus dados a qualquer momento.
              </p>

              <p>
                <b>6. Responsabilidades</b><br/>
                A KM Consultoria não se responsabiliza por perdas de dados decorrentes de falha do aparelho do usuário, exclusão acidental, ou problemas de conexão. Recomendamos backup periódico em Sistema → Backup.
              </p>

              <p>
                <b>7. Atualizações</b><br/>
                Estes termos podem ser atualizados a qualquer momento. A versão vigente sempre estará disponível dentro do aplicativo, em Sistema → Ajuda & Suporte → Termos de Uso.
              </p>

              <p>
                <b>8. Foro</b><br/>
                Fica eleito o foro da comarca de Alegre-ES para dirimir quaisquer questões relacionadas a estes termos, com renúncia expressa a qualquer outro.
              </p>

              <p style={{ marginBottom: 0 }}>
                <b>9. Contato</b><br/>
                Em caso de dúvidas, escreva para kvmprojetos@gmail.com ou WhatsApp (28) 99925-8172.
              </p>
            </div>
          </div>
        )}

        {/* CONTEÚDO LGPD */}
        {aba === "lgpd" && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 8 }}>🔒 Política de Privacidade (LGPD)</div>
            <div style={{ fontSize: 10, color: "#888", marginBottom: 14 }}>
              Conforme Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais
            </div>

            <div style={{ fontSize: 12, color: "#333", lineHeight: 1.7 }}>
              <p style={{ marginTop: 0 }}>
                <b>Controlador dos dados</b><br/>
                KM CONSULTORIA, ASSESSORIA E SERVIÇOS DE ENGENHARIA LTDA · CNPJ 60.368.233/0001-73 · R. Pastor da Silva Colares, 148 — Guararema, Alegre-ES.
              </p>

              <p>
                <b>Quais dados coletamos</b><br/>
                Para funcionamento do aplicativo, coletamos: nome, e-mail e senha de gestor e encarregados; dados de trabalhadores cadastrados pelo gestor (nome, CPF, função, salário, fotos); dados das obras (localização, fotos, RDOs); dados de pedidos e fornecedores. Não coletamos dados sensíveis (saúde, biometria, opinião política) sem consentimento expresso.
              </p>

              <p>
                <b>Para que usamos seus dados</b><br/>
                Os dados são usados exclusivamente para o funcionamento do aplicativo: autenticação, exibição de informações, geração de relatórios, controle de obras. Não vendemos dados a terceiros. Não usamos para marketing.
              </p>

              <p>
                <b>Onde os dados ficam</b><br/>
                Os dados ficam armazenados localmente no aparelho do usuário e, quando autenticado pelo Firebase, em servidores do Google Cloud (data center em São Paulo, Brasil). As senhas ficam criptografadas, ninguém da KM Consultoria pode vê-las.
              </p>

              <p>
                <b>Compartilhamento com terceiros</b><br/>
                Compartilhamos dados apenas com o Google (Firebase) para autenticação e armazenamento em nuvem. O Google segue rigorosos padrões de segurança e LGPD. Não há outros compartilhamentos.
              </p>

              <p>
                <b>Seus direitos como titular</b><br/>
                Você pode, a qualquer momento: solicitar confirmação dos dados que temos sobre você; pedir acesso aos seus dados; corrigir dados incompletos ou incorretos; solicitar exclusão de seus dados; revogar consentimento. Para exercer qualquer direito, escreva para kvmprojetos@gmail.com.
              </p>

              <p>
                <b>Tempo de armazenamento</b><br/>
                Mantemos seus dados enquanto sua conta estiver ativa. Após a exclusão da conta, os dados são removidos em até 30 dias, exceto quando houver obrigação legal de retenção (por exemplo, registros trabalhistas e fiscais conforme legislação aplicável).
              </p>

              <p>
                <b>Segurança</b><br/>
                Utilizamos criptografia, autenticação segura e controle de acesso para proteger seus dados. Mesmo assim, nenhum sistema é 100% seguro. Em caso de incidente, comunicamos os titulares afetados conforme exige a LGPD.
              </p>

              <p>
                <b>Cookies e rastreamento</b><br/>
                O KMZERO não usa cookies de rastreamento publicitário. Usamos apenas armazenamento local técnico necessário ao funcionamento do aplicativo.
              </p>

              <p style={{ marginBottom: 0 }}>
                <b>Encarregado de dados (DPO)</b><br/>
                Kleber Vieira Martins · CREA-ES · E-mail kvmprojetos@gmail.com · Tel (28) 99925-8172.
              </p>
            </div>
          </div>
        )}

        {/* Versão do app */}
        <div style={{ marginTop: 18, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#999", lineHeight: 1.6 }}>
            <div><b>KMZERO</b> · Versão 1.0.0 · Atualizado em maio/2026</div>
            <div style={{ marginTop: 2 }}>© 2026 KM Consultoria · Engenharia Civil</div>
            <div style={{ marginTop: 2 }}>Alegre-ES · CNPJ 60.368.233/0001-73</div>
          </div>
        </div>
      </div>
      <KMFooter />
    </div>
  );
}

function TelaConfigEmpresa({ empresa, onSave, onBack }) {
  const [form, setForm] = useState(empresa);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [salvo, setSalvo] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Empresa" sub="Dados para RDO/PDF" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <label style={labelS}>Razão Social</label>
          <input value={form.razaoSocial} onChange={e => set("razaoSocial", e.target.value)} style={inputS} />
          <label style={labelS}>CNPJ</label>
          <input value={form.cnpj} onChange={e => set("cnpj", e.target.value)} placeholder="00.000.000/0001-00" style={inputS} />
          <label style={labelS}>Responsável Técnico</label>
          <input value={form.responsavel} onChange={e => set("responsavel", e.target.value)} style={inputS} />
          <label style={labelS}>Registro Profissional</label>
          <input value={form.registro} onChange={e => set("registro", e.target.value)} placeholder="CREA-ES 12345" style={inputS} />
          <label style={labelS}>E-mail</label>
          <input value={form.email} onChange={e => set("email", e.target.value)} style={inputS} />
          <label style={labelS}>Telefone</label>
          <input value={form.telefone} onChange={e => set("telefone", e.target.value)} style={inputS} />
          <label style={labelS}>📍 Endereço</label>
          <input value={form.endereco || ""} onChange={e => set("endereco", e.target.value)} placeholder="Rua, número, bairro, cidade-UF" style={inputS} />
          <label style={labelS}>📷 Instagram</label>
          <input
            value={form.instagram || ""}
            onChange={e => set("instagram", e.target.value.replace(/^@/, ""))}
            placeholder="km_engenharias (sem o @)"
            style={inputS}
          />
          {form.instagram && (
            <a
              href={`https://instagram.com/${form.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: BLUE,
                textDecoration: "none",
                marginTop: -8,
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              📷 Ver @{form.instagram} no Instagram ›
            </a>
          )}

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "2px solid #f3f4f6" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 4 }}>🏢 Logomarca da Empresa</div>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 12 }}>
              A logo aparece nos cabeçalhos dos relatórios (RDO, pedidos, folha) ao lado da identidade KMZERO. Use uma imagem PNG ou JPG, de preferência com fundo transparente.
            </div>

            {form.logoBase64 ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                  <img src={form.logoBase64} alt="Logo da empresa" style={{ maxWidth: "100%", maxHeight: 90, objectFit: "contain" }} />
                </div>
                <button
                  onClick={() => set("logoBase64", "")}
                  style={{ width: "100%", padding: 10, background: "#fee2e2", color: RED, border: "1px solid " + RED + "55", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  🗑️ Remover logomarca
                </button>
              </div>
            ) : (
              <div style={{ background: "#f9fafb", border: "1px dashed #cbd5e1", borderRadius: 10, padding: 20, textAlign: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>🖼️</div>
                <div style={{ fontSize: 12, color: "#888" }}>Nenhuma logomarca carregada</div>
              </div>
            )}

            <label style={{ ...labelS, display: "block" }}>Carregar imagem da logo</label>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={e => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  alert("Imagem muito grande. O tamanho máximo é 2 MB. Reduza a imagem e tente novamente.");
                  e.target.value = "";
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => set("logoBase64", reader.result);
                reader.onerror = () => alert("Não foi possível ler a imagem. Tente outro arquivo.");
                reader.readAsDataURL(file);
              }}
              style={{ ...inputS, padding: 8 }}
            />
          </div>

          <Btn label="💾 SALVAR" color={GREEN} onClick={() => { onSave(form); setSalvo(true); setTimeout(() => setSalvo(false), 2500); }} style={{ marginTop: 16 }} />
          {salvo && <div style={{ background: "#f0fdf4", color: GREEN, borderRadius: 8, padding: "8px 12px", fontSize: 13, marginTop: 8, textAlign: "center", fontWeight: 600 }}>✅ Salvo!</div>}
        </div>
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   PRODUTIVIDADE (m² alvenaria, m³ concreto, etc.)
════════════════════════════════════ */
function TelaProdutividade({ obras, usuario, produtividade, onBack, onAdd, onRemove }) {
  const [obraId, setObraId] = useState(usuario?.obraId || obras[0]?.id || 1);
  const [tipo, setTipo] = useState("Alvenaria");
  const [qtd, setQtd] = useState("");
  const [unidade, setUnidade] = useState("m²");
  const [obs, setObs] = useState("");

  const TIPOS = [
    { nome: "Alvenaria", unidade: "m²", icon: "🧱" },
    { nome: "Concretagem", unidade: "m³", icon: "🏗️" },
    { nome: "Reboco", unidade: "m²", icon: "🎨" },
    { nome: "Piso", unidade: "m²", icon: "▪️" },
    { nome: "Forro", unidade: "m²", icon: "📐" },
    { nome: "Telhado", unidade: "m²", icon: "🏠" },
    { nome: "Pintura", unidade: "m²", icon: "🖌️" },
    { nome: "Escavação", unidade: "m³", icon: "⛏️" },
    { nome: "Estrutura Metálica", unidade: "kg", icon: "⚙️" },
    { nome: "Outro", unidade: "un", icon: "📦" },
  ];

  const adicionar = () => {
    if (!qtd) return;
    onAdd({ id: Date.now(), obraId, tipo, qtd: parseFloat(qtd), unidade, obs, autor: usuario?.nome, ts: Date.now(), data: new Date().toLocaleDateString("pt-BR") });
    setQtd(""); setObs("");
  };

  const minhasObra = produtividade.filter(p => p.obraId === obraId).sort((a, b) => b.ts - a.ts);
  const obra = obras.find(o => o.id === obraId);

  // Totais por tipo
  const totais = {};
  minhasObra.forEach(p => {
    const k = `${p.tipo}|${p.unidade}`;
    totais[k] = (totais[k] || 0) + p.qtd;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Produtividade" sub={obra?.nome} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <select value={obraId} onChange={e => setObraId(parseInt(e.target.value))} style={{ ...selS, marginBottom: 12 }}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📝 Registrar Produção</div>
          <label style={labelS}>Tipo de serviço</label>
          <select value={tipo} onChange={e => { const t = TIPOS.find(x => x.nome === e.target.value); setTipo(e.target.value); if (t) setUnidade(t.unidade); }} style={selS}>
            {TIPOS.map(t => <option key={t.nome}>{t.nome}</option>)}
          </select>
          <label style={labelS}>Quantidade executada</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={qtd} onChange={e => setQtd(e.target.value)} type="number" placeholder="Ex: 25,5" style={{ ...inputS, flex: 2, marginBottom: 0 }} />
            <select value={unidade} onChange={e => setUnidade(e.target.value)} style={{ ...selS, flex: 1, marginBottom: 0 }}>
              {["m²", "m³", "m", "kg", "un", "t", "L"].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <label style={{ ...labelS, marginTop: 10 }}>Observação (opcional)</label>
          <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: parede sul do bloco A" style={inputS} />
          <Btn label="✓ REGISTRAR" color={GREEN} onClick={adicionar} />
        </div>

        {Object.keys(totais).length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>📊 Totais Acumulados</div>
            {Object.entries(totais).map(([k, v]) => {
              const [t, u] = k.split("|");
              const cfg = TIPOS.find(x => x.nome === t);
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <span style={{ fontSize: 22, marginRight: 10 }}>{cfg?.icon || "📦"}</span>
                  <span style={{ flex: 1, fontSize: 13, color: NAVY }}>{t}</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: GREEN }}>{v.toFixed(2)} {u}</span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, fontSize: 13 }}>📜 Histórico</div>
        {minhasObra.length === 0 && <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: 16 }}>Nenhum registro.</div>}
        {minhasObra.map(p => {
          const cfg = TIPOS.find(x => x.nome === p.tipo);
          return (
            <div key={p.id} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
              <span style={{ fontSize: 24, marginRight: 10 }}>{cfg?.icon || "📦"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{p.tipo} — {fmtQtd(p.qtd)} {p.unidade}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{p.autor} • {p.data}</div>
                {p.obs && <div style={{ fontSize: 10, color: "#666", fontStyle: "italic" }}>{p.obs}</div>}
              </div>
              <button onClick={() => onRemove(p.id)} style={{ background: "#fee2e2", border: "2px solid #d63b3b", color: "#d63b3b", cursor: "pointer", padding: "6px 10px", borderRadius: 8, fontSize: 16, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>
            </div>
          );
        })}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   RECEBIMENTO DE MATERIAL (com foto + validação visual)
════════════════════════════════════ */
function TelaRecebimento({ obras, pedidos, usuario, recebimentos, onBack, onAdd }) {
  const [step, setStep] = useState("lista"); // lista | novo | foto | confirmar
  const [pedidoSel, setPedidoSel] = useState(null);
  const [foto, setFoto] = useState(null);
  const [obs, setObs] = useState("");
  const [conformidade, setConformidade] = useState("Conforme");

  const aprovados = pedidos.filter(p => p.status === "Aprovado" && (!usuario?.obraId || p.obraId === usuario.obraId));
  const meusReceb = recebimentos.filter(r => !usuario?.obraId || r.obraId === usuario.obraId);

  const handleFoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => { setFoto(ev.target.result); setStep("confirmar"); };
    r.readAsDataURL(f);
  };

  const confirmar = () => {
    onAdd({
      id: Date.now(), pedidoId: pedidoSel.id, obraId: pedidoSel.obraId,
      material: pedidoSel.material, qtd: pedidoSel.qtd, foto, obs, conformidade,
      autor: usuario?.nome, ts: Date.now(), data: new Date().toLocaleDateString("pt-BR"),
    });
    setStep("lista"); setPedidoSel(null); setFoto(null); setObs(""); setConformidade("Conforme");
  };

  if (step === "novo") return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Selecionar Pedido" onBack={() => setStep("lista")} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>Selecione o pedido aprovado que está sendo recebido:</div>
        {aprovados.length === 0 && <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", color: "#aaa" }}>Nenhum pedido aprovado para receber.</div>}
        {aprovados.map(p => (
          <div key={p.id} onClick={() => { setPedidoSel(p); setStep("foto"); }} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer", borderLeft: `4px solid ${GREEN}` }}>
            <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{p.material} — {fmtQtd(p.qtd)}</div>
            <div style={{ fontSize: 11, color: "#888" }}>{p.obra} • {p.data} • {p.enc}</div>
          </div>
        ))}
      </div>
      <KMFooter />
    </div>
  );

  if (step === "foto") return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Foto da Entrega" sub={pedidoSel?.material} onBack={() => setStep("novo")} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📦</div>
          <div style={{ fontWeight: 700, color: NAVY }}>{pedidoSel?.material}</div>
          <div style={{ fontSize: 13, color: "#666" }}>{pedidoSel?.qtd}</div>
        </div>
        <div style={{ background: "#fff8e1", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#7b5800", marginBottom: 12 }}>
          ⚠️ <b>Validação Visual Obrigatória</b><br/>Tire foto do material recebido como comprovação.
        </div>
        <label style={{ ...bigBtn(BLUE), display: "block", textAlign: "center" }}>
          📷 Tirar Foto
          <input type="file" accept="image/*" capture="environment" onChange={handleFoto} style={{ display: "none" }} />
        </label>
      </div>
      <KMFooter />
    </div>
  );

  if (step === "confirmar") return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Validar Recebimento" sub={pedidoSel?.material} onBack={() => setStep("foto")} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {foto && <img src={foto} alt="" style={{ width: "100%", borderRadius: 12, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }} />}

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 14 }}>✓ Conformidade da Entrega</div>
          {[
            { v: "Conforme",        l: "✅ Conforme — tudo correto", c: GREEN },
            { v: "Divergência",     l: "⚠️ Divergência — quantidade ou qualidade",   c: ORANGE },
            { v: "Não Conforme",    l: "❌ Não Conforme — material errado",          c: RED },
          ].map(o => (
            <button key={o.v} onClick={() => setConformidade(o.v)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `2px solid ${conformidade === o.v ? o.c : "#dde2ef"}`, background: conformidade === o.v ? o.c : "#fff", color: conformidade === o.v ? "#fff" : "#666", fontWeight: 700, cursor: "pointer", fontSize: 13, marginBottom: 8, textAlign: "left" }}>
              {o.l}
            </button>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <label style={labelS}>Observações</label>
          <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} placeholder={conformidade === "Conforme" ? "Ex: material em ordem" : "Descreva a divergência ou problema..."} style={{ ...inputS, resize: "none", marginBottom: 0 }} />
        </div>

        <Btn label="✓ CONFIRMAR RECEBIMENTO" color={conformidade === "Conforme" ? GREEN : ORANGE} onClick={confirmar} />
      </div>
      <KMFooter />
    </div>
  );

  // Lista
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Recebimento" sub="Validação de entregas" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <Btn label="➕ Novo Recebimento" color={GREEN} onClick={() => setStep("novo")} style={{ marginBottom: 14 }} />

        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, fontSize: 13 }}>📜 Recebimentos recentes</div>
        {meusReceb.length === 0 && <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", color: "#aaa" }}>Nenhum recebimento ainda.</div>}
        {meusReceb.map(r => {
          const cor = r.conformidade === "Conforme" ? GREEN : r.conformidade === "Divergência" ? ORANGE : RED;
          const obra = obras.find(o => o.id === r.obraId);
          return (
            <div key={r.id} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${cor}` }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                {r.foto && <img src={r.foto} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover" }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{r.material} — {r.qtd}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{obra?.nome} • {r.data}</div>
                  <Badge label={r.conformidade} color={cor} small />
                  {r.obs && <div style={{ fontSize: 11, color: "#666", marginTop: 4, fontStyle: "italic" }}>{r.obs}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   FOLHA QUINZENAL (1ª: 1-15 / 2ª: 16-fim)
════════════════════════════════════ */
function TelaFolhaQuinzenal({ obras, trabalhadores, historico, adiantamentos, abastecimentos = [], ativos = [], empresa, onBack, onSalvarFolha }) {
  const hoje = new Date();
  // ════ ESCOLHA DO REGIME DA FOLHA (definida pelo gestor) ════
  const [tipoRegime, setTipoRegime] = useState("quinzenal"); // diaria | semanal | quinzenal | mensal
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [quinzena, setQuinzena] = useState(hoje.getDate() <= 15 ? 1 : 2);
  // ════ NOVOS: datas de pagamento definidas pelo gestor ════
  const [dataPagamento, setDataPagamento] = useState(""); // data específica que o gestor escolhe pagar
  const [diaPagDiario, setDiaPagDiario] = useState(hoje.toISOString().slice(0, 10)); // diária: dia específico
  const [diaPagSemanal, setDiaPagSemanal] = useState(hoje.toISOString().slice(0, 10)); // semanal: dia que paga
  const [semanaSelecionada, setSemanaSelecionada] = useState(1); // 1-5 (qual semana do mês)
  const [diaPagQuinzenal1, setDiaPagQuinzenal1] = useState(""); // 1ª quinzena: data de pagamento
  const [diaPagQuinzenal2, setDiaPagQuinzenal2] = useState(""); // 2ª quinzena: data de pagamento
  const [diaPagMensal, setDiaPagMensal] = useState(""); // mensal: data de pagamento
  // ════ PERSONALIZADO: período totalmente livre ════
  const [persInicio, setPersInicio] = useState(""); // data inicial (YYYY-MM-DD)
  const [persFim, setPersFim] = useState("");        // data final (YYYY-MM-DD)
  const [persPagamento, setPersPagamento] = useState(""); // data de pagamento
  // ════ obra ════
  const [obraId, setObraId] = useState("todas");
  const [salvoAviso, setSalvoAviso] = useState(false);

  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const dia1 = quinzena === 1 ? 1 : 16;
  const dia2 = quinzena === 1 ? 15 : ultimoDia;

  // ════ Calcula início/fim do período conforme regime ════
  const calcularPeriodo = () => {
    if (tipoRegime === "diaria") {
      // 1 dia específico
      const data = new Date(diaPagDiario + "T12:00:00");
      return {
        diaInicio: data.getDate(),
        diaFim: data.getDate(),
        mesInicio: data.getMonth(),
        mesFim: data.getMonth(),
        anoInicio: data.getFullYear(),
        anoFim: data.getFullYear(),
        descricao: "Diária",
      };
    } else if (tipoRegime === "semanal") {
      // 7 dias terminando no diaPagSemanal
      const fim = new Date(diaPagSemanal + "T12:00:00");
      const inicio = new Date(fim);
      inicio.setDate(inicio.getDate() - 6);
      return {
        diaInicio: inicio.getDate(),
        diaFim: fim.getDate(),
        mesInicio: inicio.getMonth(),
        mesFim: fim.getMonth(),
        anoInicio: inicio.getFullYear(),
        anoFim: fim.getFullYear(),
        descricao: "Semanal",
      };
    } else if (tipoRegime === "mensal") {
      // Mês completo
      return {
        diaInicio: 1,
        diaFim: ultimoDia,
        mesInicio: mes,
        mesFim: mes,
        anoInicio: ano,
        anoFim: ano,
        descricao: "Mensal",
      };
    } else if (tipoRegime === "personalizado") {
      // PERSONALIZADO: período totalmente livre (data inicial e final escolhidas)
      if (!persInicio || !persFim) {
        // Se faltar data, usa o mês corrente como fallback seguro
        return {
          diaInicio: 1,
          diaFim: ultimoDia,
          mesInicio: mes,
          mesFim: mes,
          anoInicio: ano,
          anoFim: ano,
          descricao: "Personalizado (defina as datas)",
        };
      }
      const ini = new Date(persInicio + "T12:00:00");
      const fim = new Date(persFim + "T12:00:00");
      return {
        diaInicio: ini.getDate(),
        diaFim: fim.getDate(),
        mesInicio: ini.getMonth(),
        mesFim: fim.getMonth(),
        anoInicio: ini.getFullYear(),
        anoFim: fim.getFullYear(),
        descricao: "Personalizado",
      };
    } else {
      // QUINZENAL (padrão)
      return {
        diaInicio: dia1,
        diaFim: dia2,
        mesInicio: mes,
        mesFim: mes,
        anoInicio: ano,
        anoFim: ano,
        descricao: "Quinzenal",
      };
    }
  };

  const trabFiltro = obraId === "todas" ? trabalhadores : trabalhadores.filter(t => t.obraId === parseInt(obraId));

  const calcular = (t) => {
    // ════ NOVO: usa o tipo GLOBAL escolhido pelo gestor no topo da tela ════
    const periodo = calcularPeriodo();
    const formaCalculo = t.formaCalculo || "diaria";

    // ────── CONTAR PRESENÇAS NO PERÍODO ──────
    let presentes = 0, faltas = 0, atestados = 0, feriados = 0;
    let diasTotaisPeriodo = 0;
    const contarDia = (d, mAtual, aAtual) => {
      const iso = `${aAtual}-${String(mAtual + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const s = (historico[iso] || {})[t.id];
      const feriado = feriadoEm(iso);
      diasTotaisPeriodo++;
      // FERIADO NACIONAL: conta como pago (Lei brasileira)
      // Só conta como feriado se o registro for vazio OU "Feriado" OU "Falta" (faltas em feriado nacional viram feriado pago)
      if (feriado && feriado.tipo === "nacional" && (s === undefined || s === "" || s === "Feriado" || s === "Falta")) {
        feriados++;
        return;
      }
      if (s === "Presente") presentes++;
      else if (s === "Falta") faltas++;
      else if (s === "Atestado") atestados++;
      else if (s === "Feriado") feriados++;
    };

    if (periodo.mesInicio === periodo.mesFim && periodo.anoInicio === periodo.anoFim) {
      for (let d = periodo.diaInicio; d <= periodo.diaFim; d++) contarDia(d, periodo.mesInicio, periodo.anoInicio);
    } else {
      const ultDiaPrimeiroMes = new Date(periodo.anoInicio, periodo.mesInicio + 1, 0).getDate();
      for (let d = periodo.diaInicio; d <= ultDiaPrimeiroMes; d++) contarDia(d, periodo.mesInicio, periodo.anoInicio);
      for (let d = 1; d <= periodo.diaFim; d++) contarDia(d, periodo.mesFim, periodo.anoFim);
    }

    // ────── CÁLCULO DO VALOR BRUTO ──────
    const diaria = parseFloat(t.diaria) || 0;
    const salarioFixo = parseFloat(t.salarioFixo) || 0;
    // FERIADO NACIONAL conta como dia pago (Lei brasileira)
    const diasPagos = presentes + atestados + feriados;
    let bruto = 0;

    if (formaCalculo === "mensal_fixo" && salarioFixo > 0) {
      if (tipoRegime === "mensal") {
        const diaUtilMes = ultimoDia;
        if (faltas === 0) bruto = salarioFixo;
        else bruto = salarioFixo - (salarioFixo / diaUtilMes) * faltas;
      } else {
        const proporcao = diasTotaisPeriodo / 30;
        const salarioPeriodo = salarioFixo * proporcao;
        if (faltas === 0) bruto = salarioPeriodo;
        else bruto = salarioPeriodo - (salarioPeriodo / diasTotaisPeriodo) * faltas;
      }
      if (bruto < 0) bruto = 0;
    } else {
      // CÁLCULO POR DIÁRIA (padrão)
      bruto = diaria * diasPagos;
    }

    // ────── ADIANTAMENTOS DO MÊS ──────
    // Desconta na 2ª quinzena (quinzenal) ou no fechamento (mensal/semanal/diária)
    let adiantDesconto = 0;
    const aplicarDesconto = (tipoRegime === "quinzenal" && quinzena === 2) ||
                            (tipoRegime === "mensal") ||
                            (tipoRegime === "semanal") ||
                            (tipoRegime === "diaria");
    if (aplicarDesconto && adiantamentos) {
      adiantDesconto = adiantamentos
        .filter(a => a.trabId === t.id)
        .filter(a => {
          try {
            const [d, m, an] = a.data.split("/");
            return parseInt(m) - 1 === mes && parseInt(an) === ano;
          } catch { return false; }
        })
        .reduce((s, a) => s + a.valor, 0);
    }

    const liquido = bruto - adiantDesconto;
    return {
      presentes, faltas, atestados, feriados, diaria, salarioFixo,
      diasPagos, diasTotaisPeriodo, bruto, adiantDesconto, liquido,
      tipoFolha: tipoRegime, descricaoPeriodo: periodo.descricao, formaCalculo,
      diaInicio: periodo.diaInicio, diaFim: periodo.diaFim,
      mesInicio: periodo.mesInicio, mesFim: periodo.mesFim,
      anoInicio: periodo.anoInicio, anoFim: periodo.anoFim,
    };
  };

  const totalFolha = trabFiltro.reduce((s, t) => s + calcular(t).liquido, 0);
  const totalAdiantQuinzena = trabFiltro.reduce((s, t) => s + calcular(t).adiantDesconto, 0);
  // Filtra: só mostra quem tem dias trabalhados ou adiantamento (evita lista cheia de zeros)
  const trabComMov = trabFiltro.filter(t => { const c = calcular(t); return c.diasPagos > 0 || c.adiantDesconto > 0; });

  const exportarPDF = () => {
    const periodo = `${String(dia1).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}/${ano} a ${String(dia2).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}/${ano}`;
    const html = `<html><head><title>Folha de Pagamento — ${meses[mes]}/${ano} (${quinzena}ª)</title>
      <style>
        ${KM_PDF_PAGE_CSS}
        @page { size: A4 landscape; margin: 10mm; }
        @media print { body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        body { font-family: Arial; color: #1a1a1a; font-size: 9pt; margin: 0 auto; max-width: 277mm; box-sizing: border-box; padding: 4mm; }
        h1, h2, h3 { page-break-after: avoid; break-after: avoid; }
        table { page-break-inside: auto; break-inside: auto; }
        tr { page-break-inside: avoid; break-inside: avoid; }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        .head { background: #004080; color: #fff; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; page-break-inside: avoid; }
        .logo { font-size: 18pt; font-weight: 900; letter-spacing: -0.5px; }
        .logo span { color: #C0A040; }
        h1 { color: #004080; text-align: center; font-size: 14pt; margin: 12px 0 4px; }
        .periodo { text-align: center; color: #666; font-size: 10pt; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 8.5pt; table-layout: auto; }
        th { background: #004080; color: #fff; padding: 6px; border: 1px solid #003060; text-align: left; white-space: nowrap; }
        td { padding: 5px 6px; border: 1px solid #ccc; vertical-align: top; overflow-wrap: break-word; word-break: normal; }
        /* Coluna do NOME (1ª): NÃO quebra, se alarga ao texto */
        th:first-child, td:first-child { white-space: nowrap; min-width: 110px; }
        /* Coluna do CARGO (2ª): NÃO quebra */
        th:nth-child(2), td:nth-child(2) { white-space: nowrap; min-width: 80px; }
        /* Números nunca quebram */
        td.num, td.right { white-space: nowrap; }
        /* Texto longo: classe .td-wrap */
        td.td-wrap { white-space: normal; overflow-wrap: break-word; word-break: normal; }
        tr:nth-child(even) td { background: #f8fafc; }
        .num { text-align: center; font-variant-numeric: tabular-nums; }
        .right { text-align: right; }
        .total { background: #f0fdf4 !important; font-weight: 900; color: #1a7a3a; font-size: 10pt; }
        .footer { margin-top: 16px; text-align: center; font-size: 8pt; color: #666; border-top: 1px solid #ddd; padding-top: 8px; }
      </style></head><body>
      <div class="head">
        <div><div class="logo">KM<span>ZERO</span></div><div style="font-size:7pt;letter-spacing:2px;opacity:0.8">GESTÃO DE OBRAS</div></div>
        <div style="text-align:right;font-size:9pt"><b>${empresa.razaoSocial}</b><br>CNPJ: ${empresa.cnpj}<br>${empresa.responsavel}</div>
      </div>
      <h1>FOLHA QUINZENAL DE PAGAMENTO</h1>
      <div class="periodo"><b>Período:</b> ${periodo} (${quinzena}ª quinzena de ${meses[mes]}/${ano}) ${obraId !== "todas" ? `| <b>Obra:</b> ${obras.find(o => o.id === parseInt(obraId))?.nome}` : ""}</div>
      <table>
        <tr>
          <th class="num" style="width:4%">Nº</th>
          <th>Nome</th>
          <th style="width:14%">Cargo</th>
          <th style="width:9%">Obra</th>
          <th class="num" style="width:5%">Pres.</th>
          <th class="num" style="width:5%">Atest.</th>
          <th class="num" style="width:5%">Falta</th>
          <th class="num" style="width:6%">Dias Pagos</th>
          <th class="right" style="width:8%">Diária</th>
          <th class="right" style="width:9%">Bruto</th>
          <th class="right" style="width:9%">Adiantamento</th>
          <th class="right" style="width:11%">Líquido</th>
        </tr>
        ${trabComMov.map((t, i) => {
          const c = calcular(t);
          const obra = obras.find(o => o.id === t.obraId);
          return `<tr>
            <td class="num">${i + 1}</td>
            <td><b>${t.nome}</b></td>
            <td>${t.cargo}</td>
            <td>${obra?.nome?.substring(0, 25) || "—"}</td>
            <td class="num" style="color:#2aa84f;font-weight:700">${c.presentes}</td>
            <td class="num" style="color:#e87722;font-weight:700">${c.atestados}</td>
            <td class="num" style="color:#d63b3b;font-weight:700">${c.faltas}</td>
            <td class="num" style="font-weight:700">${c.diasPagos}</td>
            <td class="right">R$ ${c.diaria.toFixed(2)}</td>
            <td class="right">R$ ${c.bruto.toFixed(2)}</td>
            <td class="right" style="color:#ea580c">${c.adiantDesconto > 0 ? "−R$ " + c.adiantDesconto.toFixed(2) : "—"}</td>
            <td class="right" style="color:#1a7a3a;font-weight:800">R$ ${c.liquido.toFixed(2)}</td>
          </tr>`;
        }).join("")}
        <tr class="total">
          <td colspan="11" class="right"><b>TOTAL DA QUINZENA</b></td>
          <td class="right">R$ ${totalFolha.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
        </tr>
      </table>

      ${(() => {
        // Combustível da quinzena
        const abastQuinz = (abastecimentos || []).filter(a => {
          if (obraId !== "todas" && a.obraId !== parseInt(obraId)) return false;
          try {
            const [d, m, y] = (a.data || "").split("/");
            const dia = parseInt(d);
            return parseInt(m) - 1 === mes && parseInt(y) === ano && dia >= dia1 && dia <= dia2;
          } catch { return false; }
        });
        if (abastQuinz.length === 0) return "";
        const totalComb = abastQuinz.reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);
        const totalLitros = abastQuinz.reduce((s, a) => s + (parseFloat(a.litros) || 0), 0);
        return `
        <h2 style="page-break-before:auto;margin-top:20px;background:#0f2151;color:#fff;padding:8px 12px;font-size:11pt;">⛽ COMBUSTÍVEL DA QUINZENA — ${abastQuinz.length} abastecimento(s)</h2>
        <table>
          <tr><th>Veículo</th><th>Data</th><th>Posto</th><th class="right">Litros</th><th class="right">R$/L</th><th class="right">Valor</th></tr>
          ${abastQuinz.sort((a,b) => (a.data > b.data ? 1 : -1)).map(a => {
            const ativo = ativos.find(x => x.id === a.ativoId);
            const lpu = a.litros > 0 ? (a.valor / a.litros).toFixed(2) : "—";
            return `<tr>
              <td><b>${ativo?.nome || "—"}</b>${ativo?.placa ? " (" + ativo.placa + ")" : ""}</td>
              <td>${a.data}</td>
              <td>${a.posto || "—"}</td>
              <td class="right">${(parseFloat(a.litros) || 0).toFixed(1)}</td>
              <td class="right">R$ ${lpu}</td>
              <td class="right"><b>R$ ${(parseFloat(a.valor) || 0).toFixed(2)}</b></td>
            </tr>`;
          }).join("")}
          <tr class="total">
            <td colspan="3" class="right"><b>TOTAL COMBUSTÍVEL</b></td>
            <td class="right"><b>${totalLitros.toFixed(1)}L</b></td>
            <td></td>
            <td class="right"><b>R$ ${totalComb.toFixed(2)}</b></td>
          </tr>
        </table>
        `;
      })()}

      <div class="footer">${empresa.razaoSocial} • Gerado em ${new Date().toLocaleString("pt-BR")} • Sistema KMZERO</div>
      <script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
      </body></html>`;
    abrirOuBaixarHTML(html, `Folha-${quinzena}aQ-${meses[mes]}-${ano}.html`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Folha de Pagamento" sub={`${meses[mes]}/${ano} · ${tipoRegime.charAt(0).toUpperCase() + tipoRegime.slice(1)}`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* ════ 4 BOTÕES DE TIPO DE FOLHA (escolha simples) ════ */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 12, marginBottom: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: NAVY, letterSpacing: 2, marginBottom: 8 }}>📋 TIPO DA FOLHA</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {[
              { k: "diaria", l: "📅 Diária", c: "#0891b2", d: "1 dia específico" },
              { k: "semanal", l: "📆 Semanal", c: "#16a34a", d: "7 dias corridos" },
              { k: "quinzenal", l: "🗓️ Quinzenal", c: GOLD, d: "15 dias" },
              { k: "mensal", l: "📊 Mensal", c: "#7c3aed", d: "Mês completo" },
              { k: "personalizado", l: "⚙️ Personalizado", c: "#e87722", d: "Você escolhe o período" },
            ].map(opt => (
              <button
                key={opt.k}
                onClick={() => setTipoRegime(opt.k)}
                style={{
                  padding: "10px 8px",
                  borderRadius: 10,
                  border: tipoRegime === opt.k ? `2px solid ${opt.c}` : "1px solid #e5e7eb",
                  background: tipoRegime === opt.k ? `${opt.c}15` : "#fff",
                  color: tipoRegime === opt.k ? opt.c : NAVY,
                  fontWeight: 800,
                  cursor: "pointer",
                  textAlign: "left",
                  boxShadow: tipoRegime === opt.k ? `0 3px 10px ${opt.c}30` : "none",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontSize: 13 }}>{opt.l}</div>
                <div style={{ fontSize: 9, opacity: 0.7, fontWeight: 500, marginTop: 2 }}>{opt.d}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ════ MÊS / ANO ════ */}
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select value={mes} onChange={e => setMes(parseInt(e.target.value))} style={{ ...selS, flex: 2, marginBottom: 0 }}>
            {meses.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(parseInt(e.target.value))} style={{ ...selS, flex: 1, marginBottom: 0 }}>
            {[ano - 1, ano, ano + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* ════ CAMPOS DE DATA DE PAGAMENTO (variam conforme tipo escolhido) ════ */}
        {tipoRegime === "diaria" && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, border: "1px solid #0891b215" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#0891b2", letterSpacing: 1, marginBottom: 6 }}>📅 DIA DA FOLHA DIÁRIA</div>
            <input
              type="date"
              value={diaPagDiario}
              onChange={e => setDiaPagDiario(e.target.value)}
              style={{ ...inputS, marginBottom: 6 }}
            />
            <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5 }}>
              💡 Folha calculada apenas para esse dia específico. Use para pagar diária avulsa.
            </div>
          </div>
        )}

        {tipoRegime === "semanal" && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, border: "1px solid #16a34a15" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: GREEN, letterSpacing: 1, marginBottom: 6 }}>📆 ÚLTIMO DIA DA SEMANA (DATA DE PAGAMENTO)</div>
            <input
              type="date"
              value={diaPagSemanal}
              onChange={e => setDiaPagSemanal(e.target.value)}
              style={{ ...inputS, marginBottom: 6 }}
            />
            <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5 }}>
              💡 Calcula os 7 dias anteriores (inclusive) ao dia escolhido. Ex: pagamento toda sexta-feira.
            </div>
          </div>
        )}

        {tipoRegime === "quinzenal" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              {[1, 2].map(q => (
                <button key={q} onClick={() => setQuinzena(q)} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: "none", cursor: "pointer", background: quinzena === q ? NAVY : "#fff", color: quinzena === q ? "#fff" : NAVY, fontWeight: 700, fontSize: 13, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
                  {q}ª Quinzena<br/><span style={{ fontSize: 10, opacity: 0.8 }}>{q === 1 ? "01-15" : `16-${ultimoDia}`}</span>
                </button>
              ))}
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, border: `1px solid ${GOLD}15` }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#b8801a", letterSpacing: 1, marginBottom: 6 }}>🗓️ DATA DE PAGAMENTO DA {quinzena}ª QUINZENA</div>
              <input
                type="date"
                value={quinzena === 1 ? diaPagQuinzenal1 : diaPagQuinzenal2}
                onChange={e => quinzena === 1 ? setDiaPagQuinzenal1(e.target.value) : setDiaPagQuinzenal2(e.target.value)}
                style={{ ...inputS, marginBottom: 6 }}
              />
              <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5 }}>
                💡 Período calculado: {quinzena === 1 ? "dia 01 ao 15" : `dia 16 ao ${ultimoDia}`}. Data informada será exibida na folha.
              </div>
            </div>
          </>
        )}

        {tipoRegime === "mensal" && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, border: "1px solid #7c3aed15" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed", letterSpacing: 1, marginBottom: 6 }}>📊 DATA DE PAGAMENTO DO MÊS</div>
            <input
              type="date"
              value={diaPagMensal}
              onChange={e => setDiaPagMensal(e.target.value)}
              style={{ ...inputS, marginBottom: 6 }}
            />
            <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5 }}>
              💡 Período calculado: mês inteiro ({meses[mes]}/{ano}, dia 1 ao {ultimoDia}). Data informada será exibida na folha.
            </div>
          </div>
        )}

        {tipoRegime === "personalizado" && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, border: "1px solid #e8772230" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#e87722", letterSpacing: 1, marginBottom: 6 }}>⚙️ PERÍODO PERSONALIZADO</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: "#666", fontWeight: 700, display: "block", marginBottom: 2 }}>DATA INICIAL</label>
                <input
                  type="date"
                  value={persInicio}
                  onChange={e => setPersInicio(e.target.value)}
                  style={{ ...inputS, marginBottom: 0 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#666", fontWeight: 700, display: "block", marginBottom: 2 }}>DATA FINAL</label>
                <input
                  type="date"
                  value={persFim}
                  onChange={e => setPersFim(e.target.value)}
                  style={{ ...inputS, marginBottom: 0 }}
                />
              </div>
            </div>
            <label style={{ fontSize: 10, color: "#666", fontWeight: 700, display: "block", marginBottom: 2 }}>DATA DE PAGAMENTO</label>
            <input
              type="date"
              value={persPagamento}
              onChange={e => setPersPagamento(e.target.value)}
              style={{ ...inputS, marginBottom: 6 }}
            />
            {persInicio && persFim ? (
              <div style={{ background: "#fff5e6", borderRadius: 6, padding: "6px 8px", fontSize: 11, color: "#9a5a1a", lineHeight: 1.4 }}>
                ✓ Período: <b>{new Date(persInicio + "T12:00:00").toLocaleDateString("pt-BR")}</b> até <b>{new Date(persFim + "T12:00:00").toLocaleDateString("pt-BR")}</b>
                {(() => {
                  const ini = new Date(persInicio + "T12:00:00");
                  const fim = new Date(persFim + "T12:00:00");
                  const dias = Math.round((fim - ini) / (1000 * 60 * 60 * 24)) + 1;
                  return dias > 0 ? <span> · <b>{dias} dia{dias > 1 ? "s" : ""}</b></span> : <span style={{ color: RED }}> · ⚠️ Data final deve ser depois da inicial</span>;
                })()}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5 }}>
                💡 Use para quinzenas atípicas (ex: dia 18 ao 29), períodos de empreitada ou qualquer intervalo livre.
              </div>
            )}
          </div>
        )}

        {/* ════ BANNER DE FERIADOS NO PERÍODO ════ */}
        {(() => {
          const p = calcularPeriodo();
          const feriadosNoPeriodo = [];
          const adicionarSe = (dia, m, a) => {
            const iso = `${a}-${String(m + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
            const f = feriadoEm(iso);
            if (f) feriadosNoPeriodo.push({ data: iso, ...f });
          };
          if (p.mesInicio === p.mesFim && p.anoInicio === p.anoFim) {
            for (let d = p.diaInicio; d <= p.diaFim; d++) adicionarSe(d, p.mesInicio, p.anoInicio);
          } else {
            const ult = new Date(p.anoInicio, p.mesInicio + 1, 0).getDate();
            for (let d = p.diaInicio; d <= ult; d++) adicionarSe(d, p.mesInicio, p.anoInicio);
            for (let d = 1; d <= p.diaFim; d++) adicionarSe(d, p.mesFim, p.anoFim);
          }
          if (feriadosNoPeriodo.length === 0) return null;
          return (
            <div style={{ background: "#fff7e6", borderRadius: 12, padding: 12, marginBottom: 10, border: `1px solid ${GOLD}30` }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#8a6d1a", letterSpacing: 1, marginBottom: 6 }}>🎉 FERIADO(S) NESTE PERÍODO</div>
              {feriadosNoPeriodo.map(f => {
                const [a, m, d] = f.data.split("-");
                return (
                  <div key={f.data} style={{ fontSize: 12, color: "#5c5210", marginBottom: 3, display: "flex", justifyContent: "space-between" }}>
                    <span>{f.emoji} <b>{f.nome}</b></span>
                    <span style={{ color: f.tipo === "nacional" ? "#16a34a" : "#888", fontSize: 10, fontWeight: 700, alignSelf: "center" }}>
                      {d}/{m} • {f.tipo === "nacional" ? "PAGO" : "FACULTATIVO"}
                    </span>
                  </div>
                );
              })}
              <div style={{ fontSize: 10, color: "#7c6f3a", marginTop: 6, lineHeight: 1.4 }}>
                ℹ️ Feriados nacionais são contados como dia pago automaticamente (Lei 605/49). Facultativos seguem o registro de presença.
              </div>
            </div>
          );
        })()}

        <select value={obraId} onChange={e => setObraId(e.target.value)} style={{ ...selS, marginBottom: 12 }}>
          <option value="todas">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <div style={{ background: `linear-gradient(135deg,${GREEN},#1a8540)`, borderRadius: 14, padding: 16, marginBottom: 12, color: "#fff", boxShadow: "0 4px 14px #2aa84f44" }}>
          <div style={{ fontSize: 11, opacity: 0.9 }}>Total da folha {tipoRegime} (líquido)</div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>R$ {totalFolha.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>{trabFiltro.length} trabalhador(es) • {(() => {
            const p = calcularPeriodo();
            if (p.mesInicio === p.mesFim) return `${p.diaFim - p.diaInicio + 1} dias`;
            return `${p.diaInicio}/${p.mesInicio + 1} a ${p.diaFim}/${p.mesFim + 1}`;
          })()}</div>
          {totalAdiantQuinzena > 0 && (
            <div style={{ fontSize: 11, opacity: 0.95, marginTop: 6, background: "rgba(0,0,0,0.15)", padding: "4px 8px", borderRadius: 6, display: "inline-block" }}>
              💸 Adiantamentos descontados: R$ {totalAdiantQuinzena.toFixed(2)}
            </div>
          )}
        </div>

        {/* Tabela compacta */}
        <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
          <div style={{ background: NAVY, color: "#fff", padding: "8px 12px", fontSize: 11, fontWeight: 700, display: "grid", gridTemplateColumns: "1fr 40px 70px 80px", gap: 6 }}>
            <span>Nome / Cargo</span><span style={{ textAlign: "center" }}>Dias</span><span style={{ textAlign: "right" }}>Diária</span><span style={{ textAlign: "right" }}>Líquido</span>
          </div>
          {trabComMov.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#aaa", fontSize: 13 }}>Sem dias trabalhados nesta quinzena.</div>}
          {trabComMov.map(t => {
            const c = calcular(t);
            return (
              <div key={t.id} style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0", display: "grid", gridTemplateColumns: "1fr 40px 70px 80px", gap: 6, alignItems: "center", fontSize: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 12 }}>{t.nome}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>{t.cargo}{c.feriados > 0 && <span style={{ color: GOLD, fontWeight: 700 }}> • 🎉 {c.feriados} feriado{c.feriados > 1 ? "s" : ""}</span>}{c.adiantDesconto > 0 && <span style={{ color: ORANGE, fontWeight: 700 }}> • Vale R$ {c.adiantDesconto.toFixed(2)}</span>}{c.formaCalculo === "mensal_fixo" && <span style={{ color: "#7c3aed", fontWeight: 700 }}> • Salário fixo</span>}</div>
                </div>
                <div style={{ textAlign: "center", fontWeight: 800, color: NAVY }}>{c.diasPagos}</div>
                <div style={{ textAlign: "right", color: "#666", fontSize: 11 }}>R$ {c.formaCalculo === "mensal_fixo" ? (c.salarioFixo / 30).toFixed(2) : c.diaria.toFixed(2)}</div>
                <div style={{ textAlign: "right", fontWeight: 800, color: GREEN, fontSize: 13 }}>R$ {c.liquido.toFixed(2)}</div>
              </div>
            );
          })}
        </div>

        <div style={{ background: "#f0f7ff", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "#0c4a6e", marginBottom: 8 }}>
          💡 <b>Regime atual:</b> {tipoRegime === "diaria" ? "Diária (1 dia específico)" : tipoRegime === "semanal" ? "Semanal (7 dias)" : tipoRegime === "quinzenal" ? `${quinzena}ª Quinzena (${dia1}-${dia2}/${mes + 1})` : tipoRegime === "mensal" ? "Mensal (mês completo)" : (persInicio && persFim ? `Personalizado (${new Date(persInicio + "T12:00:00").toLocaleDateString("pt-BR")} - ${new Date(persFim + "T12:00:00").toLocaleDateString("pt-BR")})` : "Personalizado (defina as datas acima)")}. Faltas não pagam. Atestados pagam. Adiantamentos descontados no fechamento.
        </div>

        <Btn label="📄 EXPORTAR FOLHA EM PDF" color={GOLD} onClick={exportarPDF} />

        <button onClick={() => {
          if (!confirm(`Salvar folha da ${quinzena}ª quinzena de ${meses[mes]}/${ano} no histórico?`)) return;
          const periodo = `${String(dia1).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}/${ano} a ${String(dia2).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}/${ano}`;
          const itens = trabFiltro.map(t => {
            const c = calcular(t);
            return { trabId: t.id, nome: t.nome, cargo: t.cargo, ...c };
          });
          onSalvarFolha({
            id: Date.now(), mes, ano, quinzena, periodo,
            obraId: obraId === "todas" ? null : parseInt(obraId),
            itens, totalLiquido: totalFolha, totalAdiant: totalAdiantQuinzena,
            ts: Date.now(),
          });
          setSalvoAviso(true);
          setTimeout(() => setSalvoAviso(false), 3000);
        }} style={{ width: "100%", padding: 12, marginTop: 8, background: "#fff", color: NAVY, border: `1.5px solid ${NAVY}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          📥 Arquivar esta folha no histórico
        </button>

        {salvoAviso && (
          <div style={{ background: "#f0fdf4", color: GREEN, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, marginTop: 8, textAlign: "center" }}>
            ✅ Folha salva no histórico!
          </div>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   MOVIMENTAÇÃO DE PESSOAL (com aprovação do gestor)
════════════════════════════════════ */
function TelaSolicitarMov({ obras, trabalhadores, usuario, onBack, onSolicitar }) {
  const [trabId, setTrabId] = useState("");
  const [obraDestino, setObraDestino] = useState("");
  const [tipo, setTipo] = useState("hoje");
  const [motivo, setMotivo] = useState("");
  const [ok, setOk] = useState(false);

  // Encarregado vê todos os trabalhadores (banco geral)
  const obraAtual = obras.find(o => o.id === usuario?.obraId);

  const enviar = () => {
    if (!trabId || !obraDestino) return;
    const t = trabalhadores.find(x => x.id === parseInt(trabId));
    onSolicitar({
      id: Date.now(),
      trabId: parseInt(trabId),
      trabNome: t?.nome,
      obraOrigem: t?.obraId,
      obraDestino: parseInt(obraDestino),
      tipo, motivo,
      solicitante: usuario?.nome,
      status: "Aguardando",
      data: new Date().toLocaleDateString("pt-BR"),
      ts: Date.now(),
    });
    setOk(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Mover Pessoal" sub="Solicitar movimentação" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {ok ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 64 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: GREEN, marginTop: 12 }}>Solicitação Enviada!</div>
            <div style={{ color: "#666", marginTop: 6, fontSize: 13 }}>O gestor receberá o pedido para aprovação.</div>
            <Btn label="Nova Solicitação" color={NAVY} onClick={() => { setOk(false); setTrabId(""); setObraDestino(""); setMotivo(""); }} style={{ marginTop: 24 }} />
            <Btn label="Voltar" color="#eee" text={NAVY} onClick={onBack} style={{ marginTop: 10 }} />
          </div>
        ) : (
          <>
            <div style={{ background: "#fff8e1", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#7b5800", marginBottom: 12 }}>
              ℹ️ A movimentação só será efetivada após aprovação do gestor.
            </div>

            <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <label style={labelS}>Trabalhador (banco geral)</label>
              <select value={trabId} onChange={e => setTrabId(e.target.value)} style={selS}>
                <option value="">Selecione</option>
                {trabalhadores.map(t => {
                  const o = obras.find(x => x.id === t.obraId);
                  return <option key={t.id} value={t.id}>{t.nome} — {t.cargo} ({o?.nome || "sem obra"})</option>;
                })}
              </select>

              <label style={labelS}>Obra de destino</label>
              <select value={obraDestino} onChange={e => setObraDestino(e.target.value)} style={selS}>
                <option value="">Selecione</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>

              <label style={labelS}>Tipo de movimentação</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {[
                  { v: "hoje", l: "Apenas hoje", icon: "📅" },
                  { v: "definitivo", l: "Definitivo", icon: "🔄" },
                ].map(t => (
                  <button key={t.v} onClick={() => setTipo(t.v)} style={{ flex: 1, padding: "12px 8px", borderRadius: 10, border: `2px solid ${tipo === t.v ? NAVY : "#dde2ef"}`, background: tipo === t.v ? "#dde6f5" : "#fff", color: tipo === t.v ? NAVY : "#666", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                    <div style={{ fontSize: 22 }}>{t.icon}</div>
                    {t.l}
                  </button>
                ))}
              </div>

              <label style={labelS}>Motivo</label>
              <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} placeholder="Ex: precisamos de pedreiro extra para concretagem..." style={{ ...inputS, resize: "none", marginBottom: 0 }} />
            </div>

            <Btn label="📤 ENVIAR SOLICITAÇÃO" color={ORANGE} onClick={enviar} />
          </>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   MOVIMENTAÇÃO DE EQUIPAMENTOS — entre obras
════════════════════════════════════ */
/* ════════════════════════════════════
   DETALHE MOV. EQUIPAMENTO/FERRAMENTA — visualização completa
════════════════════════════════════ */
function TelaMovEquipDetalhe({ mov, obras, equips, ferramentas, usuario, onBack, onAprovar, onNegar, onDevolver }) {
  if (!mov) return null;
  const obraOrigem = obras.find(o => o.id === mov.obraOrigemId);
  const obraDestino = obras.find(o => o.id === mov.obraDestinoId);
  const item = mov.tipoItem === "equipamento"
    ? (equips || []).find(x => x.id === mov.itemId)
    : (ferramentas || []).find(x => x.id === mov.itemId);

  const cor = mov.status === "Aguardando" ? ORANGE : mov.status === "Aprovado" ? GREEN : mov.status === "Devolvido" ? BLUE : RED;
  const statusLabel = mov.status === "Aguardando" ? "⏳ Aguardando" : mov.status === "Aprovado" ? "✓ Aprovado" : mov.status === "Devolvido" ? "↩️ Devolvido" : "✕ Negado";

  const prazoInfo = (() => {
    if (!mov.prazo || mov.tipo !== "emprestimo" || mov.status !== "Aprovado") return null;
    const hoje = new Date();
    const prazo = new Date(mov.prazo);
    const dias = Math.ceil((prazo - hoje) / (1000 * 60 * 60 * 24));
    if (dias < 0) return { atrasado: true, dias: Math.abs(dias) };
    if (dias <= 2) return { vencendo: true, dias };
    return { dias };
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Detalhe da Movimentação" sub={mov.status} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* CABEÇALHO */}
        <div style={{ background: `linear-gradient(135deg,${cor},${cor}cc)`, color: "#fff", borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 36, marginRight: 10 }}>{mov.tipoItem === "equipamento" ? "⚙️" : "🔨"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
                {mov.tipoItem === "equipamento" ? "EQUIPAMENTO" : "FERRAMENTA"}
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>{mov.itemNome}</div>
              {mov.itemCodigo && <div style={{ fontSize: 11, opacity: 0.85 }}>{mov.itemCodigo}</div>}
            </div>
            <div style={{ background: "rgba(255,255,255,0.25)", padding: "4px 10px", borderRadius: 10, fontSize: 11, fontWeight: 800 }}>{statusLabel}</div>
          </div>
        </div>

        {/* TIPO DE MOVIMENTAÇÃO */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${BLUE}` }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>📋 Tipo</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>
            {mov.tipo === "emprestimo" ? "🔁 Empréstimo (volta depois)" : "↪️ Transferência (mudança definitiva)"}
          </div>
          {mov.prazo && mov.tipo === "emprestimo" && (
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              📅 Prazo de devolução: <b style={{ color: NAVY }}>{new Date(mov.prazo).toLocaleDateString("pt-BR")}</b>
              {prazoInfo?.atrasado && <span style={{ color: RED, fontWeight: 700 }}> • ⚠️ Atrasado {prazoInfo.dias} dias</span>}
              {prazoInfo?.vencendo && <span style={{ color: ORANGE, fontWeight: 700 }}> • ⏱️ Vence em {prazoInfo.dias} dia(s)</span>}
            </div>
          )}
        </div>

        {/* ROTA */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 8 }}>🔄 Rota da Movimentação</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, background: "#fef9e7", borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 9, color: "#8b6f00", fontWeight: 700, textTransform: "uppercase" }}>📤 Origem</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginTop: 2 }}>{mov.obraOrigemNome}</div>
              {obraOrigem?.local && <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{obraOrigem.local}</div>}
            </div>
            <div style={{ fontSize: 22, color: NAVY }}>→</div>
            <div style={{ flex: 1, background: "#f0fdf4", borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 9, color: "#14532d", fontWeight: 700, textTransform: "uppercase" }}>📥 Destino</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginTop: 2 }}>{mov.obraDestinoNome}</div>
              {obraDestino?.local && <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{obraDestino.local}</div>}
            </div>
          </div>
        </div>

        {/* SOLICITANTE / MOTIVO */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: "#888", fontWeight: 700, textTransform: "uppercase" }}>👷 Solicitante</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{mov.solicitante}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "#888", fontWeight: 700, textTransform: "uppercase" }}>📅 Data</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{mov.dataSolicitacao || "—"}</div>
            </div>
          </div>
          {mov.motivo && (
            <div style={{ background: "#fef9e7", borderRadius: 8, padding: 10, borderLeft: `3px solid ${ORANGE}` }}>
              <div style={{ fontSize: 10, color: "#8b6f00", fontWeight: 700, marginBottom: 2 }}>📝 Motivo / Observação</div>
              <div style={{ fontSize: 12, color: "#444", fontStyle: "italic" }}>"{mov.motivo}"</div>
            </div>
          )}
        </div>

        {/* INFO DO ITEM */}
        {item && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${NAVY}` }}>
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>🔍 Sobre o item</div>
            {item.tipo && <div style={{ fontSize: 11, color: "#666" }}>Tipo: <b style={{ color: NAVY }}>{item.tipo}</b></div>}
            {item.numeroSerie && <div style={{ fontSize: 11, color: "#666" }}>Nº Série: <b style={{ color: NAVY }}>{item.numeroSerie}</b></div>}
            {item.estado && <div style={{ fontSize: 11, color: "#666" }}>Estado: <b style={{ color: NAVY }}>{item.estado}</b></div>}
            {item.obs && <div style={{ fontSize: 11, color: "#666", fontStyle: "italic", marginTop: 4 }}>{item.obs}</div>}
          </div>
        )}

        {/* AÇÕES */}
        {usuario?.perfil === "gestor" && (
          <div style={{ marginTop: 12 }}>
            {mov.status === "Aguardando" && (
              <>
                <button onClick={() => { onAprovar(mov.id); onBack(); }} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14, marginBottom: 8, boxShadow: "0 4px 12px rgba(42,168,79,0.3)" }}>
                  ✓ APROVAR MOVIMENTAÇÃO
                </button>
                <button onClick={() => { confirmar("Negar esta movimentação?", () => { onNegar(mov.id); onBack(); }) }} style={{ width: "100%", padding: 12, borderRadius: 12, border: `1.5px solid ${RED}`, background: "#fff", color: RED, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                  ✕ Negar Movimentação
                </button>
              </>
            )}
            {mov.status === "Aprovado" && mov.tipo === "emprestimo" && (
              <button onClick={() => { confirmar(`Marcar "${mov.itemNome}" como devolvido a ${mov.obraOrigemNome}?`, () => { onDevolver(mov.id); onBack(); }) }} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: BLUE, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14, boxShadow: "0 4px 12px rgba(30,107,191,0.3)" }}>
                ↩️ Marcar como Devolvido
              </button>
            )}
            {mov.status === "Aprovado" && mov.tipo === "transferencia" && (
              <button onClick={() => { confirmar("Confirmar transferência?", () => { onDevolver(mov.id, true); onBack(); }) }} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14, boxShadow: "0 4px 12px rgba(42,168,79,0.3)" }}>
                ✓ Confirmar Recebimento
              </button>
            )}
          </div>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

function TelaMovEquip({ obras, equips, ferramentas, movEquip, usuario, onBack, onSolicitar, onAprovar, onNegar, onDevolver, onVerDetalhe }) {
  const [aba, setAba] = useState("ativas");
  const [modal, setModal] = useState(false);
  const [filtroObra, setFiltroObra] = useState("todas");
  const [form, setForm] = useState({
    tipoItem: "equipamento",
    itemId: "",
    obraDestino: "",
    tipo: "emprestimo",
    prazo: "",
    motivo: "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const itens = form.tipoItem === "equipamento" ? (equips || []) : (ferramentas || []);
  const itemEscolhido = itens.find(x => x.id === parseInt(form.itemId));
  const obraOrigem = itemEscolhido ? obras.find(o => o.id === itemEscolhido.obraId) : null;

  const enviar = () => {
    if (!form.itemId || !form.obraDestino) { alert("Selecione o item e a obra destino"); return; }
    if (form.tipo === "emprestimo" && !form.prazo) { alert("Defina o prazo de devolução"); return; }
    onSolicitar({
      id: Date.now(),
      tipoItem: form.tipoItem,
      itemId: parseInt(form.itemId),
      itemNome: itemEscolhido.nome,
      itemCodigo: itemEscolhido.codigo || "",
      obraOrigemId: itemEscolhido.obraId,
      obraOrigemNome: obraOrigem?.nome,
      obraDestinoId: parseInt(form.obraDestino),
      obraDestinoNome: obras.find(o => o.id === parseInt(form.obraDestino))?.nome,
      tipo: form.tipo,
      prazo: form.prazo,
      motivo: form.motivo,
      solicitante: usuario?.nome || "—",
      solicitantePerfil: usuario?.perfil || "—",
      status: usuario?.perfil === "gestor" ? "Aprovado" : "Aguardando",
      data: new Date().toLocaleDateString("pt-BR"),
      ts: Date.now(),
    });
    setForm({ tipoItem: "equipamento", itemId: "", obraDestino: "", tipo: "emprestimo", prazo: "", motivo: "" });
    setModal(false);
  };

  const lista = (movEquip || []).filter(m => {
    if (aba === "ativas") return m.status === "Aguardando" || m.status === "Aprovado" || m.status === "Em trânsito";
    return m.status === "Devolvido" || m.status === "Concluído" || m.status === "Negado";
  }).filter(m => filtroObra === "todas" || m.obraOrigemId === parseInt(filtroObra) || m.obraDestinoId === parseInt(filtroObra));

  const aguardando = (movEquip || []).filter(m => m.status === "Aguardando").length;
  const aprovadas = (movEquip || []).filter(m => m.status === "Aprovado").length;

  const checaPrazo = (m) => {
    if (m.tipo !== "emprestimo" || !m.prazo || m.status !== "Aprovado") return null;
    try {
      const fim = new Date(m.prazo);
      const dias = Math.ceil((fim - new Date()) / (1000 * 60 * 60 * 24));
      if (dias < 0) return { atrasado: true, dias: Math.abs(dias) };
      if (dias <= 2) return { vencendo: true, dias };
      return { ok: true, dias };
    } catch { return null; }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Mov. Equipamentos" sub="Empréstimos e transferências" onBack={onBack} />

      <div style={{ display: "flex", gap: 6, padding: "10px 12px 0", background: "#fff" }}>
        <div style={{ flex: 1, background: "#fff8f0", border: `1px solid ${ORANGE}33`, borderRadius: 8, padding: 8, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: ORANGE }}>{aguardando}</div>
          <div style={{ fontSize: 9, color: "#666" }}>Aguardando</div>
        </div>
        <div style={{ flex: 1, background: "#f0fdf4", border: `1px solid ${GREEN}33`, borderRadius: 8, padding: 8, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: GREEN }}>{aprovadas}</div>
          <div style={{ fontSize: 9, color: "#666" }}>Em uso</div>
        </div>
      </div>

      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #e5e7eb", paddingTop: 6 }}>
        {[
          { v: "ativas", l: "🔄 Ativas" },
          { v: "historico", l: "📜 Histórico" },
        ].map(a => (
          <button key={a.v} onClick={() => setAba(a.v)} style={{
            flex: 1, padding: "10px 0", background: "none", border: "none",
            borderBottom: aba === a.v ? `3px solid ${NAVY}` : "3px solid transparent",
            color: aba === a.v ? NAVY : "#888", fontWeight: aba === a.v ? 800 : 600, fontSize: 12, cursor: "pointer"
          }}>{a.l}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 12 }}>
        <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ ...selS, marginBottom: 10 }}>
          <option value="todas">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <Btn label="➕ Solicitar Movimentação" color={NAVY} onClick={() => setModal(true)} style={{ marginBottom: 12 }} />

        {lista.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, textAlign: "center", color: "#aaa" }}>
            {aba === "ativas" ? "Nenhuma movimentação ativa." : "Nenhuma movimentação no histórico."}
          </div>
        ) : lista.map(m => {
          const prazoInfo = checaPrazo(m);
          const cor = m.status === "Aguardando" ? ORANGE
            : m.status === "Aprovado" && prazoInfo?.atrasado ? RED
            : m.status === "Aprovado" && prazoInfo?.vencendo ? ORANGE
            : m.status === "Aprovado" ? GREEN
            : m.status === "Devolvido" || m.status === "Concluído" ? "#888"
            : m.status === "Negado" ? RED
            : "#888";
          return (
            <div key={m.id} onClick={() => onVerDetalhe && onVerDetalhe(m)} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${cor}`, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontSize: 24, marginRight: 10 }}>{m.tipoItem === "equipamento" ? "⚙️" : "🔨"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: NAVY, fontSize: 13 }}>
                    {m.itemNome}
                    {m.itemCodigo && <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>{m.itemCodigo}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                    📤 {m.obraOrigemNome} <span style={{ color: NAVY }}>→</span> 📥 {m.obraDestinoNome}
                  </div>
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                    {m.tipo === "emprestimo" ? "🔁 Empréstimo" : "↪️ Transferência"}
                    {m.prazo && m.tipo === "emprestimo" && <span> • Prazo: {new Date(m.prazo).toLocaleDateString("pt-BR")}</span>}
                    <span> • {m.solicitante}</span>
                  </div>
                  {m.motivo && <div style={{ fontSize: 11, color: "#777", fontStyle: "italic", marginTop: 4 }}>"{m.motivo}"</div>}
                  {prazoInfo?.atrasado && (
                    <div style={{ fontSize: 11, color: RED, fontWeight: 700, marginTop: 4 }}>⚠️ Atrasado há {prazoInfo.dias} dia(s)</div>
                  )}
                  {prazoInfo?.vencendo && (
                    <div style={{ fontSize: 11, color: ORANGE, fontWeight: 700, marginTop: 4 }}>⏱️ Vence em {prazoInfo.dias} dia(s)</div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Badge label={m.status} color={cor} small />
                  <span style={{ color: "#bbb", fontSize: 16 }}>›</span>
                </div>
              </div>

              {m.status === "Aguardando" && usuario?.perfil === "gestor" && (
                <div style={{ display: "flex", gap: 6, marginTop: 8 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => onAprovar(m.id)} style={{ flex: 1, background: GREEN, color: "#fff", border: "none", borderRadius: 8, padding: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>✓ Aprovar</button>
                  <button onClick={() => { confirmar("Negar esta movimentação?", () => { onNegar(m.id); }); }} style={{ flex: 1, background: RED, color: "#fff", border: "none", borderRadius: 8, padding: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>✕ Negar</button>
                </div>
              )}
              {m.status === "Aprovado" && m.tipo === "emprestimo" && (
                <button onClick={(e) => { e.stopPropagation(); confirmar(`Marcar "${m.itemNome}" como devolvido a ${m.obraOrigemNome}?`, () => { onDevolver(m.id); }); }} style={{ width: "100%", marginTop: 8, background: BLUE, color: "#fff", border: "none", borderRadius: 8, padding: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>↩️ Marcar como Devolvido</button>
              )}
              {m.status === "Aprovado" && m.tipo === "transferencia" && (
                <button onClick={(e) => { e.stopPropagation(); confirmar("Concluir transferência?", () => { onDevolver(m.id, true); }); }} style={{ width: "100%", marginTop: 8, background: GREEN, color: "#fff", border: "none", borderRadius: 8, padding: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>✓ Confirmar Recebimento</button>
              )}
            </div>
          );
        })}
      </div>
      <KMFooter />

      <Modal show={modal} title="Movimentar Equipamento" onClose={() => setModal(false)}>
        <label style={labelS}>Tipo de item</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[
            { v: "equipamento", l: "⚙️ Equipamento" },
            { v: "ferramenta", l: "🔨 Ferramenta" },
          ].map(t => (
            <button key={t.v} onClick={() => { set("tipoItem", t.v); set("itemId", ""); }} style={{ flex: 1, padding: "10px 4px", borderRadius: 10, border: `2px solid ${form.tipoItem === t.v ? NAVY : "#dde2ef"}`, background: form.tipoItem === t.v ? "#dde6f5" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, color: form.tipoItem === t.v ? NAVY : "#666" }}>{t.l}</button>
          ))}
        </div>

        <label style={labelS}>Selecione o item</label>
        <select value={form.itemId} onChange={e => set("itemId", e.target.value)} style={selS}>
          <option value="">— Selecione —</option>
          {itens.map(i => {
            const o = obras.find(x => x.id === i.obraId);
            return <option key={i.id} value={i.id}>{i.nome} {i.codigo ? "(" + i.codigo + ")" : ""} • {o?.nome?.substring(0, 25) || "?"}</option>;
          })}
        </select>

        {itemEscolhido && obraOrigem && (
          <div style={{ background: "#f0f7ff", borderRadius: 8, padding: 10, fontSize: 11, color: NAVY, marginBottom: 10 }}>
            📍 Atualmente na obra: <b>{obraOrigem.nome}</b>
          </div>
        )}

        <label style={labelS}>Obra de destino</label>
        <select value={form.obraDestino} onChange={e => set("obraDestino", e.target.value)} style={selS}>
          <option value="">— Selecione —</option>
          {obras.filter(o => itemEscolhido ? o.id !== itemEscolhido.obraId : true).map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <label style={labelS}>Tipo de movimentação</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[
            { v: "emprestimo", l: "🔁 Empréstimo", desc: "Volta depois" },
            { v: "transferencia", l: "↪️ Transferência", desc: "Definitiva" },
          ].map(t => (
            <button key={t.v} onClick={() => set("tipo", t.v)} style={{ flex: 1, padding: "10px 6px", borderRadius: 10, border: `2px solid ${form.tipo === t.v ? NAVY : "#dde2ef"}`, background: form.tipo === t.v ? "#dde6f5" : "#fff", cursor: "pointer", color: form.tipo === t.v ? NAVY : "#666", textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{t.l}</div>
              <div style={{ fontSize: 9, opacity: 0.7 }}>{t.desc}</div>
            </button>
          ))}
        </div>

        {form.tipo === "emprestimo" && (
          <>
            <label style={labelS}>Prazo de devolução</label>
            <input value={form.prazo} onChange={e => set("prazo", e.target.value)} type="date" style={inputS} />
          </>
        )}

        <label style={labelS}>Motivo (opcional)</label>
        <input value={form.motivo} onChange={e => set("motivo", e.target.value)} placeholder="Ex: precisa pra concretar a laje" style={inputS} />

        {usuario?.perfil === "gestor" && (
          <div style={{ background: "#f0fdf4", borderRadius: 8, padding: 8, fontSize: 11, color: GREEN, marginBottom: 10 }}>
            ✅ Por ser gestor, esta movimentação será aprovada automaticamente.
          </div>
        )}
        {usuario?.perfil === "encarregado" && (
          <div style={{ background: "#fff8f0", borderRadius: 8, padding: 8, fontSize: 11, color: ORANGE, marginBottom: 10 }}>
            ⏳ Aguardará aprovação do gestor antes de ser confirmada.
          </div>
        )}

        <Btn label="✓ SOLICITAR" color={GREEN} onClick={enviar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   DETALHE MOV. PESSOAL — visualização completa
════════════════════════════════════ */
function TelaMovPessoalDetalhe({ mov, obras, trabalhadores, onBack, onAprovar, onNegar }) {
  if (!mov) return null;
  const trab = trabalhadores.find(t => t.id === mov.trabId);
  const oOrigem = obras.find(o => o.id === mov.obraOrigem);
  const oDestino = obras.find(o => o.id === mov.obraDestino);
  const cor = mov.status === "Aprovado" ? GREEN : mov.status === "Negado" ? RED : ORANGE;
  const statusLabel = mov.status === "Aguardando" ? "⏳ Aguardando" : mov.status === "Aprovado" ? "✓ Aprovado" : "✕ Negado";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Detalhe Movimentação" sub={mov.status} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* CABEÇALHO */}
        <div style={{ background: `linear-gradient(135deg,${cor},${cor}cc)`, color: "#fff", borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 36, marginRight: 10 }}>👷</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>TRABALHADOR</div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>{mov.trabNome}</div>
              {trab?.funcao && <div style={{ fontSize: 11, opacity: 0.85 }}>{trab.funcao}</div>}
            </div>
            <div style={{ background: "rgba(255,255,255,0.25)", padding: "4px 10px", borderRadius: 10, fontSize: 11, fontWeight: 800 }}>{statusLabel}</div>
          </div>
        </div>

        {/* TIPO */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${BLUE}` }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>📋 Tipo</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>
            {mov.tipo === "hoje" ? "📅 Apenas hoje" : "🔄 Mudança definitiva"}
          </div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
            {mov.tipo === "hoje" ? "O trabalhador volta pra obra original amanhã" : "O trabalhador troca de obra permanentemente"}
          </div>
        </div>

        {/* ROTA */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 8 }}>🔄 De / Para</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, background: "#fef9e7", borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 9, color: "#8b6f00", fontWeight: 700, textTransform: "uppercase" }}>📤 Saindo de</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginTop: 2 }}>{oOrigem?.nome || "—"}</div>
              {oOrigem?.local && <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{oOrigem.local}</div>}
            </div>
            <div style={{ fontSize: 22, color: NAVY }}>→</div>
            <div style={{ flex: 1, background: "#f0fdf4", borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 9, color: "#14532d", fontWeight: 700, textTransform: "uppercase" }}>📥 Indo para</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginTop: 2 }}>{oDestino?.nome || "—"}</div>
              {oDestino?.local && <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{oDestino.local}</div>}
            </div>
          </div>
        </div>

        {/* SOLICITANTE / DATA / MOTIVO */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: "#888", fontWeight: 700, textTransform: "uppercase" }}>👷 Solicitante</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{mov.solicitante}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "#888", fontWeight: 700, textTransform: "uppercase" }}>📅 Data</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{mov.data}</div>
            </div>
          </div>
          {mov.motivo && (
            <div style={{ background: "#fef9e7", borderRadius: 8, padding: 10, borderLeft: `3px solid ${ORANGE}` }}>
              <div style={{ fontSize: 10, color: "#8b6f00", fontWeight: 700, marginBottom: 2 }}>📝 Motivo</div>
              <div style={{ fontSize: 12, color: "#444", fontStyle: "italic" }}>"{mov.motivo}"</div>
            </div>
          )}
        </div>

        {/* INFO TRABALHADOR */}
        {trab && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${NAVY}` }}>
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>👤 Sobre o trabalhador</div>
            {trab.funcao && <div style={{ fontSize: 11, color: "#666" }}>Função: <b style={{ color: NAVY }}>{trab.funcao}</b></div>}
            {trab.diaria && <div style={{ fontSize: 11, color: "#666" }}>Diária: <b style={{ color: GREEN }}>R$ {parseFloat(trab.diaria).toFixed(2)}</b></div>}
            {trab.tel && <div style={{ fontSize: 11, color: "#666" }}>📞 {trab.tel}</div>}
          </div>
        )}

        {/* AÇÕES */}
        {mov.status === "Aguardando" && (
          <div style={{ marginTop: 12 }}>
            <button onClick={() => { onAprovar(mov); onBack(); }} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14, marginBottom: 8, boxShadow: "0 4px 12px rgba(42,168,79,0.3)" }}>
              ✓ APROVAR MOVIMENTAÇÃO
            </button>
            <button onClick={() => { confirmar("Negar esta movimentação?", () => { onNegar(mov.id); onBack(); }) }} style={{ width: "100%", padding: 12, borderRadius: 12, border: `1.5px solid ${RED}`, background: "#fff", color: RED, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              ✕ Negar Movimentação
            </button>
          </div>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

function TelaAprovarMov({ obras, trabalhadores, movimentacoes, onBack, onAprovar, onNegar, onVerDetalhe }) {
  const [filtro, setFiltro] = useState("Aguardando");
  const lista = filtro === "todas" ? movimentacoes : movimentacoes.filter(m => m.status === filtro);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Movimentações" sub="Aprovar mudanças de equipe" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <select value={filtro} onChange={e => setFiltro(e.target.value)} style={{ ...selS, marginBottom: 12 }}>
          <option value="Aguardando">Aguardando</option>
          <option value="Aprovado">Aprovadas</option>
          <option value="Negado">Negadas</option>
          <option value="todas">Todas</option>
        </select>

        {lista.length === 0 && <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", color: "#aaa" }}>Nenhuma solicitação.</div>}

        {lista.map(m => {
          const oOrigem = obras.find(o => o.id === m.obraOrigem);
          const oDestino = obras.find(o => o.id === m.obraDestino);
          const cor = m.status === "Aprovado" ? GREEN : m.status === "Negado" ? RED : ORANGE;
          return (
            <div key={m.id} onClick={() => onVerDetalhe && onVerDetalhe(m)} style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${cor}`, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>👷 {m.trabNome}</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Solicitado por {m.solicitante} • {m.data}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Badge label={m.status} color={cor} small />
                  <span style={{ color: "#bbb", fontSize: 16 }}>›</span>
                </div>
              </div>

              <div style={{ background: "#f5f8fc", borderRadius: 8, padding: "8px 10px", fontSize: 12, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#888" }}>{oOrigem?.nome || "—"}</span>
                  <span style={{ color: NAVY, fontSize: 16 }}>→</span>
                  <span style={{ color: NAVY, fontWeight: 700 }}>{oDestino?.nome}</span>
                </div>
                <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                  {m.tipo === "hoje" ? "📅 Apenas hoje" : "🔄 Mudança definitiva"}
                </div>
              </div>

              {m.motivo && <div style={{ fontSize: 12, color: "#555", fontStyle: "italic", marginBottom: 8 }}>"{m.motivo}"</div>}

              {m.status === "Aguardando" && (
                <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => onNegar(m.id)} style={{ flex: 1, padding: 9, borderRadius: 8, border: "none", background: RED, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>✕ NEGAR</button>
                  <button onClick={() => onAprovar(m)} style={{ flex: 1, padding: 9, borderRadius: 8, border: "none", background: GREEN, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>✓ APROVAR</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   FERRAMENTAS (inchada, enxadão, carrinho, etc.)
════════════════════════════════════ */
function TelaFerramentas({ obras, ferramentas, onBack, onAdd, onEditar, onRemover }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [filtroObra, setFiltroObra] = useState("todas");
  const [form, setForm] = useState({ nome: "", quantidade: 1, obraId: "", estado: "Bom", icon: "🔨" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const ICONS = ["🔨", "🪓", "⛏️", "🧰", "🪛", "🚿", "🛒", "🪣", "🧱", "📐", "🪜", "🔗"];
  const SUGEST = ["Inchada", "Enxadão", "Carrinho de mão", "Pá", "Picareta", "Marreta", "Martelo", "Talhadeira", "Trena", "Nível", "Prumo", "Linha", "Colher de pedreiro", "Desempenadeira", "Régua"];

  const lista = filtroObra === "todas" ? ferramentas : ferramentas.filter(f => f.obraId === parseInt(filtroObra));

  const abrirNovo = () => { setEditandoId(null); setForm({ nome: "", quantidade: 1, obraId: "", estado: "Bom", icon: "🔨" }); setModal(true); };
  const abrirEdit = (f) => { setEditandoId(f.id); setForm(f); setModal(true); };
  const salvar = () => {
    if (!form.nome || !form.obraId) return;
    if (editandoId) onEditar({ ...form, id: editandoId, obraId: parseInt(form.obraId), quantidade: parseInt(form.quantidade) || 1 });
    else onAdd({ ...form, id: Date.now(), obraId: parseInt(form.obraId), quantidade: parseInt(form.quantidade) || 1 });
    setModal(false);
  };

  const COR_ESTADO = { "Bom": GREEN, "Desgastado": ORANGE, "Quebrado": RED };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Ferramentas" sub="Manuais e elétricas" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 12 }}>
        <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ ...selS, marginBottom: 12 }}>
          <option value="todas">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        {lista.map(f => {
          const obra = obras.find(o => o.id === f.obraId);
          return (
            <div key={f.id} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 28, marginRight: 12 }}>{f.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{f.nome} <span style={{ background: "#dde6f5", color: NAVY, padding: "1px 8px", borderRadius: 8, fontSize: 11, marginLeft: 4 }}>×{f.quantidade}</span></div>
                <div style={{ fontSize: 11, color: "#888" }}>📍 {obra?.nome}</div>
              </div>
              <Badge label={f.estado} color={COR_ESTADO[f.estado] || "#888"} small />
              <button onClick={() => abrirEdit(f)} style={{ background: "none", border: "none", color: BLUE, fontSize: 16, marginLeft: 8, cursor: "pointer" }}>✏️</button>
              <button onClick={() => onRemover(f.id)} style={{ background: "#fee2e2", border: "2px solid #d63b3b", color: "#d63b3b", fontSize: 16, marginLeft: 4, cursor: "pointer", padding: "6px 10px", borderRadius: 8, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>
            </div>
          );
        })}
        {lista.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: 20 }}>Nenhuma ferramenta cadastrada.</div>}
        <Btn label="➕ Adicionar Ferramenta" color={NAVY} onClick={abrirNovo} style={{ marginTop: 8 }} />
      </div>
      <KMFooter />

      <Modal show={modal} title={editandoId ? "Editar Ferramenta" : "Nova Ferramenta"} onClose={() => setModal(false)}>
        <label style={labelS}>Nome</label>
        <input value={form.nome} onChange={e => set("nome", e.target.value)} list="sugest-ferr" placeholder="Ex: Inchada, Carrinho de mão..." style={inputS} />
        <datalist id="sugest-ferr">{SUGEST.map(s => <option key={s} value={s} />)}</datalist>

        <label style={labelS}>Quantidade</label>
        <input value={form.quantidade} onChange={e => set("quantidade", e.target.value)} type="number" min="1" style={inputS} />

        <label style={labelS}>Obra</label>
        <select value={form.obraId} onChange={e => set("obraId", e.target.value)} style={selS}>
          <option value="">Selecione</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <label style={labelS}>Estado</label>
        <select value={form.estado} onChange={e => set("estado", e.target.value)} style={selS}>
          <option>Bom</option><option>Desgastado</option><option>Quebrado</option>
        </select>

        <label style={labelS}>Ícone</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {ICONS.map(i => (
            <button key={i} onClick={() => set("icon", i)} style={{ width: 40, height: 40, fontSize: 22, border: form.icon === i ? `2px solid ${NAVY}` : "1px solid #ddd", borderRadius: 8, background: form.icon === i ? "#dde6f5" : "#fff", cursor: "pointer" }}>{i}</button>
          ))}
        </div>

        <Btn label={editandoId ? "SALVAR" : "ADICIONAR"} color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   RH: ANIVERSARIANTES & EPI PENDENTE
════════════════════════════════════ */
function TelaRH({ obras, trabalhadores, onBack, onVerTrabalhador }) {
  const [aba, setAba] = useState("aniversarios");

  // Aniversariantes do mês atual
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const aniversariantes = trabalhadores.filter(t => {
    if (!t.nasc) return false;
    try {
      const partes = t.nasc.includes("/") ? t.nasc.split("/") : t.nasc.split("-").reverse();
      const m = parseInt(partes[1]) - 1;
      return m === mesAtual;
    } catch { return false; }
  }).map(t => {
    const partes = t.nasc.includes("/") ? t.nasc.split("/") : t.nasc.split("-").reverse();
    const dia = parseInt(partes[0]);
    return { ...t, dia };
  }).sort((a, b) => a.dia - b.dia);

  // EPI pendente
  const epiPendente = trabalhadores.filter(t => !t.epiEntregue);
  const epiEntregue = trabalhadores.filter(t => t.epiEntregue);

  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="RH" sub="Aniversários e EPI" onBack={onBack} />
      <div style={{ display: "flex", gap: 0, background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        {[
          { v: "aniversarios", l: "🎂 Aniversários", n: aniversariantes.length },
          { v: "epi", l: "👕 EPI", n: epiPendente.length },
        ].map(a => (
          <button key={a.v} onClick={() => setAba(a.v)} style={{
            flex: 1, padding: "12px 0", background: "none", border: "none",
            borderBottom: aba === a.v ? `3px solid ${NAVY}` : "3px solid transparent",
            color: aba === a.v ? NAVY : "#888", fontWeight: aba === a.v ? 800 : 600, fontSize: 13, cursor: "pointer"
          }}>
            {a.l} {a.n > 0 && <span style={{ background: aba === a.v ? NAVY : "#ccc", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, marginLeft: 4 }}>{a.n}</span>}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {aba === "aniversarios" && (
          <>
            <div style={{ background: `linear-gradient(135deg,#fbbf24,#f59e0b)`, borderRadius: 14, padding: 14, marginBottom: 12, color: "#fff", boxShadow: "0 4px 14px #f59e0b44" }}>
              <div style={{ fontSize: 11, opacity: 0.9 }}>Aniversariantes</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>🎂 {meses[mesAtual]}</div>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>{aniversariantes.length} colaborador(es) este mês</div>
            </div>

            {aniversariantes.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 12, padding: 24, textAlign: "center", color: "#aaa" }}>
                Nenhum aniversariante em {meses[mesAtual]}.
              </div>
            ) : aniversariantes.map(t => {
              const obra = obras.find(o => o.id === t.obraId);
              const eHoje = t.dia === hoje.getDate();
              return (
                <div key={t.id} onClick={() => onVerTrabalhador(t)} style={{ background: eHoje ? "#fef3c7" : "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer", borderLeft: `4px solid ${eHoje ? "#f59e0b" : "#fbbf24"}` }}>
                  <div style={{ width: 50, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: eHoje ? "#92400e" : NAVY }}>{String(t.dia).padStart(2, "0")}</div>
                    <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase" }}>{meses[mesAtual].slice(0, 3)}</div>
                  </div>
                  <div style={{ flex: 1, marginLeft: 10 }}>
                    <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>
                      {eHoje && "🎉 "}{t.nome}
                    </div>
                    <div style={{ fontSize: 11, color: "#888" }}>{t.cargo} • {obra?.nome}</div>
                    {t.tel && (
                      <a href={`https://wa.me/55${t.tel.replace(/\D/g, "")}?text=Parab%C3%A9ns%20pelo%20seu%20anivers%C3%A1rio!`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: "#25D366", fontWeight: 700, textDecoration: "none" }}>💬 Mandar parabéns no WhatsApp</a>
                    )}
                  </div>
                  <span style={{ color: "#ccc", fontSize: 18 }}>›</span>
                </div>
              );
            })}
          </>
        )}

        {aba === "epi" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, background: GREEN, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{epiEntregue.length}</div>
                <div style={{ fontSize: 10 }}>EPI Entregue</div>
              </div>
              <div style={{ flex: 1, background: RED, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{epiPendente.length}</div>
                <div style={{ fontSize: 10 }}>Pendentes</div>
              </div>
            </div>

            {epiPendente.length > 0 && <>
              <div style={{ fontWeight: 700, color: RED, marginBottom: 8, fontSize: 13 }}>⚠️ EPI Pendente de Entrega</div>
              {epiPendente.map(t => {
                const obra = obras.find(o => o.id === t.obraId);
                const tamanhos = [t.tamCamisa && `Camisa ${t.tamCamisa}`, t.tamCalca && `Calça ${t.tamCalca}`, t.tamBota && `Bota ${t.tamBota}`].filter(Boolean).join(" • ");
                return (
                  <div key={t.id} onClick={() => onVerTrabalhador(t)} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer", borderLeft: `4px solid ${RED}` }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 17, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginRight: 10 }}>👷</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{t.nome}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>{t.cargo} • {obra?.nome}</div>
                        {tamanhos && <div style={{ fontSize: 10, color: BLUE, marginTop: 2 }}>{tamanhos}</div>}
                        {!tamanhos && <div style={{ fontSize: 10, color: ORANGE, marginTop: 2 }}>⚠️ Tamanhos não cadastrados</div>}
                      </div>
                      <span style={{ color: "#ccc", fontSize: 18 }}>›</span>
                    </div>
                  </div>
                );
              })}
            </>}

            {epiEntregue.length > 0 && <>
              <div style={{ fontWeight: 700, color: GREEN, marginBottom: 8, fontSize: 13, marginTop: 14 }}>✅ EPI Entregue</div>
              {epiEntregue.map(t => {
                const obra = obras.find(o => o.id === t.obraId);
                return (
                  <div key={t.id} onClick={() => onVerTrabalhador(t)} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer", borderLeft: `4px solid ${GREEN}` }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 17, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginRight: 10 }}>👷</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{t.nome}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>{t.cargo} • {obra?.nome}</div>
                        {t.epiData && <div style={{ fontSize: 10, color: GREEN, marginTop: 2 }}>📅 Entregue em {new Date(t.epiData).toLocaleDateString("pt-BR")}</div>}
                      </div>
                      <span style={{ color: "#ccc", fontSize: 18 }}>›</span>
                    </div>
                  </div>
                );
              })}
            </>}
          </>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   LINKS ÚTEIS — atalhos para sites externos
════════════════════════════════════ */
const LINKS_PADRAO = [
  { id: 1, nome: "Calculadora de Concreto", url: "https://www.google.com/search?q=calculadora+de+concreto", icon: "🧮", cat: "Cálculos" },
  { id: 2, nome: "Conversor m² / m³",       url: "https://www.google.com/search?q=conversor+metro+quadrado+cubico", icon: "📐", cat: "Cálculos" },
  { id: 3, nome: "Cotação de Materiais",    url: "https://www.google.com/search?q=cotacao+material+construcao", icon: "💰", cat: "Materiais" },
  { id: 4, nome: "NBR 6118 (Concreto)",     url: "https://www.google.com/search?q=NBR+6118+concreto", icon: "📜", cat: "Normas" },
  { id: 5, nome: "Tabela TCPO",             url: "https://www.google.com/search?q=tabela+TCPO", icon: "📊", cat: "Cálculos" },
  { id: 6, nome: "WhatsApp Web",            url: "https://web.whatsapp.com", icon: "💬", cat: "Comunicação" },
  { id: 7, nome: "Google Maps",             url: "https://maps.google.com", icon: "🗺️", cat: "Comunicação" },
  { id: 8, nome: "Receita Federal CNPJ",    url: "https://servicos.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp", icon: "🏛️", cat: "Documentos" },
];

function TelaLinks({ links, onBack, onAdd, onRemover }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nome: "", url: "", icon: "🔗", cat: "Geral" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Agrupar por categoria
  const grupos = {};
  links.forEach(l => { (grupos[l.cat] = grupos[l.cat] || []).push(l); });

  const ICONS = ["🔗", "🧮", "📐", "💰", "📜", "📊", "💬", "🗺️", "🏛️", "📋", "📞", "📧", "🌐", "⚙️", "📚"];
  const CATEGORIAS = ["Cálculos", "Materiais", "Normas", "Comunicação", "Documentos", "Fornecedores", "Geral"];

  const salvar = () => {
    if (!form.nome || !form.url) return;
    let url = form.url.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    onAdd({ id: Date.now(), ...form, url });
    setForm({ nome: "", url: "", icon: "🔗", cat: "Geral" });
    setModal(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Links Úteis" sub="Atalhos para ferramentas externas" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {Object.keys(grupos).length === 0 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 30, textAlign: "center", color: "#aaa" }}>
            🔗 Nenhum link cadastrado.<br /><span style={{ fontSize: 11 }}>Toque em "Adicionar" para começar.</span>
          </div>
        )}
        {Object.entries(grupos).map(([cat, itens]) => (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>{cat}</div>
            {itens.map(l => (
              <a key={l.id} href={l.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <div style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 6, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer" }}>
                  <div style={{ fontSize: 26, marginRight: 12 }}>{l.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{l.nome}</div>
                    <div style={{ fontSize: 10, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.url}</div>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); confirmar(`Remover "${l.nome}"?`, () => { onRemover(l.id); }); }} style={{ background: "#fee2e2", border: "2px solid #d63b3b", color: "#d63b3b", cursor: "pointer", fontSize: 16, marginRight: 4, padding: "6px 10px", borderRadius: 8, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>
                  <span style={{ color: BLUE, fontSize: 16 }}>↗</span>
                </div>
              </a>
            ))}
          </div>
        ))}

        <Btn label="➕ Adicionar Link" color={NAVY} onClick={() => setModal(true)} style={{ marginTop: 8 }} />
      </div>
      <KMFooter />

      <Modal show={modal} title="Novo Link" onClose={() => setModal(false)}>
        <label style={labelS}>Nome</label>
        <input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex: Cotação Concreto Fácil" style={inputS} />
        <label style={labelS}>URL (link)</label>
        <input value={form.url} onChange={e => set("url", e.target.value)} placeholder="https://exemplo.com.br" style={inputS} />
        <label style={labelS}>Categoria</label>
        <select value={form.cat} onChange={e => set("cat", e.target.value)} style={selS}>
          {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
        </select>
        <label style={labelS}>Ícone</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {ICONS.map(i => (
            <button key={i} onClick={() => set("icon", i)} style={{ width: 40, height: 40, fontSize: 20, border: form.icon === i ? `2px solid ${NAVY}` : "1px solid #ddd", borderRadius: 8, background: form.icon === i ? "#dde6f5" : "#fff", cursor: "pointer" }}>{i}</button>
          ))}
        </div>
        <Btn label="✓ ADICIONAR" color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   CONTATOS — Lista telefônica rápida
════════════════════════════════════ */
function TelaContatos({ obras, trabalhadores, usuarios, onBack, onVerTrabalhador }) {
  const [busca, setBusca] = useState("");
  const [filtroObra, setFiltroObra] = useState("todas");
  const [aba, setAba] = useState("trabalhadores"); // trabalhadores | encarregados

  const lista = aba === "trabalhadores"
    ? trabalhadores.filter(t => t.tel)
    : usuarios.filter(u => u.perfil === "encarregado" && u.tel);

  const filtrados = lista.filter(p => {
    const passaObra = filtroObra === "todas" || p.obraId === parseInt(filtroObra);
    const passaBusca = !busca || p.nome.toLowerCase().includes(busca.toLowerCase()) || (p.cargo || "").toLowerCase().includes(busca.toLowerCase());
    return passaObra && passaBusca;
  });

  // Agrupar por obra
  const grupos = {};
  filtrados.forEach(p => {
    const obra = obras.find(o => o.id === p.obraId);
    const nomeObra = obra?.nome || "Sem obra";
    (grupos[nomeObra] = grupos[nomeObra] || []).push(p);
  });

  const limparTel = (tel) => tel?.replace(/\D/g, "") || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Contatos" sub="Lista telefônica" onBack={onBack} />
      <div style={{ display: "flex", gap: 0, background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        {[
          { v: "trabalhadores", l: "👷 Trabalhadores", n: trabalhadores.filter(t => t.tel).length },
          { v: "encarregados", l: "🏢 Encarregados", n: usuarios.filter(u => u.perfil === "encarregado" && u.tel).length },
        ].map(a => (
          <button key={a.v} onClick={() => setAba(a.v)} style={{
            flex: 1, padding: "12px 0", background: "none", border: "none",
            borderBottom: aba === a.v ? `3px solid ${NAVY}` : "3px solid transparent",
            color: aba === a.v ? NAVY : "#888", fontWeight: aba === a.v ? 800 : 600, fontSize: 13, cursor: "pointer"
          }}>
            {a.l} <span style={{ background: aba === a.v ? NAVY : "#ccc", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, marginLeft: 4 }}>{a.n}</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por nome ou cargo..." style={inputS} />

        {aba === "trabalhadores" && (
          <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ ...selS, marginBottom: 12 }}>
            <option value="todas">Todas as obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        )}

        {filtrados.length === 0 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 30, textAlign: "center", color: "#aaa" }}>
            📞 {lista.length === 0 ? "Nenhum contato com telefone cadastrado." : "Nenhum resultado para a busca."}
          </div>
        )}

        {Object.entries(grupos).map(([nomeObra, pessoas]) => (
          <div key={nomeObra} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>📍 {nomeObra}</div>
            {pessoas.map(p => {
              const tel = limparTel(p.tel);
              return (
                <div key={p.id} style={{ background: "#fff", borderRadius: 12, padding: "10px 12px", marginBottom: 6, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
                  <div onClick={() => onVerTrabalhador && aba === "trabalhadores" && onVerTrabalhador(p)} style={{ width: 38, height: 38, borderRadius: 19, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginRight: 10, cursor: aba === "trabalhadores" ? "pointer" : "default" }}>
                    {aba === "trabalhadores" ? "👷" : "🏢"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }} onClick={() => onVerTrabalhador && aba === "trabalhadores" && onVerTrabalhador(p)}>
                    <div style={{ fontWeight: 700, color: NAVY, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{p.cargo || "Encarregado"} • {p.tel}</div>
                  </div>
                  <a href={`tel:+55${tel}`} style={{ background: BLUE, color: "#fff", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", marginRight: 6, fontSize: 16 }}>📞</a>
                  <a href={`https://wa.me/55${tel}`} target="_blank" rel="noreferrer" style={{ background: "#25D366", color: "#fff", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 16 }}>💬</a>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   ADIANTAMENTOS / VALES
════════════════════════════════════ */
function TelaAdiantamentos({ obras, trabalhadores, adiantamentos, onBack, onAdd, onRemove }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ trabId: "", valor: "", motivo: "", data: new Date().toLocaleDateString("pt-BR") });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const salvar = () => {
    if (!form.trabId || !form.valor) return;
    onAdd({ id: Date.now(), trabId: parseInt(form.trabId), valor: parseFloat(form.valor), motivo: form.motivo, data: form.data, ts: Date.now(), descontado: false });
    setForm({ trabId: "", valor: "", motivo: "", data: new Date().toLocaleDateString("pt-BR") });
    setModal(false);
  };

  // Adiantamentos do mês atual
  const hoje = new Date();
  const ehMesAtual = (data) => {
    try {
      const [d, m, a] = data.split("/");
      return parseInt(m) - 1 === hoje.getMonth() && parseInt(a) === hoje.getFullYear();
    } catch { return false; }
  };

  const adiantMes = adiantamentos.filter(a => ehMesAtual(a.data));
  const totalMes = adiantMes.reduce((s, a) => s + a.valor, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Adiantamentos" sub="Vales e antecipações" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ background: `linear-gradient(135deg,${ORANGE},#c2410c)`, borderRadius: 14, padding: 16, marginBottom: 12, color: "#fff", boxShadow: "0 4px 14px #ea580c44" }}>
          <div style={{ fontSize: 11, opacity: 0.9 }}>Total adiantado este mês</div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>R$ {totalMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>{adiantMes.length} adiantamento(s) registrado(s)</div>
        </div>

        <div style={{ background: "#fffaeb", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "#8b6f00", marginBottom: 12 }}>
          💡 Os adiantamentos do mês atual são automaticamente descontados na 2ª quinzena.
        </div>

        <Btn label="➕ Registrar Adiantamento" color={ORANGE} onClick={() => setModal(true)} style={{ marginBottom: 14 }} />

        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, fontSize: 13 }}>📜 Histórico</div>
        {adiantamentos.length === 0 && <div style={{ background: "#fff", borderRadius: 12, padding: 20, textAlign: "center", color: "#aaa" }}>Nenhum adiantamento registrado.</div>}
        {[...adiantamentos].sort((a, b) => b.ts - a.ts).map(a => {
          const t = trabalhadores.find(x => x.id === a.trabId);
          const obra = obras.find(o => o.id === t?.obraId);
          return (
            <div key={a.id} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${ORANGE}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{t?.nome || "—"}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{t?.cargo} • {obra?.nome}</div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>📅 {a.data}</div>
                  {a.motivo && <div style={{ fontSize: 11, color: "#777", fontStyle: "italic", marginTop: 2 }}>"{a.motivo}"</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: ORANGE }}>R$ {a.valor.toFixed(2)}</div>
                  <button onClick={() => { confirmar("Remover este adiantamento?", () => { onRemove(a.id); }); }} style={{ background: "#fee2e2", border: "2px solid #d63b3b", color: "#d63b3b", cursor: "pointer", fontSize: 16, marginTop: 2, padding: "6px 10px", borderRadius: 8, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <KMFooter />

      <Modal show={modal} title="Novo Adiantamento" onClose={() => setModal(false)}>
        <label style={labelS}>Trabalhador</label>
        <select value={form.trabId} onChange={e => set("trabId", e.target.value)} style={selS}>
          <option value="">Selecione</option>
          {trabalhadores.map(t => <option key={t.id} value={t.id}>{t.nome} — {t.cargo}</option>)}
        </select>
        <label style={labelS}>Valor (R$)</label>
        <input value={form.valor} onChange={e => set("valor", e.target.value)} type="number" placeholder="500,00" style={inputS} />
        <label style={labelS}>Motivo (opcional)</label>
        <input value={form.motivo} onChange={e => set("motivo", e.target.value)} placeholder="Ex: emergência, mercado, etc." style={inputS} />
        <label style={labelS}>Data</label>
        <input value={form.data} onChange={e => set("data", e.target.value)} placeholder="DD/MM/AAAA" style={inputS} />
        <Btn label="✓ REGISTRAR" color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   EXAMES MÉDICOS (ASO) — controle e renovação
════════════════════════════════════ */
function TelaExames({ obras, trabalhadores, onBack, onVerTrabalhador }) {
  const [filtro, setFiltro] = useState("vence_30"); // vence_30 | vencido | apto | inapto | sem_aso

  const checaASO = (t) => {
    if (!t.asoValidade) return { tem: false };
    try {
      const v = new Date(t.asoValidade);
      const dias = Math.ceil((v - new Date()) / (1000 * 60 * 60 * 24));
      return { tem: true, dias, vencido: dias < 0, vencendo: dias >= 0 && dias <= 30, ok: dias > 30 };
    } catch { return { tem: false }; }
  };

  const trabComStatus = trabalhadores.map(t => ({ ...t, _aso: checaASO(t) }));

  const grupos = {
    vencido: trabComStatus.filter(t => t._aso.vencido),
    vence_30: trabComStatus.filter(t => t._aso.vencendo),
    apto: trabComStatus.filter(t => t._aso.ok && t.asoStatus === "Apto"),
    inapto: trabComStatus.filter(t => t.asoStatus === "Inapto" || t.asoStatus === "Apto com restrições"),
    sem_aso: trabComStatus.filter(t => !t._aso.tem),
  };

  const lista = grupos[filtro] || [];

  const exportar = () => {
    const titulo = { vencido: "ASO Vencidos", vence_30: "ASO Vencendo (30 dias)", apto: "Aptos", inapto: "Inaptos / Restrições", sem_aso: "Sem ASO Cadastrado" }[filtro];
    const html = `<html><head><title>${titulo}</title>
      <style>
        ${KM_PDF_PAGE_CSS}
        @page { size: A4 portrait; margin: 12mm 10mm; }
        @media print { body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        body { font-family: Arial; color: #222; margin: 0 auto; max-width: 190mm; padding: 6mm 4mm; box-sizing: border-box; }
        h1, h2, h3 { page-break-after: avoid; break-after: avoid; }
        h1 { color: #004080; border-bottom: 3px solid #C0A040; padding-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; table-layout: auto; page-break-inside: auto; break-inside: auto; }
        tr { page-break-inside: avoid; break-inside: avoid; }
        thead { display: table-header-group; }
        th { background: #004080; color: #fff; padding: 8px; white-space: nowrap; }
        td { padding: 6px 8px; border: 1px solid #ddd; vertical-align: top; overflow-wrap: break-word; word-break: normal; }
        /* Coluna do nome (1ª): NÃO quebra, se alarga ao texto */
        th:first-child, td:first-child { white-space: nowrap; min-width: 110px; }
        /* Coluna 2 (cargo): NÃO quebra */
        th:nth-child(2), td:nth-child(2) { white-space: nowrap; min-width: 80px; }
        /* Datas/status: não quebram */
        th:nth-child(4), td:nth-child(4), th:nth-child(5), td:nth-child(5) { white-space: nowrap; }
        td.td-wrap { white-space: normal; overflow-wrap: break-word; word-break: normal; }
        tr:nth-child(even) td { background: #f5f8fc; }
      </style></head><body>
      <h1>🏥 Controle de Exames Médicos — ${titulo}</h1>
      <p><b>Total:</b> ${lista.length} trabalhador(es) • <b>Gerado:</b> ${new Date().toLocaleString("pt-BR")}</p>
      <table>
        <tr><th>Nome</th><th>Cargo</th><th>Obra</th><th>Validade</th><th>Status</th><th>Telefone</th></tr>
        ${lista.map(t => {
          const obra = obras.find(o => o.id === t.obraId);
          return `<tr>
            <td><b>${t.nome}</b></td>
            <td>${t.cargo}</td>
            <td>${obra?.nome || "—"}</td>
            <td>${t.asoValidade ? new Date(t.asoValidade).toLocaleDateString("pt-BR") : "—"}</td>
            <td>${t.asoStatus || "—"}</td>
            <td>${t.tel || "—"}</td>
          </tr>`;
        }).join("")}
      </table>
      <script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
      </body></html>`;
    abrirOuBaixarHTML(html, `Exames-${titulo.replace(/\s/g, "_")}.html`);
  };

  const cores = {
    vencido: { bg: RED, light: "#fef2f2", icon: "❌", titulo: "ASO Vencido" },
    vence_30: { bg: ORANGE, light: "#fff8f0", icon: "⚠️", titulo: "Vencendo em 30 dias" },
    apto: { bg: GREEN, light: "#f0fdf4", icon: "✅", titulo: "Aptos" },
    inapto: { bg: RED, light: "#fef2f2", icon: "🚫", titulo: "Inaptos / Restrições" },
    sem_aso: { bg: "#888", light: "#f5f5f5", icon: "❓", titulo: "Sem ASO" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Exames Médicos" sub="Controle de ASO" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        {/* Resumo */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {Object.entries(grupos).map(([k, l]) => {
            const c = cores[k];
            return (
              <button key={k} onClick={() => setFiltro(k)} style={{ background: filtro === k ? c.bg : "#fff", color: filtro === k ? "#fff" : NAVY, border: filtro === k ? "none" : `1.5px solid ${c.bg}33`, borderRadius: 12, padding: "10px 8px", cursor: "pointer", textAlign: "left", boxShadow: filtro === k ? `0 4px 14px ${c.bg}55` : "none" }}>
                <div style={{ fontSize: 22 }}>{c.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>{l.length}</div>
                <div style={{ fontSize: 10, opacity: filtro === k ? 0.9 : 0.7 }}>{c.titulo}</div>
              </button>
            );
          })}
        </div>

        <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{cores[filtro].icon} {cores[filtro].titulo} • {lista.length}</span>
          {lista.length > 0 && <button onClick={exportar} style={{ background: "none", border: `1px solid ${BLUE}`, color: BLUE, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>📄 PDF</button>}
        </div>

        {lista.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, textAlign: "center", color: "#aaa" }}>
            {filtro === "vencido" && "🎉 Nenhum exame vencido!"}
            {filtro === "vence_30" && "✅ Nenhum exame vencendo nos próximos 30 dias."}
            {filtro === "apto" && "Nenhum trabalhador apto cadastrado."}
            {filtro === "inapto" && "✅ Nenhum trabalhador inapto."}
            {filtro === "sem_aso" && "🎉 Todos os trabalhadores têm ASO cadastrado."}
          </div>
        ) : lista.map(t => {
          const obra = obras.find(o => o.id === t.obraId);
          return (
            <div key={t.id} onClick={() => onVerTrabalhador(t)} style={{ background: "#fff", borderRadius: 12, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)", cursor: "pointer", borderLeft: `4px solid ${cores[filtro].bg}` }}>
              {t.foto ? (
                <img src={t.foto} alt="" style={{ width: 40, height: 40, borderRadius: 20, objectFit: "cover", marginRight: 10, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 20, background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginRight: 10, flexShrink: 0 }}>👷</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{t.nome}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{t.cargo} • {obra?.nome || "—"}</div>
                {t.asoValidade && (
                  <div style={{ fontSize: 11, color: cores[filtro].bg, fontWeight: 700, marginTop: 2 }}>
                    {filtro === "vencido" && `❌ Vencido há ${Math.abs(t._aso.dias)} dia(s)`}
                    {filtro === "vence_30" && `⚠️ Vence em ${t._aso.dias} dia(s) — ${new Date(t.asoValidade).toLocaleDateString("pt-BR")}`}
                    {filtro === "apto" && `✅ Válido até ${new Date(t.asoValidade).toLocaleDateString("pt-BR")}`}
                    {filtro === "inapto" && `🚫 ${t.asoStatus}`}
                  </div>
                )}
                {filtro === "sem_aso" && <div style={{ fontSize: 11, color: "#888", fontStyle: "italic", marginTop: 2 }}>Sem cadastro de exame</div>}
              </div>
              {t.tel && (
                <a href={`https://wa.me/55${t.tel.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ background: "#25D366", color: "#fff", borderRadius: 7, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 14, marginRight: 4 }}>💬</a>
              )}
              <span style={{ color: "#ccc", fontSize: 18 }}>›</span>
            </div>
          );
        })}

        <div style={{ background: "#fffaeb", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "#8b6f00", marginTop: 14 }}>
          💡 <b>Dica:</b> Toque em um trabalhador para editar a data do próximo exame.
        </div>
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   MANUTENÇÃO PREVENTIVA — Ativos e Ferramentas
════════════════════════════════════ */
function TelaManutencao({ obras, ativos, ferramentas, equips, manutencoes, onBack, onAdd, onRemover }) {
  const [aba, setAba] = useState("agenda"); // agenda | historico
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ tipoItem: "ativo", itemId: "", tipo: "Troca de óleo", proxData: "", observacao: "", obraId: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const TIPOS_MAN = ["Troca de óleo", "Troca de filtro", "Lubrificação", "Revisão geral", "Troca de pneus", "Calibração", "Reparo", "Limpeza", "Outro"];

  const salvar = () => {
    if (!form.itemId || !form.proxData) return;
    onAdd({ id: Date.now(), ...form, ts: Date.now(), realizada: false });
    setForm({ tipoItem: "ativo", itemId: "", tipo: "Troca de óleo", proxData: "", observacao: "", obraId: "" });
    setModal(false);
  };

  const marcarRealizada = (id) => {
    const m = manutencoes.find(x => x.id === id);
    if (!m) return;
    if (!confirm(`Marcar "${m.tipo}" como realizada?`)) return;
    onAdd({ ...m, realizada: true, dataRealizada: new Date().toLocaleDateString("pt-BR"), id: m.id });
  };

  // Análise de status
  const hoje = new Date();
  const hojeMs = hoje.getTime();
  const checaStatus = (m) => {
    if (m.realizada) return { txt: "Realizada", cor: GREEN, dias: 0, prio: 3 };
    try {
      const d = new Date(m.proxData);
      const dias = Math.ceil((d - hoje) / (1000 * 60 * 60 * 24));
      if (dias < 0) return { txt: `Atrasada ${Math.abs(dias)}d`, cor: RED, dias, prio: 0 };
      if (dias <= 7) return { txt: `Em ${dias}d`, cor: ORANGE, dias, prio: 1 };
      return { txt: `Em ${dias}d`, cor: BLUE, dias, prio: 2 };
    } catch { return { txt: "—", cor: "#888", dias: 999, prio: 4 }; }
  };

  const lista = aba === "agenda" ? manutencoes.filter(m => !m.realizada) : manutencoes.filter(m => m.realizada);
  const ordenada = [...lista].map(m => ({ ...m, _s: checaStatus(m) })).sort((a, b) => a._s.prio - b._s.prio);

  const getNomeItem = (m) => {
    if (m.tipoItem === "ativo") return ativos.find(x => x.id === parseInt(m.itemId))?.nome || "—";
    if (m.tipoItem === "ferramenta") return ferramentas.find(x => x.id === parseInt(m.itemId))?.nome || "—";
    if (m.tipoItem === "equipamento") return equips.find(x => x.id === parseInt(m.itemId))?.nome || "—";
    return "—";
  };

  const getIconeItem = (tipoItem) => ({ ativo: "🚜", ferramenta: "🔨", equipamento: "⚙️" }[tipoItem] || "🔧");

  const atrasadas = manutencoes.filter(m => !m.realizada && checaStatus(m).dias < 0).length;
  const urgentes = manutencoes.filter(m => !m.realizada && checaStatus(m).dias >= 0 && checaStatus(m).dias <= 7).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Manutenções" sub="Preventiva e corretiva" onBack={onBack} />
      <div style={{ display: "flex", gap: 0, background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        {[
          { v: "agenda", l: "🗓️ Agenda", n: manutencoes.filter(m => !m.realizada).length },
          { v: "historico", l: "✅ Histórico", n: manutencoes.filter(m => m.realizada).length },
        ].map(a => (
          <button key={a.v} onClick={() => setAba(a.v)} style={{
            flex: 1, padding: "12px 0", background: "none", border: "none",
            borderBottom: aba === a.v ? `3px solid ${NAVY}` : "3px solid transparent",
            color: aba === a.v ? NAVY : "#888", fontWeight: aba === a.v ? 800 : 600, fontSize: 13, cursor: "pointer"
          }}>
            {a.l} <span style={{ background: aba === a.v ? NAVY : "#ccc", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, marginLeft: 4 }}>{a.n}</span>
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        {aba === "agenda" && (
          <>
            {(atrasadas > 0 || urgentes > 0) && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {atrasadas > 0 && (
                  <div style={{ flex: 1, background: RED, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>{atrasadas}</div>
                    <div style={{ fontSize: 10 }}>Atrasadas</div>
                  </div>
                )}
                {urgentes > 0 && (
                  <div style={{ flex: 1, background: ORANGE, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>{urgentes}</div>
                    <div style={{ fontSize: 10 }}>Esta semana</div>
                  </div>
                )}
              </div>
            )}
            <Btn label="➕ Agendar Manutenção" color={NAVY} onClick={() => setModal(true)} style={{ marginBottom: 14 }} />
          </>
        )}

        {ordenada.length === 0 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, textAlign: "center", color: "#aaa" }}>
            {aba === "agenda" ? "🎉 Nenhuma manutenção agendada." : "Nenhuma manutenção concluída ainda."}
          </div>
        )}

        {ordenada.map(m => {
          const obra = obras.find(o => o.id === parseInt(m.obraId));
          return (
            <div key={m.id} style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${m._s.cor}` }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 24, marginRight: 10 }}>{getIconeItem(m.tipoItem)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: 13 }}>{getNomeItem(m)}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{m.tipo}</div>
                  {obra && <div style={{ fontSize: 10, color: BLUE }}>📍 {obra.nome}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: m._s.cor, fontWeight: 800 }}>{m._s.txt}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>{m.realizada ? `✓ ${m.dataRealizada}` : new Date(m.proxData).toLocaleDateString("pt-BR")}</div>
                </div>
              </div>
              {m.observacao && <div style={{ fontSize: 11, color: "#666", fontStyle: "italic", marginBottom: 6, paddingLeft: 34 }}>"{m.observacao}"</div>}

              {!m.realizada && (
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button onClick={() => marcarRealizada(m.id)} style={{ flex: 1, padding: 7, borderRadius: 8, border: "none", background: GREEN, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>✓ MARCAR REALIZADA</button>
                  <button onClick={() => { confirmar("Remover esta manutenção?", () => { onRemover(m.id); }); }} style={{ padding: 7, borderRadius: 8, border: "none", background: "#fef2f2", color: RED, fontWeight: 700, cursor: "pointer", fontSize: 11, width: 50 }}>🗑️</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <KMFooter />

      <Modal show={modal} title="Agendar Manutenção" onClose={() => setModal(false)}>
        <label style={labelS}>Tipo de item</label>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[
            { v: "ativo", l: "🚜 Ativo/Frota" },
            { v: "ferramenta", l: "🔨 Ferramenta" },
            { v: "equipamento", l: "⚙️ Equipamento" },
          ].map(t => (
            <button key={t.v} onClick={() => set("tipoItem", t.v)} style={{ flex: 1, padding: "10px 4px", borderRadius: 10, border: `2px solid ${form.tipoItem === t.v ? NAVY : "#dde2ef"}`, background: form.tipoItem === t.v ? "#dde6f5" : "#fff", cursor: "pointer", fontSize: 11, fontWeight: 700, color: form.tipoItem === t.v ? NAVY : "#666" }}>{t.l}</button>
          ))}
        </div>

        <label style={labelS}>Selecione o item</label>
        <select value={form.itemId} onChange={e => set("itemId", e.target.value)} style={selS}>
          <option value="">—</option>
          {form.tipoItem === "ativo" && ativos.map(a => <option key={a.id} value={a.id}>{a.nome} ({a.placa})</option>)}
          {form.tipoItem === "ferramenta" && ferramentas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          {form.tipoItem === "equipamento" && equips.map(e => <option key={e.id} value={e.id}>{e.nome} ({e.codigo})</option>)}
        </select>

        <label style={labelS}>Tipo de manutenção</label>
        <select value={form.tipo} onChange={e => set("tipo", e.target.value)} style={selS}>
          {TIPOS_MAN.map(t => <option key={t}>{t}</option>)}
        </select>

        <label style={labelS}>Próxima data</label>
        <input value={form.proxData} onChange={e => set("proxData", e.target.value)} type="date" style={inputS} />

        <label style={labelS}>Observação (opcional)</label>
        <input value={form.observacao} onChange={e => set("observacao", e.target.value)} placeholder="Ex: óleo 15W40, troca a cada 250h" style={inputS} />

        <Btn label="✓ AGENDAR" color={GREEN} onClick={salvar} />
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════
   HISTÓRICO DE PAGAMENTOS — Folhas quinzenais salvas
════════════════════════════════════ */
function TelaHistFolha({ obras, trabalhadores, folhasSalvas, onBack, onRemover }) {
  const [busca, setBusca] = useState("");

  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const lista = [...folhasSalvas].sort((a, b) => b.ts - a.ts).filter(f => {
    if (!busca) return true;
    const txt = `${meses[f.mes]} ${f.ano} ${f.quinzena}`.toLowerCase();
    return txt.includes(busca.toLowerCase());
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Histórico de Folhas" sub="Pagamentos quinzenais salvos" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por mês ou ano..." style={inputS} />

        {lista.length === 0 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 30, textAlign: "center", color: "#aaa" }}>
            📋 Nenhuma folha salva ainda.<br/>
            <span style={{ fontSize: 11 }}>Use o botão "Salvar Folha" na tela de Folha de Pagamento.</span>
          </div>
        )}

        {lista.map(f => (
          <div key={f.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, boxShadow: "0 1px 5px rgba(0,0,0,0.06)", borderLeft: `4px solid ${GREEN}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div>
                <div style={{ fontWeight: 800, color: NAVY, fontSize: 14 }}>📅 {f.quinzena}ª quinzena de {meses[f.mes]}/{f.ano}</div>
                <div style={{ fontSize: 11, color: "#888" }}>Período: {f.periodo}</div>
                <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>Salvo em {new Date(f.ts).toLocaleString("pt-BR")}</div>
              </div>
              <button onClick={() => { confirmar(`Remover folha de ${meses[f.mes]}/${f.ano}?`, () => { onRemover(f.id); }); }} style={{ background: "#fee2e2", border: "2px solid #d63b3b", color: "#d63b3b", cursor: "pointer", fontSize: 16, padding: "6px 10px", borderRadius: 8, fontWeight: 800, touchAction: "manipulation", WebkitTapHighlightColor: "rgba(214,59,59,0.3)" }}>🗑️</button>
            </div>
            <div style={{ display: "flex", gap: 6, fontSize: 11, marginBottom: 6 }}>
              <span style={{ background: "#f0fdf4", color: GREEN, padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>👷 {f.itens?.length || 0} trab.</span>
              <span style={{ background: "#fff8f0", color: ORANGE, padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>📌 {f.itens?.reduce((s, i) => s + i.faltas, 0) || 0} faltas</span>
              {f.totalAdiant > 0 && <span style={{ background: "#fef2f2", color: RED, padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>💸 R$ {f.totalAdiant.toFixed(2)}</span>}
            </div>
            <div style={{ background: `linear-gradient(135deg,${GREEN},#1a8540)`, borderRadius: 8, padding: "10px 12px", color: "#fff", textAlign: "center" }}>
              <div style={{ fontSize: 10, opacity: 0.9 }}>Total Líquido Pago</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>R$ {f.totalLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        ))}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   DIAGNÓSTICO — testar cada botão do app
════════════════════════════════════ */
function TelaDiagnostico({ onNav, onBack }) {
  const [resultados, setResultados] = useState({});

  const marcar = (nav, status) => setResultados(r => ({ ...r, [nav]: status }));

  const TESTES = [
    { grupo: "📋 Operação Diária", itens: [
      { nav: "rdo", l: "RDO ABNT" },
      { nav: "custos", l: "Custos por Obra" },
      { nav: "dashboard", l: "Dashboard" },
      { nav: "calendario", l: "Calendário" },
      { nav: "mapa", l: "Mapa de Obras" },
      { nav: "alertas", l: "Alertas" },
    ]},
    { grupo: "👥 Recursos Humanos", itens: [
      { nav: "folha_quinzenal", l: "Folha de Pagamento" },
      { nav: "hist_folha", l: "Histórico de Folhas" },
      { nav: "adiantamentos", l: "Adiantamentos" },
      { nav: "aprovar_mov", l: "Movimentações" },
      { nav: "equipe", l: "Equipe" },
      { nav: "ficha", l: "Ficha Cadastral" },
      { nav: "contatos", l: "Contatos" },
      { nav: "exames", l: "Exames (ASO)" },
      { nav: "rh", l: "Aniv./EPI" },
      { nav: "ferias", l: "Férias" },
      { nav: "folha", l: "Folha Mensal" },
    ]},
    { grupo: "🏗️ Obras & Recursos", itens: [
      { nav: "obras", l: "Obras" },
      { nav: "cronograma", l: "Cronograma" },
      { nav: "ativos", l: "Ativos/Frota" },
      { nav: "frota", l: "Combustível & Frota Dashboard" },
      { nav: "despesas", l: "Despesas Avulsas (PIPA, frete, almoço motorista)" },
      { nav: "manutencao", l: "Manutenções" },
      { nav: "equip_gestao", l: "Equipamentos" },
      { nav: "ferramentas", l: "Ferramentas" },
      { nav: "recebimento", l: "Recebimentos" },
    ]},
    { grupo: "📈 Análise & Comunicação", itens: [
      { nav: "produtividade", l: "Produtividade" },
      { nav: "consolidado", l: "Consolidado" },
      { nav: "diario", l: "Diário Obra" },
      { nav: "mensagens", l: "Mensagens" },
    ]},
    { grupo: "⚙️ Sistema", itens: [
      { nav: "links", l: "Links Úteis" },
      { nav: "empresa", l: "Empresa" },
      { nav: "backup", l: "Backup" },
    ]},
  ];

  const todosTestes = TESTES.flatMap(g => g.itens);
  const okCount = todosTestes.filter(t => resultados[t.nav] === "ok").length;
  const erroCount = todosTestes.filter(t => resultados[t.nav] === "erro").length;
  const restantes = todosTestes.length - okCount - erroCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="Diagnóstico" sub="Teste cada botão" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>
        <div style={{ background: NAVY, color: "#fff", borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>🔍 Como usar:</div>
          <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.5 }}>
            1. Toque em <b style={{ color: GOLD }}>"Abrir"</b> em cada botão<br/>
            2. Volte aqui e marque <b style={{ color: GREEN }}>✓ Funcionou</b> ou <b style={{ color: RED }}>✕ Quebrado</b><br/>
            3. No fim, me envie o relatório com os botões que falharam
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, background: GREEN, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{okCount}</div>
            <div style={{ fontSize: 10 }}>Funcionando</div>
          </div>
          <div style={{ flex: 1, background: RED, borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{erroCount}</div>
            <div style={{ fontSize: 10 }}>Com problema</div>
          </div>
          <div style={{ flex: 1, background: "#888", borderRadius: 10, padding: "10px 6px", textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{restantes}</div>
            <div style={{ fontSize: 10 }}>Não testado</div>
          </div>
        </div>

        {TESTES.map(grupo => (
          <div key={grupo.grupo} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{grupo.grupo}</div>
            {grupo.itens.map(t => {
              const status = resultados[t.nav];
              return (
                <div key={t.nav} style={{ background: status === "ok" ? "#f0fdf4" : status === "erro" ? "#fef2f2" : "#fff", borderRadius: 10, padding: "10px 12px", marginBottom: 6, display: "flex", alignItems: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.06)" }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: NAVY }}>{t.l}</div>
                  <button onClick={() => onNav(t.nav)} style={{ background: BLUE, color: "#fff", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", marginRight: 6 }}>Abrir</button>
                  <button onClick={() => marcar(t.nav, "ok")} style={{ background: status === "ok" ? GREEN : "#f0fdf4", color: status === "ok" ? "#fff" : GREEN, border: `1.5px solid ${GREEN}`, borderRadius: 7, padding: "6px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginRight: 4 }}>✓</button>
                  <button onClick={() => marcar(t.nav, "erro")} style={{ background: status === "erro" ? RED : "#fef2f2", color: status === "erro" ? "#fff" : RED, border: `1.5px solid ${RED}`, borderRadius: 7, padding: "6px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✕</button>
                </div>
              );
            })}
          </div>
        ))}

        {erroCount > 0 && (
          <div style={{ background: "#fef2f2", border: `1.5px solid ${RED}33`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 800, color: RED, fontSize: 13, marginBottom: 8 }}>⚠️ Botões com problema:</div>
            {todosTestes.filter(t => resultados[t.nav] === "erro").map(t => {
              const grupo = TESTES.find(g => g.itens.some(i => i.nav === t.nav));
              return <div key={t.nav} style={{ fontSize: 12, color: NAVY, padding: "3px 0" }}>• <b>{t.l}</b> ({grupo?.grupo})</div>;
            })}
            <button onClick={() => {
              const txt = "🔧 *KMZERO - Botões com problema*\n\n" + todosTestes.filter(t => resultados[t.nav] === "erro").map(t => "• " + t.l).join("\n");
              const url = `https://wa.me/?text=${encodeURIComponent(txt)}`;
              window.open(url, "_blank");
            }} style={{ background: "#25D366", color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer", marginTop: 10, width: "100%" }}>
              💬 Enviar lista por WhatsApp (pra mim)
            </button>
          </div>
        )}
      </div>
      <KMFooter />
    </div>
  );
}

/* ════════════════════════════════════
   APP ROOT COM STORAGE
════════════════════════════════════ */
/* ════════════════════════════════════
   ZERAR TUDO — tela com confirmação por digitação
════════════════════════════════════ */
/* ════════════════════════════════════════════════════
   TELA DE ANEXOS DA OBRA
   Gestor anexa qualquer tipo, encarregado anexa fotos e atestados
══════════════════════════════════════════════════════ */
const CATEGORIAS_ANEXO_GESTOR = [
  { id: "projetos", label: "Projetos", icon: "📐", cor: "#0891b2" },
  { id: "contratos", label: "Contratos", icon: "📋", cor: "#7c3aed" },
  { id: "art_rrt", label: "ART/RRT", icon: "📜", cor: "#dc2626" },
  { id: "planilhas", label: "Planilhas/Orçamentos", icon: "📊", cor: "#16a34a" },
  { id: "licencas", label: "Licenças/Alvarás", icon: "🏛️", cor: "#ca8a04" },
  { id: "memoriais", label: "Memoriais Descritivos", icon: "📝", cor: "#475569" },
  { id: "diario_oficial", label: "Diário Oficial", icon: "📰", cor: "#334155" },
  { id: "outros_gestor", label: "Outros (Gestor)", icon: "📁", cor: "#6b7280" },
];

const CATEGORIAS_ANEXO_ENCARREGADO = [
  { id: "fotos_extras", label: "Fotos Extras", icon: "📷", cor: "#0891b2" },
  { id: "atestados", label: "Atestados Médicos", icon: "🏥", cor: "#dc2626" },
  { id: "notas_fiscais", label: "Notas Fiscais", icon: "🧾", cor: "#16a34a" },
  { id: "comprovantes", label: "Comprovantes", icon: "📑", cor: "#7c3aed" },
];

function TelaAnexosObra({ obra, usuario, onBack }) {
  const isGestor = usuario && usuario.perfil === "gestor";
  const categorias = isGestor
    ? [...CATEGORIAS_ANEXO_GESTOR, ...CATEGORIAS_ANEXO_ENCARREGADO]
    : CATEGORIAS_ANEXO_ENCARREGADO;

  const [arquivos, setArquivos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroCat, setFiltroCat] = useState("todas");
  const [modalUpload, setModalUpload] = useState(false);
  const [categoriaUpload, setCategoriaUpload] = useState(categorias[0]?.id || "");
  const [descricaoUpload, setDescricaoUpload] = useState("");
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, fase: "" });
  const [quotaInfo, setQuotaInfo] = useState(null);
  const [visualizando, setVisualizando] = useState(null);

  const carregarArquivos = async () => {
    setCarregando(true);
    try {
      const lista = await fileStore.listByObra(obra.id);
      lista.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
      setArquivos(lista);
      const q = await fileStore.getQuotaInfo();
      setQuotaInfo(q);
    } catch (e) {
      console.error("Erro ao carregar anexos:", e);
      alert("Não foi possível carregar os anexos. " + (e.message || ""));
    }
    setCarregando(false);
  };

  useEffect(() => { carregarArquivos(); }, [obra.id]);

  const onSelecionarArquivo = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      alert("⚠️ Arquivo muito grande.\n\nTamanho máximo: 25 MB\nTamanho do arquivo: " + formatarTamanhoBytes(file.size));
      e.target.value = "";
      return;
    }
    setArquivoSelecionado(file);
    if (!descricaoUpload) setDescricaoUpload(file.name.replace(/\.[^.]+$/, ""));
  };

  const fazerUpload = async () => {
    if (!arquivoSelecionado) {
      alert("Selecione um arquivo primeiro.");
      return;
    }
    if (!categoriaUpload) {
      alert("Escolha uma categoria.");
      return;
    }

    try {
      setProgresso({ atual: 30, total: 100, fase: "Lendo arquivo..." });
      const base64 = await lerArquivoComoBase64(arquivoSelecionado);

      setProgresso({ atual: 70, total: 100, fase: "Salvando..." });
      const novoAnexo = {
        id: Date.now() + "_" + Math.random().toString(36).substring(2, 9),
        obraId: obra.id,
        obraNome: obra.nome,
        categoria: categoriaUpload,
        descricao: descricaoUpload.trim() || arquivoSelecionado.name,
        nomeOriginal: arquivoSelecionado.name,
        tamanho: arquivoSelecionado.size,
        mime: arquivoSelecionado.type || "application/octet-stream",
        conteudoBase64: base64,
        uploadedBy: usuario ? usuario.nome : "Desconhecido",
        uploadedByPerfil: usuario ? usuario.perfil : "encarregado",
        uploadedAt: Date.now(),
      };

      await fileStore.save(novoAnexo);

      setProgresso({ atual: 100, total: 100, fase: "Concluído!" });
      setTimeout(() => {
        setProgresso({ atual: 0, total: 0, fase: "" });
        setModalUpload(false);
        setArquivoSelecionado(null);
        setDescricaoUpload("");
        setCategoriaUpload(categorias[0]?.id || "");
        carregarArquivos();
      }, 400);
    } catch (e) {
      console.error("Erro no upload:", e);
      setProgresso({ atual: 0, total: 0, fase: "" });
      if (e.name === "QuotaExceededError" || (e.message && e.message.includes("quota"))) {
        alert("❌ Armazenamento cheio.\n\nApague arquivos antigos para liberar espaço.");
      } else {
        alert("❌ Erro ao salvar: " + (e.message || e));
      }
    }
  };

  const baixarArquivo = (anexo) => {
    try {
      const link = document.createElement("a");
      link.href = anexo.conteudoBase64;
      link.download = anexo.nomeOriginal || "arquivo";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("Erro ao baixar: " + (e.message || e));
    }
  };

  const visualizarArquivo = (anexo) => {
    const ehImagem = (anexo.mime || "").startsWith("image/");
    const ehPdf = anexo.mime === "application/pdf";
    if (ehImagem || ehPdf) {
      setVisualizando(anexo);
    } else {
      baixarArquivo(anexo);
    }
  };

  const excluirArquivo = async (anexo) => {
    const podeExcluir = isGestor || (anexo.uploadedBy === (usuario && usuario.nome));
    if (!podeExcluir) {
      alert("Você só pode excluir anexos que você mesmo enviou.");
      return;
    }
    if (!confirm("Excluir o arquivo \"" + anexo.descricao + "\"?\n\nEsta ação não pode ser desfeita.")) return;
    try {
      await fileStore.delete(anexo.id);
      carregarArquivos();
    } catch (e) {
      alert("Erro ao excluir: " + (e.message || e));
    }
  };

  const arquivosFiltrados = filtroCat === "todas"
    ? arquivos
    : arquivos.filter(a => a.categoria === filtroCat);

  const totalTamanho = arquivos.reduce((s, a) => s + (a.tamanho || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="📎 Anexos da Obra" sub={obra.nome} onBack={onBack} />

      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 14 }}>

        <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>📊 Resumo</div>
            {quotaInfo && quotaInfo.total > 0 && (
              <div style={{ fontSize: 10, color: "#888" }}>
                {formatarTamanhoBytes(quotaInfo.usado)} de {formatarTamanhoBytes(quotaInfo.total)} ({quotaInfo.percentual.toFixed(1)}%)
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
            <div><b style={{ color: NAVY }}>{arquivos.length}</b> arquivo(s)</div>
            <div style={{ color: "#666" }}>•</div>
            <div><b style={{ color: NAVY }}>{formatarTamanhoBytes(totalTamanho)}</b> nesta obra</div>
          </div>
        </div>

        <button
          onClick={() => setModalUpload(true)}
          style={{
            width: "100%", padding: 14, background: NAVY, color: "#fff",
            border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14,
            cursor: "pointer", marginBottom: 12, boxShadow: "0 3px 10px rgba(15,33,81,0.25)"
          }}
        >
          ⬆️ ANEXAR NOVO ARQUIVO
        </button>

        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 4 }}>
          <button
            onClick={() => setFiltroCat("todas")}
            style={{
              padding: "8px 14px", borderRadius: 20, border: "none",
              background: filtroCat === "todas" ? NAVY : "#fff",
              color: filtroCat === "todas" ? "#fff" : NAVY,
              fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
              border: filtroCat === "todas" ? "none" : "1px solid #e5e7eb",
            }}
          >
            Todas ({arquivos.length})
          </button>
          {categorias.map(c => {
            const qtd = arquivos.filter(a => a.categoria === c.id).length;
            if (qtd === 0 && filtroCat !== c.id) return null;
            return (
              <button
                key={c.id}
                onClick={() => setFiltroCat(c.id)}
                style={{
                  padding: "8px 14px", borderRadius: 20, border: "none",
                  background: filtroCat === c.id ? c.cor : "#fff",
                  color: filtroCat === c.id ? "#fff" : c.cor,
                  fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
                  border: filtroCat === c.id ? "none" : "1px solid " + c.cor + "55",
                }}
              >
                {c.icon} {c.label} ({qtd})
              </button>
            );
          })}
        </div>

        {carregando ? (
          <div style={{ textAlign: "center", padding: 40, color: "#888" }}>Carregando anexos...</div>
        ) : arquivosFiltrados.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 13 }}>
              {arquivos.length === 0
                ? "Nenhum arquivo anexado ainda."
                : "Nenhum arquivo nesta categoria."}
            </div>
          </div>
        ) : (
          arquivosFiltrados.map(a => {
            const cat = categorias.find(c => c.id === a.categoria) || { label: "Outros", icon: "📄", cor: "#6b7280" };
            const podeExcluir = isGestor || (a.uploadedBy === (usuario && usuario.nome));
            return (
              <div key={a.id} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, border: "1px solid #e5e7eb", borderLeft: "4px solid " + cat.cor }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ fontSize: 32 }}>{iconePorTipoArquivo(a.mime, a.nomeOriginal)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: NAVY, fontSize: 13, marginBottom: 3, wordBreak: "break-word" }}>
                      {a.descricao}
                    </div>
                    <div style={{ fontSize: 10, color: "#666", marginBottom: 3, wordBreak: "break-word" }}>
                      📄 {a.nomeOriginal} • {formatarTamanhoBytes(a.tamanho)}
                    </div>
                    <div style={{ fontSize: 10, color: "#888", marginBottom: 6 }}>
                      <span style={{ background: cat.cor + "22", color: cat.cor, padding: "2px 6px", borderRadius: 4, fontWeight: 700, marginRight: 6 }}>
                        {cat.icon} {cat.label}
                      </span>
                      por {a.uploadedBy} • {new Date(a.uploadedAt).toLocaleDateString("pt-BR")}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => visualizarArquivo(a)}
                        style={{ flex: 1, padding: "6px 8px", background: "#eff6ff", color: BLUE, border: "1px solid " + BLUE + "55", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                      >
                        👁️ Ver
                      </button>
                      <button
                        onClick={() => baixarArquivo(a)}
                        style={{ flex: 1, padding: "6px 8px", background: "#dcfce7", color: "#15803d", border: "1px solid #16a34a55", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                      >
                        ⬇️ Baixar
                      </button>
                      {podeExcluir && (
                        <button
                          onClick={() => excluirArquivo(a)}
                          style={{ padding: "6px 10px", background: "#fee2e2", color: RED, border: "1px solid " + RED + "55", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal show={modalUpload} title="⬆️ Anexar Arquivo" onClose={() => { if (!progresso.fase) { setModalUpload(false); setArquivoSelecionado(null); setDescricaoUpload(""); } }}>
        {progresso.fase ? (
          <div style={{ padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⬆️</div>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: 10 }}>{progresso.fase}</div>
            <div style={{ background: "#e5e7eb", borderRadius: 8, height: 10, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ background: NAVY, height: "100%", width: progresso.atual + "%", transition: "width 0.3s" }}></div>
            </div>
            <div style={{ fontSize: 11, color: "#666" }}>{progresso.atual}%</div>
          </div>
        ) : (
          <>
            <label style={labelS}>Categoria</label>
            <select value={categoriaUpload} onChange={e => setCategoriaUpload(e.target.value)} style={selS}>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>

            <label style={labelS}>Descrição (opcional)</label>
            <input
              value={descricaoUpload}
              onChange={e => setDescricaoUpload(e.target.value)}
              placeholder="Ex: Projeto arquitetônico revisão 02"
              style={inputS}
            />

            <label style={labelS}>Arquivo (máx. 25 MB)</label>
            <input
              type="file"
              onChange={onSelecionarArquivo}
              accept={isGestor
                ? ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.gif,.zip,.rar,.dwg,.dxf,.txt,.csv"
                : ".pdf,.jpg,.jpeg,.png,.webp,.gif"}
              style={{ ...inputS, padding: 8 }}
            />

            {arquivoSelecionado && (
              <div style={{ background: "#eff6ff", borderRadius: 8, padding: 10, marginTop: 6, marginBottom: 10, fontSize: 12, color: "#1e40af" }}>
                <div style={{ fontWeight: 700 }}>{iconePorTipoArquivo(arquivoSelecionado.type, arquivoSelecionado.name)} {arquivoSelecionado.name}</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>{formatarTamanhoBytes(arquivoSelecionado.size)}</div>
              </div>
            )}

            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button onClick={() => { setModalUpload(false); setArquivoSelecionado(null); setDescricaoUpload(""); }} style={{ flex: 1, padding: 11, borderRadius: 8, border: "none", background: "#eee", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Cancelar</button>
              <button onClick={fazerUpload} disabled={!arquivoSelecionado} style={{ flex: 2, padding: 11, borderRadius: 8, border: "none", background: arquivoSelecionado ? NAVY : "#9ca3af", color: "#fff", fontWeight: 700, cursor: arquivoSelecionado ? "pointer" : "not-allowed", fontSize: 12 }}>⬆️ Anexar</button>
            </div>
          </>
        )}
      </Modal>

      {visualizando && (
        <div
          onClick={() => setVisualizando(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 99999,
            display: "flex", flexDirection: "column", padding: 0,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: "#0f2151", padding: "10px 14px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {iconePorTipoArquivo(visualizando.mime, visualizando.nomeOriginal)} {visualizando.descricao}
            </div>
            <button onClick={() => setVisualizando(null)} style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 16, width: 32, height: 32, fontSize: 16, cursor: "pointer", marginLeft: 8 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {(visualizando.mime || "").startsWith("image/") ? (
              <img src={visualizando.conteudoBase64} alt={visualizando.descricao} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            ) : (
              <iframe
                src={visualizando.conteudoBase64}
                style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
                title={visualizando.descricao}
              />
            )}
          </div>
        </div>
      )}

      <KMFooter />
    </div>
  );
}

function TelaZerarTudo({ onBack, onZerar, onResetTotal }) {
  const [etapa, setEtapa] = useState(0); // 0=escolher modo, 1=aviso lancamentos, 2=digitar senha lancamentos, 3=aviso total, 4=digitar senha total
  const [senhaDigit, setSenhaDigit] = useState("");
  const [erro, setErro] = useState("");

  const confirmarLancamentos = () => {
    if (senhaDigit.trim().toUpperCase() === "ZERAR") {
      onZerar();
    } else {
      setErro("❌ Digite ZERAR para confirmar");
    }
  };

  const confirmarTotal = () => {
    if (senhaDigit.trim().toUpperCase() === "RESETAR TUDO") {
      onResetTotal();
    } else {
      setErro("❌ Digite RESETAR TUDO para confirmar");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <KMHeader title="🧹 Limpar Dados" sub="Escolher o que apagar" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", background: LIGHT, padding: 18 }}>

        {/* ETAPA 0: ESCOLHA */}
        {etapa === 0 && (
          <>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 14, lineHeight: 1.5 }}>
              Escolha o que deseja fazer:
            </div>

            {/* Opção 1: Lançamentos */}
            <button onClick={() => setEtapa(1)} style={{ width: "100%", textAlign: "left", padding: 16, background: "#fff", border: "2px solid #f97316", borderRadius: 14, cursor: "pointer", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 28 }}>🧹</div>
                <div style={{ fontWeight: 800, color: "#9a3412", fontSize: 14 }}>Apagar Lançamentos</div>
              </div>
              <div style={{ fontSize: 11, color: "#7c2d12", lineHeight: 1.5, marginBottom: 6 }}>
                Apaga só os dados de movimento (RDOs, pedidos, fotos, presenças, despesas, etc).
              </div>
              <div style={{ fontSize: 11, color: "#15803d", lineHeight: 1.5 }}>
                ✅ Mantém obras, trabalhadores, acessos, empresa, fornecedores
              </div>
            </button>

            {/* Opção 2: Reset Total */}
            <button onClick={() => setEtapa(3)} style={{ width: "100%", textAlign: "left", padding: 16, background: "#fff", border: "2px solid #dc2626", borderRadius: 14, cursor: "pointer", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 28 }}>💣</div>
                <div style={{ fontWeight: 800, color: "#991b1b", fontSize: 14 }}>Reset Total</div>
              </div>
              <div style={{ fontSize: 11, color: "#7f1d1d", lineHeight: 1.5, marginBottom: 6 }}>
                <b>APAGA ABSOLUTAMENTE TUDO</b> e deixa o app como se fosse a primeira instalação.
              </div>
              <div style={{ fontSize: 11, color: "#991b1b", lineHeight: 1.5 }}>
                ⚠️ Apaga: obras, trabalhadores, acessos, empresa, lançamentos, TUDO.
              </div>
            </button>

            <button onClick={onBack} style={{ width: "100%", marginTop: 6, padding: 12, background: "#f3f4f6", color: NAVY, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Cancelar
            </button>
          </>
        )}

        {/* ETAPA 1: AVISO LANCAMENTOS */}
        {etapa === 1 && (
          <>
            <div style={{ background: "#fff7ed", border: "2px solid #f97316", borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>🧹</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#9a3412", marginBottom: 6 }}>Apagar Lançamentos</div>
              <div style={{ fontSize: 13, color: "#7c2d12", lineHeight: 1.5 }}>
                Será apagado:
                <ul style={{ margin: "8px 0 0 20px", padding: 0, lineHeight: 1.7 }}>
                  <li>RDOs emitidos</li>
                  <li>Pedidos de material</li>
                  <li>Fotos da galeria</li>
                  <li>Despesas avulsas</li>
                  <li>Histórico de presenças</li>
                  <li>Movimentações</li>
                  <li>Adiantamentos</li>
                  <li>Anotações do diário</li>
                  <li>Abastecimentos</li>
                  <li>Produtividade</li>
                </ul>
              </div>
            </div>

            <div style={{ background: "#dcfce7", border: "1px solid #16a34a", borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#166534", marginBottom: 6 }}>✅ NÃO será apagado:</div>
              <ul style={{ margin: "0 0 0 20px", padding: 0, fontSize: 12, color: "#15803d", lineHeight: 1.6 }}>
                <li>Obras cadastradas</li>
                <li>Trabalhadores (folha)</li>
                <li>Acessos do app (logins)</li>
                <li>Dados da empresa</li>
                <li>Fornecedores</li>
                <li>Equipamentos e ativos</li>
              </ul>
            </div>

            <button onClick={() => setEtapa(2)} style={{ width: "100%", padding: 14, background: "#f97316", color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 12px rgba(249,115,22,0.3)" }}>
              🧹 PROSSEGUIR COM A LIMPEZA
            </button>

            <button onClick={() => setEtapa(0)} style={{ width: "100%", marginTop: 10, padding: 12, background: "#f3f4f6", color: NAVY, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              ← Voltar
            </button>
          </>
        )}

        {/* ETAPA 2: SENHA LANCAMENTOS */}
        {etapa === 2 && (
          <>
            <div style={{ background: "#fff7ed", border: "2px solid #f97316", borderRadius: 14, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 32, marginBottom: 8, textAlign: "center" }}>🔐</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#9a3412", marginBottom: 8, textAlign: "center" }}>Confirmação</div>
              <div style={{ fontSize: 13, color: "#7c2d12", lineHeight: 1.5, marginBottom: 12, textAlign: "center" }}>
                Digite a palavra<br/>
                <b style={{ fontSize: 18, color: "#f97316", fontFamily: "monospace", letterSpacing: 2 }}>ZERAR</b>
              </div>

              <input
                type="text"
                value={senhaDigit}
                onChange={e => { setSenhaDigit(e.target.value); setErro(""); }}
                placeholder="Digite ZERAR"
                autoFocus
                autoComplete="off"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: erro ? "2px solid #dc2626" : "2px solid #fed7aa",
                  fontSize: 18,
                  fontWeight: 700,
                  textAlign: "center",
                  letterSpacing: 2,
                  marginBottom: 8,
                  background: "#fff",
                  color: "#f97316",
                  textTransform: "uppercase",
                }}
              />

              {erro && (
                <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600 }}>
                  {erro}
                </div>
              )}
            </div>

            <button onClick={confirmarLancamentos} disabled={!senhaDigit.trim()} style={{
              width: "100%", padding: 14, background: senhaDigit.trim() ? "#f97316" : "#fdba74",
              color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14,
              cursor: senhaDigit.trim() ? "pointer" : "not-allowed",
            }}>
              ✓ CONFIRMAR E ZERAR LANÇAMENTOS
            </button>

            <button onClick={() => { setEtapa(1); setSenhaDigit(""); setErro(""); }} style={{ width: "100%", marginTop: 10, padding: 12, background: "#f3f4f6", color: NAVY, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              ← Voltar
            </button>
          </>
        )}

        {/* ETAPA 3: AVISO RESET TOTAL */}
        {etapa === 3 && (
          <>
            <div style={{ background: "#fef2f2", border: "3px solid #dc2626", borderRadius: 14, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 36, marginBottom: 8, textAlign: "center" }}>💣</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#7f1d1d", marginBottom: 10, textAlign: "center" }}>RESET TOTAL</div>
              <div style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.6 }}>
                <p style={{ margin: "0 0 10px 0" }}><b>⚠️ Atenção MÁXIMA!</b></p>
                <p style={{ margin: "0 0 10px 0" }}>
                  Esta ação vai apagar <b>TUDO</b>:
                </p>
                <ul style={{ margin: "0 0 0 20px", padding: 0, lineHeight: 1.7 }}>
                  <li>🏗️ Todas as obras</li>
                  <li>👥 Todos os trabalhadores</li>
                  <li>🔑 Todos os acessos (exceto o seu)</li>
                  <li>🏢 Dados da empresa</li>
                  <li>🏪 Fornecedores</li>
                  <li>⚙️ Equipamentos e ativos</li>
                  <li>📄 Todos os RDOs</li>
                  <li>📦 Todos os pedidos</li>
                  <li>📷 Todas as fotos</li>
                  <li>💸 Tudo de financeiro</li>
                  <li>📊 Histórico, presença, diário, mensagens</li>
                  <li>🎯 Cronogramas</li>
                  <li>📈 Produtividade</li>
                  <li>... e <b>todo o resto</b></li>
                </ul>
                <p style={{ margin: "12px 0 0 0", fontWeight: 700 }}>
                  O app vai voltar ao estado inicial, como se fosse a primeira instalação.
                </p>
              </div>
            </div>

            <button onClick={() => setEtapa(4)} style={{ width: "100%", padding: 14, background: "#dc2626", color: "#fff", border: "none", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 12px rgba(220,38,38,0.4)" }}>
              💣 PROSSEGUIR COM RESET TOTAL
            </button>

            <button onClick={() => setEtapa(0)} style={{ width: "100%", marginTop: 10, padding: 12, background: "#f3f4f6", color: NAVY, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              ← Voltar
            </button>
          </>
        )}

        {/* ETAPA 4: SENHA RESET TOTAL */}
        {etapa === 4 && (
          <>
            <div style={{ background: "#fef2f2", border: "3px solid #dc2626", borderRadius: 14, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 36, marginBottom: 8, textAlign: "center" }}>🔐💣</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#7f1d1d", marginBottom: 8, textAlign: "center" }}>Confirmação Final</div>
              <div style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.5, marginBottom: 12, textAlign: "center" }}>
                Para confirmar o reset total, digite a frase<br/>
                <b style={{ fontSize: 18, color: "#dc2626", fontFamily: "monospace", letterSpacing: 1 }}>RESETAR TUDO</b>
              </div>

              <input
                type="text"
                value={senhaDigit}
                onChange={e => { setSenhaDigit(e.target.value); setErro(""); }}
                placeholder="Digite RESETAR TUDO"
                autoFocus
                autoComplete="off"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: erro ? "2px solid #dc2626" : "2px solid #fca5a5",
                  fontSize: 16,
                  fontWeight: 700,
                  textAlign: "center",
                  letterSpacing: 1,
                  marginBottom: 8,
                  background: "#fff",
                  color: "#dc2626",
                  textTransform: "uppercase",
                }}
              />

              {erro && (
                <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600 }}>
                  {erro}
                </div>
              )}
            </div>

            <button onClick={confirmarTotal} disabled={!senhaDigit.trim()} style={{
              width: "100%", padding: 14, background: senhaDigit.trim() ? "#dc2626" : "#fca5a5",
              color: "#fff", border: "none", borderRadius: 12, fontWeight: 900, fontSize: 14,
              cursor: senhaDigit.trim() ? "pointer" : "not-allowed",
              boxShadow: senhaDigit.trim() ? "0 4px 12px rgba(220,38,38,0.5)" : "none",
            }}>
              💣 CONFIRMAR RESET TOTAL
            </button>

            <button onClick={() => { setEtapa(3); setSenhaDigit(""); setErro(""); }} style={{ width: "100%", marginTop: 10, padding: 12, background: "#f3f4f6", color: NAVY, border: "none", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              ← Voltar
            </button>
          </>
        )}

      </div>
      <KMFooter />
    </div>
  );
}

export default function App() {
  const [splashAtivo, setSplashAtivo] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setSplashAtivo(false), 4000);
    return () => clearTimeout(t);
  }, []);

  const [tela, setTelaRaw]        = useState("login");
  const [historicoTelas, setHistoricoTelas] = useState([]); // pilha de navegação
  const [usuario, setUsuario]     = useState(null);

  // Wrapper inteligente: quando muda de tela, guarda a anterior no histórico
  const setTela = (novaTela) => {
    setTelaRaw(prev => {
      // Não guarda no histórico se: é login, é a mesma tela, ou é "home/gestor" (telas raiz)
      const ehTelaRaiz = ["login", "home", "gestor"].includes(prev);
      if (prev !== novaTela && !ehTelaRaiz) {
        setHistoricoTelas(h => [...h, prev]);
      } else if (ehTelaRaiz && prev !== novaTela) {
        // Quando sai de uma tela raiz, limpa histórico
        setHistoricoTelas([]);
      }
      return novaTela;
    });
  };

  // Voltar: vai pra última tela do histórico, ou pra raiz se vazio
  const voltar = () => {
    setHistoricoTelas(h => {
      if (h.length > 0) {
        const novaPilha = [...h];
        const anterior = novaPilha.pop();
        setTelaRaw(anterior);
        return novaPilha;
      }
      // Sem histórico: vai pra tela raiz baseado no perfil
      if (usuario?.perfil === "gestor") setTelaRaw("gestor");
      else if (usuario) setTelaRaw("home");
      else setTelaRaw("login");
      return [];
    });
  };

  const [usuarios, setUsuarios]   = useState(DEFAULT_USUARIOS);
  const [obras, setObras]         = useState(DEFAULT_OBRAS);
  const [trabalhadores, setTrab]  = useState(DEFAULT_TRABALHADORES);
  const [equips, setEquips]       = useState(DEFAULT_EQUIPS);
  const [pedidos, setPedidos]     = useState([]);
  const [historico, setHistorico] = useState({});
  const [mensagens, setMensagens] = useState([]);
  const [diario, setDiario]       = useState([]);
  const [ativos, setAtivos]       = useState(DEFAULT_ATIVOS);
  const [abastecimentos, setAbast]= useState([]);
  const [ferias, setFerias]       = useState([]);
  const [rdosEmitidos, setRdos]   = useState([]);
  const [empresa, setEmpresa]     = useState(EMPRESA_PADRAO);
  const [produtividade, setProd]  = useState([]);
  const [recebimentos, setReceb]  = useState([]);
  const [movimentacoes, setMov]   = useState([]);
  const [ferramentas, setFerr]    = useState([]);
  const [links, setLinks]         = useState(LINKS_PADRAO);
  const [adiantamentos, setAdiant]= useState([]);
  const [manutencoes, setManut]   = useState([]);
  const [folhasSalvas, setFolhasSalvas] = useState([]);
  const [cronogramas, setCronog]  = useState({});
  const [movEquip, setMovEquip]   = useState([]);
  const [despesasAvulsas, setDespesasAvulsas] = useState([]);
  const [trabSelecionado, setTrabSelecionado] = useState(null);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [obraAnexos, setObraAnexos] = useState(null);
  const [movEquipSel, setMovEquipSel] = useState(null);
  const [movPessSel, setMovPessSel] = useState(null);
  const [fotosObras, setFotosObras] = useState([]); // galeria por obra
  const [fornecedores, setFornecedores] = useState(DEFAULT_FORNECEDORES);
  const [carregando, setCarregando] = useState(true);

  const obraAtual = usuario?.obraId ? obras.find(o => o.id === usuario.obraId) || obras[0] : obras[0];
  const presencasHoje = historico[hojeStr()] || {};

  useEffect(() => {
    (async () => {
      const obras_   = await store.get("obras");
      const trab_    = await store.get("trabalhadores");
      const equips_  = await store.get("equips");
      const pedidos_ = await store.get("pedidos");
      const hist_    = await store.get("historico");
      const users_   = await store.get("usuarios");
      const msgs_    = await store.get("mensagens");
      const diario_  = await store.get("diario");
      const ativos_  = await store.get("ativos");
      const abast_   = await store.get("abastecimentos");
      const ferias_  = await store.get("ferias");
      const rdos_    = await store.get("rdos");
      const emp_     = await store.get("empresa");
      const prod_    = await store.get("produtividade");
      const receb_   = await store.get("recebimentos");
      const mov_     = await store.get("movimentacoes");
      const ferr_    = await store.get("ferramentas");
      const links_   = await store.get("links");
      const adiant_  = await store.get("adiantamentos");
      const manut_   = await store.get("manutencoes");
      const folhas_  = await store.get("folhasSalvas");
      const cron_    = await store.get("cronogramas");
      const movE_    = await store.get("movEquip");
      const despAv_  = await store.get("despesasAvulsas");
      const fotos_   = await store.get("fotosObras");
      const forn_    = await store.get("fornecedores");
      const userLogado = await store.get("usuarioLogado");
      if (obras_)   setObras(obras_);
      if (trab_)    setTrab(trab_);
      if (equips_)  setEquips(equips_);
      if (pedidos_) setPedidos(pedidos_);
      if (hist_)    setHistorico(hist_);
      if (users_)   setUsuarios(users_);
      if (msgs_)    setMensagens(msgs_);
      if (diario_)  setDiario(diario_);
      if (ativos_)  setAtivos(ativos_);
      if (abast_)   setAbast(abast_);
      if (ferias_)  setFerias(ferias_);
      if (rdos_)    setRdos(rdos_);
      if (emp_)     setEmpresa(emp_);
      if (prod_)    setProd(prod_);
      if (receb_)   setReceb(receb_);
      if (mov_)     setMov(mov_);
      if (ferr_)    setFerr(ferr_);
      if (links_)   setLinks(links_);
      if (adiant_)  setAdiant(adiant_);
      if (manut_)   setManut(manut_);
      if (folhas_)  setFolhasSalvas(folhas_);
      if (cron_)    setCronog(cron_);
      if (movE_)    setMovEquip(movE_);
      if (despAv_)  setDespesasAvulsas(despAv_);
      if (fotos_)   setFotosObras(fotos_);
      if (forn_)    setFornecedores(forn_);
      if (userLogado) {
        setUsuario(userLogado);
        setTela(userLogado.perfil === "gestor" ? "gestor" : "home");
      }

      // ⭐ AUTO-POPULA 30 DIAS apenas se ativado manualmente em Sistema > Gerar 30 dias
      // (Desativado por padrão para produção - usuário deve gerar manualmente se quiser teste)
      // if (!hist_ || Object.keys(hist_).length === 0) { ... }

      setCarregando(false);
    })();
  }, []);

  useEffect(() => { if (!carregando) store.set("obras", obras); }, [obras, carregando]);
  useEffect(() => { if (!carregando) store.set("trabalhadores", trabalhadores); }, [trabalhadores, carregando]);
  useEffect(() => { if (!carregando) store.set("equips", equips); }, [equips, carregando]);
  useEffect(() => { if (!carregando) store.set("pedidos", pedidos); }, [pedidos, carregando]);
  useEffect(() => { if (!carregando) store.set("historico", historico); }, [historico, carregando]);
  useEffect(() => { if (!carregando) store.set("usuarios", usuarios); }, [usuarios, carregando]);
  useEffect(() => { if (!carregando) store.set("mensagens", mensagens); }, [mensagens, carregando]);
  useEffect(() => { if (!carregando) store.set("diario", diario); }, [diario, carregando]);
  useEffect(() => { if (!carregando) store.set("ativos", ativos); }, [ativos, carregando]);
  useEffect(() => { if (!carregando) store.set("abastecimentos", abastecimentos); }, [abastecimentos, carregando]);
  useEffect(() => { if (!carregando) store.set("ferias", ferias); }, [ferias, carregando]);
  useEffect(() => { if (!carregando) store.set("rdos", rdosEmitidos); }, [rdosEmitidos, carregando]);
  useEffect(() => { if (!carregando) store.set("empresa", empresa); }, [empresa, carregando]);
  useEffect(() => { if (!carregando) store.set("produtividade", produtividade); }, [produtividade, carregando]);
  useEffect(() => { if (!carregando) store.set("recebimentos", recebimentos); }, [recebimentos, carregando]);
  useEffect(() => { if (!carregando) store.set("movimentacoes", movimentacoes); }, [movimentacoes, carregando]);
  useEffect(() => { if (!carregando) store.set("ferramentas", ferramentas); }, [ferramentas, carregando]);
  useEffect(() => { if (!carregando) store.set("links", links); }, [links, carregando]);
  useEffect(() => { if (!carregando) store.set("adiantamentos", adiantamentos); }, [adiantamentos, carregando]);
  useEffect(() => { if (!carregando) store.set("manutencoes", manutencoes); }, [manutencoes, carregando]);
  useEffect(() => { if (!carregando) store.set("folhasSalvas", folhasSalvas); }, [folhasSalvas, carregando]);
  useEffect(() => { if (!carregando) store.set("cronogramas", cronogramas); }, [cronogramas, carregando]);
  useEffect(() => { if (!carregando) store.set("movEquip", movEquip); }, [movEquip, carregando]);
  useEffect(() => { if (!carregando) store.set("despesasAvulsas", despesasAvulsas); }, [despesasAvulsas, carregando]);
  useEffect(() => { if (!carregando) store.set("fotosObras", fotosObras); }, [fotosObras, carregando]);
  useEffect(() => { if (!carregando) store.set("fornecedores", fornecedores); }, [fornecedores, carregando]);

  const salvarPresencas = (novas) => setHistorico(h => ({ ...h, [hojeStr()]: { ...(h[hojeStr()] || {}), ...novas } }));
  const verTrabalhador = (t) => { setTrabSelecionado(t); setTela("trab_detalhe"); };
  const editarTrabalhador = (t) => {
    setTrab(ts => ts.map(x => x.id === t.id ? t : x));
    setTrabSelecionado(t);
  };
  const restaurarBackup = (dados) => {
    if (dados.obras) setObras(dados.obras);
    if (dados.trabalhadores) setTrab(dados.trabalhadores);
    if (dados.equips) setEquips(dados.equips);
    if (dados.pedidos) setPedidos(dados.pedidos);
    if (dados.historico) setHistorico(dados.historico);
    if (dados.usuarios) setUsuarios(dados.usuarios);
    if (dados.mensagens) setMensagens(dados.mensagens);
    if (dados.diario) setDiario(dados.diario);
    if (dados.ativos) setAtivos(dados.ativos);
    if (dados.abastecimentos) setAbast(dados.abastecimentos);
    if (dados.ferias) setFerias(dados.ferias);
    if (dados.rdosEmitidos) setRdos(dados.rdosEmitidos);
    if (dados.empresa) setEmpresa(dados.empresa);
    if (dados.produtividade) setProd(dados.produtividade);
    if (dados.recebimentos) setReceb(dados.recebimentos);
    if (dados.movimentacoes) setMov(dados.movimentacoes);
    if (dados.ferramentas) setFerr(dados.ferramentas);
    if (dados.links) setLinks(dados.links);
    if (dados.adiantamentos) setAdiant(dados.adiantamentos);
    if (dados.manutencoes) setManut(dados.manutencoes);
    if (dados.folhasSalvas) setFolhasSalvas(dados.folhasSalvas);
    if (dados.cronogramas) setCronog(dados.cronogramas);
    if (dados.movEquip) setMovEquip(dados.movEquip);
    if (dados.despesasAvulsas) setDespesasAvulsas(dados.despesasAvulsas);
    if (dados.fotosObras) setFotosObras(dados.fotosObras);
    if (dados.fornecedores) setFornecedores(dados.fornecedores);
  };

  const login = (u) => {
    setUsuario(u);
    store.set("usuarioLogado", u);
    if (u.perfil === "gestor") setTela("gestor");
    else setTela("home");
  };

  // Atualizar usuário (PIN, biometria, etc) — persiste em usuarios + atualiza logado
  const atualizarUsuario = (uAtualizado) => {
    setUsuarios(us => us.map(x => x.id === uAtualizado.id ? uAtualizado : x));
    if (usuario?.id === uAtualizado.id) {
      setUsuario(uAtualizado);
      store.set("usuarioLogado", uAtualizado);
    }
  };

  // Helper: pra onde voltar baseado no perfil
  const telaInicial = () => {
    if (!usuario) return "login";
    if (usuario.perfil === "gestor") return "gestor";
    return "home";
  };
  const logout = async () => {
    try { await logoutFirebase(); } catch (e) {}
    setUsuario(null);
    store.set("usuarioLogado", null);
    setTela("login");
  };
  const trabObra = trabalhadores.filter(t => t.obraId === obraAtual?.id);

  const todoEstado = { obras, trabalhadores, equips, pedidos, historico, usuarios, mensagens, diario, ativos, abastecimentos, ferias, rdosEmitidos, empresa, produtividade, recebimentos, movimentacoes, ferramentas, links, adiantamentos, manutencoes, folhasSalvas, cronogramas, movEquip, despesasAvulsas, fotosObras, fornecedores };

  // Aprovar movimentação: se for "definitivo" muda obra do trabalhador
  const salvarManutencao = (m) => {
    setManut(ms => {
      const existe = ms.find(x => x.id === m.id);
      if (existe) return ms.map(x => x.id === m.id ? m : x);
      return [...ms, m];
    });
  };

  const aprovarMov = (m) => {
    setMov(ms => ms.map(x => x.id === m.id ? { ...x, status: "Aprovado" } : x));
    if (m.tipo === "definitivo") {
      setTrab(ts => ts.map(t => t.id === m.trabId ? { ...t, obraId: m.obraDestino } : t));
    }
    // Para "hoje" registramos transferência temporária no histórico (apenas marca)
  };

  // Movimentação de Equipamentos
  const movEquipSolicitar = (m) => {
    setMovEquip(arr => [m, ...arr]);
    // Se já vem aprovado (gestor), aplica mudança imediata
    if (m.status === "Aprovado") {
      if (m.tipoItem === "equipamento") {
        setEquips(es => es.map(e => e.id === m.itemId ? { ...e, obraId: m.obraDestinoId } : e));
      } else if (m.tipoItem === "ferramenta") {
        setFerr(fs => fs.map(f => f.id === m.itemId ? { ...f, obraId: m.obraDestinoId } : f));
      }
    }
  };

  const movEquipAprovar = (id) => {
    const m = movEquip.find(x => x.id === id);
    if (!m) return;
    setMovEquip(arr => arr.map(x => x.id === id ? { ...x, status: "Aprovado" } : x));
    // Move o item pra obra destino
    if (m.tipoItem === "equipamento") {
      setEquips(es => es.map(e => e.id === m.itemId ? { ...e, obraId: m.obraDestinoId } : e));
    } else if (m.tipoItem === "ferramenta") {
      setFerr(fs => fs.map(f => f.id === m.itemId ? { ...f, obraId: m.obraDestinoId } : f));
    }
  };

  const movEquipNegar = (id) => {
    setMovEquip(arr => arr.map(x => x.id === id ? { ...x, status: "Negado" } : x));
  };

  const movEquipDevolver = (id, transferencia = false) => {
    const m = movEquip.find(x => x.id === id);
    if (!m) return;
    setMovEquip(arr => arr.map(x => x.id === id ? { ...x, status: transferencia ? "Concluído" : "Devolvido", dataDevolucao: new Date().toLocaleDateString("pt-BR") } : x));
    // Se for empréstimo (não transferência), volta o item pra obra origem
    if (!transferencia) {
      if (m.tipoItem === "equipamento") {
        setEquips(es => es.map(e => e.id === m.itemId ? { ...e, obraId: m.obraOrigemId } : e));
      } else if (m.tipoItem === "ferramenta") {
        setFerr(fs => fs.map(f => f.id === m.itemId ? { ...f, obraId: m.obraOrigemId } : f));
      }
    }
  };

  if (carregando) return (
    <div style={{ flex: 1, background: `linear-gradient(175deg,${NAVY},#071030)`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <div style={{ fontSize: 52, fontWeight: 900, color: "#fff", letterSpacing: -2 }}>KM<span style={{ color: GOLD }}>ZERO</span></div>
      <div style={{ color: "rgba(255,255,255,0.5)", marginTop: 16, fontSize: 13 }}>Carregando...</div>
    </div>
  );

  // 🔒 SEGURANÇA: telas restritas ao gestor (encarregado não tem acesso)
  const TELAS_GESTOR = new Set([
    "gestor", "obras", "cronograma", "cronograma_pro", "equipe", "trab_detalhe", "fichas",
    "ativos", "frota", "manutencoes", "equipamentos_gestao", "ferramentas_gestao",
    "custos", "folha", "folha_mensal", "historico", "adiantamentos", "movimentacoes",
    "dashboard", "diagnostico", "consolidado", "mapa", "calendario", "alertas",
    "fornecedores", "empresa", "minha_conta", "ajuda", "acessos", "backup", "gerar_simulacao", "zerar_tudo",
    "aso_aniversarios", "ferias", "contatos_emergencia", "links", "produtividade_gestor",
    "pedidos", "pedido_detalhe", "despesas_avulsas", "mov_pess_detalhe",
    "recebimentos_gestor", "comissionamento"
  ]);

  // Se for encarregado e tentar acessar tela do gestor, bloqueia
  if (usuario && usuario.perfil === "encarregado" && TELAS_GESTOR.has(tela)) {
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <KMHeader title="Acesso restrito" sub="Apenas gestores" onBack={() => setTela("home")} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 30, textAlign: "center" }}>
          <div>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Acesso Restrito</div>
            <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5, marginBottom: 20 }}>
              Esta área é apenas para o gestor.<br/>
              Se precisar, fale com o Kleber.
            </div>
            <button onClick={() => setTela("home")} style={{ background: NAVY, color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              ← Voltar ao Início
            </button>
          </div>
        </div>
        <KMFooter />
      </div>
    );
  }

  const render = () => {
    switch (tela) {
      case "login":      return <TelaLogin usuarios={usuarios} obras={obras} onLogin={login} onAtualizarUsuario={atualizarUsuario} />;
      case "home":       return <TelaHome obra={obraAtual} usuario={usuario} mensagens={mensagens} trabalhadores={trabObra} presencasHoje={presencasHoje} onNav={setTela} onLogout={logout} />;
      case "fluxo":      return <FluxoEncarregado obra={obraAtual} trabalhadores={trabObra} equips={equips} ativos={ativos} abastecimentos={abastecimentos} pedidos={pedidos} diario={diario} usuario={usuario} empresa={empresa} historico={historico} rdosEmitidos={rdosEmitidos} fotosObras={fotosObras} onBack={() => setTela("home")} onSavePresencas={salvarPresencas} onAutoEmitirRDO={r => setRdos(rs => [r, ...rs])} onSalvarFotoObra={f => setFotosObras(fs => [f, ...fs])} />;
      case "material":   return <TelaMaterial obra={obraAtual} usuario={usuario} onBack={() => setTela("home")} onAddPedido={p => setPedidos(ps => [p, ...ps])} />;
      case "fotos_solo": return <TelaFotos obra={obraAtual} usuario={usuario} totalFotosObra={fotosObras.filter(f => f.obraId === obraAtual?.id).length} onBack={() => setTela("home")} onSalvar={f => setFotosObras(fs => [f, ...fs])} />;
      case "galeria":    return <TelaGaleria obras={obras} fotos={fotosObras} usuario={usuario} onBack={voltar} onRemover={id => setFotosObras(fs => fs.filter(f => f.id !== id))} />;
      case "fornecedores": return <TelaFornecedores fornecedores={fornecedores} onBack={voltar} onAdd={f => setFornecedores(fs => [...fs, f])} onEditar={f => setFornecedores(fs => fs.map(x => x.id === f.id ? f : x))} onRemover={id => setFornecedores(fs => fs.filter(x => x.id !== id))} />;
      case "equip_solo": return <TelaEquip obra={obraAtual} equips={equips} onBack={() => setTela("home")} onSaveEquips={updated => setEquips(es => es.map(e => { const u = updated.find(u => u.id === e.id); return u || e; }))} />;
      case "diario":     return <TelaDiario obra={obraAtual} usuario={usuario} diario={diario} fotosObras={fotosObras} onBack={voltar} onAdd={d => setDiario(ds => [d, ...ds])} onRemove={id => setDiario(ds => ds.filter(d => d.id !== id))} onSalvarFotoObra={f => setFotosObras(fs => [f, ...fs])} />;
      case "gestor":     return <TelaPainelGestor obras={obras} trabalhadores={trabalhadores} pedidos={pedidos} equips={equips} historico={historico} mensagens={mensagens} movimentacoes={movimentacoes} manutencoes={manutencoes} cronogramas={cronogramas} movEquip={movEquip} ativos={ativos} abastecimentos={abastecimentos} empresa={empresa} usuario={usuario} onNav={setTela} onLogout={logout} onAprovar={(id, extras = {}) => setPedidos(ps => ps.map(p => p.id === id ? { ...p, status: "Aprovado", ...extras } : p))} onNegar={id => setPedidos(ps => ps.map(p => p.id === id ? { ...p, status: "Negado" } : p))} />;
      case "obras":      return <TelaObras obras={obras} trabalhadores={trabalhadores} ativos={ativos} equips={equips} ferramentas={ferramentas} pedidos={pedidos} abastecimentos={abastecimentos} manutencoes={manutencoes} cronogramas={cronogramas} historico={historico} recebimentos={recebimentos} rdosEmitidos={rdosEmitidos} onBack={voltar} onAdd={o => setObras(os => [...os, o])} onEditar={o => setObras(os => os.map(x => x.id === o.id ? o : x))} onRemover={id => setObras(os => os.filter(o => o.id !== id))} onNav={setTela} onNavAnexos={(obra) => { setObraAnexos(obra); setTela("anexos_obra"); }} />;
      case "cronograma": return <TelaCronograma obras={obras} cronogramas={cronogramas} onBack={voltar} onSalvar={(obraId, etapas) => setCronog(c => ({ ...c, [obraId]: etapas }))} />;
      case "cronograma_pro": return <TelaCronogramaPro obras={obras} cronogramas={cronogramas} onBack={voltar} onSalvar={(obraId, etapas) => setCronog(c => ({ ...c, [obraId]: etapas }))} />;
      case "mov_equip":  return <TelaMovEquip obras={obras} equips={equips} ferramentas={ferramentas} movEquip={movEquip} usuario={usuario} onBack={voltar} onSolicitar={movEquipSolicitar} onAprovar={movEquipAprovar} onNegar={movEquipNegar} onDevolver={movEquipDevolver} onVerDetalhe={m => { setMovEquipSel(m); setTela("mov_equip_detalhe"); }} />;
      case "mov_equip_detalhe": return movEquipSel ? <TelaMovEquipDetalhe mov={movEquip.find(x => x.id === movEquipSel.id) || movEquipSel} obras={obras} equips={equips} ferramentas={ferramentas} usuario={usuario} onBack={voltar} onAprovar={movEquipAprovar} onNegar={movEquipNegar} onDevolver={movEquipDevolver} /> : <TelaMovEquip obras={obras} equips={equips} ferramentas={ferramentas} movEquip={movEquip} usuario={usuario} onBack={voltar} onSolicitar={movEquipSolicitar} onAprovar={movEquipAprovar} onNegar={movEquipNegar} onDevolver={movEquipDevolver} />;
      case "equipe":     return <TelaEquipe obras={obras} trabalhadores={trabalhadores} usuarios={usuarios} onBack={voltar} onAdd={(t, login) => {
        setTrab(ts => [...ts, t]);
        // Se o gestor pediu pra criar login, gera usuário também
        if (login && login.email) {
          const novoUsuario = {
            id: Date.now() + 1,
            nome: t.nome,
            email: login.email.toLowerCase().trim(),
            senha: login.senha || "123",
            pin: "",
            biometriaAtiva: false,
            perfil: "encarregado",
            obraId: t.obraId,
            tel: t.tel || "",
          };
          setUsuarios(us => [...us, novoUsuario]);
          setTimeout(() => alert(`✅ Login criado!\n\n📧 Email: ${novoUsuario.email}\n🔑 Senha: ${novoUsuario.senha}\n\nAnote e passe pra ${t.nome}. No primeiro acesso ela cria o PIN.`), 200);
        }
      }} onRemove={(id) => {
        // Remove trabalhador
        const trab = trabalhadores.find(t => t.id === id);
        setTrab(ts => ts.filter(t => t.id !== id));
        // Verifica se tem usuário com mesmo nome (login no sistema)
        if (trab) {
          const usuarioVinculado = usuarios.find(u => u.nome.toLowerCase().trim() === trab.nome.toLowerCase().trim() && u.perfil !== "gestor");
          if (usuarioVinculado) {
            setTimeout(() => {
              confirmar(`Também remover o LOGIN de "${trab.nome}" do sistema?\n\n(Ele não aparecerá mais na tela de login)`, () => {
                setUsuarios(us => us.filter(u => u.id !== usuarioVinculado.id));
              });
            }, 300);
          }
        }
      }} onVerDetalhe={verTrabalhador} />;
      case "ficha":      return <TelaFicha obras={obras} onBack={voltar} onAdd={t => setTrab(ts => [...ts, t])} />;
      case "relatorio":  return <TelaRelatorio obras={obras} trabalhadores={trabalhadores} pedidos={pedidos} presencasHoje={presencasHoje} onBack={voltar} />;
      case "consolidado":return <TelaRelatorioConsolidado obras={obras} trabalhadores={trabalhadores} pedidos={pedidos} historico={historico} onBack={voltar} />;
      case "dashboard":  return <TelaDashboard obras={obras} trabalhadores={trabalhadores} pedidos={pedidos} historico={historico} onBack={voltar} />;
      case "alertas":    return <TelaAlertas obras={obras} trabalhadores={trabalhadores} equips={equips} pedidos={pedidos} historico={historico} manutencoes={manutencoes} cronogramas={cronogramas} movEquip={movEquip} ativos={ativos} abastecimentos={abastecimentos} onBack={voltar} onNav={setTela} />;
      case "pedidos":    return <TelaPedidos obras={obras} pedidos={pedidos} empresa={empresa} usuario={usuario} fornecedores={fornecedores} onBack={voltar} onVerDetalhe={p => { setPedidoSelecionado(p); setTela("pedido_detalhe"); }} onAprovar={(id, extras = {}) => setPedidos(ps => ps.map(p => p.id === id ? { ...p, status: "Aprovado", ...extras } : p))} onNegar={id => setPedidos(ps => ps.map(p => p.id === id ? { ...p, status: "Negado" } : p))} onRemover={id => setPedidos(ps => ps.filter(p => p.id !== id))} onCriar={p => setPedidos(ps => [p, ...ps])} />;
      case "pedido_detalhe": return pedidoSelecionado ? <TelaPedidoDetalhe pedido={pedidos.find(x => x.id === pedidoSelecionado.id) || pedidoSelecionado} obras={obras} empresa={empresa} onBack={voltar} onAprovar={(id, extras = {}) => setPedidos(ps => ps.map(p => p.id === id ? { ...p, status: "Aprovado", ...extras } : p))} onNegar={id => setPedidos(ps => ps.map(p => p.id === id ? { ...p, status: "Negado" } : p))} onRemover={id => setPedidos(ps => ps.filter(p => p.id !== id))} onEditar={pedidoAtualizado => setPedidos(ps => ps.map(p => p.id === pedidoAtualizado.id ? pedidoAtualizado : p))} /> : <TelaPedidos obras={obras} pedidos={pedidos} empresa={empresa} onBack={voltar} onVerDetalhe={p => { setPedidoSelecionado(p); setTela("pedido_detalhe"); }} onAprovar={(id, extras = {}) => setPedidos(ps => ps.map(p => p.id === id ? { ...p, status: "Aprovado", ...extras } : p))} onNegar={id => setPedidos(ps => ps.map(p => p.id === id ? { ...p, status: "Negado" } : p))} onRemover={id => setPedidos(ps => ps.filter(p => p.id !== id))} />;
      case "mapa":       return <TelaMapa obras={obras} trabalhadores={trabalhadores} onBack={voltar} onEditar={() => setTela("obras")} />;
      case "trab_detalhe": return <TelaTrabalhadorDetalhe trabalhador={trabSelecionado} obras={obras} historico={historico} rdosEmitidos={rdosEmitidos} empresa={empresa} onBack={voltar} onEditar={editarTrabalhador} />;
      case "mensagens":  return <TelaMensagens usuario={usuario} usuarios={usuarios} mensagens={mensagens} onBack={voltar} onEnviar={m => setMensagens(ms => [m, ...ms])} onMarcarLida={id => setMensagens(ms => ms.map(m => m.id === id ? { ...m, lida: true } : m))} />;
      case "calendario": return <TelaCalendario obras={obras} trabalhadores={trabalhadores} historico={historico} onBack={voltar} />;
      case "folha":      return <TelaFolha obras={obras} trabalhadores={trabalhadores} historico={historico} onBack={voltar} />;
      case "equip_gestao":return <TelaEquipamentosGestao obras={obras} equips={equips} onBack={voltar} onAdd={eq => setEquips(es => [...es, eq])} onEditar={eq => setEquips(es => es.map(x => x.id === eq.id ? eq : x))} onRemover={id => setEquips(es => es.filter(e => e.id !== id))} />;
      case "ativos":     return <TelaAtivos obras={obras} ativos={ativos} abastecimentos={abastecimentos} onBack={voltar} onAdd={a => setAtivos(as => [...as, a])} onEditar={a => setAtivos(as => as.map(x => x.id === a.id ? a : x))} onRemover={id => setAtivos(as => as.filter(a => a.id !== id))} onAbastecer={a => setAbast(abs => [a, ...abs])} />;
      case "frota":      return <TelaFrota obras={obras} ativos={ativos} abastecimentos={abastecimentos} onBack={voltar} onNav={setTela} />;
      case "custos":     return <TelaCustos obras={obras} trabalhadores={trabalhadores} historico={historico} ativos={ativos} abastecimentos={abastecimentos} pedidos={pedidos} despesasAvulsas={despesasAvulsas} onBack={voltar} />;
      case "despesas":   return <TelaDespesasAvulsas obras={obras} despesas={despesasAvulsas} onBack={voltar} onAdd={d => setDespesasAvulsas(arr => [d, ...arr])} onEditar={d => setDespesasAvulsas(arr => arr.map(x => x.id === d.id ? d : x))} onRemover={id => setDespesasAvulsas(arr => arr.filter(x => x.id !== id))} />;
      case "ferias":     return <TelaFerias obras={obras} trabalhadores={trabalhadores} ferias={ferias} onBack={voltar} onAdd={f => setFerias(fs => [...fs, f])} onRemove={id => setFerias(fs => fs.filter(f => f.id !== id))} />;
      case "rdo":        return <TelaRDO obras={obras} trabalhadores={trabalhadores} ativos={ativos} abastecimentos={abastecimentos} pedidos={pedidos} historico={historico} diario={diario} usuario={usuario} empresa={empresa} rdosEmitidos={rdosEmitidos} recebimentos={recebimentos} fotosObras={fotosObras} despesasAvulsas={despesasAvulsas} movimentacoes={movimentacoes} movEquip={movEquip} produtividade={produtividade} cronogramas={cronogramas} onBack={voltar} onEmitirRDO={r => setRdos(rs => [r, ...rs])} onUpdateRDO={r => setRdos(rs => rs.map(x => x.id === r.id ? r : x))} onRemoveRDO={id => setRdos(rs => rs.filter(x => x.id !== id))} />;
      case "empresa":    return <TelaConfigEmpresa empresa={empresa} onSave={setEmpresa} onBack={voltar} />;
      case "minha_conta": return <TelaMinhaConta usuario={usuario} empresa={empresa} onBack={voltar} onLogout={logout} />;
      case "ajuda":      return <TelaAjuda empresa={empresa} onBack={voltar} />;
      case "acessos":    return <TelaAcessosApp usuarios={usuarios} obras={obras} onBack={voltar} onAdd={u => setUsuarios(us => [...us, u])} onEditar={u => setUsuarios(us => us.map(x => x.id === u.id ? u : x))} onRemover={id => setUsuarios(us => us.filter(u => u.id !== id))} />;
      case "perfil_pin": return <TelaPerfilPIN usuario={usuario} onAtualizar={atualizarUsuario} onBack={voltar} />;
      case "produtividade": return <TelaProdutividade obras={obras} usuario={usuario} produtividade={produtividade} onBack={voltar} onAdd={p => setProd(ps => [p, ...ps])} onRemove={id => setProd(ps => ps.filter(p => p.id !== id))} />;
      case "recebimento":   return <TelaRecebimento obras={obras} pedidos={pedidos} usuario={usuario} recebimentos={recebimentos} onBack={voltar} onAdd={r => setReceb(rs => [r, ...rs])} />;
      case "folha_quinzenal": return <TelaFolhaQuinzenal obras={obras} trabalhadores={trabalhadores} historico={historico} adiantamentos={adiantamentos} abastecimentos={abastecimentos} ativos={ativos} empresa={empresa} onBack={voltar} onSalvarFolha={f => setFolhasSalvas(fs => [f, ...fs])} />;
      case "hist_folha":      return <TelaHistFolha obras={obras} trabalhadores={trabalhadores} folhasSalvas={folhasSalvas} onBack={voltar} onRemover={id => setFolhasSalvas(fs => fs.filter(f => f.id !== id))} />;
      case "manutencao":      return <TelaManutencao obras={obras} ativos={ativos} ferramentas={ferramentas} equips={equips} manutencoes={manutencoes} onBack={voltar} onAdd={salvarManutencao} onRemover={id => setManut(ms => ms.filter(m => m.id !== id))} />;
      case "solicitar_mov": return <TelaSolicitarMov obras={obras} trabalhadores={trabalhadores} usuario={usuario} onBack={() => setTela("home")} onSolicitar={m => setMov(ms => [m, ...ms])} />;
      case "aprovar_mov":   return <TelaAprovarMov obras={obras} trabalhadores={trabalhadores} movimentacoes={movimentacoes} onBack={voltar} onAprovar={aprovarMov} onNegar={id => setMov(ms => ms.map(m => m.id === id ? { ...m, status: "Negado" } : m))} onVerDetalhe={m => { setMovPessSel(m); setTela("mov_pess_detalhe"); }} />;
      case "mov_pess_detalhe": return movPessSel ? <TelaMovPessoalDetalhe mov={movimentacoes.find(x => x.id === movPessSel.id) || movPessSel} obras={obras} trabalhadores={trabalhadores} onBack={voltar} onAprovar={aprovarMov} onNegar={id => setMov(ms => ms.map(m => m.id === id ? { ...m, status: "Negado" } : m))} /> : <TelaAprovarMov obras={obras} trabalhadores={trabalhadores} movimentacoes={movimentacoes} onBack={voltar} onAprovar={aprovarMov} onNegar={id => setMov(ms => ms.map(m => m.id === id ? { ...m, status: "Negado" } : m))} />;
      case "ferramentas":   return <TelaFerramentas obras={obras} ferramentas={ferramentas} onBack={voltar} onAdd={f => setFerr(fs => [...fs, f])} onEditar={f => setFerr(fs => fs.map(x => x.id === f.id ? f : x))} onRemover={id => setFerr(fs => fs.filter(f => f.id !== id))} />;
      case "rh":            return <TelaRH obras={obras} trabalhadores={trabalhadores} onBack={voltar} onVerTrabalhador={verTrabalhador} />;
      case "exames":        return <TelaExames obras={obras} trabalhadores={trabalhadores} onBack={voltar} onVerTrabalhador={verTrabalhador} />;
      case "links":         return <TelaLinks links={links} onBack={voltar} onAdd={l => setLinks(ls => [...ls, l])} onRemover={id => setLinks(ls => ls.filter(l => l.id !== id))} />;
      case "diagnostico":   return <TelaDiagnostico onNav={setTela} onBack={voltar} />;
      case "contatos":      return <TelaContatos obras={obras} trabalhadores={trabalhadores} usuarios={usuarios} onBack={voltar} onVerTrabalhador={verTrabalhador} />;
      case "adiantamentos": return <TelaAdiantamentos obras={obras} trabalhadores={trabalhadores} adiantamentos={adiantamentos} onBack={voltar} onAdd={a => setAdiant(ads => [a, ...ads])} onRemove={id => setAdiant(ads => ads.filter(a => a.id !== id))} />;
      case "backup":     return <TelaBackup todoEstado={todoEstado} onRestaurar={restaurarBackup} onBack={voltar} />;
      case "anexos_obra": return obraAnexos ? <TelaAnexosObra obra={obraAnexos} usuario={usuario} onBack={voltar} /> : <TelaObras obras={obras} trabalhadores={trabalhadores} ativos={ativos} equips={equips} ferramentas={ferramentas} pedidos={pedidos} abastecimentos={abastecimentos} manutencoes={manutencoes} cronogramas={cronogramas} historico={historico} recebimentos={recebimentos} rdosEmitidos={rdosEmitidos} onBack={voltar} onAdd={o => setObras(os => [...os, o])} onEditar={o => setObras(os => os.map(x => x.id === o.id ? o : x))} onRemover={id => setObras(os => os.filter(o => o.id !== id))} onNav={setTela} />;

      case "zerar_tudo": return <TelaZerarTudo
        onBack={voltar}
        onZerar={() => {
          setHistorico({});
          setRdos([]);
          setPedidos([]);
          setFotosObras([]);
          setDespesasAvulsas([]);
          setMov([]);
          setMovEquip([]);
          setDiario([]);
          setAdiant([]);
          setReceb([]);
          setAbast([]);
          setProd([]);
          setFolhasSalvas([]);
          setMensagens([]);
          setManut([]);
          alert("✅ Tudo zerado!\n\nO app está pronto pra começar do zero com dados reais.");
          voltar();
        }}
        onResetTotal={() => {
          try {
            // Limpa TUDO do localStorage (não só do kmzero, mas pelo prefixo)
            const keys = Object.keys(localStorage).filter(k => k.startsWith("kmzero_"));
            keys.forEach(k => localStorage.removeItem(k));

            // Avisa e recarrega — o useEffect inicial vai carregar os defaults limpos
            alert("💣 RESET TOTAL CONCLUÍDO!\n\nVou recarregar a página agora.");
            window.location.reload();
          } catch (e) {
            console.error("Erro no reset:", e);
            alert("❌ Erro: " + (e && e.message ? e.message : e));
          }
        }}
      />;

      case "gerar_simulacao": return <TelaGerarSimulacao onGerar={() => {
        confirmar("⚠️ ATENÇÃO!\n\nIsto vai SUBSTITUIR todos os RDOs, pedidos, fotos, despesas, presenças, etc.\n\nUse apenas pra testar o app.\n\nDeseja continuar?", () => {
          const sim = gerarDadosMes30Dias();
          setHistorico(sim.historico);
          setFotosObras(sim.fotosObras);
          setRdos(sim.rdosEmitidos);
          setPedidos(sim.pedidos);
          setMov(sim.movimentacoes);
          setMovEquip(sim.movEquip);
          setDiario(sim.diario);
          setDespesasAvulsas(sim.despesasAvulsas);
          setAdiant(sim.adiantamentos);
          setReceb(sim.recebimentos);
          setAbast(sim.abastecimentos);
          setProd(sim.produtividade);
          alert("✅ 30 dias gerados!\n\nAgora você pode ver o app com tudo preenchido.");
          voltar();
        });
      }} onBack={voltar} />;
      default:           return <TelaLogin usuarios={usuarios} obras={obras} onLogin={login} onAtualizarUsuario={atualizarUsuario} />;
    }
  };

  return (
    <div style={{ fontFamily: "'Segoe UI',sans-serif", backgroundColor: "#0a1535", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      {/* SPLASH SCREEN */}
      {splashAtivo && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "linear-gradient(135deg, #0a1535 0%, #0F2151 50%, #1e3a8a 100%)",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          animation: "kmSplashFade 0.4s ease-out",
        }}>
          <style>{`
            @keyframes kmSplashFade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes kmSplashPulse {
              0%, 100% { transform: scale(1); text-shadow: 0 0 20px rgba(245,166,35,0.4); }
              50% { transform: scale(1.04); text-shadow: 0 0 50px rgba(245,166,35,0.8); }
            }
            @keyframes kmSplashLine {
              0% { width: 0; opacity: 0; }
              50% { opacity: 1; }
              100% { width: 80px; opacity: 1; }
            }
            @keyframes kmSplashTagline {
              0% { opacity: 0; transform: translateY(10px); }
              60% { opacity: 0; }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes kmSplashOrb {
              0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.4; }
              50% { transform: scale(1.2) translate(20px, -20px); opacity: 0.7; }
            }
          `}</style>

          {/* Orbs decorativos */}
          <div style={{
            position: "absolute", top: "-100px", right: "-100px",
            width: 350, height: 350, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(245,166,35,0.35), transparent 70%)",
            filter: "blur(40px)",
            animation: "kmSplashOrb 4s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute", bottom: "-100px", left: "-100px",
            width: 300, height: 300, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,58,237,0.3), transparent 70%)",
            filter: "blur(40px)",
            animation: "kmSplashOrb 5s ease-in-out infinite reverse",
          }} />

          {/* Logo central */}
          <div style={{ textAlign: "center", zIndex: 1 }}>
            <div style={{
              fontSize: 12, color: "rgba(255,255,255,0.5)",
              letterSpacing: 5, fontWeight: 600, marginBottom: 14,
              textTransform: "uppercase",
            }}>
              🏗️ Gestão de Obras
            </div>
            <div style={{ animation: "kmSplashPulse 2.5s ease-in-out infinite" }}>
              <span style={{ fontWeight: 900, fontSize: 64, color: "#fff", letterSpacing: -2 }}>KM</span>
              <span style={{ fontWeight: 900, fontSize: 64, color: "#F5A623", letterSpacing: -2 }}>ZERO</span>
            </div>
            <div style={{
              height: 3, background: "#F5A623", margin: "14px auto", borderRadius: 2,
              animation: "kmSplashLine 1s ease-out forwards",
              boxShadow: "0 0 12px rgba(245,166,35,0.6)",
            }} />
            <div style={{
              fontSize: 13, color: "rgba(255,255,255,0.65)", fontStyle: "italic",
              animation: "kmSplashTagline 1.8s ease-out forwards",
              opacity: 0,
            }}>
              KM Consultoria · Engenharia Civil
            </div>
          </div>

          {/* Footer da splash */}
          <div style={{
            position: "absolute", bottom: 30, left: 0, right: 0,
            textAlign: "center",
            fontSize: 10, color: "rgba(255,255,255,0.35)",
            letterSpacing: 3, fontWeight: 600,
          }}>
            CARREGANDO...
          </div>
        </div>
      )}
      <style>{`
        /* Responsividade adaptável */
        @media (min-width: 768px) {
          .km-app-wrapper {
            max-width: 480px !important;
          }
        }
        @media (min-width: 1024px) {
          .km-app-wrapper {
            max-width: 520px !important;
          }
        }
        /* Ajustes para telas pequenas */
        @media (max-width: 380px) {
          .km-app-wrapper {
            max-width: 100% !important;
            box-shadow: none !important;
          }
        }
        /* Touch targets mínimos pro mobile */
        button { min-height: 32px; touch-action: manipulation; }
        input, select, textarea { min-height: 36px; touch-action: manipulation; font-size: 16px !important; /* evita zoom no iOS */ }
        @media (min-width: 768px) {
          input, select, textarea { font-size: 14px !important; }
        }
        /* Transição suave entre telas */
        @keyframes kmTelaEntra {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .km-tela-transicao {
          animation: kmTelaEntra 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (prefers-reduced-motion: reduce) {
          .km-tela-transicao { animation: none; }
        }
      `}</style>
      <div className="km-app-wrapper" style={{ width: "100%", maxWidth: 420, minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#fff", position: "relative", boxShadow: "0 0 60px rgba(0,0,0,0.5)" }}>
        <div key={tela} className="km-tela-transicao" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          {render()}
        </div>
      </div>
    </div>
  );
}
