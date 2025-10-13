/**
 * @package @shared/constants/licencia
 * @description Constantes para sistema de licencias
 * 
 * Claves maestras y configuración de cifrado para validación
 * y almacenamiento de licencias.
 */

/**
 * Decodifica array de strings hexadecimales a Buffer
 */
function decodeHex(parts: string[]): Buffer {
  return Buffer.from(parts.join(''), 'hex');
}

/**
 * Clave maestra HMAC para generación y validación de seriales
 * 
 * Esta clave debe coincidir con el generador externo de licencias (lic-gen).
 * IMPORTANTE: Mantener fuera de logs y UI.
 */
export const HMAC_MASTER_SECRET: string = 'F@cundoJo@quinCecili@';

/**
 * Clave de cifrado AES-256 (32 bytes) para licencias
 * 
 * Usada para cifrar/descifrar archivos de licencia con AES-256-GCM.
 * IMPORTANTE: Mantener fuera de logs y UI.
 */
export const LICENSE_ENCRYPTION_KEY: Buffer = decodeHex([
  'a3b1c2d4', 'e5f60718', '293a4b5c', '6d7e8f90',
  '11223344', '55667788', '99aabbcc', 'ddeeff00'
]);

