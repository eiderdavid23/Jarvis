/* Puente con la app Android (Capacitor). En el navegador normal no hace nada. */
(function () {
  var cap = window.Capacitor;
  var LN = cap && cap.Plugins && cap.Plugins.LocalNotifications;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform() || !LN) return;
  var ultima = [], corriendo = false, pendiente = false;
  function idNum(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 2000000000 + 1;
  }
  function permiso() {
    return LN.checkPermissions().then(function (p) {
      return p.display === 'granted' ? p : LN.requestPermissions();
    });
  }
  function hacer() {
    return permiso().then(function (p) {
      if (p.display !== 'granted') return;
      return LN.getPending().then(function (pe) {
        var ids = (pe.notifications || []).map(function (n) { return { id: n.id }; });
        return ids.length ? LN.cancel({ notifications: ids }) : null;
      }).then(function () {
        var ahora = Date.now();
        var nuevas = ultima.filter(function (r) {
          return !r.avisado && new Date(r.cuando).getTime() > ahora;
        }).map(function (r) {
          return {
            id: idNum(r.id),
            title: 'Jarvis · Recordatorio',
            body: r.texto,
            schedule: { at: new Date(r.cuando), allowWhileIdle: true }
          };
        });
        return nuevas.length ? LN.schedule({ notifications: nuevas }) : null;
      });
    });
  }
  function sincronizar(lista) {
    ultima = lista || [];
    if (corriendo) { pendiente = true; return; }
    corriendo = true;
    hacer().catch(function () {}).then(function () {
      corriendo = false;
      if (pendiente) { pendiente = false; sincronizar(ultima); }
    });
  }
  window.jarvisNativo = { sincronizar: sincronizar };
})();
