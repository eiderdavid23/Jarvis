/* Modelo local (solo en la APK): descargar, encender y probar un modelo que corre en el celular.
   Agrega la fila "Modelo local" dentro de la hoja "Selecciona un modelo". Usa el plugin nativo LlamaLocal. */
(function () {
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  var L = (cap.Plugins || {}).LlamaLocal || (cap.registerPlugin && cap.registerPlugin('LlamaLocal'));
  if (!L) return;
  var hoja = null, estado = null, progreso = {}, mensaje = '', prueba = '', ocupado = false, verLog = false;

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function tam(mb) { return mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : mb + ' MB'; }
  function msg(e) { return (e && e.message) ? e.message : String(e); }
  var DESC = {
    'qwen35-08b': 'Respuestas cortas y r\u00e1pidas. Para celulares de 4 GB; poca profundidad.',
    'qwen35-2b': 'Equilibrado: charla, res\u00famenes y preguntas sencillas.',
    'qwen35-4b': 'El m\u00e1s capaz de los tres, pero m\u00e1s lento y calienta el celular.'
  };
  function recomendado() {
    var gb = estado ? estado.ramTotalMb / 1024 : 0, id = '';
    if (estado) estado.modelos.forEach(function (m) { if (gb >= m.ramMinGb) id = m.id; });
    return id;
  }
  function boton(txt, cls, fn, off) {
    var b = el('button', 'lcBtn' + (cls ? ' ' + cls : ''), txt);
    b.type = 'button';
    if (off) b.disabled = true;
    b.addEventListener('click', fn);
    return b;
  }

  function refrescar() {
    return L.estado().then(function (e) {
      estado = e;
      /* La descarga sigue en segundo plano: al volver, se retoma la barra donde va. */
      if (e.descarga && e.descarga.id) progreso[e.descarga.id] = e.descarga;
      else if (e.descargando === false) progreso = {};
      pintar();
    })
      .catch(function (e) { mensaje = 'No pude leer el estado: ' + msg(e); pintar(); });
  }

  function encender(m) {
    ocupado = true; mensaje = 'Cargando ' + m.nombre + '... puede tardar un minuto.'; prueba = ''; pintar();
    L.iniciar({ id: m.id, ctx: 4096, hilos: 4 })
      .then(function () { mensaje = m.nombre + ' encendido.'; })
      .catch(function (e) { mensaje = msg(e); })
      .then(function () { ocupado = false; return refrescar(); });
  }

  function probar() {
    ocupado = true; prueba = ''; mensaje = 'Pensando...'; pintar();
    L.chat({ mensajes: [{ role: 'user', content: 'Responde en espa\u00f1ol en una frase corta: \u00bfqu\u00e9 eres y qu\u00e9 puedes hacer?' }], maxTokens: 120, pensar: false })
      .then(function (r) { prueba = r.texto || ''; mensaje = 'Listo.'; })
      .catch(function (e) { mensaje = msg(e); })
      .then(function () { ocupado = false; pintar(); });
  }

  function tarjeta(m) {
    var c = el('div', 'lcCard');
    var nom = el('div', 'lcNom', m.nombre);
    if (m.id === recomendado()) nom.appendChild(el('i', 'lcTag', 'Recomendado para tu RAM'));
    c.appendChild(nom);
    if (DESC[m.id]) c.appendChild(el('div', 'lcDesc', DESC[m.id]));
    var enc = estado.activo && estado.modelo === m.id;
    c.appendChild(el('div', 'lcSub', 'Peso: ' + tam(m.mb) + ' \u00b7 RAM recomendada: ' + m.ramMinGb + ' GB o m\u00e1s' + (enc ? ' \u00b7 encendido' : '')));
    var p = progreso[m.id];
    var f = el('div', 'lcFila');
    if (p && !p.listo) {
      var barra = el('div', 'lcBarra');
      var i = el('i');
      i.style.width = (p.pct || 0) + '%';
      barra.appendChild(i);
      c.appendChild(barra);
      c.appendChild(el('div', 'lcSub', (p.pct || 0) + '% (' + tam(Math.round((p.bytes || 0) / 1048576)) + ' de ' + tam(Math.round((p.total || 0) / 1048576)) + ')'));
      f.appendChild(boton('Cancelar', '', function () { L.cancelarDescarga(); }));
    } else if (!m.descargado) {
      f.appendChild(boton('Descargar', 'p', function () {
        if (!window.confirm('Se descargan ' + tam(m.mb) + '. Mejor con WiFi. Sigue en segundo plano aunque salgas de la app y ver\u00e1s el avance en la notificaci\u00f3n. \u00bfSeguir?')) return;
        mensaje = ''; progreso[m.id] = { pct: 0 };
        L.descargar({ id: m.id }).then(pintar).catch(function (e) { delete progreso[m.id]; mensaje = msg(e); pintar(); });
      }, estado.descargando));
    } else {
      if (enc) f.appendChild(boton('Apagar', '', function () { L.detener().then(refrescar); }, ocupado));
      else f.appendChild(boton('Encender', 'p', function () { encender(m); }, ocupado));
      f.appendChild(boton('Borrar', '', function () {
        if (window.confirm('\u00bfBorrar ' + m.nombre + ' del celular?')) L.borrar({ id: m.id }).then(refrescar);
      }, ocupado));
    }
    c.appendChild(f);
    return c;
  }

  function pintar() {
    if (!hoja) return;
    hoja.textContent = '';
    hoja.appendChild(el('div', 'hojaAgarre'));
    hoja.appendChild(el('p', 'hojaTit', 'Modelos IA'));
    if (!estado) { hoja.appendChild(el('p', 'lcNota', 'Cargando...')); return; }
    if (!estado.binario) {
      hoja.appendChild(el('p', 'lcNota', 'Esta APK no trae el motor del modelo local. Instala la APK m\u00e1s reciente.'));
      return;
    }
    hoja.appendChild(el('p', 'lcNota', 'Corre en tu celular, sin internet y sin gastar API. RAM: ' +
      Math.round(estado.ramTotalMb / 1024 * 10) / 10 + ' GB en total, ' + Math.round(estado.ramLibreMb / 1024 * 10) / 10 + ' GB libres.'));
    estado.modelos.forEach(function (m) { hoja.appendChild(tarjeta(m)); });
    if (estado.activo) {
      var f = el('div', 'lcFila');
      f.appendChild(boton('Probar el modelo', 'p', probar, ocupado));
      hoja.appendChild(f);
    }
    if (mensaje) hoja.appendChild(el('div', 'lcPre', mensaje));
    if (prueba) hoja.appendChild(el('div', 'lcPre', prueba));
    var g = el('div', 'lcFila');
    g.appendChild(boton(verLog ? 'Ocultar registro' : 'Ver registro del motor', '', function () { verLog = !verLog; pintar(); }));
    hoja.appendChild(g);
    if (verLog) hoja.appendChild(el('div', 'lcPre', estado.registro || '(vac\u00edo)'));
  }

  function abrir() {
    if (!hoja) {
      hoja = el('div', 'hoja');
      hoja.id = 'hojaLocal';
      document.body.appendChild(hoja);
    }
    pintar();
    refrescar();
    abrirHoja('hojaLocal');
  }

  window.modeloLocal = { abrir: abrir };

  L.addListener('descarga', function (ev) {
    if (ev.error) { delete progreso[ev.id]; mensaje = 'Descarga: ' + ev.error; refrescar(); return; }
    if (ev.listo) { delete progreso[ev.id]; mensaje = 'Descarga terminada.'; refrescar(); return; }
    progreso[ev.id] = ev; pintar();
  });
  L.addListener('token', function (ev) { prueba += ev.texto || ''; pintar(); });

  function ponerFila(h) {
    if (h.querySelector('.smLocal')) return;
    var b = el('button', 'smFila smLocal');
    b.type = 'button';
    b.appendChild(el('span', null, 'Modelo local (sin API)'));
    var d = el('span', 'smDer');
    d.appendChild(el('i', 'smTag', 'Beta'));
    d.appendChild(document.createTextNode(' \u203a'));
    b.appendChild(d);
    b.addEventListener('click', function () { cerrarHojas(); setTimeout(abrir, 140); });
    var nota = h.querySelector('.smNota');
    if (nota) h.insertBefore(b, nota); else h.appendChild(b);
  }

  function vigilar(h) {
    ponerFila(h);
    new MutationObserver(function () { ponerFila(h); }).observe(h, { childList: true });
  }
  var ya = document.getElementById('hojaModelo');
  if (ya) vigilar(ya);
  else {
    var obs = new MutationObserver(function () {
      var h = document.getElementById('hojaModelo');
      if (h) { obs.disconnect(); vigilar(h); }
    });
    obs.observe(document.body, { childList: true });
  }
})();
