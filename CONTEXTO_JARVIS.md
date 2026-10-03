# CONTEXTO JARVIS — léelo completo antes de responder

> Para la IA que reciba este archivo: este es el contexto del proyecto y las reglas de trabajo de David. Síguelas al pie de la letra. Si algo no está aquí, pregunta; no lo inventes.

Última actualización: 3 oct 2026
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

---

## 2. Qué es Jarvis

Asistente personal de IA de David, con personalidad de mayordomo estilo Iron Man: dice "señor", es conciso salvo que se pida detalle y nunca dice que es un modelo de lenguaje. Ahora es multiusuario: cada persona tiene su cuenta, sus chats y su memoria.

- **Backend**: Python + Flask. `server.py` (~472 líneas) y `supa.py` (~234 líneas: login, chats y memoria en Supabase por REST con el token del usuario; no usa supabase-py). `/chat` exige sesión (decorador `requiere_login`, header `Authorization: Bearer`).
- **Frontend**: `public/index.html` (~1015 líneas, estilo Claude) y `public/auth.js` (~305 líneas): pantalla de login, lista de chats en el sidebar (sustituyó a "Historial de chats"), "Cerrar sesión" y saludo con el nombre del usuario. En "Próximamente" quedan Buscar y Recordatorios.
- **Login (Supabase Auth)**: "Continuar con Google" y correo + contraseña (con campo Nombre al crear cuenta). Rutas: `/auth/registro`, `/auth/login`, `/auth/refresh`, `/auth/google`, `/auth/yo`. Google devuelve la sesión en el `#` de la URL y `auth.js` la lee. Los tokens van en el `localStorage` del navegador y se renuevan solos.
- **Memoria (Supabase, con RLS por usuario)**: tablas `chats`, `mensajes` y `memorias` (clave/valor). Se mandan al modelo los últimos 20 mensajes del chat actual. Los datos permanentes se guardan **por tema** (se actualizan, no se duplican). Ya no se usan `memoria_local.json` ni `memoria_persistente.json`.
- **Herramientas** (function calling, definidas en `server.py`): `abrir_url`, `encender_linterna`, `apagar_linterna`, `vibrar`, `consultar_bateria`, `guardar_recuerdo` (tema + dato) y `olvidar_recuerdo`. Las de hardware usan Termux:API (`comandos_dispositivo.py`).
- **Orbe animado** (canvas) con 3 modos: grande al centro en el inicio y en el modo voz (llamada con escucha continua), y pequeño arriba cuando hay chat. Estados: reposo / escuchando / pensando / hablando. Tocar el orbe interrumpe a Jarvis.
- **PWA**: `public/manifest.json`, `public/sw.js`, `public/icon.svg`.
- **IA**: Gemini por defecto (`GEMINI_MODEL`, hoy `gemini-3.5-flash-lite`) y Groq como alternativa (`openai/gpt-oss-120b`). Las llaves pueden venir del navegador (headers `X-Gemini-Key`, `X-Groq-Key`, `X-Proveedor`) o del `.env`.
- **Voz**: Piper TTS local (`/voz`). Si falla, el frontend usa la voz del navegador y no vuelve a intentar Piper en esa sesión.
- **requirements.txt**: flask, flask-cors, python-dotenv, requests, pypdf, beautifulsoup4, fpdf2, gunicorn, cryptography (`piper-tts` se quita para Vercel).

**Repo**: https://github.com/eiderdavidgarcia23/Jarvis
**Vercel**: https://jarvis-mu-ebon-12.vercel.app
**Local**: `~/jarvis` en Termux, con `python server.py` (puerto 3000 o `PORT`).

**Variables de entorno** (en `.env` local y en Vercel → Settings → Environment Variables; Flask solo lee el `.env` al arrancar, y en Vercel hay que hacer Redeploy tras cambiarlas): `GEMINI_API_KEY`, `GROQ_API_KEY`, `SUPABASE_URL` y `SUPABASE_KEY` (la llave **publishable**; nunca la `secret` ni el Client Secret de Google).

