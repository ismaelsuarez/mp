"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timeScheduler = exports.TimeScheduler = void 0;
exports.startTimeScheduler = startTimeScheduler;
exports.stopTimeScheduler = stopTimeScheduler;
const TimeValidator_1 = require("./TimeValidator");
const AfipLogger_1 = require("../afip/AfipLogger");
class TimeScheduler {
    constructor(config) {
        this.intervalId = null;
        this.consecutiveFailures = 0;
        this.isRunning = false;
        this.logger = new AfipLogger_1.AfipLogger();
        this.config = {
            checkInterval: parseInt(process.env.NTP_CHECK_INTERVAL || '3600000'), // 1 hora por defecto
            alertThreshold: parseInt(process.env.NTP_ALERT_THRESHOLD || '30000'), // 30 segundos
            maxConsecutiveFailures: parseInt(process.env.NTP_MAX_FAILURES || '3'),
            enabled: process.env.NTP_SCHEDULER_ENABLED !== 'false',
            ...config
        };
        this.stats = {
            totalChecks: 0,
            successfulChecks: 0,
            failedChecks: 0,
            consecutiveFailures: 0,
            lastCheck: null,
            lastFailure: null,
            averageDrift: 0,
            alertsGenerated: 0
        };
    }
    /**
     * Inicia el scheduler de validación de tiempo
     */
    start() {
        if (this.isRunning) {
            this.logger.logRequest('timeSchedulerStart', { message: 'Scheduler ya está ejecutándose' });
            return;
        }
        if (!this.config.enabled) {
            this.logger.logRequest('timeSchedulerStart', { message: 'Scheduler deshabilitado en configuración' });
            return;
        }
        this.isRunning = true;
        this.intervalId = setInterval(() => {
            this.performCheck();
        }, this.config.checkInterval);
        this.logger.logRequest('timeSchedulerStart', {
            checkInterval: this.config.checkInterval,
            alertThreshold: this.config.alertThreshold,
            maxFailures: this.config.maxConsecutiveFailures
        });
    }
    /**
     * Detiene el scheduler
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        this.logger.logRequest('timeSchedulerStop', { message: 'Scheduler detenido' });
    }
    /**
     * Ejecuta una validación de tiempo inmediata
     */
    async performCheck() {
        const startTime = Date.now();
        this.stats.totalChecks++;
        this.stats.lastCheck = new Date();
        try {
            this.logger.logRequest('timeSchedulerCheck', { checkNumber: this.stats.totalChecks });
            const result = await TimeValidator_1.timeValidator.validateSystemTime();
            if (result.isValid) {
                this.stats.successfulChecks++;
                this.consecutiveFailures = 0;
                this.stats.consecutiveFailures = 0;
                // Verificar si necesita alerta por drift alto pero válido
                if (result.drift > this.config.alertThreshold) {
                    this.generateAlert('DRIFT_WARNING', {
                        drift: result.drift,
                        threshold: this.config.alertThreshold,
                        message: 'Drift de tiempo alto pero dentro del límite permitido'
                    });
                }
                this.logger.logResponse('timeSchedulerCheck', {
                    success: true,
                    drift: result.drift,
                    duration: Date.now() - startTime
                });
            }
            else {
                this.stats.failedChecks++;
                this.consecutiveFailures++;
                this.stats.consecutiveFailures = this.consecutiveFailures;
                this.stats.lastFailure = new Date();
                this.generateAlert('TIME_DESYNC', {
                    drift: result.drift,
                    error: result.error,
                    consecutiveFailures: this.consecutiveFailures,
                    message: 'Sistema de tiempo desincronizado'
                });
                this.logger.logError('timeSchedulerCheck', new Error(result.error || 'Validación de tiempo falló'), {
                    drift: result.drift,
                    consecutiveFailures: this.consecutiveFailures
                });
                // Si hay demasiados fallos consecutivos, generar alerta crítica
                if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
                    this.generateAlert('CRITICAL_TIME_DESYNC', {
                        consecutiveFailures: this.consecutiveFailures,
                        maxFailures: this.config.maxConsecutiveFailures,
                        message: 'Múltiples fallos consecutivos de validación de tiempo'
                    });
                }
            }
            // Actualizar estadísticas
            this.updateStats(result);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.stats.failedChecks++;
            this.consecutiveFailures++;
            this.stats.consecutiveFailures = this.consecutiveFailures;
            this.stats.lastFailure = new Date();
            this.logger.logError('timeSchedulerCheck', error instanceof Error ? error : new Error(errorMessage), {
                consecutiveFailures: this.consecutiveFailures
            });
            // Crear resultado de error
            const errorResult = {
                isValid: false,
                drift: 0,
                systemTime: new Date(),
                ntpTime: new Date(),
                error: errorMessage
            };
            this.updateStats(errorResult);
            return errorResult;
        }
    }
    /**
     * Genera una alerta de tiempo
     */
    generateAlert(type, data) {
        this.stats.alertsGenerated++;
        const alert = {
            type,
            timestamp: new Date().toISOString(),
            data,
            stats: {
                totalChecks: this.stats.totalChecks,
                consecutiveFailures: this.consecutiveFailures,
                averageDrift: this.stats.averageDrift
            }
        };
        this.logger.logRequest('timeAlert', alert);
        // Aquí se podría integrar con sistemas de alertas externos
        // como email, Slack, etc.
        console.error(`[TIME ALERT] ${type}:`, data);
    }
    /**
     * Actualiza las estadísticas del scheduler
     */
    updateStats(result) {
        // Calcular promedio de drift (solo para validaciones exitosas)
        if (result.isValid && this.stats.successfulChecks > 0) {
            const totalDrift = this.stats.averageDrift * (this.stats.successfulChecks - 1) + result.drift;
            this.stats.averageDrift = totalDrift / this.stats.successfulChecks;
        }
    }
    /**
     * Obtiene las estadísticas del scheduler
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Obtiene el estado del scheduler
     */
    getStatus() {
        let nextCheckIn = null;
        if (this.isRunning && this.stats.lastCheck) {
            const nextCheck = new Date(this.stats.lastCheck.getTime() + this.config.checkInterval);
            nextCheckIn = Math.max(0, nextCheck.getTime() - Date.now());
        }
        return {
            isRunning: this.isRunning,
            isEnabled: this.config.enabled,
            nextCheckIn,
            config: this.config
        };
    }
    /**
     * Actualiza la configuración del scheduler
     */
    updateConfig(newConfig) {
        const wasRunning = this.isRunning;
        if (wasRunning) {
            this.stop();
        }
        this.config = { ...this.config, ...newConfig };
        if (wasRunning && this.config.enabled) {
            this.start();
        }
        this.logger.logRequest('timeSchedulerConfigUpdated', { newConfig });
    }
    /**
     * Resetea las estadísticas del scheduler
     */
    resetStats() {
        this.stats = {
            totalChecks: 0,
            successfulChecks: 0,
            failedChecks: 0,
            consecutiveFailures: 0,
            lastCheck: null,
            lastFailure: null,
            averageDrift: 0,
            alertsGenerated: 0
        };
        this.consecutiveFailures = 0;
        this.logger.logRequest('timeSchedulerStatsReset', { message: 'Estadísticas reseteadas' });
    }
    /**
     * Fuerza una validación inmediata
     */
    async forceCheck() {
        this.logger.logRequest('timeSchedulerForceCheck', { message: 'Validación forzada' });
        return this.performCheck();
    }
}
exports.TimeScheduler = TimeScheduler;
// Instancia singleton para uso global
exports.timeScheduler = new TimeScheduler();
// Función de conveniencia para iniciar el scheduler
function startTimeScheduler() {
    exports.timeScheduler.start();
}
// Función de conveniencia para detener el scheduler
function stopTimeScheduler() {
    exports.timeScheduler.stop();
}
