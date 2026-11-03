/* Interruptor del modo Seguridad: apagado por defecto, el usuario lo prende cuando quiere
   que Jarvis actue como analista de ciberseguridad y pueda usar auditar_proyecto. */
(function () {
  var CLAVE = 'jarvisModoSeguridad';

  function activo() {
    try { return localStorage.getItem(CLAVE) === '1'; } catch (e) { return false; }
  }
  function guardar(on) {
    try { localStorage.setItem(CLAVE, on ? '1' : '0'); } catch (e) {}
  }
  function pintar() {
    var c = document.getElementById('segChk');
    if (c) c.checked = activo();
  }

  window.modoSeguridadOn = activo;
  window.modoSeguridadAplicar = function (on) {
    if (on === activo()) return false;
    guardar(on);
    pintar();
    return true;
  };

  function construir() {
    var cont = document.getElementById('hrCont');
    if (!cont || document.getElementById('segFila')) return !!cont;

    var fila = document.createElement('label');
    fila.className = 'hrFila';
    fila.id = 'segFila';

    var txt = document.createElement('span');
    txt.className = 'hrTxt';
    var b = document.createElement('b');
    b.textContent = 'Modo seguridad';
    var s = document.createElement('small');
    s.textContent = 'Jarvis como analista de ciberseguridad; revisa tu propio proyecto en busca de fallos. Apagado por defecto.';
    txt.appendChild(b);
    txt.appendChild(s);

    var chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.id = 'segChk';
    chk.checked = activo();
    chk.addEventListener('change', function () {
      guardar(chk.checked);
    });
    var sw = document.createElement('span');
    sw.className = 'hrSw';

    fila.appendChild(txt);
    fila.appendChild(chk);
    fila.appendChild(sw);
    cont.appendChild(fila);
    return true;
  }

  var intentos = 0;
  var reloj = setInterval(function () {
    if (construir() || ++intentos > 40) clearInterval(reloj);
  }, 300);
})();
