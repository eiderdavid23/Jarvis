// Entrar con Google. En el navegador redirige; en la APK vuelve por el enlace com.david.jarvis://auth.
import { sesion } from './sesion.js';

const ENLACE_APP = 'com.david.jarvis://auth';

function enApp() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

export function entrarConGoogle() {
  const destino = enApp() ? ENLACE_APP : location.origin + '/';
  location.href = '/auth/google?redirect=' + encodeURIComponent(destino);
}

// Si la APK se abre desde el enlace de vuelta, toma los tokens y avisa al arranque.
export function escucharRetornoApp() {
  const plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (!plugin || !plugin.addListener) return;
  plugin.addListener('appUrlOpen', (e) => {
    const url = String((e && e.url) || '');
    const i = url.indexOf('#');
    if (i < 0) return;
    const h = new URLSearchParams(url.slice(i + 1));
    if (!h.get('access_token')) return;
    sesion.guardar({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token') });
    window.dispatchEvent(new Event('sesion-cambio'));
  });
}
