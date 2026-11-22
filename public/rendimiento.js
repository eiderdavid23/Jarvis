/* Rendimiento: al salir de la app se pausan las animaciones CSS y al volver se reanudan con calma.
   En la APK se marca <html class="apk"> para quitar los blur (caros en celulares medios). */
(function () {
  var h = document.documentElement;
  function nativo() {
    var c = window.Capacitor;
    return !!(c && c.isNativePlatform && c.isNativePlatform());
  }
  if (nativo()) h.classList.add('apk');
  else document.addEventListener('DOMContentLoaded', function () { if (nativo()) h.classList.add('apk'); });
  var t = null;
  function estado() {
    clearTimeout(t);
    if (document.hidden) h.classList.add('jvPausa');
    else t = setTimeout(function () { h.classList.remove('jvPausa'); }, 150);
  }
  document.addEventListener('visibilitychange', estado);
  window.addEventListener('pageshow', estado);
})();
