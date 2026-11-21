/* Funciones propias de la app Android: botón atrás y actualizador. En el navegador no hace nada. */
(function () {
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  var P = cap.Plugins || {};
  var APP = P.App, NAV = P.Browser;
  var REPO = 'eiderdavid23/Jarvis';
  var APK = 'https://github.com/' + REPO + '/releases/download/apk-latest/jarvis.apk';
  var ultimoChequeo = 0, pospuesta = false;
  function cerrarSiAbierto(id) {
    var b = document.getElementById(id);
    if (b && b.closest('.abierto')) { b.click(); return true; }
    return false;
  }
  function atras() {
    var o = document.getElementById('actOverlay');
    if (o) { pospuesta = true; o.remove(); return true; }
    if (cerrarSiAbierto('dlCerrar') || cerrarSiAbierto('cjNo') || cerrarSiAbierto('syNo')) return true;
    var rec = document.querySelector('.recPanel .recX');
    if (rec) { rec.click(); return true; }
    var aj = document.getElementById('overlayAjustes');
    if (document.body.classList.contains('con-modulo') && window.modulosJarvis) { window.modulosJarvis.cerrar(); return true; }
    if (aj && aj.classList.contains('abierto') && typeof window.cerrarAjustes === 'function') { if (window.ajustesAtras && window.ajustesAtras()) return true; window.cerrarAjustes(); return true; }
    if (document.body.classList.contains('sb-abierto') && typeof window.cerrarSidebar === 'function') { window.cerrarSidebar(); return true; }
    return false;
  }
  if (APP && APP.addListener) {
    APP.addListener('backButton', function () {
      if (!atras() && APP.minimizeApp) APP.minimizeApp();
    });
  }
  function mostrar() {
    if (document.getElementById('actOverlay')) return;
    var o = document.createElement('div');
    o.id = 'actOverlay';
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(3,7,12,.96);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:32px;text-align:center;color:#e6f7ff;font-family:inherit';
    var t = document.createElement('div');
    t.textContent = 'ACTUALIZACIÓN DISPONIBLE';
    t.style.cssText = 'font-size:20px;letter-spacing:3px;color:#00e5ff';
    var d = document.createElement('div');
    d.textContent = 'Hay una versión nueva de Jarvis, señor. Actualice para usar las funciones nuevas.';
    d.style.cssText = 'max-width:320px;line-height:1.5;opacity:.85';
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = 'Actualizar';
    b.style.cssText = 'padding:14px 36px;border-radius:14px;border:1px solid #00e5ff;background:#042430;color:#00e5ff;font-size:17px;font-weight:600';
    b.addEventListener('click', function () {
      if (NAV && NAV.open) NAV.open({ url: APK }); else window.open(APK, '_blank');
    });
    var l = document.createElement('button');
    l.type = 'button'; l.textContent = 'Más tarde';
    l.style.cssText = 'background:none;border:none;color:#8fb3c4;font-size:14px;padding:8px';
    l.addEventListener('click', function () { pospuesta = true; o.remove(); });
    [t, d, b, l].forEach(function (e) { o.appendChild(e); });
    document.body.appendChild(o);
  }
  function revisar() {
    if (pospuesta || !APP || !APP.getInfo) return;
    var ahora = Date.now();
    if (ahora - ultimoChequeo < 600000) return;
    ultimoChequeo = ahora;
    APP.getInfo().then(function (info) {
      var actual = parseInt(info.build, 10) || 0;
      return fetch('https://api.github.com/repos/' + REPO + '/releases/tags/apk-latest').then(function (r) {
        return r.ok ? r.json() : null;
      }).then(function (d) {
        var m = d && /versionCode\s+(\d+)/i.exec(d.body || '');
        if (m && parseInt(m[1], 10) > actual) mostrar();
      });
    }).catch(function () {});
  }
  function ticketGoogle(url) {
    var m = /[?&]google_ticket=([^&#]+)/.exec(url || '');
    if (!m) return false;
    var ticket = decodeURIComponent(m[1]);
    try { if (NAV && NAV.close) NAV.close(); } catch (e) {}
    function guardar(tok) {
      return fetch('/conectores/google/guardar', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ ticket: ticket }) });
    }
    var acc = '', ref = '';
    try { acc = localStorage.getItem('jarvisAcceso') || ''; ref = localStorage.getItem('jarvisRefresco') || ''; } catch (e) {}
    if (!acc) return true;
    guardar(acc).then(function (r) {
      if (r.status !== 401 || !ref) return r;
      return fetch('/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: ref }) })
        .then(function (x) { return x.ok ? x.json() : null; }).then(function (d) {
          if (!d || !d.access_token) return r;
          try { localStorage.setItem('jarvisAcceso', d.access_token); if (d.refresh_token) localStorage.setItem('jarvisRefresco', d.refresh_token); } catch (e) {}
          return guardar(d.access_token);
        });
    }).then(function () { location.reload(); }).catch(function () {});
    return true;
  }
  function volverDeGoogle(url) {
    if (ticketGoogle(url)) return;
    var i = (url || '').indexOf('#');
    var h = new URLSearchParams(i >= 0 ? url.slice(i + 1) : '');
    if (!h.get('access_token')) return;
    try {
      localStorage.setItem('jarvisAcceso', h.get('access_token'));
      localStorage.setItem('jarvisSesionTs', String(Date.now()));
      if (h.get('refresh_token')) localStorage.setItem('jarvisRefresco', h.get('refresh_token'));
    } catch (e) {}
    try { if (NAV && NAV.close) NAV.close(); } catch (e) {}
    location.reload();
  }
  if (APP && APP.addListener) APP.addListener('appUrlOpen', function (e) { if (e && e.url && e.url.indexOf('com.david.jarvis://') === 0) volverDeGoogle(e.url); });
  setTimeout(revisar, 4000);
  if (APP && APP.addListener) APP.addListener('appStateChange', function (s) { if (s && s.isActive) revisar(); });
})();
