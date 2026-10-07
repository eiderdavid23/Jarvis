# CONTEXTO JARVIS — léelo completo antes de responder

> Para la IA que reciba este archivo: este es el contexto del proyecto y las reglas de trabajo de David. Síguelas al pie de la letra. Si algo no está aquí, pregunta; no lo inventes.

Última actualización: 7 oct 2026
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

## 2. Qué es Jarvis

Asistente personal de IA de David, con personalidad de mayordomo estilo Iron Man: dice "señor", es conciso salvo que se pida detalle y nunca dice que es un modelo de lenguaje. Ahora es multiusuario: cada persona tiene su cuenta, sus chats y su memoria.

- **Backend**: Python + Flask. `server.py` (~825 líneas) y `supa.py` (~261 líneas: login, chats y memoria en Supabase por REST con el token del usuario; no usa supabase-py). `/chat` exige sesión (decorador `requiere_login`, header `Authorization: Bearer`). `voz_eleven.py` (~83 líneas) genera la voz premium de ElevenLabs.
- **Frontend**: `public/index.html` (~1627 líneas, estilo Claude) y `public/auth.js` (~533 líneas): pantalla de login, lista de chats en el sidebar (sustituyó a "Historial de chats"), "Cerrar sesión" y saludo con el nombre del usuario. En "Próximamente" quedan Buscar y Recordatorios.
- **Login (Supabase Auth)**: "Continuar con Google" y correo + contraseña (con campo Nombre al crear cuenta). Rutas: `/auth/registro`, `/auth/login`, `/auth/refresh`, `/auth/google`, `/auth/yo`. Google devuelve la sesión en el `#` de la URL y `auth.js` la lee. Los tokens van en el `localStorage` del navegador y se renuevan solos.
- **Memoria (Supabase, con RLS por usuario)**: tablas `chats`, `mensajes` y `memorias` (clave/valor). Se mandan al modelo el resumen del chat (columnas `resumen` y `resumen_hasta` de `chats`) más los mensajes posteriores a ese resumen (entre 20 y 30). Los datos permanentes se guardan **por tema** (se actualizan, no se duplican). Ya no se usan `memoria_local.json` ni `memoria_persistente.json`.
- **Herramientas** (function calling, definidas en `server.py`): `abrir_url`, `buscar_persona` (Tavily, necesita `TAVILY_API_KEY`), `generar_imagen` (Cloudflare FLUX.1 schnell si hay `CF_ACCOUNT_ID` y `CF_API_TOKEN`; si no, Gemini), `encender_linterna`, `apagar_linterna`, `vibrar`, `consultar_bateria`, `guardar_recuerdo` (tema + dato) y `olvidar_recuerdo`. Las de hardware usan Termux:API (`comandos_dispositivo.py`).
- **Orbe animado** (canvas) con 3 modos: grande al centro en el inicio y en el modo voz (llamada con escucha continua), y pequeño arriba cuando hay chat. Estados: reposo / escuchando / pensando / hablando. Tocar el orbe interrumpe a Jarvis.
- **PWA**: `public/manifest.json`, `public/sw.js`, `public/icon.svg`.
- **IA**: Gemini por defecto (`GEMINI_MODEL`, hoy `gemini-3.5-flash`, con respaldo automático a `GEMINI_MODEL_RESPALDO`, hoy `gemini-3.5-flash-lite`, cuando Google responde 404, 429 o error 5xx; los resúmenes usan el de respaldo) y Groq como alternativa (`openai/gpt-oss-120b`). Las llaves pueden venir del navegador (headers `X-Gemini-Key`, `X-Groq-Key`, `X-Proveedor`) o del `.env`.
- **Voz** (`POST /voz` con `{texto, tono, vel, premium}`): el frontend divide la respuesta en frases (`dividirFrases`): pide el audio de la primera y, mientras suena, pide la siguiente (no espera el audio completo). Orden de voces: (1) voz premium de ElevenLabs, si la respuesta es corta y está activada; (2) Piper del servidor (solo corre local en Termux); (3) Piper descargado en el navegador, si David lo descargó y lo tiene activado; (4) voz del navegador (`speechSynthesis`), también frase por frase. Si `/voz` falla, sigue con (3) o (4) y no vuelve a intentar el servidor en esa sesión, salvo que la respuesta sea corta y la voz premium esté activada (esa sí lo reintenta).
- **Ajustes de voz** (Ajustes → Voz, `public/voz_ajustes.js`): tarjeta "Tono y estilo" con presets Mayordomo (tono 0.88, velocidad 0.95), Más grave (0.82, 0.92) y Normal, deslizadores de Tono (0.78–1) y Velocidad (0.85–1.15), selector de voz del navegador en español y botón Probar voz. Se guarda en `localStorage` (`jarvisTono`, `jarvisVel`, `jarvisVozNav`). Con Piper del servidor, `/voz` llama a Piper con `--length_scale = tono/vel` (si Piper no lo acepta, reintenta sin él) y el navegador reproduce con `playbackRate = tono` y `preservesPitch = false`, lo que baja el tono sin cambiar la velocidad. Con la voz del navegador se usa `pitch = 1 - (1 - tono) * 2.5` y `rate = vel`.
- **Piper en el navegador** (`public/voz_piper_web.js`, tarjeta "Voz de Jarvis" en Ajustes → Voz): descarga opcional (unos 60 MB, tamaño sin verificar) de la voz `es_ES-davefx-medium`, la misma de Piper local, con la librería `@mintplex-labs/piper-tts-web@1.0.3` cargada como módulo desde esm.sh (jsdelivr de respaldo); el modelo queda guardado en el navegador. Botones Descargar, Probar y Borrar, interruptor "Usar esta voz" (`jarvisPiperWeb` y `jarvisPiperWebOn` en `localStorage`) y enlace "Ver detalle" con el error técnico. Si el primer motor falla al generar, prueba el segundo. En el celular de David funciona, pero demora un poco.
- **Voz premium** (ElevenLabs, `voz_eleven.py` y `public/voz_premium.js`): voz creada por David con Voice Design, en el plan gratis (10.000 créditos/mes, 3 voces guardadas, sin licencia comercial). El ID de la voz va en el código (`ELEVENLABS_VOICE_ID` lo puede cambiar). `/voz` con `premium: true` exige sesión (`Authorization: Bearer`, validado contra Supabase y recordado 5 min en memoria; con `ELEVENLABS_EMAILS` se limita a ciertos correos), acepta frases de hasta 300 letras y usa el modelo `eleven_flash_v2_5` (`ELEVENLABS_MODEL`), estabilidad 0.6 (`ELEVENLABS_STABILITY`) y la velocidad del deslizador Velocidad. Responde `audio/mpeg` con el header `X-Voz-Motor: eleven`, y el navegador la reproduce sin cambiar tono ni velocidad. El frontend solo la pide si la respuesta completa tiene hasta 400 letras y el interruptor "Voz premium" (`jarvisVozPremium`) está activado. Si ElevenLabs responde 401, 402 o 403 (llave mala o sin créditos), se pausa 10 min y se usa la voz de siempre; un 429 se reintenta una vez. En el celular de David funciona y no demora para hablar.
- **Silenciar la voz**: botón de altavoz en la barra superior (junto al "+") y interruptor en Ajustes → Voz. Activa o silencia la voz de las respuestas del chat; se guarda en `localStorage` (`jarvisHablarChat`), por defecto activada. Al silenciar calla al instante, incluso si el audio aún se estaba generando. El modo voz siempre habla.
- **Adjuntos** (botón "+" junto a la caja de texto): hoja "Agregar a Jarvis" con Cámara, Fotos (varias) y Archivos (PDF, ZIP, texto, código, csv, json…). Máximo 5 adjuntos y ~3.3 MB en total (base64), porque Vercel limita el cuerpo a ~4.5 MB; las fotos se reducen en el navegador (JPEG, máx. 1600 px). `/chat` acepta `adjuntos` `[{nombre, tipo, datos(base64)}]`: imágenes y PDF van a Gemini como `inlineData`; los de texto se anexan al mensaje; con Groq las imágenes no se ven (Jarvis avisa) y el PDF se lee con `pypdf`. Se validan antes de crear el chat. En la base solo se guarda el texto más una línea `📎 Adjuntos: nombre1, nombre2`. **ZIP**: `leer_zip()` lo abre en memoria con `zipfile` (nunca escribe en disco) y `bloque_zip()` le pasa al modelo la estructura con el estado de cada archivo más el contenido de los de texto, código y PDF (README primero, datos como json/csv al final); con Gemini hasta 120.000 caracteres (30.000 por archivo) y con Groq 24.000 (8.000 por archivo). Se listan pero no se leen imágenes, binarios, zips anidados, enlaces simbólicos, archivos con contraseña y archivos generados (`package-lock.json`, `*.min.js`); se omiten por seguridad `.env`, `.pem`, `.key` y nombres con "credencial" o "secret"; no se listan `.git`, `node_modules`, `__pycache__`, etc. Protecciones: máximo 2.000 entradas, 12 MB descomprimidos leídos y siempre con tope por archivo.
- **Nivel de pensamiento**: píldora "Jarvis 1.0 Medio" junto al "+"; abre una hoja Bajo / Medio / Alto (Medio por defecto), se guarda en `localStorage` (`jarvisPensamiento`) y viaja en el header `X-Pensamiento`. En Gemini se traduce a `thinkingConfig` (`thinkingLevel` en Gemini 3.x, `thinkingBudget` en 2.5) y en Groq a `reasoning_effort`; sube `maxOutputTokens` (2048 / 4096 / 8192 en Gemini; 1500 / 3000 / 4500 en Groq) porque el pensamiento cuenta dentro del límite. Si el proveedor rechaza el ajuste (error 400), reintenta sin él.
- **Uso real de la API** (Ajustes → Uso): cada llamada real a Gemini o Groq (también las del resumen y las vueltas de herramientas) se anota en el servidor y se guarda en Supabase (tabla `uso_api` y función `registrar_uso`, ver `supabase_uso.sql`), con tokens de entrada y salida. El número es el mismo en el local y en Vercel. Se actualiza solo cada 5 s con la pestaña abierta y al terminar cada mensaje (`GET /uso`). El día de Gemini cambia a medianoche del Pacífico y el de Groq a medianoche UTC. Las metas (500 / 1000 por defecto) se guardan por cuenta en la tabla `metas_uso` (`supabase_metas.sql`; `GET /uso` las devuelve y `POST /uso` las guarda); si esa tabla no existe, siguen en `localStorage`, por dispositivo.
- **requirements.txt**: flask, flask-cors, python-dotenv, requests, pypdf, beautifulsoup4, fpdf2, gunicorn, cryptography (`piper-tts` se quita para Vercel).

