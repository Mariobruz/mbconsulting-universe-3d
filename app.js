/* Pagine applicazione: X, Esc e link verso la home.
   - aperte dentro il sito 3D (riquadro sopra l'universo): chiudono il riquadro, la musica continua;
   - aperte da sole (Google, link condiviso): tornano al sito 3D nel punto lasciato. */
(function () {
  var x = document.querySelector('[data-close]');
  var embedded = false;
  try { embedded = window.parent !== window && parent.location.origin === location.origin && typeof parent.closeAppFrame === 'function'; } catch (e) {}

  function isHome(u) { return u.origin === location.origin && (u.pathname === '/' || u.pathname === '/index.html'); }

  function closeStandalone(e) {
    try {
      var r = document.referrer ? new URL(document.referrer) : null;
      if (r && isHome(r) && history.length > 1) { if (e) e.preventDefault(); history.back(); return; }
    } catch (err) {}
    if (!e && x) location.href = x.href;
  }

  if (embedded) {
    document.documentElement.classList.add('embedded');
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
      var u = new URL(a.href, location.href);
      if (u.origin !== location.origin) return;
      if (isHome(u)) {
        e.preventDefault();
        parent.closeAppFrame({ contact: u.searchParams.get('contatto') });
      } else if (/^\/(en\/)?app\//.test(u.pathname)) {
        e.preventDefault();
        location.replace(u.href);                       // altre schede: senza aggiungere voci alla cronologia
      } else {
        a.target = '_blank'; a.rel = 'noopener';       // es. privacy: in una nuova scheda
      }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') parent.closeAppFrame(); });
  } else {
    if (x) x.addEventListener('click', closeStandalone);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeStandalone(); });
  }
})();
