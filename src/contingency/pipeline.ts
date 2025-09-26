import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

// Condición IVA receptor (catálogo mínimo)
export type CondIvaCode = 1|4|5|6|8|9|10|13|15;
export const COND_IVA_MAP: Record<CondIvaCode,string> = {
  1:'IVA Responsable No Inscripto',
  4:'IVA Sujeto Exento',
  5:'Consumidor Final',
  6:'Responsable Monotributo',
  8:'Proveedor del Exterior',
  9:'Cliente del Exterior',
  10:'IVA Liberado - Ley 19.640',
  13:'Monotributista Social',
  15:'IVA No Alcanzado'
};
export function isCondIvaCode(x:any): x is CondIvaCode { return [1,4,5,6,8,9,10,13,15].includes(Number(x)); }

export type FacDTO = {
  tipo: number;
  fecha: string; // YYYYMMDD
  cliente: { docTipo: number; docNro?: string; condicion?: string; condIvaCode?: CondIvaCode; condIvaDesc?: string };
  items: Array<{ descripcion: string; cantidad: number; unitario: number; iva: number; total?: number }>;
  totales: { neto: number; iva: number; total: number };
  rawPath: string;
};

export function parseFac(filePath: string): FacDTO {
  const txt = fs.readFileSync(filePath, 'utf8');
  const lines = txt.split(/\r?\n/);
  const get = (k: string) => { const ln = lines.find(l => l.startsWith(k)); return ln ? ln.substring(k.length).trim() : ''; };
  const dia = get('DIAHORA:');
  let fecha = '';
  const m = dia.match(/(\d{2})\/(\d{2})\/(\d{2})/);
  if (m) fecha = `20${m[3]}${m[2]}${m[1]}`;
  const tipo = Number(get('TIPO:') || '6');
  const docTipo = Number(get('TIPODOC:') || '99');
  const docNro = (get('NRODOC:') || '').trim() || undefined;
  const condicion = (get('CONDICION:') || '').trim();
  // IVARECEPTOR
  const ivaReceptorRaw = get('IVARECEPTOR:');
  const ivaReceptorNum = ivaReceptorRaw ? Number(String(ivaReceptorRaw).match(/\d+/)?.[0] || '') : NaN;
  if (!isCondIvaCode(ivaReceptorNum)) {
    throw new Error('PermanentError: IVARECEPTOR desconocido');
  }
  const items: FacDTO['items'] = [];
  let i = lines.findIndex(l => l.trim() === 'ITEM:');
  if (i >= 0) {
    for (let k = i + 1; k < lines.length; k++) {
      const row = lines[k]; if (/^TOTALES:/.test(row)) break;
      const m1 = row.match(/^\s*(\d+)\s+(.*?)\s+([0-9.,]+)\s+(?:([0-9.,]+)%\s+)?([0-9.,]+)\s*$/);
      if (m1) {
        const cantidad = Number(m1[1]);
        const descripcion = m1[2].trim();
        const unitario = parseNum(m1[3]);
        const iva = m1[4] ? Number(String(m1[4]).replace(',', '.')) : 0;
        const total = parseNum(m1[5]);
        items.push({ descripcion, cantidad, unitario, iva, total });
      }
    }
  }
  const totales = { neto: 0, iva: 0, total: 0 };
  i = lines.findIndex(l => l.trim() === 'TOTALES:');
  if (i >= 0) {
    for (let k = i + 1; k < lines.length; k++) {
      const t = lines[k].trim(); if (!t) break;
      const mm = t.match(/^(NETO TOTAL|NETO 21%|NETO 10\.5%|NETO 27%|EXENTO|IVA 21%|IVA 10\.5%|IVA 27%|TOTAL)\s*:\s*([\d\.,]+)$/i);
      if (!mm) continue;
      const key = mm[1].toUpperCase(); const val = parseNum(mm[2]);
      if (key === 'TOTAL') totales.total = val;
      if (key.startsWith('IVA')) totales.iva += val;
      if (key.startsWith('NETO')) totales.neto += val;
    }
  }
  return { tipo, fecha, cliente: { docTipo, docNro, condicion, condIvaCode: ivaReceptorNum as CondIvaCode, condIvaDesc: COND_IVA_MAP[ivaReceptorNum as CondIvaCode] }, items, totales, rawPath: filePath };
}

