/**
 * @package @shared/utils/parsers
 * @description Funciones puras para parsing de datos
 * 
 * Parsers genéricos sin dependencias de dominio.
 */

/**
 * Parsea un importe en formato argentino
 * 
 * Soporta:
 * - Formato argentino: 1.234,56
 * - Formato decimal: 1234.56
 * - Solo comas: 1234,56
 * 
 * @param raw - Valor a parsear (string, number o unknown)
 * @returns Número parseado (0 si inválido)
 */
export function parseImporte(raw: unknown): number {
  const s = String(raw ?? '').trim();
  if (!s) return 0;
  
  // Formato argentino: 1.234,56 → 1234.56
  if (/^\d{1,3}(\.\d{3})+,\d{2}$/.test(s)) {
    return Number(s.replace(/\./g, '').replace(',', '.'));
  }
  
  // Formato con coma como decimal: 1234,56 → 1234.56
  if (s.includes(',') && !s.includes('.')) {
    return Number(s.replace(',', '.'));
  }
  
  // Formato estándar
  return Number(s);
}

/**
 * Parsea un número con formato argentino
 * Alias de parseImporte para claridad
 */
export function parseNumeroArgentino(valor: string): number {
  return parseImporte(valor);
}

/**
 * Parsea una fecha en formato DD/MM/YY o DD/MM/YYYY a YYYYMMDD
 * 
 * @param fecha - Fecha en formato DD/MM/YY o DD/MM/YYYY
 * @returns Fecha en formato YYYYMMDD (string vacío si inválido)
 */
export function parseFechaArgentina(fecha: string): string {
  try {
    const match = fecha.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
    if (!match) return '';
    
    const [, dd, mm, yy] = match;
    const year = yy.length === 2 ? `20${yy}` : yy;
    
    return `${year}${mm}${dd}`;
  } catch {
    return '';
  }
}

/**
 * Parsea una línea DIAHORA: del formato MTXCA
 * 
 * Formato esperado: DD/MM/YY HH:MM:SS [info] terminal
 * Ejemplo: "25/10/23 14:30:45 Caja 01"
 * 
 * @param diaHoraRaw - Línea DIAHORA: completa
 * @returns Objeto con fecha (YYYYMMDD), hora (HHMMSS) y terminal
 */
export function parseDiaHoraMTXCA(diaHoraRaw: string): {
  fecha: string;      // YYYYMMDD
  hora: string;       // HHMMSS
  terminal: string;   // Terminal con padding
} {
  try {
    const m = diaHoraRaw.match(/(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+.*?(\d+)$/);
    if (!m) {
      return { fecha: '', hora: '', terminal: '' };
    }
    
    const [, dd, mm, yy, HH, MM, SS, terminal] = m;
    const fecha = `20${yy}${mm}${dd}`; // YYYYMMDD
    const hora = `${HH}${MM}${SS}`;     // HHMMSS
    const term = String(terminal).padStart(2, '0');
    
    return { fecha, hora, terminal: term };
  } catch {
    return { fecha: '', hora: '', terminal: '' };
  }
}

/**
 * Formatea un número a formato argentino
 * 
 * @param num - Número a formatear
 * @param decimals - Cantidad de decimales (default: 2)
 * @returns String en formato argentino (ej: "1.234,56")
 */
export function formatNumeroArgentino(num: number, decimals: number = 2): string {
  const fixed = num.toFixed(decimals);
  const [entero, decimal] = fixed.split('.');
  
  // Agregar separador de miles
  const enteroFormateado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return decimal ? `${enteroFormateado},${decimal}` : enteroFormateado;
}

