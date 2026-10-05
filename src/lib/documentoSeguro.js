import DOMPurify from "dompurify";

// Os documentos imprimem tabelas, imagens e estilos de apresentação. Nenhum
// conteúdo vindo dos cadastros pode criar controles, frames ou código no app.
const CONFIG_DOCUMENTO = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: [
    "script", "style", "link", "meta", "base", "iframe", "object", "embed",
    "form", "input", "button", "textarea", "select", "option", "template",
    "audio", "video", "source", "track",
  ],
  FORBID_ATTR: ["srcset", "id", "name"],
  ADD_ATTR: ["crossorigin"],
  ALLOW_DATA_ATTR: true,
};

export function sanitizarHTMLDocumento(html, purificador = DOMPurify) {
  return purificador.sanitize(String(html ?? ""), CONFIG_DOCUMENTO);
}

// A foto cadastral vem de FileReader. Exigir raster/base64 impede que um campo
// adulterado no cadastro ou backup seja interpretado como marcação HTML.
export function fotoRasterDataURL(valor) {
  const foto = typeof valor === "string" ? valor.trim() : "";
  return /^data:image\/(?:png|jpe?g|gif|webp|bmp|avif);base64,[a-z\d+/]+={0,2}$/i.test(foto) ? foto : "";
}
