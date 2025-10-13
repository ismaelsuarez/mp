/**
 * @package @shared/utils/formato
 * @description Utilidades puras de formato (fechas, strings, etc)
 * 
 * Funciones genéricas sin dependencias de dominio.
 */

import dayjs from 'dayjs';

/**
 * Formatea fecha YYYYMMDD a formato legible
 * 
 * @param yyyymmdd - Fecha en formato YYYYMMDD
 * @param formato - Formato de salida (default: 'DD/MM/YYYY')
 * @returns Fecha formateada
 */
export function formatFecha(yyyymmdd: string, formato: string = 'DD/MM/YYYY'): string {
  try {
    return dayjs(yyyymmdd, 'YYYYMMDD').format(formato);
  } catch {
    return yyyymmdd;
  }
}

/**
 * Convierte fecha YYYYMMDD a formato ISO (YYYY-MM-DD)
 * 
 * @param yyyymmdd - Fecha en formato YYYYMMDD
 * @returns Fecha en formato ISO
 */
export function toISODate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return '';
  return `${yyyymmdd.substring(0, 4)}-${yyyymmdd.substring(4, 6)}-${yyyymmdd.substring(6, 8)}`;
}

/**
 * Convierte fecha ISO (YYYY-MM-DD) a YYYYMMDD
 * 
 * @param isoDate - Fecha en formato ISO
 * @returns Fecha en formato YYYYMMDD
 */
export function fromISODate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

/**
 * Obtiene fecha actual en formato YYYYMMDD
 * 
 * @returns Fecha actual en formato YYYYMMDD
 */
export function getFechaActual(): string {
  return dayjs().format('YYYYMMDD');
}

/**
 * Obtiene inicio del mes para una fecha dada
 * 
 * @param yyyymmdd - Fecha en formato YYYYMMDD
 * @returns Primer día del mes en formato YYYYMMDD (AAAAAMM01)
 */
export function getInicioMes(yyyymmdd: string): string {
  try {
    return dayjs(yyyymmdd, 'YYYYMMDD').startOf('month').format('YYYYMMDD');
  } catch {
    return yyyymmdd;
  }
}

/**
 * Limpia y normaliza un string
 * 
 * - Trim
 * - Normaliza espacios múltiples
 * - Elimina caracteres no imprimibles
 * 
 * @param text - String a limpiar
 * @returns String limpio
 */
export function cleanString(text: string): string {
  return String(text || '')
    .trim()
    .replace(/\s+/g, ' ')       // Normalizar espacios múltiples
    .replace(/[\x00-\x1F]/g, ''); // Eliminar caracteres no imprimibles
}

/**
 * Trunca un string a una longitud máxima
 * 
 * @param text - String a truncar
 * @param maxLength - Longitud máxima
 * @param suffix - Sufijo si se trunca (default: '...')
 * @returns String truncado
 */
export function truncate(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitaliza la primera letra de cada palabra
 * 
 * @param text - String a capitalizar
 * @returns String capitalizado
 */
export function capitalize(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Formatea un número con separador de miles
 * 
 * @param num - Número a formatear
 * @param separador - Separador (default: '.')
 * @returns Número formateado
 */
export function formatNumeroConMiles(num: number, separador: string = '.'): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separador);
}

