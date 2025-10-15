# 🛡️ Infraestructura Resiliente - TC-MP

**Última actualización**: 14 de Octubre, 2025  
**Versión**: 1.0.25  
**Estado**: ✅ Implementado y Documentado

---

## 🎯 Resumen

TC-MP cuenta con una **infraestructura resiliente profesional** implementada en el módulo de facturación AFIP, que incluye:

1. **Circuit Breaker**: Protección contra fallos en cascada
2. **Resilience Wrapper**: Capa completa de resiliencia (timeout, retry, circuit breaker)
3. **Configuración flexible**: Ajustable por operación
4. **Estadísticas completas**: Monitoreo detallado

---

## 📚 Conceptos de Resiliencia

### ¿Qué es Resiliencia?

**Resiliencia** es la capacidad de un sistema para:
- ✅ **Resistir** fallos temporales
- ✅ **Recuperarse** automáticamente de errores
- ✅ **Degradar** gracefully cuando algo falla
- ✅ **Proteger** recursos críticos

### Patrones Implementados

#### 1. Circuit Breaker

**Problema**: Si un servicio falla, seguir intentando puede empeorar las cosas.

**Solución**: Circuit Breaker monitorea fallos y "abre el circuito" cuando detecta un problema, evitando llamadas innecesarias.

**Estados**:
```
CLOSED (Normal) ─[threshold errores]→ OPEN (Bloqueando)
                                        │
                                        │ [timeout]
                                        ▼
                              HALF_OPEN (Probando)
                                        │
                        ┌───────────────┴───────────────┐
                        │ éxito                      fallo│
                        ▼                                 ▼
                    CLOSED                             OPEN
```

**Ejemplo**:
```typescript
// Después de 5 errores consecutivos
// Circuit breaker se ABRE
// Rechaza llamadas por 2 minutos
// Intenta 1 llamada (HALF_OPEN)
// Si falla → vuelve a OPEN
// Si funciona → vuelve a CLOSED
```

---

#### 2. Retry with Exponential Backoff

**Problema**: Errores transitorios (red, timeout) pueden resolverse reintentando.

**Solución**: Reintentar automáticamente con delays crecientes.

**Estrategia**:
```
Intento 1: inmediato
Intento 2: esperar 1s
Intento 3: esperar 2s
Intento 4: esperar 4s
...
```

**Ejemplo**:
```typescript
// Primera llamada falla por timeout
// Espera 1 segundo
// Segunda llamada falla
// Espera 2 segundos (backoff exponencial)
// Tercera llamada funciona ✅
```

---

#### 3. Timeout Management

**Problema**: Operaciones lentas pueden bloquear el sistema.

**Solución**: Establecer límites de tiempo y cancelar operaciones que excedan el timeout.

**Ejemplo**:
```typescript
// Timeout de 30 segundos
// Si la operación tarda más
// Se cancela y se lanza TimeoutError
```

---

## 🔧 Componentes

### 1. CircuitBreaker

**Ubicación**: `apps/electron/src/modules/facturacion/afip/CircuitBreaker.ts`

#### Características

- ✅ **3 estados**: CLOSED, OPEN, HALF_OPEN
- ✅ **Threshold configurable**: Número de errores antes de abrir (default: 5)
- ✅ **Timeout**: Tiempo antes de probar half-open (default: 5s)
- ✅ **Reset timeout**: Tiempo antes de reset completo (default: 2 min)
- ✅ **Estadísticas**: Total requests, failures, successes, etc.
- ✅ **Testing**: Métodos para forzar estados

#### API

##### Crear Circuit Breaker

```typescript
import { CircuitBreaker } from '@electron/modules/facturacion/afip/CircuitBreaker';
import { AfipLogger } from '@electron/modules/facturacion/afip/AfipLogger';

const circuitBreaker = new CircuitBreaker({
  threshold: 5,          // 5 errores → OPEN
  timeout: 5000,         // 5s antes de HALF_OPEN
  resetTimeout: 120000,  // 2 min antes de reset
  monitorInterval: 10000 // 10s de monitoreo
}, new AfipLogger());
```

