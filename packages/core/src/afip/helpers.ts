/**
 * @package @core/afip/helpers
 * @description Helpers puros para lógica AFIP (sin dependencias de infraestructura)
 */

import { TipoComprobante, CondicionIva } from '@shared/types/facturacion';
import { TIPO_COMPROBANTE_TO_AFIP, CLASE_TIPO_TO_AFIP, CONDICION_IVA_TO_ARCA } from '@shared/constants/afip';

/**
 * Mapea el tipo de comprobante interno al código AFIP
 */
export function mapTipoCbte(tipo: TipoComprobante): number {
  return TIPO_COMPROBANTE_TO_AFIP[tipo] || 11; // Default a C
}

/**
 * Mapea (clase=A/B/C, tipo base=FACTURA/NC/ND) al código AFIP exacto
 */
export function mapClaseYTipoACbteTipo(
  clase: 'A' | 'B' | 'C',
  tipoBase: 'FACTURA' | 'NC' | 'ND'
): number {
  const key = `${clase}-${tipoBase}`;
  const codigo = CLASE_TIPO_TO_AFIP[key];
  
  if (!codigo) {
    throw new Error(`Combinación no válida: clase=${clase}, tipoBase=${tipoBase}`);
  }
  
  return codigo;
}

/**
 * Mapea condición IVA del receptor al código ARCA (IVARECEPTOR)
 */
export function mapCondicionIvaReceptorToArcaCode(cond?: string): number | undefined {
  if (!cond) return undefined;
  
  const normalizedCond = cond.trim().toUpperCase();
  return CONDICION_IVA_TO_ARCA[normalizedCond];
}

/**
 * Devuelve AAAAMM01 a partir de AAAAMMDD
 */
export function monthStartFromYYYYMMDD(yyyymmdd: string): string {
  try {
    if (!yyyymmdd || yyyymmdd.length < 8) {
      throw new Error('Invalid format');
    }
    const yyyy = yyyymmdd.substring(0, 4);
    const mm = yyyymmdd.substring(4, 6);
    return `${yyyy}${mm}01`;
  } catch {
    return yyyymmdd; // Fallback
  }
}

/**
 * Formatea un número para AFIP (sin NaN, sin Infinity, 2 decimales)
 */
export function formatNumber(value: number): number {
  if (isNaN(value) || !isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

/**
 * Valida formato de CUIT (11 dígitos)
 */
export function isValidCUIT(cuit: string): boolean {
  const cleaned = cuit.replace(/[-\s]/g, '');
  return /^\d{11}$/.test(cleaned);
}

/**
 * Formatea CUIT con guiones (XX-XXXXXXXX-X)
 */
export function formatCUIT(cuit: string): string {
  const cleaned = cuit.replace(/[-\s]/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.substring(0, 2)}-${cleaned.substring(2, 10)}-${cleaned.substring(10)}`;
  }
  return cuit;
}

/**
 * Convierte condición IVA de formato corto a descripción
 */
export function condicionIvaToDescripcion(condicion: CondicionIva): string {
  const map: Record<CondicionIva, string> = {
    'RI': 'Responsable Inscripto',
    'MT': 'Monotributo',
    'EX': 'Exento',
    'CF': 'Consumidor Final'
  };
  return map[condicion] || condicion;
}

/**
 * Calcula el dígito verificador de un CUIT
 */
export function calcularDigitoVerificadorCUIT(cuitSinDV: string): number {
  const multiplicadores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;
  
  for (let i = 0; i < 10; i++) {
    suma += parseInt(cuitSinDV[i]) * multiplicadores[i];
  }
  
  const resto = suma % 11;
  return resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
}

/**
 * Valida CUIT con dígito verificador
 */
export function validarCUITCompleto(cuit: string): boolean {
  const cleaned = cuit.replace(/[-\s]/g, '');
  
  if (!isValidCUIT(cleaned)) {
    return false;
  }
  
  const cuitSinDV = cleaned.substring(0, 10);
  const dv = parseInt(cleaned[10]);
  const dvCalculado = calcularDigitoVerificadorCUIT(cuitSinDV);
  
  return dv === dvCalculado;
}

