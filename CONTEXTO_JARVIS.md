# CONTEXTO JARVIS — léelo completo antes de responder

> Para la IA que reciba este archivo: este es el contexto del proyecto y las reglas de trabajo de David. Síguelas al pie de la letra. Si algo no está aquí, pregunta; no lo inventes.

Última actualización: 1 nov 2026
Versión actual: 1.24 (ver CAMBIOS.md)
Ubicación: este archivo vive en la raíz del repo (`~/jarvis/CONTEXTO_JARVIS.md`). No poner llaves ni contraseñas aquí: el repo es público.

---

## 1. Reglas estrictas de trabajo

David trabaja **desde un celular Android con Termux** (bash, Python, Node.js) y usa GitHub. Todo debe servirle así.

1. **Código siempre completo y listo para pegar**, en bloques con `cat > archivo << 'EOF' ... EOF` (con `'EOF'` entre comillas). Nunca "edita esta línea a mano" ni "agrega esto en tal parte".
2. **Archivo largo = por partes**: se divide y, entre cada parte, David verifica con `wc -l archivo`. Se continúa solo cuando coincide.
3. **Si algo se rompe por un pegado cortado**: se reescribe el archivo completo. No se sigue parchando.
4. **Parches con script**: si hay que cambiar un archivo existente, se entrega un script Python que lo modifica (con `assert` para detectar si no encontró el texto) y se borra al terminar.
5. **Antes de un cambio grande**, explicar qué se va a hacer y esperar el visto bueno.
6. **Avisar de limitaciones técnicas reales** (qué no funciona en Vercel, en Termux, etc.). No prometer de más.
7. **Respuestas cortas**: se lee en pantalla de celular.
8. **Antes de cada deploy**: `git status` para confirmar que todo está subido (ya falló una vez porque `requirements.txt` no se había subido).
9. **Si algo se corrigió en `.env` y sigue fallando igual**: sospechar primero que el servidor no se reinició (Flask lee el `.env` solo al arrancar).
10. **Cambios grandes en un archivo**: se escribe como archivo nuevo (ej. `public/nuevo.html`) por partes con `cat >>`, con el conteo acumulado de `wc -l` en cada parte. Solo cuando coincide se reemplaza el original, guardando antes una copia fuera del repo (`cp public/index.html ~/index_anterior.html`).
11. **Llaves y secretos**: nunca se piden ni se aceptan en el chat. Si hace falta una llave nueva, se indica dónde crearla y que va solo en `.env` y en Vercel. Si David pega una por error, se le pide rotarla de inmediato.

---


## 2. Registro de tareas (marcar cada una al terminarla)

Pedido de David sobre la burbuja y las funciones:

- [x] La burbuja también habla: lee la respuesta en voz alta (v1.15).
- [x] Activar/desactivar funciones con la voz o el chat («Jarvis, desactiva el modo escucha»):
  - [x] Parte 1: el servidor entiende la orden (`funciones_voz.py`).
  - [x] Parte 2: la burbuja la aplica y confirma con voz.
  - [x] Parte 3: el chat de la app la aplica (`public/ordenes_voz.js`) y los interruptores de Herramientas se sincronizan con la burbuja.
- [x] Poder abrir la burbuja mientras trabaja y botón Detener dentro de la burbuja (v1.17). Requiere APK nueva.
- [x] Pantalla de inicio con saludos variados según la hora, el día, la fecha y los recordatorios de hoy, y sugerencias que cambian (v1.18, `public/saludos.js`). Solo web.
- [x] La burbuja se cierra sola al terminar de hablar (v1.19, `BurbujaManos.java`). Requiere APK nueva.
- [x] Varios celulares con la misma cuenta (v1.20): nombre propio al vincular y campo `dispositivo` en ver_pantalla y controlar_pantalla.
- [ ] Pantalla apagada en celulares y PC (v1.22 servidor y web, v1.23 APK):
  - [x] Parte 1: ordenes `encender_pantalla` y `apagar_pantalla` en el servidor y boton de bateria en la web (v1.22).
  - [x] Parte 2: la APK mantiene la CPU despierta, enciende y apaga la pantalla (v1.23). Requiere APK nueva.
  - [x] Parte 3: la palabra «Jarvis» con pantalla apagada.
  - [ ] Parte 4 (PAUSADA, David la dejo para despues): `agente_pc.py` (encender el monitor y evitar la suspension). No retomarla hasta que David lo pida.
- [ ] Controlar la TV desde Jarvis (pedido el 1 nov 2026). Falta saber marca, modelo y si esta en la misma wifi que el celular. El servidor esta en la nube y no ve la red de la casa: la orden debe salir de un dispositivo dentro de esa red (celular con la APK o PC).
- [ ] Probar `agente_pc.py` en un PC real (hecho sin poder probarlo): vincular, abrir programa, capturar, volumen, mover archivo. Herramienta `controlar_pc` en server.py; ordenes `pc_*` en la cola de Manos; el PC se vincula con plataforma 'pc'. El agente pide permiso en pantalla salvo con --control; apagar, reiniciar y mover archivos siempre piden permiso.
