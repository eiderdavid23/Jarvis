# Busca TVs y aparatos en tu wifi y dice de que marca parecen. Solo mira, no cambia nada.
import socket, sys, re, urllib.request
from concurrent.futures import ThreadPoolExecutor

PUERTOS = {8060: 'Roku', 8001: 'Samsung (Tizen)', 8002: 'Samsung (Tizen)', 55000: 'Samsung (antigua)',
           3000: 'LG (webOS)', 3001: 'LG (webOS)', 6466: 'Android TV / Google TV', 6467: 'Android TV / Google TV',
           8008: 'Google Cast', 8009: 'Google Cast', 5555: 'ADB (Fire TV o Android)'}

def mi_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except Exception:
        return sys.argv[1] if len(sys.argv) > 1 else None

def abierto(par):
    ip, p = par
    try:
        socket.create_connection((ip, p), 0.5).close()
        return ip, p
    except Exception:
        return None

def ssdp():
    datos = {}
    msg = ('M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ssdp:all\r\n\r\n').encode()
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(3)
    try:
        s.sendto(msg, ('239.255.255.250', 1900))
        while True:
            r, (ip, _) = s.recvfrom(4096)
            m = re.search(r'(?i)location:\s*(\S+)', r.decode(errors='ignore'))
            if m:
                datos[ip] = m.group(1)
    except Exception:
        pass
    return datos

def nombre(url):
    try:
        x = urllib.request.urlopen(url, timeout=2).read().decode(errors='ignore')
        g = lambda t: (re.search('<%s>([^<]*)</%s>' % (t, t), x) or [None, ''])[1]
        return (g('friendlyName') + ' | ' + g('manufacturer') + ' | ' + g('modelName')).strip(' |')
    except Exception:
        return ''

ip = mi_ip()
if not ip:
    sys.exit('No pude saber tu IP. Ejecuta: python buscar_tv.py 192.168.1.50 (la IP de tu celular)')
base = ip.rsplit('.', 1)[0]
print('Tu celular: ' + ip + '. Buscando en ' + base + '.1-254 ...')
with ThreadPoolExecutor(120) as ex:
    hallados = [r for r in ex.map(abierto, [(base + '.' + str(i), p) for i in range(1, 255) for p in PUERTOS]) if r]
upnp = ssdp()
por_ip = {}
for h, p in hallados:
    por_ip.setdefault(h, []).append(p)
for h in sorted(set(por_ip) | set(upnp), key=lambda z: tuple(int(n) for n in z.split('.'))):
    if h == ip:
        continue
    marcas = sorted(set(PUERTOS[p] for p in por_ip.get(h, [])))
    print('\n' + h)
    if marcas:
        print('  parece: ' + ', '.join(marcas) + '  (puertos ' + ', '.join(map(str, por_ip[h])) + ')')
    if h in upnp:
        print('  nombre: ' + (nombre(upnp[h]) or upnp[h]))
print('\nListo. Copia lo que salga de tu TV y pegalo en el chat.')
