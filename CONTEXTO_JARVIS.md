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

- **Backend**: Python + Flask. `server.py` (~810 líneas) y `supa.py` (~234 líneas: login, chats y memoria en Supabase por REST con el token del usuario; no usa supabase-py). `/chat` exige sesión (decorador `requiere_login`, header `Authorization: Bearer`).
- **Frontend**: `public/index.html` (~1602 líneas, estilo Claude) y `public/auth.js` (~533 líneas): pantalla de login, lista de chats en el sidebar (sustituyó a "Historial de chats"), "Cerrar sesión" y saludo con el nombre del usuario. En "Próximamente" quedan Buscar y Recordatorios.
- **Login (Supabase Auth)**: "Continuar con Google" y correo + contraseña (con campo Nombre al crear cuenta). Rutas: `/auth/registro`, `/auth/login`, `/auth/refresh`, `/auth/google`, `/auth/yo`. Google devuelve la sesión en el `#` de la URL y `auth.js` la lee. Los tokens van en el `localStorage` del navegador y se renuevan solos.
- **Memoria (Supabase, con RLS por usuario)**: tablas `chats`, `mensajes` y `memorias` (clave/valor). Se mandan al modelo el resumen del chat (columnas `resumen` y `resumen_hasta` de `chats`) más los mensajes posteriores a ese resumen (entre 20 y 30). Los datos permanentes se guardan **por tema** (se actualizan, no se duplican). Ya no se usan `memoria_local.json` ni `memoria_persistente.json`.
- **Herramientas** (function calling, definidas en `server.py`): `abrir_url`, `encender_linterna`, `apagar_linterna`, `vibrar`, `consultar_bateria`, `guardar_recuerdo` (tema + dato) y `olvidar_recuerdo`. Las de hardware usan Termux:API (`comandos_dispositivo.py`).
- **Orbe animado** (canvas) con 3 modos: grande al centro en el inicio y en el modo voz (llamada con escucha continua), y pequeño arriba cuando hay chat. Estados: reposo / escuchando / pensando / hablando. Tocar el orbe interrumpe a Jarvis.
- **PWA**: `public/manifest.json`, `public/sw.js`, `public/icon.svg`.
- **IA**: Gemini por defecto (`GEMINI_MODEL`, hoy `gemini-3.5-flash-lite`) y Groq como alternativa (`openai/gpt-oss-120b`). Las llaves pueden venir del navegador (headers `X-Gemini-Key`, `X-Groq-Key`, `X-Proveedor`) o del `.env`.
- **Voz**: Piper TTS local (`/voz`). El frontend divide la respuesta en frases (`dividirFrases`): pide el audio de la primera y, mientras suena, pide la siguiente (no espera el audio completo). Si `/voz` falla, sigue con la voz del navegador, también frase por frase, y no vuelve a intentar Piper en esa sesión.
- **Silenciar la voz**: botón de altavoz en la barra superior (junto al "+") y interruptor en Ajustes → Voz. Activa o silencia la voz de las respuestas del chat; se guarda en `localStorage` (`jarvisHablarChat`), por defecto activada. Al silenciar calla al instante, incluso si el audio aún se estaba generando. El modo voz siempre habla.
- **Adjuntos** (botón "+" junto a la caja de texto): hoja "Agregar a Jarvis" con Cámara, Fotos (varias) y Archivos (PDF, texto, código, csv, json…). Máximo 5 adjuntos y ~3.3 MB en total (base64), porque Vercel limita el cuerpo a ~4.5 MB; las fotos se reducen en el navegador (JPEG, máx. 1600 px). `/chat` acepta `adjuntos` `[{nombre, tipo, datos(base64)}]`: imágenes y PDF van a Gemini como `inlineData`; los de texto se anexan al mensaje; con Groq las imágenes no se ven (Jarvis avisa) y el PDF se lee con `pypdf`. Se validan antes de crear el chat. En la base solo se guarda el texto más una línea `📎 Adjuntos: nombre1, nombre2`.
- **Nivel de pensamiento**: píldora "Jarvis 1.0 Medio" junto al "+"; abre una hoja Bajo / Medio / Alto (Medio por defecto), se guarda en `localStorage` (`jarvisPensamiento`) y viaja en el header `X-Pensamiento`. En Gemini se traduce a `thinkingConfig` (`thinkingLevel` en Gemini 3.x, `thinkingBudget` en 2.5) y en Groq a `reasoning_effort`; sube `maxOutputTokens` (2048 / 4096 / 8192 en Gemini; 1500 / 3000 / 4500 en Groq) porque el pensamiento cuenta dentro del límite. Si el proveedor rechaza el ajuste (error 400), reintenta sin él.
- **Uso real de la API** (Ajustes → Uso): cada llamada real a Gemini o Groq (también las del resumen y las vueltas de herramientas) se anota en el servidor y se guarda en Supabase (tabla `uso_api` y función `registrar_uso`, ver `supabase_uso.sql`), con tokens de entrada y salida. El número es el mismo en el local y en Vercel. Se actualiza solo cada 5 s con la pestaña abierta y al terminar cada mensaje (`GET /uso`). El día de Gemini cambia a medianoche del Pacífico y el de Groq a medianoche UTC. Las metas (500 / 1000) siguen en `localStorage`, por dispositivo.
- **Busqueda de personas** (`buscar_persona`, Tavily): busca en Google y en Instagram, Facebook, TikTok, X y LinkedIn (solo paginas publicas indexadas). `/chat` devuelve `busqueda`; el front muestra una tarjeta de resultados y abre sola la primera red social (si el navegador no bloquea la pestana). Necesita `TAVILY_API_KEY` (llave por Bearer) en `.env` y en Vercel.
- **Orbita flotante (solo PC)**: boton junto al "+" que abre una ventana flotante (Document Picture-in-Picture, Chrome/Edge de escritorio) con orbe, ultimos mensajes, resultados, texto y microfono. En celular el boton no aparece.
- **requirements.txt**: flask, flask-cors, python-dotenv, requests, pypdf, beautifulsoup4, fpdf2, gunicorn, cryptography (`piper-tts` se quita para Vercel).

