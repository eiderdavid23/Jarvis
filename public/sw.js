/* Service worker: guarda la pantalla y los archivos estaticos (primero lo guardado, luego actualiza por detras).
   Lo dinamico (chat, API, voz, login) siempre va a la red. Para forzar una actualizacion, sube el numero de V. */
const V = 'jarvis-v158';
const ESTATICO = /\.(?:js|css|svg|png|jpg|jpeg|webp|woff2?|json)$/i;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;
  const inicio = r.mode === 'navigate' && (u.pathname === '/' || u.pathname === '/index.html');
  if (!inicio && (!ESTATICO.test(u.pathname) || u.pathname === '/sw.js' || u.pathname.indexOf('/api') === 0)) return;
  const clave = inicio ? '/' : r.url;
  e.respondWith(
    caches.open(V).then(async (c) => {
      const guardado = await c.match(clave);
      const red = fetch(r).then((resp) => {
        if (resp && resp.ok && resp.type === 'basic' && !resp.redirected) c.put(clave, resp.clone());
        return resp;
      }).catch(() => guardado);
      if (guardado) { e.waitUntil(red); return guardado; }
      return red;
    })
  );
});
