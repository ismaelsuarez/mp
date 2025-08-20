import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { FacturaData, TipoComprobante } from './types';
import dayjs from 'dayjs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Handlebars = require('handlebars');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRCode = require('qrcode');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const puppeteer = require('puppeteer');

export async function generarFacturaPdf(data: FacturaData): Promise<string> {
  const plantilla = resolveTemplate(data.comprobante.tipo);
  const tpl = fs.readFileSync(plantilla, 'utf8');
  const compile = Handlebars.compile(tpl);
  const qrDataUrl = data.afip?.qrData ? await QRCode.toDataURL(data.afip.qrData, { width: 240 }) : undefined;
  const view = {
    ...data,
    fecha_formateada: dayjs(data.comprobante.fecha, 'YYYYMMDD').format('DD/MM/YYYY'),
    numero_formateado: String(data.comprobante.numero).padStart(8, '0'),
    qr_data_url: qrDataUrl
  };
  const html = compile(view);

  const outDir = path.join(app.getPath('documents'), 'facturas');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
  const nombre = `${data.comprobante.tipo}_${String(data.comprobante.numero).padStart(8, '0')}.pdf`;
  const outPath = path.join(outDir, nombre);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({ path: outPath, printBackground: true, format: 'A4', margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
  } finally {
    try { await browser.close(); } catch {}
  }
  return outPath;
}

function resolveTemplate(tipo: TipoComprobante): string {
  const base = path.join(app.getAppPath(), 'src', 'modules', 'facturacion', 'templates');
  const name = tipo === 'FA' ? 'factura_a.html' : tipo === 'FB' ? 'factura_b.html' : tipo === 'NC' ? 'nota_credito.html' : 'recibo.html';
  const full = path.join(base, name);
  if (!fs.existsSync(full)) throw new Error(`Plantilla no encontrada: ${full}`);
  return full;
}


