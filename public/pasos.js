/* Pasos en vivo: el Resumen de lo que hace Jarvis, estilo Claude */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var IC = {
    lupa: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    hoja: '<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>',
    celular: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>',
    imagen: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M5 17l4.5-4.5 3.5 3.5 2.5-2.5L19 17"/>',
    enlace: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    chispa: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/>',
    lapiz: '<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1z"/>',
    cubo: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
    punto: '<circle cx="12" cy="12" r="2.2"/>',
    ok: '<path d="M5 12.5l4.5 4.5L19 7"/>'
  };
  function icono(n) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.7'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.innerHTML = IC[n] || IC.punto;
    return s;
  }
  function iconoPara(t) {
    t = t.toLowerCase();
    if (/escribiendo/.test(t)) return 'lapiz';
    if (/pensando|razonamiento|pregunta|cambiando/.test(t)) return 'chispa';
    if (/imagen/.test(t)) return 'imagen';
    if (/pantalla|celular|\bpc\b|\btv\b/.test(t)) return 'celular';
    if (/plataforma|enlace/.test(t)) return 'enlace';
    if (/estructura|add-on|semilla/.test(t)) return 'cubo';
    if (/archivo|leyendo/.test(t)) return 'hoja';
    if (/busc|web/.test(t)) return 'lupa';
    return 'punto';
  }
  function bajar() { if (window.bajarChat) window.bajarChat(); }

  function crear(antesDe) {
    const caja = document.createElement('div');
    caja.className = 'pasosBox trabajando';
    caja.innerHTML =
      '<button type="button" class="pasosCab">' +
      '<span class="pasosRueda"></span><span class="pasosTit"></span>' +
      '<span class="pasosFlecha">›</span></button>' +
      '<div class="pasosCuerpo"><ol class="pasosLista"></ol></div>';
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
    function fila(texto, nombreIcono, clase) {
      const li = document.createElement('li');
      if (clase) li.className = clase;
      const ico = document.createElement('span');
      ico.className = 'pasoIco';
      ico.appendChild(icono(nombreIcono));
      const txt = document.createElement('div');
      txt.className = 'pasoTxt';
      const i = texto.indexOf(': ');
      const t = document.createElement('span');
      t.className = 'pasoTit';
      t.textContent = i > 0 ? texto.slice(0, i) : texto;
      txt.appendChild(t);
      if (i > 0) {
        const d = document.createElement('span');
        d.className = 'pasoDet';
        d.textContent = texto.slice(i + 2);
        txt.appendChild(d);
      }
      li.appendChild(ico);
      li.appendChild(txt);
      return li;
    }
    return {
      agregar(texto) {
        cerrarActivo();
        const li = fila(texto, iconoPara(texto), 'activo');
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
        if (soloPensar) {
          caja.classList.add('simple');
          tit.textContent = 'Pensó durante ' + seg + ' s';
        } else {
          lista.appendChild(fila('Listo', 'ok', 'final'));
          tit.textContent = 'Resumen · ' + total + (total === 1 ? ' paso' : ' pasos') + ' · ' + seg + ' s';
        }
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
      if (o.t === 'delta' && window.jarvisDelta) { vioPaso = true; window.jarvisDelta(o.texto); }
      else if (o.t === 'paso' && alPaso) { vioPaso = true; alPaso(o.texto); }
      else if (o.t === 'nivel' && window.jarvisNivelVisual) window.jarvisNivelVisual(o.nivel);
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
    if (window.jarvisNivelVisual) window.jarvisNivelVisual(null);
    if (!final) return { ok: false, data: { respuesta: 'Se cortó la conexión, señor.' } };
    const ok = final.status < 400;
    if (window.jarvisChatListo) window.jarvisChatListo(final.data, ok);
    return { ok: ok, data: final.data };
  }

  window.jarvisPasos = { crear: crear };
  window.jarvisLeerChat = leerChat;
})();
