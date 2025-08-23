import { AfipLogger } from './AfipLogger';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  threshold: number;        // Número de errores consecutivos para abrir
  timeout: number;          // Tiempo en ms antes de intentar half-open
  resetTimeout: number;     // Tiempo en ms antes de reset completo
  monitorInterval: number;  // Intervalo para monitoreo
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private lastSuccessTime: number = 0;
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  private nextAttemptTime: number = 0;
  private config: CircuitBreakerConfig;
  private logger: AfipLogger;

  constructor(config: Partial<CircuitBreakerConfig> = {}, logger?: AfipLogger) {
    this.config = {
      threshold: 5,
      timeout: 5000,
      resetTimeout: 120000, // 2 minutos
      monitorInterval: 10000, // 10 segundos
      ...config
    };
    this.logger = logger || new AfipLogger();
  }

  /**
   * Ejecuta una función con protección del circuit breaker
   */
  async execute<T>(fn: () => Promise<T>, operation: string = 'unknown'): Promise<T> {
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
    } catch (error) {
      this.onFailure(operation, error);
      throw error;
    }
  }

  /**
   * Maneja un éxito
   */
  private onSuccess(operation: string): void {
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
  private onFailure(operation: string, error: any): void {
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
    } else if (this.state === CircuitState.CLOSED && this.failureCount >= this.config.threshold) {
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
  getStats(): CircuitBreakerStats {
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
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Fuerza el cierre del circuito (útil para testing)
   */
  forceClose(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = 0;
    this.logger.logRequest('circuit_breaker_force_closed', {});
  }

  /**
   * Fuerza la apertura del circuito (útil para testing)
   */
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.timeout;
    this.logger.logRequest('circuit_breaker_force_opened', {
      nextAttemptTime: new Date(this.nextAttemptTime)
    });
  }

  /**
   * Resetea las estadísticas
   */
  resetStats(): void {
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
  isReadyForHalfOpen(): boolean {
    return this.state === CircuitState.OPEN && Date.now() >= this.nextAttemptTime;
  }

  /**
   * Obtiene el tiempo restante antes del próximo intento
   */
  getTimeUntilNextAttempt(): number {
    if (this.state !== CircuitState.OPEN) {
      return 0;
    }
    return Math.max(0, this.nextAttemptTime - Date.now());
  }
}
