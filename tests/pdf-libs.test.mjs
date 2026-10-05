import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { carregarPDFLibs } from "../src/lib/pdf.js";

test("bibliotecas locais mantêm geração de PDF com JPEG e múltiplas páginas", async () => {
  const { html2canvas, jsPDF } = await carregarPDFLibs();
  assert.equal(typeof html2canvas, "function");
  assert.equal(typeof jsPDF, "function");
  const imagem = await readFile(new URL("../public/projetos/rodoviaria-sooretama/assets/render-01.jpg", import.meta.url));
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [210, 297] });
  pdf.addImage(new Uint8Array(imagem), "JPEG", 0, 0, 210, 118, "pagina-1", "FAST");
  pdf.addPage([210, 297], "portrait");
  pdf.text("Documento KMZERO", 10, 15);
  assert.equal(pdf.getNumberOfPages(), 2);
  const bytes = new Uint8Array(pdf.output("arraybuffer"));
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  assert.ok(bytes.length > 1000);
});