**Configuración externa** (no está en el repo):
- Supabase → Authentication → Sign In / Providers: Google activado y "Confirm email" desactivado (para pruebas). URL Configuration: Site URL y Redirect URLs con la dirección de Vercel y `http://localhost:3000`.
- Google Cloud: proyecto "Jarvis", cliente OAuth tipo Aplicación web, con la callback de Supabase como URI de redirección.
- Las tablas y políticas RLS se crearon con un SQL ejecutado a mano en Supabase.

**Deploy (solo Vercel)**: `git add -A && git commit -m "mensaje" && git push`; Vercel redespliega solo. Render ya no se usa.

---

## 3. Historial de lo hecho

- **29 ago 2026**: retomado el proyecto desde el zip `Jarvis-main` (versión anterior a Firebase/login). Limpieza del repo: borrados `_archivado/`, `__pycache__/`, `package.json`, `package-lock.json`, backup viejo del index y logs; sacados del tracking `memoria_local.json`, `recordatorios.json` y `preferencias/`; `.gitignore` actualizado. No se reescribió el historial viejo de git.
- **30 ago 2026**: arreglada la voz (Piper daba timeout). La causa era que el servidor no se había reiniciado tras corregir el `.env`.
- **2 oct 2026**: Jarvis desplegado en Vercel e instalado como app en el celular. Se entregó `parche_vercel.py` (voz del navegador si `/voz` falla, quitar `piper-tts` de `requirements.txt`).
- **2 oct 2026**: nuevo frontend estilo Claude (`public/index.html` reemplazado; la copia anterior quedó fuera del repo): sidebar, burbujas, animaciones, orbe con 3 modos y modo voz continuo. Se entregó en 6 partes (1014 líneas) y se desplegó en Vercel.
- **3 oct 2026**: cuentas por usuario con Supabase. Se creó `supa.py` y `public/auth.js`, y se parchó `server.py` e `index.html` (el primer parche falló porque asumía otra versión de `server.py`; se rehízo contra el real). Quedó hecho: login con correo y con Google, nombre del usuario en el saludo y en el prompt, historial de chats por usuario en el sidebar (crear, abrir, borrar), memoria permanente por tema con `guardar_recuerdo` y `olvidar_recuerdo`, y se quitó el autocompletado de contraseñas de Chrome en el login. Probado en local y en Vercel.

---

## 4. Limitaciones conocidas

- En Vercel, Piper no corre (la voz es la del navegador, más robótica; Piper solo funciona corriendo local en Termux).
- Linterna, vibrar y batería dependen de Termux: solo funcionan corriendo local.
- Cada mensaje hace varias llamadas a Supabase (validar sesión, leer historial y recuerdos, guardar), así que hay algo más de latencia que antes.
- El chat de un usuario se crea al enviar su primer mensaje; "Nuevo chat" solo prepara la pantalla.
- Los chats viejos que estaban en archivos no se migraron: cada cuenta empieza con historial limpio.
- Con "Confirm email" desactivado, cualquiera puede crear una cuenta con un correo falso.
- Chrome ya no ofrece guardar la contraseña del login (se desactivó a propósito para quitar el cuadro de contraseñas guardadas).
- En Android, el navegador puede sonar un bip cada vez que reinicia la escucha del modo voz (es del navegador).

---

## 5. Pendientes (se van quitando al completarlos)

1. Guardar el SQL de las tablas y políticas en el repo (por ejemplo `supabase_schema.sql`) para poder recrearlas.
2. Probar con dos cuentas reales que cada una solo ve sus chats y su memoria (hasta ahora se probó con una prueba simulada y con una cuenta real).
3. Antes de abrir Jarvis a otras personas: reactivar "Confirm email" en Supabase y confirmar que la app de Google esté publicada (modo Producción).
4. **Resumen automático** de la charla vieja, siempre presente en el contexto (hoy solo se recuerdan 20 mensajes).
5. Modelo por defecto más grande (Gemini Flash normal en vez de flash-lite).
6. Reponer las funciones quitadas en Vercel (voz de mejor calidad; acciones de dispositivo si hay forma).
7. Funciones del sidebar marcadas "Próximamente": buscar en los chats y recordatorios (ahora podrían guardarse por usuario en Supabase).

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
