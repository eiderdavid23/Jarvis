#!/usr/bin/env python3
"""Agente de Jarvis para una Android TV / Google TV (corre en Termux, en el celular).
Igual que agente_pc.py: SOLO pregunta a Jarvis por ordenes; el servidor nunca se conecta a tu TV.
Solo hace acciones de una lista fija (volumen, teclas del control, abrir apps, encender y apagar).

Instalar (una vez):  pkg install python python-cryptography && pip install androidtvremote2 requests
Emparejar (una vez): python agente_tv.py --ip 10.0.0.43 --emparejar     (sale un codigo en la TV)
Vincular y correr:   python agente_tv.py --url https://TU-JARVIS.vercel.app --token EL_TOKEN
Despues:             python agente_tv.py
Dejarlo vivo:        termux-wake-lock && nohup python agente_tv.py > tv.log 2>&1 &
Consejo: en el router reserva la IP de la TV para que no cambie.
"""
import argparse
import asyncio
import json
import os
import re
import sys
import time
import unicodedata
from datetime import datetime
from pathlib import Path

try:
    import requests
except ImportError:
    print('Falta requests. Instalala con: pip install requests')
    sys.exit(1)

try:
    from androidtvremote2 import AndroidTVRemote, CannotConnect, ConnectionClosed, InvalidAuth
except ImportError:
    AndroidTVRemote = None

    class CannotConnect(Exception):
        pass

    class ConnectionClosed(Exception):
        pass

    class InvalidAuth(Exception):
        pass

CONFIG = Path.home() / '.jarvis_tv.json'
CERT = Path.home() / '.jarvis_tv_cert.pem'
LLAVE = Path.home() / '.jarvis_tv_key.pem'
EXTRAS = Path.home() / '.jarvis_tv_apps.json'
CFG = {'url': '', 'token': '', 'ip': ''}
NOMBRE_CLIENTE = 'Jarvis'


class Fallo(Exception):
    pass


def aviso(texto):
    print('[%s] %s' % (datetime.now().strftime('%H:%M:%S'), texto), flush=True)


def limpio(t):
    t = unicodedata.normalize('NFD', str(t or '').lower())
    return ''.join(c for c in t if unicodedata.category(c) != 'Mn').strip()


# ---- Teclas y apps (lista fija) -------------------------------------------------
# Codigos de tecla de Android (KeyEvent). Solo estas teclas se pueden pulsar.
TECLAS = {
    'inicio': 3, 'atras': 4, 'arriba': 19, 'abajo': 20, 'izquierda': 21, 'derecha': 22, 'ok': 23,
    'enter': 66, 'menu': 82, 'buscar': 84, 'play_pausa': 85, 'parar': 86, 'siguiente': 87, 'anterior': 88,
    'adelantar': 90, 'retroceder': 89, 'play': 126, 'pausa': 127, 'canal_mas': 166, 'canal_menos': 167,
    'info': 165, 'entrada': 178, 'ajustes': 176, 'guia': 172,
}
ALIAS_TECLA = {
    'home': 'inicio', 'back': 'atras', 'volver': 'atras', 'up': 'arriba', 'down': 'abajo', 'left': 'izquierda',
    'right': 'derecha', 'select': 'ok', 'aceptar': 'ok', 'centro': 'ok', 'settings': 'ajustes',
    'configuracion': 'ajustes', 'input': 'entrada', 'fuente': 'entrada', 'pausar': 'pausa', 'reproducir': 'play',
    'playpause': 'play_pausa', 'siguiente_canal': 'canal_mas', 'canal_arriba': 'canal_mas',
    'canal_abajo': 'canal_menos', 'next': 'siguiente', 'previous': 'anterior', 'stop': 'parar',
}
K_POWER, K_VOL_MAS, K_VOL_MENOS, K_MUTE = 26, 24, 25, 164

# nombre: enlace que entiende la TV (https://... o market://launch?id=PAQUETE)
APPS = {
    'youtube': 'https://www.youtube.com',
    'netflix': 'market://launch?id=com.netflix.ninja',
    'prime video': 'market://launch?id=com.amazon.amazonvideo.livingroom',
    'disney': 'market://launch?id=com.disney.disneyplus',
    'spotify': 'market://launch?id=com.spotify.tv.android',
    'youtube music': 'market://launch?id=com.google.android.youtube.tvmusic',
    'play store': 'market://launch?id=com.android.vending',
    'twitch': 'market://launch?id=tv.twitch.android.app',
}
ALIAS_APP = {'yt': 'youtube', 'you tube': 'youtube', 'prime': 'prime video', 'amazon': 'prime video',
             'amazon prime': 'prime video', 'disney+': 'disney', 'disney plus': 'disney',
             'tienda': 'play store', 'google play': 'play store'}


