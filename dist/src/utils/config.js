"use strict";
// Configuración de claves maestras para licencia
// Mantener estas constantes fuera de logs o UI
Object.defineProperty(exports, "__esModule", { value: true });
exports.LICENSE_ENCRYPTION_KEY = exports.HMAC_MASTER_SECRET = void 0;
function decodeHex(parts) {
    return Buffer.from(parts.join(''), 'hex');
}
// Clave maestra HMAC (texto) – debe coincidir con el generador externo (lic-gen)
exports.HMAC_MASTER_SECRET = 'F@cundoJo@quinCecili@';
// Clave de cifrado AES-256 (32 bytes)
exports.LICENSE_ENCRYPTION_KEY = decodeHex([
    'a3b1c2d4', 'e5f60718', '293a4b5c', '6d7e8f90',
    '11223344', '55667788', '99aabbcc', 'ddeeff00'
]);
