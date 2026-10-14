import os, shutil, sys

RESP = os.path.expanduser('~/respaldo_menu_cuenta')
os.makedirs(RESP, exist_ok=True)

CAMBIOS = [
    ('server.py', 'import llaves_api\n', 'import llaves_api\nimport memoria_api\n', 'import memoria_api'),
    ('server.py', 'app.register_blueprint(llaves_api.bp)\n',
     'app.register_blueprint(llaves_api.bp)\napp.register_blueprint(memoria_api.bp)\n', 'register_blueprint(memoria_api.bp)'),
    ('public/auth.js', "String(url).indexOf('/llave') === 0) return api(url, opts);",
     "String(url).indexOf('/llave') === 0 || String(url).indexOf('/memorias') === 0) return api(url, opts);", "'/memorias'"),
    ('public/index.html', '<link rel="stylesheet" href="/ajustes_nuevo.css">\n',
     '<link rel="stylesheet" href="/ajustes_nuevo.css">\n<link rel="stylesheet" href="/menu_cuenta.css">\n', '/menu_cuenta.css'),
    ('public/index.html', '<script src="/ajustes_nuevo.js"></script>\n',
     '<script src="/ajustes_nuevo.js"></script>\n<script src="/menu_cuenta.js"></script>\n', '/menu_cuenta.js'),
]

for ruta in ('memoria_api.py', 'public/menu_cuenta.css', 'public/menu_cuenta.js'):
    if not os.path.exists(ruta):
        sys.exit('Falta ' + ruta + ': no toqué nada.')

guardados = set()
for ruta, viejo, nuevo, marca in CAMBIOS:
    with open(ruta, encoding='utf-8') as f:
        txt = f.read()
    if marca in txt:
        print('ya estaba:', ruta, '->', marca)
        continue
    if txt.count(viejo) != 1:
        sys.exit('No encontré un punto único en ' + ruta + ' para: ' + marca + '. No toqué ese archivo.')
    if ruta not in guardados:
        shutil.copy(ruta, os.path.join(RESP, ruta.replace('/', '_')))
        guardados.add(ruta)
    with open(ruta, 'w', encoding='utf-8') as f:
        f.write(txt.replace(viejo, nuevo))
    print('ok:', ruta, '->', marca)

print('Listo. Copias en', RESP)
