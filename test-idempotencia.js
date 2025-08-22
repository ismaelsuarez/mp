/**
 * Script de pruebas para IdempotencyManager
 * Ejecutar con: node test-idempotencia.js
 */

const { IdempotencyManager } = require('./dist2/src/modules/facturacion/afip/IdempotencyManager.js');

async function runTests() {
  console.log('🧪 Iniciando pruebas de Idempotencia...\n');

  const manager = new IdempotencyManager();

  // Test 1: Comprobante nuevo
  console.log('📋 Test 1: Comprobante nuevo');
  try {
    const result1 = await manager.checkIdempotency(1, 6, 1001, { test: 'data' });
    
    if (!result1.isDuplicate && result1.shouldProceed) {
      console.log('✅ Test 1 PASÓ: Comprobante nuevo creado correctamente');
    } else {
      console.log('❌ Test 1 FALLÓ:', result1);
    }
  } catch (error) {
    console.log('❌ Test 1 ERROR:', error.message);
  }

  console.log('');

  // Test 2: Comprobante duplicado (mismo número)
  console.log('📋 Test 2: Comprobante duplicado');
  try {
    const result2 = await manager.checkIdempotency(1, 6, 1001, { test: 'data2' });
    
    if (result2.isDuplicate && !result2.shouldProceed) {
      console.log('✅ Test 2 PASÓ: Duplicado detectado correctamente');
    } else {
      console.log('❌ Test 2 FALLÓ:', result2);
    }
  } catch (error) {
    console.log('❌ Test 2 ERROR:', error.message);
  }

  console.log('');

  // Test 3: Marcar como exitoso
  console.log('📋 Test 3: Marcar como exitoso');
  try {
    const success = await manager.markAsApproved(1, 6, 1001, '12345678901234', '20241231');
    
    if (success) {
      console.log('✅ Test 3 PASÓ: Comprobante marcado como exitoso');
    } else {
      console.log('❌ Test 3 FALLÓ: No se pudo marcar como exitoso');
    }
  } catch (error) {
    console.log('❌ Test 3 ERROR:', error.message);
  }

  console.log('');

  // Test 4: Verificar que ahora retorna CAE existente
  console.log('📋 Test 4: Verificar CAE existente');
  try {
    const result4 = await manager.checkIdempotency(1, 6, 1001, { test: 'data3' });
    
    if (result4.isDuplicate && !result4.shouldProceed && result4.existingCae) {
      console.log('✅ Test 4 PASÓ: CAE existente retornado correctamente');
      console.log('📝 CAE:', result4.existingCae);
      console.log('📝 Vencimiento:', result4.existingCaeVto);
    } else {
      console.log('❌ Test 4 FALLÓ:', result4);
    }
  } catch (error) {
    console.log('❌ Test 4 ERROR:', error.message);
  }

  console.log('');

  // Test 5: Comprobante fallido
  console.log('📋 Test 5: Comprobante fallido');
  try {
    // Crear nuevo comprobante
    await manager.checkIdempotency(1, 6, 1002, { test: 'failed' });
    
    // Marcar como fallido
    const failed = await manager.markAsFailed(1, 6, 1002, 'Error de prueba');
    
    if (failed) {
      console.log('✅ Test 5 PASÓ: Comprobante marcado como fallido');
    } else {
      console.log('❌ Test 5 FALLÓ: No se pudo marcar como fallido');
    }
  } catch (error) {
    console.log('❌ Test 5 ERROR:', error.message);
  }

  console.log('');

  // Test 6: Reintento de comprobante fallido
  console.log('📋 Test 6: Reintento de comprobante fallido');
  try {
    const result6 = await manager.checkIdempotency(1, 6, 1002, { test: 'retry' });
    
    if (result6.isDuplicate && result6.shouldProceed) {
      console.log('✅ Test 6 PASÓ: Reintento permitido para comprobante fallido');
    } else {
      console.log('❌ Test 6 FALLÓ:', result6);
    }
  } catch (error) {
    console.log('❌ Test 6 ERROR:', error.message);
  }

  console.log('');

  // Test 7: Estadísticas
  console.log('📋 Test 7: Estadísticas');
  try {
    const stats = manager.getStats();
    console.log('✅ Test 7 PASÓ: Estadísticas obtenidas');
    console.log('📊 Pendientes:', stats.pending);
    console.log('📊 Aprobados:', stats.approved);
    console.log('📊 Fallidos:', stats.failed);
  } catch (error) {
    console.log('❌ Test 7 ERROR:', error.message);
  }

  console.log('');

  // Test 8: Concurrencia simulada
  console.log('📋 Test 8: Concurrencia simulada');
  try {
    // Simular dos intentos simultáneos
    const promises = [
      manager.checkIdempotency(1, 6, 1003, { concurrent: 1 }),
      manager.checkIdempotency(1, 6, 1003, { concurrent: 2 })
    ];
    
    const results = await Promise.all(promises);
    
    const firstSuccess = results[0].shouldProceed && !results[0].isDuplicate;
    const secondDuplicate = results[1].isDuplicate && !results[1].shouldProceed;
    
    if (firstSuccess && secondDuplicate) {
      console.log('✅ Test 8 PASÓ: Concurrencia manejada correctamente');
      console.log('📝 Primer intento:', results[0]);
      console.log('📝 Segundo intento:', results[1]);
    } else {
      console.log('❌ Test 8 FALLÓ: Concurrencia no manejada correctamente');
      console.log('📝 Resultados:', results);
    }
  } catch (error) {
    console.log('❌ Test 8 ERROR:', error.message);
  }

  console.log('');

  // Test 9: Limpieza
  console.log('📋 Test 9: Limpieza');
  try {
    const cleaned = manager.cleanup();
    console.log('✅ Test 9 PASÓ: Limpieza completada');
    console.log('📊 Registros limpiados:', cleaned);
  } catch (error) {
    console.log('❌ Test 9 ERROR:', error.message);
  }

  console.log('\n🎉 Pruebas de idempotencia completadas');
}

// Ejecutar pruebas
runTests().catch(console.error);