**Repo**: https://github.com/eiderdavidgarcia23/Jarvis
**Vercel**: https://jarvis-mu-ebon-12.vercel.app
**Local**: `~/jarvis` en Termux, con `python server.py` (puerto 3000 o `PORT`).

**Variables de entorno** (en `.env` local y en Vercel → Settings → Environment Variables; Flask solo lee el `.env` al arrancar, y en Vercel hay que hacer Redeploy tras cambiarlas): `GEMINI_API_KEY`, `GROQ_API_KEY`, `SUPABASE_URL` y `SUPABASE_KEY` (la llave **publishable**; nunca la `secret` ni el Client Secret de Google) y `ELEVENLABS_API_KEY` (llave de ElevenLabs; solo en `.env` y Vercel). Opcionales: `TAVILY_API_KEY` (búsqueda de personas), `CF_ACCOUNT_ID` y `CF_API_TOKEN` (imágenes con Cloudflare), `CF_IMAGE_MODEL`, `GEMINI_IMAGE_MODEL` (por defecto `gemini-2.5-flash-image`), `ELEVENLABS_EMAILS`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL`, `ELEVENLABS_STABILITY`.

**Configuración externa** (no está en el repo):
- Supabase → Authentication → Sign In / Providers: Google activado y "Confirm email" desactivado (para pruebas). URL Configuration: Site URL y Redirect URLs con la dirección de Vercel y `http://localhost:3000`.
- Google Cloud: proyecto "Jarvis", cliente OAuth tipo Aplicación web, con la callback de Supabase como URI de redirección.
- Las tablas y políticas RLS se crearon con un SQL ejecutado a mano en Supabase. También se ejecutan a mano `supabase_resumen.sql`, `supabase_uso.sql` y `supabase_metas.sql`.

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
- **3–4 oct 2026**: intento de "Integraciones": un widget de soporte para pegar Jarvis como bot en otras plataformas, pensado para la plataforma "Maní Garcia" de David. Se construyó y se probó en local (ruta pública `/widget/chat`, `public/widget.js`, tablas `bots` y `bot_uso`, panel en el sidebar), pero David vio que el bot no aparecía en su plataforma y decidió quitarlo. Se retiró todo con `quitar_integraciones.py`: el repo quedó como antes (sin `integraciones.py`, `bots_admin.py` ni `widget.js`, y sin la variable `SUPABASE_SERVICE_KEY`). Si no se borraron, las tablas `bots` y `bot_uso` pueden seguir en Supabase sin estorbar. Si se retoma, primero hay que diagnosticar por qué no aparecía en su plataforma.
- **4–5 oct 2026**: voz más grave y ajustable (tarjeta "Tono y estilo", ver sección 2). Se entregó como `public/voz_ajustes.js` y `parche_voz.py`. Probado en Chrome headless con Piper y audio simulados; el sonido real solo lo puede evaluar David de oído.
- **4–5 oct 2026**: Piper en el navegador, para tener en Vercel la misma voz del local. Se entregó como `public/voz_piper_web.js` y `parche_voz_piper.py`. El primer intento dio error al generar el audio; se agregó un segundo motor de respaldo y el enlace "Ver detalle", y los textos de la tarjeta se simplificaron (solo "Voz de Jarvis", el peso y la recomendación de usar WiFi). Resultado: funciona, pero en el celular de David demora un poco; por eso se pasó a ElevenLabs.
- **5 oct 2026**: voz premium con ElevenLabs. David creó con Voice Design una voz grave de mayordomo en español y se conectó al servidor y al frontend (ver sección 2). Se entregó como `voz_eleven.py`, `public/voz_premium.js` y `parche_voz_eleven.py`. Probado con ElevenLabs y Supabase simulados y en Chrome headless; en el celular de David funciona y no demora para hablar.
- **5 oct 2026**: metas del contador de uso por cuenta (tabla `metas_uso`, `POST /uso` para guardar y `metas` dentro de `GET /uso`; si la tabla no existe usa `localStorage` como antes). Se entregó como `supabase_metas.sql` y `parche_metas.py`. David confirmó además que ya reactivó "Confirm email" y publicó la app de Google (antiguo pendiente 3).
- **5 oct 2026**: Jarvis ahora conoce sus propias funciones. `texto_capacidades()` en `server.py` agrega al prompt un bloque "SOBRE TI" con lo que tiene y lo que aún no (y avisa que linterna, vibración y batería no están en la versión en línea; la búsqueda de personas solo se ofrece si hay `TAVILY_API_KEY`). Se entregó como `parche_capacidades.py`.
- **5 oct 2026**: corregido que Jarvis usaba `buscar_persona` para buscar productos en un sitio (abría Instagram y mostraba resultados ajenos). Ahora `buscar_persona` es solo para personas; para un producto o una búsqueda en un sitio, Jarvis pregunta si confirma y, al confirmar, abre con `abrir_url` la búsqueda de ese sitio (Mercado Libre usa el dominio del país; si no lo sabe lo pregunta y lo guarda como recuerdo `pais`). La confirmación depende de las instrucciones al modelo, no de un bloqueo en el código. Se entregó como `parche_busqueda.py`.
- **7 oct 2026**: generación de imágenes. Herramienta `generar_imagen` (modelo `gemini-2.5-flash-image`, cambiable con `GEMINI_IMAGE_MODEL`): `/chat` devuelve `imagenes` y el navegador las muestra en una tarjeta con botón Descargar. Una por mensaje, solo con Gemini, sin guardarse en el historial. Se entregó como `parche_imagen.py`.
- **7 oct 2026**: la llave gratis de Gemini no tenía cuota para imágenes, así que `generar_imagen` ahora usa Cloudflare Workers AI (FLUX.1 schnell) cuando existen `CF_ACCOUNT_ID` y `CF_API_TOKEN` en Vercel; si no, vuelve a Gemini. Con Cloudflare también funciona con Groq. Se entregó como `parche_cloudflare.py`.
- **7 oct 2026**: Jarvis dijo "generando la imagen" sin llamar a `generar_imagen` (no salió nada). Se reforzó la instrucción en la descripción de la herramienta y en `texto_capacidades()`. Se entregó como `parche_imagen_regla.py`.
- **7 oct 2026**: modelo avanzado con respaldo. `GEMINI_MODEL` pasa a `gemini-3.5-flash` y, si Google responde 404, 429 o 5xx, `llamar_gemini` reintenta con `GEMINI_MODEL_RESPALDO` (`gemini-3.5-flash-lite`). Se entregó como `parche_modelo.py`.
- **7 oct 2026**: Jarvis lee archivos .zip adjuntos (ver Adjuntos en la sección 2). Se entregó como `parche_zip.py`. Probado con zips normales, con rutas con `..`, con enlaces simbólicos, cifrado, corrupto, con 2.500 archivos y con una bomba de compresión, con Gemini y Supabase simulados y en Chrome headless; falta probarlo con un zip real en el celular.
- **7 oct 2026**: los adjuntos ya no se olvidan. Tabla `archivos_chat` (RLS por usuario, se borra con el chat; SQL en `supabase_archivos.sql`), herramienta `leer_archivo(ruta, parte)` y lista de archivos guardados en el prompt de cada mensaje. Funciona con zip, PDF y texto. Se entregó como `parche_archivos.py`.
- **7 oct 2026**: diseño. Pantalla de inicio animada al abrir la app (`public/splash.css` y `public/splash.js`: orbe con anillos giratorios, título letra por letra y barra de progreso, ~2 s, una vez por apertura; respeta tema claro y oscuro) y ondas de voz alrededor del orbe (`public/ondas.js`: barras circulares y anillos que se expanden; con el usuario se activan por cada resultado del reconocimiento de voz y con Jarvis por palabra o con ritmo simulado). Las ondas son simuladas, no leen el audio real. Se entregó como `parche_diseno.py`.

