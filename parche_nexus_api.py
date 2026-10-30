import shutil
for r in ('server.py', 'CONTEXTO_JARVIS.md'):
    shutil.copy(r, r + '.bak')

s = open('server.py', encoding='utf-8').read()
a, b = 'import memoria_api\n', 'app.register_blueprint(memoria_api.bp)\n'
assert s.count(a) == 1 and s.count(b) == 1, 'server.py: no encontre las lineas esperadas'
s = s.replace(a, a + 'import nexus_api\n').replace(b, b + 'app.register_blueprint(nexus_api.bp)\n')
open('server.py', 'w', encoding='utf-8').write(s)
print('server.py: nexus_api registrado')

L = open('CONTEXTO_JARVIS.md', encoding='utf-8').read().split('\n')
j = next(i for i, l in enumerate(L) if l.startswith('## 4.')) - 1
while j >= 0 and L[j].strip() in ('', '---'):
    j -= 1
L.insert(j + 1, '- **30 oct 2026**: NEXUS paso 2, `nexus_api.py` (blueprint registrado en `server.py`). Rutas con sesión: '
    '`GET /nexus/yo`, `POST /nexus/solicitar`, `GET/POST /nexus/plataformas`, `PATCH/DELETE /nexus/plataformas/<id>`, '
    '`GET /nexus/usuarios`, `PATCH/DELETE /nexus/usuarios/<uid>`, `GET /nexus/asignaciones/<uid>` y '
    '`PUT/DELETE /nexus/asignaciones/<uid>/<pid>`. Los permisos reales los pone la base (RLS); el servidor valida '
    'datos y URL http(s), y nadie puede cambiar o borrar su propia cuenta desde el panel. Si falta el SQL responde '
    '"Falta ejecutar supabase_nexus.sql".')
L = [l.replace('paso 2 `nexus_api.py` (+1 línea en `server.py`), ', '') for l in L]
open('CONTEXTO_JARVIS.md', 'w', encoding='utf-8').write('\n'.join(L))
print('Contexto actualizado')
