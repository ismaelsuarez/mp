# Configuración de Resiliencia AFIP
## Timeouts, Reintentos y Circuit Breaker

**Versión:** 1.0.0  
**Fecha:** 2024-12-19  
**Implementado por:** Claude Sonnet 4  

---

## 📋 Índice

1. [Descripción General](#descripción-general)
2. [Configuración](#configuración)
3. [Variables de Entorno](#variables-de-entorno)
4. [Funcionalidades](#funcionalidades)
5. [Casos de Uso](#casos-de-uso)
6. [Monitoreo](#monitoreo)
7. [Troubleshooting](#troubleshooting)
8. [Ejemplos](#ejemplos)

---

## 🎯 Descripción General

El sistema de resiliencia implementado en el módulo de facturación AFIP proporciona protección contra fallos de red, timeouts y saturación del sistema mediante tres mecanismos principales:

### ✅ **Timeouts Configurables**
- Controla el tiempo máximo de espera para cada llamada a AFIP
- Evita bloqueos indefinidos del sistema
- Configurable por operación

### ✅ **Reintentos con Backoff Exponencial**
- Reintenta automáticamente en caso de fallos temporales
- Backoff exponencial: 1s, 2s, 4s, 8s...
- Solo reintenta en errores de red o timeout

### ✅ **Circuit Breaker**
- Protege contra saturación cuando AFIP no responde
- Estados: CLOSED → OPEN → HALF-OPEN → CLOSED
- Evita cascada de fallos

---

## ⚙️ Configuración

### Variables de Entorno

```bash
# Timeouts
AFIP_RESILIENCE_TIMEOUT=30000                    # 30 segundos por defecto

# Reintentos
AFIP_RESILIENCE_RETRIES=3                        # 3 reintentos por defecto
AFIP_RESILIENCE_RETRY_DELAY=1000                 # 1 segundo base

# Circuit Breaker
AFIP_RESILIENCE_CIRCUIT_BREAKER_THRESHOLD=5      # 5 errores consecutivos
AFIP_RESILIENCE_CIRCUIT_BREAKER_TIMEOUT=5000     # 5 segundos antes de half-open
AFIP_RESILIENCE_CIRCUIT_BREAKER_RESET_TIMEOUT=120000  # 2 minutos antes de reset
```

### Configuración por Ambiente

#### Homologación
```bash
# Timeouts más cortos para pruebas
AFIP_RESILIENCE_TIMEOUT=15000
AFIP_RESILIENCE_RETRIES=2
AFIP_RESILIENCE_CIRCUIT_BREAKER_THRESHOLD=3
```

#### Producción
```bash
# Timeouts más largos para estabilidad
AFIP_RESILIENCE_TIMEOUT=45000
AFIP_RESILIENCE_RETRIES=3
AFIP_RESILIENCE_CIRCUIT_BREAKER_THRESHOLD=5
```

---

## 🔧 Funcionalidades

### 1. **ResilienceWrapper**

Clase principal que combina todos los mecanismos de resiliencia:

```typescript
import { ResilienceWrapper } from './afip/ResilienceWrapper';

const resilience = new ResilienceWrapper({
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  circuitBreaker: {
    threshold: 5,
    timeout: 5000,
    resetTimeout: 120000
  }
});

// Ejecutar con protección completa
const result = await resilience.execute(
  () => afipService.someOperation(),
  'operationName'
);
```

### 2. **CircuitBreaker**

Maneja los estados del circuito:

```typescript
import { CircuitBreaker, CircuitState } from './afip/CircuitBreaker';

const breaker = new CircuitBreaker({
  threshold: 5,
  timeout: 5000,
  resetTimeout: 120000
});

// Estados disponibles
CircuitState.CLOSED      // Funcionamiento normal
CircuitState.OPEN        // Circuito abierto, rechaza llamadas
CircuitState.HALF_OPEN   // Prueba una llamada
```

### 3. **Métodos de Ejecución**

```typescript
// Ejecución completa (timeout + retry + circuit breaker)
await resilience.execute(fn, 'operation');

// Solo timeout
await resilience.executeWithTimeout(fn, 15000, 'operation');

// Sin reintentos
await resilience.executeWithoutRetry(fn, 'operation');

// Sin circuit breaker
await resilience.executeWithoutCircuitBreaker(fn, 'operation');
```

---

## 📊 Casos de Uso

### 1. **AFIP Lento (Timeout)**
```typescript
// Configuración
AFIP_RESILIENCE_TIMEOUT=30000

// Comportamiento
// 1. Intenta llamada a AFIP
// 2. Si no responde en 30s → timeout
// 3. Reintenta con backoff: 1s, 2s, 4s
// 4. Si todos fallan → error final
```

### 2. **AFIP No Responde (Circuit Breaker)**
```typescript
// Configuración
AFIP_RESILIENCE_CIRCUIT_BREAKER_THRESHOLD=5

// Comportamiento
// 1. 5 errores consecutivos → circuito abierto
// 2. Rechaza todas las llamadas inmediatamente
// 3. Después de 5s → half-open
// 4. Si éxito → cerrado, si falla → abierto
```

### 3. **Error de Red Temporal**
```typescript
// Configuración
AFIP_RESILIENCE_RETRIES=3
AFIP_RESILIENCE_RETRY_DELAY=1000

// Comportamiento
// 1. Error de red → reintenta en 1s
// 2. Si falla → reintenta en 2s
// 3. Si falla → reintenta en 4s
// 4. Si falla → error final
```

---

## 📈 Monitoreo

### 1. **Estadísticas de Resiliencia**

```typescript
const stats = afipService.getResilienceStats();
console.log(stats);
// {
//   circuitBreaker: { state: 'CLOSED', failureCount: 0, ... },
//   totalRequests: 150,
//   successfulRequests: 145,
//   failedRequests: 5,
//   timeoutRequests: 2,
//   retryAttempts: 8
// }
```

### 2. **Estado del Circuit Breaker**

```typescript
const state = afipService.getCircuitBreakerState();
console.log(state); // 'CLOSED' | 'OPEN' | 'HALF_OPEN'

const breakerStats = afipService.getCircuitBreakerStats();
console.log(breakerStats);
// {
//   state: 'CLOSED',
//   failureCount: 0,
//   successCount: 145,
//   lastFailureTime: 0,
//   lastSuccessTime: 1703000000000,
//   totalRequests: 150,
//   totalFailures: 5,
//   totalSuccesses: 145
// }
```

### 3. **Tiempo hasta Próximo Intento**

```typescript
const timeUntilNext = afipService.getTimeUntilNextAttempt();
console.log(`Próximo intento en: ${timeUntilNext}ms`);

const isReady = afipService.isReadyForHalfOpen();
console.log(`Listo para half-open: ${isReady}`);
```

### 4. **Logs de Resiliencia**

Los logs incluyen información detallada:

```json
{
  "timestamp": "2024-12-19T10:30:00.000Z",
  "level": "info",
  "operation": "resilience_success",
  "data": {
    "operation": "createVoucher",
    "totalRequests": 150
  }
}
```

---

## 🔧 Troubleshooting

### 1. **Circuit Breaker Siempre Abierto**

**Síntomas:**
- Todas las llamadas fallan inmediatamente
- Mensaje: "Circuit breaker is OPEN"

**Solución:**
```typescript
// Forzar cierre del circuit breaker
afipService.forceCloseCircuitBreaker();

// Verificar estado
const state = afipService.getCircuitBreakerState();
console.log(state); // Debería ser 'CLOSED'
```

### 2. **Timeouts Muy Frecuentes**

**Síntomas:**
- Muchos errores de timeout
- Operaciones lentas

**Solución:**
```bash
# Aumentar timeout
AFIP_RESILIENCE_TIMEOUT=45000  # 45 segundos

# Reducir reintentos
AFIP_RESILIENCE_RETRIES=2
```

### 3. **Reintentos Excesivos**

**Síntomas:**
- Muchos reintentos
- Operaciones muy lentas

**Solución:**
```bash
# Reducir reintentos
AFIP_RESILIENCE_RETRIES=2

# Aumentar delay
AFIP_RESILIENCE_RETRY_DELAY=2000  # 2 segundos
```

### 4. **Circuit Breaker Muy Sensible**

**Síntomas:**
- Circuit breaker se abre con pocos errores
- Muchos falsos positivos

**Solución:**
```bash
# Aumentar umbral
AFIP_RESILIENCE_CIRCUIT_BREAKER_THRESHOLD=10

# Aumentar timeout
AFIP_RESILIENCE_CIRCUIT_BREAKER_TIMEOUT=10000
```

---

## 💡 Ejemplos

### 1. **Configuración Personalizada**

```typescript
import { ResilienceWrapper } from './afip/ResilienceWrapper';

const customResilience = new ResilienceWrapper({
  timeout: 45000,        // 45 segundos
  retries: 2,            // 2 reintentos
  retryDelay: 2000,      // 2 segundos base
  circuitBreaker: {
    threshold: 10,       // 10 errores consecutivos
    timeout: 10000,      // 10 segundos
    resetTimeout: 300000 // 5 minutos
  }
});

// Usar configuración personalizada
const result = await customResilience.execute(
  () => afipService.solicitarCAE(comprobante),
  'solicitarCAE'
);
```

### 2. **Monitoreo en Tiempo Real**

```typescript
// Función para monitorear estado
function monitorResilience() {
  const stats = afipService.getResilienceStats();
  const breakerState = afipService.getCircuitBreakerState();
  
  console.log('=== Estado de Resiliencia ===');
  console.log(`Circuit Breaker: ${breakerState}`);
  console.log(`Total Requests: ${stats.totalRequests}`);
  console.log(`Success Rate: ${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2)}%`);
  console.log(`Retry Rate: ${((stats.retryAttempts / stats.totalRequests) * 100).toFixed(2)}%`);
  
  if (breakerState === 'OPEN') {
    const timeUntilNext = afipService.getTimeUntilNextAttempt();
    console.log(`Próximo intento en: ${Math.ceil(timeUntilNext / 1000)}s`);
  }
}

// Monitorear cada 30 segundos
setInterval(monitorResilience, 30000);
```

### 3. **Manejo de Errores**

```typescript
try {
  const result = await afipService.solicitarCAE(comprobante);
  console.log('CAE obtenido:', result.cae);
} catch (error) {
  const errorMessage = error.message;
  
  if (errorMessage.includes('Circuit breaker is OPEN')) {
    console.log('AFIP temporalmente no disponible');
    console.log('Próximo intento en:', afipService.getTimeUntilNextAttempt(), 'ms');
  } else if (errorMessage.includes('Timeout')) {
    console.log('AFIP no respondió en el tiempo esperado');
  } else {
    console.log('Error de AFIP:', errorMessage);
  }
}
```

### 4. **Testing de Resiliencia**

```typescript
// Test de circuit breaker
async function testCircuitBreaker() {
  console.log('Estado inicial:', afipService.getCircuitBreakerState());
  
  // Forzar apertura
  afipService.forceOpenCircuitBreaker();
  console.log('Estado después de forzar apertura:', afipService.getCircuitBreakerState());
  
  // Intentar operación
  try {
    await afipService.solicitarCAE(comprobante);
  } catch (error) {
    console.log('Error esperado:', error.message);
  }
  
  // Forzar cierre
  afipService.forceCloseCircuitBreaker();
  console.log('Estado después de forzar cierre:', afipService.getCircuitBreakerState());
}

// Test de reintentos
async function testRetries() {
  // Resetear estadísticas
  afipService.resetResilienceStats();
  
  // Ejecutar operación
  try {
    await afipService.solicitarCAE(comprobante);
  } catch (error) {
    const stats = afipService.getResilienceStats();
    console.log('Reintentos realizados:', stats.retryAttempts);
  }
}
```

---

## 📋 Checklist de Implementación

### ✅ **Configuración Básica**
- [ ] Variables de entorno configuradas
- [ ] Timeouts apropiados para el ambiente
- [ ] Reintentos configurados
- [ ] Circuit breaker configurado

### ✅ **Monitoreo**
- [ ] Logs de resiliencia habilitados
- [ ] Métricas de circuit breaker disponibles
- [ ] Alertas configuradas (si aplica)

### ✅ **Testing**
- [ ] Pruebas de timeout
- [ ] Pruebas de reintentos
- [ ] Pruebas de circuit breaker
- [ ] Pruebas de recuperación

### ✅ **Documentación**
- [ ] Equipo capacitado en el sistema
- [ ] Procedimientos de troubleshooting
- [ ] Configuración documentada

---

## 🔗 Referencias

- **Documentación AFIP:** [https://www.afip.gob.ar/fe/ayuda/webservice.asp](https://www.afip.gob.ar/fe/ayuda/webservice.asp)
- **Librería p-retry:** [https://github.com/sindresorhus/p-retry](https://github.com/sindresorhus/p-retry)
- **Patrón Circuit Breaker:** [https://martinfowler.com/bliki/CircuitBreaker.html](https://martinfowler.com/bliki/CircuitBreaker.html)

---

**Estado:** ✅ **IMPLEMENTADO**  
**Última actualización:** 2024-12-19  
**Responsable:** Equipo de Desarrollo
