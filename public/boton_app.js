/* Boton "Descargar app" (v1.51, solo web): aparece arriba en el navegador y baja la APK en Android
   o JarvisPC en PC (Windows, Mac o Linux). No sale dentro de la app ni en iPhone.
   Para volver atras: quitar sus lineas de index.html. */
(function () {
  'use strict';
  var REPO = 'eiderdavid23/Jarvis';
  var APK = 'https://github.com/' + REPO + '/releases/download/apk-latest/jarvis.apk';
  var PAGINA = 'https://github.com/' + REPO + '/releases';
  var cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()) return;
  try {
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return;
  } catch (e) {}
  var barra = document.getElementById('barra');
  if (!barra || document.getElementById('btnApp')) return;

  var ua = navigator.userAgent || '';
  var tipo, archivo = '', tip;
  if (/Android/i.test(ua)) {
    tipo = 'android'; tip = 'Descargar Jarvis para Android';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    return;
  } else if (/Windows/i.test(ua)) {
    tipo = 'pc'; archivo = 'JarvisPC-Windows.exe'; tip = 'Descargar JarvisPC para Windows';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    tipo = 'pc'; archivo = 'JarvisPC-Mac'; tip = 'Descargar JarvisPC para Mac';
  } else if (/Linux|X11|CrOS/i.test(ua)) {
    tipo = 'pc'; archivo = 'JarvisPC-Linux'; tip = 'Descargar JarvisPC para Linux';
  } else {
    return;
  }

  function bajar(url) {
    var a = document.createElement('a');
    a.href = url; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function bajarPC(btn) {
    btn.classList.add('ocupado');
    fetch('https://api.github.com/repos/' + REPO + '/releases?per_page=30')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (lista) {
        for (var i = 0; i < lista.length; i++) {
          var rel = lista[i];
          if (rel.draft || !/^pc-/i.test(rel.tag_name || '')) continue;
          var as = (rel.assets || []).filter(function (x) { return x.name === archivo; })[0];
          if (as) return as.browser_download_url;
        }
        return null;
      })
      .catch(function () { return null; })
      .then(function (url) {
        btn.classList.remove('ocupado');
        if (url) bajar(url); else window.open(PAGINA, '_blank', 'noopener');
      });
  }

  var btn = document.createElement('button');
  btn.id = 'btnApp'; btn.type = 'button'; btn.title = tip; btn.setAttribute('aria-label', tip);
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/>' +
    '<path d="M7 11l5 5 5-5"/><path d="M5 21h14"/></svg><span>Descargar app</span>';
  btn.addEventListener('click', function () {
    if (tipo === 'android') bajar(APK); else bajarPC(btn);
  });
  var grupo = barra.querySelector('.grupoBarra');
  barra.insertBefore(btn, grupo || null);
})();
