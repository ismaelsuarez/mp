import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { DBFFile } from 'dbffile';
import ExcelJS from 'exceljs';
import Store from 'electron-store';

type Row = {
  tipo: 'BILLETES' | 'DIVISAS';
  moneda: string;
  cod: string;
  compra: number | null;
  venta: number | null;
  unidad: number; // 1 o 100
};

type Quotes = {
  fuente: 'BNA';
  fecha: string; // YYYY-MM-DD
  hora?: string; // HH:mm
  billetes: Row[];
  divisas: Row[];
};

function getStore(): Store<{ config?: any }> {
  return new Store({ name: 'settings' });
}

function getUserDataDir(): string {
  try { return app.getPath('userData'); } catch {
    const appData = process.env.APPDATA || (process.platform === 'darwin'
      ? path.join(process.env.HOME || '', 'Library/Application Support')
      : path.join(process.env.HOME || '', '.config'));
    return path.join(appData, 'Tc-Mp');
  }
}

export function getBnaInboxDir(): string {
  const s = getStore();
  return s.get('dolar.inboxDir', 'C:\\tmp') as string;
}

export function getBnaOutDir(): string {
  const base = path.join(getUserDataDir(), 'bna', 'reportes');
  try { if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true }); } catch {}
  return base;
}

export function getBnaRetentionDays(): number {
  const s = getStore();
  const n = Number(s.get('dolar.retentionDays', 7));
  return Number.isFinite(n) && n > 0 ? n : 7;
}

async function fetchHtml(): Promise<string> {
  const resp = await axios.get('https://www.bna.com.ar/Personas', {
    timeout: 15000,
    responseType: 'arraybuffer',
    transformResponse: [(d) => d],
    // Forzar contenido HTML y descompresión
    headers: {
      'User-Agent': 'Mozilla/5.0 (Node; BNA-Scraper)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br'
    },
    validateStatus: s => s >= 200 && s < 500,
  });
  const buf = Buffer.from(resp.data as ArrayBuffer);
  let text = buf.toString('utf8');
  // Si hay reemplazos o no parece HTML, intentar latin1
  if (!/(<!doctype|<html)/i.test(text) || text.includes('\uFFFD') || /�/.test(text)) {
    try { text = buf.toString('latin1'); } catch {}
  }
  if (!text || typeof text !== 'string') throw new Error('BNA vacío');
  return text;
}

function parseNumberAR(s: string): number | null {
  if (!s) return null;
  const t = s.replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.\-]/g, '').trim();
  if (!t || t === '.' || t === '-') return null;
  const n = Number(t); return Number.isFinite(n) ? n : null;
}

