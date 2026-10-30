import shutil
RUTA = 'CONTEXTO_JARVIS.md'
shutil.copy(RUTA, RUTA + '.bak')
L = open(RUTA, encoding='utf-8').read().split('\n')

i4 = next(i for i, l in enumerate(L) if l.startswith('## 4.'))
j = i4 - 1
while j >= 0 and (L[j].strip() == '' or L[j].strip() == '---'):
    j -= 1
HIST = ('- **30 oct 2026**: NEXUS23 se integra a Jarvis. Decisión: NEXUS23 (centro de mando de plataformas, antes en '
        'Firebase) pasa a ser la página principal `/nexus` de este mismo proyecto, con Jarvis como panel de IA a la '
        'derecha; comparte dominio de Vercel, sesión de Supabase y APK. Se empieza de cero (el NEXUS23 de Firebase se '
        'archiva). Paso 1: `supabase_nexus.sql` con las tablas `nexus_perfiles` (rol admin/usuario y estado '
        'pendiente/aprobado), `nexus_plataformas` (dueno_id vacío = global) y `nexus_asignaciones`, con RLS. Los '
        'usuarios de Jarvis NO entran a Nexus hasta que el admin los apruebe; eiderdavidgarcia23@gmail.com queda como '
        'admin. Probado en un Postgres local con tres usuarios (auto-aprobación, plataformas ajenas y URL '
        '`javascript:` quedan bloqueadas). Falta ejecutarlo en Supabase.')
L.insert(j + 1, HIST)

k = next(i for i, l in enumerate(L) if l.startswith('0c.'))
L.insert(k + 1, '0d. NEXUS23 en Jarvis: paso 2 `nexus_api.py` (+1 línea en `server.py`), paso 3 página `/nexus`, paso 4 '
                'herramientas `listar_plataformas` y `abrir_plataforma`, paso 5 modo panel de Jarvis a la derecha, '
                'paso 6 resumen diario, línea de tiempo y automatizaciones.')
open(RUTA, 'w', encoding='utf-8').write('\n'.join(L))
print('Contexto actualizado (copia en CONTEXTO_JARVIS.md.bak)')
