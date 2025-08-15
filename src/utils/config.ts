// Configuración de claves maestras para licencia
// Mantener estas constantes fuera de logs o UI

function decodeHex(parts: string[]): Buffer {
	return Buffer.from(parts.join(''), 'hex');
}

// Clave maestra HMAC (32 bytes)
export const HMAC_MASTER_KEY: Buffer = decodeHex([
	'00112233','44556677','8899aabb','ccddeeff',
	'00112233','44556677','8899aabb','ccddeeff'
]);

// Clave de cifrado AES-256 (32 bytes)
export const LICENSE_ENCRYPTION_KEY: Buffer = decodeHex([
	'a3b1c2d4','e5f60718','293a4b5c','6d7e8f90',
	'11223344','55667788','99aabbcc','ddeeff00'
]);


