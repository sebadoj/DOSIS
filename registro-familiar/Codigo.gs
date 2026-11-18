/**
 * MIDOSIS · Registro familiar
 * Script para una Planilla de Google: guarda cada dosis y avisa por mail a la familia.
 *
 * Instalación (una sola vez): ver INSTRUCCIONES.md
 *   1. Cambiá las dos claves de abajo por palabras tuyas, distintas entre sí.
 *   2. Ejecutá la función "configurar" (crea las hojas y pide permisos).
 *   3. Implementar > Nueva implementación > Aplicación web
 *      Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario
 */

// Clave para GUARDAR dosis: solo la usa el teléfono del usuario principal.
var CLAVE_ESCRITURA = 'cambiar-clave-principal';
// Clave para LEER el registro: la usan los teléfonos de la familia.
var CLAVE_LECTURA = 'cambiar-clave-familia';

var HOJA_REGISTRO = 'Registro';
var HOJA_FAMILIA = 'Familia';
var COLUMNAS = ['ID', 'Fecha', 'Hora', 'Momento', 'Glicemia (mg/dL)', 'NPH (U)', 'RAPI bolo (U)',
                'RAPI corrección (U)', 'RAPI total (U)', 'Fuera de horario', 'Registrado'];

/** Ejecutar una vez desde el editor: crea las hojas con sus encabezados. */
function configurar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var reg = ss.getSheetByName(HOJA_REGISTRO) || ss.insertSheet(HOJA_REGISTRO);
  if (reg.getLastRow() === 0) {
    reg.appendRow(COLUMNAS);
    reg.setFrozenRows(1);
    reg.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold');
  }
  var fam = ss.getSheetByName(HOJA_FAMILIA) || ss.insertSheet(HOJA_FAMILIA);
  if (fam.getLastRow() === 0) {
    fam.appendRow(['Nombre', 'Mail', 'Recibe mails (SI/NO)']);
    fam.setFrozenRows(1);
    fam.getRange(1, 1, 1, 3).setFontWeight('bold');
    fam.appendRow(['Ejemplo', 'nombre@ejemplo.com', 'NO']);
  }
  // Fuerza el pedido de permiso de mail en la primera ejecución
  MailApp.getRemainingDailyQuota();
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var clave = String(p.clave || '');
  if (!clave || (clave !== CLAVE_LECTURA && clave !== CLAVE_ESCRITURA)) {
    return json_({ ok: false, error: 'clave' });
  }
  if (p.accion === 'probar') return json_({ ok: true, rol: clave === CLAVE_ESCRITURA ? 'principal' : 'familia' });
  var dias = Math.min(Math.max(parseInt(p.dias, 10) || 7, 1), 90);
  return json_({ ok: true, registros: leer_(dias) });
}

function doPost(e) {
  var datos;
  try { datos = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'formato' }); }
  if (!datos || datos.clave !== CLAVE_ESCRITURA) return json_({ ok: false, error: 'clave' });
  if (datos.accion === 'probar') return json_({ ok: true, rol: 'principal' });
  var r = datos.registro;
  var err = validar_(r);
  if (err) return json_({ ok: false, error: err });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var hoja = hojaRegistro_();
    if (existe_(hoja, r.id)) return json_({ ok: true, duplicado: true });
    hoja.appendRow([r.id, r.fecha, r.hora, r.momento, r.glicemia, r.nph, r.bolo, r.correccion, r.rapi,
                    r.fueraHorario ? 'SI' : 'NO', new Date()]);
    // Fecha y hora como texto, para que la planilla no las cambie de formato
    var fila = hoja.getLastRow();
    hoja.getRange(fila, 2, 1, 2).setNumberFormat('@').setValues([[r.fecha, r.hora]]);
  } finally {
    lock.releaseLock();
  }
  var enviados = avisar_(r);
  return json_({ ok: true, mails: enviados });
}

function validar_(r) {
  if (!r || typeof r !== 'object') return 'registro';
  if (!/^[A-Za-z0-9-]{8,64}$/.test(String(r.id || ''))) return 'id';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.fecha || ''))) return 'fecha';
  if (!/^\d{2}:\d{2}$/.test(String(r.hora || ''))) return 'hora';
  if (!r.momento || String(r.momento).length > 40) return 'momento';
  var nums = ['glicemia', 'nph', 'bolo', 'correccion', 'rapi'];
  for (var i = 0; i < nums.length; i++) {
    var n = r[nums[i]];
    if (typeof n !== 'number' || !isFinite(n) || n < 0 || n > 999 || Math.floor(n) !== n) return nums[i];
  }
  if (r.bolo + r.correccion !== r.rapi) return 'suma';
  return '';
}

