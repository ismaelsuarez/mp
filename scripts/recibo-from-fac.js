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
  const fechaISO = fechaY ? `${fechaY.substring(0,4)}-${fechaY.substring(4,6)}-${fechaY.substring(6,8)}` : dayjs().format('YYYY-MM-DD');
  const horaPrint = diaHoraRaw ? (diaHoraRaw.split(' ')[1] || '').trim() : '';
  // Cabecera
  const ip = get('IP:');
  const tipo = (get('TIPO:') || 'RECIBO').toUpperCase();
  const fondo = get('FONDO:');
  const copias = Number(get('COPIAS:') || '1');
  const moneda = get('MONEDA:') || 'PESOS';
  // Receptor
  const clienteRaw = get('CLIENTE:');
  let codigo = '', nombre = clienteRaw.trim();
  const mCli = clienteRaw.match(/^\((\d+)\)\s*(.*)$/);
  if (mCli) { codigo = mCli[1]; nombre = mCli[2].trim(); }
  const docTipo = Number(get('TIPODOC:') || '0');
  const DOC_TIPO_LABEL = {
    80: 'C.U.I.T.',
    86: 'C.U.I.L.',
    87: 'C.D.I.',
    89: 'L.E.',
    90: 'L.C.',
    96: 'D.N.I.',
    94: 'PASAPORTE',
  };
  const docTipoLabel = DOC_TIPO_LABEL[docTipo] || '';
  const docNro = (get('NRODOC:') || '').trim();
  const condicionTxt = get('CONDICION:');
  const ivaReceptor = (get('IVARECEPTOR:') || '').trim();
  const domicilio = get('DOMICILIO:');
  // Pagos
  const startItems = lines.findIndex(l => l.trim() === 'ITEM:');
  const pagos = [];
  const itemsRecibo = [];
  if (startItems >= 0) {
    for (let i = startItems + 1; i < lines.length; i++) {
      const l = lines[i];
      if (/^TOTALES:/.test(l)) break;
      // Pagos (compat anterior: MEDIO:DETALLE ... IMPORTE)
      const mPago = l.match(/\s*\d+\s+([^:]+):([^\s]+).*?(\d+[\.,]?\d*)\s*$/);
      if (mPago) {
        const medio = mPago[1].trim();
        const detalle = mPago[2].trim();
        const imp = Number(String(mPago[3]).replace(/\./g,'').replace(',','.'));
        pagos.push({ medio, detalle, importe: imp });
      }
      // Items recibo (Cantidad, Descripción libre, Total al final de la línea)
      const mTot = l.match(/(\d+(?:[\.,]\d+)?)\s*$/);
      const mQty = l.match(/^\s*(\d+)/);
      if (mTot && mQty) {
        const totalNum = Number(String(mTot[1]).replace(/\./g,'').replace(',','.'));
        const cantidadNum = Number(mQty[1]);
        let cuerpo = String(l);
        cuerpo = cuerpo.replace(/^\s*\d+\s+/, '');
        cuerpo = cuerpo.replace(/(\d+(?:[\.,]\d+)?)\s*$/, '');
        const descripcion = cuerpo.trim().replace(/\s{2,}/g, ' ');
        if (descripcion) itemsRecibo.push({ cantidad: cantidadNum || 1, descripcion, total: totalNum });
      }
    }
  }
  // Totales
  const totalLine = lines.find(l => /^TOTAL\s*:/.test(l));
  let total = 0;
  if (totalLine) total = Number(totalLine.split(':')[1].trim());
  // Parseo de bloque TOTALES detallado
  const startTotals = lines.findIndex(l => l.trim() === 'TOTALES:');
  const totales = { neto21: 0, neto105: 0, neto27: 0, exento: 0, iva21: 0, iva105: 0, iva27: 0, total };
  if (startTotals >= 0) {
    for (let i = startTotals + 1; i < lines.length; i++) {
      const t = lines[i];
      if (/^(OBS\.|ITEM:|IP:|TIPO:|FONDO:|COPIAS:|CLIENTE:|TIPODOC:|NRODOC:|CONDICION:|IVARECEPTOR:|DOMICILIO:|MONEDA:|DIAHORA:|TOTALES:$)/.test(t.trim())) break;
      const kv = t.match(/^(NETO 21%|NETO 10\.5%|NETO 27%|EXENTO|IVA 21%|IVA 10\.5%|IVA 27%|TOTAL)\s*:\s*([\d\.,]+)$/i);
      if (kv) {
        const key = kv[1].toUpperCase();
        const val = Number(kv[2].replace(/\./g, '').replace(',', '.'));
        if (key === 'NETO 21%') totales.neto21 = val;
        else if (key === 'NETO 10.5%') totales.neto105 = val;
        else if (key === 'NETO 27%') totales.neto27 = val;
        else if (key === 'EXENTO') totales.exento = val;
        else if (key === 'IVA 21%') totales.iva21 = val;
        else if (key === 'IVA 10.5%') totales.iva105 = val;
        else if (key === 'IVA 27%') totales.iva27 = val;
        else if (key === 'TOTAL') totales.total = val;
      }
    }
  }
  // Observaciones
  const cab1Lines = getBlock('OBS.CABCERA1:');
  const cab2LinesRaw = getBlock('OBS.CABCERA2:');
  let remitoNum = '';
  const cab2Lines = cab2LinesRaw.filter((ln) => {
    const mRem = ln.match(/REMITO:\s*(.*)/i);
    if (mRem) {
      remitoNum = (mRem[1] || '').trim();
      return false; // excluir línea REMITO del texto visible
    }
    return true;
  });
  const pieAll = [...getBlock('OBS.PIE:'), ...getBlock('OBS.PIE:1')];
  let graciasLine = '';
  const pieLines = [];
  for (const ln of pieAll) {
    if (!ln || ln === '.') continue;
    if (!graciasLine && /gracias/i.test(ln)) {
      graciasLine = (ln || '').trim();
      continue;
    }
    pieLines.push(ln);
  }
  let atendio = '', hora = '', mail = '';
  const cab1Text = cab1Lines.join(' | ');
  const mAt = cab1Text.match(/Atendio:\s*([^|]+)/i); if (mAt) atendio = `Atendio: ${mAt[1].trim()}`;
  const mHr = cab1Text.match(/Hora:\s*([^|]+)/i); if (mHr) hora = `Hora: ${mHr[1].trim()}`;
  const mMl = cab1Text.match(/Mail:\s*([^|]+)/i); if (mMl) mail = mMl[1].trim();
  let pago = '';
  const mPg = cab1Text.match(/Pago:\s*([^|]+)/i); if (mPg) pago = mPg[1].trim();
  return {
    refInterna,
    ip, tipo, fondo, copias, moneda,
    fechaISO, horaPrint,
    receptor: { codigo, nombre, docTipo, docTipoLabel, docNro, condicionTxt, ivaReceptor, domicilio },
    pagos,
    itemsRecibo,
    total: totales.total,
    totales,
    obs: { cabecera1: cab1Lines, cabecera2: cab2Lines, pie: pieLines, atendio, hora, mail, pago },
    gracias: graciasLine,
    remito: remitoNum
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
  function resolveFondoPath(fondoRaw) {
    if (!fondoRaw) return null;
    const tryPaths = [];
    const trimmed = String(fondoRaw).trim().replace(/^"|"$/g, '');
    tryPaths.push(trimmed);
    tryPaths.push(trimmed.replace(/\\/g, path.sep).replace(/\//g, path.sep));
    tryPaths.push(path.resolve(trimmed));
    for (const p of tryPaths) {
      try { if (p && fs.existsSync(p)) return p; } catch {}
    }
    return null;
  }
  let bgPath = resolveFondoPath(parsed.fondo);
  if (!bgPath) bgPath = bgCandidates.find(p => fs.existsSync(p));
  if (!bgPath) bgPath = path.join(base, 'public', 'Noimage.jpg');
  const outDir = path.join(base, 'tmp');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
  const outPath = path.join(outDir, `REC_TEST_${parsed.refInterna}.pdf`);

  const clienteNombreFull = (parsed.receptor.codigo ? `(${parsed.receptor.codigo}) ` : '') + (parsed.receptor.nombre || '').trim();
  const data = {
    empresa: { nombre: 'Empresa', domicilio: '', cuit: '', pv: 16, numero: 2846 },
    cliente: { nombre: clienteNombreFull, domicilio: parsed.receptor.domicilio, cuitDni: parsed.receptor.docNro, condicionIva: parsed.receptor.condicionTxt },
    fecha: parsed.fechaISO,
    hora: parsed.obs.hora || undefined,
    atendio: parsed.obs.atendio || undefined,
    condicionPago: parsed.obs.pago || undefined,
    email: parsed.obs.mail || undefined,
    tipoComprobanteLiteral: 'RECIBO',
    referenciaInterna: parsed.refInterna,
    remito: parsed.remito || undefined,
    gracias: parsed.gracias || undefined,
    mipymeModo: undefined,
    observaciones: parsed.obs.cabecera2.filter(Boolean).slice(0,2).join('\n'),
    // Mantener orden original en pie y conservar saltos de línea
    pieObservaciones: parsed.obs.pie.filter(Boolean).join('\n'),
    items: (parsed.itemsRecibo && parsed.itemsRecibo.length > 0)
      ? parsed.itemsRecibo.map(it => ({ descripcion: it.descripcion, cantidad: it.cantidad, unitario: it.total, iva: 0, total: it.total }))
      : parsed.pagos.map(p => ({ descripcion: `${p.medio}:${p.detalle}`, cantidad: 1, unitario: p.importe, iva: 0 })),
    // En recibo ocultamos líneas en cero, pero dejamos totales mapeados por compat
    netoGravado: (parsed.totales.neto21 || 0) + (parsed.totales.neto105 || 0) + (parsed.totales.neto27 || 0),
    ivaPorAlicuota: {
      '21': parsed.totales.iva21 || 0,
      '10.5': parsed.totales.iva105 || 0,
      '27': parsed.totales.iva27 || 0,
    },
    ivaTotal: (parsed.totales.iva21 || 0) + (parsed.totales.iva105 || 0) + (parsed.totales.iva27 || 0),
    total: parsed.totales.total,
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
  // Chequeos en consola
  console.log('[RECIBO] Copias (COPIAS:):', isNaN(parsed.copias) ? '(no definido → 1 por defecto)' : parsed.copias);
  console.log('[RECIBO] Fondo (FONDO:):', parsed.fondo || '(no provisto)');
  console.log('[RECIBO] Fondo usado:', bgPath);
  console.log('[RECIBO] Moneda (no usada en recibo):', parsed.moneda || 'PESOS');
  console.log('[RECIBO] Ref.Interna:', parsed.refInterna);
  console.log('[RECIBO] Cliente:', parsed.receptor.codigo, '-', parsed.receptor.nombre);
  console.log('[RECIBO] Doc:', `${parsed.receptor.docTipoLabel || parsed.receptor.docTipo}`, parsed.receptor.docNro, '| IVA:', parsed.receptor.condicionTxt);
  if (parsed.remito) {
    console.log('[RECIBO] Remito:', parsed.remito);
  }
  if (parsed.obs && parsed.obs.cabecera2 && parsed.obs.cabecera2.length) {
    console.log('[RECIBO] OBS.CABCERA2:', parsed.obs.cabecera2);
  }
  if (parsed.itemsRecibo && parsed.itemsRecibo.length) {
    console.log('[RECIBO] Items (cantidad, descripción, total):', parsed.itemsRecibo);
  }
  console.log('[RECIBO] Pagos:', parsed.pagos);
  const sumaPagos = parsed.pagos.reduce((a,b)=>a+(b.importe||0),0);
  console.log('[RECIBO] Total (fac):', parsed.total, '| Suma pagos:', sumaPagos);
  if (Math.abs((parsed.total||0) - sumaPagos) > 0.001) {
    console.warn('[RECIBO][WARN] El TOTAL no coincide con la suma de pagos.');
  }
  console.log('Recibo generado:', outPath);
}

main().catch(e => { console.error(e?.message || e); process.exit(2); });