##### Ejecutar Operación Protegida

```typescript
try {
  const result = await circuitBreaker.execute(
    async () => {
      // Tu operación aquí
      return await afipService.consultarCAE();
    },
    'consultar-cae' // Nombre de operación para logs
  );
  
  console.log('Éxito:', result);
} catch (error) {
  if (error.message.includes('Circuit breaker is OPEN')) {
    console.error('Circuito abierto, servicio temporalmente no disponible');
  } else {
    console.error('Error:', error);
  }
}
```

##### Obtener Estado

```typescript
const state = circuitBreaker.getState();
console.log('Estado actual:', state); // CLOSED | OPEN | HALF_OPEN
```

##### Obtener Estadísticas

```typescript
const stats = circuitBreaker.getStats();
console.log({
  state: stats.state,
  failureCount: stats.failureCount,
  successCount: stats.successCount,
  lastFailureTime: new Date(stats.lastFailureTime),
  totalRequests: stats.totalRequests,
  totalFailures: stats.totalFailures,
  totalSuccesses: stats.totalSuccesses
});
```

##### Testing

```typescript
// Forzar cierre (útil para tests)
circuitBreaker.forceClose();

// Forzar apertura (útil para tests)
circuitBreaker.forceOpen();

// Resetear estadísticas
circuitBreaker.resetStats();

// Verificar si está listo para half-open
const isReady = circuitBreaker.isReadyForHalfOpen();

// Tiempo restante antes del próximo intento
const timeRemaining = circuitBreaker.getTimeUntilNextAttempt();
console.log(`Próximo intento en ${timeRemaining}ms`);
```

---

### 2. ResilienceWrapper

**Ubicación**: `apps/electron/src/modules/facturacion/afip/ResilienceWrapper.ts`

#### Características

- ✅ **Timeout management**: Cancelación automática (default: 30s)
- ✅ **Retry policies**: Reintentos con backoff exponencial (default: 3)
- ✅ **Circuit breaker**: Protección contra fallos en cascada
- ✅ **Estadísticas**: Requests, successes, failures, timeouts, retries
- ✅ **Configuración flexible**: Por operación o global
- ✅ **Opciones de skip**: Circuit breaker, retries

#### API

##### Crear Resilience Wrapper

```typescript
import { ResilienceWrapper } from '@electron/modules/facturacion/afip/ResilienceWrapper';
import { AfipLogger } from '@electron/modules/facturacion/afip/AfipLogger';

const resilience = new ResilienceWrapper({
  timeout: 30000,      // 30s timeout por defecto
  retries: 3,          // 3 reintentos
  retryDelay: 1000,    // 1s base para backoff
  circuitBreaker: {
    threshold: 5,
    timeout: 5000,
    resetTimeout: 120000,
    monitorInterval: 10000
  }
}, new AfipLogger());
```

##### Ejecutar con Protección Completa

```typescript
try {
  const result = await resilience.execute(
    async () => {
      // Tu operación aquí
      return await afipService.consultarCAE();
    },
    'consultar-cae' // Nombre de operación
  );
  
  console.log('Éxito:', result);
} catch (error) {
  console.error('Error después de reintentos:', error);
}
```

##### Ejecutar con Opciones Personalizadas

```typescript
try {
  const result = await resilience.execute(
    async () => {
      return await afipService.consultarCAE();
    },
    'consultar-cae',
    {
      timeout: 10000,          // 10s timeout (override)
      retries: 5,              // 5 reintentos (override)
      retryDelay: 2000,        // 2s base (override)
      skipCircuitBreaker: false // usar circuit breaker
    }
  );
} catch (error) {
  console.error('Error:', error);
}
```

##### Variantes de Ejecución

