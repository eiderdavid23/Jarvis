document.addEventListener('copy', function (e) {
  var sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  var box = document.createElement('div');
  box.appendChild(sel.getRangeAt(0).cloneContents());
  box.querySelectorAll('script,style,button,svg,canvas').forEach(function (el) { el.remove(); });
  box.querySelectorAll('*').forEach(function (el) {
    ['style', 'class', 'id', 'color', 'face', 'size', 'bgcolor'].forEach(function (a) {
      el.removeAttribute(a);
    });
  });
  e.clipboardData.setData('text/html', box.innerHTML);
  e.clipboardData.setData('text/plain', sel.toString());
  e.preventDefault();
});
