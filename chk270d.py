import sys, json, re
from urllib.parse import urlencode
import hack_api as H, intruso_api as I

BASE = 'https://app-landing-270-grados-dgbedwcgaxcdavc2.eastus2-01.azurewebsites.net'
LOGIN, EDIT = BASE + '/Auth/Login', BASE + '/Cuenta/Editar'
alias, clave = sys.argv[1], sys.argv[2]

def estado(html):
    d = {}
    for m in re.findall(r'<input[^>]*>', html or '', re.I):
        n = re.search(r'name=["\']([^"\']+)', m, re.I)
        if n:
            d[n.group(1)] = 'checked' in m.lower()
    return d

def menu():
    r, e = H._pedir(BASE + '/Dashboard/Home')
    return [] if e else I._enlaces(r.text, r.url)

r = I.entrar(LOGIN, alias, clave, campo_extra='Recordarme=true')
print('login:', r.get('ok'))
if not r.get('ok'):
    sys.exit('no entro')

m_antes = menu()
c, e = H._pedir(EDIT)
if e:
    sys.exit(e)
antes = estado(c.text)
print('\n=== INTERRUPTORES ANTES ===')
print(json.dumps({k: v for k, v in antes.items() if k != '__RequestVerificationToken'}, indent=1))

cuerpo = dict(H._ocultos(c.text))
for m in re.findall(r'<input[^>]*>', c.text, re.I):
    n = re.search(r'name=["\']([^"\']+)', m, re.I)
    if not n or 'checkbox' not in m.lower():
        continue
    v = re.search(r'value=["\']([^"\']*)', m, re.I)
    cuerpo[n.group(1)] = v.group(1) if v else 'true'
r2, e2 = H._pedir(EDIT, 'POST',
                  {'Content-Type': 'application/x-www-form-urlencoded', 'Referer': EDIT},
                  urlencode(cuerpo))
print('\npost:', r2.status_code if r2 is not None else e2)

c3, _ = H._pedir(EDIT)
despues = estado(c3.text)
cambiados = {k: v for k, v in despues.items() if k != '__RequestVerificationToken' and antes.get(k) != v}
print('\n=== CAMBIADOS (antes -> despues) ===')
print(json.dumps({k: [antes.get(k), despues.get(k)] for k in cambiados}, indent=1))
print('total activados ahora:', sum(1 for k, v in despues.items() if v and k != '__RequestVerificationToken'))

m_despues = menu()
print('\n=== MENU NUEVO ===')
for x in m_despues:
    if x not in m_antes:
        print(' +', x)
print('\n=== MENU COMPLETO ===')
for x in m_despues:
    print('  ', x)
print('\nFIN')
