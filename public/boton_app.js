/* Boton "Descargar app" (v1.60, solo web): al tocarlo abre una ventanita para ELEGIR si quieres
   Jarvis para Android (APK) o para PC (Windows, Mac o Linux). Marca como recomendado lo que
   corresponde al aparato donde estas. No sale dentro de la app ni en iPhone.
   Los archivos de PC salen de la Release fija "pc-latest" (la arma .github/workflows/build-pc.yml).
   Para volver atras: quitar sus lineas de index.html. */
(function () {
  'use strict';
  var REPO = 'eiderdavid23/Jarvis';
  var BASE = 'https://github.com/' + REPO + '/releases/download/';
  var APK = BASE + 'apk-latest/jarvis.apk';
  var PC = {
    windows: { archivo: 'JarvisPC-Windows.exe', nombre: 'Windows', nota: 'Si Windows avisa que protegio tu PC: Mas informacion > Ejecutar de todas formas.' },
    mac: { archivo: 'JarvisPC-Mac.zip', nombre: 'Mac', nota: 'Descomprime el .zip y abre JarvisPC (la primera vez: clic derecho > Abrir).' },
    linux: { archivo: 'JarvisPC-Linux.tar.gz', nombre: 'Linux', nota: 'Descomprime con tar xzf y ejecuta ./JarvisPC.' }
  };
  var cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()) return;
  try {
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return;
  } catch (e) {}
  var barra = document.getElementById('barra');
  if (!barra || document.getElementById('btnApp')) return;

  var ua = navigator.userAgent || '';
  var aparato; // 'android' | 'windows' | 'mac' | 'linux'
  if (/Android/i.test(ua)) aparato = 'android';
  else if (/iPhone|iPad|iPod/i.test(ua)) return;
  else if (/Windows/i.test(ua)) aparato = 'windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) aparato = 'mac';
  else if (/Linux|X11|CrOS/i.test(ua)) aparato = 'linux';
  else return;

  function el(tag, cls, texto) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto != null) e.textContent = texto;
    return e;
  }
  function bajar(url) {
    var a = document.createElement('a');
    a.href = url; a.rel = 'noopener'; a.download = '';
    document.body.appendChild(a); a.click(); a.remove();
  }

  var disponibles = null; // archivos que ya existen en pc-latest (null = no se pudo saber)
  function consultarPC(cb) {
    if (disponibles !== null) return cb();
    fetch('https://api.github.com/repos/' + REPO + '/releases/tags/pc-latest')
      .then(function (r) {
        if (r.status === 404) return { assets: [] }; // todavia no se publico nada
        return r.ok ? r.json() : null;               // otro error (limite de GitHub...): no se sabe
      })
      .then(function (rel) {
        if (rel && rel.assets) disponibles = rel.assets.map(function (a) { return a.name; });
      })
      .catch(function () {})
      .then(cb);
  }

  var capa = null;
  function cerrar() {
    if (!capa) return;
    document.removeEventListener('keydown', teclas);
    capa.classList.remove('abierto');
    var c = capa; capa = null;
    setTimeout(function () { c.remove(); }, 180);
  }
  function teclas(e) { if (e.key === 'Escape') cerrar(); }

  function abrir() {
    if (capa) return;
    capa = el('div', 'dlCapa');
    capa.addEventListener('click', function (e) { if (e.target === capa) cerrar(); });
    var caja = el('div', 'dlCaja');
    caja.setAttribute('role', 'dialog');
    caja.setAttribute('aria-label', 'Descargar Jarvis');
    caja.appendChild(el('div', 'dlTitulo', 'Descargar Jarvis'));
    caja.appendChild(el('div', 'dlSub', 'Elige para que aparato la quieres.'));

    // Android
    var tAnd = el('div', 'dlTarjeta' + (aparato === 'android' ? ' reco' : ''));
    tAnd.appendChild(el('div', 'dlNombre', 'Android'));
    tAnd.appendChild(el('div', 'dlDesc', 'App para el celular: burbuja, voz y manos de Jarvis.'));
    var bAnd = el('button', 'dlBtn', 'Descargar APK');
    bAnd.type = 'button';
    bAnd.addEventListener('click', function () { bajar(APK); cerrar(); });
    tAnd.appendChild(bAnd);
    if (aparato === 'android') tAnd.appendChild(el('span', 'dlEtiqueta', 'Recomendado'));

    // PC
    var esPC = aparato !== 'android';
    var tPC = el('div', 'dlTarjeta' + (esPC ? ' reco' : ''));
    tPC.appendChild(el('div', 'dlNombre', 'PC'));
    tPC.appendChild(el('div', 'dlDesc', 'Programa para el computador: Jarvis completo en su ventana y control del PC.'));
    var fila = el('div', 'dlFila');
    var notaPC = el('div', 'dlNota', '');
    var botonesPC = {};
    ['windows', 'mac', 'linux'].forEach(function (k) {
      var b = el('button', 'dlBtn' + (k === aparato ? ' principal' : ''), PC[k].nombre);
      b.type = 'button';
      botonesPC[k] = b;
      b.addEventListener('click', function () {
        bajar(BASE + 'pc-latest/' + PC[k].archivo);
        notaPC.textContent = PC[k].nota + ' Al abrirlo, pega el texto de Ajustes > Manos de Jarvis > Controlar un PC.';
      });
      fila.appendChild(b);
    });
    tPC.appendChild(fila);
    tPC.appendChild(notaPC);
    if (esPC) tPC.appendChild(el('span', 'dlEtiqueta', 'Recomendado'));

    // En PC se muestra primero la tarjeta de PC; en el celular, la de Android.
    if (esPC) { caja.appendChild(tPC); caja.appendChild(tAnd); } else { caja.appendChild(tAnd); caja.appendChild(tPC); }

    var x = el('button', 'dlCerrar', 'Cerrar');
    x.type = 'button';
    x.addEventListener('click', cerrar);
    caja.appendChild(x);
    capa.appendChild(caja);
    document.body.appendChild(capa);
    document.addEventListener('keydown', teclas);
    requestAnimationFrame(function () { if (capa) capa.classList.add('abierto'); });

    // Si ya se sabe que un archivo de PC todavia no esta publicado, se avisa.
    consultarPC(function () {
      if (!capa) return;
      if (disponibles === null) return;
      if (disponibles.length === 0) {
        notaPC.textContent = 'La version de PC todavia se esta preparando. Prueba de nuevo en unos minutos.';
        Object.keys(botonesPC).forEach(function (k) { botonesPC[k].disabled = true; });
        return;
      }
      Object.keys(PC).forEach(function (k) {
        if (disponibles.indexOf(PC[k].archivo) < 0) {
          botonesPC[k].disabled = true;
          botonesPC[k].title = 'Todavia no esta disponible';
        }
      });
    });
  }

  var tip = 'Descargar Jarvis (Android o PC)';
  var btn = document.createElement('button');
  btn.id = 'btnApp'; btn.type = 'button'; btn.title = tip; btn.setAttribute('aria-label', tip);
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/>' +
    '<path d="M7 11l5 5 5-5"/><path d="M5 21h14"/></svg><span>Descargar app</span>';
  btn.addEventListener('click', abrir);
  var grupo = barra.querySelector('.grupoBarra');
  barra.insertBefore(btn, grupo || null);
})();
