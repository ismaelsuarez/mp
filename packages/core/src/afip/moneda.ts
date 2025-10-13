/**
 * @package @core/afip/moneda
 * @description Funciones puras para manejo de monedas AFIP
 * 
 * Lógica de negocio relacionada con monedas y cotizaciones.
 */

/**
 * Resuelve un identificador de moneda a código AFIP
 * 
 * Normaliza diferentes formatos de entrada:
 * - "PESOS", "ARS", "PES" → "PES"
 * - "DOLARES", "DÓLARES", "USD", "DOL" → "DOL"
 * - "EUROS", "EUR" → "EUR"
 * 
 * @param input - Identificador de moneda (cualquier formato)
 * @returns Código de moneda AFIP (PES, DOL, EUR, o input si desconocido)
 */
export function resolveMonedaId(input: string): string {
  const s = String(input || '').trim().toUpperCase();
  
  if (!s) return 'PES';
  
  // Pesos argentinos
  if (s === 'PESOS' || s === 'ARS' || s === 'PES') return 'PES';
  
  // Dólares
  if (s === 'DOLARES' || s === 'DÓLARES' || s === 'USD' || s === 'DOL') return 'DOL';
  
  // Euros
  if (s === 'EUROS' || s === 'EUR') return 'EUR';
  
  // Devolver tal cual si no se reconoce
  return s;
}

/**
 * Calcula el día hábil anterior a una fecha dada (formato YYYYMMDD)
 * 
 * Retrocede hasta encontrar un día que NO sea sábado ni domingo.
 * Útil para consultas de cotización que requieren día hábil.
 * 
 * @param yyyymmdd - Fecha en formato YYYYMMDD
 * @returns Fecha del día hábil anterior en formato YYYYMMDD
 */
export function prevDiaHabil(yyyymmdd: string): string {
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6)) - 1; // Mes 0-indexed
  const d = Number(yyyymmdd.slice(6, 8));
  
  const dt = new Date(Date.UTC(y, m, d));
  
  // Retroceder hasta encontrar día hábil (lunes a viernes)
  do {
    dt.setUTCDate(dt.getUTCDate() - 1);
  } while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6); // 0=domingo, 6=sábado
  
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  
  return `${dt.getUTCFullYear()}${mm}${dd}`;
}

/**
 * Valida que un código de moneda sea válido según lista de AFIP
 * 
 * @param monId - Código de moneda a validar
 * @param validMonedas - Lista de monedas válidas según AFIP
 * @returns true si es válido
 */
export function isMonedaValida(monId: string, validMonedas: string[]): boolean {
  return validMonedas.includes(monId.toUpperCase());
}

/**
 * Valida una cotización de moneda extranjera
 * 
 * Una cotización válida debe:
 * - Ser un número finito
 * - Ser mayor a 1 (para monedas extranjeras)
 * 
 * @param cotizacion - Valor de cotización
 * @returns true si es válida
 */
export function isCotizacionValida(cotizacion: number): boolean {
  return Number.isFinite(cotizacion) && cotizacion > 1;
}

/**
 * Normaliza respuesta de cotización de AFIP
 * 
 * Diferentes métodos del SDK AFIP devuelven formatos distintos.
 * Esta función normaliza la respuesta a un formato consistente.
 * 
 * @param response - Respuesta del SDK AFIP
 * @returns Objeto normalizado con valor y fecha
 * @throws Error si la cotización no es válida
 */
export function normalizeCotizacionResponse(response: any): {
  valor: number;
  fecha: string;
} {
  // Extraer valor (diferentes formatos posibles)
  const val = Number(
    (response && (response.MonCotiz ?? response?.ResultGet?.MonCotiz)) || 0
  );
  
  // Extraer fecha
  const fecha = String(
    (response && (response.FchCotiz ?? response?.ResultGet?.FchCotiz)) || ''
  );
  
  // Validar cotización
  if (!isCotizacionValida(val)) {
    throw new Error('Cotización no válida');
  }
  
  return { valor: val, fecha };
}

