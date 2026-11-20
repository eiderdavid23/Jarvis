# CONTEXTO JARVIS — léelo completo antes de responder

> Para la IA que reciba este archivo: este es el contexto del proyecto y las reglas de trabajo de David. Síguelas al pie de la letra. Si algo no está aquí, pregunta; no lo inventes.

Última actualización: 20 nov 2026
Versión actual: 0.1 (proyecto reiniciado desde cero)
Ubicación: este archivo vive en la raíz del repo (`~/jarvis/CONTEXTO_JARVIS.md`). No poner llaves ni contraseñas aquí: el repo es público.

---

## 1. Qué se va a hacer

Un **asistente de voz para Android** (referencia: https://villacisjushep02-ship-it.github.io/yarvex-web/), que hable con David, entienda lo que dice y haga cosas en el celular por él.

**Decisión clave:** la inteligencia viene de la **API de Gemini (Google) con una llave de API**. **No hay modelo local por ahora.** La idea del «cerebro local sin internet» que tiene la página de referencia queda fuera de esta etapa; si se quiere después, se agrega como una etapa aparte.

### Qué toma del proyecto de referencia (la página)
- Mandar mensajes por voz (dictar y enviar por WhatsApp).
- Leer notificaciones, priorizando mensajes, y ofrecer leerlas en voz alta y responder.
- Ver la pantalla para ubicar botones y contactos cuando una orden simple no alcanza.
- Sugerir rutinas según hábitos, no solo esperar órdenes.
- Privacidad: las conversaciones se quedan en el teléfono; la cuenta guarda solo ajustes y apodos de contactos.

### Qué NO entra por ahora
- Modelo local / modo sin internet.
- Planes, pagos, prueba gratis, página de descarga.
- Todo lo del Jarvis anterior (módulos, TV, PC, Minecraft, gastos, tareas automáticas, PDF, etc.). Si algo se necesita, se vuelve a agregar de a una pieza.

### Estado
- [ ] Proyecto limpio: dejar en el repo solo lo necesario para la nueva versión.
- [x] Definir la primera etapa (ver decisiones tomadas).
- [ ] Conectar Gemini con la llave en `.env`.
- [ ] Primera respuesta de la IA funcionando.

### Decisiones tomadas (20 nov 2026)
1. Primera etapa: chat y acciones en el celular, todo junto.
2. El servidor va en Vercel.
3. El nombre es Jarvis.
4. Modelo: el gratis que sirva para todo, `gemini-3.8-flash` (nivel gratuito). Va en `.env` como `GEMINI_MODEL` para cambiarlo sin tocar código.

### Limitaciones reales (no olvidar)
- Vercel no guarda archivos ni corre procesos largos: el servidor solo atiende peticiones. Lo que deba guardarse va en una base de datos aparte.
- Las acciones en el celular (WhatsApp, notificaciones, ver pantalla) no se pueden hacer desde la web ni desde Termux: hace falta una APK con permisos de accesibilidad. Se construye por etapas.
- El nivel gratuito de Gemini tiene límite de peticiones por minuto y por día, y Google puede usar lo que se le envía para mejorar sus productos. Eso choca con la promesa de privacidad: decidir más adelante si se avisa al usuario o se pasa a pago.

---

## 2. Reglas estrictas de trabajo

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
11. **Llaves y secretos**: nunca se piden ni se aceptan en el chat. La llave de Gemini se crea en Google AI Studio y va solo en `.env` (`GEMINI_API_KEY`) y en Vercel si se despliega ahí. Si David pega una por error, se le pide rotarla de inmediato.
