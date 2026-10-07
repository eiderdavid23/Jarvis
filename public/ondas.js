/* Ondas de voz alrededor del orbe: barras circulares + anillos que se expanden.
   Se activan cuando el usuario habla (escuchando) y cuando habla Jarvis. */
var ondaNivel = 0;            // nivel suavizado (0 a 1)
var ondaPulso = 0;            // golpe de energia que decae solo (palabra nueva)
var ondaAnillos = [];         // anillos que se expanden
var ondaUltimo = 0;

function pulsoVoz(fuerza) {
  ondaPulso = Math.max(ondaPulso, fuerza || 0.8);
  var ahora = Date.now();
  if (fuerza >= 0.6 && ahora - ondaUltimo > 380 && ondaAnillos.length < 4) {
    ondaUltimo = ahora;
    ondaAnillos.push({ k: 0 });
  }
}

function dibujarOndas(ctx, w, cx, cy, color) {
  var est = (typeof estadoActual === 'string') ? estadoActual : 'reposo';
  var tm = performance.now() / 1000;
  var objetivo;
  if (est === 'hablando') {
    objetivo = 0.5 + 0.2 * Math.sin(tm * 5.1) + 0.12 * Math.sin(tm * 11.3 + 1) + ondaPulso * 0.3;
  } else if (est === 'escuchando') {
    objetivo = 0.1 + 0.05 * Math.sin(tm * 2.2) + ondaPulso * 0.85;
  } else if (est === 'pensando') {
    objetivo = 0.07;
  } else {
    objetivo = 0.03;
  }
  objetivo = Math.max(0, Math.min(1, objetivo));
  ondaNivel += (objetivo - ondaNivel) * 0.18;
  ondaPulso *= 0.93;
  if (ondaNivel < 0.025 && !ondaAnillos.length) return;

  // anillos que se expanden
  for (var j = ondaAnillos.length - 1; j >= 0; j--) {
    var a = ondaAnillos[j];
    a.k += 0.018;
    if (a.k >= 1) { ondaAnillos.splice(j, 1); continue; }
    ctx.beginPath();
    ctx.arc(cx, cy, w * (0.3 + 0.2 * a.k), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(' + color + ',' + (0.5 * (1 - a.k)).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1.5, w * 0.005);
    ctx.stroke();
  }

  // barras circulares
  var N = 72, r0 = w * 0.395, largoMax = w * 0.095;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, w * 0.0085);
  for (var i = 0; i < N; i++) {
    var ang = (i / N) * Math.PI * 2 - Math.PI / 2;
    var forma = 0.3 + 0.7 * Math.abs(Math.sin(i * 0.93 + tm * 5.5) * Math.cos(i * 0.37 - tm * 3.1));
    var v = ondaNivel * forma;
    var largo = w * 0.006 + v * largoMax;
    var c = Math.cos(ang), s = Math.sin(ang);
    ctx.strokeStyle = 'rgba(' + color + ',' + (0.3 + 0.7 * Math.min(1, v * 1.4)).toFixed(3) + ')';
    ctx.beginPath();
    ctx.moveTo(cx + c * r0, cy + s * r0);
    ctx.lineTo(cx + c * (r0 + largo), cy + s * (r0 + largo));
    ctx.stroke();
  }
}
