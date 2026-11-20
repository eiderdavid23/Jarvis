/* Pantalla de inicio animada: se muestra una vez por apertura de la app */
(function () {
  var ya = false;
  try {
    ya = sessionStorage.getItem('jarvisSplash') === '1';
    sessionStorage.setItem('jarvisSplash', '1');
  } catch (e) {}
  if (ya || !document.body) return;

  var s = document.createElement('div');
  s.id = 'splash';
  s.setAttribute('aria-hidden', 'true');
  var letras = 'J.A.R.V.I.S.'.split('').map(function (c, i) {
    return '<span style="animation-delay:' + (0.25 + i * 0.07).toFixed(2) + 's">' + c + '</span>';
  }).join('');
  s.innerHTML =
    '<div class="sp-orbe"><span class="sp-glow"></span>' +
    '<svg class="sp-anillos" viewBox="0 0 200 200">' +
    '<circle class="a1" cx="100" cy="100" r="96"/><circle class="a2" cx="100" cy="100" r="78"/>' +
    '<circle class="a3" cx="100" cy="100" r="60"/></svg><span class="sp-nucleo"></span></div>' +
    '<div class="sp-titulo">' + letras + '</div>' +
    '<div class="sp-sub" id="spSub">Iniciando sistemas</div>' +
    '<div class="sp-barra"><i></i></div>';
  document.body.insertBefore(s, document.body.firstChild);

  var sub = document.getElementById('spSub');
  var pasos = ['Iniciando sistemas', 'Cargando memoria', 'Conectando', 'Listo, señor'];
  pasos.forEach(function (txt, i) {
    setTimeout(function () { if (sub) sub.textContent = txt; }, 800 + i * 400);
  });

  var t0 = Date.now(), MIN = 2200, cerrado = false;
  function cerrar() {
    if (cerrado) return;
    cerrado = true;
    s.classList.add('fuera');
    setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 800);
  }
  function cuandoCargue() {
    setTimeout(cerrar, Math.max(0, MIN - (Date.now() - t0)));
  }
  if (document.readyState === 'complete') cuandoCargue();
  else window.addEventListener('load', cuandoCargue);
  setTimeout(cerrar, 5000);   // tope: nunca se queda pegada
})();
