# NUEVA VERSION DE JARVIS (plan)

Creado: 20 nov 2026. Reemplaza los parches de V1 por un proyecto ordenado.

## 1. Reglas
- Todo el codigo va en bloques cat > archivo << 'EOF', completo.
- Archivo largo = por partes, con wc -l entre cada parte.
- Cada cambio anota la version en CAMBIOS.md.
- No se parcha: si algo se rompe, se reescribe el archivo.
- Se construye en una carpeta nueva (nueva/). El proyecto actual queda intacto de respaldo.

## 2. Orden de carpetas
    nueva/
      servidor/
        app.py                 solo crea Flask y registra modulos
        config.py              variables y .env
        nucleo/                login (supa), llaves, ia.py (Gemini y Groq), herramientas
        modulos/<nombre>/      api.py (una carpeta por funcion)
      web/
        index.html             solo el esqueleto, sin CSS ni JS adentro
        css/base.css           variables, reset, tipografia
        css/tema_yarvex.css    colores y vidrio estilo Yarvex
        css/componentes/       boton, tarjeta, interruptor, panel
        js/nucleo/             api.js, estado.js, rutas.js, voz.js
        js/modulos/<nombre>/   logica.js, vista.html, estilo.css
      android/                 codigo nativo (burbuja, manos, escucha)
      docs/                    CONTEXTO, CAMBIOS, NUEVA_VERSION

Regla: una carpeta por funcion, con sus tres cosas juntas (esqueleto, estilo, logica). Un modulo no toca archivos de otro.

## 3. Funciones que se quedan
Login (Supabase), chat, IA (solo Gemini y Groq), voz Piper, burbuja,
manos (ver y controlar pantalla), pantalla orbital, modelo local,
recordatorios, tareas automaticas, memoria.

## 4. Funciones nuevas (Yarvex)
Gestos y control por manos con la camara, vision local, musica integrada,
encendido por aplauso, musica de bienvenida, conectores como menu propio.

## 5. Funciones que se borran
Minecraft, NEXUS, TV, PC, gastos, seguridad/hack, proyectos, trabajos,
mapa, plantillas de modulos, y los proveedores Mistral, OpenRouter y NVIDIA.

## 6. Diseno (estilo Yarvex)
Fondo negro azulado, cian, vidrio, letras espaciadas, pantalla orbital al
centro, Ajustes con secciones desplegables (Cuenta, Apariencia, Preferencias,
Musica de bienvenida, Cerebro, Rendimiento, Permisos, Memoria, IA en linea).

## 7. Fases
1. Esqueleto: carpetas, config, app.py, login y chat basico con Gemini y Groq.
2. Diseno Yarvex: base.css, tema, pantalla orbital y Ajustes.
3. Pasar lo que se queda, un modulo por vez (voz, burbuja, manos, memoria, recordatorios, tareas, modelo local).
4. Funciones nuevas, una por una (musica, gestos, vision, aplauso, conectores).
5. Cambiar nueva/ por el proyecto actual, con copia de respaldo fuera del repo.
