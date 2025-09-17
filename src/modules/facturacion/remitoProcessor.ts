import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { generateInvoicePdf } from '../../pdfRenderer';
import layoutMendoza from '../../invoiceLayout.mendoza';
import { sendArbitraryFile } from '../../services/FtpService';

type ParsedRemito = {
  tipo: 'REMITO';
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
  itemsRemito: Array<{ cantidad: number; descripcion: string; total: number }>;
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

function parseFacRemito(content: string, fileName: string): ParsedRemito {
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
      fechaY = `20${yy}${mm}${dd}`;
      horaH = `${HH}${MM}${SS}`;
      term = String(terminal).padStart(2, '0');
    }
  } catch {}
  const refInterna = path.basename(fileName, path.extname(fileName)) || `${fechaY.slice(2)}${horaH}${term}R`;
  const fechaISO = fechaY ? `${fechaY.substring(0, 4)}-${fechaY.substring(4, 6)}-${fechaY.substring(6, 8)}` : dayjs().format('YYYY-MM-DD');

  const fondo = get('FONDO:');
  const copias = Number(get('COPIAS:') || '1');
  const moneda = get('MONEDA:') || 'PESOS';
  const emailRaw = get('EMAIL:');
  const email = (emailRaw || '').trim();
  const whatsappRaw = get('WHATSAPP:');
  const whatsapp = (whatsappRaw || '').trim();

  const clienteRaw = get('CLIENTE:');
  let codigo = '', nombre = clienteRaw.trim();
  const mCli = clienteRaw.match(/^\((\d+)\)\s*(.*)$/);
  if (mCli) { codigo = mCli[1]; nombre = (mCli[2] || '').trim(); }
  const docTipo = Number(get('TIPODOC:') || '0');
  const docNro = get('NRODOC:');
  const condicionTxt = get('CONDICION:');
  const ivaReceptor = get('IVARECEPTOR:');
  const domicilio = get('DOMICILIO:');

  const itemsLines = getBlock('ITEM:');
  const itemsRemito = itemsLines.map((ln) => {
    // Reutilizamos el mismo formato que Recibo: cantidad;descripcion;importe
    const parts = String(ln).split(';');
    const cantidad = Number(parts[0] || '1') || 1;
    const descripcion = (parts[1] || '').trim();
    const total = parseImporte(parts[2] || '0');
    return { cantidad, descripcion, total };
  });

  const pagosLines = getBlock('PAGO:');
  const pagos = pagosLines.map((ln) => {
    const parts = String(ln).split(';');
    const medio = (parts[0] || '').trim();
    const detalle = (parts[1] || '').trim();
    const importe = parseImporte(parts[2] || '0');
    return { medio, detalle, importe };
  });

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

  const cab1Lines = getBlock('OBS.CABCERA1:');
  const cab2Lines = getBlock('OBS.CABCERA2:');
  const pieLines = [...getBlock('OBS.PIE:'), ...getBlock('OBS.PIE:1')];
  const graciasLine = get('GRACIAS:') || undefined;
  const remitoNum = get('REMITO:') || undefined;

  let atendio = '';
  let hora = '';
  let mail = '';
  const cab1Text = cab1Lines.join(' | ');
  const mAt = cab1Text.match(/Atendio:\s*([^|]+)/i); if (mAt) atendio = mAt[1].trim();
  const mHr = cab1Text.match(/Hora:\s*([^|]+)/i); if (mHr) hora = `Hora: ${mHr[1].trim()}`;
  const mMl = cab1Text.match(/Mail:\s*([^|]+)/i); if (mMl) mail = mMl[1].trim();
  const mPg = cab1Text.match(/Pago:\s*([^|]+)/i); const pago = mPg ? mPg[1].trim() : '';

  return {
    tipo: 'REMITO',
    refInterna,
    fechaISO,
    horaPrint: (diaHoraRaw.split(' ')[1] || '').trim(),
    fondo,
    copias,
    moneda,
    email: email || undefined,
    whatsapp: whatsapp || undefined,
    receptor: { codigo, nombre, docTipo, docNro, condicionTxt, ivaReceptor, domicilio },
    itemsRemito,
    pagos,
    totales: { neto21, neto105, neto27, exento, iva21, iva105, iva27, total },
    obs: { cabecera1: cab1Lines, cabecera2: cab2Lines, pie: pieLines, atendio, hora, mail, pago },
    gracias: graciasLine,
    remito: remitoNum,
    fiscal: pieLines,
  };
}

