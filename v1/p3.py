R = 'hack_api.py'
s = open(R, encoding='utf-8').read()
fallos = []

def p(ancla, nuevo):
    global s
    if ancla in s:
        s = s.replace(ancla, nuevo + ancla, 1)
    else:
        fallos.append(ancla[:45])

p("    res['nota'] = ('Confirmado: usa peticion_http", "    if res['vulnerable']:\n        _anotar('Inyeccion SQL', 'alta', u, res.get('detalle', ''), res.get('dbms', ''))\n\n")
p("    return {'ok': True, 'url': u, 'parametro': parametro, 'metodo': m,", "    if sin_codificar:\n        _anotar('XSS reflejado', 'media', u, 'parametro ' + parametro, sin_codificar[0])\n\n")
p("    return {'ok': True, 'probadas': len(rutas), 'halladas': hall[:70],", "    for h in hall:\n        if h['ruta'] in ('.env', '.git/HEAD', '.git/config', 'backup.zip', 'backup.sql', 'db.sql', 'dump.sql'):\n            _anotar('Archivo expuesto: ' + h['ruta'], 'alta', u, 'accesible sin sesion', str(h['status']))\n\n")
p("            'servidor': cab.get('Server', '')", "    if faltan:\n        _anotar('Cabeceras de seguridad ausentes', 'baja', u, ', '.join(faltan))\n\n")

if "'extraer_sqli')\n" in s:
    s = s.replace("'extraer_sqli')\n", "'extraer_sqli', 'subir_archivo', 'probar_xss', 'reporte')\n", 1)
else:
    fallos.append('NOMBRES')

marca = "a.get('metodo') or 'GET', a.get('cuerpo'))\n"
if marca in s:
    i = s.index(marca) + len(marca)
    s = s[:i] + ("        if nombre == 'subir_archivo':\n            return subir_archivo(a.get('url'), a.get('campo'), a.get('nombre'), a.get('contenido'), a.get('tipo'), a.get('campos_extra'))\n"
                 "        if nombre == 'probar_xss':\n            return probar_xss(a.get('url'), a.get('parametro'), a.get('metodo'), a.get('cuerpo'))\n"
                 "        if nombre == 'reporte':\n            return reporte(a.get('objetivo'))\n") + s[i:]
else:
    fallos.append('despacho')

if "       ('url', 'parametro', 'dbms')),\n" in s:
    s = s.replace("       ('url', 'parametro', 'dbms')),\n", "       ('url', 'parametro', 'dbms')),\n"
                  "    _e('subir_archivo', 'Sube un archivo de prueba (multipart).', {'url': {'type': 'string'}, 'campo': {'type': 'string'}, 'nombre': {'type': 'string'}, 'contenido': {'type': 'string'}, 'tipo': {'type': 'string'}, 'campos_extra': {'type': 'string'}}, ('url', 'campo')),\n"
                  "    _e('probar_xss', 'Prueba XSS reflejado en un parametro.', {'url': {'type': 'string'}, 'parametro': {'type': 'string'}, 'metodo': {'type': 'string'}, 'cuerpo': {'type': 'string'}}, ('url', 'parametro')),\n"
                  "    _e('reporte', 'Arma el reporte markdown con lo hallado.', {'objetivo': {'type': 'string'}}, ()),\n", 1)
else:
    fallos.append('esquema')

open(R, 'w', encoding='utf-8').write(s)
print('FALLOS:', fallos if fallos else 'ninguno')
