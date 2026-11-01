# Mira un solo aparato de tu wifi (puertos abiertos y datos). Solo mira, no cambia nada.
import socket, sys, re, urllib.request
from concurrent.futures import ThreadPoolExecutor

if len(sys.argv) < 2:
    sys.exit('Uso: python inspeccionar_tv.py 10.0.0.43')
ip = sys.argv[1]

def sondeo(p):
    try:
        socket.create_connection((ip, p), 0.4).close()
        return p
    except Exception:
        return None

def ssdp():
    msg = ('M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ssdp:all\r\n\r\n').encode()
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(3)
    ubic = set()
    try:
        s.sendto(msg, ('239.255.255.250', 1900))
        while True:
            r, (o, _) = s.recvfrom(4096)
            m = re.search(r'(?i)location:\s*(\S+)', r.decode(errors='ignore'))
            if o == ip and m:
                ubic.add(m.group(1))
    except Exception:
        pass
    return ubic

print('Revisando ' + ip + ' (1 o 2 minutos)...')
lista = sorted(set(range(1, 20001)) | {49152, 49153, 49154, 49155, 55000, 56789, 60000})
with ThreadPoolExecutor(300) as ex:
    abiertos = sorted(p for p in ex.map(sondeo, lista) if p)
print('\nPuertos abiertos: ' + (', '.join(map(str, abiertos)) or 'ninguno'))
for p in abiertos[:15]:
    try:
        r = urllib.request.urlopen('http://%s:%d/' % (ip, p), timeout=1.5)
        cab = r.headers.get('Server', '')
        t = re.search(r'(?i)<title>([^<]*)', r.read(3000).decode(errors='ignore'))
        print('  http %d -> Server: %s | titulo: %s' % (p, cab, t.group(1).strip() if t else ''))
    except Exception as e:
        print('  puerto %d no es http simple (%s)' % (p, str(e)[:40]))
for u in ssdp():
    try:
        x = urllib.request.urlopen(u, timeout=2).read().decode(errors='ignore')
        print('\nUPnP ' + u)
        for t in ('deviceType', 'friendlyName', 'manufacturer', 'modelName', 'modelNumber', 'modelDescription'):
            m = re.search('<%s>([^<]*)' % t, x)
            if m:
                print('  ' + t + ': ' + m.group(1))
        print('  servicios: ' + ', '.join(sorted(set(re.findall(r'<serviceType>[^<]*:service:([^:<]*)', x)))))
    except Exception as e:
        print('  no pude leer ' + u)
print('\nListo. Pega todo esto en el chat.')