function toIsoFromSlash(dmy: string): string | undefined {
  const m = dmy?.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return undefined;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function codMap(name: string): { cod: string; unidad: number } {
  const n = name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const star = /\*$/.test(name.trim());
  const base: Record<string, string> = {
    'dolar u.s.a': 'USD', 'dólar u.s.a': 'USD', 'euro': 'EUR', 'libra esterlina': 'GBP', 'franco suizos': 'CHF', 'yenes': 'JPY',
    'dolares canadienses': 'CAD', 'dólares canadienses': 'CAD', 'coronas danesas': 'DKK', 'coronas noruegas': 'NOK', 'coronas suecas': 'SEK',
    'yuan': 'CNY', 'dolar australiano': 'AUD', 'dólar australiano': 'AUD'
  };
  const key = Object.keys(base).find(k => n.startsWith(k)) || '';
  return { cod: base[key] || 'XXX', unidad: star ? 100 : 1 };
}

function parsePane($: cheerio.CheerioAPI, paneSel: string, tipo: 'BILLETES' | 'DIVISAS') {
  const pane = $(paneSel).first();
  const table = pane.find('table').first();
  const headerDate = table.find('th.fechaCot').first().text().trim();
  const fecha = toIsoFromSlash(headerDate);
  let hora: string | undefined;
  const foot = pane.find('td, p, div').filter((_, el) => /Hora\s+Actualizaci[oó]n/i.test($(el).text())).first().text();
  const h = foot.match(/Hora\s+Actualizaci[oó]n:\s*([0-2]?\d:[0-5]\d)/i); if (h) hora = h[1];

  const rows: Row[] = [];
  table.find('tbody tr').each((_, tr) => {
    const tds = $(tr).find('td'); if (tds.length < 3) return;
    const name = $(tds[0]).text().replace(/\s+/g, ' ').trim(); if (!name) return;
    const compra = parseNumberAR($(tds[1]).text());
    const venta = parseNumberAR($(tds[2]).text());
    const { cod, unidad } = codMap(name);
    rows.push({ tipo, moneda: name.replace(/\s*\*$/, ''), cod, compra, venta, unidad });
  });
  return { fecha, hora, rows };
}

export async function getBnaQuotes(): Promise<Quotes> {
  const html = await fetchHtml();
  const $ = cheerio.load(html);
  const bil = parsePane($, '#billetes, #divBilletes, div.tab-content > div[id*=billete]', 'BILLETES');
  const div = parsePane($, '#divisas, #divDivisas, div.tab-content > div[id*=divisa]', 'DIVISAS');
  const fecha = bil.fecha || div.fecha; if (!fecha) throw new Error('Sin fecha');
  const hora = bil.hora || div.hora;
  return { fuente: 'BNA', fecha, hora, billetes: bil.rows, divisas: div.rows };
}

function usdRows(q: Quotes): Row[] {
  return [
    ...q.billetes.filter(r => r.cod === 'USD'),
    ...q.divisas.filter(r => r.cod === 'USD'),
  ];
}

function allRows(q: Quotes): Row[] {
  return [
    ...q.billetes,
    ...q.divisas,
  ];
}

export async function writeBnaDbf(q: Quotes, file: string): Promise<string> {
  const rows = usdRows(q); if (!rows.length) throw new Error('Sin USD');
  const dbf = await DBFFile.create(file, [
    { name: 'FECHA', type: 'D', size: 8 }, { name: 'HORA', type: 'C', size: 5 },
    { name: 'TIPO', type: 'C', size: 10 }, { name: 'MONEDA', type: 'C', size: 20 },
    { name: 'COD', type: 'C', size: 5 }, { name: 'COMPRA', type: 'N', size: 12, decs: 4 },
    { name: 'VENTA', type: 'N', size: 12, decs: 4 }, { name: 'UNIDAD', type: 'N', size: 5, decs: 0 },
    { name: 'FUENTE', type: 'C', size: 10 }
  ] as any);
  const jsDate = new Date(q.fecha + 'T00:00:00'); const hora = q.hora || '';
  await dbf.appendRecords(rows.map(r => ({
    FECHA: jsDate, HORA: hora, TIPO: r.tipo, MONEDA: r.moneda, COD: r.cod,
    COMPRA: r.compra ?? 0, VENTA: r.venta ?? 0, UNIDAD: r.unidad, FUENTE: 'BNA'
  })) as any);
  return file;
}

export async function writeBnaCsv(q: Quotes, file: string): Promise<string> {
  const rows = usdRows(q);
  const hdr = ['fecha', 'hora', 'tipo', 'moneda', 'cod', 'compra', 'venta', 'unidad', 'fuente'];
  const js = (v: any) => (v == null ? '' : String(v).replace(/"/g, '""'));
  const lines = [hdr.join(',')];
  for (const r of rows) lines.push([
    q.fecha, q.hora || '', r.tipo, r.moneda, r.cod,
    r.compra ?? '', r.venta ?? '', r.unidad, 'BNA'
  ].map(v => `"${js(v)}"`).join(','));
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  return file;
}

export async function writeBnaXlsx(q: Quotes, file: string): Promise<string> {
  const rows = usdRows(q);
  const wb = new (ExcelJS as any).Workbook(); const ws = wb.addWorksheet('USD');
  ws.addRow(['fecha', 'hora', 'tipo', 'moneda', 'cod', 'compra', 'venta', 'unidad', 'fuente']);
  for (const r of rows) ws.addRow([q.fecha, q.hora || '', r.tipo, r.moneda, r.cod, r.compra, r.venta, r.unidad, 'BNA']);
  await wb.xlsx.writeFile(file);
  return file;
}

export async function writeBnaDbfAll(q: Quotes, file: string): Promise<string> {
  const rows = allRows(q); if (!rows.length) throw new Error('Sin filas');
  const dbf = await DBFFile.create(file, [
    { name: 'FECHA', type: 'D', size: 8 }, { name: 'HORA', type: 'C', size: 5 },
    { name: 'TIPO', type: 'C', size: 10 }, { name: 'MONEDA', type: 'C', size: 20 },
    { name: 'COD', type: 'C', size: 5 }, { name: 'COMPRA', type: 'N', size: 12, decs: 4 },
    { name: 'VENTA', type: 'N', size: 12, decs: 4 }, { name: 'UNIDAD', type: 'N', size: 6, decs: 0 },
    { name: 'FUENTE', type: 'C', size: 10 }
  ] as any);
  const jsDate = new Date(q.fecha + 'T00:00:00'); const hora = q.hora || '';
  await dbf.appendRecords(rows.map(r => ({
    FECHA: jsDate, HORA: hora, TIPO: r.tipo, MONEDA: r.moneda, COD: r.cod,
    COMPRA: r.compra ?? 0, VENTA: r.venta ?? 0, UNIDAD: r.unidad, FUENTE: 'BNA'
  })) as any);
  return file;
}

export async function writeBnaCsvAll(q: Quotes, file: string): Promise<string> {
  const rows = allRows(q);
  const hdr = ['fecha', 'hora', 'tipo', 'moneda', 'cod', 'compra', 'venta', 'unidad', 'fuente'];
  const js = (v: any) => (v == null ? '' : String(v).replace(/"/g, '""'));
  const lines = [hdr.join(',')];
  for (const r of rows) lines.push([
    q.fecha, q.hora || '', r.tipo, r.moneda, r.cod,
    r.compra ?? '', r.venta ?? '', r.unidad, 'BNA'
  ].map(v => `"${js(v)}"`).join(','));
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  return file;
}

export async function writeBnaXlsxAll(q: Quotes, file: string): Promise<string> {
  const rows = allRows(q);
  const wb = new (ExcelJS as any).Workbook(); const ws = wb.addWorksheet('COTIZACIONES');
  ws.addRow(['fecha', 'hora', 'tipo', 'moneda', 'cod', 'compra', 'venta', 'unidad', 'fuente']);
  for (const r of rows) ws.addRow([q.fecha, q.hora || '', r.tipo, r.moneda, r.cod, r.compra, r.venta, r.unidad, 'BNA']);
  await wb.xlsx.writeFile(file);
  return file;
}

export function ensureDir(p: string) { const d = path.dirname(p); try { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); } catch {} }

export function makeBnaOutPaths(prefix: string) {
  const dir = getBnaOutDir();
  const dbf = path.join(dir, `${prefix}.dbf`);
  const csv = path.join(dir, `${prefix}.csv`);
  const xls = path.join(dir, `${prefix}.xlsx`);
  return { dir, dbf, csv, xls };
}

export function cleanupOldBnaReports(dir: string, days: number) {
  const now = Date.now(), ms = days * 24 * 60 * 60 * 1000;
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    try { const st = fs.statSync(p); if (now - st.mtimeMs > ms) fs.unlinkSync(p); } catch {}
  }
}

export async function runBnaOnceAndSend(): Promise<{ outDir: string; files: { dbf: string; csv: string; xls: string } }> {
  const q = await getBnaQuotes();
  const prefix = `dolar_${q.fecha.replace(/-/g, '')}`;
  const { dir, dbf, csv, xls } = makeBnaOutPaths(prefix);
  ensureDir(dbf);

  // Generar SIEMPRE las tablas completas (billetes + divisas) con nombre dolar.*
  await writeBnaDbfAll(q, dbf);
  await writeBnaCsvAll(q, csv);
  await writeBnaXlsxAll(q, xls);

  // Alias fijo
  const aliasDbf = path.join(dir, 'dolar.dbf');
  try { fs.copyFileSync(dbf, aliasDbf); } catch {}

  // Envío por FTP Mercado Pago (config dedicada)
  try {
    const { sendMpFtpFiles, sendMpDbf } = require('./FtpService');
    if (sendMpFtpFiles) {
      await sendMpFtpFiles([dbf, csv, xls], ['dolar.dbf', 'dolar.csv', 'dolar.xlsx']);
    } else if (sendMpDbf) {
      await sendMpDbf(aliasDbf, 'dolar.dbf', { force: true });
    }
  } catch {}

  cleanupOldBnaReports(dir, getBnaRetentionDays());
  return { outDir: dir, files: { dbf, csv, xls } };
}


