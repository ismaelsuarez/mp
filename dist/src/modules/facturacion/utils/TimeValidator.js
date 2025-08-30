"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.timeValidator = exports.TimeValidator = void 0;
exports.validateSystemTime = validateSystemTime;
exports.validateSystemTimeAndThrow = validateSystemTimeAndThrow;
const ntp_client_1 = __importDefault(require("ntp-client"));
const AfipLogger_1 = require("../afip/AfipLogger");
class TimeValidator {
    debugLog(...args) {
        if (this.DEBUG_FACT) {
            // eslint-disable-next-line no-console
            console.log('[FACT][TimeValidator]', ...args);
        }
    }
    constructor(config) {
        this.lastValidation = null;
        this.validationCount = 0;
        this.totalDrift = 0;
        this.DEBUG_FACT = process.env.FACTURACION_DEBUG === 'true';
        this.logger = new AfipLogger_1.AfipLogger();
        this.config = {
            server: process.env.NTP_SERVER || 'pool.ntp.org',
            port: parseInt(process.env.NTP_PORT || '123'),
            allowedDrift: parseInt(process.env.NTP_ALLOWED_DRIFT || '60000'), // 60 segundos
            timeout: parseInt(process.env.NTP_TIMEOUT || '5000'), // 5 segundos
            ...config
        };
    }
    /**
     * Valida la sincronización del tiempo del sistema con NTP
     */
    async validateSystemTime() {
        const startTime = Date.now();
        try {
            this.logger.logRequest('validateSystemTime', {
                server: this.config.server,
                port: this.config.port,
                allowedDrift: this.config.allowedDrift
            });
            this.debugLog('Validando tiempo con NTP', this.config);
            const result = await this.queryNTP();
            // Agregar duración al resultado
            result.duration = Date.now() - startTime;
            this.debugLog('Resultado NTP', { drift: result.drift, isValid: result.isValid, duration: result.duration });
            // Calcular estadísticas
            this.validationCount++;
            this.totalDrift += result.drift;
            this.lastValidation = result;
            this.logger.logResponse('validateSystemTime', {
                isValid: result.isValid,
                drift: result.drift,
                duration: result.duration,
                averageDrift: this.getAverageDrift()
            });
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.logError('validateSystemTime', error instanceof Error ? error : new Error(errorMessage), {
                server: this.config.server,
                port: this.config.port
            });
            this.debugLog('NTP ERROR', errorMessage);
            // En caso de error de NTP, no bloquear pero generar warning
            const systemTime = new Date();
            const result = {
                isValid: true, // No bloquear por fallo de NTP
                drift: 0,
                systemTime,
                ntpTime: systemTime,
                warning: `No se pudo validar con NTP: ${errorMessage}`,
                duration: Date.now() - startTime
            };
            // Actualizar estadísticas incluso en caso de error
            this.validationCount++;
            this.totalDrift += result.drift;
            this.lastValidation = result;
            return result;
        }
    }
    /**
     * Consulta el servidor NTP y compara con el tiempo local
     */
    queryNTP() {
        const startTime = Date.now();
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout consultando servidor NTP'));
            }, this.config.timeout);
            ntp_client_1.default.getNetworkTime(this.config.server, this.config.port, (err, ntpTime) => {
                clearTimeout(timeout);
                if (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    reject(new Error(`Error consultando NTP: ${errorMessage}`));
                    return;
                }
                const systemTime = new Date();
                const drift = Math.abs(systemTime.getTime() - ntpTime.getTime());
                const result = {
                    isValid: drift <= this.config.allowedDrift,
                    drift,
                    systemTime,
                    ntpTime,
                    duration: Date.now() - startTime
                };
                this.debugLog('queryNTP OK', { drift: result.drift, allowed: this.config.allowedDrift });
                if (!result.isValid) {
                    result.error = `Drift de tiempo detectado: ${drift}ms > permitido ${this.config.allowedDrift}ms`;
                }
                resolve(result);
            });
        });
    }
    /**
     * Valida el tiempo y lanza error si está desincronizado
     */
    async validateAndThrow() {
        const result = await this.validateSystemTime();
        if (!result.isValid) {
            throw new Error(`Validación de tiempo falló: ${result.error}`);
        }
        if (result.warning) {
            this.logger.logRequest('timeValidationWarning', { warning: result.warning });
        }
    }
    /**
     * Obtiene el promedio de drift de todas las validaciones
     */
    getAverageDrift() {
        return this.validationCount > 0 ? this.totalDrift / this.validationCount : 0;
    }
    /**
     * Obtiene estadísticas de validación
     */
    getStats() {
        return {
            totalValidations: this.validationCount,
            averageDrift: this.getAverageDrift(),
            lastValidation: this.lastValidation,
            config: this.config
        };
    }
    /**
     * Resetea las estadísticas
     */
    resetStats() {
        this.validationCount = 0;
        this.totalDrift = 0;
        this.lastValidation = null;
    }
    /**
     * Actualiza la configuración
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.logRequest('timeValidatorConfigUpdated', { newConfig });
    }
    /**
     * Obtiene el estado actual del validador
     */
    getStatus() {
        return {
            isConfigured: !!this.config.server,
            lastValidationTime: this.lastValidation ? this.lastValidation.systemTime : null,
            isLastValidationValid: this.lastValidation?.isValid ?? false,
            lastDrift: this.lastValidation?.drift ?? 0
        };
    }
}
exports.TimeValidator = TimeValidator;
// Instancia singleton para uso global
exports.timeValidator = new TimeValidator();
// Función de conveniencia para validación rápida
async function validateSystemTime() {
    return exports.timeValidator.validateSystemTime();
}
// Función de conveniencia para validación con error
async function validateSystemTimeAndThrow() {
    return exports.timeValidator.validateAndThrow();
}
