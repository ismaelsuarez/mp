/**
 * @package @core/afip/validators
 * @description Validadores puros para comprobantes AFIP
 * 
 * Validaciones de estructura, formato y reglas de negocio
 * para comprobantes electrónicos.
 */

import { Comprobante } from '@shared/types/facturacion';
import dayjs from 'dayjs';

/**
 * Valida que los datos del comprobante sean correctos
 * 
 * Validaciones básicas de estructura y formato:
 * - Fecha en formato YYYYMMDD
 * - Punto de venta > 0
 * - Número de comprobante > 0
 * - Al menos un item
 * - Total > 0
 * 
 * @param comprobante - Comprobante a validar
 * @returns Array de errores (vacío si es válido)
 */
export function validateComprobante(comprobante: Comprobante): string[] {
  const errors: string[] = [];

  // Validar fecha
  if (!comprobante.fecha || comprobante.fecha.length !== 8) {
    errors.push('Fecha debe estar en formato YYYYMMDD');
  }

  // Validar punto de venta
  if (comprobante.puntoVenta <= 0) {
    errors.push('Punto de venta debe ser mayor a 0');
  }

  // Validar número de comprobante
  if (comprobante.numero <= 0) {
    errors.push('Número de comprobante debe ser mayor a 0');
  }

  // Validar items
  if (!comprobante.items || comprobante.items.length === 0) {
    errors.push('El comprobante debe tener al menos un item');
  }

  // Validar total
  if (comprobante.totales.total <= 0) {
    errors.push('El total debe ser mayor a 0');
  }

  return errors;
}

/**
 * Datos para construcción de QR AFIP
 */
export interface QrAfipData {
  cuit: number;
  ptoVta: number;
  tipoCmp: number;
  nroCmp: number;
  importe: number;
  fecha: string;      // YYYYMMDD
  cae: string;
}

/**
 * Construye la URL del QR para AFIP
 * 
 * Genera la URL completa del código QR según especificación AFIP
 * para comprobantes electrónicos. El QR permite verificar la validez
 * del comprobante en el sitio de AFIP.
 * 
 * Formato: https://www.afip.gob.ar/fe/qr/?p={base64_payload}
 * 
 * @param data - Datos del comprobante para el QR
 * @returns URL completa del QR AFIP
 */
export function buildQrUrl(data: QrAfipData): string {
  // Estructura del payload según AFIP
  const qrData = {
    ver: 1,                                                      // Versión del QR
    fecha: dayjs(data.fecha, 'YYYYMMDD').format('YYYY-MM-DD'), // Fecha ISO
    cuit: data.cuit,                                            // CUIT emisor
    ptoVta: data.ptoVta,                                        // Punto de venta
    tipoCmp: data.tipoCmp,                                      // Tipo comprobante
    nroCmp: data.nroCmp,                                        // Número comprobante
    importe: Number(data.importe.toFixed(2)),                  // Importe total
    moneda: 'PES',                                              // Moneda (pesos)
    ctz: 1,                                                     // Cotización
    tipoDocRec: 99,                                             // Tipo doc receptor (CF)
    nroDocRec: 0,                                               // Nro doc receptor (CF)
    tipoCodAut: 'E',                                            // Tipo código autorización (CAE)
    codAut: Number(data.cae)                                    // CAE
  };

  const base = 'https://www.afip.gob.ar/fe/qr/?p=';
  const payload = Buffer.from(JSON.stringify(qrData)).toString('base64');
  
  return base + payload;
}

/**
 * Valida formato de fecha YYYYMMDD
 * 
 * @param fecha - Fecha a validar
 * @returns true si es válida
 */
export function validateFechaFormat(fecha: string): boolean {
  if (!fecha || fecha.length !== 8) return false;
  const parsed = dayjs(fecha, 'YYYYMMDD', true);
  return parsed.isValid();
}

/**
 * Valida que una fecha no sea futura
 * 
 * @param fecha - Fecha en formato YYYYMMDD
 * @returns true si no es futura
 */
export function validateFechaNotFuture(fecha: string): boolean {
  if (!validateFechaFormat(fecha)) return false;
  const parsed = dayjs(fecha, 'YYYYMMDD');
  return parsed.isBefore(dayjs()) || parsed.isSame(dayjs(), 'day');
}

