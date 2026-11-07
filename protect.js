/* Protezione anti-scraping lato pagina.
   - L'indirizzo email non compare mai in chiaro nel codice: viene ricomposto qui, nel browser.
     I programmi che raccolgono email leggendo l'HTML trovano solo "info [at] ... [dot] com".
   - Le immagini non si trascinano fuori dalla pagina.
   Nota: nessuna protezione impedisce del tutto di copiare ciò che il browser mostra;
   il grosso del lavoro lo fanno robots.txt, i metadati "no AI" e le impostazioni di Cloudflare (vedi README). */
(function () {
  var rev = function (s) { return s.split('').reverse().join(''); };
  var mail = rev('ofni') + String.fromCharCode(64) + rev('moc.ailatignitlusnocbm');
  window.MB_MAIL = mail;
  function fill() {
    document.querySelectorAll('a.js-mail').forEach(function (a) {
      var m = rev(a.dataset.u) + String.fromCharCode(64) + rev(a.dataset.d);
      a.href = 'mailto:' + m;
      a.textContent = m;
    });
    document.querySelectorAll('img').forEach(function (img) { img.setAttribute('draggable', 'false'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill); else fill();
  document.addEventListener('langchange', fill);
})();
