/**
 * Tipados fuertes para respuestas del SDK @afipsdk/afip.js
 */

export interface AfipObservation {
  Code: number | string;
  Msg: string;
}

export interface AfipErrorItem {
  Code: number | string;
  Msg: string;
}

export interface AfipVoucherResponse {
  CAE: string;
  CAEFchVto: string; // YYYYMMDD
  Observaciones?: AfipObservation[] | null;
  Reproceso?: string | null;
  // En algunas versiones el SDK incluye campos adicionales
  // que no son relevantes para esta app. Los dejamos abiertos.
  [key: string]: unknown;
}

export type AfipLastVoucherResponse = number; // FECompUltimoAutorizado devuelve un número

export interface AfipVoucherType {
  Id: number | string;
  Desc: string;
}

export interface AfipServerStatus {
  appserver: string;
  dbserver: string;
  authserver: string;
}

/** Error normalizado proveniente del SDK (o axios) */
export interface AfipSdkError {
  code?: string | number;
  message: string;
  isAxiosError?: boolean;
  response?: unknown;
  request?: unknown;
  stack?: string;
}

/** Parámetros para validaciones FEParamGet* */
export interface ValidationParams {
  cbteTipo: number;
  concepto: number;
  docTipo: number;
  monId: string;
  ptoVta: number;
  cuit?: string;
}


