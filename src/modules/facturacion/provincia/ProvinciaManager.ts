import { 
  IProvinciaService, 
  ConfiguracionProvincias, 
  ConfiguracionProvincial,
  ComprobanteProvincialParams,
  ResultadoProvincial 
} from './IProvinciaService';
import { ATMService } from './ATMService';
import { AfipLogger } from '../afip/AfipLogger';
import fs from 'fs';
import path from 'path';

/**
 * Gestor centralizado para administraciones provinciales
 */
export class ProvinciaManager {
  private servicios: Map<string, IProvinciaService> = new Map();
  private configuracion: ConfiguracionProvincias = {};
  private logger: AfipLogger;
  private configPath: string;

  constructor(configPath?: string) {
    this.logger = new AfipLogger();
    this.configPath = configPath || path.join(process.cwd(), 'config', 'provincia.config.json');
    this.inicializar();
  }

  /**
   * Inicializa el gestor de provincias
   */
  private inicializar(): void {
    try {
      this.cargarConfiguracion();
      this.registrarServicios();
      
      this.logger.logRequest('provincia_manager_inicializado', {
        serviciosRegistrados: Array.from(this.servicios.keys()),
        configuracionCargada: Object.keys(this.configuracion)
      });
    } catch (error) {
      this.logger.logError('provincia_manager_inicializacion', error instanceof Error ? error : new Error(String(error)), {
        configPath: this.configPath
      });
    }
  }

