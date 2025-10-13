/**
 * @package @shared/constants/afip
 * @description Constantes y mapeos para códigos AFIP
 */

import { TipoComprobante, CondicionIva } from '../types/facturacion';

/**
 * Mapeo de tipos de comprobante internos a códigos AFIP
 */
export const TIPO_COMPROBANTE_TO_AFIP: Record<TipoComprobante, number> = {
  'A': 1,            // Factura A
  'B': 6,            // Factura B
  'C': 11,           // Factura C
  'E': 11,           // Por defecto C
  'FA': 1,           // Alias Factura A
  'FB': 6,           // Alias Factura B
  'RECIBO': 4,       // Recibo A
  'NC': 13           // Nota de Crédito C por defecto
};

/**
 * Mapeo combinado de clase y tipo base a código AFIP
 * Formato: `${clase}-${tipoBase}` → código AFIP
 */
export const CLASE_TIPO_TO_AFIP: Record<string, number> = {
  // Facturas
  'A-FACTURA': 1,
  'B-FACTURA': 6,
  'C-FACTURA': 11,
  
  // Notas de Débito
  'A-ND': 2,
  'B-ND': 7,
  'C-ND': 12,
  
  // Notas de Crédito
  'A-NC': 3,
  'B-NC': 8,
  'C-NC': 13
};

/**
 * Mapeo de condición IVA a código ARCA (IVARECEPTOR)
 * Referencia manual ARCA COMPG
 */
export const CONDICION_IVA_TO_ARCA: Record<string, number> = {
  'RI': 1,                              // IVA Responsable Inscripto
  'RESPONSABLE INSCRIPTO': 1,
  'MT': 6,                              // Responsable Monotributo
  'MONOTRIBUTO': 6,
  'MONOTRIBUTO SOCIAL': 13,
  'MONOTRIBUTISTA SOCIAL': 13,
  'MONOTRIBUTO TRABAJADOR INDEPENDIENTE PROMOVIDO': 16,
  'EX': 4,                              // IVA Sujeto Exento
  'EXENTO': 4,
  'SNC': 7,                             // Sujeto No Categorizado
  'SUJETO NO CATEGORIZADO': 7,
  'PROVEEDOR EXTERIOR': 8,
  'PROVEEDOR DEL EXTERIOR': 8,
  'CLIENTE EXTERIOR': 9,
  'CLIENTE DEL EXTERIOR': 9,
  'LIBERADO 19640': 10,
  'IVA LIBERADO – LEY N° 19.640': 10,
  'NO ALCANZADO': 15,
  'IVA NO ALCANZADO': 15,
  'CF': 5,                              // Consumidor Final
  'CONSUMIDOR FINAL': 5
};

/**
 * Servidores NTP por defecto
 */
export const NTP_SERVERS = {
  DEFAULT: 'pool.ntp.org',
  ARGENTINA: 'ar.pool.ntp.org',
  GOOGLE: 'time.google.com',
  CLOUDFLARE: 'time.cloudflare.com'
} as const;

/**
 * Timeouts y límites por defecto
 */
export const AFIP_DEFAULTS = {
  NTP_PORT: 123,
  NTP_ALLOWED_DRIFT: 60000,           // 60 segundos
  NTP_TIMEOUT: 5000,                  // 5 segundos
  NTP_CHECK_INTERVAL: 3600000,        // 1 hora
  NTP_ALERT_THRESHOLD: 30000,         // 30 segundos
  NTP_MAX_FAILURES: 3,
  
  // Timeouts HTTP
  HTTP_TIMEOUT: 30000,                // 30 segundos
  HTTP_RETRY_ATTEMPTS: 3,
  HTTP_RETRY_DELAY: 1000,             // 1 segundo
  
  // Circuit Breaker
  CIRCUIT_BREAKER_THRESHOLD: 5,
  CIRCUIT_BREAKER_TIMEOUT: 5000,
  CIRCUIT_BREAKER_RESET_TIMEOUT: 120000  // 2 minutos
} as const;

