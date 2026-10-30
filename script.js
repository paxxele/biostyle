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
