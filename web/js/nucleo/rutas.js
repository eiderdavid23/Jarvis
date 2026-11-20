// Navegacion entre pantallas. Cualquier modulo llama ir('nombre') y principal.js lo muestra.
export function ir(nombre) {
  window.dispatchEvent(new CustomEvent('ir', { detail: nombre }));
}
