# Fase 4: Infraestructura Resiliente (HTTP + Logger + Errores)

**Estado**: ⏳ PENDIENTE (después de Fase 3)

**Duración estimada**: 1 semana

**Rama**: `refactor/resilient-infra`

## Objetivo

Implementar capa de infraestructura resiliente con: HTTP con timeout/retries/jitter/circuit-breaker, logger con redacción de PII y correlation-id, y manejador de errores centralizado.

## Principio Fundamental

> "Fallos transitorios no deben romper el flujo. Timeout, retries, circuit-breaker. Logs trazables sin exponer datos sensibles."

## Tareas Detalladas

### 1. HTTP Resiliente

#### 1.1 Instalar dependencias

```bash
pnpm add axios p-retry opossum
pnpm add -D @types/opossum
```

#### 1.2 packages/infra/src/http/ResilientHttp.ts

```typescript
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import pRetry from 'p-retry';
import CircuitBreaker from 'opossum';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';

export interface HttpClientConfig {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  circuitBreaker?: CircuitBreakerConfig;
}

export interface CircuitBreakerConfig {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
}

export class ResilientHttp {
  private axios: AxiosInstance;
  private config: Required<HttpClientConfig>;
  private breakers: Map<string, CircuitBreaker>;
  
  constructor(config: HttpClientConfig = {}) {
    this.config = {
      baseURL: config.baseURL || '',
      timeout: config.timeout || 10000, // 10s default
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
      circuitBreaker: config.circuitBreaker || {
        timeout: 5000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000
      }
    };
    
    this.axios = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout
    });
    
    this.breakers = new Map();
    this.setupInterceptors();
  }
  
  private setupInterceptors() {
    // Request interceptor: add correlation-id
    this.axios.interceptors.request.use(
      (config) => {
        const correlationId = uuidv4();
        config.headers['X-Correlation-ID'] = correlationId;
        config.headers['X-Request-ID'] = correlationId;
        
        logger.debug('HTTP Request', {
          correlationId,
          method: config.method?.toUpperCase(),
          url: config.url,
          // NO logear body completo (puede tener datos sensibles)
        });
        
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Response interceptor: log response
    this.axios.interceptors.response.use(
      (response) => {
        const correlationId = response.config.headers['X-Correlation-ID'];
        
        logger.debug('HTTP Response', {
          correlationId,
          status: response.status,
          url: response.config.url
        });
        
        return response;
      },
      (error) => {
        const correlationId = error.config?.headers['X-Correlation-ID'];
        
        logger.error('HTTP Error', {
          correlationId,
          status: error.response?.status,
          url: error.config?.url,
          message: error.message
        });
        
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * GET con retries y circuit breaker
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.requestWithRetry(() => this.axios.get<T>(url, config));
  }
  
  /**
   * POST con retries y circuit breaker
   * NOTA: POST idempotente requiere Idempotency-Key en headers
   */
  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    // Agregar Idempotency-Key si no existe
    const headers = {
      ...config?.headers,
      'Idempotency-Key': config?.headers?.['Idempotency-Key'] || uuidv4()
    };
    
    return this.requestWithRetry(
      () => this.axios.post<T>(url, data, { ...config, headers }),
      { idempotent: true } // Solo reintentar si es idempotente
    );
  }
  
  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.requestWithRetry(() => this.axios.put<T>(url, data, config));
  }
  
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.requestWithRetry(() => this.axios.delete<T>(url, config));
  }
  
  /**
   * Ejecutar request con retries exponenciales + jitter
   */
  private async requestWithRetry<T>(
    requestFn: () => Promise<T>,
    options: { idempotent?: boolean } = {}
  ): Promise<T> {
    return pRetry(
      async () => {
        try {
          return await requestFn();
        } catch (error: any) {
          // No reintentar errores 4xx (excepto 429 - rate limit)
          if (error.response?.status >= 400 && error.response?.status < 500) {
            if (error.response.status !== 429) {
              throw new pRetry.AbortError(error);
            }
          }
          
          throw error;
        }
      },
      {
        retries: this.config.retries,
        factor: 2, // Exponential backoff
        minTimeout: this.config.retryDelay,
        maxTimeout: this.config.retryDelay * 10,
        randomize: true, // Jitter
        onFailedAttempt: (error) => {
          logger.warn('HTTP Retry', {
            attempt: error.attemptNumber,
            retriesLeft: error.retriesLeft,
            message: error.message
          });
        }
      }
    );
  }
  
  /**
   * Obtener o crear circuit breaker para un endpoint
   */
  private getCircuitBreaker(key: string, requestFn: Function): CircuitBreaker {
    if (!this.breakers.has(key)) {
      const breaker = new CircuitBreaker(requestFn, {
        timeout: this.config.circuitBreaker.timeout,
        errorThresholdPercentage: this.config.circuitBreaker.errorThresholdPercentage,
        resetTimeout: this.config.circuitBreaker.resetTimeout
      });
      
      // Events logging
      breaker.on('open', () => {
        logger.warn('Circuit Breaker OPEN', { endpoint: key });
      });
      
      breaker.on('halfOpen', () => {
        logger.info('Circuit Breaker HALF-OPEN', { endpoint: key });
      });
      
      breaker.on('close', () => {
        logger.info('Circuit Breaker CLOSED', { endpoint: key });
      });
      
      this.breakers.set(key, breaker);
    }
    
    return this.breakers.get(key)!;
  }
  
  /**
   * Request con circuit breaker explícito
   */
  async requestWithCircuitBreaker<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const breaker = this.getCircuitBreaker(key, requestFn);
    return breaker.fire();
  }
}

// Instancias pre-configuradas
export const httpClient = new ResilientHttp({
  timeout: 10000,
  retries: 3
});

export const afipClient = new ResilientHttp({
  baseURL: process.env.AFIP_BASE_URL,
  timeout: 15000, // AFIP puede ser más lento
  retries: 5
});

export const mpClient = new ResilientHttp({
  baseURL: 'https://api.mercadopago.com',
  timeout: 10000,
  retries: 3
});
```

