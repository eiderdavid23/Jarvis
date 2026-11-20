"""Narracion tecnica en vivo del modo seguridad.

Una linea por accion, con el dato que devolvio la herramienta.
No ejecuta nada ni cambia nada: solo describe lo que ya paso.
"""
import re
from urllib.parse import urlparse

MAX = 90


def _sitio(u):
    try:
        p = urlparse(u if '://' in str(u) else 'https://' + str(u))
        host = (p.hostname or '?').replace('www.', '')
        return (host + (p.path or '/'))[:60]
    except Exception:
        return '?'


def _peso(x):
    n = len(x or '') if isinstance(x, str) else 0
    return f'{n} B' if n < 1024 else f'{n / 1024:.1f} KB'


def _corta(v, n=48):
    t = re.sub(r'\s+', ' ', str(v if v is not None else '')).strip()
    return t if len(t) <= n else t[:n] + '…'


def _lista(v, n=6):
    if not v:
        return 'ninguna'
    if not isinstance(v, list):
        return _corta(v)
    return ', '.join(_corta(x, 24) for x in v[:n]) or 'ninguna'


def hallazgo(tipo, sev, url, detalle):
    return f'Hallazgo {str(sev).upper()}: {tipo} — {_corta(detalle, 70)} [{_sitio(url)}]'


def _huella(a, r):
    if not r.get('ok'):
        return [f'Sin respuesta de {_sitio(a.get("url"))}']
    return [f'Huella: {_sitio(a.get("url"))}',
            f'Servidor: {r.get("servidor") or "?"} · tecnología: {_lista(r.get("tecnologias"), 4)} · '
            f'cabeceras faltantes: {len(r.get("cabeceras_faltan") or [])} · formularios: {len(r.get("formularios") or [])}']


def _peticion(a, r):
    if not r.get('ok'):
        return [f'{str(a.get("metodo") or "GET").upper()} {_sitio(a.get("url"))}',
                f'Sin respuesta: {_corta(r.get("error"))}']
    return [f'{str(a.get("metodo") or "GET").upper()} {_sitio(a.get("url"))}',
            f'→ {r.get("status")} · {_peso(r.get("cuerpo"))} · final: {_sitio(r.get("url_final"))}']


def _rutas(a, r):
    if not r.get('ok'):
        return [f'Sin respuesta al fuzzear {_sitio(a.get("url"))}']
    return [f'Fuzzeando {r.get("probadas", 0)} rutas en {_sitio(a.get("url"))}',
            f'→ {len(r.get("halladas") or [])} rutas con contenido distinto: '
            f'{_lista([h.get("ruta") for h in (r.get("halladas") or [])])}']


def _js(a, r):
    if not r.get('ok'):
        return [f'Sin respuesta leyendo JavaScript de {_sitio(a.get("url"))}']
    return [f'Leyendo JavaScript de {_sitio(a.get("url"))}',
            f'→ {r.get("archivos", 0)} archivos · {len(r.get("endpoints") or [])} endpoints · '
            f'{len(r.get("secretos") or [])} secretos']


def _jwt_leer(a, r):
    if not r.get('ok'):
        return [f'JWT ilegible: {_corta(r.get("error"))}']
    return [f'JWT decodificado: alg={r.get("algoritmo") or "?"}',
            f'→ sin firma: {"sí" if r.get("sin_firma") else "no"} · secreto débil: {_lista(r.get("secreto_debil"), 3)}']


def _jwt_forjar(a, r):
    if not r.get('ok'):
        return [f'No pude forjar el JWT: {_corta(r.get("error"))}']
    return [f'Forjando JWT: {_corta(a.get("cambios") or "sin cambios")}',
            f'→ {_corta(r.get("token"), 60)}']


def _idor(a, r):
    if not r.get('ok'):
        return [f'IDOR imposible en {_sitio(a.get("url"))}: {_corta(r.get("error"))}']
    distintos = [f for f in (r.get('filas') or []) if f.get('distinto')]
    return [f'IDOR sobre {_corta(r.get("patron"), 60)} rango {r.get("rango")}',
            f'→ {len(distintos)} respuestas con contenido ajeno']


def _sqli(a, r):
    if not r.get('ok'):
        return [f'SQLi imposible en {_corta(a.get("parametro"))}: {_corta(r.get("error"))}']
    lineas = [f'Inyectando en «{a.get("parametro")}» ({r.get("metodo")})',
              f'→ {"VULNERABLE" if r.get("vulnerable") else "sin confirmar"} · '
              f'error: {r.get("error_bd") or "no"} · booleana: {len(r.get("boolean") or [])} · '
              f'tiempo: {_corta(r.get("tiempo"))}']
    if r.get('detalle'):
        lineas.append(_corta(r['detalle']))
    return lineas


def _extraer(a, r):
    if not r.get('ok'):
        return [f'Extracción {a.get("que")} falló: {_corta(r.get("error"))}']
    return [f'Extrayendo {a.get("que")} ({r.get("dbms")}) desde {a.get("desde")}',
            f'→ {r.get("segundos")}s · "{_corta(r.get("texto"), 70)}" · corte: {_corta(r.get("corte")) or "no"}']


