import { CircuitBreaker, CircuitBreakerConfig } from './CircuitBreaker';
import { AfipLogger } from './AfipLogger';

export interface ResilienceConfig {
  timeout: number;           // Timeout en ms para cada llamada
  retries: number;           // Número de reintentos
  retryDelay: number;        // Delay base para reintentos en ms
  circuitBreaker: CircuitBreakerConfig;
}

export interface ResilienceStats {
  circuitBreaker: any;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  timeoutRequests: number;
  retryAttempts: number;
}

export class ResilienceWrapper {
  private circuitBreaker: CircuitBreaker;
  private logger: AfipLogger;
  private config: ResilienceConfig;
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    timeoutRequests: 0,
    retryAttempts: 0
  };

  constructor(config: Partial<ResilienceConfig> = {}, logger?: AfipLogger) {
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

    this.logger = logger || new AfipLogger();
    this.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker, this.logger);
  }

  /**
   * Ejecuta una función con protección completa de resiliencia
   */
  async execute<T>(
    fn: () => Promise<T>, 
    operation: string = 'unknown',
    options: {
      timeout?: number;
      retries?: number;
      retryDelay?: number;
      skipCircuitBreaker?: boolean;
    } = {}
  ): Promise<T> {
    const finalConfig = {
      timeout: options.timeout || this.config.timeout,
      retries: options.retries || this.config.retries,
      retryDelay: options.retryDelay || this.config.retryDelay,
      skipCircuitBreaker: options.skipCircuitBreaker || false
    };

    this.stats.totalRequests++;

    const executeWithTimeout = async (): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
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

    const executeWithRetry = async (): Promise<T> => {
      let lastError: Error;
      
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
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          if (attempt <= finalConfig.retries) {
            this.logger.logError('resilience_retry_failed', lastError, {
              operation,
              attempt,
              maxRetries: finalConfig.retries
            });
          } else {
            // Último intento falló
            throw lastError;
          }
        }
      }
      
      throw lastError!;
    };

    try {
      let result: T;

      if (finalConfig.skipCircuitBreaker) {
        // Ejecutar sin circuit breaker (útil para operaciones críticas)
        result = await executeWithRetry();
      } else {
        // Ejecutar con circuit breaker
        result = await this.circuitBreaker.execute(executeWithRetry, operation);
      }

      this.stats.successfulRequests++;
      this.logger.logRequest('resilience_success', { 
        operation, 
        totalRequests: this.stats.totalRequests 
      });

      return result;

    } catch (error) {
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
  async executeWithTimeout<T>(
    fn: () => Promise<T>, 
    timeout: number, 
    operation: string = 'unknown'
  ): Promise<T> {
    return this.execute(fn, operation, { timeout });
  }

  /**
   * Ejecuta una función sin reintentos (solo timeout y circuit breaker)
   */
  async executeWithoutRetry<T>(
    fn: () => Promise<T>, 
    operation: string = 'unknown'
  ): Promise<T> {
    return this.execute(fn, operation, { retries: 0 });
  }

  /**
   * Ejecuta una función sin circuit breaker (solo timeout y reintentos)
   */
  async executeWithoutCircuitBreaker<T>(
    fn: () => Promise<T>, 
    operation: string = 'unknown'
  ): Promise<T> {
    return this.execute(fn, operation, { skipCircuitBreaker: true });
  }

  /**
   * Obtiene estadísticas de resiliencia
   */
  getStats(): ResilienceStats {
    return {
      circuitBreaker: this.circuitBreaker.getStats(),
      ...this.stats
    };
  }

  /**
   * Obtiene el estado del circuit breaker
   */
  getCircuitBreakerState(): any {
    return this.circuitBreaker.getState();
  }

  /**
   * Obtiene estadísticas del circuit breaker
   */
  getCircuitBreakerStats(): any {
    return this.circuitBreaker.getStats();
  }

  /**
   * Fuerza el cierre del circuit breaker
   */
  forceCloseCircuitBreaker(): void {
    this.circuitBreaker.forceClose();
  }

  /**
   * Fuerza la apertura del circuit breaker
   */
  forceOpenCircuitBreaker(): void {
    this.circuitBreaker.forceOpen();
  }

  /**
   * Resetea todas las estadísticas
   */
  resetStats(): void {
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
  getTimeUntilNextAttempt(): number {
    return this.circuitBreaker.getTimeUntilNextAttempt();
  }

  /**
   * Verifica si el circuit breaker está listo para half-open
   */
  isReadyForHalfOpen(): boolean {
    return this.circuitBreaker.isReadyForHalfOpen();
  }

  /**
   * Obtiene la configuración actual
   */
  getConfig(): ResilienceConfig {
    return { ...this.config };
  }

  /**
   * Actualiza la configuración
   */
  updateConfig(newConfig: Partial<ResilienceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.logRequest('resilience_config_updated', { newConfig });
  }
}
