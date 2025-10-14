/**
 * Tipo de ambiente AFIP
 */
export type AfipEnv = 'homo' | 'prod';

/**
 * URLs de WSAA (Web Service de Autenticación y Autorización)
 */
export const WSAA_URL: Record<AfipEnv, string> = {
	homo: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
	prod: 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
};

/**
 * URLs de WSFE (Web Service de Facturación Electrónica)
 */
export const WSFE_URL: Record<AfipEnv, string> = {
	homo: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
	prod: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
};

/**
 * Resuelve los endpoints de AFIP según el ambiente
 * @param env - Ambiente (homo o prod)
 * @returns Objeto con URLs de WSAA y WSFE
 */
export function resolveEndpoints(env: AfipEnv) {
	return { wsaa: WSAA_URL[env], wsfe: WSFE_URL[env] };
}

