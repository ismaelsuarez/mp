import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

export interface AfipEnvConfig {
  // Configuración por defecto para homologación
  AFIP_HOMOLOGACION_CUIT: string;
  AFIP_HOMOLOGACION_PTO_VTA: number;
  AFIP_HOMOLOGACION_CERT_PATH: string;
  AFIP_HOMOLOGACION_KEY_PATH: string;
  
  // Configuración por defecto para producción
  AFIP_PRODUCCION_CUIT: string;
  AFIP_PRODUCCION_PTO_VTA: number;
  AFIP_PRODUCCION_CERT_PATH: string;
  AFIP_PRODUCCION_KEY_PATH: string;
  
  // Configuración general
  AFIP_DEFAULT_ENTORNO: 'homologacion' | 'produccion';
  AFIP_LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  AFIP_TIMEOUT: number;
  AFIP_RETRY_ATTEMPTS: number;
  
  // Configuración de resiliencia
  AFIP_RESILIENCE_TIMEOUT: number;
  AFIP_RESILIENCE_RETRIES: number;
  AFIP_RESILIENCE_RETRY_DELAY: number;
  AFIP_RESILIENCE_CIRCUIT_BREAKER_THRESHOLD: number;
  AFIP_RESILIENCE_CIRCUIT_BREAKER_TIMEOUT: number;
  AFIP_RESILIENCE_CIRCUIT_BREAKER_RESET_TIMEOUT: number;
}

export const afipEnvConfig: AfipEnvConfig = {
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
  AFIP_DEFAULT_ENTORNO: (process.env.AFIP_DEFAULT_ENTORNO as 'homologacion' | 'produccion') || 'homologacion',
  AFIP_LOG_LEVEL: (process.env.AFIP_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
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
export function getDefaultConfig(entorno: 'homologacion' | 'produccion') {
  if (entorno === 'homologacion') {
    return {
      cuit: afipEnvConfig.AFIP_HOMOLOGACION_CUIT,
      pto_vta: afipEnvConfig.AFIP_HOMOLOGACION_PTO_VTA,
      cert_path: afipEnvConfig.AFIP_HOMOLOGACION_CERT_PATH,
      key_path: afipEnvConfig.AFIP_HOMOLOGACION_KEY_PATH,
      entorno: 'homologacion' as const
    };
  } else {
    return {
      cuit: afipEnvConfig.AFIP_PRODUCCION_CUIT,
      pto_vta: afipEnvConfig.AFIP_PRODUCCION_PTO_VTA,
      cert_path: afipEnvConfig.AFIP_PRODUCCION_CERT_PATH,
      key_path: afipEnvConfig.AFIP_PRODUCCION_KEY_PATH,
      entorno: 'produccion' as const
    };
  }
}

/**
 * Obtiene la configuración de resiliencia
 */
export function getResilienceConfig() {
  return {
    timeout: afipEnvConfig.AFIP_RESILIENCE_TIMEOUT,
    retries: afipEnvConfig.AFIP_RESILIENCE_RETRIES,
    retryDelay: afipEnvConfig.AFIP_RESILIENCE_RETRY_DELAY,
    circuitBreaker: {
      threshold: afipEnvConfig.AFIP_RESILIENCE_CIRCUIT_BREAKER_THRESHOLD,
      timeout: afipEnvConfig.AFIP_RESILIENCE_CIRCUIT_BREAKER_TIMEOUT,
      resetTimeout: afipEnvConfig.AFIP_RESILIENCE_CIRCUIT_BREAKER_RESET_TIMEOUT,
      monitorInterval: 10000
    }
  };
}

/**
 * Valida que la configuración de entorno esté completa
 */
export function validateEnvConfig(): string[] {
  const errors: string[] = [];
  
  // Validar configuración de homologación
  if (!afipEnvConfig.AFIP_HOMOLOGACION_CUIT) {
    errors.push('AFIP_HOMOLOGACION_CUIT no configurado');
  }
  if (!afipEnvConfig.AFIP_HOMOLOGACION_CERT_PATH) {
    errors.push('AFIP_HOMOLOGACION_CERT_PATH no configurado');
  }
  if (!afipEnvConfig.AFIP_HOMOLOGACION_KEY_PATH) {
    errors.push('AFIP_HOMOLOGACION_KEY_PATH no configurado');
  }
  
  return errors;
}
