// Configuración de claves maestras para licencia
// Mantener estas constantes fuera de logs o UI

function decodeHex(parts: string[]): Buffer {
	return Buffer.from(parts.join(''), 'hex');
}

// Clave maestra HMAC (texto) – debe coincidir con el generador externo (lic-gen)
export const HMAC_MASTER_SECRET: string = 'F@cundoJo@quinCecili@';

// Clave de cifrado AES-256 (32 bytes)
export const LICENSE_ENCRYPTION_KEY: Buffer = decodeHex([
	'a3b1c2d4','e5f60718','293a4b5c','6d7e8f90',
	'11223344','55667788','99aabbcc','ddeeff00'
]);