export function validate(dto: FacDTO): void {
  const to2 = (n: number) => Number(n.toFixed(2));
  const suma = to2(dto.totales.neto + dto.totales.iva);
  if (to2(dto.totales.total) !== suma) throw new Error(`Montos no cierran: total=${dto.totales.total} vs suma=${suma}`);
  // Reglas receptor vs tipo de comprobante
  validateReceptorVsCbte(dto);
}

function validateReceptorVsCbte(dto: FacDTO): void {
  const code = dto.cliente.condIvaCode as CondIvaCode | undefined;
  if (!code) throw new Error('PermanentError: Falta IVARECEPTOR');
  const tipo = Number(dto.tipo || 0);
  const isTipoA = new Set([1,2,3]).has(tipo); // FA (1), ND A (2), NC A (3)
  const isTipoB = new Set([6,7,8]).has(tipo); // FB (6), ND B (7), NC B (8)
  // Exterior y Ley 19.640 no soportados en este flujo
  if ([8,9,10].includes(Number(code))) throw new Error('PermanentError: IVARECEPTOR no soportado por ahora (exterior/Ley 19.640)');
  if (isTipoA) {
    if ([5,4,6,13,15].includes(Number(code))) throw new Error('PermanentError: IVARECEPTOR incompatible con Tipo A');
  }
  if (isTipoB) {
    if (Number(code) === 1) throw new Error('PermanentError: Receptor requiere Tipo A');
  }
}

export function buildRequest(dto: FacDTO): any {
  // Normalización de documento según condición IVA receptor
  let docTipoFE = Number(dto.cliente.docTipo || 0);
  let docNroFE: number = Number(dto.cliente.docNro || 0);
  const code = dto.cliente.condIvaCode as CondIvaCode | undefined;
  if (code === 5) {
    docTipoFE = 99; docNroFE = 0;
  } else {
    // Exigir CUIT válido (docTipo 80 y número no nulo) para no-CF
    if (docTipoFE !== 80 || !Number(dto.cliente.docNro || 0)) {
      throw new Error('PermanentError: Documento receptor inválido para la condición IVA');
    }
  }
  const req = {
    tipo: dto.tipo,
    fecha: dto.fecha,
    docTipo: docTipoFE,
    docNro: docNroFE,
    total: dto.totales.total,
    neto: dto.totales.neto,
    iva: dto.totales.iva,
    items: dto.items,
    condIvaCode: code,
    condIvaDesc: code ? COND_IVA_MAP[code] : undefined
  };
  try { console.debug('[fac.buildRequest]', { cbteTipo: dto.tipo, condIvaCode: code, condIvaDesc: code ? COND_IVA_MAP[code] : undefined, docTipoFE, docNroFE }); } catch {}
  return req;
}

export async function generatePdf(dto: FacDTO, caeResp: { cae: string; vencimiento: string }): Promise<string> {
  const outDir = path.join(path.dirname(dto.rawPath));
  const outPath = path.join(outDir, path.basename(dto.rawPath, path.extname(dto.rawPath)) + '.stub.pdf');
  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);
  doc.fontSize(14).text('Comprobante (stub)', { align: 'left' });
  doc.moveDown().fontSize(10).text(`CAE: ${caeResp.cae}`);
  doc.text(`Vencimiento CAE: ${caeResp.vencimiento}`);
  doc.text(`Fecha: ${dto.fecha}`);
  doc.text(`Total: ${dto.totales.total}`);
  doc.end();
  await new Promise<void>((resolve) => stream.on('finish', () => resolve()));
  return outPath;
}

export async function generateRes(dto: FacDTO, caeResp?: { cae: string; vencimiento: string }, error?: string): Promise<string> {
  const dir = path.dirname(dto.rawPath);
  const base = path.basename(dto.rawPath, path.extname(dto.rawPath));
  const suf = error ? 'err' : 'res';
  const out = path.join(dir, `${base}.${suf}`);
  const lines = [
    'RESPUESTA AFIP    :',
    `FECHA COMPROBANTE : ${fmtDate(dto.fecha)}`,
    `NUMERO CAE        : ${caeResp?.cae || ''}`,
    `VENCIMIENTO CAE   : ${caeResp?.vencimiento || '0'}`,
    error ? `ERROR             : ${error}` : ''
  ].filter(Boolean).join('\n');
  fs.writeFileSync(out, lines, 'utf8');
  return out;
}

function parseNum(s: string): number { const str = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s; return Number(str); }
function fmtDate(yyyymmdd: string): string { return `${yyyymmdd.slice(6,8)}/${yyyymmdd.slice(4,6)}/${yyyymmdd.slice(0,4)}`; }


