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
    if (cerrarSiAbierto('cjNo') || cerrarSiAbierto('syNo')) return true;
    var rec = document.querySelector('.recPanel .recX');
    if (rec) { rec.click(); return true; }
    var aj = document.getElementById('overlayAjustes');
    if (aj && aj.classList.contains('abierto') && typeof window.cerrarAjustes === 'function') { window.cerrarAjustes(); return true; }
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
        var m = d && /build\s+(\d+)/i.exec(d.body || '');
        if (m && parseInt(m[1], 10) > actual) mostrar();
      });
    }).catch(function () {});
  }
  setTimeout(revisar, 4000);
  if (APP && APP.addListener) APP.addListener('appStateChange', function (s) { if (s && s.isActive) revisar(); });
})();
