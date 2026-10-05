import { referenciaFoto, MAX_FOTO_BYTES, MAX_UPLOAD_FOTO_BYTES } from "./fotoCaminho.js";

async function chamadaFoto(usuario, url, opcoes = {}) {
  if (!usuario?.getIdToken) throw new Error("Entre novamente para acessar as fotos.");
  const token = await usuario.getIdToken();
  const resposta = await fetch(url, { ...opcoes, cache: "no-store", credentials: "same-origin",
    headers: { ...opcoes.headers, Authorization: `Bearer ${token}` } });
  if (!resposta.ok) {
    const mensagem = await resposta.json().catch(() => ({}));
    throw Object.assign(new Error(mensagem.erro || "Não foi possível acessar a foto."), { status: resposta.status });
  }
  return resposta;
}

export async function enviarFotoPrivada(usuario, empresaId, foto) {
  if (typeof foto?.foto !== "string" || foto.foto.length > MAX_UPLOAD_FOTO_BYTES * 4 / 3 + 100) throw new Error("Foto muito grande. Mantenha a cópia local e envie uma imagem menor.");
  const r = await chamadaFoto(usuario, "/api/foto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ empresaId, foto }) });
  const dados = await r.json();
  return { fotoPath: dados.fotoPath, acessoFoto: "autenticado" };
}

function blobDataURL(blob) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = () => reject(new Error("Não foi possível ler a foto."));
    leitor.readAsDataURL(blob);
  });
}

// O resultado é apenas para a memória da sessão, nunca localStorage/IndexedDB.
// Compatível com IMG e com o PDF existente, sem expor token de download.
export async function carregarFotoPrivada(usuario, empresaId, registro, { signal } = {}) {
  const fotoPath = referenciaFoto(registro, empresaId);
  if (!fotoPath) throw new Error("Referência de foto inválida.");
  const consulta = new URLSearchParams({ empresaId, fotoId: String(registro.id) });
  const primeira = await chamadaFoto(usuario, `/api/foto?${consulta}`, { signal });
  const partes = Number(primeira.headers.get("X-KM-Foto-Partes"));
  const tamanho = Number(primeira.headers.get("X-KM-Foto-Tamanho"));
  const versao = primeira.headers.get("X-KM-Foto-Versao");
  const mime = primeira.headers.get("Content-Type")?.split(";")[0];
  if (!Number.isInteger(partes) || partes < 1 || partes > 10 || tamanho <= 0 || tamanho >= MAX_FOTO_BYTES
    || !/^image\/(jpeg|png|webp|gif|bmp|avif)$/.test(mime || "")) throw new Error("Resposta de foto inválida.");
  const dados = [await primeira.arrayBuffer()];
  for (let i = 1; i < partes; i++) {
    const proxima = await chamadaFoto(usuario, `/api/foto?${consulta}&parte=${i}`, { signal });
    if (proxima.headers.get("X-KM-Foto-Versao") !== versao
      || Number(proxima.headers.get("X-KM-Foto-Tamanho")) !== tamanho) throw new Error("Foto atualizada durante a leitura. Tente de novo.");
    dados.push(await proxima.arrayBuffer());
  }
  const blob = new Blob(dados, { type: mime });
  if (blob.size !== tamanho) throw new Error("Foto incompleta. Tente de novo.");
  const foto = await blobDataURL(blob);
  const { fotoUrl: _urlAntiga, foto: _fotoAntiga, ...meta } = registro;
  return { ...meta, fotoPath, foto, fotoIndisponivel: false, acessoFoto: "autenticado" };
}
