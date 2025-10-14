/**
 * @deprecated Este archivo es un shim parcial de compatibilidad.
 * Usa @core/afip/helpers para funciones puras.
 * 
 * TODO(phase-8): Eliminar este shim después de actualizar todos los imports
 */

import { TipoComprobante, Comprobante } from '../types';
import dayjs from 'dayjs';
import * as CoreHelpers from '@core/afip/helpers';

export class AfipHelpers {
  /**
   * Mapea el tipo de comprobante interno al código AFIP
   * @deprecated Use mapTipoCbte from @core/afip/helpers
   */
  static mapTipoCbte(tipo: TipoComprobante): number {
    return CoreHelpers.mapTipoCbte(tipo);
  }

  /**
   * Mapea (clase=A/B/C, tipo base=FACTURA/NC/ND) al código AFIP exacto
   */
  static mapCbteByClass(kind: 'FACT'|'NC'|'ND', clase: 'A'|'B'|'C'): number {
    if (kind === 'FACT') {
      return clase === 'A' ? 1 : (clase === 'B' ? 6 : 11);
    }
    if (kind === 'NC') {
      return clase === 'A' ? 3 : (clase === 'B' ? 8 : 13);
    }
    // ND
    return clase === 'A' ? 2 : (clase === 'B' ? 7 : 12);
  }

  /**
   * Mapea el porcentaje de IVA al ID de alícuota AFIP
   * @deprecated Use mapIvaIdFromPercentage from @core/afip/calculators
   */
  static mapIvaId(porcentaje: number): number {
    const { mapIvaIdFromPercentage } = require('@core/afip/calculators');
    return mapIvaIdFromPercentage(porcentaje);
  }

  /**
   * Mapea un CbteTipo WSFE estándar al correspondiente MiPyME (FCE)
   * 1->201, 2->202, 3->203, 6->206, 7->207, 8->208, 11->211, 12->212, 13->213
   * @deprecated Use mapToMiPymeCbte from @core/afip/calculators
   */
  static mapToMiPymeCbte(cbteTipo: number): number {
    const { mapToMiPymeCbte } = require('@core/afip/calculators');
    return mapToMiPymeCbte(cbteTipo);
  }

  /**
   * Construye el array de IVA para AFIP agrupando por alícuota
   * @deprecated Use buildIvaArray from @core/afip/calculators
   */
  static buildIvaArray(items: Comprobante['items']): any[] {
    const { buildIvaArray } = require('@core/afip/calculators');
    return buildIvaArray(items);
  }

  /**
   * Consolida los totales por alícuota para WSFEv1 (FECAESolicitar)
   * Retorna solo montos consolidados y el array Iva[] por alícuota.
   * @deprecated Use consolidateTotals from @core/afip/calculators
   */
  static consolidateTotals(items: Comprobante['items']): {
    ImpTotConc: number;
    ImpOpEx: number;
    ImpTrib: number;
    ImpNeto: number;
    ImpIVA: number;
    ImpTotal: number;
    Iva: Array<{ Id: number; BaseImp: number; Importe: number }>;
  } {
    const { consolidateTotals } = require('@core/afip/calculators');
    return consolidateTotals(items);
  }

  /**
   * Construye la URL del QR para AFIP
   * @deprecated Use buildQrUrl from @core/afip/validators
   */
  static buildQrUrl(data: {
    cuit: number;
    ptoVta: number;
    tipoCmp: number;
    nroCmp: number;
    importe: number;
    fecha: string;
    cae: string;
  }): string {
    const { buildQrUrl } = require('@core/afip/validators');
    return buildQrUrl(data);
  }

  /**
   * Valida que los datos del comprobante sean correctos
   * @deprecated Use validateComprobante from @core/afip/validators
   */
  static validateComprobante(comprobante: Comprobante): string[] {
    const { validateComprobante } = require('@core/afip/validators');
    return validateComprobante(comprobante);
  }

  /**
   * Formatea un número para AFIP (sin decimales)
   * @deprecated Use formatNumberForAfip from @core/afip/calculators
   */
  static formatNumber(value: number): number {
    const { formatNumberForAfip } = require('@core/afip/calculators');
    return formatNumberForAfip(value);
  }

  /**
   * Mapea condición IVA del receptor (UI) al código ARCA (IVARECEPTOR)
   * Referencia (manual ARCA COMPG):
   * 1: IVA Responsable Inscripto
   * 6: Responsable Monotributo
   * 13: Monotributista Social
   * 16: Monotributo Trabajador Independiente Promovido
   * 4: IVA Sujeto Exento
   * 7: Sujeto No Categorizado
   * 8: Proveedor del Exterior
   * 9: Cliente del Exterior
   * 10: IVA Liberado – Ley N° 19.640
   * 15: IVA No Alcanzado
   * 5: Consumidor Final
   */
  static mapCondicionIvaReceptorToArcaCode(cond?: string): number | undefined {
    const v = String(cond || '').trim().toUpperCase();
    switch (v) {
      case 'RI':
      case 'RESPONSABLE INSCRIPTO':
        return 1;
      case 'MT':
      case 'MONOTRIBUTO':
        return 6;
      case 'MONOTRIBUTO SOCIAL':
      case 'MONOTRIBUTISTA SOCIAL':
        return 13;
      case 'MONOTRIBUTO TRABAJADOR INDEPENDIENTE PROMOVIDO':
        return 16;
      case 'EX':
      case 'EXENTO':
        return 4;
      case 'SNC':
      case 'SUJETO NO CATEGORIZADO':
        return 7;
      case 'PROVEEDOR EXTERIOR':
      case 'PROVEEDOR DEL EXTERIOR':
        return 8;
      case 'CLIENTE EXTERIOR':
      case 'CLIENTE DEL EXTERIOR':
        return 9;
      case 'LIBERADO 19640':
      case 'IVA LIBERADO – LEY N° 19.640':
        return 10;
      case 'NO ALCANZADO':
      case 'IVA NO ALCANZADO':
        return 15;
      case 'CF':
      case 'CONSUMIDOR FINAL':
        return 5;
      default:
        return undefined;
    }
  }
}

/**
 * Devuelve AAAAMM01 a partir de AAAAMMDD
 */
export function monthStartFromYYYYMMDD(yyyymmdd: string): string {
  try {
    const s = String(yyyymmdd || '').trim();
    if (/^\d{8}$/.test(s)) return s.slice(0, 6) + '01';
    // fallback simple si no cumple el patrón
    return (s || '').slice(0, 6) + '01';
  } catch {
    return '';
  }
}