```typescript
// Solo timeout, sin reintentos
const result1 = await resilience.executeWithoutRetry(
  async () => await apiCall(),
  'api-call'
);

// Sin circuit breaker (útil para operaciones críticas)
const result2 = await resilience.executeWithoutCircuitBreaker(
  async () => await criticalOperation(),
  'critical-op'
);

// Timeout personalizado
const result3 = await resilience.executeWithTimeout(
  async () => await slowOperation(),
  10000, // 10s
  'slow-op'
);
```

##### Estadísticas

```typescript
const stats = resilience.getStats();
console.log({
  circuitBreaker: stats.circuitBreaker, // Stats del CB
  totalRequests: stats.totalRequests,
  successfulRequests: stats.successfulRequests,
  failedRequests: stats.failedRequests,
  timeoutRequests: stats.timeoutRequests,
  retryAttempts: stats.retryAttempts
});

// Estado del circuit breaker
const cbState = resilience.getCircuitBreakerState();
console.log('Circuit breaker:', cbState);

// Estadísticas del circuit breaker
const cbStats = resilience.getCircuitBreakerStats();
console.log('CB stats:', cbStats);
```

##### Control del Circuit Breaker

```typescript
// Forzar cierre
resilience.forceCloseCircuitBreaker();

// Forzar apertura
resilience.forceOpenCircuitBreaker();

// Verificar si está listo para half-open
const isReady = resilience.isReadyForHalfOpen();

// Tiempo restante
const timeRemaining = resilience.getTimeUntilNextAttempt();
```

##### Configuración

```typescript
// Obtener configuración actual
const config = resilience.getConfig();
console.log('Config:', config);

// Actualizar configuración
resilience.updateConfig({
  timeout: 60000,  // 60s
  retries: 5       // 5 reintentos
});

// Resetear estadísticas
resilience.resetStats();
```

---

## 🎯 Casos de Uso

### Caso 1: API Externa con Timeout

**Problema**: Llamada a AFIP puede tardar mucho.

**Solución**:
```typescript
const resilience = new ResilienceWrapper({
  timeout: 30000, // 30s
  retries: 3
});

try {
  const result = await resilience.execute(
    async () => await afip.consultarPuntoVenta(),
    'consultar-pto-venta'
  );
} catch (error) {
  if (error.message.includes('Timeout')) {
    console.error('AFIP no respondió en 30 segundos');
  }
}
```

---

### Caso 2: Servicio Inestable con Reintentos

**Problema**: Servicio falla esporádicamente.

**Solución**:
```typescript
const resilience = new ResilienceWrapper({
  retries: 5,
  retryDelay: 2000 // 2s base
});

// Backoff exponencial:
// Intento 1: inmediato
// Intento 2: 2s
// Intento 3: 4s
// Intento 4: 8s
// Intento 5: 16s

try {
  const result = await resilience.execute(
    async () => await unstableService.call(),
    'unstable-call'
  );
} catch (error) {
  console.error('Falló después de 5 reintentos');
}
```

---

### Caso 3: Protección contra Fallos en Cascada

**Problema**: Servicio caído puede saturar el sistema con errores.

**Solución**:
```typescript
const resilience = new ResilienceWrapper({
  circuitBreaker: {
    threshold: 3,        // 3 errores → OPEN
    timeout: 10000,      // 10s antes de HALF_OPEN
    resetTimeout: 300000 // 5 min antes de reset
  }
});

try {
  const result = await resilience.execute(
    async () => await externalService.call(),
    'external-call'
  );
} catch (error) {
  if (error.message.includes('Circuit breaker is OPEN')) {
    console.error('Servicio temporalmente no disponible');
    // Mostrar mensaje al usuario
    // Usar caché si es posible
    // Degradar gracefully
  }
}
```

---

### Caso 4: Operación Crítica sin Circuit Breaker

**Problema**: Operación crítica que DEBE ejecutarse siempre.

