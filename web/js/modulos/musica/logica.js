// Musica: reproductor de las canciones del celular. El estado vive fuera de iniciar()
// para que la musica siga sonando al volver al inicio. Las canciones duran mientras la app este abierta.
const audio = new Audio();
const pistas = [];
let actual = -1;
let alCambiar = () => {};

const tiempo = (s) => (isFinite(s) ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '0:00');

function poner(i) {
  actual = i;
  audio.src = pistas[i].url;
  audio.play().catch(() => {});
  alCambiar();
}

function mover(d) {
  if (pistas.length) poner((actual + d + pistas.length) % pistas.length);
}

function alternar() {
  if (actual < 0) { if (pistas.length) poner(0); return; }
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}

['play', 'pause', 'loadedmetadata', 'timeupdate'].forEach((n) => audio.addEventListener(n, () => alCambiar()));
audio.addEventListener('ended', () => mover(1));

export function iniciar(raiz) {
  const $ = (id) => raiz.querySelector('#' + id);
  const titulo = $('mus-titulo');
  const info = $('mus-info');
  const barra = $('mus-barra');
  const play = $('mus-play');
  const lista = $('mus-lista');

  function armarLista() {
    lista.replaceChildren();
    pistas.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mus__pista';
      b.textContent = p.nombre;
      b.addEventListener('click', () => poner(i));
      lista.append(b);
    });
  }

  function pintar() {
    const p = pistas[actual];
    titulo.textContent = p ? p.nombre : 'Sin canción';
    info.textContent = p
      ? tiempo(audio.currentTime) + ' / ' + tiempo(audio.duration)
      : (pistas.length ? 'Elija una canción' : 'Agregue canciones de su celular');
    barra.value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    play.textContent = audio.paused ? '▶' : '⏸';
    [...lista.children].forEach((b, i) => b.classList.toggle('activa', i === actual));
  }

  alCambiar = pintar;
  barra.addEventListener('input', () => {
    if (audio.duration) audio.currentTime = (barra.value / 100) * audio.duration;
  });
  play.addEventListener('click', alternar);
  $('mus-ant').addEventListener('click', () => mover(-1));
  $('mus-sig').addEventListener('click', () => mover(1));
  $('mus-archivos').addEventListener('change', (e) => {
    [...e.target.files].forEach((f) => pistas.push({ nombre: f.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(f) }));
    e.target.value = '';
    armarLista();
    if (actual < 0 && pistas.length) poner(0); else pintar();
  });

  armarLista();
  pintar();
}