---

## 4. Limitaciones conocidas

- Adjuntos: Vercel limita el cuerpo a ~4.5 MB, por eso el tope es 5 adjuntos y ~3.3 MB en base64. Las fotos se reducen solas; un PDF o archivo grande no. Una foto HEIC de la galería puede no abrirse en Chrome.
- Con Groq no se ven imágenes (Jarvis avisa) y un PDF escaneado sin texto no se puede leer.
- Modelo avanzado + respaldo: la cuota de Google es por modelo y por proyecto; el contador de uso suma las llamadas de los dos modelos juntos. Si el avanzado se agota, Jarvis sigue con flash-lite (menos capaz con herramientas). Si en Vercel existe la variable `GEMINI_MODEL`, manda sobre el valor por defecto.
- Imágenes generadas (`generar_imagen`): una por mensaje (con Cloudflare sirve con cualquier proveedor; sin Cloudflare, solo con Gemini), no se guardan en el historial (al reabrir el chat queda solo el texto) y no suman al contador de uso. La llave gratis de Gemini no tuvo cuota para imágenes (7 oct); la cuota diaria gratis de Cloudflare no está verificada y Vercel puede cortar la generación por tiempo.
- El timeout hacia la IA es de 55 s. El límite de la función en Vercel depende del plan y no hay `vercel.json`: si con nivel Alto sale error 504, usar Medio.
- El uso real cuenta solo lo que Jarvis envía: Google cuenta la cuota por proyecto, así que otras apps con la misma llave no aparecen (el total oficial está en aistudio.google.com/rate-limit). La hora de reinicio de Groq (UTC) no está verificada.
- Si falta la tabla `uso_api`, el chat sigue normal y Uso muestra "Falta crear la tabla en Supabase". Si falta la tabla `metas_uso`, las metas del contador quedan guardadas por dispositivo.
- En Vercel, Piper del servidor no corre (solo funciona corriendo local en Termux): ahí la voz es la premium de ElevenLabs en respuestas cortas, Piper descargado en el navegador (más lento) o la voz del navegador (más robótica).
- Voz premium: el plan gratis de ElevenLabs trae 10.000 créditos al mes (unos 10 minutos de voz, a 1 crédito por letra; cifra sin verificar con el uso real) y no tiene licencia comercial. Cada frase y cada "Probar voz" los gastan, y cualquier cuenta con sesión los gasta también, salvo que se use `ELEVENLABS_EMAILS`. Al agotarse, Jarvis vuelve solo a la voz anterior y no se cobra nada (la cuenta no tiene tarjeta). La pausa de 10 min y las sesiones recordadas viven en la memoria de cada instancia del servidor; en Vercel pueden reiniciarse.
- Piper en el navegador: la primera vez necesita internet (carga el motor desde esm.sh o jsdelivr y descarga el modelo) y en el celular de David tarda en generar cada frase. No se le puede compensar la velocidad: con tono grave suena más lenta.
- Los ajustes de voz (tono, velocidad, voz del navegador e interruptores) se guardan por dispositivo y por dirección: `localhost:3000` y Vercel no los comparten.
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
- El resumen es por chat: no mezcla chats distintos (los datos permanentes siguen en `memorias`). Cada resumen cuesta una llamada extra a la IA cada ~10 mensajes y suma 1–3 s a esa respuesta.
- En chats viejos con más de 60 mensajes sin resumir, el primer resumen solo cubre los últimos 60.
- ZIP: el texto de lo adjuntado (zip, PDF y archivos de texto) se guarda en la tabla `archivos_chat` y Jarvis lo reabre con `leer_archivo` en los mensajes siguientes (hasta ~1,5 MB de texto por mensaje; las imágenes no se guardan; cada lectura cuenta como una llamada más a la IA, tope 8 vueltas por mensaje; el prompt lleva la lista de hasta 80 archivos). Un zip pesa como máximo unos 2,4 MB (tope de ~3,3 MB en base64 por Vercel); si hay más texto del que cabe, Jarvis lo avisa en la estructura (recortado / no leído). Solo `.zip`: no abre `.rar`, `.7z` ni `.tar.gz`.

