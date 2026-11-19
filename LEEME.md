# MIDOSIS (app instalable)

Guía de dosis de insulina (NPH y RAPI). Funciona sin internet una vez instalada.

## Qué hay en la carpeta
- `index.html`: la app
- `manifest.webmanifest`: nombre, íconos y colores de la app instalada
- `sw.js`: guarda la app en el celular para que abra sin conexión
- `icons/` y `fonts/`: íconos y tipografías incluidas

## Cómo ponerla en internet (una sola vez)
Una app instalable necesita estar en una dirección https. Opciones gratis:
1. **Netlify Drop**: entrá a app.netlify.com/drop y arrastrá la carpeta `midosis-pwa` entera. Te da un link.
2. **GitHub Pages**: subí la carpeta a un repositorio y activá Pages en Settings > Pages.
3. **Cloudflare Pages**: creá un proyecto y subí la carpeta.

Abrir `index.html` directo desde el celular o la compu como archivo **no** permite instalarla.

## Cómo instalarla en el celular
- **Android (Chrome)**: abrí el link, tocá Personalizar > Instalar MIDOSIS (o menú de tres puntos > Instalar app).
- **iPhone (Safari)**: abrí el link, tocá Compartir > Agregar a pantalla de inicio.

## Para actualizarla
Cambiá los archivos en el hosting y subí el número en `sw.js` (`VERSION = 'midosis-v9'`). La app se actualiza sola al abrirla con internet.

## Datos
Los ajustes, las dosis fijas, los rangos de corrección y los "Listo" del día se guardan solo en el navegador de cada celular. No se comparten entre dispositivos.

## Novedades de la versión 9
- **Dosis fijas editables** en Personalizar (NPH y RAPI bolo por comida). Para cambiar dosis, corrección o el aviso de glicemia baja hay que desbloquear con la contraseña de Juane o de Mamá/Papá. Cada cambio pide confirmación y queda en el registro con quién lo hizo. "Restablecer apariencia" ya no toca dosis ni corrección.
- **Tendencia** (↑ ↗ → ↘ ↓) en todos los campos de glicemia.
- **Hipoglicemia**: primera ingesta → 15 min con alarma → segunda ingesta → 15 min con alarma → control. Si la glicemia está arriba de 80 con tendencia a subir (↑ o ↗), cartel verde "¡Ya estás bien!". En el registro, la planilla y los mails las hipoglicemias van en rojo con HIPO.
- **Colación**: qué comiste, glicemia y tendencia; queda registrada con cartel de OK.

## Registro familiar (planilla de Google + mails)
En la carpeta `registro-familiar/` está el script (`Codigo.gs`) y la guía paso a paso (`INSTRUCCIONES.md`) para guardar cada dosis en una planilla compartida de Drive y avisar por mail a la familia. Esa carpeta no hace falta subirla al hosting.
