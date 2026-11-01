/* Manos de Jarvis: vincula este celular (solo en la app de Android) y muestra su estado en Herramientas. */
(function () {
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  var M = (cap.Plugins || {}).Manos || (cap.registerPlugin && cap.registerPlugin('Manos'));
  if (!M) return;
  var NOMBRE = nombreGuardado() || 'Mi celular';

  function nombreGuardado() {
    try { return localStorage.getItem('jarvisManosNombre') || ''; } catch (e) { return ''; }
  }
  function guardarNombre(n) {
    try { localStorage.setItem('jarvisManosNombre', n); } catch (e) {}
  }
  function modelo() {
    var m = /Android[^;]*;\s*([^;)]+?)(?:\s+Build|\))/.exec(navigator.userAgent || '');
    return m ? m[1].trim() : '';
  }
  function pedirNombre() {
    var sug = nombreGuardado() || modelo() || 'Mi celular';
    var n = window.prompt('\u00bfC\u00f3mo quieres llamar a este celular? (ej. Celular de mi hermano)', sug);
    if (n === null) return null;
    n = n.replace(/\s+/g, ' ').trim().slice(0, 40);
    return n || sug;
  }
  var estadoEl, ayudaEl, boton, accion = null;

  var css = document.createElement('style');
  css.textContent = '.mnCaja{margin:6px 12px 10px;padding:12px;border-radius:12px;border:1px solid rgba(0,229,255,.25);background:rgba(0,229,255,.05)}' +
    '.mnCaja b{font-size:14px}.mnEst{font-size:12px;margin-top:4px;line-height:1.4}' +
    '.mnAyuda{font-size:11px;margin-top:6px;line-height:1.4;color:var(--suave,#5d8590)}' +
    '.mnBtn{margin-top:10px;width:100%;padding:10px;border-radius:10px;border:1px solid var(--cian,#00e5ff);background:transparent;color:var(--cian,#00e5ff);font-size:14px;font-weight:600}' +
    '.mnBtn:disabled{opacity:.5}';
  document.head.appendChild(css);

  var autoBtn, paso1Btn, burbujaBtn, micBtn, palabraBtn, bateriaBtn;

  function json(r) {
    return r.json().then(function (d) {
      if (!r.ok) throw new Error(d.error || 'No pude completar la acción.');
      return d;
    });
  }

  function pintar() {
    M.estado().then(function (e) {
      if (paso1Btn) {
        paso1Btn.style.display = (e.vinculado && !e.servicio) ? 'block' : 'none';
        var hecho = false;
        try { hecho = !!localStorage.getItem('mnPaso1'); } catch (x) {}
        paso1Btn.textContent = hecho ? '1. ✓ Permitir ajustes restringidos (abrir otra vez)' : '1. Permitir ajustes restringidos';
      }
      if (autoBtn) {
        autoBtn.style.display = (e.vinculado && e.servicio) ? 'block' : 'none';
        autoBtn.textContent = e.auto ? 'Volver a pedir permiso' : 'Activar modo automático';
        autoBtn.dataset.auto = e.auto ? '1' : '';
      }
      if (burbujaBtn) {
        burbujaBtn.style.display = (e.vinculado && e.servicio) ? 'block' : 'none';
        burbujaBtn.textContent = e.burbuja ? 'Burbuja flotante: activada (tocar para apagar)' : 'Burbuja flotante: apagada (tocar para activar)';
        burbujaBtn.dataset.on = e.burbuja ? '1' : '';
      }
      if (palabraBtn) {
        palabraBtn.style.display = (e.vinculado && e.servicio && e.burbuja && e.mic) ? 'block' : 'none';
        palabraBtn.textContent = e.palabra ? 'Llamar diciendo \u00abJarvis\u00bb: activado (tocar para apagar)' : 'Llamar diciendo \u00abJarvis\u00bb: apagado (tocar para activar)';
        palabraBtn.dataset.on = e.palabra ? '1' : '';
      }
      if (bateriaBtn) bateriaBtn.style.display = (e.vinculado && e.servicio && e.bateriaLibre === false) ? 'block' : 'none';
      if (micBtn) micBtn.style.display = (e.vinculado && e.servicio && e.burbuja && !e.mic) ? 'block' : 'none';
      if (!e.vinculado) {
        estadoEl.textContent = 'Sin vincular. Vincula este celular para que Jarvis pueda ayudarte con la pantalla.';
        ayudaEl.textContent = '';
        boton.textContent = 'Vincular este celular';
        accion = vincular;
      } else if (!e.servicio) {
        estadoEl.textContent = 'Vinculado. Faltan 2 pasos para activar las manos.';
        ayudaEl.textContent = 'Paso 1 (solo la primera vez): en la pantalla que se abre toca ⋮ arriba a la derecha y elige «Permitir ajustes restringidos». Si no ves el ⋮, ya está permitido. Luego vuelve y haz el paso 2: busca Jarvis y actívalo.';
        boton.textContent = '2. Activar accesibilidad';
        accion = function () { M.abrirAjustes(); };
      } else {
        estadoEl.textContent = (e.auto ? 'Manos activas en MODO AUTOMÁTICO: Jarvis actúa sin pedirte permiso.' : 'Manos activas. Jarvis te pedirá permiso antes de tocar o escribir.');
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
    var elegido = pedirNombre();
    if (elegido === null) return;
    NOMBRE = elegido;
    guardarNombre(NOMBRE);
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

  function cambiarAuto() {
    var quiere = !autoBtn.dataset.auto;
    if (quiere && !window.confirm('Modo automático: Jarvis tocará, escribirá y hará scroll en tu celular SIN pedirte permiso cada vez. Úsalo solo si confías en lo que le pides. Para pararlo: vuelve a este botón o apaga Jarvis en Ajustes > Accesibilidad. ¿Activarlo?')) return;
    autoBtn.disabled = true;
    fetch('/manos/vincular', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: NOMBRE })
    }).then(json).then(function (d) {
      return M.configurar({ url: location.origin, token: d.token, auto: quiere });
    }).then(function () {
      autoBtn.disabled = false;
      pintar();
    }).catch(function (e) {
      estadoEl.textContent = e.message;
      autoBtn.disabled = false;
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
    paso1Btn = document.createElement('button');
    paso1Btn.type = 'button';
    paso1Btn.className = 'mnBtn';
    paso1Btn.style.display = 'none';
    paso1Btn.addEventListener('click', function () {
      try { localStorage.setItem('mnPaso1', '1'); } catch (x) {}
      var abrir = M.abrirInfoApp ? M.abrirInfoApp() : M.abrirAjustes();
      Promise.resolve(abrir).catch(function () { return M.abrirAjustes(); });
      paso1Btn.textContent = '1. ✓ Permitir ajustes restringidos (abrir otra vez)';
    });
    [t, estadoEl, ayudaEl, paso1Btn, boton].forEach(function (e) { caja.appendChild(e); });
    autoBtn = document.createElement('button');
    autoBtn.type = 'button';
    autoBtn.className = 'mnBtn';
    autoBtn.style.display = 'none';
    autoBtn.addEventListener('click', cambiarAuto);
    caja.appendChild(autoBtn);
    burbujaBtn = document.createElement('button');
    burbujaBtn.type = 'button';
    burbujaBtn.className = 'mnBtn';
    burbujaBtn.style.display = 'none';
    burbujaBtn.addEventListener('click', function () {
      Promise.resolve(M.burbuja({ activa: !burbujaBtn.dataset.on })).then(pintar).catch(function () {});
    });
    caja.appendChild(burbujaBtn);
    palabraBtn = document.createElement('button');
    palabraBtn.type = 'button';
    palabraBtn.className = 'mnBtn';
    palabraBtn.style.display = 'none';
    palabraBtn.addEventListener('click', function () {
      Promise.resolve(M.palabra({ activa: !palabraBtn.dataset.on })).then(pintar).catch(function () {});
    });
    caja.appendChild(palabraBtn);
    micBtn = document.createElement('button');
    micBtn.type = 'button';
    micBtn.className = 'mnBtn';
    micBtn.style.display = 'none';
    micBtn.textContent = 'Permitir micrófono para la burbuja';
    micBtn.addEventListener('click', function () {
      Promise.resolve(M.pedirMicrofono()).then(function () {
        setTimeout(pintar, 1500);
        setTimeout(pintar, 5000);
      }).catch(function () {});
    });
    caja.appendChild(micBtn);
    bateriaBtn = document.createElement('button');
    bateriaBtn.type = 'button';
    bateriaBtn.className = 'mnBtn';
    bateriaBtn.style.display = 'none';
    bateriaBtn.textContent = 'Pantalla apagada: permitir sin l\u00edmite de bater\u00eda';
    bateriaBtn.addEventListener('click', function () {
      Promise.resolve(M.pedirBateria()).then(function () {
        setTimeout(pintar, 1500);
        setTimeout(pintar, 5000);
      }).catch(function () {});
    });
    caja.appendChild(bateriaBtn);
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
  window.addEventListener('jarvis-ordenes', function () { if (boton) pintar(); });
})();
