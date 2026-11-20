"""Revisa el estado real de Jarvis: variables de entorno y archivos del repo.
No toca nada, solo informa. Uso (desde ~/jarvis): python diagnostico.py"""
import os

def linea(ok, texto):
    print(('[OK] ' if ok else '[FALTA] ') + texto)

print('--- Variables de entorno (.env local) ---')
try:
    with open('.env', encoding='utf-8') as f:
        env = f.read()
except FileNotFoundError:
    env = ''
    print('No hay .env en esta carpeta (puede que solo lo tengas en Vercel, eso no lo puedo ver desde aqui).')

linea('LLAVE_SERVIDOR_EMAILS=' in env, 'LLAVE_SERVIDOR_EMAILS')
linea('ELEVENLABS_API_KEY=' in env, 'ELEVENLABS_API_KEY (si aparece, hay que quitarla; se agoto)')
if 'ELEVENLABS_API_KEY=' in env:
    print('  -> OJO: esta puesta. Hay que borrarla de .env y de Vercel.')
linea('TAVILY_API_KEY=' in env, 'TAVILY_API_KEY (para que buscar_web use Tavily en vez de DuckDuckGo)')
linea('MISTRAL_API_KEY=' in env or 'OPENROUTER_API_KEY=' in env, 'Mistral u OpenRouter (llave extra para la rotacion)')

print()
print('--- Archivos del repo (web buscar) ---')
linea(os.path.exists('web_api.py'), 'web_api.py existe')
try:
    srv = open('server.py', encoding='utf-8').read()
except FileNotFoundError:
    srv = ''
linea('import web_api' in srv, 'server.py tiene el parche de buscar_web aplicado')

print()
print('--- SQL ejecutados (solo puedo ver si el archivo existe en el repo, no si lo corriste en Supabase) ---')
for sql in ['supabase_modelos.sql', 'supabase_nexus.sql', 'supabase_archivos_proyecto.sql']:
    linea(os.path.exists(sql), sql + ' (archivo en el repo; confirma tu si ya lo corriste en Supabase)')
