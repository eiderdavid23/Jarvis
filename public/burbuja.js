/* Burbuja de Jarvis (solo en la app de Android): le pasa a la parte nativa la sesion y el chat actual. */
(function () {
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  var M = (cap.Plugins || {}).Manos || (cap.registerPlugin && cap.registerPlugin('Manos'));
  if (!M || !M.sesion) return;
  var chat = '';

  function pasar() {
    var t = '';
    try { t = localStorage.getItem('jarvisAcceso') || ''; } catch (e) {}
    try { Promise.resolve(M.sesion({ acceso: t, chat_id: chat })).catch(function () {}); } catch (e) {}
  }

  window.addEventListener('jarvis-sesion', pasar);
  window.addEventListener('load', function () {
    var orig = window.jarvisChatListo;
    window.jarvisChatListo = function (d, ok) {
      if (d && d.chat_id) chat = d.chat_id;
      var r = typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      pasar();
      return r;
    };
    pasar();
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pasar(); });
  var APP = (cap.Plugins || {}).App;
  if (APP && APP.addListener) APP.addListener('appStateChange', function () { pasar(); });
  setInterval(pasar, 5 * 60 * 1000);
})();
