/*
  Genera un PDF de prueba usando la plantilla HTML (sin llamar a AFIP).

  Uso:
    node scripts/pdf-mock.js --tipo=1 --pto=16 --nro=99999 --bg="src/modules/facturacion/plantilla/MiFondo-pagado.jpg"
*/
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const Handlebars = require('handlebars');
const QRCode = require('qrcode');
const puppeteer = require('puppeteer');

function parseArgs() {
  const out = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function buildQr(url) {
  if (!url) return undefined;
  return QRCode.toDataURL(url, { width: 240 });
}

async function main() {
  const args = parseArgs();
  const tipo = Number(args.tipo || 1); // 1=A, 6=B, 11=C
  const pto = Number(args.pto || 16);
  const nro = Number(args.nro || 99999);
  const bg = args.bg ? path.resolve(args.bg) : null;
  const fechaStr = (args.fecha || '2025-09-01'); // YYYY-MM-DD
  const caeStr = (args.cae || '70412345678901');
  const caeVtoStr = (args.caevto || '20250911'); // YYYYMMDD

  // Seleccionar plantilla por tipo
  const tplMap = { 1: 'factura_a.html', 6: 'factura_b.html', 11: 'factura_a.html' };
  const tplName = tplMap[tipo] || 'factura_a.html';
  const tplPath = path.join(process.cwd(), 'templates', tplName);
  if (!fs.existsSync(tplPath)) throw new Error('No existe plantilla: ' + tplPath);

  const titulo = tipo === 1 ? 'Factura A' : tipo === 6 ? 'Factura B' : tipo === 11 ? 'Factura C' : 'Factura';

  const qrPayload = {
    ver: 1,
    fecha: fechaStr,
    cuit: 30708673435,
    ptoVta: pto,
    tipoCmp: tipo,
    nroCmp: nro,
    importe: 0.22,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: 80,
    nroDocRec: 20300123456,
    tipoCodAut: 'E',
    codAut: 70412345678901
  };
  const qrUrl = 'https://www.afip.gob.ar/fe/qr/?p=' + Buffer.from(JSON.stringify(qrPayload)).toString('base64');
  const qrDataUrl = await buildQr(qrUrl);

  const viewModel = {
    titulo,
    emisor: { nombre: 'TODO-COMPUTACIÓN', cuit: '20123456789' },
    receptor: { nombre: 'Cliente Demo S.A.', cuit: '20300123456', condicionIva: 'RI' },
    cbte: { tipo: String(tipo), pto_vta: pto, numero: nro, fecha: fechaStr.replace(/-/g,'') },
    detalle: [ { descripcion: 'Libro técnico informática', cantidad: 1, precioUnitario: 0.2, importe: 0.2, alicuotaIva: 10.5 } ],
    totales: { neto: 0.2, iva: 0.021, total: 0.221 },
    afip: { cae: caeStr, cae_vto: caeVtoStr },
    fecha_larga: dayjs(fechaStr).format('DD/MM/YYYY'),
    nro_formateado: String(nro).padStart(8,'0'),
    qr_data_url: qrDataUrl,
    backgroundPath: bg && fs.existsSync(bg) ? bg : undefined
  };

  const html = Handlebars.compile(fs.readFileSync(tplPath, 'utf8'))(viewModel);
  const outDir = path.join(process.cwd(), 'factura');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
  const outPath = path.join(outDir, `${titulo.replace(/\s+/g,'_').toUpperCase()}_${pto}-${String(nro).padStart(8,'0')}.pdf`);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({ path: outPath, printBackground: true, format: 'A4', margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
  } finally {
    try { await browser.close(); } catch {}
  }

  console.log('PDF generado:', outPath);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });


