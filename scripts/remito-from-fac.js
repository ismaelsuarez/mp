// node scripts/remito-from-fac.js path\\to\\archivoR.fac [--all|--print|--email|--whatsapp|--res]
// Emula el flujo de REMITO sin efectos secundarios por defecto (solo PDF local y copias a red)

const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

function usage(msg) {
  if (msg) console.error(msg);
  console.log('Uso: node scripts/remito-from-fac.js path\\to\\archivoR.fac [--all|--print|--email|--whatsapp|--res]');
  process.exit(msg ? 1 : 0);
}

const args = process.argv.slice(2);
if (!args[0]) usage('Falta ruta del archivo .fac (que termine en R.fac)');
const facPath = path.resolve(args[0]);
if (!fs.existsSync(facPath)) usage('El archivo .fac no existe: ' + facPath);

const enableAll = args.includes('--all');
const DO_PRINT = enableAll || args.includes('--print');
const DO_EMAIL = enableAll || args.includes('--email');
const DO_WAPP = enableAll || args.includes('--whatsapp');
const DO_RES  = enableAll || args.includes('--res');

let generateInvoicePdf;
let layoutMendoza;
try {
  ({ generateInvoicePdf } = require('../dist/src/pdfRenderer.js'));
  layoutMendoza = require('../dist/src/invoiceLayout.mendoza.js');
  layoutMendoza = layoutMendoza && (layoutMendoza.default || layoutMendoza);
} catch (e) {
  console.error('No pude cargar módulos construidos en dist/. Ejecuta: npm run build:ts');
  process.exit(1);
}

function parseImporte(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return 0;
  if (/^\d{1,3}(\.\d{3})+,\d{2}$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (s.includes(',') && !s.includes('.')) return Number(s.replace(',', '.'));
  return Number(s);
}

function parseFacRemito(content, fileName) {
  const lines = String(content || '').split(/\r?\n/);
  const get = (key) => {
    const ln = lines.find((l) => l.startsWith(key));
    return ln ? ln.substring(key.length).trim() : '';
  };
  const getBlock = (startKey) => {
    const startIdx = lines.findIndex((l) => l.trim().startsWith(startKey));
    if (startIdx < 0) return [];
    const out = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (/^(OBS\.|ITEM:|TOTALES:|IP:|TIPO:|FONDO:|COPIAS:|CLIENTE:|TIPODOC:|NRODOC:|CONDICION:|IVARECEPTOR:|DOMICILIO:|MONEDA:|DIAHORA:)/.test(t)) break;
      if (t) out.push(t);
    }
    return out;
  };

  const diaHoraRaw = get('DIAHORA:');
  let fechaY = '', horaH = '', term = '';
  try {
    const m = diaHoraRaw.match(/(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+.*?(\d+)$/);
    if (m) { const [, dd, mm, yy, HH, MM, SS, terminal] = m; fechaY = `20${yy}${mm}${dd}`; horaH = `${HH}${MM}${SS}`; term = String(terminal).padStart(2, '0'); }
  } catch {}
  const refInterna = path.basename(fileName, path.extname(fileName)) || `${fechaY.slice(2)}${horaH}${term}R`;
  const fechaISO = fechaY ? `${fechaY.substring(0,4)}-${fechaY.substring(4,6)}-${fechaY.substring(6,8)}` : dayjs().format('YYYY-MM-DD');

  const fondo = get('FONDO:');
  const copias = Number(get('COPIAS:') || '1');
  const email = (get('EMAIL:') || '').trim();
  const whatsapp = (get('WHATSAPP:') || '').trim();

  const clienteRaw = get('CLIENTE:');
  let codigo = '', nombre = clienteRaw.trim();
  const mCli = clienteRaw.match(/^\((\d+)\)\s*(.*)$/);
  if (mCli) { codigo = mCli[1]; nombre = (mCli[2] || '').trim(); }
  const docTipo = Number(get('TIPODOC:') || '0');
  const docNro = get('NRODOC:');
  const condicionTxt = get('CONDICION:');
  const domicilio = get('DOMICILIO:');

  const itemsLines = getBlock('ITEM:');
  const itemsRemito = [];
  for (const rawLn of itemsLines) {
    const ln = String(rawLn || '');
    const mQty = ln.match(/^\s*(\d+)/);
    const mTot = ln.match(/(\d+(?:[\.,]\d+)?)\s*$/);
    let cantidad = 1;
    if (mQty) cantidad = Number(mQty[1]) || 1;
    let total = undefined;
    if (mTot) total = parseImporte(mTot[1]);
    let cuerpo = ln;
    if (mQty) cuerpo = cuerpo.replace(/^\s*\d+\s+/, '');
    if (mTot) cuerpo = cuerpo.replace(/(\d+(?:[\.,]\d+)?)\s*$/, '');
    const descripcion = cuerpo.trim().replace(/\s{2,}/g, ' ');
    if (descripcion) itemsRemito.push({ cantidad, descripcion, total });
  }

  // TOTALES (básico)
  const totLines = getBlock('TOTALES:');
  let neto21 = 0, neto105 = 0, neto27 = 0, exento = 0, iva21 = 0, iva105 = 0, iva27 = 0, total = 0;
  totLines.forEach((t) => {
    const [k, v] = String(t).split(':').map(s => s.trim());
    const val = parseImporte(v || '0');
    if (/NETO21/i.test(k)) neto21 = val;
    else if (/NETO10\.5|NETO105/i.test(k)) neto105 = val;
    else if (/NETO27/i.test(k)) neto27 = val;
    else if (/EXENTO/i.test(k)) exento = val;
    else if (/IVA21/i.test(k)) iva21 = val;
    else if (/IVA10\.5|IVA105/i.test(k)) iva105 = val;
    else if (/IVA27/i.test(k)) iva27 = val;
    else if (/TOTAL/i.test(k)) total = val;
  });

  const cab1Lines = []; // simplificado para pruebas
  const cab2Lines = [];
  const pieLines = [];
  const graciasLine = get('GRACIAS:') || undefined;
  const remitoNum = get('REMITO:') || undefined;

  return {
    tipo: 'REMITO',
    refInterna,
    fechaISO,
    fondo,
    copias,
    email: email || undefined,
    whatsapp: whatsapp || undefined,
    receptor: { codigo, nombre, docTipo, docNro, condicionTxt, domicilio },
    itemsRemito,
    pagos: [],
    totales: { neto21, neto105, neto27, exento, iva21, iva105, iva27, total },
    obs: { cabecera1: cab1Lines, cabecera2: cab2Lines, pie: pieLines },
    gracias: graciasLine,
    remito: remitoNum,
    fiscal: [],
  };
}

function loadRemitoConfig() {
  try {
    const p = path.join(process.cwd(), 'config', 'remito.config.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8') || '{}');
    return {
      pv: Number(j.pv) || 1,
      contador: Number(j.contador) || 1,
      outLocal: typeof j.outLocal === 'string' ? j.outLocal : undefined,
      outRed1: typeof j.outRed1 === 'string' ? j.outRed1 : undefined,
      outRed2: typeof j.outRed2 === 'string' ? j.outRed2 : undefined,
      printerName: typeof j.printerName === 'string' ? j.printerName : undefined,
    };
  } catch {
    return { pv: 1, contador: 1 };
  }
}

async function main() {
  const raw = fs.readFileSync(facPath, 'utf8');
  const tipoMatch = raw.match(/\bTIPO:\s*(\S+)/i);
  const tipo = (tipoMatch?.[1] || '').toUpperCase();
  if (tipo !== 'REMITO') usage('El .fac no es de tipo REMITO');

  const parsed = parseFacRemito(raw, facPath);
  const cfg = loadRemitoConfig();

  const pvStr = String(cfg.pv).padStart(4, '0');
  const nroStr = String(cfg.contador).padStart(8, '0');
  const fileName = `REM_${pvStr}-${nroStr}.pdf`;

  function buildMonthDir(rootDir) {
    if (!rootDir) return null;
    const root = String(rootDir).trim();
    if (!root) return null;
    const venta = path.join(root, `Ventas_PV${Number(cfg.pv)}`);
    const yyyymm = dayjs(parsed.fechaISO).format('YYYYMM');
    const monthDir = path.join(venta, `F${yyyymm}`);
    try { fs.mkdirSync(monthDir, { recursive: true }); } catch {}
    return monthDir;
  }

  const outLocalDir = buildMonthDir(cfg.outLocal || '');
  const outRed1Dir = buildMonthDir(cfg.outRed1 || '');
  const outRed2Dir = buildMonthDir(cfg.outRed2 || '');
  if (!outLocalDir) throw new Error('Ruta Local no configurada para Remitos');
  const localOutPath = path.join(outLocalDir, fileName);

  const clienteNombreFull = (parsed.receptor.codigo ? `(${parsed.receptor.codigo}) ` : '') + (parsed.receptor.nombre || '').trim();
  const data = {
    empresa: { nombre: 'Empresa', domicilio: '', cuit: '', pv: cfg.pv, numero: cfg.contador },
    cliente: { nombre: clienteNombreFull, domicilio: parsed.receptor.domicilio, cuitDni: parsed.receptor.docNro, condicionIva: parsed.receptor.condicionTxt },
    fecha: parsed.fechaISO,
    tipoComprobanteLiteral: 'REMITO',
    tipoComprobanteLetra: 'X',
    referenciaInterna: parsed.refInterna,
    remito: parsed.remito || undefined,
    observaciones: '',
    pieObservaciones: '',
    fiscal: undefined,
    items: parsed.itemsRemito.map((it) => ({ descripcion: it.descripcion, cantidad: it.cantidad, unitario: it.total, iva: 0, total: it.total })),
    netoGravado: (parsed.totales.neto21 || 0) + (parsed.totales.neto105 || 0) + (parsed.totales.neto27 || 0),
    ivaPorAlicuota: { '21': parsed.totales.iva21 || 0, '10.5': parsed.totales.iva105 || 0, '27': parsed.totales.iva27 || 0 },
    ivaTotal: (parsed.totales.iva21 || 0) + (parsed.totales.iva105 || 0) + (parsed.totales.iva27 || 0),
    total: parsed.totales.total,
    cae: '', caeVto: '',
  };

  // Resolver fondo como en la lógica real
  const base = process.cwd();
  const candidates = [path.join(base, 'templates', 'MiFondoRe.jpg'), path.join(base, 'templates', 'MiFondoRm.jpg')];
  const resolveFondoPath = (fondoRaw) => {
    if (!fondoRaw) return null;
    const tryPaths = [];
    const trimmed = String(fondoRaw).trim().replace(/^"|"$/g, '');
    tryPaths.push(trimmed);
    tryPaths.push(trimmed.replace(/\\/g, path.sep).replace(/\//g, path.sep));
    tryPaths.push(path.resolve(trimmed));
    for (const p of tryPaths) { try { if (p && fs.existsSync(p)) return p; } catch {} }
    return null;
  };
  let bgPath = resolveFondoPath(parsed.fondo);
  if (!bgPath) {
    // Si FONDO: trae ruta absoluta que no existe, intentar por nombre base dentro de templates/
    try {
      const baseName = String(parsed.fondo || '').split(/[\\/]/).pop() || '';
      if (baseName) {
        const candidate = path.join(base, 'templates', baseName);
        if (fs.existsSync(candidate)) bgPath = candidate;
      }
    } catch {}
  }
  if (!bgPath) bgPath = candidates.find((p) => fs.existsSync(p)) || path.join(base, 'public', 'Noimage.jpg');

  console.log('[remito-test] Generando PDF en', localOutPath);
  await generateInvoicePdf({ bgPath, outputPath: localOutPath, data, config: layoutMendoza, qrDataUrl: undefined });

  // Copias a Red
  try {
    const name = path.basename(localOutPath);
    const tryCopy = (dstDir) => { if (!dstDir) return; try { fs.copyFileSync(localOutPath, path.join(dstDir, name)); } catch {} };
    tryCopy(outRed1Dir); tryCopy(outRed2Dir);
  } catch {}

  if (DO_PRINT) {
    try {
      console.log('[remito-test] (print) Enviando a impresora:', cfg.printerName || '(predeterminada)');
      const { print } = require('pdf-to-printer');
      await print(path.resolve(localOutPath), { printer: cfg.printerName || undefined, copies: Math.max(1, Number(parsed.copias||1)) });
    } catch (e) { console.warn('[remito-test] print falló:', e?.message || e); }
  }

  if (DO_EMAIL && parsed.email) {
    try {
      console.log('[remito-test] (email) Simulado envío a', parsed.email);
      // Para pruebas reales, usar EmailService como en remitoProcessor
    } catch {}
  }

  if (DO_WAPP && parsed.whatsapp) {
    try {
      console.log('[remito-test] (whatsapp) Simulado wfa + envío a SFTP/FTP');
    } catch {}
  }

  if (DO_RES) {
    try {
      const dir = path.dirname(facPath);
      const baseName = path.basename(facPath, path.extname(facPath));
      const shortBase = baseName.slice(-8).toLowerCase().replace(/.$/, 'r');
      const resPath = path.join(dir, `${shortBase}.res`);
      const now = new Date();
      const fechaStr = dayjs(now).format('DD/MM/YYYY');
      const resLines = [
        'RESPUESTA AFIP    :',
        'CUIT EMPRESA      : 30708673435',
        'MODO              : 0',
        `PUNTO DE VENTA    : ${String(cfg.pv).padStart(5, '0').slice(-5)}`,
        `NUMERO COMPROBANTE: ${String(cfg.contador).padStart(8,'0')}`,
        `FECHA COMPROBANTE : ${fechaStr}`,
        'NUMERO CAE        :',
        'VENCIMIENTO CAE   : 0',
        `ARCHIVO REFERENCIA: ${path.basename(facPath)}`,
        `ARCHIVO PDF       : ${path.basename(localOutPath)}`,
        '',
      ];
      fs.writeFileSync(resPath, (raw.replace(/\s*$/,'') + '\n' + resLines.join('\n')), 'utf8');
      console.log('[remito-test] .res generado (no enviado):', resPath);
    } catch (e) { console.warn('[remito-test] res falló:', e?.message || e); }
  }

  console.log('[remito-test] OK');
}

main().catch((e) => {
  console.error('[remito-test] Error:', e?.message || e);
  process.exit(1);
});