  /**
   * Carga la configuración desde archivo JSON
   */
  private cargarConfiguracion(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const contenido = fs.readFileSync(this.configPath, 'utf-8');
        this.configuracion = JSON.parse(contenido);
      } else {
        // Crear configuración por defecto
        this.crearConfiguracionPorDefecto();
      }
    } catch (error) {
      this.logger.logError('provincia_cargar_config', error instanceof Error ? error : new Error(String(error)), {
        configPath: this.configPath
      });
      
      // Usar configuración por defecto en caso de error
      this.crearConfiguracionPorDefecto();
    }
  }

  /**
   * Crea configuración por defecto
   */
  private crearConfiguracionPorDefecto(): void {
    this.configuracion = {
      mendoza: {
        enabled: true,
        service: 'ATMService',
        endpoint: 'https://atm.mendoza.gov.ar/ws',
        timeout: 30000,
        retries: 3,
        credentials: {
          usuario: process.env.ATM_USUARIO || '',
          password: process.env.ATM_PASSWORD || '',
          token: process.env.ATM_TOKEN || ''
        }
      },
      caba: {
        enabled: false,
        service: 'AGIPService',
        endpoint: 'https://agip.buenosaires.gob.ar/ws',
        timeout: 30000,
        retries: 3
      },
      buenos_aires: {
        enabled: false,
        service: 'ARBAService',
        endpoint: 'https://arba.gba.gob.ar/ws',
        timeout: 30000,
        retries: 3
      }
    };

    // Guardar configuración por defecto
    this.guardarConfiguracion();
  }

  /**
   * Guarda la configuración en archivo
   */
  private guardarConfiguracion(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.configPath, JSON.stringify(this.configuracion, null, 2));
    } catch (error) {
      this.logger.logError('provincia_guardar_config', error instanceof Error ? error : new Error(String(error)), {
        configPath: this.configPath
      });
    }
  }

  /**
   * Registra los servicios provinciales disponibles
   */
  private registrarServicios(): void {
    // Registrar ATM Mendoza
    if (this.configuracion.mendoza?.enabled) {
      const mockMode = process.env.NODE_ENV !== 'production';
      this.servicios.set('mendoza', new ATMService(mockMode));
    }

    // Aquí se registrarían otros servicios cuando estén implementados
    // if (this.configuracion.caba?.enabled) {
    //   this.servicios.set('caba', new AGIPService());
    // }
  }

  /**
   * Procesa un comprobante a través de AFIP y provincias aplicables
   */
  async procesarComprobante(params: ComprobanteProvincialParams): Promise<ResultadoProvincial> {
    const startTime = Date.now();
    
    this.logger.logRequest('provincia_procesar_comprobante_inicio', {
      cae: params.cae,
      numero: params.numero,
      total: params.total,
      cuitEmisor: params.cuitEmisor
    });

    const resultado: ResultadoProvincial = {
      afip: {
        success: true,
        cae: params.cae,
        caeVencimiento: params.caeVencimiento,
        numero: params.numero
      },
      provincial: null,
      estado: 'AFIP_OK'
    };

    try {
      // Buscar servicios aplicables
      const serviciosAplicables = await this.buscarServiciosAplicables(params);
      
      if (serviciosAplicables.length === 0) {
        // Solo AFIP, no hay procesamiento provincial
        this.logger.logRequest('provincia_sin_servicios_aplicables', {
          cae: params.cae,
          numero: params.numero
        });
        
        return resultado;
      }

      // Procesar con el primer servicio aplicable
      // En el futuro podríamos soportar múltiples provincias simultáneamente
      const servicio = serviciosAplicables[0];
      
      this.logger.logRequest('provincia_procesando_con_servicio', {
        servicio: servicio.nombre,
        jurisdiccion: servicio.jurisdiccion,
        cae: params.cae
      });

      // Validar comprobante
      const validacion = await servicio.validarComprobante(params);
      
      if (!validacion.esValido) {
        resultado.provincial = {
          success: false,
          servicio: servicio.nombre,
          jurisdiccion: servicio.jurisdiccion,
          error: `Validación falló: ${validacion.errores.join(', ')}`,
          detalles: { validacion }
        };
        resultado.estado = 'AFIP_OK_PROV_FAIL';
        
        this.logger.logError('provincia_validacion_fallo', new Error('Validación provincial falló'), {
          servicio: servicio.nombre,
          errores: validacion.errores
        });
        
        return resultado;
      }

      // Registrar en provincia
      const respuesta = await servicio.registrarComprobante(params);
      
      if (respuesta.success) {
        resultado.provincial = {
          success: true,
          servicio: servicio.nombre,
          jurisdiccion: servicio.jurisdiccion,
          codigo: respuesta.codigo,
          numeroComprobante: respuesta.numeroComprobante,
          detalles: respuesta.detalles
        };
        resultado.estado = 'AFIP_OK_PROV_OK';
        
        this.logger.logRequest('provincia_registro_exitoso', {
          servicio: servicio.nombre,
          numeroProvincial: respuesta.numeroComprobante,
          cae: params.cae,
          duracion: Date.now() - startTime
        });
      } else {
        resultado.provincial = {
          success: false,
          servicio: servicio.nombre,
          jurisdiccion: servicio.jurisdiccion,
          error: respuesta.error,
          detalles: respuesta.detalles
        };
        resultado.estado = 'AFIP_OK_PROV_FAIL';
        
        this.logger.logError('provincia_registro_fallo', new Error(respuesta.error || 'Error desconocido'), {
          servicio: servicio.nombre,
          cae: params.cae
        });
      }

      return resultado;

    } catch (error) {
      this.logger.logError('provincia_procesar_comprobante_error', error instanceof Error ? error : new Error(String(error)), {
        cae: params.cae,
        numero: params.numero,
        duracion: Date.now() - startTime
      });

      resultado.provincial = {
        success: false,
        servicio: 'unknown',
        jurisdiccion: 'unknown',
        error: `Error interno: ${error instanceof Error ? error.message : String(error)}`,
        detalles: { error }
      };
      resultado.estado = 'AFIP_OK_PROV_FAIL';

      return resultado;
    }
  }

  /**
   * Busca servicios provinciales aplicables para un comprobante
   */
  private async buscarServiciosAplicables(params: ComprobanteProvincialParams): Promise<IProvinciaService[]> {
    const serviciosAplicables: IProvinciaService[] = [];

    for (const [jurisdiccion, servicio] of this.servicios.entries()) {
      try {
        const esAplicable = await servicio.esAplicable(params);
        if (esAplicable) {
          serviciosAplicables.push(servicio);
        }
      } catch (error) {
        this.logger.logError('provincia_verificar_aplicabilidad', error instanceof Error ? error : new Error(String(error)), {
          jurisdiccion,
          servicio: servicio.nombre
        });
      }
    }

    return serviciosAplicables;
  }

  /**
   * Obtiene la configuración actual
   */
  getConfiguracion(): ConfiguracionProvincias {
    return { ...this.configuracion };
  }

  /**
   * Actualiza la configuración de una provincia
   */
  actualizarConfiguracion(jurisdiccion: string, config: ConfiguracionProvincial): void {
    this.configuracion[jurisdiccion] = config;
    this.guardarConfiguracion();
    
    // Reinicializar servicios
    this.servicios.clear();
    this.registrarServicios();
    
    this.logger.logRequest('provincia_config_actualizada', {
      jurisdiccion,
      enabled: config.enabled,
      service: config.service
    });
  }

  /**
   * Obtiene estadísticas de los servicios provinciales
   */
  async getEstadisticas(): Promise<any> {
    const estadisticas: any = {
      serviciosRegistrados: this.servicios.size,
      serviciosActivos: 0,
      conectividad: {}
    };

    for (const [jurisdiccion, servicio] of this.servicios.entries()) {
      try {
        const conectado = await servicio.verificarConectividad();
        estadisticas.conectividad[jurisdiccion] = {
          nombre: servicio.nombre,
          conectado,
          timestamp: new Date().toISOString()
        };
        
        if (conectado) {
          estadisticas.serviciosActivos++;
        }
      } catch (error) {
        estadisticas.conectividad[jurisdiccion] = {
          nombre: servicio.nombre,
          conectado: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        };
      }
    }

    return estadisticas;
  }

  /**
   * Recarga la configuración desde archivo
   */
  recargarConfiguracion(): void {
    this.cargarConfiguracion();
    this.servicios.clear();
    this.registrarServicios();
    
    this.logger.logRequest('provincia_config_recargada', {
      serviciosRegistrados: Array.from(this.servicios.keys())
    });
  }
}

// Instancia singleton
let provinciaManager: ProvinciaManager | null = null;

/**
 * Obtiene la instancia singleton del gestor de provincias
 */
export function getProvinciaManager(): ProvinciaManager {
  if (!provinciaManager) {
    provinciaManager = new ProvinciaManager();
  }
  return provinciaManager;
}

/**
 * Reinicia la instancia singleton (útil para testing)
 */
export function resetProvinciaManager(): void {
  provinciaManager = null;
}
