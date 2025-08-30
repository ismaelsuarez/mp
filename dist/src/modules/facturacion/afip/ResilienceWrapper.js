"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResilienceWrapper = void 0;
const CircuitBreaker_1 = require("./CircuitBreaker");
const AfipLogger_1 = require("./AfipLogger");
class ResilienceWrapper {
    constructor(config = {}, logger) {
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            timeoutRequests: 0,
            retryAttempts: 0
        };
        this.config = {
            timeout: 30000, // 30 segundos por defecto
            retries: 3,
            retryDelay: 1000, // 1 segundo base
            circuitBreaker: {
                threshold: 5,
                timeout: 5000,
                resetTimeout: 120000, // 2 minutos
                monitorInterval: 10000
            },
            ...config
        };
        this.logger = logger || new AfipLogger_1.AfipLogger();
        this.circuitBreaker = new CircuitBreaker_1.CircuitBreaker(this.config.circuitBreaker, this.logger);
    }
    /**
     * Ejecuta una función con protección completa de resiliencia
     */
    async execute(fn, operation = 'unknown', options = {}) {
        const finalConfig = {
            timeout: options.timeout || this.config.timeout,
            retries: options.retries || this.config.retries,
            retryDelay: options.retryDelay || this.config.retryDelay,
            skipCircuitBreaker: options.skipCircuitBreaker || false
        };
        this.stats.totalRequests++;
        const executeWithTimeout = async () => {
            return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    this.stats.timeoutRequests++;
                    const timeoutError = new Error(`Timeout after ${finalConfig.timeout}ms for operation: ${operation}`);
                    this.logger.logError('resilience_timeout', timeoutError, { operation, timeout: finalConfig.timeout });
                    reject(timeoutError);
                }, finalConfig.timeout);
                fn()
                    .then((result) => {
                    clearTimeout(timeoutId);
                    resolve(result);
                })
                    .catch((error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
            });
        };
        const executeWithRetry = async () => {
            let lastError;
            for (let attempt = 1; attempt <= finalConfig.retries + 1; attempt++) {
                try {
                    if (attempt > 1) {
                        this.stats.retryAttempts++;
                        this.logger.logRequest('resilience_retry', {
                            operation,
                            attempt,
                            maxRetries: finalConfig.retries
                        });
                        // Backoff exponencial
                        const delay = finalConfig.retryDelay * Math.pow(2, attempt - 2);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    return await executeWithTimeout();
                }
                catch (error) {
                    lastError = error instanceof Error ? error : new Error(String(error));
                    if (attempt <= finalConfig.retries) {
                        this.logger.logError('resilience_retry_failed', lastError, {
                            operation,
                            attempt,
                            maxRetries: finalConfig.retries
                        });
                    }
                    else {
                        // Último intento falló
                        throw lastError;
                    }
                }
            }
            throw lastError;
        };
        try {
            let result;
            if (finalConfig.skipCircuitBreaker) {
                // Ejecutar sin circuit breaker (útil para operaciones críticas)
                result = await executeWithRetry();
            }
            else {
                // Ejecutar con circuit breaker
                result = await this.circuitBreaker.execute(executeWithRetry, operation);
            }
            this.stats.successfulRequests++;
            this.logger.logRequest('resilience_success', {
                operation,
                totalRequests: this.stats.totalRequests
            });
            return result;
        }
        catch (error) {
            this.stats.failedRequests++;
            this.logger.logError('resilience_failure', error instanceof Error ? error : new Error(String(error)), {
                operation,
                totalRequests: this.stats.totalRequests,
                failedRequests: this.stats.failedRequests
            });
            throw error;
        }
    }
    /**
     * Ejecuta una función con timeout personalizado
     */
    async executeWithTimeout(fn, timeout, operation = 'unknown') {
        return this.execute(fn, operation, { timeout });
    }
    /**
     * Ejecuta una función sin reintentos (solo timeout y circuit breaker)
     */
    async executeWithoutRetry(fn, operation = 'unknown') {
        return this.execute(fn, operation, { retries: 0 });
    }
    /**
     * Ejecuta una función sin circuit breaker (solo timeout y reintentos)
     */
    async executeWithoutCircuitBreaker(fn, operation = 'unknown') {
        return this.execute(fn, operation, { skipCircuitBreaker: true });
    }
    /**
     * Obtiene estadísticas de resiliencia
     */
    getStats() {
        return {
            circuitBreaker: this.circuitBreaker.getStats(),
            ...this.stats
        };
    }
    /**
     * Obtiene el estado del circuit breaker
     */
    getCircuitBreakerState() {
        return this.circuitBreaker.getState();
    }
    /**
     * Obtiene estadísticas del circuit breaker
     */
    getCircuitBreakerStats() {
        return this.circuitBreaker.getStats();
    }
    /**
     * Fuerza el cierre del circuit breaker
     */
    forceCloseCircuitBreaker() {
        this.circuitBreaker.forceClose();
    }
    /**
     * Fuerza la apertura del circuit breaker
     */
    forceOpenCircuitBreaker() {
        this.circuitBreaker.forceOpen();
    }
    /**
     * Resetea todas las estadísticas
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            timeoutRequests: 0,
            retryAttempts: 0
        };
        this.circuitBreaker.resetStats();
        this.logger.logRequest('resilience_stats_reset', {});
    }
    /**
     * Obtiene el tiempo restante antes del próximo intento del circuit breaker
     */
    getTimeUntilNextAttempt() {
        return this.circuitBreaker.getTimeUntilNextAttempt();
    }
    /**
     * Verifica si el circuit breaker está listo para half-open
     */
    isReadyForHalfOpen() {
        return this.circuitBreaker.isReadyForHalfOpen();
    }
    /**
     * Obtiene la configuración actual
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Actualiza la configuración
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.logRequest('resilience_config_updated', { newConfig });
    }
}
exports.ResilienceWrapper = ResilienceWrapper;
