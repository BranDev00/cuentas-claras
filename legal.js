// Rellena el nombre del responsable y el correo de contacto desde config.js
document.querySelectorAll("[data-fill]").forEach(function(el){
  var tipo=el.getAttribute("data-fill");
  var valor=tipo==="owner"?OWNER_NAME:CONTACT_EMAIL;
  el.textContent=valor;
  if(tipo==="email")el.href="mailto:"+valor;
});
