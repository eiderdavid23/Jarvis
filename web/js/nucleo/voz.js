// Voz del navegador: escuchar (reconocimiento) y hablar (sintesis). No usa el servidor.
const Reconocedor = window.SpeechRecognition || window.webkitSpeechRecognition;

export const puedeEscuchar = !!Reconocedor;
export const puedeHablar = 'speechSynthesis' in window;

const IDIOMA = (navigator.language || '').startsWith('es') ? navigator.language : 'es-ES';
let activo = null;

export function escuchar() {
  return new Promise((resolver, rechazar) => {
    if (!Reconocedor) { rechazar(new Error('sin-reconocimiento')); return; }
    const r = new Reconocedor();
    let texto = '';
    r.lang = IDIOMA;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => { texto = e.results[0][0].transcript; };
    r.onerror = (e) => rechazar(new Error(e.error));
    r.onend = () => resolver(texto.trim());
    activo = r;
    r.start();
  });
}

export function hablar(texto) {
  return new Promise((resolver) => {
    if (!puedeHablar || !texto) { resolver(); return; }
    speechSynthesis.cancel();
    const v = new SpeechSynthesisUtterance(texto.replace(/[*_`#>]/g, ''));
    v.lang = IDIOMA;
    const voz = speechSynthesis.getVoices().find((x) => x.lang.startsWith('es'));
    if (voz) v.voice = voz;
    v.onend = resolver;
    v.onerror = resolver;
    speechSynthesis.speak(v);
  });
}

export function parar() {
  try { if (activo) activo.abort(); } catch (e) { /* ya estaba parado */ }
  if (puedeHablar) speechSynthesis.cancel();
}
