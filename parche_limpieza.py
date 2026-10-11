import os


def leer(r):
    return open(r, encoding='utf-8').read()


def cambiar(ruta, viejo, nuevo):
    s = leer(ruta)
    assert s.count(viejo) == 1, 'No encontre (o esta repetido) en ' + ruta + ': ' + viejo[:50]
    open(ruta, 'w', encoding='utf-8').write(s.replace(viejo, nuevo))


W = '.github/workflows/apk.yml'
cambiar(W, 'runs-on: ubuntu-latest', 'runs-on: ubuntu-24.04')
cambiar(W, 'actions/checkout@v4', 'actions/checkout@v5')
cambiar(W, 'actions/setup-node@v4', 'actions/setup-node@v5')
cambiar(W, 'actions/setup-java@v4', 'actions/setup-java@v5')

R = 'requirements.txt'
vistas = []
for l in [l.strip() for l in leer(R).splitlines() if l.strip()]:
    if l not in vistas:
        vistas.append(l)
open(R, 'w', encoding='utf-8').write('\n'.join(vistas) + '\n')

open('.env.example', 'w', encoding='utf-8').write(
    'GEMINI_API_KEY=\n'
    'GROQ_API_KEY=\n'
    'SUPABASE_URL=\n'
    'SUPABASE_KEY=\n'
    'ELEVENLABS_API_KEY=\n'
    'TAVILY_API_KEY=\n'
    'CF_ACCOUNT_ID=\n'
    'CF_API_TOKEN=\n'
    'PORT=3000\n')

cambiar('supa.py',
        "    destino = request.args.get('redirect', '')\n",
        "    destino = request.args.get('redirect', '')\n"
        "    if destino != 'com.david.jarvis://auth' and urlparse(destino).netloc != request.host:\n"
        "        destino = request.host_url\n")
cambiar('supa.py', 'from urllib.parse import urlencode',
        'from urllib.parse import urlencode, urlparse')

G = '.gitignore'
g = leer(G)
extra = ''
for x in ['memoria.json', 'memorias/', 'recordatorios/', 'jarvis.apk']:
    if x not in g.split('\n'):
        extra += x + '\n'
if g and not g.endswith('\n'):
    g += '\n'
open(G, 'w', encoding='utf-8').write(g + extra)

if os.path.exists('parche_acciones.py'):
    os.remove('parche_acciones.py')
print('Listo: limpieza aplicada')
