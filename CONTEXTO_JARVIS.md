# CONTEXTO JARVIS — léelo completo antes de responder

> Para la IA que reciba este archivo: este es el contexto del proyecto y las reglas de trabajo de David. Síguelas al pie de la letra. Si algo no está aquí, pregunta; no lo inventes.

Última actualización: 2 oct 2026
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

---

## 2. Qué es Jarvis

Asistente personal de IA de David, con personalidad de mayordomo estilo Iron Man: dice "señor", es conciso salvo que se pida detalle y nunca dice que es un modelo de lenguaje.

- **Backend**: Python + Flask, `server.py` (~337 líneas), un solo usuario, sin login.
- **Frontend**: `public/index.html` (~576 líneas), con orbe animado en canvas, estados (reposo / escuchando / hablando) y panel de Ajustes (llaves, proveedor activo, contador de uso, acerca de).
- **PWA**: `public/manifest.json`, `public/sw.js`, `public/icon.svg`.
- **IA**: Gemini por defecto (`GEMINI_MODEL`, hoy `gemini-3.5-flash-lite`) y Groq como alternativa (`openai/gpt-oss-120b`). Las llaves pueden venir del navegador (headers `X-Gemini-Key`, `X-Groq-Key`, `X-Proveedor`) o del `.env`.
- **Memoria actual**: historial en `memoria_local.json` (se mandan los últimos 20 turnos) y datos permanentes en `memoria_persistente.json` (el modelo los emite con `[RECORDAR: dato]`).
- **Acciones por etiquetas** que el backend ejecuta y limpia del texto: `[ACCION:abrir:URL]`, `[ACCION:linterna:on/off]`, `[ACCION:vibrar]`, `[CONSULTAR_BATERIA]` (las de hardware usan Termux:API, `comandos_dispositivo.py`).
- **Voz**: Piper TTS local (`/voz`).
- **requirements.txt**: flask, flask-cors, python-dotenv, requests, pypdf, beautifulsoup4, fpdf2, gunicorn, cryptography (`piper-tts` se quita para Vercel).

**Repo**: https://github.com/eiderdavidgarcia23/Jarvis
**Vercel**: (anotar aquí la URL)
**Local**: `~/jarvis` en Termux, con `python server.py` (puerto 3000 o `PORT`).

**Deploy (solo Vercel)**: `git add -A && git commit -m "mensaje" && git push`; Vercel redespliega solo. Variables (`GEMINI_API_KEY`, `GROQ_API_KEY`) en el panel de Vercel. Render ya no se usa.

---

## 3. Historial de lo hecho

- **29 ago 2026**: retomado el proyecto desde el zip `Jarvis-main` (versión anterior a Firebase/login). Limpieza del repo: borrados `_archivado/`, `__pycache__/`, `package.json`, `package-lock.json`, backup viejo del index y logs; sacados del tracking `memoria_local.json`, `recordatorios.json` y `preferencias/`; `.gitignore` actualizado. No se reescribió el historial viejo de git.
- **30 ago 2026**: arreglada la voz (Piper daba timeout). La causa era que el servidor no se había reiniciado tras corregir el `.env`.
- **2 oct 2026**: Jarvis desplegado en Vercel e instalado como app en el celular. Se entregó `parche_vercel.py` (memoria en `/tmp` cuando corre en Vercel, voz del navegador si `/voz` falla, quitar `piper-tts` de `requirements.txt`).

---

## 4. Limitaciones conocidas en Vercel

- Piper no corre (la voz es la del navegador, más robótica; Piper sigue funcionando solo corriendo local en Termux).
- Linterna, vibrar y batería dependen de Termux: solo funcionan corriendo local.
- El disco es temporal: sin base de datos, la memoria se borra.

---

## 5. Pendientes (se van quitando al completarlos)

1. Confirmar que el parche de Vercel quedó aplicado, que las variables de entorno están puestas y anotar la URL de Vercel arriba.
2. **Memoria permanente** en Upstash Redis, para que sobreviva en Vercel.
3. Datos guardados **con tema** (ej. `nombre: David`) que se actualicen en vez de duplicarse, más una orden para olvidar algo.
4. **Resumen automático** de la charla vieja, siempre presente en el contexto (hoy solo se recuerdan 20 turnos).
5. Modelo por defecto más grande (Gemini Flash normal en vez de flash-lite).
6. Reponer las funciones quitadas en Vercel (voz de mejor calidad; acciones de dispositivo si hay forma).

**Meta principal**: que Jarvis tenga buena memoria, entienda de qué se habla y no lo confunda con otra cosa cuando David cambia una palabra.

---

## 6. Cómo mantener este archivo

Al terminar **cada** actualización:
1. Pasar el pendiente completado a la sección 3 con su fecha.
2. Borrarlo de la sección 5.
3. Corregir la sección 2 si cambió el stack, y la 4 si cambió alguna limitación.
4. Cambiar la fecha de "Última actualización".
5. Entregar el archivo completo actualizado (con `cat > CONTEXTO_JARVIS.md << 'EOF'`), no solo los cambios.
6. Subirlo al repo: `git add CONTEXTO_JARVIS.md && git commit -m "Actualizar contexto" && git push`.

David comparte este archivo al abrir un chat nuevo, para que la IA tenga todo el contexto.
