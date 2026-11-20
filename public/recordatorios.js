/* Recordatorios: panel del sidebar y avisos mientras Jarvis está abierto (en pantalla o en segundo plano). */
(function () {
  var lista = [], cargado = false, panel = null, contLista = null, msg = null, vistos = {};
  function h(tag, clase, texto) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  }
  function api(url, metodo, cuerpo) {
    var o = { method: metodo || 'GET' };
    if (cuerpo) { o.headers = { 'Content-Type': 'application/json' }; o.body = JSON.stringify(cuerpo); }
    return fetch(url, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || 'error');
        return d;
      });
    });
  }
  function cuando(c) {
    return new Date(c).toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function porFecha(a, b) { return new Date(a.cuando) - new Date(b.cuando); }
  function sinc() { try { if (window.jarvisNativo) window.jarvisNativo.sincronizar(lista); } catch (e) {} }
  function cargar() {
    return api('/recordatorios').then(function (d) {
      lista = d.recordatorios || []; cargado = true; pintar(); revisar(); sinc();
    }).catch(function () {});
  }
  function notificar(r) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var t = 'Jarvis · Recordatorio';
    var o = { body: r.texto, tag: 'rec-' + r.id, icon: '/icon.svg', vibrate: [200, 100, 200] };
    var plan = function () { try { new Notification(t, o); } catch (e) {} };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(function (reg) { reg.showNotification(t, o); }).catch(plan);
    } else { plan(); }
  }
  function banner(r, tarde) {
    var b = h('div', 'recAviso');
    b.appendChild(h('strong', '', tarde ? 'Recordatorio atrasado' : 'Recordatorio'));
    b.appendChild(h('span', '', r.texto));
    var x = h('button', '', 'Listo'); x.type = 'button';
    x.addEventListener('click', function () { b.remove(); });
    b.appendChild(x);
    document.body.appendChild(b);
  }
  function avisar(r) {
    var tarde = Date.now() - new Date(r.cuando).getTime() > 600000;
    banner(r, tarde);
    notificar(r);
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
    try {
      if (typeof hablar === 'function' && !hablando && !procesando) {
        hablar('Señor, ' + (tarde ? 'tenía pendiente' : 'recordatorio') + ': ' + r.texto);
      }
    } catch (e) {}
  }
  function revisar() {
    var ahora = Date.now();
    lista.forEach(function (r) {
      if (r.avisado || vistos[r.id] || new Date(r.cuando).getTime() > ahora) return;
      vistos[r.id] = true;
      avisar(r);
      api('/recordatorios/' + r.id, 'PATCH', { avisado: true })
        .then(function () { r.avisado = true; pintar(); }).catch(function () {});
    });
  }
  function aviso(t) { if (msg) msg.textContent = t || ''; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function paraInput(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fila(r) {
    var f = h('div', 'recFila' + (r.avisado ? ' pasado' : ''));
    var t = h('div', 'recTxt');
    t.appendChild(h('div', '', r.texto));
    t.appendChild(h('small', '', cuando(r.cuando)));
    var b = h('button', 'recBorrar', '✕'); b.type = 'button'; b.setAttribute('aria-label', 'Borrar');
    b.addEventListener('click', function () {
      api('/recordatorios/' + r.id, 'DELETE').then(function () {
        lista = lista.filter(function (x) { return x.id !== r.id; }); sinc();
        pintar();
      }).catch(function () { aviso('No pude borrarlo, señor.'); });
    });
    f.appendChild(t); f.appendChild(b);
    return f;
  }
  function pintar() {
    if (!contLista) return;
    contLista.textContent = '';
    var pend = lista.filter(function (x) { return !x.avisado; });
    var pas = lista.filter(function (x) { return x.avisado; }).reverse().slice(0, 20);
    if (!lista.length) contLista.appendChild(h('p', 'recVacio', 'No tiene recordatorios, señor.'));
    if (pend.length) { contLista.appendChild(h('div', 'recSec', 'Pendientes')); pend.forEach(function (r) { contLista.appendChild(fila(r)); }); }
    if (pas.length) { contLista.appendChild(h('div', 'recSec', 'Anteriores')); pas.forEach(function (r) { contLista.appendChild(fila(r)); }); }
  }
  function cerrarPanel() { if (panel) panel.remove(); panel = null; contLista = null; msg = null; }
  function formulario() {
    var card = h('div', 'recCard');
    var txt = h('input'); txt.type = 'text'; txt.maxLength = 300; txt.placeholder = '¿Qué le recuerdo, señor?';
    var fh = h('input'); fh.type = 'datetime-local';
    var chips = h('div', 'recChips');
    [['En 10 min', function () { return new Date(Date.now() + 600000); }],
     ['En 1 hora', function () { return new Date(Date.now() + 3600000); }],
     ['Mañana 8:00', function () { var d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); return d; }]
    ].forEach(function (c) {
      var b = h('button', 'recChip', c[0]); b.type = 'button';
      b.addEventListener('click', function () { fh.value = paraInput(c[1]()); });
      chips.appendChild(b);
    });
    var add = h('button', 'recAdd', 'Agregar'); add.type = 'button';
    msg = h('p', 'recMsg');
    add.addEventListener('click', function () {
      var t = txt.value.trim(), d = fh.value ? new Date(fh.value) : null;
      if (!t) { aviso('Escriba qué debo recordarle, señor.'); return; }
      if (!d || isNaN(d)) { aviso('Elija la fecha y la hora, señor.'); return; }
      if (d.getTime() <= Date.now()) { aviso('Esa hora ya pasó, señor.'); return; }
      add.disabled = true;
      api('/recordatorios', 'POST', { texto: t, cuando: d.toISOString() }).then(function (res) {
        lista.push(res.recordatorio); lista.sort(porFecha); sinc();
        txt.value = ''; fh.value = ''; aviso(''); pintar();
      }).catch(function () { aviso('No pude guardarlo, señor.'); }).then(function () { add.disabled = false; });
    });
    [txt, fh, chips, add, msg].forEach(function (e) { card.appendChild(e); });
    return card;
  }
  function abrir() {
    if (panel) return;
    panel = h('div', 'recPanel');
    var cab = h('div', 'recCab');
    cab.appendChild(h('span', '', 'RECORDATORIOS'));
    var x = h('button', 'recX', '×'); x.type = 'button'; x.addEventListener('click', cerrarPanel);
    cab.appendChild(x);
    var cuerpo = h('div', 'recCuerpo');
    cuerpo.appendChild(formulario());
    if ('Notification' in window && Notification.permission === 'default') {
      var perm = h('button', 'recPerm', 'Activar avisos del teléfono'); perm.type = 'button';
      perm.addEventListener('click', function () { Notification.requestPermission().then(function () { perm.remove(); }); });
      cuerpo.appendChild(perm);
    }
    if (window.jarvisNativo && window.jarvisNativo.diagnostico) {
      var diag = h('button', 'recPerm', 'Probar aviso del teléfono'); diag.type = 'button';
      diag.addEventListener('click', function () { aviso('Probando…'); window.jarvisNativo.diagnostico().then(aviso); });
      cuerpo.appendChild(diag);
    }
    cuerpo.appendChild(h('p', 'recNota', 'Los avisos suenan mientras Jarvis esté abierto, en pantalla o en segundo plano.'));
    contLista = h('div');
    cuerpo.appendChild(contLista);
    panel.appendChild(cab); panel.appendChild(cuerpo);
    document.body.appendChild(panel);
    pintar();
  }
  var item = document.getElementById('sbRecordatorios');
  if (item) item.addEventListener('click', function () { cerrarSidebar(); abrir(); cargar(); });
  function tick() {
    if (!localStorage.getItem('jarvisAcceso')) return;
    if (!cargado) cargar(); else revisar();
  }
  setInterval(tick, 20000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  window.jarvisRecordatorios = { recargar: cargar };
  setTimeout(tick, 1500);
})();