**Solución**:
```typescript
const resilience = new ResilienceWrapper();

try {
  const result = await resilience.execute(
    async () => await criticalOperation(),
    'critical-op',
    {
      skipCircuitBreaker: true, // No usar CB
      retries: 10,              // Muchos reintentos
      timeout: 60000            // Timeout largo
    }
  );
} catch (error) {
  // Solo falla si realmente no se puede ejecutar
  console.error('Operación crítica falló');
}
```

---

## 📊 Monitoreo y Observabilidad

### Dashboard de Estadísticas

```typescript
function printResilienceStats(resilience: ResilienceWrapper) {
  const stats = resilience.getStats();
  const cbState = resilience.getCircuitBreakerState();
  
  console.log(`
╔══════════════════════════════════════════╗
║       Resilience Statistics              ║
╠══════════════════════════════════════════╣
║ Circuit Breaker: ${cbState.padEnd(25)}    ║
║ Total Requests:  ${stats.totalRequests}   ║
║ Successful:      ${stats.successfulRequests} ║
║ Failed:          ${stats.failedRequests}     ║
║ Timeouts:        ${stats.timeoutRequests}    ║
║ Retries:         ${stats.retryAttempts}      ║
╚══════════════════════════════════════════╝
  `);
}

// Uso
setInterval(() => {
  printResilienceStats(resilience);
}, 60000); // Cada minuto
```

---

### Alertas

```typescript
function setupResilienceAlerts(resilience: ResilienceWrapper) {
  setInterval(() => {
    const stats = resilience.getStats();
    const cbState = resilience.getCircuitBreakerState();
    
    // Alerta si circuit breaker está abierto
    if (cbState === 'OPEN') {
      console.warn('🚨 ALERT: Circuit breaker is OPEN');
      // Enviar notificación
      // Registrar en logs
    }
    
    // Alerta si tasa de error > 50%
    const errorRate = stats.failedRequests / stats.totalRequests;
    if (errorRate > 0.5) {
      console.warn(`🚨 ALERT: High error rate: ${(errorRate * 100).toFixed(2)}%`);
    }
    
    // Alerta si muchos timeouts
    const timeoutRate = stats.timeoutRequests / stats.totalRequests;
    if (timeoutRate > 0.3) {
      console.warn(`🚨 ALERT: High timeout rate: ${(timeoutRate * 100).toFixed(2)}%`);
    }
  }, 30000); // Cada 30 segundos
}
```

---

## 🎯 Mejores Prácticas

### ✅ HACER

1. **Usar ResilienceWrapper para APIs externas**
   ```typescript
   // ✅ Bueno
   const resilience = new ResilienceWrapper();
   await resilience.execute(() => externalAPI.call(), 'api-call');
   ```

2. **Configurar timeouts apropiados**
   ```typescript
   // ✅ Bueno
   {
     timeout: 30000,  // 30s para API lenta
     timeout: 5000,   // 5s para API rápida
   }
   ```

3. **Nombrar operaciones descriptivamente**
   ```typescript
   // ✅ Bueno
   await resilience.execute(() => call(), 'afip-consultar-cae');
   await resilience.execute(() => call(), 'mp-buscar-pagos');
   ```

4. **Manejar errores específicos**
   ```typescript
   // ✅ Bueno
   try {
     await resilience.execute(() => call(), 'op');
   } catch (error) {
     if (error.message.includes('Circuit breaker is OPEN')) {
       // Degradar gracefully
     } else if (error.message.includes('Timeout')) {
       // Mostrar mensaje de timeout
     } else {
       // Error genérico
     }
   }
   ```

5. **Monitorear estadísticas**
   ```typescript
   // ✅ Bueno
   setInterval(() => {
     const stats = resilience.getStats();
     logger.info('Resilience stats', stats);
   }, 60000);
   ```

---

### ❌ NO HACER

1. **No usar para operaciones locales**
   ```typescript
   // ❌ Malo (operación local no necesita resiliencia)
   await resilience.execute(() => fs.readFileSync('file.txt'), 'read-file');
   ```

