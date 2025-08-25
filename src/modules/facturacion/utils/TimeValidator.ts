import ntpClient from 'ntp-client';
import { AfipLogger } from '../afip/AfipLogger';

export interface TimeValidationResult {
  isValid: boolean;
  drift: number;
  systemTime: Date;
  ntpTime: Date;
  duration?: number; // Duración de la validación en ms
  error?: string;
  warning?: string;
}

export interface NTPConfig {
  server: string;
  port: number;
  allowedDrift: number; // en ms
  timeout: number; // en ms
}

export class TimeValidator {
  private logger: AfipLogger;
  private config: NTPConfig;
  private lastValidation: TimeValidationResult | null = null;
  private validationCount = 0;
  private totalDrift = 0;

  constructor(config?: Partial<NTPConfig>) {
    this.logger = new AfipLogger();
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
  async validateSystemTime(): Promise<TimeValidationResult> {
    const startTime = Date.now();
    
    try {
      this.logger.logRequest('validateSystemTime', {
        server: this.config.server,
        port: this.config.port,
        allowedDrift: this.config.allowedDrift
      });

      const result = await this.queryNTP();
      
      // Agregar duración al resultado
      result.duration = Date.now() - startTime;
      
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

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.logError('validateSystemTime', error instanceof Error ? error : new Error(errorMessage), {
        server: this.config.server,
        port: this.config.port
      });

      // En caso de error de NTP, no bloquear pero generar warning
      const systemTime = new Date();
      const result: TimeValidationResult = {
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
  private queryNTP(): Promise<TimeValidationResult> {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout consultando servidor NTP'));
      }, this.config.timeout);

      ntpClient.getNetworkTime(this.config.server, this.config.port, (err, ntpTime) => {
        clearTimeout(timeout);
        
        if (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          reject(new Error(`Error consultando NTP: ${errorMessage}`));
          return;
        }

        const systemTime = new Date();
        const drift = Math.abs(systemTime.getTime() - ntpTime.getTime());

        const result: TimeValidationResult = {
          isValid: drift <= this.config.allowedDrift,
          drift,
          systemTime,
          ntpTime,
          duration: Date.now() - startTime
        };

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
  async validateAndThrow(): Promise<void> {
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
  getAverageDrift(): number {
    return this.validationCount > 0 ? this.totalDrift / this.validationCount : 0;
  }

  /**
   * Obtiene estadísticas de validación
   */
  getStats(): {
    totalValidations: number;
    averageDrift: number;
    lastValidation: TimeValidationResult | null;
    config: NTPConfig;
  } {
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
  resetStats(): void {
    this.validationCount = 0;
    this.totalDrift = 0;
    this.lastValidation = null;
  }

  /**
   * Actualiza la configuración
   */
  updateConfig(newConfig: Partial<NTPConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.logRequest('timeValidatorConfigUpdated', { newConfig });
  }

  /**
   * Obtiene el estado actual del validador
   */
  getStatus(): {
    isConfigured: boolean;
    lastValidationTime: Date | null;
    isLastValidationValid: boolean;
    lastDrift: number;
  } {
    return {
      isConfigured: !!this.config.server,
      lastValidationTime: this.lastValidation ? this.lastValidation.systemTime : null,
      isLastValidationValid: this.lastValidation?.isValid ?? false,
      lastDrift: this.lastValidation?.drift ?? 0
    };
  }
}

// Instancia singleton para uso global
export const timeValidator = new TimeValidator();

// Función de conveniencia para validación rápida
export async function validateSystemTime(): Promise<TimeValidationResult> {
  return timeValidator.validateSystemTime();
}

// Función de conveniencia para validación con error
export async function validateSystemTimeAndThrow(): Promise<void> {
  return timeValidator.validateAndThrow();
}
