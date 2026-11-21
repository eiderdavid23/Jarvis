/* Esfera de Jarvis, estilo "erizo" de particulas (v1.55, solo web).
   Una bola de miles de puntos brillantes que gira y respira. Al escuchar o
   hablar, racimos de puntos se disparan en picos segun la fuerza de la voz.
   El color es siempre el mismo cian, en cualquier estado y tema.
   index.html la llama desde su bucle: jarvisEsfera.dibujar(ctx, w, h, estado).
   Devuelve false si el estilo es "clasica" y entonces dibuja el de siempre.
   Cambiar de estilo: abrir la app con ?esfera=clasica o ?esfera=erizo (se guarda). */
(function () {
  'use strict';
  var N_MAX = 3200, cuenta = 2400;
  var px = new Float32Array(N_MAX), py = new Float32Array(N_MAX), pz = new Float32Array(N_MAX);
  var fase = new Float32Array(N_MAX), kk = new Float32Array(N_MAX), rr = new Float32Array(N_MAX);

  /* Puntos repartidos parejo en una bola (cascara y relleno), en orden mezclado
     para poder quitar puntos sin dejar la esfera a medias */
  (function () {
    var oro = Math.PI * (3 - Math.sqrt(5)), ord = [], i, j, tmp;
    for (i = 0; i < N_MAX; i++) ord.push(i);
    for (i = N_MAX - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); tmp = ord[i]; ord[i] = ord[j]; ord[j] = tmp; }
    for (i = 0; i < N_MAX; i++) {
      var n = ord[i], y = 1 - (n / (N_MAX - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), th = oro * n;
      px[i] = Math.cos(th) * r; py[i] = y; pz[i] = Math.sin(th) * r;
      fase[i] = Math.random() * 6.2832; kk[i] = Math.random();
      rr[i] = Math.random() < 0.6 ? 0.92 + 0.08 * Math.random() : 0.2 + 0.72 * Math.sqrt(Math.random());
    }
  })();

  var CIAN = [30, 215, 255];   /* fijo: no cambia con el estado ni con el tema */
  var GIRO = { reposo: 0.25, escuchando: 0.55, pensando: 1.15, hablando: 0.75 };
  var nivel = 0, giro = 0, vGiro = 0.25, ultimo = 0, cuadros = 0, acum = 0;
  var cubos = [], nc = [0, 0, 0, 0], i;
  for (i = 0; i < 4; i++) cubos.push(new Float32Array(N_MAX * 2));
  var lineas = new Float32Array(N_MAX * 4), nl = 0;
  var lienzo = document.getElementById('orbCanvas'), escala = 1, nEsc = 0, anchoCss = 160;

  /* Punto brillante: centro claro y halo cian que se desvanece */
  var punto = document.createElement('canvas');
  punto.width = punto.height = 32;
  var pc = punto.getContext('2d'), pg = pc.createRadialGradient(16, 16, 0, 16, 16, 16);
  pg.addColorStop(0, 'rgba(215,253,255,1)'); pg.addColorStop(0.22, 'rgba(60,225,255,0.95)');
  pg.addColorStop(0.55, 'rgba(0,190,240,0.3)'); pg.addColorStop(1, 'rgba(0,170,230,0)');
  pc.fillStyle = pg; pc.fillRect(0, 0, 32, 32);

  var estilo = 'erizo';
  try {
    var q = new URLSearchParams(location.search).get('esfera');
    if (q === 'clasica' || q === 'erizo') localStorage.setItem('jarvisEsfera', q);
    var s = localStorage.getItem('jarvisEsfera');
    if (s === 'clasica' || s === 'erizo') estilo = s;
  } catch (e) {}

  /* El lienzo se dibuja mas grande que el orbe para que los picos tengan espacio */
  function aplicarLienzo() {
    if (lienzo) lienzo.style.cssText = estilo === 'erizo' ? 'position:absolute;left:-45%;top:-45%;width:190%;height:190%;pointer-events:none' : '';
  }
  aplicarLienzo();

  function rgb(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  function dibujar(ctx, w, h, estado) {
    if (estilo !== 'erizo') return false;
    var ahora = performance.now(), dt = ahora - ultimo;
    ultimo = ahora;
    if (dt > 100 || dt <= 0) dt = 16.7;

    /* Si el celular va lento, usa menos puntos; si sobra, vuelve a subir */
    cuadros++; acum += dt;
    if (cuadros === 60) {
      var prom = acum / 60;
      if (prom > 26 && cuenta > 900) cuenta = Math.max(900, cuenta - 300);
      else if (prom < 17.5 && cuenta < N_MAX) cuenta = Math.min(N_MAX, cuenta + 200);
      cuadros = 0; acum = 0;
    }
    /* Tamano real en pantalla (el orbe se achica en el chat) */
    if (lienzo && (nEsc++ % 20 === 0)) {
      var rw = lienzo.getBoundingClientRect().width;
      if (rw > 0) { anchoCss = rw; escala = rw / w; }
    }

    var tm = ahora / 1000;
    var pulso = (typeof ondaPulso === 'number') ? ondaPulso : 0;
    var obj;
    if (estado === 'hablando') obj = 0.55 + 0.25 * Math.sin(tm * 5.1) + 0.15 * Math.sin(tm * 11.3 + 1) + pulso * 0.5;
    else if (estado === 'escuchando') obj = 0.12 + 0.05 * Math.sin(tm * 2.2) + pulso * 0.85;
    else if (estado === 'pensando') obj = 0.1 + 0.05 * Math.sin(tm * 3);
    else obj = 0.03 + 0.015 * Math.sin(tm * 1.3);
    obj = Math.max(0, Math.min(1, obj));
    nivel += (obj - nivel) * Math.min(1, dt * 0.016);
    if (typeof ondaPulso === 'number') ondaPulso *= 0.93;
    if (typeof ondaNivel === 'number') ondaNivel = nivel;

    vGiro += ((GIRO[estado] || 0.25) - vGiro) * Math.min(1, dt * 0.003);
    giro += vGiro * dt / 1000;

    var claro = document.documentElement.getAttribute('data-tema') === 'claro';
    var cx = w / 2, cy = h / 2;
    var R = Math.min(w, h) * 0.16 * (1 + 0.03 * Math.sin(tm * 1.6) + nivel * 0.1 + pulso * 0.18);
    var cg = Math.cos(giro), sg = Math.sin(giro), ct = 0.94, st = 0.34;
    var pensando = estado === 'pensando';
    var cl = document.body.classList, tope = cl.contains('m-inicio') ? 0.45 : (cl.contains('m-voz') ? 0.7 : 1.1);
    /* Orbe chico = menos puntos (si no, se ve como un disco liso) */
    var total = Math.min(cuenta, Math.max(700, Math.round(cuenta * Math.min(1, anchoCss * 0.32 / 150))));
    nc[0] = nc[1] = nc[2] = nc[3] = 0; nl = 0;

    for (var n = 0; n < total; n++) {
      var x = px[n], y = py[n], z = pz[n], r0 = rr[n];
      var x1 = (x * cg + z * sg) * r0, z1 = (-x * sg + z * cg) * r0, y1 = y * r0;
      var y2 = y1 * ct - z1 * st, z2 = y1 * st + z1 * ct;
      var k = kk[n];
      /* Los picos salen en racimos que van cambiando de lugar */
      var g = Math.sin(x * 2.7 + tm * 1.4) + Math.sin(y * 3.1 - tm * 1.1) + Math.sin(z * 2.3 + tm * 0.9);
      var lobo = (g + 0.4) / 2.4;
      lobo = lobo < 0 ? 0 : (lobo > 1 ? 1 : lobo * lobo);
      var onda = 0.5 + 0.5 * Math.sin(tm * (2.5 + k * 3) + fase[n]);
      var pico = nivel * (0.3 + 0.7 * k) * lobo * (0.35 + 0.65 * onda) * 3.4;
      if (pensando) pico += 0.12 * Math.max(0, Math.sin(y * 5 - tm * 4));
      if (pico > tope) pico = tope;
      var f = 1 / (1 - z2 * 0.2);
      var sx = cx + x1 * R * (1 + pico) * f, sy = cy + y2 * R * (1 + pico) * f;
      var b = Math.min(3, ((0.3 + 0.7 * (z2 * 0.5 + 0.5)) * 4) | 0);
      cubos[b][nc[b]++ * 2] = sx; cubos[b][nc[b] * 2 - 1] = sy;
      if (pico > 0.14) {
        lineas[nl++] = cx + x1 * R * f; lineas[nl++] = cy + y2 * R * f;
        lineas[nl++] = sx; lineas[nl++] = sy;
      }
    }

    var antes = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'source-over';
    /* En tema claro, un fondo oscuro suave para que el brillo se vea */
    if (claro) {
      var gf = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.3);
      gf.addColorStop(0, 'rgba(6,26,44,0.92)'); gf.addColorStop(0.7, 'rgba(6,26,44,0.7)'); gf.addColorStop(1, 'rgba(6,26,44,0)');
      ctx.fillStyle = gf;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.3, 0, 6.2832); ctx.fill();
    }
    /* Nucleo brillante */
    var rc = R * 0.8 * (1 + nivel * 0.2);
    var g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, rc);
    g1.addColorStop(0, 'rgba(225,255,255,0.95)');
    g1.addColorStop(0.3, rgb(CIAN, 0.8));
    g1.addColorStop(1, rgb(CIAN, 0));
    ctx.fillStyle = g1;
    ctx.beginPath(); ctx.arc(cx, cy, rc, 0, 6.2832); ctx.fill();
    var g2 = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.7);
    g2.addColorStop(0, rgb(CIAN, 0.18)); g2.addColorStop(1, rgb(CIAN, 0));
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.7, 0, 6.2832); ctx.fill();

    ctx.globalCompositeOperation = claro ? 'source-over' : 'lighter';
    /* Picos */
    if (nl) {
      ctx.strokeStyle = rgb(CIAN, 0.4); ctx.lineWidth = Math.max(w * 0.002, 0.9 / escala); ctx.lineCap = 'round';
      ctx.beginPath();
      for (var l = 0; l < nl; l += 4) { ctx.moveTo(lineas[l], lineas[l + 1]); ctx.lineTo(lineas[l + 2], lineas[l + 3]); }
      ctx.stroke();
    }
    /* Puntos brillantes: del fondo al frente, mas claros y grandes los de adelante */
    var d0 = Math.max(w * 0.011, 3.2 / escala);
    for (var c = 0; c < 4; c++) {
      ctx.globalAlpha = 0.3 + 0.2 * c;
      var d = d0 * (0.8 + 0.17 * c), arr = cubos[c], m = nc[c] * 2;
      for (var p = 0; p < m; p += 2) ctx.drawImage(punto, arr[p] - d / 2, arr[p + 1] - d / 2, d, d);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = antes || 'source-over';
    return true;
  }

  window.jarvisEsfera = {
    dibujar: dibujar,
    estilo: function (nuevo) {
      if (nuevo === 'erizo' || nuevo === 'clasica') {
        estilo = nuevo; aplicarLienzo();
        try { localStorage.setItem('jarvisEsfera', nuevo); } catch (e) {}
      }
      return estilo;
    }
  };
})();
