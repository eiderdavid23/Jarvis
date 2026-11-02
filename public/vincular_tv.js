/* Vincular una TV (Android TV / Google TV) con Jarvis.
   En la app de Android todo se hace aqui, sin Termux. En el navegador queda el metodo de Termux. */
(function () {
  var cap = window.Capacitor;
  var M = null;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
    M = (cap.Plugins || {}).Manos || (cap.registerPlugin && cap.registerPlugin('Manos'));
  }
  var css = document.createElement('style');
  css.textContent = '.tvCaja{margin:6px 12px 10px;padding:12px;border-radius:12px;border:1px solid rgba(0,229,255,.25);background:rgba(0,229,255,.05);font-size:13px}' +
    '.tvCaja b{display:block;margin-bottom:4px}.tvAyuda{opacity:.75;line-height:1.4;margin-bottom:8px}' +
    '.tvBtn{width:100%;padding:10px;margin-top:6px;border-radius:10px;border:1px solid rgba(0,229,255,.35);background:rgba(0,229,255,.1);color:inherit;font:inherit;cursor:pointer}' +
    '.tvIn{width:100%;box-sizing:border-box;margin-top:6px;padding:10px;border-radius:8px;border:1px solid rgba(0,229,255,.25);background:rgba(0,0,0,.25);color:inherit;font:18px monospace;letter-spacing:4px;text-align:center;text-transform:uppercase}' +
    '.tvCmd{width:100%;box-sizing:border-box;margin-top:6px;padding:8px;border-radius:8px;border:1px solid rgba(0,229,255,.25);background:rgba(0,0,0,.25);color:inherit;font:12px monospace;resize:none}' +
    '.tvErr{color:#ff8a80;margin-top:6px;line-height:1.4}.tvOk{color:#69f0ae;margin-bottom:6px}';
  document.head.appendChild(css);

  var cuerpo = null;

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt) e.textContent = txt;
    return e;
  }
  function boton(txt, fn) {
    var b = el('button', 'tvBtn', txt);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }
  function vista() {
    cuerpo.textContent = '';
    for (var i = 0; i < arguments.length; i++) cuerpo.appendChild(arguments[i]);
  }
  function msg(e) {
    return (e && e.message) ? e.message : String(e || 'No se pudo.');
  }
  function limpiarNombre(n, def) {
    n = (n || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return n || def;
  }
  function json(r) {
    return r.json().then(function (d) {
      if (!r.ok) throw new Error(d.error || d.respuesta || 'No se pudo vincular la TV.');
      return d;
    });
  }
  function crearToken(nombre) {
    return fetch('/manos/vincular', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre, plataforma: 'tv' })
    }).then(json);
  }

  // ---- Dentro de la app: todo sin Termux ----------------------------------------

  function inicio(nota) {
    var ayuda = el('div', 'tvAyuda', 'Para una Android TV o Google TV. Jarvis sube o baja el volumen, abre apps, pulsa el control y enciende o apaga. Tu celular y la TV deben estar en el mismo WiFi. No necesitas Termux.');
    var partes = [ayuda, boton('Buscar mi TV', buscar)];
    if (nota) partes.push(el('div', 'tvErr', nota));
    vista.apply(null, partes);
  }

  function buscar() {
    vista(el('div', 'tvAyuda', 'Buscando TVs en tu WiFi... (unos 15 segundos)'));
    M.tvBuscar().then(function (r) {
      var tvs = (r && r.tvs) || [];
      if (!tvs.length) return manual('No encontré ninguna TV. Revisa que esté encendida y en el mismo WiFi, o escribe su IP (Ajustes de la TV > Red).' + (r && r.rango ? ' Busqué en: ' + r.rango + '.' : ''));
      var partes = [el('div', 'tvAyuda', 'Toca tu TV:')];
      tvs.forEach(function (t) {
        partes.push(boton(t.nombre + ' (' + t.ip + ')', function () { elegir(t.nombre, t.ip); }));
      });
      partes.push(boton('Mi TV no aparece: escribir la IP', function () { manual(''); }));
      vista.apply(null, partes);
    }).catch(function (e) {
      manual(msg(e));
    });
  }

  function manual(nota) {
    var ip = window.prompt((nota ? nota + '\n\n' : '') + 'IP de la TV en tu WiFi (ej. 192.168.1.20). Está en Ajustes de la TV > Red.', '');
    if (ip === null) return inicio('');
    ip = ip.trim();
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return inicio('Esa IP no parece válida. Debe ser como 192.168.1.20.');
    elegir('TV', ip);
  }

  function elegir(nombre, ip) {
    var n = window.prompt('¿Cómo quieres llamar a esta TV? (ej. TV de la sala)', nombre && nombre.length <= 40 ? nombre : 'TV');
    if (n === null) return inicio('');
    n = limpiarNombre(n, 'TV');
    vista(el('div', 'tvAyuda', 'Conectando con la TV... En su pantalla va a salir un código.'));
    M.tvEmparejarIniciar({ ip: ip }).then(function () {
      codigo(n, ip);
    }).catch(function (e) {
      inicio(msg(e));
    });
  }

  function codigo(n, ip) {
    var entrada = el('input', 'tvIn');
    entrada.type = 'text';
    entrada.maxLength = 6;
    entrada.placeholder = 'CÓDIGO';
    entrada.autocapitalize = 'characters';
    entrada.autocomplete = 'off';
    var nota = el('div', 'tvErr');
    var ok = boton('Emparejar', function () {
      nota.textContent = '';
      ok.disabled = true;
      M.tvEmparejarCodigo({ codigo: entrada.value }).then(function () {
        finalizar(n, ip);
      }).catch(function (e) {
        nota.textContent = msg(e);
        ok.disabled = false;
      });
    });
    vista(el('div', 'tvAyuda', 'Mira la TV: aparece un código de 6 caracteres (números y letras A a F). Escríbelo aquí.'),
      entrada, ok, boton('Cancelar', function () { inicio(''); }), nota);
  }

  function finalizar(n, ip) {
    vista(el('div', 'tvAyuda', 'Vinculando con Jarvis...'));
    crearToken(n).then(function (d) {
      return M.tvVincular({ url: location.origin, token: d.token, ip: ip, nombre: d.nombre || n });
    }).then(function () {
      return M.tvEstado();
    }).then(vinculada).catch(function (e) {
      inicio(msg(e));
    });
  }

  function vinculada(e) {
    vista(el('div', 'tvOk', '✓ TV vinculada: ' + (e.nombre || 'TV') + ' (' + e.ip + ')'),
      el('div', 'tvAyuda', 'Ya puedes decirle a Jarvis: «sube el volumen de la TV», «abre YouTube en la TV» o «apaga la TV». Deja las Manos de Jarvis activas y el celular en el mismo WiFi que la TV.'),
      boton('Quitar esta TV', function () {
        if (!window.confirm('¿Quitar esta TV de Jarvis?')) return;
        M.tvDesvincular().then(function () { inicio(''); });
      }));
  }

  // ---- En el navegador (o APK vieja): metodo de Termux --------------------------

  function termux(nota) {
    var ayuda = el('div', 'tvAyuda', (nota ? nota + ' ' : '') + 'Para una Android TV o Google TV. En el navegador necesitas Termux con agente_tv.py en un celular conectado al mismo WiFi que la TV.');
    var btn = boton('Vincular una TV', function () {
      var n = window.prompt('¿Cómo quieres llamar a esta TV? (ej. TV de la sala)', 'TV');
      if (n === null) return;
      n = limpiarNombre(n, 'TV');
      var ip = window.prompt('IP de la TV en tu WiFi (ej. 10.0.0.43). Está en Ajustes de la TV > Red.', '');
      if (ip === null) return;
      ip = ip.trim();
      if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
        nota2.textContent = 'Esa IP no parece válida. Debe ser como 10.0.0.43.';
        return;
      }
      btn.disabled = true;
      crearToken(n).then(function (d) {
        cmd.value = 'python agente_tv.py --ip ' + ip + ' --url ' + location.origin + ' --token ' + d.token;
        cmd.style.display = 'block';
        copiar.style.display = 'block';
        nota2.textContent = 'Primero, una sola vez: python agente_tv.py --ip ' + ip + ' --emparejar (te sale un código en la TV). Luego ejecuta este comando en Termux. Es secreto: no lo compartas.';
        btn.disabled = false;
      }).catch(function (e) {
        nota2.textContent = msg(e);
        btn.disabled = false;
      });
    });
    var cmd = el('textarea', 'tvCmd');
    cmd.rows = 4;
    cmd.readOnly = true;
    cmd.style.display = 'none';
    var copiar = boton('Copiar comando', function () {
      cmd.select();
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(cmd.value);
        else document.execCommand('copy');
        copiar.textContent = 'Copiado ✓';
      } catch (e) {}
    });
    copiar.style.display = 'none';
    var nota2 = el('div', 'tvAyuda');
    nota2.style.marginTop = '6px';
    vista(ayuda, btn, cmd, copiar, nota2);
  }

  // ---- Montaje ---------------------------------------------------------------------

  function montar() {
    var antes = document.getElementById('pcCaja') || document.getElementById('hrCont');
    if (!antes || document.getElementById('tvCaja')) return !!antes;
    var caja = el('div', 'tvCaja');
    caja.id = 'tvCaja';
    caja.appendChild(el('b', '', 'Controlar una TV'));
    cuerpo = el('div');
    caja.appendChild(cuerpo);
    antes.parentNode.insertBefore(caja, antes.nextSibling);
    if (!M) {
      termux('');
    } else {
      M.tvEstado().then(function (e) {
        if (e && e.vinculada) vinculada(e); else inicio('');
      }).catch(function () {
        termux('Esta versión de la app aún no controla la TV sola: actualiza la APK.');
      });
    }
    return true;
  }

  var intentos = 0;
  var reloj = setInterval(function () {
    if (montar() || ++intentos > 40) clearInterval(reloj);
  }, 300);
})();