**Repo**: https://github.com/eiderdavidgarcia23/Jarvis
**Vercel**: https://jarvis-mu-ebon-12.vercel.app
**Local**: `~/jarvis` en Termux, con `python server.py` (puerto 3000 o `PORT`).

**Variables de entorno** (en `.env` local y en Vercel → Settings → Environment Variables; Flask solo lee el `.env` al arrancar, y en Vercel hay que hacer Redeploy tras cambiarlas): `GEMINI_API_KEY`, `GROQ_API_KEY`, `SUPABASE_URL` y `SUPABASE_KEY` (la llave **publishable**; nunca la `secret` ni el Client Secret de Google).

**Configuración externa** (no está en el repo):
- Supabase → Authentication → Sign In / Providers: Google activado y "Confirm email" desactivado (para pruebas). URL Configuration: Site URL y Redirect URLs con la dirección de Vercel y `http://localhost:3000`.
- Google Cloud: proyecto "Jarvis", cliente OAuth tipo Aplicación web, con la callback de Supabase como URI de redirección.
- Las tablas y políticas RLS se crearon con un SQL ejecutado a mano en Supabase. También se ejecutan a mano `supabase_resumen.sql` y `supabase_uso.sql`.

**Deploy (solo Vercel)**: `git add -A && git commit -m "mensaje" && git push`; Vercel redespliega solo. Render ya no se usa.

---

## 3. Historial de lo hecho

