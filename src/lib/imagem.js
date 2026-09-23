/* ════════════════════════════════════
   IMAGEM — reduz fotos antes de gravar
   Uma foto de celular (12 MP, 3-5 MB) vira um JPEG de no máximo ~1600 px
   (~200-400 KB). Nunca amplia: imagem menor que ladoMax só é recomprimida.
════════════════════════════════════ */

function carregarImagem(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível ler a imagem")); };
    img.src = url;
  });
}

/**
 * Reduz uma imagem (File/Blob) e devolve um data URL pronto pra gravar.
 * @param {File|Blob} file
 * @param {{ ladoMax?: number, qualidade?: number, manterPng?: boolean }} [opts]
 *   ladoMax   — maior lado em pixels (padrão 1600). Mantém a proporção; nunca amplia.
 *   qualidade — qualidade do JPEG, de 0 a 1 (padrão 0.85).
 *   manterPng — se true e o arquivo for PNG (logo com transparência), sai PNG em vez de JPEG.
 * @returns {Promise<string>} data URL image/jpeg (ou image/png quando manterPng)
 */
export async function reduzirImagem(file, { ladoMax = 1600, qualidade = 0.85, manterPng = false } = {}) {
  if (!file) throw new Error("Arquivo vazio");
  const img = await carregarImagem(file);
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  if (!w0 || !h0) throw new Error("Imagem inválida");

  const escala = Math.min(1, ladoMax / Math.max(w0, h0)); // nunca amplia
  const w = Math.max(1, Math.round(w0 * escala));
  const h = Math.max(1, Math.round(h0 * escala));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const sairPng = manterPng && file.type === "image/png";
  if (!sairPng) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); } // JPEG não tem transparência
  ctx.drawImage(img, 0, 0, w, h);

  return sairPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", qualidade);
}
