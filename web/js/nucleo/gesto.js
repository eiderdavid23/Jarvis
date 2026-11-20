// Reconoce el gesto de UNA mano a partir de los 21 puntos de MediaPipe (x, y entre 0 y 1).
// Funcion pura: no toca la camara ni la pantalla. Devuelve:
//   'palma' | 'uno' | 'dos' | 'pellizco' | 'puno' | 'otro'
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// [punta, articulacion media] de indice, medio, anular y menique
const DEDOS = [[8, 6], [12, 10], [16, 14], [20, 18]];

export function dedosExtendidos(p) {
  return DEDOS.map(([punta, medio]) => d(p[punta], p[0]) > d(p[medio], p[0]) * 1.05);
}

export function tamanoPalma(p) {
  return d(p[0], p[9]) || 0.0001;
}

export function distanciaPellizco(p) {
  return d(p[4], p[8]) / tamanoPalma(p);
}

export function clasificar(p) {
  if (!p || p.length < 21) return 'otro';
  const [indice, medio, anular, menique] = dedosExtendidos(p);

  // Pellizco tipo «OK»: pulgar e indice juntos y al menos dos de los otros tres dedos abiertos.
  const otros = [medio, anular, menique].filter(Boolean).length;
  if (distanciaPellizco(p) < 0.35 && otros >= 2) return 'pellizco';

  const n = [indice, medio, anular, menique].filter(Boolean).length;
  if (n === 4) return 'palma';
  if (n === 0) return 'puno';
  if (n === 1 && indice) return 'uno';
  if (n === 2 && indice && medio) return 'dos';
  return 'otro';
}