2. **No configurar timeouts muy cortos**
   ```typescript
   // ❌ Malo (1s es muy poco para API externa)
   resilience.updateConfig({ timeout: 1000 });
   ```

3. **No ignorar circuit breaker abierto**
   ```typescript
   // ❌ Malo
   try {
     await resilience.execute(() => call(), 'op');
   } catch (error) {
     // Ignora error y reintenta inmediatamente
     await resilience.execute(() => call(), 'op');
   }
   ```

4. **No abusar de skip circuit breaker**
   ```typescript
   // ❌ Malo (deshabilita protección)
   await resilience.execute(() => call(), 'op', {
     skipCircuitBreaker: true  // Solo para ops críticas
   });
   ```

---

## 🐛 Troubleshooting

### Problema: Circuit Breaker siempre OPEN

**Síntoma**: Todas las llamadas fallan con "Circuit breaker is OPEN"

**Causas posibles**:
1. Servicio externo realmente caído
2. Threshold muy bajo
3. Timeout muy corto

**Solución**:
```typescript
// 1. Verificar servicio externo
const stats = resilience.getCircuitBreakerStats();
console.log('Últimos errores:', stats);

// 2. Ajustar threshold
resilience.updateConfig({
  circuitBreaker: {
    threshold: 10 // Aumentar umbral
  }
});

// 3. Forzar cierre para testing
resilience.forceCloseCircuitBreaker();
```

---

### Problema: Muchos Timeouts

**Síntoma**: Alta tasa de errores por timeout

**Causas posibles**:
1. Timeout muy corto
2. Servicio externo lento
3. Red lenta

**Solución**:
```typescript
// Aumentar timeout
resilience.updateConfig({
  timeout: 60000 // 60s
});

// O usar timeout personalizado
await resilience.executeWithTimeout(
  () => slowCall(),
  60000,
  'slow-call'
);
```

---

### Problema: Reintentos excesivos

**Síntoma**: Operación tarda mucho debido a reintentos

**Causas posibles**:
1. Demasiados reintentos
2. Delay muy largo

**Solución**:
```typescript
// Reducir reintentos
resilience.updateConfig({
  retries: 1,
  retryDelay: 500
});

// O ejecutar sin reintentos
await resilience.executeWithoutRetry(() => call(), 'op');
```

---

## 📈 Migración a Resiliencia

### Servicios Candidatos

#### Alta Prioridad
1. **MercadoPagoService**: API externa, puede fallar
2. **GaliciaService**: API bancaria, crítica
3. **EmailService**: SMTP puede ser lento

#### Media Prioridad
4. **FtpService**: Conexiones de red
5. **BnaService**: Scraping web inestable
6. **A13FilesService**: Descarga de archivos

---

### Template de Migración

**Antes** (sin resiliencia):
```typescript
async function buscarPagos(config: any) {
  const response = await fetch(config.url, {
    headers: { 'Authorization': `Bearer ${config.token}` }
  });
  return await response.json();
}
```

**Después** (con resiliencia):
```typescript
import { ResilienceWrapper } from '@electron/modules/facturacion/afip/ResilienceWrapper';

const resilience = new ResilienceWrapper({
  timeout: 30000,
  retries: 3,
  retryDelay: 1000
});

async function buscarPagos(config: any) {
  return await resilience.execute(
    async () => {
      const response = await fetch(config.url, {
        headers: { 'Authorization': `Bearer ${config.token}` }
      });
      return await response.json();
    },
    'mp-buscar-pagos'
  );
}
```

---

## 📚 Referencias

- [Circuit Breaker Pattern (Martin Fowler)](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Retry Pattern (Microsoft)](https://learn.microsoft.com/en-us/azure/architecture/patterns/retry)
- [Timeout Pattern](https://en.wikipedia.org/wiki/Timeout_(computing))

---

**Mantenido por**: Equipo de desarrollo TC-MP  
**Última revisión**: Fase 7 - Infraestructura Resiliente  
**Próxima revisión**: Fase 8 - Aplicar a más servicios

