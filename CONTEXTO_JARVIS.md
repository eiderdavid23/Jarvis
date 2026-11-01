# CONTEXTO JARVIS — léelo completo antes de responder

> Para la IA que reciba este archivo: este es el contexto del proyecto y las reglas de trabajo de David. Síguelas al pie de la letra. Si algo no está aquí, pregunta; no lo inventes.

Última actualización: 31 oct 2026
Versión actual: 1.16 (ver CAMBIOS.md)
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

