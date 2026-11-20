/* Chat nuevo sin mensajes: pone la clase chat-vacio en <body> para mostrar el saludo y las sugerencias
   (el diseno vive en chat_pulido.css). Se quita sola al aparecer el primer mensaje. */
(function () {
  var dentro = document.getElementById('chatInner');
  if (!dentro) return;
  function revisar() {
    document.body.classList.toggle('chat-vacio', dentro.children.length === 0);
  }
  new MutationObserver(revisar).observe(dentro, { childList: true });
  revisar();
})();