- **29 ago 2026**: retomado el proyecto desde el zip `Jarvis-main` (versión anterior a Firebase/login). Limpieza del repo: borrados `_archivado/`, `__pycache__/`, `package.json`, `package-lock.json`, backup viejo del index y logs; sacados del tracking `memoria_local.json`, `recordatorios.json` y `preferencias/`; `.gitignore` actualizado. No se reescribió el historial viejo de git.
- **30 ago 2026**: arreglada la voz (Piper daba timeout). La causa era que el servidor no se había reiniciado tras corregir el `.env`.
- **2 oct 2026**: Jarvis desplegado en Vercel e instalado como app en el celular. Se entregó `parche_vercel.py` (voz del navegador si `/voz` falla, quitar `piper-tts` de `requirements.txt`).
- **2 oct 2026**: nuevo frontend estilo Claude (`public/index.html` reemplazado; la copia anterior quedó fuera del repo): sidebar, burbujas, animaciones, orbe con 3 modos y modo voz continuo. Se entregó en 6 partes (1014 líneas) y se desplegó en Vercel.
- **3 oct 2026**: botón para silenciar la voz del chat (barra superior, sincronizado con Ajustes; calla al instante y no afecta al modo voz) y voz por frases (empieza a hablar con la primera frase sin esperar todo el audio). Se entregaron como `parche_silencio.py` y `parche_frases.py`. Probado en Chrome headless con audio simulado; no se probó con Piper real en el celular. Se decidió dejar por ahora la voz Piper local.
- **3 oct 2026**: cuentas por usuario con Supabase. Se creó `supa.py` y `public/auth.js`, y se parchó `server.py` e `index.html` (el primer parche falló porque asumía otra versión de `server.py`; se rehízo contra el real). Quedó hecho: login con correo y con Google, nombre del usuario en el saludo y en el prompt, historial de chats por usuario en el sidebar (crear, abrir, borrar), memoria permanente por tema con `guardar_recuerdo` y `olvidar_recuerdo`, y se quitó el autocompletado de contraseñas de Chrome en el login. Probado en local y en Vercel.
- **3 oct 2026**: caja de texto auto-expandible (textarea que crece hacia abajo hasta ~6 líneas), tema Sistema / Claro / Oscuro (por defecto sigue el del sistema; pestaña Tema en Ajustes, se guarda en `localStorage` como `jarvisTema`) y pie del sidebar con tarjeta de usuario (inicial, nombre, correo) en lugar de "Proveedor de IA"; Cerrar sesión ahora pide confirmación con un mensaje al estilo Jarvis y se despide antes de salir. Se entregaron como `parche_caja.py`, `parche_tema.py` y `parche_salir.py`.
- **3 oct 2026**: resumen automático por chat. Al juntar 30 mensajes sin resumir, Jarvis le pide a la IA (el mismo proveedor y llave de ese mensaje) un resumen que fusiona el anterior con los mensajes más viejos, deja los últimos 20 completos y guarda el resumen en `chats.resumen`. El resumen va siempre en el prompt de ese chat. Si las columnas no existen o la IA falla, el chat sigue normal sin resumir. Se entregó como `parche_resumen.py` y `supabase_resumen.sql`.
- **3 oct 2026**: adjuntos y nivel de pensamiento. Botón "+" con hoja (Cámara, Fotos, Archivos), miniaturas y chips con × encima del texto y dentro de la burbuja, píldora "Jarvis 1.0 Medio" con hoja Bajo / Medio / Alto, y backend con `adjuntos` y header `X-Pensamiento`. Se entregó como `parche_adjuntos_back.py`, `parche_adjuntos_front_a.py` y `parche_adjuntos_front_b.py`. Probado con Gemini, Groq y Supabase simulados y en Chrome headless (tema claro y oscuro); funcionando en el celular.
- **3 oct 2026**: uso real de la API. Reemplaza el contador local, que contaba mensajes por navegador y no coincidía entre el local y Vercel. Ahora el servidor cuenta cada llamada real y la guarda en Supabase. Se entregó como `parche_uso_real.py` y `supabase_uso.sql`. Probado con Supabase simulado y en Chrome headless; funcionando.
- **3 oct 2026**: busqueda de personas con Tavily (`buscar_persona`) y tarjeta de resultados; arreglado `abrir_url` (el front ignoraba `urls_abrir`); orbita flotante para PC; sidebar con scroll y saludo sin encimarse en celular horizontal. Entregado como `parche_busqueda_back.py`, `parche_busqueda_front.py`, `parche_flotar.py` y `parche_sidebar.py`. La orbita flotante se probo con una ventana simulada, NO en un Chrome de PC real.

---

## 4. Limitaciones conocidas