def _union(a, r):
    if not r.get('ok'):
        return [f'UNION falló: {_corta(r.get("error"))}']
    return [f'UNION: {r.get("columnas")} columnas, reflejadas {r.get("reflejadas")}',
            f'→ "{_corta(r.get("texto"), 70)}"']


def _xss(a, r):
    if not r.get('ok'):
        return [f'XSS imposible en {_corta(a.get("parametro"))}']
    return [f'XSS en «{a.get("parametro")}» ({r.get("metodo")})',
            f'→ reflejado sin codificar: {_lista(r.get("reflejado_sin_codificar"), 2)}']


def _ssrf(a, r):
    if not r.get('ok'):
        return [f'SSRF imposible en {_corta(a.get("parametro"))}']
    return [f'SSRF en «{a.get("parametro")}»',
            f'→ {len(r.get("hits") or [])} destinos internos aceptados: '
            f'{_lista([h.get("prueba") for h in (r.get("hits") or [])], 4)}']


def _cors(a, r):
    if not r.get('ok'):
        return [f'CORS sin respuesta en {_sitio(a.get("url"))}']
    return [f'CORS con Origin ajeno',
            f'→ severidad {r.get("severidad")} · {_corta(r.get("hallazgo"), 70)}']


def _subida(a, r):
    return [f'Subiendo {a.get("nombre") or "prueba.txt"} ({a.get("tipo") or "text/plain"}) en «{a.get("campo")}»',
            f'→ {r.get("status")} · aceptado: {"sí" if r.get("ok") else "no"} · {_peso(r.get("muestra"))}']


def _hash(a, r):
    if not r.get('ok'):
        return [f'Hash no reconocido: {_corta(r.get("error"))}']
    return [f'Rompiendo {r.get("algoritmo")} {_corta(a.get("hash"), 20)}',
            f'→ clave: {r.get("clave") or "no está en la lista"} · {r.get("probadas")} pruebas']


def _puertos(a, r):
    if not r.get('ok'):
        return [f'Host inválido: {_corta(r.get("error"))}']
    return [f'Puertos TCP en {r.get("host")} ({r.get("probados")} probados)',
            f'→ abiertos: {_lista(r.get("abiertos"), 10)} · {r.get("segundos")}s']


def _subdominios(a, r):
    if not r.get('ok'):
        return [f'Dominio inválido: {_corta(r.get("error"))}']
    return [f'Subdominios de {r.get("dominio")}: {r.get("probados")} candidatos',
            f'→ vivos: {_lista([v.get("subdominio") for v in (r.get("vivos") or [])], 6)}']


def _cert(a, r):
    if not r.get('ok'):
        return [f'Certificado ilegible: {_corta(r.get("error"))}']
    return [f'Certificado: emisor {r.get("emisor") or "?"}',
            f'→ vence {r.get("hasta") or "?"} · nombres: {_lista(r.get("nombres"), 4)}']


def _dns(a, r):
    if not r.get('ok'):
        return [f'DNS inválido: {_corta(r.get("error"))}']
    return [f'DNS de {r.get("dominio")}: {_lista(list((r.get("registros") or {}).keys()), 6)}']


def _detectar(a, r):
    if not r.get('ok'):
        return [f'Login en {_sitio(a.get("url"))}',
                f'→ {_corta(r.get("error"))}']
    return [f'Login en {_sitio(a.get("url"))}: {r.get("metodo")}',
            f'→ campos {r.get("usuario")}/{r.get("clave")} · CSRF: {"sí" if r.get("csrf") else "no"} · '
            f'accion {_sitio(r.get("accion"))}']


def _entrar(a, r):
    return [f'Entrando como {a.get("usuario")} en {_sitio(a.get("url"))}',
            f'→ {"DENTRO" if r.get("ok") else "rechazado"} · {r.get("status")} · '
            f'final {_sitio(r.get("url_final"))}']


def _navegar(a, r):
    if not r.get('ok'):
        return [f'Navegación falló: {_corta(r.get("error"))}']
    return [f'Navegando {a.get("profundidad") or 1} nivel(es) con la sesión',
            f'→ {r.get("revisadas")} páginas · paneles: {_lista(r.get("interesantes"), 4)}']


def _usuarios(a, r):
    if not r.get('ok'):
        return [f'No pude sacar usuarios: {_corta(r.get("error"))}']
    return [f'Sacando usuarios de {_sitio(a.get("url"))}',
            f'→ {r.get("total_filas")} filas · {len(r.get("correos") or [])} correos']


def _formulario(a, r):
    return [f'POST {_sitio(a.get("url"))}',
            f'datos: {_corta(a.get("datos"), 60)} → {r.get("status")} · ok: {"sí" if r.get("ok") else "no"}']


def _claves(a, r):
    if not r.get('ok'):
        return [f'Fuerza bruta no arrancó: {_corta(r.get("error"))}']
    return [f'Fuerza bruta sobre {a.get("usuario")} ({r.get("probadas")} claves)',
            f'→ clave: {r.get("encontrada") or "no encontrada"}']


