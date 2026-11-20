// Pantalla de inicio: la orbita de Jarvis. Los satelites con data-ir abren su modulo;
// los que tienen data-pronto avisan que esa funcion aun no esta construida.
export function iniciar(raiz) {
  const sub = raiz.querySelector('#inicio-sub');
  const TEXTO_BASE = 'Toca el núcleo para activar';
  let espera = 0;

  function aviso(texto) {
    sub.textContent = texto;
    clearTimeout(espera);
    espera = setTimeout(() => { sub.textContent = TEXTO_BASE; }, 2800);
  }

  raiz.querySelector('#inicio-nucleo').addEventListener('click', () => {
    aviso('La voz llega en una próxima parte');
  });

  raiz.querySelectorAll('[data-pronto]').forEach((boton) => {
    boton.addEventListener('click', () => aviso(boton.dataset.pronto + ' llega en una próxima parte'));
  });
}
