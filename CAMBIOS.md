# Bitácora de Jarvis

- Migración del modelo de lenguaje de llama-3.3-70b-versatile a openai/gpt-oss-120b, porque Groq retiró el modelo anterior.
- Búsqueda web integrada mediante Tavily, para consultar información actual.
- Memoria persistente por usuario, para recordar conversaciones anteriores.
- Sistema de recordatorios con notificaciones en el navegador.
- Modo avanzado: comandos combinados y memoria de preferencias de estilo por usuario.
- Voz local con Piper TTS.
- Modo Jarvis en segundo plano: escucha continua activada diciendo "Jarvis", con animación del reactor mientras escucha y responde.
- Botones bajo cada respuesta (copiar, compartir, escuchar, me gusta, no me gusta, repetir) y barra de copiar/ampliar en los bloques de código.
- Recordatorios: panel en el sidebar, avisos con la app abierta (cartel, notificación y voz) y creación, lista y borrado por chat con Jarvis.
- Menú ⋯ en cada chat del sidebar: cambiar nombre, fijar y eliminar.
- Proyectos: carpetas en el sidebar que agrupan chats, con instrucciones propias opcionales para Jarvis, agregar y quitar chats, y Nuevo chat aquí.