#### 1.3 Migrar código existente

**Antes**:
```typescript
const response = await axios.get('https://api.example.com/data');
```

**Después**:
```typescript
import { httpClient } from '@infra/http';

const response = await httpClient.get('/data');
```

### 2. Logger con Redacción

#### 2.1 Instalar dependencias

```bash
pnpm add pino pino-pretty
```

#### 2.2 packages/infra/src/logger/Logger.ts

```typescript
import pino from 'pino';
import path from 'path';
import { app } from 'electron';

// Campos sensibles a redactar
const REDACTED_FIELDS = [
  'password',
  'token',
  'accessToken',
  'access_token',
  'apiKey',
  'api_key',
  'secret',
  'cuit',
  'dni',
  'email',
  'creditCard',
  'card_number',
  'cvv',
  'cert',
  'certificate',
  'privateKey',
  'private_key'
];

// Función de redacción
function redactor() {
  return {
    paths: REDACTED_FIELDS,
    censor: '[REDACTED]'
  };
}

// Crear logger
const isDev = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  
  // Redacción de campos sensibles
  redact: redactor(),
  
  // Serializers personalizados
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      // NO incluir headers (pueden tener tokens)
    }),
    res: (res) => ({
      statusCode: res.statusCode
    })
  },
  
  // Formato en desarrollo
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname'
    }
  } : undefined,
  
  // Base log object
  base: {
    pid: process.pid,
    app: 'tc-mp'
  }
});

// File transport para producción
if (!isDev) {
  const logDir = path.join(app.getPath('userData'), 'logs');
  // TODO: Implementar file transport con rotación
}

/**
 * Logger con correlation-id
 */
export class CorrelatedLogger {
  constructor(private correlationId?: string) {}
  
  private addCorrelationId(obj: any) {
    if (this.correlationId) {
      return { ...obj, correlationId: this.correlationId };
    }
    return obj;
  }
  
  debug(message: string, meta?: any) {
    logger.debug(this.addCorrelationId(meta), message);
  }
  
  info(message: string, meta?: any) {
    logger.info(this.addCorrelationId(meta), message);
  }
  
  warn(message: string, meta?: any) {
    logger.warn(this.addCorrelationId(meta), message);
  }
  
  error(message: string, error?: Error, meta?: any) {
    logger.error(this.addCorrelationId({ ...meta, err: error }), message);
  }
}

export function createLogger(correlationId?: string): CorrelatedLogger {
  return new CorrelatedLogger(correlationId);
}
```

#### 2.3 Reemplazar console.log

**Script de búsqueda**:
```bash
# Buscar todos los console.log
pnpm exec grep -r "console\\.log" src/ --exclude-dir=node_modules
```

**Reemplazar**:
```typescript
// Antes
console.log('Processing file:', filename);

// Después
import { logger } from '@infra/logger';
logger.info('Processing file', { filename });
```

**Regla ESLint** (agregar en Fase 8):
```json
{
  "rules": {
    "no-console": ["error", { "allow": ["warn", "error"] }]
  }
}
```

### 3. Manejador de Errores Centralizado

#### 3.1 packages/infra/src/errors/ErrorHandler.ts