function loadRemitoConfig(cfgPath: string): { pv: number; contador: number; outLocal?: string; outRed1?: string; outRed2?: string; printerName?: string } {
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

function saveRemitoConfig(cfgPath: string, cfg: { pv: number; contador: number }) {
  try { fs.mkdirSync(path.dirname(cfgPath), { recursive: true }); } catch {}
  let existing: any = {};
  try { const t = fs.readFileSync(cfgPath, 'utf8'); existing = JSON.parse(t || '{}'); } catch {}
  const next = { ...existing, pv: cfg.pv, contador: cfg.contador };
  fs.writeFileSync(cfgPath, JSON.stringify(next, null, 2));
}

export async function processRemitoFacFile(fullPath: string): Promise<string> {
  const raw = fs.readFileSync(fullPath, 'utf8');
  const tipoMatch = raw.match(/\bTIPO:\s*(\S+)/i);
  const tipo = (tipoMatch?.[1] || '').toUpperCase();
  if (tipo !== 'REMITO') throw new Error('FAC no REMITO (aún no soportado)');

  const parsed = parseFacRemito(raw, fullPath);

  const base = process.cwd();
  const cfgPath = path.join(base, 'config', 'remito.config.json');
  const remitoCfg = loadRemitoConfig(cfgPath);

  const candidates = [path.join(base, 'templates', 'MiFondoRe.jpg'), path.join(base, 'templates', 'MiFondoRm.jpg')];
  const resolveFondoPath = (fondoRaw?: string | null) => {
    if (!fondoRaw) return null as string | null;
    const tryPaths: string[] = [];
    const trimmed = String(fondoRaw).trim().replace(/^"|"$/g, '');
    tryPaths.push(trimmed);
    tryPaths.push(trimmed.replace(/\\/g, path.sep).replace(/\//g, path.sep));
    tryPaths.push(path.resolve(trimmed));
    for (const p of tryPaths) { try { if (p && fs.existsSync(p)) return p; } catch {} }
    return null as string | null;
  };
  let bgPath = resolveFondoPath(parsed.fondo);
  if (!bgPath) bgPath = candidates.find((p) => fs.existsSync(p)) || path.join(base, 'public', 'Noimage.jpg');

  const pvStr = String(remitoCfg.pv).padStart(4, '0');
  const nroStr = String(remitoCfg.contador).padStart(8, '0');
  const fileName = `REM_${pvStr}-${nroStr}.pdf`;

  function buildMonthDir(rootDir: string | undefined): string | null {
    if (!rootDir) return null;
    const root = String(rootDir).trim();
    if (!root) return null;
    const venta = path.join(root, `Ventas_PV${Number(remitoCfg.pv)}`);
    const yyyymm = dayjs(parsed.fechaISO).format('YYYYMM');
    const monthDir = path.join(venta, `F${yyyymm}`);
    try { fs.mkdirSync(monthDir, { recursive: true }); } catch {}
    return monthDir;
  }

  const outLocalDir = buildMonthDir((remitoCfg as any).outLocal || '');
  const outRed1Dir = buildMonthDir((remitoCfg as any).outRed1 || '');
  const outRed2Dir = buildMonthDir((remitoCfg as any).outRed2 || '');
  if (!outLocalDir) throw new Error('Ruta Local no configurada para Remitos');
  const localOutPath = path.join(outLocalDir, fileName);

  const clienteNombreFull = (parsed.receptor.codigo ? `(${parsed.receptor.codigo}) ` : '') + (parsed.receptor.nombre || '').trim();
  const data = {
    empresa: { nombre: 'Empresa', domicilio: '', cuit: '', pv: remitoCfg.pv, numero: remitoCfg.contador },
    cliente: { nombre: clienteNombreFull, domicilio: parsed.receptor.domicilio, cuitDni: parsed.receptor.docNro, condicionIva: parsed.receptor.condicionTxt },
    fecha: parsed.fechaISO,
    hora: parsed.obs.hora || undefined,
    atendio: parsed.obs.atendio || undefined,
    condicionPago: parsed.obs.pago || undefined,
    email: parsed.obs.mail || undefined,
    tipoComprobanteLiteral: 'REMITO',
    tipoComprobanteLetra: 'X',
    referenciaInterna: parsed.refInterna,
    remito: parsed.remito || undefined,
    gracias: parsed.gracias || undefined,
    mipymeModo: undefined,
    observaciones: parsed.obs.cabecera2.filter(Boolean).slice(0, 2).join('\n'),
    pieObservaciones: parsed.obs.pie.filter(Boolean).join('\n'),
    fiscal: (parsed.fiscal && parsed.fiscal.length) ? parsed.fiscal.join('\n') : undefined,
    items: parsed.itemsRemito.map((it) => ({ descripcion: it.descripcion, cantidad: it.cantidad, unitario: it.total, iva: 0, total: it.total })),
    netoGravado: (parsed.totales.neto21 || 0) + (parsed.totales.neto105 || 0) + (parsed.totales.neto27 || 0),
    ivaPorAlicuota: { '21': parsed.totales.iva21 || 0, '10.5': parsed.totales.iva105 || 0, '27': parsed.totales.iva27 || 0 },
    ivaTotal: (parsed.totales.iva21 || 0) + (parsed.totales.iva105 || 0) + (parsed.totales.iva27 || 0),
    total: parsed.totales.total,
    cae: '',
    caeVto: '',
  } as any;

  await generateInvoicePdf({ bgPath, outputPath: localOutPath, data, config: layoutMendoza, qrDataUrl: undefined });

  try {
    const name = `REM_${pvStr}-${nroStr}.pdf`;
    const tryCopy = (dstDir: string | null) => {
      if (!dstDir) return;
      try { fs.copyFileSync(localOutPath, path.join(dstDir, name)); } catch {}
    };
    tryCopy(outRed1Dir);
    tryCopy(outRed2Dir);
  } catch {}

  // Email si corresponde
  try {
    const to = (parsed.email || '').trim();
    const isValidEmail = (s: string) => /.+@.+\..+/.test(s);
    if (to && isValidEmail(to)) {
      try {
        const { sendReceiptEmail } = await import('../../services/EmailService');
        await sendReceiptEmail(to, localOutPath, {
          subject: 'Remito',
          title: 'Remito',
          intro: 'Adjuntamos el remito correspondiente.',
          bodyHtml: '<p>Gracias por su preferencia.</p>'
        });
      } catch (e) {
        try { console.warn('[remito] envío de email falló:', (e as any)?.message || String(e)); } catch {}
      }
    }
  } catch {}

  // WhatsApp si corresponde
  try {
    const phone = (parsed.whatsapp || '').trim();
    if (phone) {
      const clienteNombreFull2 = (parsed.receptor.nombre || '').trim();
      const onlyDigits = phone.replace(/[^0-9]/g, '');
      const normalizedPhone = onlyDigits.startsWith('54') ? ('+' + onlyDigits) : ('+54' + onlyDigits);
      const stamp = dayjs().format('HHmmss');
      const rand = Math.random().toString(36).slice(2, 4);
      const wfaName = `wfa${stamp}${rand}.txt`;
      const wfaPath = path.join(outLocalDir as string, wfaName);
      const lines = [
        normalizedPhone,
        clienteNombreFull2,
        path.basename(localOutPath),
        'Que tal, somos de Todo Computacion',
        'Adjuntamos "el remito realizado."',
      ];
      try { fs.writeFileSync(wfaPath, lines.join('\n'), 'utf8'); } catch {}
      try {
        const { sendFilesToWhatsappFtp } = await import('../../services/FtpService');
        await sendFilesToWhatsappFtp([localOutPath, wfaPath], [path.basename(localOutPath), path.basename(wfaPath)]);
        try { fs.unlinkSync(wfaPath); } catch {}
      } catch (e) {
        try { console.warn('[remito] envío WhatsApp FTP falló:', (e as any)?.message || String(e)); } catch {}
      }
    }
  } catch {}

  // Impresión
  try {
    const copies = Math.max(0, Number(parsed.copias || 0));
    if (copies > 0) {
      const { printPdf } = await import('../../services/PrintService');
      await printPdf(localOutPath, remitoCfg.printerName, copies);
    }
  } catch {}

  // Incrementar contador
  saveRemitoConfig(cfgPath, { pv: remitoCfg.pv, contador: (data.empresa.numero || 0) + 1 });

  // Generar .res con sufijo 'r'
  let resPath: string | null = null;
  try {
    const now = new Date();
    const fechaStr = dayjs(now).format('DD/MM/YYYY');
    const nroOut = String(data.empresa.numero).padStart(8, '0');
    const resLines = [
      'RESPUESTA AFIP    :',
      'CUIT EMPRESA      : 30708673435',
      'MODO              : 0',
      `PUNTO DE VENTA    : ${String(remitoCfg.pv).padStart(5, '0').slice(-5)}`,
      `NUMERO COMPROBANTE: ${nroOut}`,
      `FECHA COMPROBANTE : ${fechaStr}`,
      'NUMERO CAE        :',
      'VENCIMIENTO CAE   : 0',
      `ARCHIVO REFERENCIA: ${path.basename(fullPath)}`,
      `ARCHIVO PDF       : ${path.basename(localOutPath)}`,
      '',
    ];
    const dir = path.dirname(fullPath);
    const baseName = path.basename(fullPath, path.extname(fullPath));
    const shortBase = baseName.slice(-8).toLowerCase().replace(/.$/, 'r'); // última letra = 'r'
    resPath = path.join(dir, `${shortBase}.res`);
    const joined = raw.replace(/\s*$/, '') + '\n' + resLines.join('\n');
    fs.writeFileSync(resPath, joined, 'utf8');
  } catch {}

  // Enviar .res por FTP y limpiar
  try {
    if (resPath && fs.existsSync(resPath)) {
      try { console.log('[remito] Intentando enviar .res por FTP:', path.basename(resPath)); } catch {}
      await sendArbitraryFile(resPath, path.basename(resPath));
      try { fs.unlinkSync(resPath); } catch {}
      try { fs.unlinkSync(fullPath); } catch {}
      try { console.log('[remito] .res enviado por FTP y archivos limpiados'); } catch {}
    }
  } catch {}

  return localOutPath;
}

export default { processRemitoFacFile };


