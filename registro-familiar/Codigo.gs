/**
 * MIDOSIS · Registro familiar (versión 9)
 * Script para una Planilla de Google: guarda cada dosis, hipoglicemia, colación y cambio de dosis,
 * y avisa por mail a la familia. Las hipoglicemias quedan en rojo y el mail dice HIPO bien grande.
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
// Las 4 últimas columnas se agregaron en la versión 9 (al final, para no mover las filas viejas)
var COLUMNAS = ['ID', 'Fecha', 'Hora', 'Momento', 'Glicemia (mg/dL)', 'NPH (U)', 'RAPI bolo (U)',
                'RAPI corrección (U)', 'RAPI total (U)', 'Fuera de horario', 'Registrado',
                'Tipo', 'Tendencia', 'Detalle', 'Usuario'];
var TIPOS = { dosis: 'Dosis', hipo: 'HIPO', colacion: 'Colación', ajuste: 'Cambio de dosis' };
var TENDENCIAS = { sube: '↑ Sube rápido', sube45: '↗ Sube', estable: '→ Estable', baja45: '↘ Baja', baja: '↓ Baja rápido' };
var GLICEMIA_BAJA = 70;
var ROJO_FONDO = '#f8d4d1';
var ROJO_LETRA = '#a3150c';

/** Ejecutar una vez desde el editor: crea las hojas con sus encabezados. */
function configurar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var reg = ss.getSheetByName(HOJA_REGISTRO) || ss.insertSheet(HOJA_REGISTRO);
  if (reg.getLastRow() === 0) {
    reg.appendRow(COLUMNAS);
    reg.setFrozenRows(1);
  }
  encabezados_(reg);
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

/** Si la planilla es de una versión anterior, agrega los encabezados nuevos al final. */
function encabezados_(hoja) {
  var actuales = hoja.getRange(1, 1, 1, COLUMNAS.length).getValues()[0];
  var falta = false;
  for (var i = 0; i < COLUMNAS.length; i++) if (String(actuales[i] || '') !== COLUMNAS[i]) falta = true;
  if (falta) hoja.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS]);
  hoja.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold');
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
    hoja.appendRow([r.id, r.fecha, r.hora, r.momento, r.glicemia === null ? '' : r.glicemia, r.nph, r.bolo, r.correccion, r.rapi,
                    r.fueraHorario ? 'SI' : 'NO', new Date(), TIPOS[r.tipo], TENDENCIAS[r.tendencia] || '',
                    r.detalle, r.usuario]);
    // Fecha y hora como texto, para que la planilla no las cambie de formato
    var fila = hoja.getLastRow();
    hoja.getRange(fila, 2, 1, 2).setNumberFormat('@').setValues([[r.fecha, r.hora]]);
    // Hipoglicemias en rojo
    if (esHipo_(r)) {
      hoja.getRange(fila, 1, 1, COLUMNAS.length).setBackground(ROJO_FONDO).setFontColor(ROJO_LETRA).setFontWeight('bold');
    }
  } finally {
    lock.releaseLock();
  }
  var enviados = avisar_(r);
  return json_({ ok: true, mails: enviados });
}

function entero_(n) { return typeof n === 'number' && isFinite(n) && n >= 0 && n <= 999 && Math.floor(n) === n; }

function validar_(r) {
  if (!r || typeof r !== 'object') return 'registro';
  // Registros de la versión 8 no traen tipo: son dosis
  if (r.tipo === undefined || r.tipo === null || r.tipo === '') r.tipo = 'dosis';
  if (!TIPOS.hasOwnProperty(r.tipo)) return 'tipo';
  if (!/^[A-Za-z0-9-]{8,64}$/.test(String(r.id || ''))) return 'id';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.fecha || ''))) return 'fecha';
  if (!/^\d{2}:\d{2}$/.test(String(r.hora || ''))) return 'hora';
  if (!r.momento || String(r.momento).length > 40) return 'momento';
  r.tendencia = String(r.tendencia || '');
  if (r.tendencia && !TENDENCIAS.hasOwnProperty(r.tendencia)) return 'tendencia';
  r.detalle = String(r.detalle || '');
  r.usuario = String(r.usuario || '');
  if (r.detalle.length > 600) return 'detalle';
  if (r.usuario.length > 40) return 'usuario';
  var nums = ['nph', 'bolo', 'correccion', 'rapi'];
  for (var i = 0; i < nums.length; i++) if (!entero_(r[nums[i]])) return nums[i];
  if (r.tipo === 'ajuste') {
    if (r.glicemia !== null && r.glicemia !== undefined && r.glicemia !== '') return 'glicemia';
    r.glicemia = null;
    if (!r.detalle) return 'detalle';
    if (!r.usuario) return 'usuario';
  } else if (!entero_(r.glicemia)) return 'glicemia';
  if (r.tipo !== 'dosis' && (r.nph || r.bolo || r.correccion || r.rapi)) return 'dosis';
  if (r.tipo === 'colacion' && !r.detalle) return 'detalle';
  if (r.tipo === 'hipo' && !r.detalle) return 'detalle';
  if (r.bolo + r.correccion !== r.rapi) return 'suma';
  return '';
}

function esHipo_(r) {
  return r.tipo === 'hipo' || (typeof r.glicemia === 'number' && r.glicemia < GLICEMIA_BAJA);
}

