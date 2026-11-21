/* Esfera de Jarvis, estilo "erizo" de particulas (v1.53, solo web).
   Miles de puntos sobre una esfera que gira. En reposo respira; al escuchar
   o hablar los puntos se disparan en picos segun el nivel de la voz.
   index.html la llama desde su bucle: jarvisEsfera.dibujar(ctx, w, h, estado).
   Devuelve false si el estilo es "clasica" y entonces dibuja el de siempre.
   Cambiar de estilo: abrir la app con ?esfera=clasica o ?esfera=erizo (se guarda). */
(function () {
  'use strict';
  var N_MAX = 1500, cuenta = N_MAX;
  var px = new Float32Array(N_MAX), py = new Float32Array(N_MAX), pz = new Float32Array(N_MAX);
  var fase = new Float32Array(N_MAX), kk = new Float32Array(N_MAX);

  /* Puntos repartidos parejo sobre la esfera, en orden mezclado para poder
     quitar puntos sin dejar la esfera a medias */
  (function () {
    var oro = Math.PI * (3 - Math.sqrt(5)), ord = [], i, j, tmp;
    for (i = 0; i < N_MAX; i++) ord.push(i);
    for (i = N_MAX - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); tmp = ord[i]; ord[i] = ord[j]; ord[j] = tmp; }
    for (i = 0; i < N_MAX; i++) {
      var n = ord[i], y = 1 - (n / (N_MAX - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), th = oro * n;
      px[i] = Math.cos(th) * r; py[i] = y; pz[i] = Math.sin(th) * r;
      fase[i] = Math.random() * 6.2832; kk[i] = Math.random();
    }
  })();

  var COL = { reposo: [0, 229, 255], escuchando: [0, 255, 180], pensando: [140, 170, 255], hablando: [0, 229, 255] };
  var COL_CLARO = { reposo: [0, 140, 180], escuchando: [0, 155, 105], pensando: [85, 100, 225], hablando: [0, 140, 180] };
  var GIRO = { reposo: 0.25, escuchando: 0.55, pensando: 1.15, hablando: 0.75 };
  var col = [0, 229, 255], nivel = 0, giro = 0, vGiro = 0.25, ultimo = 0, cuadros = 0, acum = 0;
  var cubos = [], nc = [0, 0, 0, 0], i;
  for (i = 0; i < 4; i++) cubos.push(new Float32Array(N_MAX * 2));
  var lineas = new Float32Array(N_MAX * 4), nl = 0;

  var estilo = 'erizo';
  try {
    var q = new URLSearchParams(location.search).get('esfera');
    if (q === 'clasica' || q === 'erizo') localStorage.setItem('jarvisEsfera', q);
    var s = localStorage.getItem('jarvisEsfera');
    if (s === 'clasica' || s === 'erizo') estilo = s;
  } catch (e) {}

  function rgb(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; }

  function dibujar(ctx, w, h, estado) {
    if (estilo !== 'erizo') return false;
    var ahora = performance.now(), dt = ahora - ultimo;
    ultimo = ahora;
    if (dt > 100 || dt <= 0) dt = 16.7;

    /* Si el celular va lento, usa menos puntos; si sobra, vuelve a subir */
    cuadros++; acum += dt;
    if (cuadros === 60) {
      var prom = acum / 60;
      if (prom > 26 && cuenta > 600) cuenta = Math.max(600, cuenta - 300);
      else if (prom < 17.5 && cuenta < N_MAX) cuenta = Math.min(N_MAX, cuenta + 100);
      cuadros = 0; acum = 0;
    }

    var tm = ahora / 1000;
    var pulso = (typeof ondaPulso === 'number') ? ondaPulso : 0;
    var obj;
    if (estado === 'hablando') obj = 0.5 + 0.2 * Math.sin(tm * 5.1) + 0.12 * Math.sin(tm * 11.3 + 1) + pulso * 0.3;
    else if (estado === 'escuchando') obj = 0.12 + 0.05 * Math.sin(tm * 2.2) + pulso * 0.85;
    else if (estado === 'pensando') obj = 0.1 + 0.05 * Math.sin(tm * 3);
    else obj = 0.03 + 0.015 * Math.sin(tm * 1.3);
    obj = Math.max(0, Math.min(1, obj));
    nivel += (obj - nivel) * Math.min(1, dt * 0.011);
    if (typeof ondaPulso === 'number') ondaPulso *= 0.93;
    if (typeof ondaNivel === 'number') ondaNivel = nivel;

    /* Color y giro cambian con suavidad entre estados */
    var claro = document.documentElement.getAttribute('data-tema') === 'claro';
    var meta = (claro ? COL_CLARO : COL)[estado] || (claro ? COL_CLARO : COL).reposo;
    var kc = Math.min(1, dt * 0.005);
    col[0] += (meta[0] - col[0]) * kc; col[1] += (meta[1] - col[1]) * kc; col[2] += (meta[2] - col[2]) * kc;
    vGiro += ((GIRO[estado] || 0.25) - vGiro) * Math.min(1, dt * 0.003);
    giro += vGiro * dt / 1000;

    var cx = w / 2, cy = h / 2;
    var R = Math.min(w, h) * 0.22 * (1 + 0.03 * Math.sin(tm * 1.6) + nivel * 0.08);
    var cg = Math.cos(giro), sg = Math.sin(giro), ct = 0.94, st = 0.34;
    var pensando = estado === 'pensando';
    nc[0] = nc[1] = nc[2] = nc[3] = 0; nl = 0;

    for (var n = 0; n < cuenta; n++) {
      var x = px[n], y = py[n], z = pz[n];
      var x1 = x * cg + z * sg, z1 = -x * sg + z * cg;
      var y2 = y * ct - z1 * st, z2 = y * st + z1 * ct;
      var k = kk[n];
      var onda = 0.5 + 0.5 * Math.sin(tm * (2.5 + k * 3) + fase[n]);
      var pico = nivel * k * k * k * (0.35 + 0.65 * onda) * 1.1;
      if (pensando) pico += 0.16 * Math.max(0, Math.sin(y * 5 - tm * 4));
      if (pico > 0.5) pico = 0.5;
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
    /* Nucleo brillante */
    var rc = R * 0.82 * (1 + nivel * 0.15);
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rc);
    g.addColorStop(0, claro ? rgb(col, 0.95) : 'rgba(235,255,255,0.92)');
    g.addColorStop(0.28, rgb(col, 0.85));
    g.addColorStop(1, rgb(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, rc, 0, 6.2832); ctx.fill();
    var g2 = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.6);
    g2.addColorStop(0, rgb(col, 0.16)); g2.addColorStop(1, rgb(col, 0));
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.6, 0, 6.2832); ctx.fill();

    if (!claro) ctx.globalCompositeOperation = 'lighter';
    /* Picos */
    if (nl) {
      ctx.strokeStyle = rgb(col, 0.55); ctx.lineWidth = Math.max(1, w * 0.0026); ctx.lineCap = 'round';
      ctx.beginPath();
      for (var l = 0; l < nl; l += 4) { ctx.moveTo(lineas[l], lineas[l + 1]); ctx.lineTo(lineas[l + 2], lineas[l + 3]); }
      ctx.stroke();
    }
    /* Puntos: del fondo al frente, mas claros y grandes los de adelante */
    var sz0 = Math.max(1.4, w * 0.0042);
    ctx.fillStyle = rgb(col, 1);
    for (var c = 0; c < 4; c++) {
      ctx.globalAlpha = 0.25 + 0.25 * c;
      var sz = sz0 * (0.8 + 0.17 * c), arr = cubos[c], m = nc[c] * 2;
      for (var p = 0; p < m; p += 2) ctx.fillRect(arr[p] - sz / 2, arr[p + 1] - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = antes || 'source-over';
    return true;
  }

  window.jarvisEsfera = {
    dibujar: dibujar,
    estilo: function (nuevo) {
      if (nuevo === 'erizo' || nuevo === 'clasica') {
        estilo = nuevo;
        try { localStorage.setItem('jarvisEsfera', nuevo); } catch (e) {}
      }
      return estilo;
    }
  };
})();
