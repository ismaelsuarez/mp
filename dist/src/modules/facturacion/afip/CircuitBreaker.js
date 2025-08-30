"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.CircuitState = void 0;
const AfipLogger_1 = require("./AfipLogger");
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
class CircuitBreaker {
    constructor(config = {}, logger) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = 0;
        this.lastSuccessTime = 0;
        this.totalRequests = 0;
        this.totalFailures = 0;
        this.totalSuccesses = 0;
        this.nextAttemptTime = 0;
        this.config = {
            threshold: 5,
            timeout: 5000,
            resetTimeout: 120000, // 2 minutos
            monitorInterval: 10000, // 10 segundos
            ...config
        };
        this.logger = logger || new AfipLogger_1.AfipLogger();
    }
    /**
     * Ejecuta una función con protección del circuit breaker
     */
    async execute(fn, operation = 'unknown') {
        this.totalRequests++;
        // Verificar si el circuito está abierto
        if (this.state === CircuitState.OPEN) {
            if (Date.now() < this.nextAttemptTime) {
                this.logger.logRequest('circuit_breaker_open', {
                    operation,
                    nextAttemptTime: new Date(this.nextAttemptTime),
                    failureCount: this.failureCount
                });
                throw new Error(`Circuit breaker is OPEN for ${operation}. Next attempt at ${new Date(this.nextAttemptTime).toISOString()}`);
            }
            // Intentar half-open
            this.state = CircuitState.HALF_OPEN;
            this.logger.logRequest('circuit_breaker_half_open', { operation });
        }
        try {
            const result = await fn();
            this.onSuccess(operation);
            return result;
        }
        catch (error) {
            this.onFailure(operation, error);
            throw error;
        }
    }
    /**
     * Maneja un éxito
     */
    onSuccess(operation) {
        this.successCount++;
        this.totalSuccesses++;
        this.lastSuccessTime = Date.now();
        if (this.state === CircuitState.HALF_OPEN) {
            // Si estaba en half-open y tuvo éxito, cerrar el circuito
            this.state = CircuitState.CLOSED;
            this.failureCount = 0;
            this.logger.logRequest('circuit_breaker_closed', {
                operation,
                reason: 'success_in_half_open'
            });
        }
        this.logger.logRequest('circuit_breaker_success', {
            operation,
            successCount: this.successCount,
            failureCount: this.failureCount
        });
    }
    /**
     * Maneja un fallo
     */
    onFailure(operation, error) {
        this.failureCount++;
        this.totalFailures++;
        this.lastFailureTime = Date.now();
        this.logger.logError('circuit_breaker_failure', error instanceof Error ? error : new Error(String(error)), {
            operation,
            failureCount: this.failureCount,
            threshold: this.config.threshold,
            state: this.state
        });
        if (this.state === CircuitState.HALF_OPEN) {
            // Si estaba en half-open y falló, abrir el circuito
            this.state = CircuitState.OPEN;
            this.nextAttemptTime = Date.now() + this.config.timeout;
            this.logger.logRequest('circuit_breaker_opened', {
                operation,
                reason: 'failure_in_half_open',
                nextAttemptTime: new Date(this.nextAttemptTime)
            });
        }
        else if (this.state === CircuitState.CLOSED && this.failureCount >= this.config.threshold) {
            // Si estaba cerrado y alcanzó el umbral, abrir el circuito
            this.state = CircuitState.OPEN;
            this.nextAttemptTime = Date.now() + this.config.timeout;
            this.logger.logRequest('circuit_breaker_opened', {
                operation,
                reason: 'threshold_reached',
                failureCount: this.failureCount,
                threshold: this.config.threshold,
                nextAttemptTime: new Date(this.nextAttemptTime)
            });
        }
    }
    /**
     * Obtiene estadísticas del circuit breaker
     */
    getStats() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            totalRequests: this.totalRequests,
            totalFailures: this.totalFailures,
            totalSuccesses: this.totalSuccesses
        };
    }
    /**
     * Obtiene el estado actual
     */
    getState() {
        return this.state;
    }
    /**
     * Fuerza el cierre del circuito (útil para testing)
     */
    forceClose() {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttemptTime = 0;
        this.logger.logRequest('circuit_breaker_force_closed', {});
    }
    /**
     * Fuerza la apertura del circuito (útil para testing)
     */
    forceOpen() {
        this.state = CircuitState.OPEN;
        this.nextAttemptTime = Date.now() + this.config.timeout;
        this.logger.logRequest('circuit_breaker_force_opened', {
            nextAttemptTime: new Date(this.nextAttemptTime)
        });
    }
    /**
     * Resetea las estadísticas
     */
    resetStats() {
        this.totalRequests = 0;
        this.totalFailures = 0;
        this.totalSuccesses = 0;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = 0;
        this.lastSuccessTime = 0;
        this.logger.logRequest('circuit_breaker_stats_reset', {});
    }
    /**
     * Verifica si el circuito está listo para intentar half-open
     */
    isReadyForHalfOpen() {
        return this.state === CircuitState.OPEN && Date.now() >= this.nextAttemptTime;
    }
    /**
     * Obtiene el tiempo restante antes del próximo intento
     */
    getTimeUntilNextAttempt() {
        if (this.state !== CircuitState.OPEN) {
            return 0;
        }
        return Math.max(0, this.nextAttemptTime - Date.now());
    }
}
exports.CircuitBreaker = CircuitBreaker;