def apps_conocidas():
    todas = dict(APPS)
    try:
        if EXTRAS.exists():
            for k, v in json.loads(EXTRAS.read_text(encoding='utf-8')).items():
                if re.match(r'^(https?://|market://launch\?id=)\S+$', str(v)):
                    todas[limpio(k)] = str(v)
    except Exception:
        pass
    return todas


# ---- Conexion con la TV -----------------------------------------------------------

class TV:
    def __init__(self):
        self.remoto = None
        self.conectado = False

    def _nuevo(self):
        if AndroidTVRemote is None:
            raise Fallo('Falta instalar la libreria de la TV: pip install androidtvremote2')
        if not CFG.get('ip'):
            raise Fallo('Falta la IP de la TV. Usa: python agente_tv.py --ip 10.0.0.43')
        if not (CERT.exists() and LLAVE.exists()):
            raise Fallo('Esta TV aun no esta emparejada. Usa: python agente_tv.py --ip IP --emparejar')
        return AndroidTVRemote(NOMBRE_CLIENTE, str(CERT), str(LLAVE), CFG['ip'])

    async def conectar(self):
        self.cerrar()
        r = self._nuevo()
        try:
            await asyncio.wait_for(r.async_connect(), 10)
        except InvalidAuth:
            raise Fallo('La TV ya no reconoce a Jarvis. Vuelve a emparejar con --emparejar.')
        except (CannotConnect, ConnectionClosed, asyncio.TimeoutError, OSError):
            raise Fallo('No pude conectar con la TV (%s). Puede estar apagada del todo o con otra IP.' % CFG['ip'])
        self.remoto = r
        self.conectado = True
        aviso('Conectado a la TV %s' % CFG['ip'])

    def cerrar(self):
        try:
            if self.remoto:
                self.remoto.disconnect()
        except Exception:
            pass
        self.remoto = None
        self.conectado = False

    async def listo(self):
        if not self.conectado or not self.remoto:
            await self.conectar()
        return self.remoto

    async def con_reintento(self, fn):
        """Ejecuta fn(remoto); si la conexion se cayo, reconecta y lo intenta una vez mas."""
        r = await self.listo()
        try:
            return await fn(r)
        except (ConnectionClosed, CannotConnect, OSError):
            self.conectado = False
            r = await self.listo()
            return await fn(r)

    async def tecla(self, codigo, veces=1, pausa=0.12):
        async def f(r):
            for i in range(veces):
                r.send_key_command(codigo)
                if i < veces - 1:
                    await asyncio.sleep(pausa)
        await self.con_reintento(f)

    async def volumen(self, espera=2.0):
        """Devuelve (nivel, maximo, silenciado) o None si la TV no lo informa."""
        r = await self.listo()
        fin = time.time() + espera
        while True:
            v = getattr(r, 'volume_info', None)
            if v and v.get('level') is not None and v.get('max'):
                return int(v['level']), int(v['max']), bool(v.get('muted'))
            if time.time() >= fin:
                return None
            await asyncio.sleep(0.1)


TV_ = TV()


# ---- Acciones ------------------------------------------------------------------------

def txt_volumen(v):
    return 'Volumen %d/%d%s' % (v[0], v[1], ' (en silencio)' if v[2] else '') if v else 'Volumen desconocido'


async def a_estado(_a):
    r = await TV_.listo()
    v = await TV_.volumen(1.5)
    info = getattr(r, 'device_info', None) or {}
    app = getattr(r, 'current_app', None) or 'desconocida'
    return 'TV %s %s: %s. App: %s. %s.' % (
        info.get('manufacturer', ''), info.get('model', ''), 'encendida' if getattr(r, 'is_on', False) else 'apagada',
        app, txt_volumen(v))


async def a_encender(_a):
    r = await TV_.listo()
    if r.is_on:
        return 'La TV ya estaba encendida.'
    await TV_.tecla(K_POWER)
    await asyncio.sleep(2)
    return 'Orden de encender enviada.' if not r.is_on else 'TV encendida.'


