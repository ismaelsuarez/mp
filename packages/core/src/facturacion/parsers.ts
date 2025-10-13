/**
 * @package @core/facturacion/parsers
 * @description Parsers puros para archivos de facturación MTXCA
 * 
 * Funciones puras para extraer datos de archivos .fac y otros formatos.
 * Sin dependencias de fs, electron, o infraestructura.
 */

import { parseImporte, parseDiaHoraMTXCA } from '@shared/utils/parsers';
import dayjs from 'dayjs';

/**
 * Tipo de datos de receptor parseado
 */
export interface ReceptorParsed {
  codigo?: string;
  nombre: string;
  docTipo?: number;
  docNro?: string;
  condicionTxt?: string;
  ivaReceptor?: string;
  domicilio?: string;
}

/**
 * Tipo de datos de observaciones parseadas
 */
export interface ObservacionesParsed {
  cabecera1: string[];
  cabecera2: string[];
  pie: string[];
  fiscal?: string[];
  atendio?: string;
  hora?: string;
  mail?: string;
  pago?: string;
}

/**
 * Tipo de datos de totales parseados
 */
export interface TotalesParsed {
  neto21: number;
  neto105: number;
  neto27: number;
  exento: number;
  iva21: number;
  iva105: number;
  iva27: number;
  total: number;
}

/**
 * Extrae un valor de una línea con formato "KEY: value"
 * 
 * @param lines - Array de líneas
 * @param key - Clave a buscar (ej: "CLIENTE:")
 * @returns Valor después de la clave (trim)
 */
export function extractValue(lines: string[], key: string): string {
  const ln = lines.find((l) => l.startsWith(key));
  return ln ? ln.substring(key.length).trim() : '';
}

/**
 * Extrae un bloque de líneas después de una clave
 * 
 * Lee líneas consecutivas después de startKey hasta encontrar otra clave
 * o hasta el fin del array.
 * 
 * @param lines - Array de líneas
 * @param startKey - Clave de inicio del bloque
 * @returns Array de líneas del bloque (sin la clave de inicio)
 */
export function extractBlock(lines: string[], startKey: string): string[] {
  const startIdx = lines.findIndex((l) => l.trim().startsWith(startKey));
  if (startIdx < 0) return [];
  
  const out: string[] = [];
  
  // Patrón de claves conocidas que terminan un bloque
  const keyPattern = /^(OBS\.|ITEM:|TOTALES:|IP:|TIPO:|FONDO:|COPIAS:|CLIENTE:|TIPODOC:|NRODOC:|CONDICION:|IVARECEPTOR:|DOMICILIO:|MONEDA:|DIAHORA:)/;
  
  for (let i = startIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (keyPattern.test(t)) break;
    if (t) out.push(t);
  }
  
  return out;
}

/**
 * Parsea datos del receptor desde líneas de archivo .fac
 * 
 * @param lines - Array de líneas del archivo
 * @returns Datos del receptor parseados
 */
export function parseReceptor(lines: string[]): ReceptorParsed {
  const clienteRaw = extractValue(lines, 'CLIENTE:');
  let codigo = '', nombre = clienteRaw.trim();
  
  // Extraer código si está presente (formato: "CÓDIGO - NOMBRE")
  const mCod = clienteRaw.match(/^([A-Z0-9]+)\s*-\s*(.+)$/);
  if (mCod) {
    codigo = mCod[1].trim();
    nombre = mCod[2].trim();
  }
  
  // Tipo y número de documento
  const docTipoRaw = extractValue(lines, 'TIPODOC:');
  let docTipo: number | undefined;
  if (docTipoRaw.includes('DNI')) docTipo = 96;
  else if (docTipoRaw.includes('CUIT')) docTipo = 80;
  else if (docTipoRaw.includes('CUIL')) docTipo = 86;
  
  const docNro = extractValue(lines, 'NRODOC:').replace(/[^0-9]/g, '');
  
  // Condición IVA
  const condicionTxt = extractValue(lines, 'CONDICION:');
  const ivaReceptor = extractValue(lines, 'IVARECEPTOR:');
  
  // Domicilio
  const domicilio = extractValue(lines, 'DOMICILIO:');
  
  return {
    codigo: codigo || undefined,
    nombre,
    docTipo,
    docNro: docNro || undefined,
    condicionTxt: condicionTxt || undefined,
    ivaReceptor: ivaReceptor || undefined,
    domicilio: domicilio || undefined
  };
}

