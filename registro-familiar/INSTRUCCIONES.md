# MIDOSIS · Configurar el registro familiar

Cada dosis confirmada en el teléfono del usuario principal se guarda en una **Planilla de Google** dentro de la carpeta compartida de Drive. Cada vez que se guarda una dosis, la familia recibe un mail con los datos. Los demás teléfonos ven el registro en MIDOSIS en modo solo lectura.

Se configura una sola vez y tarda unos 10 minutos. Hacelo desde la compu, con la cuenta de Google del usuario principal (los mails salen de esa cuenta).

## 1. Crear la planilla
1. En Google Drive, entrá a la carpeta compartida de la familia.
2. Nuevo → **Hojas de cálculo de Google** → Hoja de cálculo en blanco.
3. Ponele de nombre **MIDOSIS Registro**.

## 2. Pegar el script
1. En la planilla: menú **Extensiones → Apps Script**.
2. Borrá todo lo que aparece en el editor y pegá el contenido completo de `Codigo.gs`.
3. Arriba de todo, cambiá las dos claves por palabras tuyas, distintas entre sí:
   - `CLAVE_ESCRITURA`: la usa solo el teléfono del usuario principal.
   - `CLAVE_LECTURA`: la usan los teléfonos de la familia.
4. Guardá (ícono del disquete).

## 3. Crear las hojas y dar permisos
1. En la barra de arriba del editor, elegí la función **configurar** y tocá **Ejecutar**.
2. Google pide permisos: elegí tu cuenta → **Configuración avanzada** → **Ir a MIDOSIS (no seguro)** → **Permitir**. Ese aviso aparece siempre con scripts propios; el script es tuyo y solo toca esta planilla y el envío de mails.
3. En la planilla aparecen dos hojas nuevas: **Registro** y **Familia**.

## 4. Cargar a quién le llegan los mails
En la hoja **Familia**, una fila por persona: Nombre, Mail y **SI** en "Recibe mails". Borrá la fila de ejemplo o dejala en NO. Para sacar a alguien, poné NO.

## 5. Publicar el script
1. En el editor: **Implementar → Nueva implementación**.
2. Tipo (ícono del engranaje): **Aplicación web**.
3. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier usuario**.
4. **Implementar** y copiá la **URL de la aplicación web** (termina en `/exec`).

"Cualquier usuario" significa que la dirección responde sin pedir cuenta de Google; lo que protege los datos son las claves. No compartas la dirección ni las claves fuera de la familia.

## 6. Configurar los teléfonos
**Usuario principal**
1. MIDOSIS → Personalizar → **Registro familiar** → **Usuario principal**.
2. Pegá la dirección y la **clave de escritura** → **Probar conexión**. Tiene que decir "Conectado como usuario principal".

**Familia** (cada teléfono)
1. Instalá MIDOSIS desde el mismo link.
2. Personalizar → **Registro familiar** → **Familia (solo lectura)**.
3. Pegá la misma dirección y la **clave de lectura** → **Probar conexión**.
4. En ese teléfono desaparece la carga de dosis y queda el registro de los últimos días. Se actualiza solo cada 2 minutos, o con **Actualizar**.

Para que la familia también abra la planilla directo, compartila desde Drive con permiso de **Lector**.

## Actualizar a la versión 9 (si ya tenías el script instalado)
1. Abrí la planilla → **Extensiones → Apps Script**.
2. Copiá tus dos claves (`CLAVE_ESCRITURA` y `CLAVE_LECTURA`) a un costado.
3. Borrá todo, pegá el `Codigo.gs` nuevo y volvé a poner tus dos claves.
4. Guardá → **Implementar → Administrar implementaciones** → lápiz → Versión: **Nueva versión** → Implementar. La dirección no cambia.
5. La hoja **Registro** suma sola 4 columnas al final (Tipo, Tendencia, Detalle, Usuario) con el primer dato nuevo. Las filas viejas no se tocan.

## Cómo funciona
- **Sin internet:** la dosis queda guardada en el teléfono como "pendiente" y se envía sola cuando vuelve la conexión. Nunca se duplica: cada dosis tiene un código único.
- **Qué se guarda:** fecha, hora, momento, glicemia, tendencia (↑ ↗ → ↘ ↓), NPH, RAPI (bolo, corrección y total), si fue fuera de horario, y el tipo de registro:
  - **Dosis** (como siempre).
  - **HIPO**: cada paso de una hipoglicemia (Primera ingesta, Segunda ingesta, Ya está bien, Control: todavía no está bien). La fila queda **en rojo**. También queda en rojo cualquier registro con glicemia menor a 70.
  - **Colación**: qué comió (columna Detalle) y la glicemia.
  - **Cambio de dosis**: qué se cambió y quién (Juane o Mamá/Papá).
- **Mails:** uno por registro. Asunto tipo `MIDOSIS · Desayuno 08:15 · NPH 12 U · RAPI 5 U`. En las hipoglicemias (y glicemias menores a 70) el mail arranca con **HIPO** grande en rojo y el asunto dice `MIDOSIS · HIPO · …`. Si la glicemia es mayor a 400, el mail lo destaca. Google permite unos 100 mails por día en una cuenta común.
- **CSV:** en la planilla, Archivo → Descargar → Valores separados por comas (.csv).
- **Lo que no se envía:** las tomas en 0 U (por ejemplo, Fuera de hora con glicemia menor a 180) no se registran.

## Si cambiás el script más adelante
Implementar → **Administrar implementaciones** → lápiz → Versión: **Nueva versión** → Implementar. Así la dirección no cambia y los teléfonos siguen funcionando.
