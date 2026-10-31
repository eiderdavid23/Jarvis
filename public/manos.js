/* Manos de Jarvis: vincula este celular (solo en la app de Android) y muestra su estado en Herramientas. */
(function () {
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  var M = (cap.Plugins || {}).Manos || (cap.registerPlugin && cap.registerPlugin('Manos'));
  if (!M) return;
  var NOMBRE = 'Mi celular';
  var estadoEl, ayudaEl, boton, accion = null;

  var css = document.createElement('style');
  css.textContent = '.mnCaja{margin:6px 12px 10px;padding:12px;border-radius:12px;border:1px solid rgba(0,229,255,.25);background:rgba(0,229,255,.05)}' +
    '.mnCaja b{font-size:14px}.mnEst{font-size:12px;margin-top:4px;line-height:1.4}' +
    '.mnAyuda{font-size:11px;margin-top:6px;line-height:1.4;color:var(--suave,#5d8590)}' +
    '.mnBtn{margin-top:10px;width:100%;padding:10px;border-radius:10px;border:1px solid var(--cian,#00e5ff);background:transparent;color:var(--cian,#00e5ff);font-size:14px;font-weight:600}' +
    '.mnBtn:disabled{opacity:.5}';
  document.head.appendChild(css);

  function json(r) {
    return r.json().then(function (d) {
      if (!r.ok) throw new Error(d.error || 'No pude completar la acción.');
      return d;
    });
  }

  function pintar() {
    M.estado().then(function (e) {
      if (!e.vinculado) {
        estadoEl.textContent = 'Sin vincular. Vincula este celular para que Jarvis pueda ayudarte con la pantalla.';
        ayudaEl.textContent = '';
        boton.textContent = 'Vincular este celular';
        accion = vincular;
      } else if (!e.servicio) {
        estadoEl.textContent = 'Vinculado. Falta activar el permiso de accesibilidad.';
        ayudaEl.textContent = 'Busca Jarvis en «Aplicaciones instaladas» y actívalo. Si Android lo bloquea: Ajustes > Apps > Jarvis, toca ⋮ y elige «Permitir ajustes restringidos».';
        boton.textContent = 'Abrir ajustes de accesibilidad';
        accion = function () { M.abrirAjustes(); };
      } else {
        estadoEl.textContent = 'Manos activas. Jarvis te pedirá permiso antes de tocar o escribir.';
        ayudaEl.textContent = 'Puedes apagarlas cuando quieras en Ajustes > Accesibilidad.';
        boton.textContent = 'Desvincular este celular';
        accion = desvincular;
      }
      boton.disabled = false;
    }).catch(function () {
      estadoEl.textContent = 'No pude leer el estado de las manos.';
      boton.disabled = true;
    });
  }

  function vincular() {
    boton.disabled = true;
    fetch('/manos/vincular', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: NOMBRE })
    }).then(json).then(function (d) {
      return M.configurar({ url: location.origin, token: d.token, auto: false });
    }).then(pintar).catch(function (e) {
      estadoEl.textContent = e.message;
      boton.disabled = false;
    });
  }

  function desvincular() {
    boton.disabled = true;
    fetch('/manos/dispositivos').then(json).then(function (lista) {
      var f = lista.filter(function (x) { return x.nombre === NOMBRE; })[0];
      return f ? fetch('/manos/dispositivos/' + f.id, { method: 'DELETE' }) : null;
    }).then(function () { return M.desvincular(); }).then(pintar).catch(function (e) {
      estadoEl.textContent = e.message;
      boton.disabled = false;
    });
  }

  function montar() {
    var cont = document.getElementById('hrCont');
    if (!cont || document.getElementById('mnCaja')) return !!cont;
    var caja = document.createElement('div');
    caja.className = 'mnCaja';
    caja.id = 'mnCaja';
    var t = document.createElement('b');
    t.textContent = 'Manos de Jarvis';
    estadoEl = document.createElement('div');
    estadoEl.className = 'mnEst';
    ayudaEl = document.createElement('div');
    ayudaEl.className = 'mnAyuda';
    boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'mnBtn';
    boton.disabled = true;
    boton.addEventListener('click', function () { if (accion) accion(); });
    [t, estadoEl, ayudaEl, boton].forEach(function (e) { caja.appendChild(e); });
    cont.parentNode.insertBefore(caja, cont.nextSibling);
    pintar();
    return true;
  }

  var intentos = 0;
  var reloj = setInterval(function () {
    if (montar() || ++intentos > 30) clearInterval(reloj);
  }, 300);

  var APP = (cap.Plugins || {}).App;
  if (APP && APP.addListener) APP.addListener('appStateChange', function (s) { if (s && s.isActive && boton) pintar(); });
})();