---

## 5. Pendientes (se van quitando al completarlos)

1. Guardar el SQL de las tablas y políticas en el repo (por ejemplo `supabase_schema.sql`) para poder recrearlas.
2. Probar con dos cuentas reales que cada una solo ve sus chats y su memoria (hasta ahora se probó con una prueba simulada y con una cuenta real).
3. Voz: decidir qué hacer cuando se agoten los créditos de ElevenLabs (hoy Jarvis vuelve a la voz anterior), revisar de vez en cuando el gasto en el panel de ElevenLabs y evaluar Gemini TTS gratis como segunda voz del servidor para Vercel (voces masculinas Charon, Orus e Iapetus en Google AI Studio, con instrucción de tono de mayordomo; su velocidad no se ha medido). Acciones de dispositivo en Vercel, si hay forma.
4. Funciones del sidebar marcadas "Próximamente": buscar en los chats y recordatorios (ahora podrían guardarse por usuario en Supabase).
5. Verificar a qué hora reinicia el día de Groq (hoy se asume medianoche UTC, sin verificar).
6. Integraciones (widget de soporte para otras plataformas): descartado por ahora; ver el historial del 3–4 oct.
7. Probar la generación de imágenes con Cloudflare (cuota diaria gratis) y el tiempo máximo de la función en Vercel.
8. Verificar en Vercel (Logs) que el modelo avanzado responde con la llave de David y que el respaldo entra cuando se agota; probar también `gemini-3.6-flash` poniéndolo en `GEMINI_MODEL`.
9. Iconos PNG (192, 512 y adaptable) para el icono de la app y la carga nativa de Android; hoy solo hay `icon.svg`.

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
7. Si se agrega o quita una función de Jarvis, actualizar también `texto_capacidades()` en `server.py`, para que Jarvis sepa qué tiene.

David comparte este archivo al abrir un chat nuevo, para que la IA tenga todo el contexto.
