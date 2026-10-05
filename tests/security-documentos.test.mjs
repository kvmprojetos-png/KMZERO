import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";
import { fotoRasterDataURL, sanitizarHTMLDocumento } from "../src/lib/documentoSeguro.js";

const window = new JSDOM("", { url: "https://kmzero.example/app/" }).window;
const purificador = createDOMPurify(window);
function documento(html) {
  const div = window.document.createElement("div");
  div.innerHTML = sanitizarHTMLDocumento(html, purificador);
  return div;
}

test("foto cadastral aceita raster/base64 e recusa HTML em atributo e SVG", () => {
  const raster = "data:image/png;base64,iVBORw0KGgo=";
  assert.equal(fotoRasterDataURL(raster), raster);
  assert.equal(fotoRasterDataURL('data:image/png;base64,x" onerror="alert(1)'), "");
  assert.equal(fotoRasterDataURL("data:image/svg+xml,<svg onload='alert(1)'/>"), "");
  assert.equal(fotoRasterDataURL("javascript:alert(1)"), "");
});

test("prévia remove handlers e URLs executáveis de dados adulterados", () => {
  const doc = documento(`<img src="data:image/png;base64,x" onerror="alert(1)">
    <a href="java&#x73;cript:alert(2)">Mapa</a><p onclick="alert(3)">Texto</p>`);
  assert.equal(doc.querySelector("img").hasAttribute("onerror"), false);
  assert.equal(doc.querySelector("a").hasAttribute("href"), false);
  assert.equal(doc.querySelector("p").hasAttribute("onclick"), false);
  assert.equal(doc.querySelector("p").textContent, "Texto");
});

test("prévia exclui conteúdo ativo, frames e nomes que colidem com o app", () => {
  const doc = documento(`<script>alert(1)</script><svg onload="alert(2)"><circle/></svg>
    <math><mtext>falso</mtext></math><iframe src="/app/"></iframe>
    <object data="/app/"></object><embed src="/app/"><form><input name="auth"></form>
    <div id="km-doc-viewer" name="location">Válido</div>`);
  assert.equal(doc.querySelector("script,svg,math,iframe,object,embed,form,input"), null);
  assert.equal(doc.querySelector("[id],[name]"), null);
  assert.match(doc.textContent, /Válido/);
});

test("preserva tabelas, paginação, estilos, metadados e imagens SVG em img", () => {
  const svg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='5' height='5'/%3E%3C/svg%3E";
  const doc = documento(`<div class="km-header" data-tipo="RDO" data-numero="12" style="display:grid">
      <img src="${svg}" alt="Logo"><img src="https://firebasestorage.googleapis.com/foto" crossorigin="anonymous">
    </div><table class="quadro" style="width:100%"><thead><tr><th colspan="2">Registro</th></tr></thead>
    <tbody><tr><td style="text-align:right">1</td><td>Concreto &amp; aço</td></tr></tbody></table>`);
  assert.equal(doc.querySelector(".km-header").dataset.tipo, "RDO");
  assert.equal(doc.querySelector(".km-header").dataset.numero, "12");
  assert.equal(doc.querySelector(".km-header").style.display, "grid");
  assert.equal(doc.querySelector("img").getAttribute("src"), svg);
  assert.equal(doc.querySelectorAll("img")[1].getAttribute("crossorigin"), "anonymous");
  assert.equal(doc.querySelector("th").colSpan, 2);
  assert.equal(doc.querySelector("td").style.textAlign, "right");
  assert.equal(doc.querySelectorAll("td")[1].textContent, "Concreto & aço");
});