- Adjuntos: Vercel limita el cuerpo a ~4.5 MB, por eso el tope es 5 adjuntos y ~3.3 MB en base64. Las fotos se reducen solas; un PDF o archivo grande no. Una foto HEIC de la galería puede no abrirse en Chrome.
- Con Groq no se ven imágenes (Jarvis avisa) y un PDF escaneado sin texto no se puede leer.
- El timeout hacia la IA es de 55 s. El límite de la función en Vercel depende del plan y no hay `vercel.json`: si con nivel Alto sale error 504, usar Medio.
- El uso real cuenta solo lo que Jarvis envía: Google cuenta la cuota por proyecto, así que otras apps con la misma llave no aparecen (el total oficial está en aistudio.google.com/rate-limit). La hora de reinicio de Groq (UTC) no está verificada.
- Si falta la tabla `uso_api`, el chat sigue normal y Uso muestra "Falta crear la tabla en Supabase". Las metas del contador siguen guardadas por dispositivo.
- En Vercel, Piper no corre (la voz es la del navegador, más robótica; Piper solo funciona corriendo local en Termux).
- La primera frase siempre espera el audio de `/voz` (1–2 s con Piper local). Con Piper local cada frase vuelve a lanzar Piper; si se notan pausas entre frases, subir el tamaño mínimo de frase en `dividirFrases` (hoy 12 caracteres la primera y 50 las demás).
- Linterna, vibrar y batería dependen de Termux: solo funcionan corriendo local.
- Cada mensaje hace varias llamadas a Supabase (validar sesión, leer historial y recuerdos, guardar), así que hay algo más de latencia que antes.
- El chat de un usuario se crea al enviar su primer mensaje; "Nuevo chat" solo prepara la pantalla.
- Los chats viejos que estaban en archivos no se migraron: cada cuenta empieza con historial limpio.
- Con "Confirm email" desactivado, cualquiera puede crear una cuenta con un correo falso.
- Chrome ya no ofrece guardar la contraseña del login (se desactivó a propósito para quitar el cuadro de contraseñas guardadas).
- En Android, el navegador puede sonar un bip cada vez que reinicia la escucha del modo voz (es del navegador).
- En celular, Enter en la caja de texto hace salto de línea y se envía con el botón; en PC Enter envía y Shift+Enter hace salto de línea.
- El color de la PWA instalada (`manifest.json`) sigue siendo oscuro aunque el tema sea claro; la barra del navegador sí cambia con el tema.
- Borrar un chat todavía usa el `confirm()` del navegador (falta el diálogo estilo Jarvis).
- El resumen es por chat: no mezcla chats distintos (los datos permanentes siguen en `memorias`). Cada resumen cuesta una llamada extra a la IA cada ~10 mensajes y suma 1–3 s a esa respuesta.
- En chats viejos con más de 60 mensajes sin resumir, el primer resumen solo cubre los últimos 60.
- Tavily: la llave de prueba se compartio en un chat; cambiarla por una nueva. Sin `TAVILY_API_KEY` la busqueda dice que falta la llave. Solo encuentra lo publico que indexa Google: no entra a Instagram/Facebook con sesion ni lee perfiles privados.
- Abrir la pestana del resultado solo puede ser bloqueado por el navegador (no hay gesto del usuario); en ese caso se toca el resultado en la tarjeta. La tarjeta no se guarda en el historial.
- Orbita flotante: solo Chrome/Edge de escritorio; no se probo en PC real (ventana, microfono dentro de ella, popups). En Android se usa la ventana flotante del sistema.
- Linterna, vibrar y bateria funcionan en local (Termux); desde Vercel no.
- En Termux hace falta `pip install tzdata` (si no, el contador de uso falla con America/Los_Angeles).

---

## 5. Pendientes (se van quitando al completarlos)

1. Guardar el SQL de las tablas y políticas en el repo (por ejemplo `supabase_schema.sql`) para poder recrearlas.
2. Probar con dos cuentas reales que cada una solo ve sus chats y su memoria (hasta ahora se probó con una prueba simulada y con una cuenta real).
3. Antes de abrir Jarvis a otras personas: reactivar "Confirm email" en Supabase y confirmar que la app de Google esté publicada (modo Producción).
4. Modelo por defecto más grande (Gemini Flash normal en vez de flash-lite).
5. Reponer las funciones quitadas en Vercel: voz de mejor calidad (por ahora se deja Piper local; opciones evaluadas: Gemini TTS gratis con límites y tono por instrucciones, o Piper en un servidor aparte con Docker, donde lo gratis se duerme) y acciones de dispositivo si hay forma. Para una voz estilo JARVIS de Iron Man no hay versión gratis oficial; probar voces masculinas de Gemini TTS (Charon, Orus, Iapetus) en Google AI Studio con instrucción de tono de mayordomo.
6. Funciones del sidebar marcadas "Próximamente": buscar en los chats y recordatorios (ahora podrían guardarse por usuario en Supabase).
7. Metas del contador de uso guardadas por cuenta (hoy en `localStorage`, por dispositivo) y verificar a qué hora reinicia el día de Groq.
8. Probar la orbita flotante en una PC real. Opcional: agente en Termux que lea ordenes de Supabase para que linterna/vibrar/bateria y abrir apps tambien funcionen desde Vercel.

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
