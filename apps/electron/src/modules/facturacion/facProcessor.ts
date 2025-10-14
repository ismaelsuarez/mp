import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import dayjs from 'dayjs';
import { generateInvoicePdf } from '../../../../../src/pdfRenderer';
import { getDb } from '@infra/database';
import layoutMendoza from '../../../../../src/invoiceLayout.mendoza';
import { sendArbitraryFile } from '@infra/ftp';
import { validateSystemTime } from '../../../../../src/modules/facturacion/utils/TimeValidator';

type ParsedRecibo = {
  tipo: 'RECIBO';
  refInterna: string;
  fechaISO: string;
  horaPrint?: string;
  fondo?: string;
  copias: number;
  moneda?: string;
  email?: string;
  whatsapp?: string;
  receptor: {
    codigo?: string;
    nombre: string;
    docTipo?: number;
    docNro?: string;
    condicionTxt?: string;
    ivaReceptor?: string;
    domicilio?: string;
  };
  itemsRecibo: Array<{ cantidad: number; descripcion: string; total: number }>;
  itemsRawLines: string[]; // ✅ Líneas RAW entre ITEM: y TOTALES:
  pagos: Array<{ medio: string; detalle: string; importe: number }>;
  totales: { neto21: number; neto105: number; neto27: number; exento: number; iva21: number; iva105: number; iva27: number; total: number };
  obs: {
    cabecera1: string[];
    cabecera2: string[];
    pie: string[];
    atendio?: string;
    hora?: string;
    mail?: string;
    pago?: string;
  };
  gracias?: string;
  remito?: string;
  fiscal?: string[];
};

