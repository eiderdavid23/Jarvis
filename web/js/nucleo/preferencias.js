// Preferencias del usuario: se guardan en el celular y se aplican al arrancar.
const CLAVE = 'jv_ajustes';

export const TEMAS = {
  Stark: [79, 216, 255],
  Mark: [255, 196, 79],
  Jade: [79, 255, 170],
  Rubi: [255, 99, 99],
};

export function leer() {
  const base = { tema: 'Stark', quieta: false };
  try { return { ...base, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') }; }
  catch (e) { return base; }
}

export function aplicar() {
  const p = leer();
  const [r, g, b] = TEMAS[p.tema] || TEMAS.Stark;
  const css = document.documentElement.style;
  css.setProperty('--cian', `rgb(${r}, ${g}, ${b})`);
  css.setProperty('--borde', `rgba(${r}, ${g}, ${b}, 0.22)`);
  css.setProperty('--cian-tenue', `rgba(${r}, ${g}, ${b}, 0.18)`);
  css.setProperty('--cian-medio', `rgba(${r}, ${g}, ${b}, 0.4)`);
  css.setProperty('--cian-brillo', `rgba(${r}, ${g}, ${b}, 0.55)`);
  document.documentElement.classList.toggle('quieta', !!p.quieta);
}

export function guardar(cambio) {
  const nuevo = { ...leer(), ...cambio };
  try { localStorage.setItem(CLAVE, JSON.stringify(nuevo)); } catch (e) { /* sin espacio */ }
  aplicar();
  return nuevo;
}

aplicar();
