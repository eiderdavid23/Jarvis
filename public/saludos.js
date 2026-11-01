/* Saludos de la pantalla de inicio: cambian con la hora, el dia de la semana, la fecha y tus recordatorios de hoy. */
(function () {
  var DIAS = ['domingo', 'lunes', 'martes', 'mi\u00e9rcoles', 'jueves', 'viernes', 's\u00e1bado'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
    'octubre', 'noviembre', 'diciembre'];
  var SALUDOS = {
    madrugada: ['Buenas noches, {n}', 'Despierto a estas horas, {n}', 'Madrugada de trabajo, {n}', 'A\u00fan es de madrugada, {n}'],
    manana: ['Buenos d\u00edas, {n}', 'Buen d\u00eda, {n}', 'Arrancamos la ma\u00f1ana, {n}', 'Bienvenido de vuelta, {n}'],
    mediodia: ['Buen mediod\u00eda, {n}', 'Hola, {n}', 'A mitad del d\u00eda, {n}', 'Bienvenido de vuelta, {n}'],
    tarde: ['Buenas tardes, {n}', 'Qu\u00e9 gusto verle, {n}', 'Hola de nuevo, {n}', 'Tarde productiva, {n}'],
    noche: ['Buenas noches, {n}', 'Noche tranquila, {n}', 'Hola de nuevo, {n}', 'A su servicio esta noche, {n}']
  };
  var POR_DIA = {
    1: ['Arrancamos la semana, {n}'], 5: ['Por fin viernes, {n}'],
    6: ['Buen s\u00e1bado, {n}'], 0: ['Domingo tranquilo, {n}']
  };
  var SUBS = ['\u00bfEn qu\u00e9 puedo ayudarle?', '\u00bfQu\u00e9 hacemos hoy?', '\u00bfPor d\u00f3nde empezamos?',
    'Todos los sistemas listos.', 'D\u00edgame qu\u00e9 necesita.'];
  var SUBS_TRAMO = {
    madrugada: ['Estoy aqu\u00ed si me necesita.'], manana: ['\u00bfQu\u00e9 toca primero hoy?'],
    mediodia: ['\u00bfC\u00f3mo va el d\u00eda?'], tarde: ['\u00bfC\u00f3mo va el d\u00eda?'],
    noche: ['\u00bfAlgo antes de descansar?']
  };
  var SUBS_DIA = {
    1: ['\u00bfPlaneamos la semana?'], 5: ['\u00bfCerramos la semana con algo?'],
    0: ['Un buen d\u00eda para ordenar ideas.']
  };
  var CHIPS = ['\u00bfQu\u00e9 d\u00eda es hoy?', 'Cu\u00e9ntame algo interesante', 'Abre YouTube',
    'Ay\u00fadame a organizar mi d\u00eda', 'Dame una idea para un proyecto', 'Expl\u00edcame algo en un minuto',
    'Ponme un recordatorio para ma\u00f1ana', '\u00bfQu\u00e9 hay de nuevo en tecnolog\u00eda?',
    'Ay\u00fadame a escribir un mensaje', 'Dime un dato curioso'];

  var sorteo = null;
  var pendientes = null;   // recordatorios de hoy que aun no suenan: { n, proximo }

  function tramo(h) {
    return h < 6 ? 'madrugada' : h < 12 ? 'manana' : h < 14 ? 'mediodia' : h < 20 ? 'tarde' : 'noche';
  }
  function sortear() {
    var orden = [];
    for (var i = 0; i < CHIPS.length; i++) orden.push(i);
    for (var j = orden.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = orden[j]; orden[j] = orden[k]; orden[k] = t;
    }
    sorteo = { a: Math.random(), b: Math.random(), c: Math.random(), orden: orden };
  }
  function elegir(lista, r) { return lista[Math.min(lista.length - 1, Math.floor(r * lista.length))]; }
  function dosDigitos(x) { return (x < 10 ? '0' : '') + x; }

  function textoSub(ahora, tr) {
    if (pendientes && pendientes.n > 0 && sorteo.c < 0.6) {
      if (pendientes.n === 1 && pendientes.proximo) {
        var t = String(pendientes.proximo.texto || '').trim();
        if (t.length > 40) t = t.slice(0, 40) + '\u2026';
        var f = new Date(pendientes.proximo.cuando);
        return 'Hoy tiene un recordatorio: \u00ab' + t + '\u00bb a las ' + dosDigitos(f.getHours()) + ':' + dosDigitos(f.getMinutes()) + '.';
      }
      return 'Tiene ' + pendientes.n + ' recordatorios para hoy.';
    }
    var pool = SUBS.concat(SUBS_TRAMO[tr] || [], SUBS_DIA[ahora.getDay()] || [],
      ['Hoy es ' + DIAS[ahora.getDay()] + ' ' + ahora.getDate() + ' de ' + MESES[ahora.getMonth()] + '.']);
    return elegir(pool, sorteo.b);
  }

  function aplicar() {
    var h1 = document.getElementById('saludo');
    if (!h1) return;
    if (!sorteo) sortear();
    var m = /,\s*([^,]+)$/.exec(h1.textContent || '');
    var nombre = m ? m[1] : 'se\u00f1or';
    var ahora = new Date();
    var tr = tramo(ahora.getHours());
    h1.textContent = elegir(SALUDOS[tr].concat(POR_DIA[ahora.getDay()] || []), sorteo.a).replace('{n}', nombre);
    var p = document.querySelector('#bienvenida > p');
    if (p) p.textContent = textoSub(ahora, tr);
    var cs = document.querySelectorAll('#bienvenida .chip');
    for (var i = 0; i < cs.length && i < sorteo.orden.length; i++) {
      var txt = CHIPS[sorteo.orden[i]];
      cs[i].textContent = txt;
      cs[i].dataset.msg = txt;
    }
  }

  var previa = window.actualizarSaludo;
  window.actualizarSaludo = function () {
    if (typeof previa === 'function') previa();
    try { aplicar(); } catch (e) {}
  };
  try { window.actualizarSaludo(); } catch (e) {}

  // cada vez que se vuelve a la pantalla de inicio (chat nuevo) sale un saludo distinto
  var estabaInicio = document.body.classList.contains('m-inicio');
  new MutationObserver(function () {
    var ahora = document.body.classList.contains('m-inicio');
    if (ahora && !estabaInicio) { sortear(); try { aplicar(); } catch (e) {} }
    estabaInicio = ahora;
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // recordatorios de hoy (una sola consulta al abrir la app)
  function cargarRecordatorios() {
    var acceso = '';
    try { acceso = localStorage.getItem('jarvisAcceso') || ''; } catch (e) {}
    if (!acceso) return;
    fetch('/recordatorios').then(function (r) { return r.ok ? r.json() : {}; }).then(function (d) {
      var ahora = Date.now();
      var fin = new Date(); fin.setHours(23, 59, 59, 999);
      var l = (d.recordatorios || []).filter(function (r) {
        var t = new Date(r.cuando).getTime();
        return !r.avisado && t > ahora && t <= fin.getTime();
      }).sort(function (a, b) { return new Date(a.cuando) - new Date(b.cuando); });
      pendientes = { n: l.length, proximo: l[0] || null };
      aplicar();
    }).catch(function () {});
  }
  window.addEventListener('load', function () { setTimeout(cargarRecordatorios, 2500); });
})();
