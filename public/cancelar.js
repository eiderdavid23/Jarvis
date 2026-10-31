/* Cancelar funciones en curso: boton "Detener" mientras Jarvis trabaja. */
(function () {
  var fetchBase = window.fetch;
  var leerBase = window.jarvisLeerChat;
  var ctrl = null;
  var cancelado = false;
  var boton = null;

  function crear() {
    if (boton) return boton;
    var st = document.createElement('style');
    st.textContent = '#jvDetener{position:fixed;left:50%;transform:translateX(-50%);' +
      'bottom:calc(104px + env(safe-area-inset-bottom,0px));z-index:9000;display:none;' +
      'padding:9px 20px;border-radius:999px;border:1.5px solid var(--rojo,#ff5a5a);' +
      'background:var(--panel,#0b111b);color:var(--rojo,#ff5a5a);font:600 14px system-ui,sans-serif;' +
      'box-shadow:0 4px 18px rgba(0,0,0,.35);cursor:pointer}' +
      '#jvDetener.v{display:block}';
    document.head.appendChild(st);
    boton = document.createElement('button');
    boton.id = 'jvDetener';
    boton.type = 'button';
    boton.textContent = '\u25A0 Detener';
    boton.addEventListener('click', cancelar);
    document.body.appendChild(boton);
    return boton;
  }

  function mostrar(v) {
    crear().classList.toggle('v', !!v);
  }

  function respuestaCancelada() {
    return new Response(JSON.stringify({ respuesta: 'Cancelado, se\u00f1or.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  function cancelar() {
    if (!ctrl) return;
    cancelado = true;
    try { fetchBase('/manos/cancelar', { method: 'POST' }).catch(function () {}); } catch (e) {}
    try { ctrl.abort(); } catch (e) {}
    if (typeof window.detenerHabla === 'function') { try { window.detenerHabla(); } catch (e) {} }
    mostrar(false);
  }

  window.fetch = function (url, opts) {
    if (url !== '/chat' || !opts || opts.method !== 'POST') return fetchBase.apply(this, arguments);
    cancelado = false;
    ctrl = new AbortController();
    mostrar(true);
    return fetchBase.call(this, url, Object.assign({}, opts, { signal: ctrl.signal })).catch(function (e) {
      mostrar(false);
      if (cancelado) return respuestaCancelada();
      throw e;
    });
  };

  if (typeof leerBase === 'function') {
    window.jarvisLeerChat = async function (res, alPaso) {
      try {
        return await leerBase(res, alPaso);
      } catch (e) {
        if (!cancelado) throw e;
        if (window.jarvisNivelVisual) window.jarvisNivelVisual(null);
        return { ok: false, data: { respuesta: 'Cancelado, se\u00f1or.' } };
      } finally {
        mostrar(false);
      }
    };
  }
})();
