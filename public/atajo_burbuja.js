/* Atajo en la barra de arriba (junto a la bocina): enciende o apaga la burbuja de Jarvis y el "Jarvis" de voz. Solo en la app de Android. */
(function () {
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  var M = (cap.Plugins || {}).Manos || (cap.registerPlugin && cap.registerPlugin('Manos'));
  if (!M || !M.estado) return;

  var css = document.createElement('style');
  css.textContent = '#btnBurbuja .icoOff{display:none}' +
    '#btnBurbuja.apagada{color:var(--rojo,#ff5c5c)}' +
    '#btnBurbuja.apagada .icoOn{display:none}#btnBurbuja.apagada .icoOff{display:block}' +
    '#abToast{position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:99999;max-width:86%;padding:8px 14px;border-radius:999px;' +
    'background:rgba(6,16,24,.94);color:#e6f7ff;border:1px solid rgba(0,229,255,.3);font-size:13px;opacity:0;pointer-events:none;transition:opacity .2s}' +
    '#abToast.ver{opacity:1}';
  document.head.appendChild(css);

  var btn = null, toast = null, reloj = 0, ocupado = false, activa = false;
  var ICO = 'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

  function montar() {
    if (btn) return true;
    var ref = document.getElementById('btnSilencio');
    if (!ref || !ref.parentNode) return false;
    btn = document.createElement('button');
    btn.id = 'btnBurbuja';
    btn.type = 'button';
    btn.className = 'btnIcono';
    btn.style.display = 'none';
    btn.innerHTML = '<svg class="icoOn" ' + ICO + '><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>' +
      '<svg class="icoOff" ' + ICO + '><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/><line x1="4" y1="4" x2="20" y2="20"/></svg>';
    btn.addEventListener('click', alternar);
    ref.parentNode.insertBefore(btn, ref);
    toast = document.createElement('div');
    toast.id = 'abToast';
    document.body.appendChild(toast);
    return true;
  }

  function avisar(t) {
    if (!toast) return;
    toast.textContent = t;
    toast.classList.add('ver');
    clearTimeout(avisar.r);
    avisar.r = setTimeout(function () { toast.classList.remove('ver'); }, 2200);
  }

  function pintar() {
    if (!montar()) return Promise.resolve();
    return Promise.resolve(M.estado()).then(function (e) {
      var listo = !!(e && e.vinculado && e.servicio);
      btn.style.display = listo ? 'flex' : 'none';
      activa = !!(e && e.burbuja);
      btn.classList.toggle('apagada', !activa);
      var t = activa ? 'Burbuja de Jarvis activada. Toca para apagar' : 'Burbuja de Jarvis apagada. Toca para activar';
      btn.setAttribute('aria-label', t);
      btn.title = t;
      return e;
    }).catch(function () {});
  }

  function alternar() {
    if (ocupado) return;
    ocupado = true;
    var activar = !activa;
    Promise.resolve(M.estado()).then(function (e) {
      var pasos = [Promise.resolve(M.burbuja({ activa: activar }))];
      var conVoz = false;
      if (M.palabra) {
        if (!activar) {
          pasos.push(Promise.resolve(M.palabra({ activa: false })));
        } else if (e && e.mic) {
          conVoz = true;
          pasos.push(Promise.resolve(M.palabra({ activa: true })));
        } else if (M.pedirMicrofono) {
          M.pedirMicrofono();
        }
      }
      return Promise.all(pasos).then(function () {
        avisar(!activar ? 'Burbuja y \u00abJarvis\u00bb apagados' : (conVoz ? 'Burbuja y \u00abJarvis\u00bb activados' : 'Burbuja activada'));
      });
    }).catch(function () {
      avisar('No pude cambiarlo. Revisa Ajustes \u2192 Manos de Jarvis.');
    }).then(function () {
      ocupado = false;
      return pintar();
    });
  }

  var intentos = 0;
  reloj = setInterval(function () {
    if (montar()) { clearInterval(reloj); pintar(); }
    else if (++intentos > 40) clearInterval(reloj);
  }, 300);

  setInterval(function () { if (!document.hidden) pintar(); }, 5000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) pintar(); });
  window.addEventListener('jarvis-sesion', pintar);
  var APP = (cap.Plugins || {}).App;
  if (APP && APP.addListener) APP.addListener('appStateChange', function (s) { if (s && s.isActive) pintar(); });
})();