async def a_apagar(_a):
    r = await TV_.listo()
    if not r.is_on:
        return 'La TV ya estaba apagada.'
    await TV_.tecla(K_POWER)
    return 'Orden de apagar enviada.'


async def a_volumen(a):
    modo = limpio(a.get('modo'))
    if modo in ('subir', 'bajar'):
        pasos = max(1, min(10, int(a.get('pasos') or 3)))
        await TV_.tecla(K_VOL_MAS if modo == 'subir' else K_VOL_MENOS, pasos * 2)
        await asyncio.sleep(0.4)
        return 'Volumen %s. %s.' % (modo, txt_volumen(await TV_.volumen(1.0)))
    if modo in ('silenciar', 'activar_sonido'):
        v = await TV_.volumen()
        if v is None:
            raise Fallo('La TV no informa si esta en silencio; no quiero adivinar.')
        quiere_silencio = modo == 'silenciar'
        if v[2] == quiere_silencio:
            return 'La TV ya estaba ' + ('en silencio.' if quiere_silencio else 'con sonido.')
        await TV_.tecla(K_MUTE)
        await asyncio.sleep(0.4)
        return ('TV en silencio.' if quiere_silencio else 'Sonido activado. ' + txt_volumen(await TV_.volumen(1.0)))
    if modo == 'poner':
        try:
            meta = int(a.get('nivel'))
        except (TypeError, ValueError):
            raise Fallo('Falta el nivel de volumen (0 a 100).')
        if not 0 <= meta <= 100:
            raise Fallo('El nivel va de 0 a 100.')
        v = await TV_.volumen()
        if v is None:
            raise Fallo('La TV no informa su volumen; no puedo poner un nivel exacto.')
        if v[2]:
            await TV_.tecla(K_MUTE)
            await asyncio.sleep(0.4)
            v = await TV_.volumen(1.0) or v
        if v[1] != 100:
            meta = round(meta * v[1] / 100)
        for _ in range(80):
            v = await TV_.volumen(1.0)
            if v is None or v[0] == meta:
                break
            await TV_.tecla(K_VOL_MAS if v[0] < meta else K_VOL_MENOS, 1)
            await asyncio.sleep(0.25)
        v = await TV_.volumen(1.0)
        if v is None or v[0] != meta:
            raise Fallo('No logré dejar el volumen en %d. %s.' % (meta, txt_volumen(v)))
        return 'Volumen puesto. ' + txt_volumen(v) + '.'
    raise Fallo('modo de volumen no válido (subir, bajar, silenciar, activar_sonido o poner)')


async def a_tecla(a):
    n = limpio(a.get('tecla')).replace(' ', '_')
    n = ALIAS_TECLA.get(n, n)
    if n not in TECLAS:
        raise Fallo('Tecla no permitida. Puedo: ' + ', '.join(sorted(TECLAS)))
    veces = max(1, min(10, int(a.get('veces') or 1)))
    await TV_.tecla(TECLAS[n], veces)
    return 'Pulsé %s%s.' % (n, ' x%d' % veces if veces > 1 else '')


async def a_abrir_app(a):
    n = limpio(a.get('nombre'))
    n = ALIAS_APP.get(n, n)
    todas = apps_conocidas()
    if n not in todas:
        raise Fallo('No conozco esa app. Puedo abrir: ' + ', '.join(sorted(todas)) +
                    '. El usuario puede agregar más en ' + str(EXTRAS))
    enlace = todas[n]

    async def f(r):
        r.send_launch_app_command(enlace)
    await TV_.con_reintento(f)
    return 'Abrí %s en la TV.' % n


async def a_abrir_url(a):
    url = str(a.get('url') or '').strip()
    if not re.match(r'^https?://\S+$', url):
        raise Fallo('El enlace debe empezar por http:// o https://')

    async def f(r):
        r.send_launch_app_command(url)
    await TV_.con_reintento(f)
    return 'Mandé el enlace a la TV.'


ACCIONES = {
    'tv_estado': a_estado, 'tv_encender': a_encender, 'tv_apagar': a_apagar, 'tv_volumen': a_volumen,
    'tv_tecla': a_tecla, 'tv_abrir_app': a_abrir_app, 'tv_abrir_url': a_abrir_url,
}