function parseImporte(raw: unknown): number {
  const s = String(raw ?? '').trim();
  if (!s) return 0;
  if (/^\d{1,3}(\.\d{3})+,\d{2}$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (s.includes(',') && !s.includes('.')) return Number(s.replace(',', '.'));
  return Number(s);
}

function parseFacRecibo(content: string, fileName: string): ParsedRecibo {
  const lines = String(content || '').split(/\r?\n/);
  const get = (key: string) => {
    const ln = lines.find((l) => l.startsWith(key));
    return ln ? ln.substring(key.length).trim() : '';
  };
  const getBlock = (startKey: string) => {
    const startIdx = lines.findIndex((l) => l.trim().startsWith(startKey));
    if (startIdx < 0) return [] as string[];
    const out: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (/^(OBS\.|ITEM:|TOTALES:|IP:|TIPO:|FONDO:|COPIAS:|CLIENTE:|TIPODOC:|NRODOC:|CONDICION:|IVARECEPTOR:|DOMICILIO:|MONEDA:|DIAHORA:)/.test(t)) break;
      if (t) out.push(t);
    }
    return out;
  };

  const diaHoraRaw = get('DIAHORA:');
  let fechaY = '';
  let horaH = '';
  let term = '';
  try {
    const m = diaHoraRaw.match(/(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+.*?(\d+)$/);
    if (m) {
      const [, dd, mm, yy, HH, MM, SS, terminal] = m;
      fechaY = `20${yy}${mm}${dd}`; // YYYYMMDD
      horaH = `${HH}${MM}${SS}`;
      term = String(terminal).padStart(2, '0');
    }
  } catch {}
  const refInterna = path.basename(fileName, path.extname(fileName)) || `${fechaY.slice(2)}${horaH}${term}Q`;
  const fechaISO = fechaY ? `${fechaY.substring(0, 4)}-${fechaY.substring(4, 6)}-${fechaY.substring(6, 8)}` : dayjs().format('YYYY-MM-DD');

  const fondo = get('FONDO:');
  const copias = Number(get('COPIAS:') || '1');
  const moneda = get('MONEDA:') || 'PESOS';
  const emailRaw = get('EMAIL:');
  const email = (emailRaw || '').trim();
  const whatsappRaw = get('WHATSAPP:');
  const whatsapp = (whatsappRaw || '').trim();

  // Receptor
  const clienteRaw = get('CLIENTE:');
  let codigo = '', nombre = clienteRaw.trim();
  const mCli = clienteRaw.match(/^\((\d+)\)\s*(.*)$/);
  if (mCli) { codigo = mCli[1]; nombre = (mCli[2] || '').trim(); }
  const docTipo = Number(get('TIPODOC:') || '0');
  const docNro = (get('NRODOC:') || '').trim();
  const condicionTxt = get('CONDICION:');
  const ivaReceptor = (get('IVARECEPTOR:') || '').trim();
  const domicilio = get('DOMICILIO:');

  // Items/Pagos + Captura RAW
  const startItems = lines.findIndex((l) => l.trim() === 'ITEM:');
  const totStart = lines.findIndex((l) => l.trim() === 'TOTALES:');
  const pagos: ParsedRecibo['pagos'] = [];
  const itemsRecibo: ParsedRecibo['itemsRecibo'] = [];
  const itemsRawLines: string[] = []; // ✅ Captura RAW (modo "dump directo")
  
  if (startItems >= 0) {
    const end = totStart > startItems ? totStart : lines.length;
    for (let i = startItems + 1; i < end; i++) {
      const l = lines[i];
      if (/^TOTALES:/.test(l)) break;
      
      // ✅ Capturar línea RAW completa (con espacios del inicio)
      if (l && l.trim()) {
        itemsRawLines.push(l);
      }
      
      // Parseo para pagos (legacy - por si acaso)
      const mPago = l.match(/\s*\d+\s+([^:]+):([^\s]+).*?(\d+[\.,]?\d*)\s*$/);
      if (mPago) {
        const medio = mPago[1].trim();
        const detalle = mPago[2].trim();
        const imp = parseImporte(mPago[3]);
        pagos.push({ medio, detalle, importe: imp });
      }
      
      // Parseo para items (legacy - por si acaso)
      const mTot = l.match(/(\d+(?:[\.,]\d+)?)\s*$/);
      const mQty = l.match(/^\s*(\d+)/);
      if (mTot && mQty) {
        const totalNum = parseImporte(mTot[1]);
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
  const totalLine = lines.find((l) => /^TOTAL\s*:/.test(l));
  let total = 0;
  if (totalLine) total = parseImporte(totalLine.split(':')[1]);
  const startTotals = lines.findIndex((l) => l.trim() === 'TOTALES:');
  const totales = { neto21: 0, neto105: 0, neto27: 0, exento: 0, iva21: 0, iva105: 0, iva27: 0, total };
  if (startTotals >= 0) {
    for (let i = startTotals + 1; i < lines.length; i++) {
      const t = lines[i];
      if (/^(OBS\.|ITEM:|IP:|TIPO:|FONDO:|COPIAS:|CLIENTE:|TIPODOC:|NRODOC:|CONDICION:|IVARECEPTOR:|DOMICILIO:|MONEDA:|DIAHORA:|TOTALES:$)/.test(t.trim())) break;
      const kv = t.match(/^(NETO 21%|NETO 10\.5%|NETO 27%|EXENTO|IVA 21%|IVA 10\.5%|IVA 27%|TOTAL)\s*:\s*([\d\.,]+)$/i);
      if (kv) {
        const key = kv[1].toUpperCase();
        const val = parseImporte(kv[2]);
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
    if (mRem) { remitoNum = (mRem[1] || '').trim(); return false; }
    return true;
  });
  const pieAll = [...getBlock('OBS.PIE:'), ...getBlock('OBS.PIE:1')];
  const fiscalLines = getBlock('OBS.FISCAL:');
  let graciasLine = '';
  const wrapLine = (text: string, limit = 120): string[] => {
    const out: string[] = [];
    let t = (text || '').trim();
    while (t.length > limit) {
      let cut = t.lastIndexOf(' ', limit);
      if (cut <= 0) cut = limit;
      out.push(t.slice(0, cut).trimEnd());
      t = t.slice(cut).trimStart();
    }
    if (t) out.push(t);
    return out;
  };
  const pieWrapped: string[] = [];
  for (const ln of pieAll) {
    if (!ln || ln === '.') continue;
    const s = (ln || '').trim();
    if (!graciasLine && /gracias/i.test(s)) { graciasLine = s; continue; }
    pieWrapped.push(...wrapLine(s, 120));
  }
  let atendio = '', hora = '', mail = '';
  const cab1Text = cab1Lines.join(' | ');
  const mAt = cab1Text.match(/Atendio:\s*([^|]+)/i); if (mAt) atendio = `Atendio: ${mAt[1].trim()}`;
  const mHr = cab1Text.match(/Hora:\s*([^|]+)/i); if (mHr) hora = `Hora: ${mHr[1].trim()}`;
  const mMl = cab1Text.match(/Mail:\s*([^|]+)/i); if (mMl) mail = mMl[1].trim();
  const mPg = cab1Text.match(/Pago:\s*([^|]+)/i); const pago = mPg ? mPg[1].trim() : '';

  return {
    tipo: 'RECIBO',
    refInterna,
    fechaISO,
    horaPrint: (diaHoraRaw.split(' ')[1] || '').trim(),
    fondo,
    copias,
    moneda,
    email: email || undefined,
    whatsapp: whatsapp || undefined,
    receptor: { codigo, nombre, docTipo, docNro, condicionTxt, ivaReceptor, domicilio },
    itemsRecibo,
    itemsRawLines, // ✅ Líneas RAW entre ITEM: y TOTALES:
    pagos,
    totales,
    obs: { cabecera1: cab1Lines, cabecera2: cab2Lines, pie: pieWrapped, atendio, hora, mail, pago },
    gracias: graciasLine,
    remito: remitoNum,
    fiscal: fiscalLines,
  };
}

function loadReciboConfig(cfgPath: string): { pv: number; contador: number; outLocal?: string; outRed1?: string; outRed2?: string; printerName?: string } {
  try {
    const txt = fs.readFileSync(cfgPath, 'utf8');
    const json = JSON.parse(txt || '{}');
    return {
      pv: Number(json.pv) || 1,
      contador: Number(json.contador) || 1,
      outLocal: typeof json.outLocal === 'string' ? json.outLocal : undefined,
      outRed1: typeof json.outRed1 === 'string' ? json.outRed1 : undefined,
      outRed2: typeof json.outRed2 === 'string' ? json.outRed2 : undefined,
      printerName: typeof json.printerName === 'string' ? json.printerName : undefined,
    };
  } catch {
    return { pv: 1, contador: 1 };
  }
}
function saveReciboConfig(cfgPath: string, cfg: { pv: number; contador: number }) {
  try { fs.mkdirSync(path.dirname(cfgPath), { recursive: true }); } catch {}
  let existing: any = {};
  try { const t = fs.readFileSync(cfgPath, 'utf8'); existing = JSON.parse(t || '{}'); } catch {}
  const next = { ...existing, pv: cfg.pv, contador: cfg.contador };
  fs.writeFileSync(cfgPath, JSON.stringify(next, null, 2));
}

function readTextSmart(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  // Intentar UTF-8; si aparecen muchos �, intentar Windows-1252/Latin1 y normalizar
  let txtUtf8 = buf.toString('utf8');
  const badUtf = (txtUtf8.match(/\uFFFD/g) || []).length;
  if (badUtf === 0) return txtUtf8;
  let txtL1 = buf.toString('latin1');
  // Mapear rangos 0x80-0x9F de CP1252 a Unicode (comillas, guiones, etc.)
  const cp1252Map: Record<number, string> = {
    0x80: '\u20AC', 0x82: '\u201A', 0x83: '\u0192', 0x84: '\u201E', 0x85: '\u2026', 0x86: '\u2020', 0x87: '\u2021',
    0x88: '\u02C6', 0x89: '\u2030', 0x8A: '\u0160', 0x8B: '\u2039', 0x8C: '\u0152', 0x8E: '\u017D',
    0x91: '\u2018', 0x92: '\u2019', 0x93: '\u201C', 0x94: '\u201D', 0x95: '\u2022', 0x96: '\u2013', 0x97: '\u2014',
    0x98: '\u02DC', 0x99: '\u2122', 0x9A: '\u0161', 0x9B: '\u203A', 0x9C: '\u0153', 0x9E: '\u017E', 0x9F: '\u0178'
  };
  let out = '';
  for (let i = 0; i < txtL1.length; i++) {
    const code = txtL1.charCodeAt(i);
    if (code >= 0x80 && code <= 0x9F && cp1252Map[code]) {
      out += JSON.parse('"' + cp1252Map[code] + '"');
    } else {
      out += txtL1[i];
    }
  }
  // Normalizar a NFC para caracteres acentuados/ñ
  try { out = out.normalize('NFC'); } catch {}
  return out;
}

export async function processFacFile(fullPath: string): Promise<string> {
  const raw = readTextSmart(fullPath);
  // Log enviado desde ContingencyController, no duplicar aquí
  const tipoMatch = raw.match(/\bTIPO:\s*(\S+)/i);
  const tipo = (tipoMatch?.[1] || '').toUpperCase();
  if (tipo !== 'RECIBO') throw new Error('FAC no RECIBO (aún no soportado)');

  const parsed = parseFacRecibo(raw, fullPath);

  const base = process.cwd();
  // Usar carpeta de datos del usuario en instalación (permite escritura). Migrar si existe legacy.
  let cfgPath = (() => { try { return path.join(app.getPath('userData'), 'config', 'recibo.config.json'); } catch { return path.join(base, 'config', 'recibo.config.json'); } })();
  try {
    const userPath = cfgPath;
    const legacy = path.join(base, 'config', 'recibo.config.json');
    if (!fs.existsSync(userPath) && fs.existsSync(legacy)) {
      try { fs.mkdirSync(path.dirname(userPath), { recursive: true }); fs.copyFileSync(legacy, userPath); } catch {}
    }
  } catch {}
  const reciboCfg = loadReciboConfig(cfgPath);

  // Fondo
  const candidates = [
    path.join(base, 'templates', 'MiFondoRe.jpg'),
    path.join(base, 'templates', 'MiFondoRm.jpg'),
    // empaquetado
    (()=>{ try { return path.join(app.getAppPath(), 'templates', 'MiFondoRe.jpg'); } catch { return ''; } })(),
    (()=>{ try { return path.join(app.getAppPath(), 'templates', 'MiFondoRm.jpg'); } catch { return ''; } })()
  ].filter(Boolean as any);
  const resolveFondoPath = (fondoRaw?: string | null) => {
    if (!fondoRaw) return null as string | null;
    const tryPaths: string[] = [];
    const trimmed = String(fondoRaw).trim().replace(/^"|"$/g, '');
    tryPaths.push(trimmed);
    tryPaths.push(trimmed.replace(/\\/g, path.sep).replace(/\//g, path.sep));
    tryPaths.push(path.resolve(trimmed));
    // Intentar por nombre de archivo dentro de templates del proyecto y del empaquetado
    try {
      const baseName = trimmed.split(/[\\\/]/).pop() || '';
      if (baseName) {
        tryPaths.push(path.join(base, 'templates', baseName));
        try {
          tryPaths.push(path.join(app.getAppPath(), 'templates', baseName));
        } catch {}
      }
    } catch {}
    for (const p of tryPaths) { try { if (p && fs.existsSync(p)) return p; } catch {} }
    return null as string | null;
  };
  let bgPath = resolveFondoPath(parsed.fondo);
  if (!bgPath) {
    const fallbackPublic = (() => { try { return path.join(app.getAppPath(), 'public', 'Noimage.jpg'); } catch { return path.join(base, 'public', 'Noimage.jpg'); } })();
    bgPath = candidates.find((p) => fs.existsSync(p)) || fallbackPublic;
  }

  // Construcción de carpetas destino según config (Local/red1/red2) y patrón Ventas_PVxx/FYYYYMM
  const pvStr = String(reciboCfg.pv).padStart(4, '0');
  const nroStr = String(reciboCfg.contador).padStart(8, '0');
  const fileName = `REC_${pvStr}-${nroStr}.pdf`;

  function buildMonthDir(rootDir: string | undefined): string | null {
    if (!rootDir) return null;
    const root = String(rootDir).trim();
    if (!root) return null;
    const venta = path.join(root, `Ventas_PV${Number(reciboCfg.pv)}`);
    const yyyymm = dayjs(parsed.fechaISO).format('YYYYMM');
    const monthDir = path.join(venta, `F${yyyymm}`);
    try { fs.mkdirSync(monthDir, { recursive: true }); } catch {}
    return monthDir;
  }

  const outLocalDir = buildMonthDir((reciboCfg as any).outLocal || '');
  const outRed1Dir = buildMonthDir((reciboCfg as any).outRed1 || '');
  const outRed2Dir = buildMonthDir((reciboCfg as any).outRed2 || '');

  // Directorio base para renderizado temporal si no hay local configurado
  if (!outLocalDir) {
    // Si no hay ruta local configurada, no generamos en tmp para respetar el requerimiento
    throw new Error('Ruta Local no configurada para Recibos');
  }
  const localOutPath = path.join(outLocalDir, fileName);

  const clienteNombreFull = (parsed.receptor.codigo ? `(${parsed.receptor.codigo}) ` : '') + (parsed.receptor.nombre || '').trim();
  const data = {
    empresa: { nombre: 'Empresa', domicilio: '', cuit: '', pv: reciboCfg.pv, numero: reciboCfg.contador },
    cliente: { nombre: clienteNombreFull, domicilio: parsed.receptor.domicilio, cuitDni: parsed.receptor.docNro, condicionIva: parsed.receptor.condicionTxt },
    fecha: parsed.fechaISO,
    hora: parsed.obs.hora || undefined,
    atendio: parsed.obs.atendio || undefined,
    condicionPago: parsed.obs.pago || undefined,
    email: parsed.obs.mail || undefined,
    tipoComprobanteLiteral: 'RECIBO',
    tipoComprobanteLetra: 'X',
    referenciaInterna: parsed.refInterna,
    remito: parsed.remito || undefined,
    gracias: parsed.gracias || undefined,
    mipymeModo: undefined,
    observaciones: parsed.obs.cabecera2.filter(Boolean).slice(0, 2).join('\n'),
    pieObservaciones: parsed.obs.pie.filter(Boolean).join('\n'),
    fiscal: (parsed.fiscal && parsed.fiscal.length) ? parsed.fiscal.join('\n') : undefined,
    items: [], // ✅ Array vacío (se usa itemsRawLines en su lugar)
    itemsRawLines: parsed.itemsRawLines, // ✅ Líneas RAW entre ITEM: y TOTALES:
    netoGravado: (parsed.totales.neto21 || 0) + (parsed.totales.neto105 || 0) + (parsed.totales.neto27 || 0),
    ivaPorAlicuota: { '21': parsed.totales.iva21 || 0, '10.5': parsed.totales.iva105 || 0, '27': parsed.totales.iva27 || 0 },
    ivaTotal: (parsed.totales.iva21 || 0) + (parsed.totales.iva105 || 0) + (parsed.totales.iva27 || 0),
    total: parsed.totales.total,
    cae: '',
    caeVto: '',
  } as any;

  await generateInvoicePdf({ bgPath, outputPath: localOutPath, data, config: layoutMendoza, qrDataUrl: undefined });
  try { const { BrowserWindow } = require('electron'); const win = BrowserWindow.getAllWindows()?.[0]; if (win) win.webContents.send('auto-report-notice', { info: `Recibo PDF OK ${path.basename(localOutPath)}` }); } catch {}

  // Copiar a Red1/Red2 (sin mover) desde la copia local
  try {
    const name = `REC_${pvStr}-${nroStr}.pdf`;
    const tryCopy = (dstDir: string | null) => {
      if (!dstDir) return;
      try { fs.copyFileSync(localOutPath, path.join(dstDir, name)); } catch {}
    };
    tryCopy(outRed1Dir);
    tryCopy(outRed2Dir);
  } catch {}

  // Helper para enviar logs al modo Caja
  const sendCajaLog = (msg: string) => {
    try { const { BrowserWindow } = require('electron'); const win = BrowserWindow.getAllWindows()?.[0]; if (win && !win.isDestroyed()) win.webContents.send('caja-log', msg); } catch {}
  };

  // ✅ PASO 1: Incrementar contador (CRÍTICO)
  saveReciboConfig(cfgPath, { pv: reciboCfg.pv, contador: (data.empresa.numero || 0) + 1 });
  
  // ✅ PASO 2: Generar .res INMEDIATAMENTE (CRÍTICO)
  let resPath: string | null = null;
  try {
    const now = new Date();
    const fechaStr = dayjs(now).format('DD/MM/YYYY');
    const pvStr = String(reciboCfg.pv).padStart(5, '0').slice(-5).replace(/^0/, '0');
    const pvOut = String(reciboCfg.pv).padStart(5, '0').slice(-5); // asegurar 5 dígitos
    const nroOut = String(data.empresa.numero).padStart(8, '0');
    const totalFmt = new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(data.total||0));
    const resLines = [
      'RESPUESTA AFIP    :',
      'CUIT EMPRESA      : 30708673435',
      'MODO              : 0',
      `PUNTO DE VENTA    : ${String(reciboCfg.pv).padStart(5, '0').slice(-5)}`,
      `NUMERO COMPROBANTE: ${nroOut}`,
      `FECHA COMPROBANTE : ${fechaStr}`,
      'NUMERO CAE        :',
      'VENCIMIENTO CAE   : 0',
      `IMPORTE TOTAL     : ${totalFmt}`,
      `ARCHIVO REFERENCIA: ${path.basename(fullPath)}`,
      `ARCHIVO PDF       : ${path.basename(localOutPath)}`,
      '',
    ];
    const dir = path.dirname(fullPath);
    const baseName = path.basename(fullPath, path.extname(fullPath));
    const shortBase = baseName.slice(-8); // usar últimos 8 (ej.: 5421946Q). Cambiar a -12 si se requiere 12.
    const shortBaseLower = shortBase.toLowerCase();
    resPath = path.join(dir, `${shortBaseLower}.res`);
    const joined = raw.replace(/\s*$/,'') + '\n' + resLines.join('\n');
    fs.writeFileSync(resPath, joined, 'utf8');
    // Copia persistente para resumen diario
    try { const outDir = path.join(app.getPath('userData'), 'fac', 'out'); fs.mkdirSync(outDir, { recursive: true }); fs.copyFileSync(resPath, path.join(outDir, path.basename(resPath))); } catch {}
  } catch {}

  // ✅ PASO 3: Enviar .res por FTP INMEDIATAMENTE (CRÍTICO - CON REINTENTOS)
  const sendWithRetries = async (localPath: string, remoteName?: string): Promise<boolean> => {
    const delays = [500, 1500, 3000];
    for (let i = 0; i < delays.length; i++) {
      try {
        await sendArbitraryFile(localPath, remoteName || path.basename(localPath));
        return true;
      } catch (err: any) {
        if (i < delays.length - 1) {
          try { console.warn(`[recibo] FTP retry ${i+1}/${delays.length}:`, err?.message || String(err)); } catch {}
          await new Promise(r => setTimeout(r, delays[i]));
        } else {
          try { console.error('[recibo] FTP todos los reintentos fallaron:', err?.message || String(err)); } catch {}
        }
      }
    }
    return false;
  };

  let resSent = false;
  if (resPath && fs.existsSync(resPath)) {
    try { console.log('[recibo] Intentando enviar .res por FTP:', path.basename(resPath)); } catch {}
    resSent = await sendWithRetries(resPath, path.basename(resPath));
    if (resSent) {
      sendCajaLog(`  └─ .res OK → FTP`);
      try { const { BrowserWindow } = require('electron'); const win = BrowserWindow.getAllWindows()?.[0]; if (win) win.webContents.send('auto-report-notice', { info: `RES OK ${path.basename(resPath)}` }); } catch {}
      // ✅ PASO 4: Borrar archivos temporales (CRÍTICO)
      try { fs.unlinkSync(resPath); } catch {}
      try { fs.unlinkSync(fullPath); } catch {}
      try { console.log('[recibo] .res enviado por FTP y archivos limpiados'); } catch {}
    } else {
      sendCajaLog(`  └─ .res ❌ → FTP (reintentos agotados)`);
      // ⚠️ Si falla el .res, NO continuar con tareas secundarias
      return localOutPath;
    }
  }

  // 🔄 PASO 5: Tareas SECUNDARIAS en PARALELO (NO BLOQUEAN)
  const secondaryTasks: Array<Promise<{ task: string; success: boolean; error?: string }>> = [];

  // Tarea: Email
  const emailTo = (parsed.email || '').trim();
  if (/.+@.+\..+/.test(emailTo)) {
    secondaryTasks.push(
      (async () => {
        try {
          const { sendReceiptEmail } = await import('@infra/email');
          await sendReceiptEmail(emailTo, localOutPath, {
            subject: 'Recibo de pago',
            title: 'Recibo de pago',
            intro: 'Adjuntamos el recibo correspondiente.',
            bodyHtml: '<p>Gracias por su preferencia.</p>'
          });
          sendCajaLog(`  └─ Email OK → ${emailTo}`);
          return { task: 'email', success: true };
        } catch (e) {
          sendCajaLog(`  └─ Email ❌ → ${String((e as any)?.message || 'error')}`);
          return { task: 'email', success: false, error: String((e as any)?.message || 'error') };
        }
      })()
    );
  }

  // Tarea: WhatsApp
  const phoneRaw = (parsed.whatsapp || '').trim();
  if (phoneRaw) {
    secondaryTasks.push(
      (async () => {
        try {
          const clienteNombreFull = (parsed.receptor.nombre || '').trim();
          const onlyDigits = phoneRaw.replace(/[^0-9]/g, '');
          const normalizedPhone = onlyDigits.startsWith('54') ? ('+' + onlyDigits) : ('+54' + onlyDigits);
          const stamp = dayjs().format('HHmmss');
          const rand = Math.random().toString(36).slice(2, 4);
          const wfaName = `wfa${stamp}${rand}.txt`;
          const wfaPath = path.join(outLocalDir as string, wfaName);
          const lines = [
            normalizedPhone,
            clienteNombreFull,
            path.basename(localOutPath),
            'Que tal, somos de Todo Computacion',
            'Adjuntamos "el recibo realizado."',
          ];
          fs.writeFileSync(wfaPath, lines.join('\n'), 'utf8');
          const { sendFilesToWhatsappFtp } = await import('@infra/ftp');
          await sendFilesToWhatsappFtp([localOutPath, wfaPath], [path.basename(localOutPath), path.basename(wfaPath)]);
          sendCajaLog(`  └─ WhatsApp OK → ${normalizedPhone}`);
          try { fs.unlinkSync(wfaPath); } catch {}
          return { task: 'whatsapp', success: true };
        } catch (e) {
          sendCajaLog(`  └─ WhatsApp ❌ → ${String((e as any)?.message || 'error')}`);
          return { task: 'whatsapp', success: false, error: String((e as any)?.message || 'error') };
        }
      })()
    );
  }

  // Tarea: Impresión
  const copies = Math.max(0, Number(parsed.copias || 0));
  if (copies > 0) {
    secondaryTasks.push(
      (async () => {
        try {
          const { printPdf } = await import('@infra/printing');
          await printPdf(localOutPath, undefined, copies);
          sendCajaLog(`  └─ Impresión OK (${copies} copia${copies>1?'s':''})`);
          return { task: 'print', success: true };
        } catch (e) {
          sendCajaLog(`  └─ Impresión ❌ → ${String((e as any)?.message || 'error')}`);
          return { task: 'print', success: false, error: String((e as any)?.message || 'error') };
        }
      })()
    );
  }

  // Ejecutar todas las tareas secundarias EN PARALELO (sin bloquear)
  if (secondaryTasks.length > 0) {
    Promise.allSettled(secondaryTasks).then(results => {
      try {
        const fulfilled = results.filter(r => r.status === 'fulfilled').length;
        const rejected = results.filter(r => r.status === 'rejected').length;
        console.log(`[recibo] Tareas secundarias completadas: ${fulfilled} OK, ${rejected} falló`);
      } catch {}
    }).catch(() => {
      try { console.warn('[recibo] Error al ejecutar tareas secundarias'); } catch {}
    });
  }

  return localOutPath;
}

export default { processFacFile };

// ===================== FACTURAS / NOTAS (A/B) =====================

function readTextSmartFactura(filePath: string): string {
  return readTextSmart(filePath);
}

function parseNumAr(s: string): number {
  const str = (s || '').trim();
  if (str.includes(',')) return Number(str.replace(/\./g, '').replace(',', '.'));
  return Number(str.replace(/\s/g, ''));
}

function detectTipoFactura(raw: string, fileName: string): 'FA'|'FB'|'NCA'|'NCB'|'NDA'|'NDB'|null {
  const m = raw.match(/\bTIPO:\s*(.+)/i);
  const tRaw = (m?.[1] || '').trim();
  const t = tRaw.toUpperCase();
  if (/^\d+$/.test(tRaw)) {
    const code = Number(tRaw);
    if (code === 1) return 'FA'; if (code === 6) return 'FB';
    if (code === 3) return 'NCA'; if (code === 8) return 'NCB';
    if (code === 2) return 'NDA'; if (code === 7) return 'NDB';
  }
  if (t === 'FACTURA A' || /A\.fac$/i.test(fileName)) return 'FA';
  if (t === 'FACTURA B' || /B\.fac$/i.test(fileName)) return 'FB';
  if (t === 'NOTA CREDITO A' || /NCA\.fac$/i.test(fileName)) return 'NCA';
  if (t === 'NOTA CREDITO B' || /NCB\.fac$/i.test(fileName)) return 'NCB';
  if (t === 'NOTA DEBITO A' || /NDA\.fac$/i.test(fileName)) return 'NDA';
  if (t === 'NOTA DEBITO B' || /NDB\.fac$/i.test(fileName)) return 'NDB';
  return null;
}

function mapTipoToCbte(tipo: 'FA'|'FB'|'NCA'|'NCB'|'NDA'|'NDB'): number {
  switch (tipo) {
    case 'FA': return 1; case 'FB': return 6;
    case 'NDA': return 2; case 'NDB': return 7;
    case 'NCA': return 3; case 'NCB': return 8;
  }
}

export function readFacturasConfig(): { pv: number; outLocal?: string; outRed1?: string; outRed2?: string; printerName?: string } {
  try {
    const p = path.join(app.getPath('userData'), 'config', 'facturas.config.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p,'utf8'));
  } catch {}
  try {
    const p = path.join(process.cwd(), 'config', 'facturas.config.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p,'utf8'));
  } catch {}
  return { pv: 1 } as any;
}

async function emitirAfipWithRetry(params: any, facPath: string, logger?: (e: any)=>void) {
  const delays = [500, 1500, 4000];
  let lastErr: any = null;
  // Delegar en FacturacionService (flujo estable del commit 378e165)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getFacturacionService } = require('../../services/FacturacionService');
  const svc = getFacturacionService();
  for (let i=0;i<delays.length;i++) {
    try {
      logger?.({ stage:'AFIP_EMIT_ATTEMPT', attempt:i+1, facPath });
      const r: any = await svc.emitirFacturaYGenerarPdf(params);
      if (r && r.cae) {
        return {
          cae: String(r.cae),
          caeVto: String(r.cae_vencimiento || r.caeVencimiento || ''),
          qrData: r.qr_url,
          numero: Number(r.numero || 0)
        } as any;
      }
      lastErr = new Error('AFIP sin CAE');
    } catch (e: any) { lastErr = e; }
    try { logger?.({ stage:'AFIP_EMIT_RETRY', attempt:i+1, reason:String(lastErr?.message||lastErr), facPath }); } catch {}
    await new Promise(res=>setTimeout(res, delays[i]));
  }
  if (lastErr) throw lastErr;
  throw new Error('AFIP_NO_CAE');
}

export async function processFacturaFacFile(fullPath: string): Promise<{ ok: boolean; pdfPath?: string; numero?: number; cae?: string; caeVto?: string; reason?: string }> {
  const raw = readTextSmartFactura(fullPath);
  try { console.warn('[FAC][PIPE] read:file', { fullPath, size: raw?.length || 0 }); } catch {}
  const tipo = detectTipoFactura(raw, path.basename(fullPath));
  try { console.warn('[FAC][PIPE] detect:tipo', { tipo }); } catch {}
  if (!tipo) throw new Error('FAC no es tipo factura/nota A/B');

  const lines = String(raw||'').split(/\r?\n/);
  const get = (k:string)=>{ const ln=lines.find(l=>l.startsWith(k)); return ln? ln.substring(k.length).trim():''; };
  const getBlock = (startKey: string) => {
    const startIdx = lines.findIndex((l) => l.trim().startsWith(startKey));
    if (startIdx < 0) return [] as string[];
    const out: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (/^(OBS\.|ITEM:|TOTALES:|IP:|TIPO:|FONDO:|COPIAS:|CLIENTE:|TIPODOC:|NRODOC:|CONDICION:|IVARECEPTOR:|DOMICILIO:|MONEDA:|DIAHORA:)/.test(t)) break;
      if (t) out.push(t);
    }
    return out;
  };
  const dia = get('DIAHORA:');
  let fechaISO = dayjs().format('YYYY-MM-DD');
  let refInterna = '';
  try {
    const m = dia.match(/(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2}).*?(\d+)$/);
    if (m) {
      const [, dd, mm, yy, HH, MM, SS, term] = m;
      fechaISO = `20${yy}-${mm}-${dd}`;
      const term2 = String(term || '').padStart(2, '0');
      refInterna = `${yy}${mm}${dd}${HH}${MM}${SS}${term2}`;
    } else {
      const d2 = dia.match(/(\d{2})\/(\d{2})\/(\d{2})/);
      if (d2) fechaISO = `20${d2[3]}-${d2[2]}-${d2[1]}`;
    }
  } catch {}
  const clienteRaw = get('CLIENTE:');
  // Conservar el código del cliente entre paréntesis si viene (ej.: (000337)EXPRESO...)
  const nombre = (clienteRaw || '').trim();
  const domicilio = get('DOMICILIO:');
  const docTipo = Number(get('TIPODOC:')||'0');
  const docNro = get('NRODOC:');
  const condicionTxt = get('CONDICION:');
  const condicionIvaReceptor = ((): string | undefined => {
    const t = String(condicionTxt || '').toUpperCase();
    if (/CONSUMIDOR\s+FINAL/.test(t) || t === 'CF') return 'CF';
    if (/RESPONSABLE/.test(t) || t === 'RI') return 'RI';
    if (/MONOTRIB/.test(t) || t === 'MT' || t === 'MONO') return 'MT';
    if (/EXENTO/.test(t) || t === 'EX') return 'EX';
    return undefined;
  })();
  const email = get('EMAIL:');
  const whatsapp = get('WHATSAPP:');
  // Moneda desde .fac
  const monedaFac = ((): { monId: 'PES'|'DOL'|'EUR'; cotiz?: number; can?: 'S'|'N' } => {
    const mraw = (get('MONEDA:') || '').toUpperCase();
    const isDol = /DOLAR|DÓLAR|DOLARES|DÓLARES/.test(mraw);
    const isEur = /EURO|EUROS/.test(mraw);
    let monId: 'PES'|'DOL'|'EUR' = 'PES';
    if (isDol) monId = 'DOL'; else if (isEur) monId = 'EUR';
    let cotiz: number | undefined = undefined;
    const cotLine = lines.find(l => l.startsWith('COTIZADOL:'));
    if (cotLine) {
      const v = cotLine.substring('COTIZADOL:'.length).trim();
      const n = parseNumAr(v);
      if (Number.isFinite(n) && n > 0) cotiz = n;
    }
    const canLine = (get('CANCELA_MISMA_MONEDA:') || '').toUpperCase();
    const can = (canLine === 'S' || canLine === 'N') ? (canLine as 'S'|'N') : 'N';
    return { monId, cotiz, can };
  })();
  // Detectar comprobante asociado para NC/ND a partir de líneas tipo:
  // "AFECTA FACT.N: B 0016-00026318", "AFECTA FACT N° B 0016 - 00026318", "AFECTA FACTURA N B 0016-00026318"
  const assoc = ((): { Tipo: number; PtoVta: number; Nro: number } | null => {
    try {
      const rx = /AFECTA\s+FACT(?:URA)?\.?\s*N[º°o]?\s*[:\-]?\s*([ABC])\s*(\d{4})\s*[- ]\s*(\d{8})/i;
      for (const rawLine of lines) {
        const line = String(rawLine || '');
        const m = line.match(rx);
        if (m) {
          const letra = String(m[1] || '').toUpperCase();
          const pv = Number(m[2]);
          const nro = Number(m[3]);
          const tipoOrigen = letra === 'A' ? 1 : (letra === 'B' ? 6 : (letra === 'C' ? 11 : 0));
          if (tipoOrigen && pv && nro) return { Tipo: tipoOrigen, PtoVta: pv, Nro: nro };
        }
      }
    } catch {}
    return null;
  })();
  try {
    if (tipo === 'NCA' || tipo === 'NCB' || tipo === 'NDA' || tipo === 'NDB') {
      if (assoc) {
        console.warn('[FAC][PIPE] cbtesAsoc.detect', assoc);
      } else {
        console.warn('[FAC][PIPE] cbtesAsoc.missing');
      }
    }
  } catch {}
  // Observaciones (como Recibo)
  const cab1Lines = getBlock('OBS.CABCERA1:');
  const cab2Lines = getBlock('OBS.CABCERA2:');
  const pieAll = [...getBlock('OBS.PIE:'), ...getBlock('OBS.PIE:1')];
  const getBlockRaw = (startKey: string) => {
    const startIdx = lines.findIndex((l) => l.trim().startsWith(startKey));
    if (startIdx < 0) return [] as string[];
    const out: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
      const raw = lines[i];
      const tTrim = raw.trim();
      if (/^(OBS\.|ITEM:|TOTALES:|IP:|TIPO:|FONDO:|COPIAS:|CLIENTE:|TIPODOC:|NRODOC:|CONDICION:|IVARECEPTOR:|DOMICILIO:|MONEDA:|DIAHORA:)/.test(tTrim)) break;
      if (tTrim) out.push(raw.replace(/\s+$/,'') /* trim solo derecha */);
    }
    return out;
  };
  const fiscalLines = getBlockRaw('OBS.FISCAL:');
  const cab1Text = cab1Lines.join(' | ');
  let atendio = '', hora = '', mail = '', pago = '';
  try { const mAt = cab1Text.match(/Atendio:\s*([^|]+)/i); if (mAt) atendio = `Atendio: ${mAt[1].trim()}`; } catch {}
  try { const mHr = cab1Text.match(/Hora:\s*([^|]+)/i); if (mHr) hora = `Hora: ${mHr[1].trim()}`; } catch {}
  try { const mMl = cab1Text.match(/Mail:\s*([^|]+)/i); if (mMl) mail = (mMl[1] || '').trim(); } catch {}
  if (!mail) {
    try {
      const cab2Text = cab2Lines.join(' | ');
      const mMl2 = cab2Text.match(/Mail:\s*([^|]+)/i);
      if (mMl2) mail = (mMl2[1] || '').trim();
    } catch {}
  }
  if (!mail) {
    const emailTag = get('EMAIL:');
    if (emailTag) mail = emailTag.trim();
  }
  try { const mPg = cab1Text.match(/Pago:\s*([^|]+)/i); if (mPg) pago = mPg[1].trim(); } catch {}

  // ✅ CAPTURA RAW de líneas entre ITEM: y TOTALES: (sin parseo, modo "dump directo")
  // Según manual MTXCA: AFIP solo requiere totales + alícuotas, NO detalle de items
  const itemStart = lines.findIndex(l => l.trim() === 'ITEM:');
  const totStart = lines.findIndex(l => l.trim() === 'TOTALES:');
  const itemsRawLines: string[] = [];
  if (itemStart >= 0) {
    const end = totStart > itemStart ? totStart : lines.length;
    for (let i = itemStart + 1; i < end; i++) {
      const row = lines[i];
      if (!row || !row.trim()) continue; // Saltar líneas vacías
      // Capturar línea completa tal como viene (con espacios del inicio)
      itemsRawLines.push(row);
    }
  }

  let neto21=0, neto105=0, neto27=0, exento=0, iva21=0, iva105=0, iva27=0, total=0;
  let ivaTotalFlag = false;
  let netoTotalFlag = false;
  let netoTotalParsed: number | null = null;
  const startTotals = totStart;
  if (startTotals>=0){
    for (let i=startTotals+1;i<lines.length;i++){
      const t = lines[i].trim();
      if (!t || /^(OBS\.|ITEM:|IP:|TIPO:|FONDO:|COPIAS:|CLIENTE:|TIPODOC:|NRODOC:|CONDICION:|IVARECEPTOR:|DOMICILIO:|MONEDA:|DIAHORA:|TOTALES:$)/.test(t)) break;
      const m = t.match(/^(NETO TOTAL|NETO 21%|NETO 10\.5%|NETO 27%|EXENTO|IVA 21%|IVA 10\.5%|IVA 27%|IVA TOTAL|TOTAL)\s*:\s*([\d\.,]+)$/i);
      if (!m) continue; const key=m[1].toUpperCase(); const val=parseNumAr(m[2]);
      if (key==='NETO TOTAL') { netoTotalFlag=true; netoTotalParsed=val; }
      else if (key==='NETO 21%') neto21=val; else if (key==='NETO 10.5%') neto105=val; else if (key==='NETO 27%') neto27=val; else if (key==='EXENTO') exento=val;
      else if (key==='IVA 21%') iva21=val; else if (key==='IVA 10.5%') iva105=val; else if (key==='IVA 27%') iva27=val; else if (key==='IVA TOTAL') ivaTotalFlag=true; else if (key==='TOTAL') total=val;
    }
  }
  try { console.warn('[FAC][PIPE] parsed:totales', { neto21, neto105, neto27, exento, iva21, iva105, iva27, total, ivaTotalFlag, netoTotalFlag }); } catch {}

  // Validación NTP
  try {
    const ntp = await validateSystemTime();
    if (!ntp.isValid) return { ok:false, reason: 'NTP_INVALID' } as any;
  } catch {
    // Si hay error en NTP, no bloquear pero informar razón
    return { ok:false, reason: 'NTP_ERROR' } as any;
  }

  // ✅ YA NO se necesita inferir alícuotas desde items porque:
  // - Los totales vienen completos del .fac (etiqueta TOTALES:)
  // - AFIP usa totales_fac directamente (no items parseados)
  // - Lógica de inferencia eliminada según manual MTXCA

  // Emisión AFIP con retry
  const cfg = readFacturasConfig();
  if (!cfg || !cfg.outLocal) {
    return { ok:false, reason: 'CFG_OUTLOCAL_MISSING' } as any;
  }
  // Punto de venta y CUIT emisor: tomar SIEMPRE desde configuración AFIP (Administración). Fallback a cfg.local
  let pv = Number(cfg.pv || 1);
  let cuitEmisor = '';
  try {
    const afipCfg = getDb()?.getAfipConfig?.();
    if (afipCfg) {
      if (typeof afipCfg.pto_vta !== 'undefined') {
        pv = Number(afipCfg.pto_vta) || pv;
      }
      if (afipCfg.cuit) {
        cuitEmisor = String(afipCfg.cuit);
      }
    }
  } catch {}
  if (!total || total <= 0) {
    return { ok:false, reason: 'TOTAL_INVALID' } as any;
  }
  // 🔑 IMPORTANTE: Crear item genérico para satisfacer validación local
  // AFIP usa totales + alícuotas (no items detallados según MTXCA)
  // Este item genérico NO afecta el PDF (solo es para AFIP)
  const detalle: any[] = [
    {
      descripcion: 'Producto informático varios',
      cantidad: 1,
      precioUnitario: total,
      iva: (iva21 + iva105 + iva27 > 0) ? 21 : 0,  // IVA predominante
      total: total
    }
  ];
  try { console.warn('[FAC][PIPE] item genérico creado para validación AFIP', { descripcion: detalle[0].descripcion, total }); } catch {}
  const cuitODocReceptor = ((): string | undefined => {
    if (docTipo === 99) return undefined;
    if (docNro) return String(docNro);
    return undefined;
  })();
  const ivareceptor = ((): number | undefined => {
    const n = Number(String(get('IVARECEPTOR:')||'').trim());
    return Number.isFinite(n) && n>0 ? n : undefined;
  })();
  const params = { 
    pto_vta: pv, 
    tipo_cbte: mapTipoToCbte(tipo), 
    fecha: fechaISO.replace(/-/g,''), 
    total, 
    neto: neto21+neto105+neto27, 
    iva: iva21+iva105+iva27, 
    // ✨ TOTALES discriminados del .fac (para envío directo a AFIP)
    totales_fac: {
      neto21, neto105, neto27, 
      iva21, iva105, iva27, 
      exento,
      total,  // 🔑 Total exacto del .fac (evita errores de redondeo)
      source: 'fac_parsed'  // Flag para identificar que vienen del .fac
    },
    cuit_emisor: cuitEmisor,  // 🔑 CUIT del emisor desde configuración AFIP
    empresa:{}, 
    cliente:{ razon_social_receptor:nombre }, 
    cuit_receptor: cuitODocReceptor, 
    doc_tipo: docTipo||undefined, 
    razon_social_receptor:nombre, 
    condicion_iva_receptor: condicionIvaReceptor, 
    ivareceptor, 
    detalle, 
    mon_id: monedaFac.monId, 
    cotiza_hint: monedaFac.cotiz, 
    can_mis_mon_ext: monedaFac.can, 
    comprobantesAsociados: assoc ? [assoc] : undefined 
  } as any;
  try {
    console.warn('[FAC][PIPE] afip:params', {
      cuit_emisor: params.cuit_emisor,
      pto_vta: params.pto_vta,
      tipo_cbte: params.tipo_cbte,
      total: params.total,
      doc_tipo: params.doc_tipo,
      cuit_receptor: params.cuit_receptor,
      condicion_iva_receptor: params.condicion_iva_receptor,
      ivareceptor: params.ivareceptor,
      mon_id: params.mon_id,
      can_mis_mon_ext: params.can_mis_mon_ext,
      cotiza_hint: params.cotiza_hint,
      detalle_len: (params.detalle||[]).length,
      cbtesAsoc: assoc ? [assoc] : []
    });
  } catch {}
  const alias = ((): string => {
    switch (tipo) {
      case 'FA': return 'FA';
      case 'FB': return 'FB';
      case 'NCA': return 'NCA';
      case 'NCB': return 'NCB';
      case 'NDA': return 'NDA';
      case 'NDB': return 'NDB';
      default: return tipo;
    }
  })();
  try { const { BrowserWindow } = require('electron'); const win = BrowserWindow.getAllWindows()?.[0]; if (win) win.webContents.send('auto-report-notice', { info: `Emitiendo ${alias} PV ${String(pv).padStart(4,'0')}…` }); } catch {}
  const r = await emitirAfipWithRetry(params, fullPath, (evt:any)=>{ try { console.warn('[FAC][AFIP]', evt); const { BrowserWindow } = require('electron'); const win = BrowserWindow.getAllWindows()?.[0]; if (win) { if (evt?.stage==='AFIP_EMIT_ATTEMPT') win.webContents.send('auto-report-notice', { info: `AFIP: intento ${evt.attempt}` }); } } catch {} });
  if (!r || !r.cae) {
    try { const { BrowserWindow } = require('electron'); const win = BrowserWindow.getAllWindows()?.[0]; if (win) win.webContents.send('auto-report-notice', { error: `AFIP sin CAE` }); } catch {}
    return { ok:false, reason: 'AFIP_NO_CAE' } as any;
  }
  const nroAfip = Number((r as any)?.numero ?? (r as any)?.cbteDesde ?? (r as any)?.nroComprobante ?? 0);
  if (!nroAfip) {
    try { const { BrowserWindow } = require('electron'); const win = BrowserWindow.getAllWindows()?.[0]; if (win) win.webContents.send('auto-report-notice', { error: `AFIP no informó número` }); } catch {}
    return { ok:false, reason: 'AFIP_NO_NUMERO' } as any;
  }
  const caeStr: string = String((r as any)?.cae || '').trim();
  const caeVtoRaw: any = (r as any)?.caeVto || (r as any)?.cae_vto || (r as any)?.caeVencimiento || (r as any)?.cae_vencimiento || (r as any)?.vencimientoCAE || '';
  const caeVtoStr = ((): string => {
    const s = String(caeVtoRaw || '').trim();
    if (/^\d{8}$/.test(s)) return `${s.slice(6,8)}/${s.slice(4,6)}/${s.slice(0,4)}`; // DD/MM/AAAA
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}`;
    return s;
  })();

  // Observaciones AFIP (si existieran)
  try {
    if (Array.isArray((r as any)?.observaciones) && (r as any).observaciones.length > 0) {
      const { BrowserWindow } = require('electron'); const win = BrowserWindow.getAllWindows()?.[0];
      if (win) {
        for (const ob of ((r as any).observaciones as any[])) {
          const code = (ob?.Code ?? ob?.code ?? '').toString();
          const msg = (ob?.Msg ?? ob?.message ?? '').toString();
          win.webContents.send('auto-report-notice', { info: `Obs AFIP: ${code} ${msg}` });
        }
      }
    }
  } catch {}

  // Directorios salida
  const makeMonthDir = (root?: string): string | null => {
    if (!root) return null; const venta = path.join(String(root), `Ventas_PV${pv}`); const yyyymm = dayjs(fechaISO).format('YYYYMM'); const dir = path.join(venta, `F${yyyymm}`); try { fs.mkdirSync(dir, { recursive: true }); } catch {} return dir;
  };
  const outLocalDir = makeMonthDir(cfg.outLocal); if (!outLocalDir) throw new Error('Ruta Local no configurada para Facturas');
  const outRed1Dir = makeMonthDir(cfg.outRed1); const outRed2Dir = makeMonthDir(cfg.outRed2);

  // PDF
  const pvStr = String(pv).padStart(4,'0'); const nroStr = String(nroAfip).padStart(8,'0');
  const prefix = ((): string => { if (tipo==='FA') return 'FA'; if (tipo==='FB') return 'FB'; if (tipo==='NCA') return 'NCA'; if (tipo==='NCB') return 'NCB'; if (tipo==='NDA') return 'NDA'; return 'NDB'; })();
  const letra = (tipo==='FA'||tipo==='NCA'||tipo==='NDA') ? 'A' : 'B';
  const literal = (tipo.startsWith('NC') ? 'NOTA DE CREDITO' : (tipo.startsWith('ND') ? 'NOTA DE DEBITO' : 'FACTURA'));
  const fileName = `${prefix}_${pvStr}-${nroStr}.pdf`;
  const localOutPath = path.join(outLocalDir, fileName);
  const bgFromFac = ((): string => { const m = lines.find(l=>l.startsWith('FONDO:')); return m? m.substring('FONDO:'.length).trim():''; })();
  const resolveFondo = (src?: string): string | null => { if (!src) return null; const trimmed=String(src).trim().replace(/^"|"$/g,''); const tries=[trimmed, trimmed.replace(/\\/g,path.sep).replace(/\//g,path.sep), path.resolve(trimmed)]; try { const baseName=path.basename(trimmed); if (baseName) { tries.push(path.join(process.cwd(),'templates',baseName)); try { tries.push(path.join(app.getAppPath(),'templates',baseName)); } catch {} } } catch {} for (const pth of tries) { try { if (pth && fs.existsSync(pth)) return pth; } catch {} } return null; };
  const appBase = ((): string => { try { return app.getAppPath(); } catch { return process.cwd(); } })();
  const bgPath = resolveFondo(bgFromFac) || path.join(appBase, 'public', 'Noimage.jpg');
  const ivaPorAlicuota: any = {}; if (iva21) ivaPorAlicuota['21']=iva21; if (iva105) ivaPorAlicuota['10.5']=iva105; if (iva27) ivaPorAlicuota['27']=iva27;
  const netoPorAlicuota: any = {}; if (neto21) netoPorAlicuota['21']=neto21; if (neto105) netoPorAlicuota['10.5']=neto105; if (neto27) netoPorAlicuota['27']=neto27;

  // Pie: extraer GRACIAS y envolver a 120 caracteres por línea
  const wrapLine = (text: string, limit = 120): string[] => {
    const out: string[] = [];
    let t = (text || '').trim();
    while (t.length > limit) {
      let cut = t.lastIndexOf(' ', limit);
      if (cut <= 0) cut = limit;
      out.push(t.slice(0, cut).trimEnd());
      t = t.slice(cut).trimStart();
    }
    if (t) out.push(t);
    return out;
  };
  let graciasLine = '';
  const pieWrapped: string[] = [];
  const rawPie = [...getBlock('OBS.PIE:'), ...getBlock('OBS.PIE:1')];
  for (const ln of rawPie) {
    const s = (ln || '').trim(); if (!s || s === '.') continue;
    if (!graciasLine && /gracias/i.test(s)) { graciasLine = s; continue; }
    pieWrapped.push(...wrapLine(s, 120));
  }
  const data: any = {
    empresa:{ pv, numero:nroAfip },
    cliente:{ nombre, domicilio, cuitDni:(docTipo===80? docNro: undefined)||docNro, condicionIva:condicionTxt },
    fecha:fechaISO,
    hora: hora || undefined,
    atendio: atendio || undefined,
    condicionPago: pago || undefined,
    email: mail || undefined,
    referenciaInterna: refInterna || undefined,
    tipoComprobanteLetra:letra,
    tipoComprobanteLiteral: literal,
    observaciones: cab2Lines.filter(Boolean).slice(0,2).join('\n') || undefined,
    pieObservaciones: pieWrapped.join('\n') || undefined,
    gracias: graciasLine || undefined,
    fiscal: (fiscalLines && fiscalLines.length) ? fiscalLines.join('\n') : undefined,
    // Moneda extranjera (para renderizado PDF)
    moneda: monedaFac.monId === 'DOL' ? 'DOLARES' : monedaFac.monId === 'EUR' ? 'EUROS' : undefined,
    cotizacion: monedaFac.cotiz,
    netoGravado: (netoTotalParsed ?? (neto21+neto105+neto27)),
    exento,
    ivaPorAlicuota,
    netoPorAlicuota,
    ivaTotal: iva21+iva105+iva27,
    showIvaTotal: ivaTotalFlag,
    showNetoTotal: netoTotalFlag,
    total,
    cae: caeStr,
    caeVto: caeVtoStr,
    items: [], // ✅ Array vacío (no se usa para PDF, solo itemsRawLines)
    itemsRawLines // ✅ Líneas RAW pre-formateadas del .fac (modo "dump directo")
  };
  // ✅ PASO 1: Generar PDF (CRÍTICO)
  await generateInvoicePdf({ bgPath, outputPath: localOutPath, data, config: layoutMendoza, qrDataUrl: (r as any)?.qrData });
  try { const { BrowserWindow } = require('electron'); const win = BrowserWindow.getAllWindows()?.[0]; if (win) win.webContents.send('auto-report-notice', { info: `PDF OK ${path.basename(localOutPath)}` }); } catch {}
  try { if (outRed1Dir) fs.copyFileSync(localOutPath, path.join(outRed1Dir, fileName)); } catch {}
  try { if (outRed2Dir) fs.copyFileSync(localOutPath, path.join(outRed2Dir, fileName)); } catch {}

  // Helper para enviar logs al modo Caja
  const sendCajaLog = (msg: string) => {
    try { const { BrowserWindow } = require('electron'); const win = BrowserWindow.getAllWindows()?.[0]; if (win && !win.isDestroyed()) win.webContents.send('caja-log', msg); } catch {}
  };

  // ✅ PASO 2: Generar .res (CRÍTICO - INMEDIATO)
  const suf = ((): string => { switch (tipo) { case 'FA': return 'a'; case 'FB': return 'b'; case 'NCA': return 'c'; case 'NCB': return 'd'; case 'NDA': return 'e'; case 'NDB': return 'f'; default: return 'a'; } })();
  let resPath: string | null = null;
  try { const dir=path.dirname(fullPath); const baseName=path.basename(fullPath, path.extname(fullPath)); const shortLower=baseName.slice(-8).toLowerCase().replace(/.$/,suf); resPath=path.join(dir, `${shortLower}.res`); const fechaStr=dayjs().format('DD/MM/YYYY'); const totalFmt= new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(total); const resLines=['RESPUESTA AFIP    :','CUIT EMPRESA      :','MODO              : 0',`PUNTO DE VENTA    : ${String(pv).padStart(5,'0').slice(-5)}`,`NUMERO COMPROBANTE: ${String(nroAfip).padStart(8,'0')}`,`FECHA COMPROBANTE : ${fechaStr}`,`NUMERO CAE        : ${caeStr}`,`VENCIMIENTO CAE   : ${caeVtoStr || '0'}`,`IMPORTE TOTAL     : ${totalFmt}`,`ARCHIVO REFERENCIA: ${path.basename(fullPath)}`,`ARCHIVO PDF       : ${path.basename(localOutPath)}`,'']; const joined=raw.replace(/\s*$/,'')+'\n'+resLines.join('\n'); fs.writeFileSync(resPath, joined, 'utf8'); try { const outDir = path.join(app.getPath('userData'),'fac','out'); fs.mkdirSync(outDir,{recursive:true}); fs.copyFileSync(resPath, path.join(outDir, path.basename(resPath))); } catch {} } catch {}

  // ✅ PASO 3: Enviar .res por FTP (CRÍTICO - CON REINTENTOS)
  const sendWithRetries = async (localPath: string, remoteName?: string): Promise<boolean> => { const attempts=[0,1000,3000]; for (let i=0;i<attempts.length;i++){ try { await sendArbitraryFile(localPath, remoteName||path.basename(localPath)); return true; } catch {} await new Promise(res=>setTimeout(res, attempts[i])); } return false; };
  let resSent=false; 
  if (resPath && fs.existsSync(resPath)) { 
    resSent = await sendWithRetries(resPath, path.basename(resPath)); 
    if (resSent) { 
      sendCajaLog(`  └─ .res OK → FTP`);
      try { const { BrowserWindow } = require('electron'); const win = BrowserWindow.getAllWindows()?.[0]; if (win) win.webContents.send('auto-report-notice', { info: `RES OK ${path.basename(resPath)}` }); } catch {} 
      // ✅ PASO 4: Borrar archivos temporales (CRÍTICO)
      try { fs.unlinkSync(resPath); } catch {} 
      try { fs.unlinkSync(fullPath); } catch {} 
    } else {
      sendCajaLog(`  └─ .res ❌ → FTP (reintentos agotados)`);
      // ⚠️ Si falla el .res, NO continuar con tareas secundarias
      return { ok:true, pdfPath: localOutPath, numero: nroAfip, cae: caeStr, caeVto: caeVtoStr } as any;
    }
  }

  // 🔄 PASO 5: Tareas SECUNDARIAS en PARALELO (NO BLOQUEAN)
  // Usando Promise.allSettled() para que NUNCA falle, solo reporte resultados
  const copiesLine = lines.find(l=>l.startsWith('COPIAS:')); 
  const copies = copiesLine? Number(copiesLine.substring('COPIAS:'.length).trim()||'0'):0;
  const emailTo = (email||'').trim();
  const phone = (whatsapp||'').replace(/[^0-9]/g,'');

  const secondaryTasks = [];

  // Tarea: Impresión
  if (copies > 0) {
    secondaryTasks.push(
      (async () => {
        try {
          const { printPdf } = await import('@infra/printing');
          await printPdf(localOutPath, cfg.printerName, copies);
          sendCajaLog(`  └─ Impresión OK (${copies} copia${copies>1?'s':''})`);
          return { task: 'print', success: true };
        } catch (e) {
          sendCajaLog(`  └─ Impresión ❌ → ${String((e as any)?.message || 'error')}`);
          return { task: 'print', success: false, error: String((e as any)?.message || 'error') };
        }
      })()
    );
  }

  // Tarea: Email
  if (/.+@.+\..+/.test(emailTo)) {
    secondaryTasks.push(
      (async () => {
        try {
          const { sendReceiptEmail } = await import('@infra/email');
          await sendReceiptEmail(emailTo, localOutPath, { subject: literal, title: literal, intro: 'Adjuntamos el comprobante.', bodyHtml: '<p>Gracias por su preferencia.</p>' });
          sendCajaLog(`  └─ Email OK → ${emailTo}`);
          return { task: 'email', success: true };
        } catch (e) {
          sendCajaLog(`  └─ Email ❌ → ${String((e as any)?.message || 'error')}`);
          return { task: 'email', success: false, error: String((e as any)?.message || 'error') };
        }
      })()
    );
  }

  // Tarea: WhatsApp
  if (phone) {
    secondaryTasks.push(
      (async () => {
        try {
          const normalized = phone.startsWith('54') ? ('+'+phone) : ('+54'+phone);
          const stamp = dayjs().format('HHmmss');
          const rand = Math.random().toString(36).slice(2,4);
          const wfaName = `wfa${stamp}${rand}.txt`;
          const wfaPath = path.join(outLocalDir, wfaName);
          fs.writeFileSync(wfaPath, [normalized, nombre, path.basename(localOutPath), 'Que tal, somos de Todo Computacion', 'Adjuntamos el comprobante.'].join('\n'), 'utf8');
          const { sendFilesToWhatsappFtp } = await import('@infra/ftp');
          await sendFilesToWhatsappFtp([localOutPath, wfaPath], [path.basename(localOutPath), path.basename(wfaPath)]);
          sendCajaLog(`  └─ WhatsApp OK → ${normalized}`);
          try { fs.unlinkSync(wfaPath); } catch {}
          return { task: 'whatsapp', success: true };
        } catch (e) {
          sendCajaLog(`  └─ WhatsApp ❌ → ${String((e as any)?.message || 'error')}`);
          return { task: 'whatsapp', success: false, error: String((e as any)?.message || 'error') };
        }
      })()
    );
  }

  // Ejecutar todas las tareas secundarias EN PARALELO (sin bloquear)
  // Promise.allSettled() NUNCA falla, solo reporta el resultado de cada tarea
  if (secondaryTasks.length > 0) {
    Promise.allSettled(secondaryTasks).then(results => {
      try {
        const summary = results.map((r, i) => {
          if (r.status === 'fulfilled') {
            return `${r.value.task}: ${r.value.success ? 'OK' : 'FAIL'}`;
          } else {
            return `task_${i}: ERROR`;
          }
        }).join(', ');
        console.log(`[factura] Tareas secundarias completadas: ${summary}`);
      } catch {}
    }).catch(() => {
      // Este catch nunca debería ejecutarse con allSettled, pero lo dejamos por seguridad
      console.warn('[factura] Error inesperado en tareas secundarias');
    });
  }

  return { ok:true, pdfPath: localOutPath, numero: nroAfip, cae: caeStr, caeVto: caeVtoStr } as any;
}



