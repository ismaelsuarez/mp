export type AfipEnv = 'homo' | 'prod';

export const WSAA_URL: Record<AfipEnv, string> = {
	homo: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
	prod: 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
};

export const WSFE_URL: Record<AfipEnv, string> = {
	homo: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
	prod: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
};

export function resolveEndpoints(env: AfipEnv) {
	return { wsaa: WSAA_URL[env], wsfe: WSFE_URL[env] };
}


