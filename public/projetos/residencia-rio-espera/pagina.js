/* Residência Rio Espera · visor das imagens (dialog nativo, teclado, foco devolvido ao fechar) */
(function () {
  'use strict';
  var fotos = Array.prototype.slice.call(document.querySelectorAll('.foto'));
  var visor = document.getElementById('visor');
  if (!fotos.length || !visor || typeof visor.showModal !== 'function') return;
  var img = document.getElementById('visorImg'), txt = document.getElementById('visorTxt');
  var atual = 0, origem = null;

  function mostrar(i) {
    atual = (i + fotos.length) % fotos.length;
    var b = fotos[atual];
    img.src = b.dataset.src;
    img.alt = b.dataset.alt;
    txt.textContent = (atual + 1 < 10 ? '0' : '') + (atual + 1) + ' / ' + fotos.length + ' · ' + b.dataset.alt;
  }
  fotos.forEach(function (b, i) {
    b.addEventListener('click', function () { origem = b; mostrar(i); visor.showModal(); });
  });
  document.getElementById('fechar').addEventListener('click', function () { visor.close(); });
  document.getElementById('ant').addEventListener('click', function () { mostrar(atual - 1); });
  document.getElementById('prox').addEventListener('click', function () { mostrar(atual + 1); });
  visor.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); mostrar(atual - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); mostrar(atual + 1); }
  });
  visor.addEventListener('click', function (e) { if (e.target === visor) visor.close(); });
  visor.addEventListener('close', function () { img.removeAttribute('src'); if (origem) origem.focus(); });
  // deslizar no celular
  var x0 = null;
  visor.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, {passive: true});
  visor.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) mostrar(atual + (dx < 0 ? 1 : -1));
    x0 = null;
  }, {passive: true});
})();