function hojaRegistro_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var h = ss.getSheetByName(HOJA_REGISTRO);
  if (!h) { configurar(); h = ss.getSheetByName(HOJA_REGISTRO); }
  else if (String(h.getRange(1, COLUMNAS.length).getValues()[0][0] || '') !== COLUMNAS[COLUMNAS.length - 1]) encabezados_(h);
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
    out.push({ id: f[0], fecha: f[1], hora: f[2], momento: f[3], glicemia: f[4] === '' ? null : Number(f[4]), nph: Number(f[5]),
               bolo: Number(f[6]), correccion: Number(f[7]), rapi: Number(f[8]), fueraHorario: f[9] === 'SI',
               tipo: codigo_(TIPOS, f[11]) || 'dosis', tendencia: codigo_(TENDENCIAS, f[12]), detalle: f[13] || '', usuario: f[14] || '' });
  }
  return out;
}

function codigo_(mapa, texto) {
  for (var k in mapa) if (mapa.hasOwnProperty(k) && mapa[k] === texto) return k;
  return '';
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
  var hipo = esHipo_(r);
  var tend = TENDENCIAS[r.tendencia] || '';
  var gl = r.glicemia === null ? '' : r.glicemia + ' mg/dL' + (tend ? ' ' + tend : '');
  var asunto, lineas = [], filas = [];
  if (r.tipo === 'dosis') {
    asunto = 'MIDOSIS · ' + (hipo ? 'HIPO · ' : '') + r.momento + ' ' + r.hora + ' · NPH ' + r.nph + ' U · RAPI ' + r.rapi + ' U';
    lineas = [r.momento + ' · ' + r.fecha + ' a las ' + r.hora, 'Glicemia: ' + gl, 'NPH: ' + r.nph + ' U',
              'RAPI: ' + r.rapi + ' U (bolo ' + r.bolo + ' + corrección ' + r.correccion + ')'];
    filas = ['<b>Glicemia:</b> ' + esc_(gl), '<b>NPH:</b> ' + r.nph + ' U',
             '<b>RAPI:</b> ' + r.rapi + ' U <span style="font-size:16px;color:#555">(bolo ' + r.bolo + ' + corrección ' + r.correccion + ')</span>'];
    if (r.fueraHorario) lineas.push('Registrado fuera del horario habitual.');
  } else if (r.tipo === 'hipo') {
    asunto = 'MIDOSIS · HIPO · ' + r.detalle + ' ' + r.hora + ' · ' + gl;
    lineas = ['HIPOGLICEMIA · ' + r.detalle, r.fecha + ' a las ' + r.hora, 'Glicemia: ' + gl];
    filas = ['<b>' + esc_(r.detalle) + '</b>', '<b>Glicemia:</b> ' + esc_(gl)];
  } else if (r.tipo === 'colacion') {
    asunto = 'MIDOSIS · ' + (hipo ? 'HIPO · ' : '') + 'Colación ' + r.hora + ' · ' + gl;
    lineas = ['Colación · ' + r.fecha + ' a las ' + r.hora, 'Comió: ' + r.detalle, 'Glicemia: ' + gl];
    filas = ['<b>Comió:</b> ' + esc_(r.detalle), '<b>Glicemia:</b> ' + esc_(gl)];
  } else {
    asunto = 'MIDOSIS · Cambio de dosis · por ' + r.usuario + ' · ' + r.hora;
    lineas = ['Cambio de dosis · ' + r.fecha + ' a las ' + r.hora, 'Lo hizo: ' + r.usuario].concat(r.detalle.split(' · '));
    filas = ['<b>Lo hizo:</b> ' + esc_(r.usuario)].concat(r.detalle.split(' · ').map(function (t) { return esc_(t); }));
  }
  if (hipo) lineas.unshift('HIPO');
  if (r.tipo !== 'hipo' && r.glicemia !== null && r.glicemia < GLICEMIA_BAJA) lineas.push('ATENCIÓN: glicemia baja.');
  if (r.glicemia !== null && r.glicemia > 400) lineas.push('ATENCIÓN: glicemia mayor a 400 mg/dL.');
  if (r.tipo === 'hipo' && r.detalle === 'Ya está bien') lineas.push('Ya está bien: glicemia arriba de 80 y subiendo.');
  var titulo = r.tipo === 'dosis' ? r.momento : (r.tipo === 'hipo' ? 'Hipoglicemia' : TIPOS[r.tipo]);
  var html = '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5">' +
    (hipo ? '<div style="background:#c0322b;color:#ffffff;font-size:64px;font-weight:900;letter-spacing:6px;text-align:center;padding:18px 10px;border-radius:14px;margin:0 0 16px">HIPO</div>' : '') +
    '<h2 style="margin:0 0 8px' + (hipo ? ';color:#c0322b' : '') + '">' + esc_(titulo) + ' · ' + esc_(r.hora) + '</h2>' +
    '<p style="margin:0 0 12px;color:#555">' + esc_(r.fecha) + '</p>' +
    filas.map(function (f) { return '<p style="font-size:22px;margin:0 0 6px">' + f + '</p>'; }).join('') +
    (r.fueraHorario ? '<p style="color:#b4600a;font-weight:bold">Registrado fuera del horario habitual.</p>' : '') +
    (r.tipo === 'hipo' && r.detalle === 'Ya está bien' ? '<p style="color:#12805c;font-weight:bold;font-size:20px">Ya está bien: glicemia arriba de 80 y subiendo.</p>' : '') +
    (r.glicemia !== null && r.glicemia > 400 ? '<p style="color:#b4600a;font-weight:bold">ATENCIÓN: glicemia mayor a 400 mg/dL.</p>' : '') +
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