```typescript
import { logger } from '../logger';

/**
 * Errores de aplicación con códigos
 */
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Errores específicos
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 400, true, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404, true);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401, true);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: Error) {
    super(
      'EXTERNAL_SERVICE_ERROR',
      `Error communicating with ${service}`,
      502,
      true,
      { originalError: originalError?.message }
    );
  }
}

export class AfipError extends ExternalServiceError {
  constructor(originalError?: Error) {
    super('AFIP', originalError);
  }
}

export class MercadoPagoError extends ExternalServiceError {
  constructor(originalError?: Error) {
    super('MercadoPago', originalError);
  }
}

/**
 * Error Handler global
 */
export class ErrorHandler {
  /**
   * Manejar error de forma centralizada
   */
  static handle(error: Error | AppError, correlationId?: string): void {
    if (error instanceof AppError) {
      // Error conocido/operacional
      logger.error('Operational Error', error, {
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
        correlationId
      });
      
      // Si no es operacional, es un bug
      if (!error.isOperational) {
        this.handleCriticalError(error);
      }
    } else {
      // Error desconocido - puede ser bug
      logger.error('Unexpected Error', error, {
        correlationId
      });
      
      this.handleCriticalError(error);
    }
  }
  
  /**
   * Error crítico - puede requerir reinicio
   */
  private static handleCriticalError(error: Error): void {
    logger.fatal('Critical Error - Application may be unstable', { err: error });
    
    // TODO: Implementar notificación/alertas
    // TODO: Considerar reinicio graceful si es necesario
  }
  
  /**
   * Mapear error a código HTTP (para API REST en Fase 6)
   */
  static toHttpStatus(error: Error | AppError): number {
    if (error instanceof AppError) {
      return error.statusCode;
    }
    
    // Error desconocido = 500
    return 500;
  }
  
  /**
   * Mapear error a respuesta de usuario
   */
  static toUserMessage(error: Error | AppError): string {
    if (error instanceof AppError) {
      return error.message;
    }
    
    // No exponer detalles de errores inesperados
    return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Wrapper para manejo de errores async
 */
export function catchErrors(fn: Function) {
  return async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      ErrorHandler.handle(error as Error);
      throw error;
    }
  };
}
```

#### 3.2 Uso en servicios

```typescript
import { AfipError, catchErrors, logger } from '@infra';

export class AfipService {
  @catchErrors
  async autenticar(): Promise<void> {
    try {
      // Lógica de autenticación
      const response = await afipClient.post('/auth', data);
      logger.info('AFIP authentication successful');
    } catch (error) {
      throw new AfipError(error as Error);
    }
  }
}
```

### 4. Integración con Servicios Existentes

#### 4.1 Migrar AFIP

```typescript
// Antes
import axios from 'axios';

const response = await axios.post(AFIP_URL, data);

// Después
import { afipClient } from '@infra/http';
import { logger } from '@infra/logger';
import { AfipError } from '@infra/errors';

try {
  const response = await afipClient.post('/wsfev1', data);
  logger.info('AFIP request successful');
} catch (error) {
  throw new AfipError(error as Error);
}
```

#### 4.2 Migrar Mercado Pago

Similar a AFIP, usar `mpClient`.

### 5. Monitoring y Observabilidad

#### 5.1 Métricas (opcional en Fase 4, completo en Fase 6)

```typescript
// packages/infra/src/monitoring/Metrics.ts

export class Metrics {
  private counters: Map<string, number> = new Map();
  private timings: Map<string, number[]> = new Map();
  
  increment(key: string, value: number = 1): void {
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }
  
  timing(key: string, duration: number): void {
    const timings = this.timings.get(key) || [];
    timings.push(duration);
    this.timings.set(key, timings);
  }
  
  getMetrics() {
    return {
      counters: Object.fromEntries(this.counters),
      timings: Object.fromEntries(this.timings)
    };
  }
}

export const metrics = new Metrics();
```

## Checklist de Aceptación

- [ ] ResilientHttp implementado con timeout/retries/jitter/circuit-breaker
- [ ] Logger con pino + redacción de campos sensibles
- [ ] Correlation-id en todas las requests HTTP
- [ ] ErrorHandler centralizado con tipos de errores
- [ ] console.log reemplazados por logger (al menos en código crítico)
- [ ] Servicios AFIP/MP migrados a usar nueva infra
- [ ] Tests de resiliencia (timeouts, retries) funcionando
- [ ] Logs no contienen datos sensibles (verificado)
- [ ] **Funcionalidad sin cambios**

## Testing de Resiliencia

```typescript
// packages/infra/src/http/__tests__/ResilientHttp.test.ts

describe('ResilientHttp', () => {
  it('should retry on network error', async () => {
    // Mock que falla 2 veces, luego éxito
    // Verificar que reintenta y eventualmente tiene éxito
  });
  
  it('should not retry on 4xx errors', async () => {
    // Mock que retorna 400
    // Verificar que NO reintenta
  });
  
  it('should open circuit breaker after threshold', async () => {
    // Mock que falla repetidamente
    // Verificar que circuit breaker se abre
  });
});
```

## Próxima Fase

**[Fase 5: Watchers Robustos](./FASE_05_watchers_robustos.md)** - Watchers a prueba de fallos con cola y dedupe.

---

**Última actualización**: Octubre 2025

