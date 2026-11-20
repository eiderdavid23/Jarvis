import os
import time
import hashlib

import requests

import supa

VOZ_ID = os.environ.get('ELEVENLABS_VOICE_ID', '5mlWFbiHqNGO0EZqVyVM')
MAX_LETRAS = 300           # por frase que se manda a ElevenLabs
_bloqueado_hasta = 0.0     # si se acaba el cupo o falla la llave, se descansa un rato
_sesiones = {}             # token (hash) -> (expira, email), para no preguntar a Supabase en cada frase


def _sesion(auth):
    """Devuelve el correo si la sesion es valida, o None."""
    token = auth[7:].strip() if auth.lower().startswith('bearer ') else ''
    if not token:
        return None
    clave = hashlib.sha256(token.encode()).hexdigest()[:16]
    ahora = time.time()
    hit = _sesiones.get(clave)
    if hit and hit[0] > ahora:
        return hit[1]
    try:
        r = requests.get(supa._url() + '/auth/v1/user', headers=supa._headers(token), timeout=10)
    except requests.exceptions.RequestException:
        return None
    if r.status_code != 200:
        return None
    email = (r.json().get('email') or '').lower()
    if len(_sesiones) > 200:
        _sesiones.clear()
    _sesiones[clave] = (ahora + 300, email)
    return email


def _permitido(email):
    lista = [e.strip().lower() for e in os.environ.get('ELEVENLABS_EMAILS', '').split(',') if e.strip()]
    return not lista or email in lista


def generar(texto, vel, auth):
    """Audio mp3 con la voz de ElevenLabs, o None para que Jarvis use su voz de siempre."""
    global _bloqueado_hasta
    llave = os.environ.get('ELEVENLABS_API_KEY', '')
    if not llave or time.time() < _bloqueado_hasta or len(texto) > MAX_LETRAS:
        return None
    email = _sesion(auth or '')
    if email is None or not _permitido(email):
        return None
    try:
        estabilidad = max(0.0, min(1.0, float(os.environ.get('ELEVENLABS_STABILITY', '0.6'))))
    except ValueError:
        estabilidad = 0.6
    ajustes = {'stability': estabilidad, 'similarity_boost': 0.8, 'use_speaker_boost': True,
               'speed': max(0.7, min(1.2, vel))}
    cuerpo = {'text': texto, 'model_id': os.environ.get('ELEVENLABS_MODEL', 'eleven_flash_v2_5'),
              'voice_settings': ajustes, 'language_code': 'es'}
    url = 'https://api.elevenlabs.io/v1/text-to-speech/' + VOZ_ID
    cab = {'xi-api-key': llave, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'}
    intentos = [{'output_format': 'mp3_44100_64'}, None]   # el segundo es el mas sencillo, por si algo no se acepta
    try:
        for i, params in enumerate(intentos):
            if i == 1:
                cuerpo.pop('language_code', None)
            r = requests.post(url, params=params, headers=cab, json=cuerpo, timeout=20)
            if r.status_code == 429:           # demasiadas peticiones a la vez: un reintento corto
                time.sleep(0.6)
                r = requests.post(url, params=params, headers=cab, json=cuerpo, timeout=20)
            if r.status_code == 200 and r.content:
                return r.content
            if r.status_code in (401, 402, 403):   # llave mala, sin permiso o sin creditos
                _bloqueado_hasta = time.time() + 600
                print('[ELEVEN] en pausa 10 min:', r.status_code, r.text[:200])
                return None
            if r.status_code != 400:
                print('[ELEVEN] error', r.status_code, r.text[:200])
                return None
        return None
    except requests.exceptions.RequestException as e:
        print('[ELEVEN] sin conexion:', e)
        return None