function hojaRegistro_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var h = ss.getSheetByName(HOJA_REGISTRO);
  if (!h) { configurar(); h = ss.getSheetByName(HOJA_REGISTRO); }
  return h;
}

function existe_(hoja, id) {
  var n = hoja.getLastRow();
  if (n < 2) return false;
  var desde = Math.max(2, n - 499);
  var ids = hoja.getRange(desde, 1, n - desde + 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return true;
  return false;
}

function leer_(dias) {
  var hoja = hojaRegistro_();
  var n = hoja.getLastRow();
  if (n < 2) return [];
  var limite = new Date();
  limite.setHours(0, 0, 0, 0);
  limite.setDate(limite.getDate() - (dias - 1));
  var tz = Session.getScriptTimeZone();
  var corte = Utilities.formatDate(limite, tz, 'yyyy-MM-dd');
  var filas = hoja.getRange(2, 1, n - 1, COLUMNAS.length).getDisplayValues();
  var out = [];
  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    if (!f[0] || f[1] < corte) continue;
    out.push({ id: f[0], fecha: f[1], hora: f[2], momento: f[3], glicemia: Number(f[4]), nph: Number(f[5]),
               bolo: Number(f[6]), correccion: Number(f[7]), rapi: Number(f[8]), fueraHorario: f[9] === 'SI' });
  }
  return out;
}

function destinatarios_() {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_FAMILIA);
  if (!hoja || hoja.getLastRow() < 2) return [];
  var filas = hoja.getRange(2, 1, hoja.getLastRow() - 1, 3).getValues();
  var mails = [];
  for (var i = 0; i < filas.length; i++) {
    var mail = String(filas[i][1] || '').trim();
    var si = String(filas[i][2] || '').trim().toUpperCase();
    if (mail && /@/.test(mail) && (si === 'SI' || si === 'SÍ')) mails.push(mail);
  }
  return mails;
}

function avisar_(r) {
  var mails = destinatarios_();
  if (!mails.length) return 0;
  var asunto = 'MIDOSIS · ' + r.momento + ' ' + r.hora + ' · NPH ' + r.nph + ' U · RAPI ' + r.rapi + ' U';
  var lineas = [
    r.momento + ' · ' + r.fecha + ' a las ' + r.hora,
    'Glicemia: ' + r.glicemia + ' mg/dL',
    'NPH: ' + r.nph + ' U',
    'RAPI: ' + r.rapi + ' U (bolo ' + r.bolo + ' + corrección ' + r.correccion + ')'
  ];
  if (r.fueraHorario) lineas.push('Registrado fuera del horario habitual.');
  if (r.glicemia < 70) lineas.push('ATENCIÓN: glicemia baja.');
  if (r.glicemia > 400) lineas.push('ATENCIÓN: glicemia mayor a 400 mg/dL.');
  var html = '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5">' +
    '<h2 style="margin:0 0 8px">' + esc_(r.momento) + ' · ' + esc_(r.hora) + '</h2>' +
    '<p style="margin:0 0 12px;color:#555">' + esc_(r.fecha) + '</p>' +
    '<p style="font-size:22px;margin:0 0 6px"><b>Glicemia:</b> ' + r.glicemia + ' mg/dL</p>' +
    '<p style="font-size:22px;margin:0 0 6px"><b>NPH:</b> ' + r.nph + ' U</p>' +
    '<p style="font-size:22px;margin:0 0 6px"><b>RAPI:</b> ' + r.rapi + ' U <span style="font-size:16px;color:#555">(bolo ' + r.bolo + ' + corrección ' + r.correccion + ')</span></p>' +
    lineas.slice(4).map(function (l) { return '<p style="color:#b4600a;font-weight:bold">' + esc_(l) + '</p>'; }).join('') +
    '<p style="color:#777;font-size:13px;margin-top:18px">Aviso automático de MIDOSIS. Información solo de registro, no reemplaza la indicación médica.</p></div>';
  var enviados = 0;
  for (var i = 0; i < mails.length; i++) {
    try {
      MailApp.sendEmail({ to: mails[i], subject: asunto, body: lineas.join('\n'), htmlBody: html, name: 'MIDOSIS' });
      enviados++;
    } catch (err) { /* si un mail falla, el registro igual queda guardado */ }
  }
  return enviados;
}

function esc_(s) {
  return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
