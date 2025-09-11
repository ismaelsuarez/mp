// node scripts/recibo-from-fac.js src/modules/facturacion/plantilla/25091114433149Q.fac
// Genera un recibo PDF a partir de un .fac (no AFIP)
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

// Cargar el build transpile (dist) si existe, o TS en dev
let generateInvoicePdf;
try {
  ({ generateInvoicePdf } = require('../dist/src/pdfRenderer'));
} catch {
  ({ generateInvoicePdf } = require('../src/pdfRenderer'));
}

function parseFacRecibo(content, fileName) {
  const lines = String(content || '').split(/\r?\n/);
  const get = (key) => {
    const ln = lines.find((l) => l.startsWith(key));
    return ln ? ln.substring(key.length).trim() : '';
  };
  const diaHoraRaw = get('DIAHORA:'); // ej 11/09/25 14:43:31 yp49
  let fechaY = '';
  let horaH = '';
  let term = '';
  try {
    const m = diaHoraRaw.match(/(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+.*?(\d+)$/);
    if (m) {
      const [ , dd, mm, yy, HH, MM, SS, terminal ] = m;
      fechaY = `20${yy}${mm}${dd}`; // YYYYMMDD
      horaH = `${HH}${MM}${SS}`;
      term = String(terminal).padStart(2,'0');
    }
  } catch {}
  const refInterna = path.basename(fileName, path.extname(fileName)) || `${fechaY.slice(2)}${horaH}${term}Q`;
  // Receptor
  const clienteRaw = get('CLIENTE:');
  let codigo = '', nombre = clienteRaw.trim();
  const mCli = clienteRaw.match(/^\((\d+)\)\s*(.*)$/);
  if (mCli) { codigo = mCli[1]; nombre = mCli[2].trim(); }
  const docTipo = Number(get('TIPODOC:') || '0');
  const docNro = (get('NRODOC:') || '').trim();
  const condicionTxt = get('CONDICION:');
  const ivaReceptor = (get('IVARECEPTOR:') || '').trim();
  const domicilio = get('DOMICILIO:');
  // Pagos
  const startItems = lines.findIndex(l => l.trim() === 'ITEM:');
  const pagos = [];
  if (startItems >= 0) {
    for (let i = startItems + 1; i < lines.length; i++) {
      const l = lines[i];
      if (/^TOTALES:/.test(l)) break;
      const m = l.match(/\s*\d+\s+([^:]+):([^\s]+).*?(\d+[\.,]?\d*)\s*$/);
      if (m) {
        const medio = m[1].trim();
        const detalle = m[2].trim();
        const imp = Number(String(m[3]).replace(/\./g,'').replace(',','.'));
        pagos.push({ medio, detalle, importe: imp });
      }
    }
  }
  // Totales
  const totalLine = lines.find(l => /^TOTAL\s*:/.test(l));
  let total = 0;
  if (totalLine) total = Number(totalLine.split(':')[1].trim());
  return {
    refInterna,
    receptor: { codigo, nombre, docTipo, docNro, condicionTxt, ivaReceptor, domicilio },
    pagos,
    total
  };
}

async function main() {
  const facPath = process.argv[2];
  if (!facPath) {
    console.error('Uso: node scripts/recibo-from-fac.js <ruta .fac>');
    process.exit(1);
  }
  const raw = fs.readFileSync(facPath, 'utf8');
  const parsed = parseFacRecibo(raw, facPath);
  // Render PDF recibo (reutilizamos renderer con un layout simple)
  const base = process.cwd();
  const bgCandidates = [
    path.join(base, 'templates', 'MiFondoRe.jpg'),
    path.join(base, 'templates', 'MiFondoRm.jpg')
  ];
  let bgPath = bgCandidates.find(p => fs.existsSync(p));
  if (!bgPath) bgPath = path.join(base, 'public', 'Noimage.jpg');
  const outDir = path.join(base, 'tmp');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
  const outPath = path.join(outDir, `REC_TEST_${parsed.refInterna}.pdf`);

  const data = {
    empresa: { nombre: 'Empresa', domicilio: '', cuit: '', pv: 16, numero: 2846 },
    cliente: { nombre: parsed.receptor.nombre, cuitDni: parsed.receptor.docNro, condicionIva: parsed.receptor.condicionTxt },
    fecha: dayjs().format('YYYY-MM-DD'),
    tipoComprobanteLiteral: 'RECIBO',
    referenciaInterna: parsed.refInterna,
    mipymeModo: undefined,
    items: parsed.pagos.map(p => ({ descripcion: `${p.medio}:${p.detalle}`, cantidad: 1, unitario: p.importe, iva: 0 })),
    netoGravado: 0,
    ivaPorAlicuota: {},
    ivaTotal: 0,
    total: parsed.total,
    cae: '',
    caeVto: ''
  };

  let layout;
  try {
    const m = require('../dist/src/invoiceLayout.mendoza.js');
    layout = m && (m.default || m);
  } catch (e) {
    console.error('No se encontró el layout compilado. Ejecutá: npm run build:ts');
    throw e;
  }
  if (!layout || !layout.coords || !layout.coords.clienteNombre) {
    throw new Error('Layout inválido o sin coordenadas. Ejecutá "npm run build:ts" y reintenta.');
  }

  await generateInvoicePdf({
    bgPath,
    outputPath: outPath,
    data,
    config: layout,
    qrDataUrl: undefined
  });
  console.log('Recibo generado:', outPath);
}

main().catch(e => { console.error(e?.message || e); process.exit(2); });


