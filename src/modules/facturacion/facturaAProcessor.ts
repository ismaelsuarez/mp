import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { generateInvoicePdf } from '../../pdfRenderer';
import layoutMendoza from '../../invoiceLayout.mendoza';
import { sendArbitraryFile } from '../../services/FtpService';

type ParsedFacturaA = {
  tipo: 'FACTURA A';
  fechaISO: string;
  pv: number;
  fondo?: string;
  copias: number;
  receptor: { nombre?: string; cuit?: string; condicionIva?: string; domicilio?: string };
  items: Array<{ cantidad: number; descripcion: string; unitario?: number; iva?: number; total?: number }>;
  totales: { neto: number; iva: number; total: number; ivaPorAlicuota: Record<string, number> };
  email?: string;
  whatsapp?: string;
  obsPie?: string[];
  obsFiscal?: string[];
};

function parseImporte(raw: unknown): number { const s = String(raw ?? '').trim(); if (!s) return 0; if (/^\d{1,3}(\.\d{3})+,\d{2}$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.')); if (s.includes(',') && !s.includes('.')) return Number(s.replace(',', '.')); return Number(s); }

export async function processFacturaAFacFile(fullPath: string): Promise<string> {
  const raw = fs.readFileSync(fullPath, 'utf8');
  const tipo = (raw.match(/\bTIPO:\s*(.+)/i)?.[1] || '').trim().toUpperCase();
  if (tipo !== 'FACTURA A') throw new Error('FAC no FACTURA A');

  const lines = raw.split(/\r?\n/);
  const get = (key: string) => (lines.find(l => l.startsWith(key))?.substring(key.length).trim() || '');
  const getBlock = (start: string) => {
    const s = lines.findIndex(l => l.trim().startsWith(start));
    if (s < 0) return [] as string[];
    const out: string[] = [];
    for (let i = s + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (/^(OBS\.|ITEM:|TOTALES:|IP:|TIPO:|FONDO:|COPIAS:|CLIENTE:|TIPODOC:|NRODOC:|CONDICION:|IVARECEPTOR:|DOMICILIO:|MONEDA:|DIAHORA:)/.test(t)) break;
      if (t) out.push(t);
    }
    return out;
  };

  const diaHoraRaw = get('DIAHORA:');
  const fechaISO = (() => {
    const m = diaHoraRaw.match(/(\d{2})\/(\d{2})\/(\d{2})/);
    if (m) return `20${m[3]}-${m[2]}-${m[1]}`;
    return dayjs().format('YYYY-MM-DD');
  })();
  const pv = Number(get('PV:') || '1') || 1;
  const fondo = get('FONDO:') || undefined;
  const copias = Number(get('COPIAS:') || '1');

  const receptor = {
    nombre: (get('CLIENTE:') || '').trim(),
    cuit: (get('NRODOC:') || '').trim(),
    condicionIva: (get('CONDICION:') || '').trim(),
    domicilio: (get('DOMICILIO:') || '').trim(),
  };
  const email = (get('EMAIL:') || '').trim() || undefined;
  const whatsapp = (get('WHATSAPP:') || '').trim() || undefined;

  // Ítems: sólo para PDF
  const itemsLines = getBlock('ITEM:');
  const items = itemsLines.map(l => {
    const qty = (l.match(/^\s*(\d+)/)?.[1] || '1');
    let cuerpo = String(l);
    cuerpo = cuerpo.replace(/^\s*\d+\s+/, '');
    const mTot = cuerpo.match(/(\d+(?:[\.,]\d+)?)\s*$/);
    let total: number | undefined = undefined;
    if (mTot) { total = parseImporte(mTot[1]); cuerpo = cuerpo.replace(/(\d+(?:[\.,]\d+)?)\s*$/, ''); }
    return { cantidad: Number(qty) || 1, descripcion: cuerpo.trim().replace(/\s{2,}/g, ' '), total };
  });

  // Totales consolidados
  const totLines = getBlock('TOTALES:');
  let neto = 0, iva = 0, total = 0; const ivaPorAlicuota: Record<string, number> = {};
  totLines.forEach(t => {
    const [kRaw, vRaw] = String(t).split(':').map(s => s.trim());
    const k = (kRaw || '').toUpperCase(); const v = parseImporte(vRaw || '0');
    if (/^NETO/.test(k)) { neto += v; }
    else if (/^IVA\s*21/.test(k)) { iva += v; ivaPorAlicuota['21'] = (ivaPorAlicuota['21'] || 0) + v; }
    else if (/^IVA\s*10/.test(k)) { iva += v; ivaPorAlicuota['10.5'] = (ivaPorAlicuota['10.5'] || 0) + v; }
    else if (/^IVA\s*27/.test(k)) { iva += v; ivaPorAlicuota['27'] = (ivaPorAlicuota['27'] || 0) + v; }
    else if (/^TOTAL/.test(k)) { total = v; }
  });

  const obsPie = [...getBlock('OBS.PIE:'), ...getBlock('OBS.PIE:1')];
  const obsFiscal = getBlock('OBS.FISCAL:');

  // Invocar servicio de emisión + QR
  let cae = ''; let caeVto = '';
  let numero = 0;
  try {
    const { getFacturacionService } = require('../../services/FacturacionService');
    const svc = getFacturacionService();
    const res = await svc.emitirFacturaYGenerarPdf({
      pto_vta: pv as any,
      tipo_cbte: 1 as any, // Factura A
      fecha: fechaISO,
      cuit_emisor: undefined,
      cuit_receptor: receptor.cuit,
      razon_social_receptor: receptor.nombre,
      condicion_iva_receptor: receptor.condicionIva,
      detalle: [],
      neto,
      iva,
      total,
    } as any);
    numero = res?.numero || 0;
    cae = res?.cae || '';
    caeVto = res?.caeVto || '';
  } catch {}

  const base = process.cwd();
  const cfgPath = path.join(base, 'config', 'facturaA.config.json');
  function buildMonthDir(rootDir?: string): string | null { if (!rootDir) return null; const venta = path.join(String(rootDir), `Ventas_PV${Number(pv)}`); const yyyymm = dayjs(fechaISO).format('YYYYMM'); const monthDir = path.join(venta, `F${yyyymm}`); try { fs.mkdirSync(monthDir, { recursive: true }); } catch {} return monthDir; }
  let cfg: any = {}; try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8') || '{}'); } catch {}
  const outLocalDir = buildMonthDir(cfg.outLocal || ''); if (!outLocalDir) throw new Error('Ruta Local no configurada para Factura A');
  const outRed1Dir = buildMonthDir(cfg.outRed1 || '');
  const outRed2Dir = buildMonthDir(cfg.outRed2 || '');

  const pvStr = String(pv).padStart(4, '0');
  const nroStr = String(numero || cfg.contador || 1).padStart(8, '0');
  const fileName = `FA_${pvStr}-${nroStr}.pdf`;
  const localOutPath = path.join(outLocalDir, fileName);

  const data: any = {
    empresa: { pv, numero: numero || cfg.contador || 1 },
    cliente: { nombre: receptor.nombre || '', domicilio: receptor.domicilio || '', cuitDni: receptor.cuit || '', condicionIva: receptor.condicionIva || '' },
    fecha: fechaISO,
    tipoComprobanteLetra: 'A',
    tipoComprobanteLiteral: 'FACTURA',
    netoGravado: neto,
    ivaPorAlicuota: ivaPorAlicuota,
    ivaTotal: iva,
    total,
    cae,
    caeVto,
    items: items.map(i => ({ descripcion: i.descripcion, cantidad: i.cantidad, unitario: i.unitario, iva: i.iva || 0, total: i.total })),
    fiscal: (obsFiscal && obsFiscal.length ? obsFiscal.join('\n') : undefined),
    pieObservaciones: (obsPie && obsPie.length ? obsPie.join('\n') : ''),
  };

  await generateInvoicePdf({ bgPath: (fondo && fs.existsSync(fondo) ? fondo : path.join(base, 'public', 'Noimage.jpg')), outputPath: localOutPath, data, config: layoutMendoza, qrDataUrl: undefined });

  // Copias a red
  try { if (outRed1Dir) fs.copyFileSync(localOutPath, path.join(outRed1Dir, fileName)); } catch {}
  try { if (outRed2Dir) fs.copyFileSync(localOutPath, path.join(outRed2Dir, fileName)); } catch {}

  // Email
  try { if (email && /.+@.+\..+/.test(email)) { const { sendReceiptEmail } = require('../../services/EmailService'); await sendReceiptEmail(email, localOutPath, { subject: 'Factura A', title: 'Factura A', intro: 'Adjuntamos la factura.', bodyHtml: '<p>Gracias por su preferencia.</p>' }); } } catch {}

  // WhatsApp
  try {
    const phone = (whatsapp || '').replace(/[^0-9]/g, '');
    if (phone) {
      const normalized = phone.startsWith('54') ? `+${phone}` : `+54${phone}`;
      const stamp = dayjs().format('HHmmss'); const rand = Math.random().toString(36).slice(2,4);
      const wfaName = `wfa${stamp}${rand}.txt`; const wfaPath = path.join(outLocalDir, wfaName);
      fs.writeFileSync(wfaPath, [normalized, receptor.nombre || '', path.basename(localOutPath), 'Que tal, somos de Todo Computacion', 'Adjuntamos "la factura realizada."'].join('\n'), 'utf8');
      try { const { sendFilesToWhatsappFtp } = require('../../services/FtpService'); await sendFilesToWhatsappFtp([localOutPath, wfaPath], [path.basename(localOutPath), path.basename(wfaPath)]); fs.unlinkSync(wfaPath); } catch {}
    }
  } catch {}

  // Impresión
  try { const copies = Math.max(0, Number(copias || 0)); if (copies > 0) { const { printPdf } = require('../../services/PrintService'); await printPdf(localOutPath, cfg.printerName, copies); } } catch {}

  // .res con sufijo 'a'
  let resPath: string | null = null;
  try {
    const dir = path.dirname(fullPath);
    const baseName = path.basename(fullPath, path.extname(fullPath));
    const shortBase = baseName.slice(-8).toLowerCase().replace(/.$/, 'a');
    resPath = path.join(dir, `${shortBase}.res`);
    const fechaStr = dayjs().format('DD/MM/YYYY');
    const resLines = [
      'RESPUESTA AFIP    :',
      'CUIT EMPRESA      :',
      'MODO              : 0',
      `PUNTO DE VENTA    : ${String(pv).padStart(5, '0').slice(-5)}`,
      `NUMERO COMPROBANTE: ${String(numero || cfg.contador || 1).padStart(8, '0')}`,
      `FECHA COMPROBANTE : ${fechaStr}`,
      `NUMERO CAE        : ${cae}`,
      `VENCIMIENTO CAE   : ${caeVto || '0'}`,
      `ARCHIVO REFERENCIA: ${path.basename(fullPath)}`,
      `ARCHIVO PDF       : ${path.basename(localOutPath)}`,
      ''
    ];
    const joined = raw.replace(/\s*$/, '') + '\n' + resLines.join('\n');
    fs.writeFileSync(resPath, joined, 'utf8');
  } catch {}

  // Enviar .res por FTP y limpiar
  try { if (resPath && fs.existsSync(resPath)) { await sendArbitraryFile(resPath, path.basename(resPath)); try { fs.unlinkSync(resPath); } catch {} try { fs.unlinkSync(fullPath); } catch {} } } catch {}

  // Incrementar contador si corresponde
  try { const next = { ...cfg, pv, contador: (numero || cfg.contador || 1) + 1 }; fs.writeFileSync(cfgPath, JSON.stringify(next, null, 2)); } catch {}

  return localOutPath;
}

export default { processFacturaAFacFile };


