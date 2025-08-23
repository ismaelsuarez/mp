/**
 * Script de pruebas para TimeValidator
 * Ejecutar con: node test-time-validation.js
 */

const { TimeValidator } = require('./dist/src/modules/facturacion/utils/TimeValidator.js');
const { TimeScheduler } = require('./dist/src/modules/facturacion/utils/TimeScheduler.js');

async function runTests() {
  console.log('🧪 Iniciando pruebas de Validación de Tiempo NTP...\n');

  const validator = new TimeValidator();
  const scheduler = new TimeScheduler({
    checkInterval: 5000, // 5 segundos para pruebas
    alertThreshold: 1000, // 1 segundo para alertas
    maxConsecutiveFailures: 2,
    enabled: true
  });

  // Test 1: Validación básica de tiempo
  console.log('📋 Test 1: Validación básica de tiempo');
  try {
    const result1 = await validator.validateSystemTime();
    
    console.log('✅ Test 1 PASÓ: Validación de tiempo completada');
    console.log('📝 Drift:', result1.drift, 'ms');
    console.log('📝 Válido:', result1.isValid);
    console.log('📝 Tiempo sistema:', result1.systemTime.toISOString());
    console.log('📝 Tiempo NTP:', result1.ntpTime.toISOString());
    
    if (result1.warning) {
      console.log('⚠️  Warning:', result1.warning);
    }
  } catch (error) {
    console.log('❌ Test 1 ERROR:', error.message);
  }

  console.log('');

  // Test 2: Validación con configuración personalizada
  console.log('📋 Test 2: Validación con configuración personalizada');
  try {
    const customValidator = new TimeValidator({
      server: 'pool.ntp.org',
      port: 123,
      allowedDrift: 1000, // 1 segundo
      timeout: 3000 // 3 segundos
    });

    const result2 = await customValidator.validateSystemTime();
    
    console.log('✅ Test 2 PASÓ: Validación con configuración personalizada');
    console.log('📝 Drift:', result2.drift, 'ms');
    console.log('📝 Válido:', result2.isValid);
  } catch (error) {
    console.log('❌ Test 2 ERROR:', error.message);
  }

  console.log('');

  // Test 3: Validación con error (servidor NTP inválido)
  console.log('📋 Test 3: Validación con servidor NTP inválido');
  try {
    const invalidValidator = new TimeValidator({
      server: 'invalid.ntp.server',
      port: 123,
      allowedDrift: 60000,
      timeout: 2000
    });

    const result3 = await invalidValidator.validateSystemTime();
    
    console.log('✅ Test 3 PASÓ: Manejo de error de NTP');
    console.log('📝 Válido:', result3.isValid);
    console.log('📝 Warning:', result3.warning);
  } catch (error) {
    console.log('❌ Test 3 ERROR:', error.message);
  }

  console.log('');

  // Test 4: Validación con throw
  console.log('📋 Test 4: Validación con throw');
  try {
    await validator.validateAndThrow();
    console.log('✅ Test 4 PASÓ: Validación exitosa con throw');
  } catch (error) {
    console.log('❌ Test 4 ERROR:', error.message);
  }

  console.log('');

  // Test 5: Estadísticas del validador
  console.log('📋 Test 5: Estadísticas del validador');
  try {
    const stats = validator.getStats();
    console.log('✅ Test 5 PASÓ: Estadísticas obtenidas');
    console.log('📊 Total validaciones:', stats.totalValidations);
    console.log('📊 Drift promedio:', stats.averageDrift, 'ms');
    console.log('📊 Configuración:', stats.config);
  } catch (error) {
    console.log('❌ Test 5 ERROR:', error.message);
  }

  console.log('');

  // Test 6: Estado del validador
  console.log('📋 Test 6: Estado del validador');
  try {
    const status = validator.getStatus();
    console.log('✅ Test 6 PASÓ: Estado obtenido');
    console.log('📊 Configurado:', status.isConfigured);
    console.log('📊 Última validación:', status.lastValidationTime);
    console.log('📊 Última válida:', status.isLastValidationValid);
    console.log('📊 Último drift:', status.lastDrift, 'ms');
  } catch (error) {
    console.log('❌ Test 6 ERROR:', error.message);
  }

  console.log('');

  // Test 7: Scheduler de validación
  console.log('📋 Test 7: Scheduler de validación');
  try {
    console.log('📝 Iniciando scheduler...');
    scheduler.start();
    
    // Esperar un poco para que se ejecute
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const schedulerStats = scheduler.getStats();
    const schedulerStatus = scheduler.getStatus();
    
    console.log('✅ Test 7 PASÓ: Scheduler iniciado');
    console.log('📊 Total checks:', schedulerStats.totalChecks);
    console.log('📊 Checks exitosos:', schedulerStats.successfulChecks);
    console.log('📊 Checks fallidos:', schedulerStats.failedChecks);
    console.log('📊 Estado:', schedulerStatus.isRunning ? 'Ejecutándose' : 'Detenido');
    
    // Detener scheduler
    scheduler.stop();
    console.log('📝 Scheduler detenido');
  } catch (error) {
    console.log('❌ Test 7 ERROR:', error.message);
  }

  console.log('');

  // Test 8: Validación forzada del scheduler
  console.log('📋 Test 8: Validación forzada del scheduler');
  try {
    const forcedResult = await scheduler.forceCheck();
    console.log('✅ Test 8 PASÓ: Validación forzada completada');
    console.log('📝 Drift:', forcedResult.drift, 'ms');
    console.log('📝 Válido:', forcedResult.isValid);
  } catch (error) {
    console.log('❌ Test 8 ERROR:', error.message);
  }

  console.log('');

  // Test 9: Configuración del scheduler
  console.log('📋 Test 9: Configuración del scheduler');
  try {
    scheduler.updateConfig({
      checkInterval: 10000, // 10 segundos
      alertThreshold: 5000, // 5 segundos
      maxConsecutiveFailures: 5
    });
    
    const status = scheduler.getStatus();
    console.log('✅ Test 9 PASÓ: Configuración actualizada');
    console.log('📊 Nuevo intervalo:', status.config.checkInterval, 'ms');
    console.log('📊 Nuevo threshold:', status.config.alertThreshold, 'ms');
    console.log('📊 Nuevo max failures:', status.config.maxConsecutiveFailures);
  } catch (error) {
    console.log('❌ Test 9 ERROR:', error.message);
  }

  console.log('');

  // Test 10: Reset de estadísticas
  console.log('📋 Test 10: Reset de estadísticas');
  try {
    validator.resetStats();
    scheduler.resetStats();
    
    const validatorStats = validator.getStats();
    const schedulerStats = scheduler.getStats();
    
    console.log('✅ Test 10 PASÓ: Estadísticas reseteadas');
    console.log('📊 Validator total:', validatorStats.totalValidations);
    console.log('📊 Scheduler total:', schedulerStats.totalChecks);
  } catch (error) {
    console.log('❌ Test 10 ERROR:', error.message);
  }

  console.log('\n🎉 Pruebas de validación de tiempo completadas');
}

// Ejecutar pruebas
runTests().catch(console.error);
