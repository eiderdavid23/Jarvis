/* Voz Piper dentro del navegador (WebAssembly): misma voz que el servidor local, pero corre en este dispositivo. */
(function () {
  var VOZ = 'es_ES-davefx-medium';
  var URLS = [
    'https://esm.sh/@mintplex-labs/piper-tts-web@1.0.3',
    'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.3/+esm'
  ];
  var K = { id: 'jarvisPiperWeb', on: 'jarvisPiperWebOn' };
  var lib = null, cargando = null, bloqueado = false;

  function cargarLib() {
    if (lib) return Promise.resolve(lib);
    if (cargando) return cargando;
    cargando = (async function () {
      var ultimo = null;
      for (var i = 0; i < URLS.length; i++) {
        try {
          var m = await import(URLS[i]);
          lib = (!m.predict && m.default) ? m.default : m;
          if (typeof lib.predict !== 'function') throw new Error('El motor no tiene predict');
          return lib;
        } catch (e) { ultimo = e; }
      }
      throw ultimo || new Error('No pude cargar el motor de voz');
    })();
    cargando.catch(function () { cargando = null; });
    return cargando;
  }

  async function resolverVoz(l) {
    var todas = await l.voices();
    var claves = Array.isArray(todas)
      ? todas.map(function (v) { return v && v.key ? v.key : v; })
      : Object.keys(todas || {});
    if (claves.indexOf(VOZ) >= 0) return VOZ;
    var otra = claves.find(function (k) { return /davefx/i.test(String(k)); });
    if (!otra) throw new Error('La voz no está en la lista del motor');
    return otra;
  }

  async function descargar(alProgreso) {
    var l = await cargarLib();
    var id = await resolverVoz(l);
    var porUrl = {};
    if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) {} }
    await l.download(id, function (p) {
      if (p && p.url) porUrl[p.url] = { l: p.loaded || 0, t: p.total || 0 };
      var c = 0, t = 0;
      Object.keys(porUrl).forEach(function (k) { c += porUrl[k].l; t += porUrl[k].t; });
      if (alProgreso) alProgreso(c, t);
    });
    localStorage.setItem(K.id, id);
    localStorage.setItem(K.on, '1');
    return id;
  }

  async function borrar() {
    var id = localStorage.getItem(K.id);
    localStorage.removeItem(K.id);
    localStorage.removeItem(K.on);
    try { var l = await cargarLib(); if (id) await l.remove(id); } catch (e) {}
  }

  function listo() {
    return !bloqueado && !!localStorage.getItem(K.id) && localStorage.getItem(K.on) !== '0';
  }

  /* Habla las frases con la voz descargada. Devuelve cuantas alcanzo a decir; el resto lo cubre la voz del navegador. */
  async function hablar(partes, cancelado, ponerLiberar, audio) {
    var hechas = 0;
    try {
      var l = await cargarLib();
      var id = localStorage.getItem(K.id);
      var pedir = function (i) {
        var p = l.predict({ text: partes[i], voiceId: id });
        p.catch(function () {});
        return p;
      };
      var reproducir = function (blob) {
        return new Promise(function (ok, mal) {
          var url = URL.createObjectURL(blob);
          var limpiar = function () { audio.onended = null; audio.onerror = null; URL.revokeObjectURL(url); };
          ponerLiberar(function () { limpiar(); ok(); });
          audio.onended = function () { limpiar(); ok(); };
          audio.onerror = function () { limpiar(); mal(new Error('audio')); };
          if (window.jarvisVoz) window.jarvisVoz.aplicar(audio);
          audio.src = url;
          audio.play().catch(function (e) { limpiar(); mal(e); });
        });
      };
      var siguiente = partes.length ? pedir(0) : null;
      for (var i = 0; i < partes.length; i++) {
        var blob = await siguiente;
        if (cancelado()) return partes.length;
        siguiente = (i + 1 < partes.length) ? pedir(i + 1) : null;
        await reproducir(blob);
        if (cancelado()) return partes.length;
        hechas++;
      }
    } catch (e) {
      console.warn('Voz Piper del navegador fallo:', e);
      if (hechas === 0) bloqueado = true;
    }
    return hechas;
  }

  window.jarvisPiperWeb = { listo: listo, hablar: hablar, descargar: descargar, borrar: borrar };

  /* ---------- tarjeta en Ajustes > Voz ---------- */
  var destino = document.getElementById('tabVoz');
  if (!destino) return;
  function h(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  }
  function mb(n) { return (n / 1048576).toFixed(1) + ' MB'; }

  var card = h('div', 'card');
  var cab = h('div', 'cardHead');
  cab.appendChild(h('strong', '', 'Voz de Jarvis en este dispositivo'));
  card.appendChild(cab);
  var info = h('p', '', 'Descarga la voz Piper (la misma del servidor local) para que Jarvis hable con ella aunque el servidor no tenga voz, como en Vercel. Pesa unos 60 MB y se guarda en este navegador. Mejor con WiFi.');
  info.style.cssText = 'font-size:11px;opacity:.7;margin:0 0 10px';
  card.appendChild(info);
  var estado = h('p', '', '');
  estado.style.cssText = 'font-size:12px;margin:0 0 10px;word-break:break-word';
  card.appendChild(estado);

  var barraFondo = h('div');
  barraFondo.style.cssText = 'height:6px;border-radius:3px;background:#8884;overflow:hidden;margin:0 0 10px;display:none';
  var barra = h('div');
  barra.style.cssText = 'height:100%;width:0;background:#00e5ff;transition:width .2s';
  barraFondo.appendChild(barra);
  card.appendChild(barraFondo);

  var filaSw = h('label', 'filaSwitch');
  filaSw.appendChild(h('span', '', 'Usar esta voz'));
  var chk = h('input');
  chk.type = 'checkbox';
  filaSw.appendChild(chk);
  card.appendChild(filaSw);

  var filaBtns = h('div', 'filaBtns');
  var btnDescargar = h('button', 'btnPanel', 'Descargar voz');
  var btnProbar = h('button', 'btnPanel', 'Probar');
  var btnBorrar = h('button', 'btnPanel secundario', 'Borrar voz');
  filaBtns.appendChild(btnDescargar); filaBtns.appendChild(btnProbar); filaBtns.appendChild(btnBorrar);
  card.appendChild(filaBtns);
  destino.appendChild(card);

  var ocupado = false;
  function pintar(msg, error) {
    var tiene = !!localStorage.getItem(K.id);
    estado.textContent = msg || (tiene ? 'Lista: la voz está guardada en este dispositivo.' : 'No descargada.');
    estado.style.color = error ? '#ff6b6b' : '';
    filaSw.style.display = tiene ? '' : 'none';
    chk.checked = localStorage.getItem(K.on) !== '0';
    btnDescargar.style.display = tiene ? 'none' : '';
    btnProbar.style.display = tiene ? '' : 'none';
    btnBorrar.style.display = tiene ? '' : 'none';
    btnDescargar.disabled = ocupado;
  }
  pintar();

  btnDescargar.addEventListener('click', async function () {
    if (ocupado) return;
    ocupado = true;
    barraFondo.style.display = '';
    barra.style.width = '2%';
    pintar('Preparando descarga...');
    try {
      await descargar(function (c, t) {
        var pct = t ? Math.min(100, Math.round(c * 100 / t)) : 0;
        barra.style.width = Math.max(2, pct) + '%';
        estado.textContent = 'Descargando: ' + mb(c) + (t ? ' de ' + mb(t) + ' (' + pct + '%)' : '');
      });
      ocupado = false;
      pintar('Lista. Toca "Probar" para escucharla.');
    } catch (e) {
      ocupado = false;
      pintar('No pude descargar la voz: ' + (e && e.message ? e.message : e) + '. Revisa tu conexión e intenta de nuevo.', true);
    }
    barraFondo.style.display = 'none';
  });
  chk.addEventListener('change', function () { localStorage.setItem(K.on, chk.checked ? '1' : '0'); });
  btnBorrar.addEventListener('click', async function () { await borrar(); pintar('Voz borrada de este dispositivo.'); });
  btnProbar.addEventListener('click', async function () {
    if (typeof detenerHabla === 'function') detenerHabla();
    var audio = (typeof audioPlayer !== 'undefined') ? audioPlayer : new Audio();
    pintar('Generando voz...');
    var n = await hablar(['Buenos días, señor. Todos los sistemas están listos para servirle.'], function () { return false; }, function () {}, audio);
    pintar(n ? null : 'No pude generar la voz. Prueba de nuevo o bórrala y vuelve a descargarla.', !n);
  });
})();
