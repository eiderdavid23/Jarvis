/* Cancelar funciones en curso: mientras Jarvis trabaja, el boton de enviar se convierte en Detener
   (cuadrado con anillo girando). Pone la clase jv-ocupado en <body>; el diseno vive en chat_pulido.css. */
(function () {
  var fetchBase = window.fetch;
  var leerBase = window.jarvisLeerChat;
  var ctrl = null;
  var cancelado = false;

  function mostrar(v) {
    document.body.classList.toggle('jv-ocupado', !!v);
    var acc = document.getElementById('btnAccion');
    if (!acc) return;
    if (v) {
      acc.dataset.etiqueta = acc.getAttribute('aria-label') || '';
      acc.setAttribute('aria-label', 'Detener');
    } else if (acc.dataset.etiqueta) {
      acc.setAttribute('aria-label', acc.dataset.etiqueta);
    }
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

  /* En fase de captura: si Jarvis esta trabajando, el toque en el boton cancela y no envia ni abre el modo voz */
  document.addEventListener('click', function (e) {
    if (!document.body.classList.contains('jv-ocupado')) return;
    if (!e.target.closest || !e.target.closest('#btnAccion')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    cancelar();
  }, true);

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
