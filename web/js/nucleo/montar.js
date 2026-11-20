// Monta un modulo: carga su estilo.css, su vista.html y arranca su logica.js.
// Cada modulo vive en js/modulos/<nombre>/ y tiene esas tres piezas.
// Todo elemento con data-ir="otro_modulo" navega a ese modulo al tocarlo.
import { ir } from './rutas.js';

export async function montar(nombre, contenedor) {
  const base = `/js/modulos/${nombre}/`;

  if (!document.querySelector(`link[data-modulo="${nombre}"]`)) {
    const hoja = document.createElement('link');
    hoja.rel = 'stylesheet';
    hoja.href = base + 'estilo.css';
    hoja.dataset.modulo = nombre;
    document.head.appendChild(hoja);
  }

  const vista = await fetch(base + 'vista.html');
  contenedor.innerHTML = await vista.text();

  contenedor.querySelectorAll('[data-ir]').forEach((el) => {
    el.addEventListener('click', () => ir(el.dataset.ir));
  });

  const logica = await import(base + 'logica.js');
  logica.iniciar(contenedor);
}
