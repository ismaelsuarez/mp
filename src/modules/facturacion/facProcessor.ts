import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { generateInvoicePdf } from '../../pdfRenderer';
import layoutMendoza from '../../invoiceLayout.mendoza';
import { sendArbitraryFile } from '../../services/FtpService';

type ParsedRecibo = {
  tipo: 'RECIBO';
  refInterna: string;
  fechaISO: string;
  horaPrint?: string;
  fondo?: string;
  copias: number;
  moneda?: string;
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

  // Items/Pagos
  const startItems = lines.findIndex((l) => l.trim() === 'ITEM:');
  const pagos: ParsedRecibo['pagos'] = [];
  const itemsRecibo: ParsedRecibo['itemsRecibo'] = [];
  if (startItems >= 0) {
    for (let i = startItems + 1; i < lines.length; i++) {
      const l = lines[i];
      if (/^TOTALES:/.test(l)) break;
      const mPago = l.match(/\s*\d+\s+([^:]+):([^\s]+).*?(\d+[\.,]?\d*)\s*$/);
      if (mPago) {
        const medio = mPago[1].trim();
        const detalle = mPago[2].trim();
        const imp = parseImporte(mPago[3]);
        pagos.push({ medio, detalle, importe: imp });
      }
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
  const pieLines: string[] = [];
  for (const ln of pieAll) {
    if (!ln || ln === '.') continue;
    if (!graciasLine && /gracias/i.test(ln)) { graciasLine = (ln || '').trim(); continue; }
    pieLines.push(ln);
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
    receptor: { codigo, nombre, docTipo, docNro, condicionTxt, ivaReceptor, domicilio },
    itemsRecibo,
    pagos,
    totales,
    obs: { cabecera1: cab1Lines, cabecera2: cab2Lines, pie: pieLines, atendio, hora, mail, pago },
    gracias: graciasLine,
    remito: remitoNum,
    fiscal: fiscalLines,
  };
}

function loadReciboConfig(cfgPath: string): { pv: number; contador: number } {
  try {
    const txt = fs.readFileSync(cfgPath, 'utf8');
    const json = JSON.parse(txt || '{}');
    return { pv: Number(json.pv) || 1, contador: Number(json.contador) || 1 };
  } catch {
    return { pv: 1, contador: 1 };
  }
}
function saveReciboConfig(cfgPath: string, cfg: { pv: number; contador: number }) {
  try { fs.mkdirSync(path.dirname(cfgPath), { recursive: true }); } catch {}
  fs.writeFileSync(cfgPath, JSON.stringify({ pv: cfg.pv, contador: cfg.contador }, null, 2));
}

export async function processFacFile(fullPath: string): Promise<string> {
  const raw = fs.readFileSync(fullPath, 'utf8');
  const tipoMatch = raw.match(/\bTIPO:\s*(\S+)/i);
  const tipo = (tipoMatch?.[1] || '').toUpperCase();
  if (tipo !== 'RECIBO') throw new Error('FAC no RECIBO (aún no soportado)');

  const parsed = parseFacRecibo(raw, fullPath);

  const base = process.cwd();
  const cfgPath = path.join(base, 'config', 'recibo.config.json');
  const reciboCfg = loadReciboConfig(cfgPath);

  // Fondo
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

  const outDir = path.join(base, 'tmp');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
  const pvStr = String(reciboCfg.pv).padStart(4, '0');
  const nroStr = String(reciboCfg.contador).padStart(8, '0');
  const outPath = path.join(outDir, `REC_${pvStr}-${nroStr}.pdf`);

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
    items: parsed.itemsRecibo.map((it) => ({ descripcion: it.descripcion, cantidad: it.cantidad, unitario: it.total, iva: 0, total: it.total })),
    netoGravado: (parsed.totales.neto21 || 0) + (parsed.totales.neto105 || 0) + (parsed.totales.neto27 || 0),
    ivaPorAlicuota: { '21': parsed.totales.iva21 || 0, '10.5': parsed.totales.iva105 || 0, '27': parsed.totales.iva27 || 0 },
    ivaTotal: (parsed.totales.iva21 || 0) + (parsed.totales.iva105 || 0) + (parsed.totales.iva27 || 0),
    total: parsed.totales.total,
    cae: '',
    caeVto: '',
  } as any;

  await generateInvoicePdf({ bgPath, outputPath: outPath, data, config: layoutMendoza, qrDataUrl: undefined });

  // Incrementar contador
  saveReciboConfig(cfgPath, { pv: reciboCfg.pv, contador: (data.empresa.numero || 0) + 1 });
  // Escribir respuesta .res en el mismo directorio del .fac
  let resPath: string | null = null;
  try {
    const now = new Date();
    const fechaStr = dayjs(now).format('DD/MM/YYYY');
    const pvStr = String(reciboCfg.pv).padStart(5, '0').slice(-5).replace(/^0/, '0');
    const pvOut = String(reciboCfg.pv).padStart(5, '0').slice(-5); // asegurar 5 dígitos
    const nroOut = String(data.empresa.numero).padStart(8, '0');
    const resLines = [
      'RESPUESTA AFIP    :',
      'CUIT EMPRESA      : 30708673435',
      'MODO              : 0',
      `PUNTO DE VENTA    : ${String(reciboCfg.pv).padStart(5, '0').slice(-5)}`,
      `NUMERO COMPROBANTE: ${nroOut}`,
      `FECHA COMPROBANTE : ${fechaStr}`,
      'NUMERO CAE        :',
      'VENCIMIENTO CAE   : 0',
      `ARCHIVO REFERENCIA: ${path.basename(fullPath)}`,
      `ARCHIVO PDF       : ${path.basename(outPath)}`,
      '',
    ];
    const dir = path.dirname(fullPath);
    const baseName = path.basename(fullPath, path.extname(fullPath));
    const shortBase = baseName.slice(-8); // usar últimos 8 (ej.: 5421946Q). Cambiar a -12 si se requiere 12.
    const shortBaseLower = shortBase.toLowerCase();
    resPath = path.join(dir, `${shortBaseLower}.res`);
    const joined = raw.replace(/\s*$/,'') + '\n' + resLines.join('\n');
    fs.writeFileSync(resPath, joined, 'utf8');
  } catch {}

  // Enviar .res por FTP (si hay config)
  try {
    if (resPath && fs.existsSync(resPath)) {
      await sendArbitraryFile(resPath, path.basename(resPath));
      try { fs.unlinkSync(resPath); } catch {}
      // Borrar también el archivo .fac original tras envío exitoso del .res
      try { fs.unlinkSync(fullPath); } catch {}
    }
  } catch {}

  return outPath;
}

export default { processFacFile };


