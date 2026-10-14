/* Llaves de IA ligadas a la cuenta: se guardan en el servidor (cifradas) y se copian a este dispositivo. */
(function () {
  var CL = { gemini: 'jarvisGeminiKey', groq: 'jarvisGroqKey', mistral: 'jarvisMistralKey' };
  var DUENO = 'jarvisLlavesDe';
  var enCurso = false, hecho = false;

  function ver(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function poner(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  function quitar(k) { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } }
  function refrescarUI() {
    try { actualizarBadgesLlaves(); actualizarProveedorUI(); } catch (e) { /* Ajustes aun no existe */ }
  }
  function json(method, url, cuerpo) {
    var o = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (cuerpo) o.body = JSON.stringify(cuerpo);
    return fetch(url, o);
  }

  async function guardar(prov, llave) {
    try {
      var r = await json('POST', '/llaves', { proveedor: prov, llave: llave });
      return r.ok;
    } catch (e) { return false; }
  }
  async function borrar(prov) {
    try {
      var r = await json('DELETE', '/llaves/' + prov);
      return r.ok;
    } catch (e) { return false; }
  }

  async function sincronizar() {
    if (enCurso || hecho || !ver('jarvisAcceso')) return;
    enCurso = true;
    try {
      var res = await fetch('/llaves');
      if (!res.ok) return; /* sin LLAVES_SECRET o sin tabla: se quedan las del dispositivo */
      var d = await res.json();
      var dueno = d.usuario;
      var previo = ver(DUENO);
      if (previo && previo !== dueno) { Object.keys(CL).forEach(function (p) { quitar(CL[p]); }); }
      for (var p in CL) {
        var remota = (d.llaves || {})[p];
        var local = ver(CL[p]);
        if (remota) poner(CL[p], remota);
        else if (local) await guardar(p, local); /* la cuenta no la tiene: se sube, asi no se pierde una llave que no alcanzo a guardarse */
      }
      poner(DUENO, dueno);
      hecho = true;
      refrescarUI();
    } catch (e) { /* se reintenta en el proximo inicio */ }
    finally { enCurso = false; }
  }

  function alSalir() {
    hecho = false;
    Object.keys(CL).forEach(function (p) { quitar(CL[p]); });
    quitar('jarvisProveedor');
    quitar(DUENO);
    refrescarUI();
  }

  window.llavesCuenta = { guardar: guardar, borrar: borrar, sincronizar: sincronizar, alSalir: alSalir };
  window.addEventListener('jarvis-sesion', sincronizar);
  if (ver('jarvisAcceso')) sincronizar();
})();
