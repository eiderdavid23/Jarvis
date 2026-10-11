/* Pasos en vivo: muestra lo que Jarvis hace cuando la tarea es larga */
(function () {
  function bajar() { if (window.bajarChat) window.bajarChat(); }

  function crear(antesDe) {
    const caja = document.createElement('div');
    caja.className = 'pasosBox trabajando';
    caja.innerHTML =
      '<button type="button" class="pasosCab">' +
      '<span class="pasosRueda"></span><span class="pasosTit"></span>' +
      '<span class="pasosFlecha">›</span></button>' +
      '<ol class="pasosLista"></ol>';
    antesDe.parentNode.insertBefore(caja, antesDe);
    antesDe.style.display = 'none';
    const tit = caja.querySelector('.pasosTit');
    const lista = caja.querySelector('.pasosLista');
    caja.querySelector('.pasosCab').addEventListener('click', () => {
      caja.classList.toggle('abierto');
      bajar();
    });
    let activo = null;
    let total = 0;
    let soloPensar = true;
    const t0 = (window.jarvisPasos && window.jarvisPasos.t0) || Date.now();

    function cerrarActivo() {
      if (activo) { activo.classList.remove('activo'); activo.classList.add('hecho'); }
    }
    return {
      agregar(texto) {
        cerrarActivo();
        const li = document.createElement('li');
        li.className = 'activo';
        li.textContent = texto;
        lista.appendChild(li);
        activo = li;
        total++;
        if (texto !== 'Pensando') soloPensar = false;
        tit.textContent = texto + '…';
        bajar();
      },
      terminar() {
        cerrarActivo();
        activo = null;
        caja.classList.remove('trabajando');
        const seg = Math.max(1, Math.round((Date.now() - t0) / 1000));
        if (soloPensar) caja.classList.add('simple');
        tit.textContent = soloPensar ? 'Pensó durante ' + seg + ' s'
          : 'Resumen · ' + total + (total === 1 ? ' paso' : ' pasos');
      }
    };
  }

  async function leerChat(res, alPaso) {
    const tipo = res.headers.get('content-type') || '';
    if (tipo.indexOf('ndjson') < 0 || !res.body) {
      return { ok: res.ok, data: await res.json() };
    }
    const lector = res.body.getReader();
    const dec = new TextDecoder();
    let resto = '';
    let final = null;
    let vioPaso = false;
    window.jarvisPasos.t0 = Date.now();
    const lento = setTimeout(() => {
      if (!vioPaso && !final && alPaso) alPaso('Pensando');
    }, 1500);
    function linea(l) {
      l = l.trim();
      if (!l) return;
      let o;
      try { o = JSON.parse(l); } catch (e) { return; }
      if (o.t === 'paso' && alPaso) { vioPaso = true; alPaso(o.texto); }
      else if (o.t === 'final') final = o;
    }
    for (;;) {
      const r = await lector.read();
      if (r.done) break;
      resto += dec.decode(r.value, { stream: true });
      const partes = resto.split('\n');
      resto = partes.pop();
      partes.forEach(linea);
    }
    linea(resto + dec.decode());
    clearTimeout(lento);
    if (!final) return { ok: false, data: { respuesta: 'Se cortó la conexión, señor.' } };
    const ok = final.status < 400;
    if (window.jarvisChatListo) window.jarvisChatListo(final.data, ok);
    return { ok: ok, data: final.data };
  }

  window.jarvisPasos = { crear: crear };
  window.jarvisLeerChat = leerChat;
})();
