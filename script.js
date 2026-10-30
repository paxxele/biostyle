const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");

menuToggle.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.textContent = isOpen ? "×" : "☰";
});

mainNav.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.textContent = "☰";
  });
});

document.getElementById("year").textContent = new Date().getFullYear();

document.getElementById("contactForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const message = document.getElementById("message").value.trim();

  // Cambiá esta dirección por el correo real de BioStyle antes de publicar.
  const destinationEmail = "biostylebusiness9@gmail.com";
  const subject = encodeURIComponent("Consulta sobre BioStyle");
  const body = encodeURIComponent(`Hola, soy ${name} (${email}).\n\nMi consulta:\n${message}`);
  document.getElementById("formHint").textContent =
    "Se abrirá tu aplicación de correo. Antes de publicar, reemplazá biostylebusiness9@gmail.com por el correo real de la marca.";
  window.location.href = `mailto:${destinationEmail}?subject=${subject}&body=${body}`;
});

// QR general hacia BioStyle Club.
(function(){
  const holder=document.getElementById("homeClubQr");
  if(!holder) return;
  const target=new URL("club.html",window.location.href).href;
  const render=()=>{ if(window.QRCode){ holder.innerHTML=""; new QRCode(holder,{text:target,width:134,height:134,colorDark:"#19372b",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M}); } };
  if(window.QRCode) render();
  else { const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.onload=render; document.head.appendChild(s); }
})();
