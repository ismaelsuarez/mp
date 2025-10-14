import { timeValidator, TimeValidationResult } from './TimeValidator';
import { AfipLogger } from '../afip/AfipLogger';

export interface TimeSchedulerConfig {
  checkInterval: number; // en ms
  alertThreshold: number; // drift en ms para alertas
  maxConsecutiveFailures: number;
  enabled: boolean;
}

export interface TimeSchedulerStats {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  consecutiveFailures: number;
  lastCheck: Date | null;
  lastFailure: Date | null;
  averageDrift: number;
  alertsGenerated: number;
}

export class TimeScheduler {
  private logger: AfipLogger;
  private config: TimeSchedulerConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private stats: TimeSchedulerStats;
  private consecutiveFailures = 0;
  private isRunning = false;

  constructor(config?: Partial<TimeSchedulerConfig>) {
    this.logger = new AfipLogger();
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
  start(): void {
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
  stop(): void {
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
  async performCheck(): Promise<TimeValidationResult> {
    const startTime = Date.now();
    this.stats.totalChecks++;
    this.stats.lastCheck = new Date();

    try {
      this.logger.logRequest('timeSchedulerCheck', { checkNumber: this.stats.totalChecks });

      const result = await timeValidator.validateSystemTime();
      
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

      } else {
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

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.stats.failedChecks++;
      this.consecutiveFailures++;
      this.stats.consecutiveFailures = this.consecutiveFailures;
      this.stats.lastFailure = new Date();

      this.logger.logError('timeSchedulerCheck', error instanceof Error ? error : new Error(errorMessage), {
        consecutiveFailures: this.consecutiveFailures
      });

      // Crear resultado de error
      const errorResult: TimeValidationResult = {
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
  private generateAlert(type: string, data: any): void {
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
  private updateStats(result: TimeValidationResult): void {
    // Calcular promedio de drift (solo para validaciones exitosas)
    if (result.isValid && this.stats.successfulChecks > 0) {
      const totalDrift = this.stats.averageDrift * (this.stats.successfulChecks - 1) + result.drift;
      this.stats.averageDrift = totalDrift / this.stats.successfulChecks;
    }
  }

  /**
   * Obtiene las estadísticas del scheduler
   */
  getStats(): TimeSchedulerStats {
    return { ...this.stats };
  }

  /**
   * Obtiene el estado del scheduler
   */
  getStatus(): {
    isRunning: boolean;
    isEnabled: boolean;
    nextCheckIn: number | null;
    config: TimeSchedulerConfig;
  } {
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
  updateConfig(newConfig: Partial<TimeSchedulerConfig>): void {
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
  resetStats(): void {
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
  async forceCheck(): Promise<TimeValidationResult> {
    this.logger.logRequest('timeSchedulerForceCheck', { message: 'Validación forzada' });
    return this.performCheck();
  }
}

// Instancia singleton para uso global
export const timeScheduler = new TimeScheduler();

// Función de conveniencia para iniciar el scheduler
export function startTimeScheduler(): void {
  timeScheduler.start();
}

// Función de conveniencia para detener el scheduler
export function stopTimeScheduler(): void {
  timeScheduler.stop();
}
