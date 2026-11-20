// Ajustes: secciones desplegables. Cada seccion es un objeto de la lista SECCIONES.
import { sesion } from '../../nucleo/sesion.js';
import { TEMAS, leer, guardar } from '../../nucleo/preferencias.js';
import { guardarCancion, leerCancion, quitarCancion, reproducir, parar, SALUDO_BASE } from '../../nucleo/bienvenida.js';
import { configurar } from '../../nucleo/encendido.js';

const LLAVES = [['Gemini', 'jv_llave_gemini'], ['Groq', 'jv_llave_groq']];

function el(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function armarCuenta(cuerpo) {
  cuerpo.append(el('p', 'aj-dato', sesion.correo() || 'Sin correo guardado'));
  const salir = el('button', 'boton aj-boton', 'Cerrar sesión');
  salir.type = 'button';
  salir.addEventListener('click', () => {
    sesion.borrar();
    window.dispatchEvent(new Event('sesion-cambio'));
  });
  cuerpo.append(salir);
}

function armarApariencia(cuerpo, refrescar) {
  const fila = el('div', 'aj-temas');
  Object.entries(TEMAS).forEach(([nombre, [r, g, b]]) => {
    const boton = el('button', 'aj-tema', nombre);
    boton.type = 'button';
    boton.style.setProperty('--tc', `rgb(${r}, ${g}, ${b})`);
    boton.classList.toggle('activo', leer().tema === nombre);
    boton.addEventListener('click', () => {
      guardar({ tema: nombre });
      fila.querySelectorAll('.aj-tema').forEach((x) => x.classList.toggle('activo', x === boton));
      refrescar();
    });
    fila.append(boton);
  });
  cuerpo.append(fila);
}

function armarPreferencias(cuerpo, refrescar) {
  const quieta = el('label', 'aj-fila');
  const cajaQuieta = el('input');
  cajaQuieta.type = 'checkbox';
  cajaQuieta.checked = leer().quieta;
  cajaQuieta.addEventListener('change', () => { guardar({ quieta: cajaQuieta.checked }); refrescar(); });
  quieta.append(el('span', '', 'Reducir animaciones'), cajaQuieta);

  const aplauso = el('label', 'aj-fila');
  const cajaAplauso = el('input');
  cajaAplauso.type = 'checkbox';
  cajaAplauso.checked = !!leer().aplauso;
  const nota = el('p', 'aj-nota', 'Con la app abierta, dos palmadas hacen sonar la música de bienvenida. Usa el micrófono; el audio no se graba ni se envía.');
  cajaAplauso.addEventListener('change', async () => {
    guardar({ aplauso: cajaAplauso.checked });
    const r = await configurar();
    if (!r.ok) {
      guardar({ aplauso: false });
      cajaAplauso.checked = false;
      nota.textContent = /NotAllowed|Permission/i.test(r.motivo)
        ? 'Permita el micrófono en el navegador o en la app para usar el aplauso.'
        : 'No pude abrir el micrófono en este dispositivo.';
    } else {
      nota.textContent = 'Con la app abierta, dos palmadas hacen sonar la música de bienvenida. Usa el micrófono; el audio no se graba ni se envía.';
    }
    refrescar();
  });
  aplauso.append(el('span', '', 'Encender con doble aplauso'), cajaAplauso);

  cuerpo.append(quieta, aplauso, nota);
}

let cancionGuardada = '';

function armarBienvenida(cuerpo, refrescar) {
  const nombre = el('p', 'aj-dato', 'Sin canción');
  const nota = el('p', 'aj-nota', 'La canción se guarda solo en este celular.');

  const mostrar = (c) => {
    cancionGuardada = c ? c.nombre : '';
    nombre.textContent = c ? '🎵 ' + c.nombre : 'Sin canción';
    refrescar();
  };
  leerCancion().then(mostrar).catch(() => { nota.textContent = 'Este navegador no permite guardar la canción.'; });

  const elegir = el('label', 'boton aj-boton', 'Elegir canción');
  const archivo = el('input');
  archivo.type = 'file';
  archivo.accept = 'audio/*';
  archivo.hidden = true;
  archivo.addEventListener('change', async () => {
    const f = archivo.files[0];
    archivo.value = '';
    if (!f) return;
    try {
      await guardarCancion(f);
      mostrar({ nombre: f.name.replace(/\.[^.]+$/, '') });
    } catch (e) {
      nota.textContent = 'No pude guardar la canción.';
    }
  });
  elegir.append(archivo);

  const saludo = el('input', 'campo');
  saludo.type = 'text';
  saludo.maxLength = 80;
  saludo.placeholder = 'Saludo (vacío = sin saludo)';
  saludo.value = leer().saludo ?? SALUDO_BASE;
  saludo.addEventListener('change', () => guardar({ saludo: saludo.value.trim() }));

  const probar = el('button', 'boton aj-boton', 'Probar ahora');
  probar.type = 'button';
  probar.addEventListener('click', () => reproducir());

  const detener = el('button', 'boton aj-boton', 'Detener');
  detener.type = 'button';
  detener.addEventListener('click', () => parar());

  const quitar = el('button', 'boton aj-boton', 'Quitar canción');
  quitar.type = 'button';
  quitar.addEventListener('click', async () => {
    try { await quitarCancion(); } catch (e) { /* nada que quitar */ }
    parar();
    mostrar(null);
  });

  cuerpo.append(nombre, elegir, saludo, probar, detener, quitar, nota);
}

function textoLlave(nombre, clave) {
  return localStorage.getItem(clave) ? nombre + ': guardada (escriba para cambiarla)' : 'Llave de ' + nombre;
}

function armarCerebro(cuerpo, refrescar) {
  cuerpo.append(el('p', 'aj-nota', 'Sus llaves se guardan solo en este celular.'));
  LLAVES.forEach(([nombre, clave]) => {
    const campo = el('input', 'campo');
    campo.type = 'password';
    campo.autocomplete = 'off';
    campo.placeholder = textoLlave(nombre, clave);
    campo.addEventListener('change', () => {
      const v = campo.value.trim();
      if (v) localStorage.setItem(clave, v);
      campo.value = '';
      campo.placeholder = textoLlave(nombre, clave);
      refrescar();
    });
    cuerpo.append(campo);
  });
}

const llavesPropias = () => LLAVES.filter(([, k]) => localStorage.getItem(k)).length;

const SECCIONES = [
  { titulo: 'Cuenta', icono: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', sub: () => sesion.correo() || 'Sin correo', armar: armarCuenta },
  { titulo: 'Apariencia', icono: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', sub: () => leer().tema, armar: armarApariencia },
  { titulo: 'Preferencias', icono: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>', sub: () => (leer().quieta ? 'Animaciones reducidas' : 'Animaciones normales') + (leer().aplauso ? ' · Aplauso' : ''), armar: armarPreferencias },
  { titulo: 'Cerebro', icono: '<path d="M12 3l2.2 6.3L21 12l-6.8 2.7L12 21l-2.2-6.3L3 12l6.8-2.7z"/>', sub: () => (llavesPropias() ? llavesPropias() + ' llave(s) propia(s)' : 'Automático'), armar: armarCerebro },
  { titulo: 'Música de bienvenida', icono: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>', sub: () => cancionGuardada || 'Sin canción', armar: armarBienvenida },
  { titulo: 'Rendimiento', icono: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>' },
  { titulo: 'Permisos', icono: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>' },
  { titulo: 'Memoria', icono: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/>' },
];

export function iniciar(raiz) {
  const lista = raiz.querySelector('#ajustes-lista');

  SECCIONES.forEach((s) => {
    const caja = el('div', 'aj-seccion');
    const cab = el('button', 'aj-cab');
    cab.type = 'button';
    const icono = el('span', 'aj-icono');
    icono.innerHTML = `<svg viewBox="0 0 24 24">${s.icono}</svg>`;
    const sub = el('small');
    const textos = el('span', 'aj-textos');
    textos.append(el('b', '', s.titulo), sub);
    cab.append(icono, textos, el('span', 'aj-flecha', '›'));

    const cuerpo = el('div', 'aj-cuerpo');
    cuerpo.hidden = true;
    const refrescar = () => { sub.textContent = s.sub(); };

    if (s.armar) {
      refrescar();
      s.armar(cuerpo, refrescar);
    } else {
      sub.textContent = 'Próximamente';
      cab.disabled = true;
    }

    cab.addEventListener('click', () => {
      const abrir = cuerpo.hidden;
      lista.querySelectorAll('.aj-seccion').forEach((x) => {
        x.classList.remove('abierta');
        x.querySelector('.aj-cuerpo').hidden = true;
      });
      caja.classList.toggle('abierta', abrir);
      cuerpo.hidden = !abrir;
    });

    caja.append(cab, cuerpo);
    lista.append(caja);
  });
}
