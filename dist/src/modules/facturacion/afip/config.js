"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.afipEnvConfig = void 0;
exports.getDefaultConfig = getDefaultConfig;
exports.getResilienceConfig = getResilienceConfig;
exports.validateEnvConfig = validateEnvConfig;
const dotenv_1 = __importDefault(require("dotenv"));
// Cargar variables de entorno
dotenv_1.default.config();
exports.afipEnvConfig = {
    // Valores por defecto para homologación
    AFIP_HOMOLOGACION_CUIT: process.env.AFIP_HOMOLOGACION_CUIT || '',
    AFIP_HOMOLOGACION_PTO_VTA: parseInt(process.env.AFIP_HOMOLOGACION_PTO_VTA || '1'),
    AFIP_HOMOLOGACION_CERT_PATH: process.env.AFIP_HOMOLOGACION_CERT_PATH || '',
    AFIP_HOMOLOGACION_KEY_PATH: process.env.AFIP_HOMOLOGACION_KEY_PATH || '',
    // Valores por defecto para producción
    AFIP_PRODUCCION_CUIT: process.env.AFIP_PRODUCCION_CUIT || '',
    AFIP_PRODUCCION_PTO_VTA: parseInt(process.env.AFIP_PRODUCCION_PTO_VTA || '1'),
    AFIP_PRODUCCION_CERT_PATH: process.env.AFIP_PRODUCCION_CERT_PATH || '',
    AFIP_PRODUCCION_KEY_PATH: process.env.AFIP_PRODUCCION_CERT_PATH || '',
    // Configuración general
    AFIP_DEFAULT_ENTORNO: process.env.AFIP_DEFAULT_ENTORNO || 'homologacion',
    AFIP_LOG_LEVEL: process.env.AFIP_LOG_LEVEL || 'info',
    AFIP_TIMEOUT: parseInt(process.env.AFIP_TIMEOUT || '30000'),
    AFIP_RETRY_ATTEMPTS: parseInt(process.env.AFIP_RETRY_ATTEMPTS || '3'),
    // Configuración de resiliencia
    AFIP_RESILIENCE_TIMEOUT: parseInt(process.env.AFIP_RESILIENCE_TIMEOUT || '30000'),
    AFIP_RESILIENCE_RETRIES: parseInt(process.env.AFIP_RESILIENCE_RETRIES || '3'),
    AFIP_RESILIENCE_RETRY_DELAY: parseInt(process.env.AFIP_RESILIENCE_RETRY_DELAY || '1000'),
    AFIP_RESILIENCE_CIRCUIT_BREAKER_THRESHOLD: parseInt(process.env.AFIP_RESILIENCE_CIRCUIT_BREAKER_THRESHOLD || '5'),
    AFIP_RESILIENCE_CIRCUIT_BREAKER_TIMEOUT: parseInt(process.env.AFIP_RESILIENCE_CIRCUIT_BREAKER_TIMEOUT || '5000'),
    AFIP_RESILIENCE_CIRCUIT_BREAKER_RESET_TIMEOUT: parseInt(process.env.AFIP_RESILIENCE_CIRCUIT_BREAKER_RESET_TIMEOUT || '120000')
};
/**
 * Obtiene la configuración por defecto para un entorno específico
 */
function getDefaultConfig(entorno) {
    if (entorno === 'homologacion') {
        return {
            cuit: exports.afipEnvConfig.AFIP_HOMOLOGACION_CUIT,
            pto_vta: exports.afipEnvConfig.AFIP_HOMOLOGACION_PTO_VTA,
            cert_path: exports.afipEnvConfig.AFIP_HOMOLOGACION_CERT_PATH,
            key_path: exports.afipEnvConfig.AFIP_HOMOLOGACION_KEY_PATH,
            entorno: 'homologacion'
        };
    }
    else {
        return {
            cuit: exports.afipEnvConfig.AFIP_PRODUCCION_CUIT,
            pto_vta: exports.afipEnvConfig.AFIP_PRODUCCION_PTO_VTA,
            cert_path: exports.afipEnvConfig.AFIP_PRODUCCION_CERT_PATH,
            key_path: exports.afipEnvConfig.AFIP_PRODUCCION_KEY_PATH,
            entorno: 'produccion'
        };
    }
}
/**
 * Obtiene la configuración de resiliencia
 */
function getResilienceConfig() {
    return {
        timeout: exports.afipEnvConfig.AFIP_RESILIENCE_TIMEOUT,
        retries: exports.afipEnvConfig.AFIP_RESILIENCE_RETRIES,
        retryDelay: exports.afipEnvConfig.AFIP_RESILIENCE_RETRY_DELAY,
        circuitBreaker: {
            threshold: exports.afipEnvConfig.AFIP_RESILIENCE_CIRCUIT_BREAKER_THRESHOLD,
            timeout: exports.afipEnvConfig.AFIP_RESILIENCE_CIRCUIT_BREAKER_TIMEOUT,
            resetTimeout: exports.afipEnvConfig.AFIP_RESILIENCE_CIRCUIT_BREAKER_RESET_TIMEOUT,
            monitorInterval: 10000
        }
    };
}
/**
 * Valida que la configuración de entorno esté completa
 */
function validateEnvConfig() {
    const errors = [];
    // Validar configuración de homologación
    if (!exports.afipEnvConfig.AFIP_HOMOLOGACION_CUIT) {
        errors.push('AFIP_HOMOLOGACION_CUIT no configurado');
    }
    if (!exports.afipEnvConfig.AFIP_HOMOLOGACION_CERT_PATH) {
        errors.push('AFIP_HOMOLOGACION_CERT_PATH no configurado');
    }
    if (!exports.afipEnvConfig.AFIP_HOMOLOGACION_KEY_PATH) {
        errors.push('AFIP_HOMOLOGACION_KEY_PATH no configurado');
    }
    return errors;
}
