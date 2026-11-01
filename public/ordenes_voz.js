/* Ordenes por voz o chat («Jarvis, desactiva el modo escucha»): el servidor las entiende y este
   archivo las aplica en la app y mantiene los interruptores de Herramientas iguales a los de la burbuja. */
(function () {
  var cap = window.Capacitor;
  var nativo = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  var M = nativo ? ((cap.Plugins || {}).Manos || (cap.registerPlugin && cap.registerPlugin('Manos'))) : null;
  var avisoEl = null, avisoT = null;

  function aviso(txt) {
    if (!document.body) return;
    if (!avisoEl) {
      avisoEl = document.createElement('div');
      avisoEl.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);' +
        'bottom:calc(110px + env(safe-area-inset-bottom,0px));z-index:9500;max-width:86%;' +
        'padding:10px 16px;border-radius:14px;border:1px solid rgba(0,229,255,.35);' +
        'background:var(--panel,#0b111b);color:var(--texto,#d9f7ff);font:500 13px system-ui,sans-serif;' +
        'line-height:1.4;text-align:center;box-shadow:0 4px 18px rgba(0,0,0,.35);display:none';
      document.body.appendChild(avisoEl);
    }
    avisoEl.textContent = txt;
    avisoEl.style.display = 'block';
    clearTimeout(avisoT);
    avisoT = setTimeout(function () { avisoEl.style.display = 'none'; }, 6000);
  }

  /* Herramientas: lo mas reciente gana (la burbuja y la pagina guardan cada una su copia). */
  function sincronizar() {
    if (!M || !M.herramientas || !window.herramientasOff || !window.herramientasTs) return Promise.resolve();
    var ts = window.herramientasTs();
    return Promise.resolve(M.herramientas({ off: window.herramientasOff(), ts: String(ts) })).then(function (r) {
      var tn = Number(r && r.ts) || 0;
      if (tn > ts && window.herramientasEstablecer) window.herramientasEstablecer((r && r.off) || '', tn);
    }).catch(function () {});
  }

  /* Funciones de la app de Android: modo escucha, burbuja y voz de la burbuja. */
  function aplicarApp(id, on) {
    if (id === 'voz_burbuja') return M.vozBurbuja({ activa: on });
    if (id !== 'escucha' && id !== 'burbuja') return null;
    return Promise.resolve(M.estado()).then(function (e) {
      if (on && !e.vinculado) { aviso('Vincule el celular en Ajustes \u2192 Manos de Jarvis.'); return null; }
      if (id === 'burbuja') return M.burbuja({ activa: on });
      if (on && !e.burbuja) { aviso('Active primero la burbuja.'); return null; }
      if (on && !e.mic) {
        try { M.pedirMicrofono(); } catch (x) {}
        aviso('Falta el permiso del micr\u00f3fono. Perm\u00edtalo y repita la orden.');
        return null;
      }
      return M.palabra({ activa: on });
    });
  }

  function aplicar(comandos) {
    if (!Array.isArray(comandos) || !comandos.length) return;
    var cadena = Promise.resolve();
    var soloApp = false;
    comandos.forEach(function (c) {
      if (!c || typeof c.id !== 'string' || !/^[a-z_]{2,20}$/.test(c.id)) return;
      var on = c.activar !== false;
      if (c.tipo === 'herramienta') {
        if (window.herramientasAplicar) window.herramientasAplicar(c.id, on);
      } else if (c.tipo === 'app') {
        if (!M) { soloApp = true; return; }
        cadena = cadena.then(function () { return aplicarApp(c.id, on); }).catch(function () {});
      }
    });
    if (soloApp) aviso('Esa funci\u00f3n solo existe en la app de Android.');
    cadena.then(function () {
      window.dispatchEvent(new Event('jarvis-ordenes'));
      return sincronizar();
    });
  }

  var base = window.jarvisLeerChat;
  if (typeof base === 'function') {
    window.jarvisLeerChat = async function () {
      var r = await base.apply(this, arguments);
      try { if (r && r.ok && r.data) aplicar(r.data.comandos); } catch (e) {}
      return r;
    };
  }

  window.addEventListener('jarvis-herramientas', sincronizar);
  window.addEventListener('load', function () { setTimeout(sincronizar, 800); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) sincronizar(); });
  var APP = cap && cap.Plugins && cap.Plugins.App;
  if (APP && APP.addListener) APP.addListener('appStateChange', function (s) { if (s && s.isActive) sincronizar(); });
  setInterval(function () { if (!document.hidden) sincronizar(); }, 20000);
})();
