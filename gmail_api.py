"""Gmail por la API de Google (OAuth). Reemplaza IMAP/SMTP y la contrasena de aplicacion.
Este modulo no toca Supabase: recibe los datos del usuario ({'refresh_token': ...}) y habla con Google.
Permisos que se piden: gmail.readonly (leer) y gmail.compose (crear borradores y enviar).
Variables del servidor: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (y, si hace falta, GOOGLE_REDIRECT_URI)."""
import base64
import hashlib
import html
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from email.message import EmailMessage
from urllib.parse import urlencode

import requests

URL_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
URL_TOKEN = 'https://oauth2.googleapis.com/token'
API = 'https://gmail.googleapis.com/gmail/v1/users/me'
ALCANCES = ('https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.compose')
VER_BORRADORES = 'https://mail.google.com/mail/u/0/#drafts'
_CACHE = {}   # huella del refresh token -> (access token, vence). Solo ahorra llamadas dentro del mismo proceso.


class ErrorGmail(Exception):
    """Error esperado: el mensaje se le devuelve a la IA y al usuario."""


def _cliente():
    return os.environ.get('GOOGLE_CLIENT_ID', '').strip(), os.environ.get('GOOGLE_CLIENT_SECRET', '').strip()


def configurado():
    i, s = _cliente()
    return bool(i and s)


def url_autorizacion(redirect_uri, estado):
    i, _ = _cliente()
    return URL_AUTH + '?' + urlencode({
        'client_id': i, 'redirect_uri': redirect_uri, 'response_type': 'code', 'scope': ' '.join(ALCANCES),
        'access_type': 'offline', 'prompt': 'consent', 'include_granted_scopes': 'true', 'state': estado})


def _post_token(cuerpo):
    i, s = _cliente()
    try:
        r = requests.post(URL_TOKEN, data={**cuerpo, 'client_id': i, 'client_secret': s}, timeout=15)
    except requests.exceptions.RequestException:
        raise ErrorGmail('No pude hablar con Google ahora. Intente en un momento.')
    try:
        d = r.json()
    except ValueError:
        d = {}
    if r.status_code != 200:
        if d.get('error') == 'invalid_grant':
            raise ErrorGmail('El permiso de Google venció o fue retirado. Toque «Conectar con Google» otra vez.')
        print('[GMAIL] token', r.status_code, d.get('error'), d.get('error_description'))
        raise ErrorGmail('Google rechazó la conexión (' + str(d.get('error') or r.status_code) + '). '
                         'Revise el ID y el secreto de cliente y el enlace de retorno.')
    return d


def canjear_codigo(codigo, redirect_uri):
    """Cambia el codigo que devuelve Google por el refresh token. Comprueba que se marcaron los permisos."""
    d = _post_token({'grant_type': 'authorization_code', 'code': codigo, 'redirect_uri': redirect_uri})
    dados = set((d.get('scope') or '').split())
    if not set(ALCANCES) <= dados:
        raise ErrorGmail('Faltaron permisos: en la pantalla de Google marque todas las casillas de Gmail y vuelva a intentar.')
    if not d.get('refresh_token'):
        raise ErrorGmail('Google no entregó el permiso permanente. Quite el acceso de Jarvis en '
                         'myaccount.google.com/permissions y conecte de nuevo.')
    _guardar_cache(d['refresh_token'], d.get('access_token'), d.get('expires_in'))
    return d['refresh_token']


def _huella(refresh):
    return hashlib.sha256(refresh.encode()).hexdigest()[:16]


def _guardar_cache(refresh, token, segundos):
    if token:
        _CACHE[_huella(refresh)] = (token, time.time() + int(segundos or 3600) - 60)


def _token(datos, renovar=False):
    refresh = datos.get('refresh_token') or ''
    if not refresh:
        raise ErrorGmail('Gmail no está conectado con Google.')
    en_cache = _CACHE.get(_huella(refresh))
    if en_cache and not renovar and en_cache[1] > time.time():
        return en_cache[0]
    d = _post_token({'grant_type': 'refresh_token', 'refresh_token': refresh})
    _guardar_cache(refresh, d.get('access_token'), d.get('expires_in'))
    return d['access_token']


def _api(datos, metodo, ruta, params=None, cuerpo=None, token=None):
    for intento in (1, 2):
        t = token if (token and intento == 1) else _token(datos, renovar=intento == 2)
        try:
            r = requests.request(metodo, API + ruta, params=params, json=cuerpo, timeout=15,
                                 headers={'Authorization': 'Bearer ' + t})
        except requests.exceptions.RequestException:
            raise ErrorGmail('No pude hablar con Gmail ahora. Intente en un momento.')
        if r.status_code == 401 and intento == 1:
            continue
        break
    if r.status_code >= 400:
        texto = r.text[:400]
        print('[GMAIL]', metodo, ruta, r.status_code, texto)
        if r.status_code == 403 and ('accessNotConfigured' in texto or 'has not been used' in texto):
            raise ErrorGmail('La Gmail API no está activada en su proyecto de Google Cloud (Biblioteca de APIs > Gmail API > Habilitar).')
        if r.status_code in (401, 403):
            raise ErrorGmail('Google no dio permiso para eso. Toque «Conectar con Google» y marque todas las casillas.')
        if r.status_code == 404:
            raise ErrorGmail('Ese correo ya no existe en Gmail.')
        if r.status_code == 429:
            raise ErrorGmail('Gmail pide esperar un momento. Intente en un minuto.')
        raise ErrorGmail('Gmail respondió con un error (' + str(r.status_code) + ').')
    return r.json() if r.text else {}


