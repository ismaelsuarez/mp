/**
 * @package @core/licencia/validators
 * @description Validadores puros para sistema de licencias
 * 
 * Funciones de validación y generación de seriales de licencia.
 * Lógica pura sin dependencias de infraestructura (fs, electron, etc).
 */

import crypto from 'crypto';
import { HMAC_MASTER_SECRET } from '@shared/constants/licencia';

/**
 * Calcula el serial de una licencia basado en nombre y palabra secreta
 * 
 * Genera un serial único usando HMAC-SHA256 con la clave maestra.
 * El serial es un hash de 20 caracteres hexadecimales en formato
 * XXXX-XXXX-XXXX-XXXX-XXXX.
 * 
 * @param nombreCliente - Nombre del cliente (será normalizado)
 * @param palabraSecreta - Palabra secreta del cliente (será normalizada)
 * @returns Serial en formato XXXX-XXXX-XXXX-XXXX-XXXX
 */
export function computeSerial(nombreCliente: string, palabraSecreta: string): string {
  const cleanName = String(nombreCliente || '').trim();
  const cleanSecret = String(palabraSecreta || '').trim();
  const data = `${cleanName}::${cleanSecret}`;
  
  // Generar HMAC-SHA256
  const mac = crypto
    .createHmac('sha256', HMAC_MASTER_SECRET)
    .update(data)
    .digest('hex')
    .toUpperCase();
  
  // Tomar primeros 20 caracteres y formatear con guiones
  const first20 = mac.slice(0, 20);
  return first20.match(/.{1,4}/g)?.join('-') || first20;
}

/**
 * Valida un serial contra nombre de cliente y palabra secreta
 * 
 * Verifica que el serial proporcionado corresponda al nombre de cliente
 * y palabra secreta usando comparación de tiempo constante para prevenir
 * ataques de timing.
 * 
 * @param nombreCliente - Nombre del cliente
 * @param palabraSecreta - Palabra secreta del cliente
 * @param serial - Serial a validar (puede incluir guiones)
 * @returns true si el serial es válido
 */
export function validarSerial(
  nombreCliente: string,
  palabraSecreta: string,
  serial: string
): boolean {
  try {
    // Calcular serial esperado
    const expected = computeSerial(nombreCliente, palabraSecreta)
      .replace(/[^A-Z0-9]/g, '');
    
    // Normalizar serial proporcionado
    const provided = String(serial || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    
    // Verificar longitud
    if (expected.length !== provided.length) {
      return false;
    }
    
    // Comparación de tiempo constante
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(provided)
    );
  } catch {
    return false;
  }
}

/**
 * Formatea un serial con guiones
 * 
 * @param serial - Serial sin formato (20 caracteres hexadecimales)
 * @returns Serial formateado XXXX-XXXX-XXXX-XXXX-XXXX
 */
export function formatSerial(serial: string): string {
  const clean = serial.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return clean.match(/.{1,4}/g)?.join('-') || clean;
}

