"""Modo Seguridad de Jarvis: auditoria estatica del propio proyecto.
Busca secretos escritos en el codigo, depuracion activa y rutas Flask sin
decorador de login, SOLO dentro de la carpeta del propio Jarvis. No toca
nada fuera de BASE_DIR y no hace peticiones a ningun sitio ajeno.
"""
import os
import re

EXT_TEXTO = {'.py', '.js', '.html', '.json', '.yml', '.yaml', '.css', '.java', '.sql', '.sh'}
IGNORAR_DIRS = {'.git', 'node_modules', '__pycache__', 'piper', 'piper_voices', 'android', 'assets'}
IGNORAR_ARCHIVOS = {'.env.example', 'package-lock.json'}
MAX_TAM = 400000     # no lee archivos mas pesados que esto (evita binarios grandes)
MAX_HALLAZGOS = 40

PATRONES_SECRETO = [
    ('Llave de AWS', re.compile(r'AKIA[0-9A-Z]{16}')),
    ('Llave de Google/Gemini', re.compile(r'AIza[0-9A-Za-z\-_]{35}')),
    ('Llave de Groq', re.compile(r'gsk_[0-9A-Za-z]{20,}')),
    ('Llave de OpenAI/OpenRouter', re.compile(r'sk-[0-9A-Za-z]{20,}')),
    ('Token tipo JWT', re.compile(r'eyJ[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]{10,}')),
    ('Posible contraseña o llave escrita en el código',
     re.compile(r'(?i)\b(password|contrase[nñ]a|secret|api_key|apikey|token)\b\s*[:=]\s*[\'"][^\'"\s]{8,}[\'"]')),
]
PATRON_DEBUG = re.compile(r'debug\s*=\s*True|FLASK_DEBUG\s*=\s*1')
PATRON_RUTA = re.compile(r'@app\.route\(')
PATRON_LOGIN = re.compile(r'@supa\.requiere_login|@requiere_login')


def _es_ejemplo(linea):
    """Evita falsos positivos en .env.example, placeholders, etc."""
    return bool(re.search(r'(?i)ejemplo|placeholder|tu[_-]?correo|xxxx|\.\.\.|tu_llave|<.*>', linea))


def _listar_archivos(base):
    for raiz, dirs, archivos in os.walk(base):
        dirs[:] = [d for d in dirs if d not in IGNORAR_DIRS and not d.startswith('.')]
        for nom in archivos:
            if nom in IGNORAR_ARCHIVOS:
                continue
            ext = os.path.splitext(nom)[1].lower()
            if ext in EXT_TEXTO or nom == '.env':
                yield os.path.join(raiz, nom)


def auditar_proyecto(base_dir):
    """Revisa BASE_DIR en busca de secretos expuestos, debug activo y rutas sin login.
    Es una revision por patrones (no ejecuta nada ni usa IA): puede dar falsos
    positivos o pasar cosas por alto. No reemplaza una revision manual."""
    hallazgos = []
    rutas_sin_login = []
    archivos_vistos = 0
    for ruta in _listar_archivos(base_dir):
        try:
            if os.path.getsize(ruta) > MAX_TAM:
                continue
            with open(ruta, 'r', encoding='utf-8', errors='ignore') as f:
                contenido = f.read()
        except OSError:
            continue
        archivos_vistos += 1
        rel = os.path.relpath(ruta, base_dir)
        if rel == '.env' or rel.endswith(os.sep + '.env'):
            hallazgos.append({'archivo': rel, 'linea': 0, 'severidad': 'info',
                               'tipo': 'Archivo .env presente',
                               'detalle': 'Confirme que esta en .gitignore y que nunca se subio al repositorio.'})
            continue  # no se mira el contenido de un .env real
        for i, linea in enumerate(contenido.splitlines(), 1):
            if _es_ejemplo(linea):
                continue
            for nombre, pat in PATRONES_SECRETO:
                if pat.search(linea):
                    hallazgos.append({'archivo': rel, 'linea': i, 'severidad': 'alta', 'tipo': nombre,
                                       'detalle': 'Posible secreto escrito directo en el codigo. Mueva el valor a .env y, '
                                                  'si el archivo ya se subio a git, rote esa llave de inmediato.'})
                    break
            if PATRON_DEBUG.search(linea):
                hallazgos.append({'archivo': rel, 'linea': i, 'severidad': 'media',
                                   'tipo': 'Depuracion activa (debug=True)',
                                   'detalle': 'En produccion puede exponer codigo interno y datos en la pagina de error.'})
            if len(hallazgos) >= MAX_HALLAZGOS:
                break
        if rel.endswith('.py') and PATRON_RUTA.search(contenido) and not PATRON_LOGIN.search(contenido):
            rutas_sin_login.append(rel)
        if len(hallazgos) >= MAX_HALLAZGOS:
            break
    return {
        'ok': True,
        'archivos_revisados': archivos_vistos,
        'hallazgos': hallazgos[:MAX_HALLAZGOS],
        'archivos_con_rutas_sin_login_aparente': rutas_sin_login[:20],
        'nota': ('Revision estatica automatica por patrones de texto, sin ejecutar nada ni llamar a ninguna IA '
                 'externa. Puede dar falsos positivos (por ejemplo un ejemplo de codigo) o pasar cosas por alto. '
                 'No reemplaza una auditoria manual ni una herramienta profesional.')
    }