/**
 * Parsea observaciones desde líneas de archivo .fac
 * 
 * @param lines - Array de líneas del archivo
 * @returns Observaciones parseadas
 */
export function parseObservaciones(lines: string[]): ObservacionesParsed {
  const cab1Lines = extractBlock(lines, 'OBS.CABCERA1:');
  const cab2LinesRaw = extractBlock(lines, 'OBS.CABCERA2:');
  const fiscalLines = extractBlock(lines, 'OBS.FISCAL:');
  const pieAll = [
    ...extractBlock(lines, 'OBS.PIE:'),
    ...extractBlock(lines, 'OBS.PIE:1')
  ];
  
  // Extraer remito si existe
  let remitoNum = '';
  const cab2Lines = cab2LinesRaw.filter((ln) => {
    const mRem = ln.match(/REMITO:\s*(.*)/i);
    if (mRem) {
      remitoNum = (mRem[1] || '').trim();
      return false;
    }
    return true;
  });
  
  return {
    cabecera1: cab1Lines,
    cabecera2: cab2Lines,
    pie: pieAll,
    fiscal: fiscalLines.length > 0 ? fiscalLines : undefined
  };
}

/**
 * Parsea totales desde líneas de archivo .fac
 * 
 * Formato esperado:
 * ```
 * TOTALES:
 * NETO 21%: 1000,00
 * IVA 21%: 210,00
 * TOTAL: 1210,00
 * ```
 * 
 * @param lines - Array de líneas del archivo
 * @returns Totales parseados
 */
export function parseTotales(lines: string[]): TotalesParsed {
  const totalLine = lines.find((l) => /^TOTAL\s*:/.test(l));
  let total = 0;
  if (totalLine) {
    total = parseImporte(totalLine.split(':')[1]);
  }
  
  const totales: TotalesParsed = {
    neto21: 0,
    neto105: 0,
    neto27: 0,
    exento: 0,
    iva21: 0,
    iva105: 0,
    iva27: 0,
    total
  };
  
  const startTotals = lines.findIndex((l) => l.trim() === 'TOTALES:');
  if (startTotals < 0) return totales;
  
  const keyPattern = /^(OBS\.|ITEM:|IP:|TIPO:|FONDO:|COPIAS:|CLIENTE:|TIPODOC:|NRODOC:|CONDICION:|IVARECEPTOR:|DOMICILIO:|MONEDA:|DIAHORA:|TOTALES:$)/;
  
  for (let i = startTotals + 1; i < lines.length; i++) {
    const t = lines[i];
    if (keyPattern.test(t.trim())) break;
    
    const kv = t.match(/^(NETO 21%|NETO 10\.5%|NETO 27%|EXENTO|IVA 21%|IVA 10\.5%|IVA 27%|TOTAL)\s*:\s*([\d\.,]+)$/i);
    if (!kv) continue;
    
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
  
  return totales;
}

/**
 * Parsea referencia interna desde nombre de archivo y DIAHORA
 * 
 * @param fileName - Nombre del archivo (con o sin path)
 * @param diaHoraRaw - Línea DIAHORA: raw
 * @returns Referencia interna única
 */
export function parseRefInterna(fileName: string, diaHoraRaw: string): string {
  const { fecha, hora, terminal } = parseDiaHoraMTXCA(diaHoraRaw);
  
  if (fecha && hora && terminal) {
    return `${fecha.slice(2)}${hora}${terminal}Q`;
  }
  
  // Fallback: usar nombre de archivo sin extensión
  const baseName = fileName.replace(/\.[^.]+$/, '');
  return baseName || 'UNKNOWN';
}

/**
 * Convierte fecha YYYYMMDD a formato ISO (YYYY-MM-DD)
 * Con validación y fallback a fecha actual si inválido
 * 
 * @param yyyymmdd - Fecha en formato YYYYMMDD
 * @returns Fecha en formato ISO
 */
export function toISODateSafe(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) {
    return dayjs().format('YYYY-MM-DD');
  }
  
  const iso = `${yyyymmdd.substring(0, 4)}-${yyyymmdd.substring(4, 6)}-${yyyymmdd.substring(6, 8)}`;
  
  // Validar que la fecha sea válida
  if (!dayjs(iso).isValid()) {
    return dayjs().format('YYYY-MM-DD');
  }
  
  return iso;
}

