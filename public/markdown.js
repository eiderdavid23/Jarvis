/* Convierte el texto con formato de la IA (Markdown) en HTML seguro. */
(function () {
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function inline(t) {
    var cod = [];
    t = t.replace(/`([^`\n]+)`/g, function (_, c) { cod.push(c); return '\u0001' + (cod.length - 1) + '\u0002'; });
    t = esc(t);
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (_, p, u) {
      var fin = '';
      var m = u.match(/[.,;:!?]+$/);
      if (m) { fin = m[0]; u = u.slice(0, -fin.length); }
      return p + '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>' + fin;
    });
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
    t = t.replace(/\u0001(\d+)\u0002/g, function (_, n) { return '<code>' + esc(cod[+n]) + '</code>'; });
    return t;
  }
  var RE_LISTA = /^(\s*)([-*•+]|\d+[.)])\s+(.*)$/;
  var RE_TABLA_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
  function esInicio(l) {
    return /^\s*```/.test(l) || /^#{1,6}\s/.test(l) || /^\s*>/.test(l) || RE_LISTA.test(l) ||
      /^\s*([-*_])\1{2,}\s*$/.test(l);
  }
  function lista(items) {
    var html = '', pila = [];
    items.forEach(function (it) {
      var tag = it.ord ? 'ol' : 'ul';
      while (pila.length && it.indent < pila[pila.length - 1].indent) { html += '</li></' + pila.pop().tag + '>'; }
      if (pila.length && it.indent === pila[pila.length - 1].indent) html += '</li>';
      else { html += '<' + tag + '>'; pila.push({ indent: it.indent, tag: tag }); }
      html += '<li>' + inline(it.texto);
    });
    while (pila.length) html += '</li></' + pila.pop().tag + '>';
    return html;
  }
  function celdas(l) {
    return l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
  }
  function bloques(lineas) {
    var out = '', i = 0, n = lineas.length;
    while (i < n) {
      var l = lineas[i];
      if (!l.trim()) { i++; continue; }
      if (/^\s*```/.test(l)) {
        var lang = (l.match(/^\s*```\s*([\w+#-]*)/) || [])[1] || '';
        var cod = []; i++;
        while (i < n && !/^\s*```/.test(lineas[i])) cod.push(lineas[i++]);
        i++;
        out += '<pre' + (lang ? ' data-lang="' + esc(lang) + '"' : '') + '><code>' + esc(cod.join('\n')) + '</code></pre>';
        continue;
      }
      var h = l.match(/^(#{1,6})\s+(.*)$/);
      if (h) { var nv = Math.min(h[1].length, 4); out += '<h' + nv + '>' + inline(h[2].replace(/\s*#+\s*$/, '')) + '</h' + nv + '>'; i++; continue; }
      if (/^\s*([-*_])\1{2,}\s*$/.test(l)) { out += '<hr>'; i++; continue; }
      if (/^\s*>/.test(l)) {
        var cita = [];
        while (i < n && /^\s*>/.test(lineas[i])) cita.push(lineas[i++].replace(/^\s*>\s?/, ''));
        out += '<blockquote>' + bloques(cita) + '</blockquote>';
        continue;
      }
      if (l.indexOf('|') >= 0 && i + 1 < n && RE_TABLA_SEP.test(lineas[i + 1]) && lineas[i + 1].indexOf('-') >= 0) {
        var cab = celdas(l); i += 2;
        var t = '<div class="tablaMd"><table><thead><tr>' + cab.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
        while (i < n && lineas[i].trim() && lineas[i].indexOf('|') >= 0) {
          t += '<tr>' + celdas(lineas[i++]).map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
        }
        out += t + '</tbody></table></div>';
        continue;
      }
      var m = l.match(RE_LISTA);
      if (m) {
        var items = [];
        while (i < n) {
          var mm = lineas[i].match(RE_LISTA);
          if (mm) { items.push({ indent: mm[1].replace(/\t/g, '    ').length, ord: /\d/.test(mm[2]), texto: mm[3] }); i++; continue; }
          if (!lineas[i].trim()) {
            var j = i; while (j < n && !lineas[j].trim()) j++;
            if (j < n && RE_LISTA.test(lineas[j])) { i = j; continue; }
            break;
          }
          if (/^\s{2,}\S/.test(lineas[i]) && items.length) { items[items.length - 1].texto += '\n' + lineas[i].trim(); i++; continue; }
          break;
        }
        out += lista(items).replace(/\n/g, '<br>');
        continue;
      }
      var par = [];
      while (i < n && lineas[i].trim() && (par.length === 0 || !esInicio(lineas[i]))) par.push(lineas[i++]);
      out += '<p>' + par.map(inline).join('<br>') + '</p>';
    }
    return out;
  }
  window.mdHtml = function (src) { return bloques(String(src || '').replace(/\r/g, '').split('\n')); };
  /* Texto sin símbolos, para la voz y el modo voz. */
  window.mdPlano = function (src) {
    return String(src || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
      .replace(/^\s*>\s?/gm, '')
      .replace(/^\s*([-*_])\1{2,}\s*$/gm, '')
      .replace(/\|/g, ' ')
      .replace(/[*_#`~]/g, '')
      .replace(/^\s*[-•+]\s+/gm, '')
      .replace(/[ \t]+/g, ' ')
      .trim();
  };
})();