def perfil(datos):
    return (_api(datos, 'GET', '/profile').get('emailAddress') or '').strip()


# ---------------------------------------------------------------- lectura
def _cabeceras(msg):
    return {(h.get('name') or '').lower(): h.get('value') or '' for h in (msg.get('payload') or {}).get('headers') or []}


def _resumen(msg):
    h = _cabeceras(msg)
    return {'id': msg.get('id'), 'hilo': msg.get('threadId'), 'de': h.get('from', '')[:120],
            'asunto': h.get('subject', '')[:150], 'fecha': h.get('date', '')[:31],
            'inicio': html.unescape(msg.get('snippet') or '')[:350],
            'no_leido': 'UNREAD' in (msg.get('labelIds') or [])}


def listar(datos, cantidad=5, solo_no_leidos=True, buscar=''):
    q = 'in:inbox' + (' is:unread' if solo_no_leidos else '')
    buscar = ' '.join(str(buscar or '').split())[:100]
    if buscar:
        q += ' ' + buscar
    token = _token(datos)
    ids = _api(datos, 'GET', '/messages', {'q': q, 'maxResults': cantidad}, token=token).get('messages') or []

    def uno(m):
        return _resumen(_api(datos, 'GET', '/messages/' + m['id'], {
            'format': 'metadata', 'metadataHeaders': ['From', 'Subject', 'Date']}, token=token))
    with ThreadPoolExecutor(max_workers=5) as pool:
        return list(pool.map(uno, ids))


def _decodificar(b64):
    return base64.urlsafe_b64decode(b64 + '=' * (-len(b64) % 4)).decode('utf-8', 'replace')


def _buscar_parte(parte, mime):
    if parte.get('mimeType') == mime and (parte.get('body') or {}).get('data'):
        return _decodificar(parte['body']['data'])
    for p in parte.get('parts') or []:
        t = _buscar_parte(p, mime)
        if t:
            return t
    return ''


def _cuerpo(msg):
    raiz = msg.get('payload') or {}
    texto = _buscar_parte(raiz, 'text/plain')
    if not texto:
        crudo = _buscar_parte(raiz, 'text/html')
        crudo = re.sub(r'(?is)<(script|style).*?</\1>', ' ', crudo)
        texto = html.unescape(re.sub(r'<[^>]+>', ' ', crudo))
    return ' '.join(texto.split())[:3000]


def leer_uno(datos, id_correo):
    if not re.match(r'^[0-9a-zA-Z]{6,40}$', id_correo or ''):
        raise ErrorGmail('El id del correo no es válido.')
    msg = _api(datos, 'GET', '/messages/' + id_correo, {'format': 'full'})
    return {**_resumen(msg), 'texto': _cuerpo(msg)}


# ---------------------------------------------------------------- escritura
def _crudo(para, asunto, cuerpo, responder_a=None):
    msg = EmailMessage()
    msg['To'], msg['Subject'] = para, asunto
    if responder_a:
        if responder_a.get('mid'):
            msg['In-Reply-To'] = responder_a['mid']
            msg['References'] = (responder_a.get('refs', '') + ' ' + responder_a['mid']).strip()
    msg.set_content(cuerpo)
    return base64.urlsafe_b64encode(msg.as_bytes()).decode()


def _hilo(datos, id_correo):
    """Cabeceras para responder dentro de la misma conversacion."""
    if not id_correo:
        return None
    if not re.match(r'^[0-9a-zA-Z]{6,40}$', id_correo):
        raise ErrorGmail('El id del correo al que responde no es válido.')
    m = _api(datos, 'GET', '/messages/' + id_correo, {
        'format': 'metadata', 'metadataHeaders': ['Message-ID', 'References']})
    h = _cabeceras(m)
    return {'mid': h.get('message-id', ''), 'refs': h.get('references', ''), 'hilo': m.get('threadId')}


def crear_borrador(datos, para, asunto, cuerpo, responder_a=None):
    hilo = _hilo(datos, responder_a)
    mensaje = {'raw': _crudo(para, asunto, cuerpo, hilo)}
    if hilo and hilo.get('hilo'):
        mensaje['threadId'] = hilo['hilo']
    d = _api(datos, 'POST', '/drafts', cuerpo={'message': mensaje})
    return {'id_borrador': d.get('id'), 'ver_en': VER_BORRADORES}


def enviar(datos, para, asunto, cuerpo, responder_a=None):
    hilo = _hilo(datos, responder_a)
    mensaje = {'raw': _crudo(para, asunto, cuerpo, hilo)}
    if hilo and hilo.get('hilo'):
        mensaje['threadId'] = hilo['hilo']
    _api(datos, 'POST', '/messages/send', cuerpo=mensaje)


def revocar(datos):
    """Le dice a Google que ya no vale el permiso (al desconectar). Si falla no pasa nada."""
    try:
        requests.post('https://oauth2.googleapis.com/revoke', data={'token': datos.get('refresh_token', '')}, timeout=10)
    except requests.exceptions.RequestException:
        pass
    _CACHE.pop(_huella(datos.get('refresh_token') or ''), None)