# ---- Conversacion con Jarvis ----------------------------------------------------------

def http(metodo, ruta, cuerpo=None):
    r = requests.request(metodo, CFG['url'] + ruta, headers={'X-Manos-Token': CFG['token']}, json=cuerpo, timeout=20)
    if r.status_code == 401:
        raise PermissionError('token inválido')
    r.raise_for_status()
    return r.json()


async def atender(orden):
    tipo = str(orden.get('tipo') or '')
    res = {'orden_id': orden.get('id'), 'ok': False, 'texto': ''}
    aviso('Orden: ' + tipo)
    try:
        fn = ACCIONES.get(tipo)
        if not fn:
            raise Fallo('Esta TV no conoce la acción ' + tipo[:30])
        res.update(ok=True, texto=await asyncio.wait_for(fn(orden.get('args') or {}), 60))
    except Fallo as e:
        res['texto'] = str(e)
    except asyncio.TimeoutError:
        TV_.cerrar()
        res['texto'] = 'La TV tardó demasiado en responder.'
    except Exception as e:
        TV_.cerrar()
        res['texto'] = 'Error con la TV: ' + str(e)[:200]
    aviso('  -> ' + ('hecho' if res['ok'] else 'no: ' + res['texto'][:80]))
    try:
        await asyncio.to_thread(http, 'POST', '/manos/d/resultado', res)
    except Exception as e:
        aviso('No pude enviar el resultado: ' + str(e)[:80])


async def emparejar():
    if AndroidTVRemote is None:
        print('Falta instalar: pip install androidtvremote2')
        return 1
    if not CFG.get('ip'):
        print('Falta la IP: python agente_tv.py --ip 10.0.0.43 --emparejar')
        return 1
    r = AndroidTVRemote(NOMBRE_CLIENTE, str(CERT), str(LLAVE), CFG['ip'])
    if await r.async_generate_cert_if_missing():
        print('Creé un certificado nuevo para Jarvis.')
    await r.async_start_pairing()
    codigo = input('Escribe el código que salió en la TV: ').strip()
    try:
        await r.async_finish_pairing(codigo)
    except InvalidAuth:
        print('Código incorrecto. Prueba de nuevo.')
        return 1
    print('Emparejada. Ahora corre: python agente_tv.py --url https://TU-JARVIS --token EL_TOKEN')
    return 0


def cargar_config(args):
    try:
        CFG.update(json.loads(CONFIG.read_text(encoding='utf-8')))
    except Exception:
        pass
    if args.url:
        CFG['url'] = args.url.rstrip('/')
    if args.token:
        CFG['token'] = args.token.strip()
    if args.ip:
        CFG['ip'] = args.ip.strip()
    try:
        CONFIG.write_text(json.dumps(CFG), encoding='utf-8')
        os.chmod(CONFIG, 0o600)
    except Exception:
        pass


async def bucle():
    aviso('Agente de Jarvis para la TV listo (TV %s).' % CFG['ip'])
    ultima = 0
    while True:
        try:
            orden = (await asyncio.to_thread(http, 'GET', '/manos/d/cola')).get('orden')
            if orden:
                await atender(orden)
                ultima = time.time()
            else:
                await asyncio.sleep(0.4 if time.time() - ultima < 60 else 1.0)
        except PermissionError:
            aviso('El token ya no es válido. Vincula la TV de nuevo desde Jarvis.')
            await asyncio.sleep(30)
        except Exception as e:
            aviso('Sin conexión con Jarvis (' + str(e)[:60] + '). Reintento...')
            await asyncio.sleep(5)


def principal():
    ap = argparse.ArgumentParser(description='Agente de Jarvis para Android TV')
    ap.add_argument('--url')
    ap.add_argument('--token')
    ap.add_argument('--ip')
    ap.add_argument('--emparejar', action='store_true')
    args = ap.parse_args()
    cargar_config(args)
    if args.emparejar:
        sys.exit(asyncio.run(emparejar()))
    if not CFG['url'] or not CFG['token'] or not CFG['ip']:
        print('Faltan datos. Usa: python agente_tv.py --ip IP_DE_LA_TV --url https://TU-JARVIS.vercel.app --token EL_TOKEN')
        sys.exit(1)
    try:
        asyncio.run(bucle())
    except KeyboardInterrupt:
        aviso('Agente detenido.')


if __name__ == '__main__':
    principal()
