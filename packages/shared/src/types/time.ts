/**
 * @package @shared/types/time
 * @description Tipos para validación de tiempo y sincronización NTP
 */

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

