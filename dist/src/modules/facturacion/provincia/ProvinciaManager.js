"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProvinciaManager = void 0;
exports.getProvinciaManager = getProvinciaManager;
exports.resetProvinciaManager = resetProvinciaManager;
const ATMService_1 = require("./ATMService");
const AfipLogger_1 = require("../afip/AfipLogger");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Gestor centralizado para administraciones provinciales
 */
class ProvinciaManager {
    debugLog(...args) {
        if (this.DEBUG_FACT) {
            // eslint-disable-next-line no-console
            console.log('[FACT][ProvinciaManager]', ...args);
        }
    }
    constructor(configPath) {
        this.servicios = new Map();
        this.configuracion = {};
        this.DEBUG_FACT = process.env.FACTURACION_DEBUG === 'true';
        this.logger = new AfipLogger_1.AfipLogger();
        this.configPath = configPath || path_1.default.join(process.cwd(), 'config', 'provincia.config.json');
        this.inicializar();
    }
    /**
     * Inicializa el gestor de provincias
     */
    inicializar() {
        try {
            this.cargarConfiguracion();
            this.registrarServicios();
            this.logger.logRequest('provincia_manager_inicializado', {
                serviciosRegistrados: Array.from(this.servicios.keys()),
                configuracionCargada: Object.keys(this.configuracion)
            });
            this.debugLog('Inicializado', { servicios: Array.from(this.servicios.keys()), configPath: this.configPath });
        }
        catch (error) {
            this.logger.logError('provincia_manager_inicializacion', error instanceof Error ? error : new Error(String(error)), {
                configPath: this.configPath
            });
        }
    }
    /**
     * Carga la configuración desde archivo JSON
     */
    cargarConfiguracion() {
        try {
            if (fs_1.default.existsSync(this.configPath)) {
                const contenido = fs_1.default.readFileSync(this.configPath, 'utf-8');
                this.configuracion = JSON.parse(contenido);
                this.debugLog('Configuración cargada desde archivo', this.configPath);
            }
            else {
                // Crear configuración por defecto
                this.crearConfiguracionPorDefecto();
            }
        }
        catch (error) {
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
    crearConfiguracionPorDefecto() {
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
    guardarConfiguracion() {
        try {
            const dir = path_1.default.dirname(this.configPath);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            fs_1.default.writeFileSync(this.configPath, JSON.stringify(this.configuracion, null, 2));
        }
        catch (error) {
            this.logger.logError('provincia_guardar_config', error instanceof Error ? error : new Error(String(error)), {
                configPath: this.configPath
            });
        }
    }
    /**
     * Registra los servicios provinciales disponibles
     */
    registrarServicios() {
        // Registrar ATM Mendoza
        if (this.configuracion.mendoza?.enabled) {
            const mockMode = process.env.NODE_ENV !== 'production';
            this.servicios.set('mendoza', new ATMService_1.ATMService(mockMode));
            this.debugLog('Servicio registrado', { servicio: 'ATMService', jurisdiccion: 'mendoza', mockMode });
        }
        // Aquí se registrarían otros servicios cuando estén implementados
        // if (this.configuracion.caba?.enabled) {
        //   this.servicios.set('caba', new AGIPService());
        // }
    }
    /**
     * Procesa un comprobante a través de AFIP y provincias aplicables
     */
    async procesarComprobante(params) {
        const startTime = Date.now();
        this.logger.logRequest('provincia_procesar_comprobante_inicio', {
            cae: params.cae,
            numero: params.numero,
            total: params.total,
            cuitEmisor: params.cuitEmisor
        });
        const resultado = {
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
            }
            else {
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
        }
        catch (error) {
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
    async buscarServiciosAplicables(params) {
        const serviciosAplicables = [];
        for (const [jurisdiccion, servicio] of this.servicios.entries()) {
            try {
                const esAplicable = await servicio.esAplicable(params);
                if (esAplicable) {
                    serviciosAplicables.push(servicio);
                }
            }
            catch (error) {
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
    getConfiguracion() {
        return { ...this.configuracion };
    }
    /**
     * Actualiza la configuración de una provincia
     */
    actualizarConfiguracion(jurisdiccion, config) {
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
    async getEstadisticas() {
        const estadisticas = {
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
            }
            catch (error) {
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
    recargarConfiguracion() {
        this.cargarConfiguracion();
        this.servicios.clear();
        this.registrarServicios();
        this.logger.logRequest('provincia_config_recargada', {
            serviciosRegistrados: Array.from(this.servicios.keys())
        });
    }
}
exports.ProvinciaManager = ProvinciaManager;
// Instancia singleton
let provinciaManager = null;
/**
 * Obtiene la instancia singleton del gestor de provincias
 */
function getProvinciaManager() {
    if (!provinciaManager) {
        provinciaManager = new ProvinciaManager();
    }
    return provinciaManager;
}
/**
 * Reinicia la instancia singleton (útil para testing)
 */
function resetProvinciaManager() {
    provinciaManager = null;
}