def _auth(a, r):
    return [f'{str(a.get("metodo") or "GET").upper()} {_sitio(a.get("url"))} con sesión',
            f'→ {r.get("status")} · autenticado: {"sí" if r.get("autenticado") else "no"}']


def _mapa(a, r):
    return [f'Estado: {r.get("usuario") or "sin usuario"} en {_sitio(r.get("base"))}',
            f'→ autenticado: {"sí" if r.get("autenticado") else "no"} · vistas: {len(r.get("vistas") or [])}']


def _panel(a, r):
    if not r.get('ok'):
        return [f'Forzado de panel falló: {_corta(r.get("error"))}']
    return [f'Probando {r.get("probadas")} rutas de admin con rol bajo',
            f'→ abren: {_lista([f.get("ruta") for f in (r.get("abiertas") or [])], 6)}',
            f'→ SIN validar rol: {_lista(r.get("rotas"), 6)}']


def _cookies(a, r):
    if not r.get('ok'):
        return [f'Cookies ilegibles: {_corta(r.get("error"))}']
    return [f'Cookies con datos de rol: {_lista([c.get("nombre") for c in (r.get("cookies") or [])], 5)}',
            f'→ pistas: {_lista([p for c in (r.get("cookies") or []) for p in (c.get("pistas") or [])], 6)}']


def _tamper(a, r):
    return [f'Cookie {a.get("nombre")}={_corta(a.get("valor"), 40)}',
            f'→ antes: {r.get("antes")} · después: {r.get("despues")} · logrado: {"SÍ" if r.get("logrado") else "no"}']


def _masivo(a, r):
    if not r.get('ok'):
        return [f'Asignación masiva no arrancó: {_corta(r.get("error"))}']
    return [f'Asignación masiva en {_sitio(a.get("url_perfil"))}: {_corta(a.get("datos") or "campos de rol", 50)}',
            f'→ {r.get("intentos")} intentos · logrado: {"SÍ" if r.get("logrado") else "no"}'
            + (f' con {r.get("campo")}={r.get("valor")}' if r.get("campo") else '')]


def _api(a, r):
    return [f'{str(a.get("metodo") or "GET").upper()} {_sitio(a.get("url"))} (JSON)',
            f'→ {r.get("status")} · json: {"sí" if r.get("json") is not None else "no"} · {_peso(r.get("cuerpo"))}']


def _volcar(a, r):
    if not r.get('ok'):
        return [f'Volcado de API falló: {_corta(r.get("error"))}']
    return [f'Volcando API {_sitio(a.get("url"))}',
            f'→ {r.get("total")} registros · claves: {_lista(r.get("claves"), 8)}']


def _correos(a, r):
    if not r.get('ok'):
        return [f'Sondeo de correos falló: {_corta(r.get("error"))}']
    return [f'Sondeando {r.get("probados")} correos',
            f'→ registrados: {_lista(r.get("existen"), 6)}']


def _cadena(a, r):
    if not r.get('ok'):
        return [f'Cadena de escalada falló: {_corta(r.get("error"))}']
    vias = [x.get('via') for x in (r.get('detalle') or [])]
    return [f'Cadena completa sobre {_sitio(a.get("base"))}',
            f'→ ganado: {"SÍ" if r.get("ganado") else "no"} · vías: {_lista(vias, 5)}']


def _reporte(a, r):
    return [f'Armando reporte: {r.get("total", 0)} hallazgos']


PLANTILLAS = {
    'huella_web': _huella, 'peticion_http': _peticion, 'enumerar_rutas': _rutas,
    'analizar_js': _js, 'decodificar_jwt': _jwt_leer, 'forjar_jwt': _jwt_forjar,
    'probar_idor': _idor, 'probar_sqli': _sqli, 'extraer_sqli': _extraer,
    'extraer_union': _union, 'probar_xss': _xss, 'probar_ssrf': _ssrf,
    'probar_cors': _cors, 'subir_archivo': _subida, 'romper_hash': _hash,
    'escanear_puertos': _puertos, 'enumerar_subdominios': _subdominios,
    'ver_certificado': _cert, 'dns_registros': _dns, 'detectar_login': _detectar,
    'entrar': _entrar, 'navegar': _navegar, 'sacar_usuarios': _usuarios,
    'enviar_formulario': _formulario, 'probar_claves': _claves,
    'peticion_auth': _auth, 'mapa': _mapa, 'forzar_panel': _panel,
    'decodificar_cookie': _cookies, 'tamper_cookie': _tamper,
    'probar_masivo': _masivo, 'api_json': _api, 'sacar_api': _volcar,
    'sondeo_correos': _correos, 'escalada_auto': _cadena, 'reporte': _reporte,
}


def tiene(nombre):
    return nombre in PLANTILLAS


def narrar(nombre, argumentos, resultado):
    """Lineas para el usuario. Nunca lanza: si algo falla, devuelve una generica."""
    try:
        f = PLANTILLAS.get(nombre)
        if not f or not isinstance(resultado, dict):
            return []
        return [x for x in f(argumentos or {}, resultado) if x][:3]
    except Exception:
        return [f'{nombre}: {_corta(argumentos, 60)}']
