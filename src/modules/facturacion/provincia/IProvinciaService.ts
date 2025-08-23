/**
 * Interfaz base para servicios de administraciones provinciales
 * Soporta ARCA, ATM Mendoza, AGIP CABA, ARBA Buenos Aires, etc.
 */

export interface ComprobanteProvincialParams {
  // Datos del comprobante AFIP ya autorizado
  cae: string;
  caeVencimiento: string;
  numero: number;
  puntoVenta: number;
  tipoComprobante: number;
  fecha: string;
  
  // Datos del emisor
  cuitEmisor: string;
  razonSocialEmisor: string;
  
  // Datos del receptor
  cuitReceptor?: string;
  razonSocialReceptor?: string;
  condicionIvaReceptor?: string;
  
  // Importes
  neto: number;
  iva: number;
  total: number;
  
  // Detalle de items
  detalle: Array<{
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    alicuotaIva: number;
  }>;
  
  // Datos adicionales
  observaciones?: string;
  codigoOperacion?: string;
}

export interface RespuestaProvincial {
  success: boolean;
  codigo?: string;
  numeroComprobante?: string;
  fechaAutorizacion?: string;
  mensaje?: string;
  error?: string;
  detalles?: any;
}

export interface ValidacionProvincial {
  esValido: boolean;
  errores: string[];
  advertencias: string[];
  requiereRegistro: boolean;
  jurisdiccion?: string;
}

/**
 * Interfaz que deben implementar todos los servicios provinciales
 */
export interface IProvinciaService {
  /**
   * Nombre del servicio provincial
   */
  readonly nombre: string;
  
  /**
   * Código de la jurisdicción (mendoza, caba, buenos_aires, etc.)
   */
  readonly jurisdiccion: string;
  
  /**
   * Verifica si el comprobante está alcanzado por esta administración provincial
   */
  esAplicable(params: ComprobanteProvincialParams): Promise<boolean>;
  
  /**
   * Valida que el comprobante cumpla con los requisitos provinciales
   */
  validarComprobante(params: ComprobanteProvincialParams): Promise<ValidacionProvincial>;
  
  /**
   * Registra el comprobante en la administración provincial
   */
  registrarComprobante(params: ComprobanteProvincialParams): Promise<RespuestaProvincial>;
  
  /**
   * Verifica el estado de un comprobante previamente registrado
   */
  consultarEstado?(numeroComprobante: string): Promise<RespuestaProvincial>;
  
  /**
   * Verifica la conectividad con el servicio provincial
   */
  verificarConectividad(): Promise<boolean>;
}

/**
 * Resultado del procesamiento provincial completo
 */
export interface ResultadoProvincial {
  afip: {
    success: boolean;
    cae?: string;
    caeVencimiento?: string;
    numero?: number;
    error?: string;
  };
  provincial: {
    success: boolean;
    servicio?: string;
    jurisdiccion?: string;
    codigo?: string;
    numeroComprobante?: string;
    error?: string;
    detalles?: any;
  } | null;
  estado: 'AFIP_OK' | 'AFIP_OK_PROV_OK' | 'AFIP_OK_PROV_FAIL' | 'AFIP_FAIL';
}

/**
 * Configuración de una jurisdicción provincial
 */
export interface ConfiguracionProvincial {
  enabled: boolean;
  service: string;
  endpoint?: string;
  timeout?: number;
  retries?: number;
  credentials?: {
    usuario?: string;
    password?: string;
    token?: string;
    certificado?: string;
  };
  configuracion?: any;
}

/**
 * Configuración completa de todas las provincias
 */
export interface ConfiguracionProvincias {
  [jurisdiccion: string]: ConfiguracionProvincial;
}
