import { 
  IProvinciaService, 
  ComprobanteProvincialParams, 
  RespuestaProvincial, 
  ValidacionProvincial 
} from './IProvinciaService';
import { AfipLogger } from '../afip/AfipLogger';

/**
 * Servicio para ATM (Administración Tributaria Mendoza)
 * Implementación inicial con funcionalidad mock
 */
export class ATMService implements IProvinciaService {
  readonly nombre = 'ATM Mendoza';
  readonly jurisdiccion = 'mendoza';
  
  private logger: AfipLogger;
  private mockMode: boolean;
  
  constructor(mockMode: boolean = true) {
    this.logger = new AfipLogger();
    this.mockMode = mockMode;
  }

  /**
   * Verifica si el comprobante está alcanzado por ATM Mendoza
   */
  async esAplicable(params: ComprobanteProvincialParams): Promise<boolean> {
    try {
      // En modo mock, aplicamos según reglas simplificadas
      if (this.mockMode) {
        return this.verificarJurisdiccionMock(params.cuitEmisor, params.cuitReceptor);
      }
      
      // En modo real, aquí consultaríamos el servicio de ATM
      // return await this.consultarJurisdiccionATM(params);
      
      return false;
    } catch (error) {
      this.logger.logError('atm_es_aplicable', error instanceof Error ? error : new Error(String(error)), {
        cuitEmisor: params.cuitEmisor,
        cuitReceptor: params.cuitReceptor
      });
      return false;
    }
  }

  /**
   * Valida el comprobante según normativa ATM
   */
  async validarComprobante(params: ComprobanteProvincialParams): Promise<ValidacionProvincial> {
    this.logger.logRequest('atm_validar_comprobante', {
      cae: params.cae,
      numero: params.numero,
      total: params.total
    });

    try {
      const errores: string[] = [];
      const advertencias: string[] = [];

      // Validaciones básicas
      if (!params.cae || params.cae.length !== 14) {
        errores.push('CAE inválido para registro provincial');
      }

      if (!params.cuitEmisor || params.cuitEmisor.length !== 11) {
        errores.push('CUIT emisor inválido');
      }

      if (params.total <= 0) {
        errores.push('El total debe ser mayor a 0');
      }

      // Validaciones específicas de Mendoza (mock)
      if (params.total > 1000000) {
        advertencias.push('Comprobante por monto elevado, puede requerir documentación adicional');
      }

      const esValido = errores.length === 0;
      const requiereRegistro = esValido && await this.esAplicable(params);

      this.logger.logRequest('atm_validacion_resultado', {
        esValido,
        requiereRegistro,
        errores: errores.length,
        advertencias: advertencias.length
      });

      return {
        esValido,
        errores,
        advertencias,
        requiereRegistro,
        jurisdiccion: this.jurisdiccion
      };

    } catch (error) {
      this.logger.logError('atm_validar_comprobante_error', error instanceof Error ? error : new Error(String(error)), {
        cae: params.cae,
        numero: params.numero
      });

      return {
        esValido: false,
        errores: ['Error interno en validación ATM'],
        advertencias: [],
        requiereRegistro: false,
        jurisdiccion: this.jurisdiccion
      };
    }
  }

  /**
   * Registra el comprobante en ATM
   */
  async registrarComprobante(params: ComprobanteProvincialParams): Promise<RespuestaProvincial> {
    this.logger.logRequest('atm_registrar_comprobante', {
      cae: params.cae,
      numero: params.numero,
      total: params.total,
      cuitEmisor: params.cuitEmisor
    });

    try {
      if (this.mockMode) {
        return this.registrarMock(params);
      }

      // En modo real, aquí haría la llamada al servicio ATM
      // return await this.registrarEnATM(params);
      
      throw new Error('Modo real no implementado');

    } catch (error) {
      this.logger.logError('atm_registrar_error', error instanceof Error ? error : new Error(String(error)), {
        cae: params.cae,
        numero: params.numero
      });

      return {
        success: false,
        error: `Error en registro ATM: ${error instanceof Error ? error.message : String(error)}`,
        detalles: { error }
      };
    }
  }

  /**
   * Verifica conectividad con ATM
   */
  async verificarConectividad(): Promise<boolean> {
    try {
      if (this.mockMode) {
        // En mock siempre está disponible
        return true;
      }

      // En modo real, ping al servicio ATM
      // return await this.pingATM();
      
      return false;
    } catch (error) {
      this.logger.logError('atm_conectividad', error instanceof Error ? error : new Error(String(error)), {});
      return false;
    }
  }

  /**
   * Consulta el estado de un comprobante en ATM
   */
  async consultarEstado(numeroComprobante: string): Promise<RespuestaProvincial> {
    this.logger.logRequest('atm_consultar_estado', { numeroComprobante });

    try {
      if (this.mockMode) {
        return {
          success: true,
          codigo: 'APROBADO',
          numeroComprobante,
          fechaAutorizacion: new Date().toISOString().split('T')[0].replace(/-/g, ''),
          mensaje: 'Comprobante registrado correctamente en ATM (mock)'
        };
      }

      // En modo real, consulta al servicio ATM
      throw new Error('Modo real no implementado');

    } catch (error) {
      this.logger.logError('atm_consultar_estado_error', error instanceof Error ? error : new Error(String(error)), {
        numeroComprobante
      });

      return {
        success: false,
        error: `Error en consulta ATM: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  // ===== MÉTODOS PRIVADOS =====

  /**
   * Verifica jurisdicción en modo mock
   */
  private verificarJurisdiccionMock(cuitEmisor: string, cuitReceptor?: string): boolean {
    // Simulamos que ciertos CUITs están en Mendoza
    const cuitsMendoza = [
      '20123456789', // Emisor de prueba Mendoza
      '27234567890', // Receptor de prueba Mendoza
      '23345678901'  // Otro CUIT Mendoza
    ];

    // Si el emisor está en Mendoza, aplica ATM
    if (cuitsMendoza.includes(cuitEmisor)) {
      return true;
    }

    // Si el receptor está en Mendoza, también puede aplicar
    if (cuitReceptor && cuitsMendoza.includes(cuitReceptor)) {
      return true;
    }

    return false;
  }

  /**
   * Registra comprobante en modo mock
   */
  private async registrarMock(params: ComprobanteProvincialParams): Promise<RespuestaProvincial> {
    // Simular delay de red
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simular probabilidad de éxito/fallo
    const exito = Math.random() > 0.1; // 90% de éxito

    if (exito) {
      const numeroProvincial = `ATM${Date.now()}${Math.floor(Math.random() * 1000)}`;
      
      this.logger.logRequest('atm_registro_exitoso', {
        cae: params.cae,
        numeroProvincial,
        total: params.total
      });

      return {
        success: true,
        codigo: 'APROBADO',
        numeroComprobante: numeroProvincial,
        fechaAutorizacion: new Date().toISOString().split('T')[0].replace(/-/g, ''),
        mensaje: 'Comprobante registrado correctamente en ATM Mendoza (mock)',
        detalles: {
          caeAfip: params.cae,
          numeroAfip: params.numero,
          montoTotal: params.total
        }
      };
    } else {
      // Simular fallo
      const errorMock = 'Error simulado en ATM: servicio temporalmente no disponible';
      
      this.logger.logError('atm_registro_fallido', new Error(errorMock), {
        cae: params.cae,
        numero: params.numero
      });

      return {
        success: false,
        error: errorMock,
        detalles: { simulacion: true }
      };
    }
  }
}

/**
 * Factory para crear instancia de ATMService
 */
export function createATMService(mockMode: boolean = true): ATMService {
  return new ATMService(mockMode);
}
