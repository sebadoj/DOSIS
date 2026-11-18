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
Cambiá los archivos en el hosting y subí el número en `sw.js` (`VERSION = 'mi2sis-v2'`). La app se actualiza sola al abrirla con internet.

## Datos
Los ajustes, los rangos de corrección y los "Listo" del día se guardan solo en el navegador de cada celular. No se comparten entre dispositivos.

## Registro familiar (planilla de Google + mails)
En la carpeta `registro-familiar/` está el script (`Codigo.gs`) y la guía paso a paso (`INSTRUCCIONES.md`) para guardar cada dosis en una planilla compartida de Drive y avisar por mail a la familia. Esa carpeta no hace falta subirla al hosting.
