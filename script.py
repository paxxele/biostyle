"""BioStyle · script del sitio (Python con PyScript).

Funciones: menú móvil, año automático y formulario de consulta.
"""
from datetime import date
from urllib.parse import quote

from pyodide.ffi.wrappers import add_event_listener
from pyscript import document, window

menu_toggle = document.getElementById("menuToggle")
main_nav = document.getElementById("mainNav")


def set_menu(is_open):
    """Abre o cierra el menú móvil y actualiza el botón."""
    main_nav.classList.toggle("open", is_open)
    menu_toggle.setAttribute("aria-expanded", str(is_open).lower())
    menu_toggle.textContent = "×" if is_open else "☰"


def on_menu_click(event):
    set_menu(not main_nav.classList.contains("open"))


def on_link_click(event):
    set_menu(False)


add_event_listener(menu_toggle, "click", on_menu_click)
for link in main_nav.querySelectorAll("a"):
    add_event_listener(link, "click", on_link_click)

# Año automático en el pie de página
document.getElementById("year").textContent = str(date.today().year)

# Cambiá esta dirección por el correo real de BioStyle antes de publicar.
DESTINATION_EMAIL = "contacto@biostyle.com"


def on_submit(event):
    event.preventDefault()
    name = document.getElementById("name").value.strip()
    email = document.getElementById("email").value.strip()
    message = document.getElementById("message").value.strip()

    # safe="!~*'()" reproduce el comportamiento de encodeURIComponent de JS
    subject = quote("Consulta sobre BioStyle", safe="!~*'()")
    body = quote(f"Hola, soy {name} ({email}).\n\nMi consulta:\n{message}", safe="!~*'()")

    document.getElementById("formHint").textContent = (
        "Se abrirá tu aplicación de correo. Antes de publicar, "
        "reemplazá contacto@biostyle.com por el correo real de la marca."
    )
    window.location.href = f"mailto:{DESTINATION_EMAIL}?subject={subject}&body={body}"


add_event_listener(document.getElementById("contactForm"), "submit", on_submit)
