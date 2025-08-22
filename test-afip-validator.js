/**
 * Script de pruebas para AfipValidator
 * Ejecutar con: node test-afip-validator.js
 */

const { AfipValidator } = require('./dist2/src/modules/facturacion/afip/AfipValidator.js');

// Mock de la instancia AFIP para pruebas
const mockAfipInstance = {
  ElectronicBilling: {
    getVoucherTypes: async () => [
      { Id: 1, Desc: 'Factura A' },
      { Id: 6, Desc: 'Factura B' },
      { Id: 11, Desc: 'Factura C' },
      { Id: 3, Desc: 'Nota de Crédito A' },
      { Id: 8, Desc: 'Nota de Crédito B' }
    ],
    getConceptTypes: async () => [
      { Id: 1, Desc: 'Productos' },
      { Id: 2, Desc: 'Servicios' },
      { Id: 3, Desc: 'Productos y Servicios' }
    ],
    getDocumentTypes: async () => [
      { Id: 80, Desc: 'CUIT' },
      { Id: 99, Desc: 'Consumidor Final' },
      { Id: 96, Desc: 'DNI' }
    ],
    getCurrenciesTypes: async () => [
      { Id: 'PES', Desc: 'Pesos Argentinos' },
      { Id: 'USD', Desc: 'Dólar Estadounidense' },
      { Id: 'EUR', Desc: 'Euro' }
    ],
    getSalesPoints: async () => [
      { Nro: 1, Desc: 'Punto de Venta 1' },
      { Nro: 2, Desc: 'Punto de Venta 2' },
      { Nro: 3, Desc: 'Punto de Venta 3' }
    ],
    getTaxTypes: async () => [
      { Id: 5, Desc: 'IVA 21%' },
      { Id: 4, Desc: 'IVA 10.5%' },
      { Id: 6, Desc: 'IVA 27%' }
    ],
    getCurrencyQuotation: async (monId) => {
      if (monId === 'USD') {
        return { MonCotiz: 1000 };
      }
      return null;
    }
  }
};

async function runTests() {
  console.log('🧪 Iniciando pruebas de AfipValidator...\n');

  const validator = new AfipValidator(mockAfipInstance);

  // Test 1: Caso válido
  console.log('📋 Test 1: Caso válido');
  try {
    const result1 = await validator.validateComprobante({
      cbteTipo: 6,
      concepto: 1,
      docTipo: 99,
      monId: 'PES',
      ptoVta: 1
    });
    
    if (result1.isValid) {
      console.log('✅ Test 1 PASÓ: Validación exitosa');
      if (result1.warnings.length > 0) {
        console.log('⚠️  Warnings:', result1.warnings);
      }
    } else {
      console.log('❌ Test 1 FALLÓ:', result1.errors);
    }
  } catch (error) {
    console.log('❌ Test 1 ERROR:', error.message);
  }

  console.log('');

  // Test 2: Tipo de comprobante inválido
  console.log('📋 Test 2: Tipo de comprobante inválido');
  try {
    const result2 = await validator.validateComprobante({
      cbteTipo: 999,
      concepto: 1,
      docTipo: 99,
      monId: 'PES',
      ptoVta: 1
    });
    
    if (!result2.isValid && result2.errors.some(e => e.includes('Tipo de comprobante inválido'))) {
      console.log('✅ Test 2 PASÓ: Error detectado correctamente');
      console.log('📝 Error:', result2.errors[0]);
    } else {
      console.log('❌ Test 2 FALLÓ: No se detectó el error esperado');
    }
  } catch (error) {
    console.log('❌ Test 2 ERROR:', error.message);
  }

  console.log('');

  // Test 3: Moneda inválida
  console.log('📋 Test 3: Moneda inválida');
  try {
    const result3 = await validator.validateComprobante({
      cbteTipo: 6,
      concepto: 1,
      docTipo: 99,
      monId: 'XXX',
      ptoVta: 1
    });
    
    if (!result3.isValid && result3.errors.some(e => e.includes('Moneda inválida'))) {
      console.log('✅ Test 3 PASÓ: Error detectado correctamente');
      console.log('📝 Error:', result3.errors[0]);
    } else {
      console.log('❌ Test 3 FALLÓ: No se detectó el error esperado');
    }
  } catch (error) {
    console.log('❌ Test 3 ERROR:', error.message);
  }

  console.log('');

  // Test 4: Moneda extranjera válida
  console.log('📋 Test 4: Moneda extranjera válida');
  try {
    const result4 = await validator.validateComprobante({
      cbteTipo: 6,
      concepto: 1,
      docTipo: 99,
      monId: 'USD',
      ptoVta: 1
    });
    
    if (result4.isValid) {
      console.log('✅ Test 4 PASÓ: Validación exitosa con moneda extranjera');
      if (result4.warnings.some(w => w.includes('Cotización obtenida'))) {
        console.log('📝 Cotización:', result4.warnings.find(w => w.includes('Cotización')));
      }
    } else {
      console.log('❌ Test 4 FALLÓ:', result4.errors);
    }
  } catch (error) {
    console.log('❌ Test 4 ERROR:', error.message);
  }

  console.log('');

  // Test 5: Información de validación
  console.log('📋 Test 5: Información de validación');
  try {
    const info = await validator.getValidationInfo();
    console.log('✅ Test 5 PASÓ: Información obtenida');
    console.log('📊 Tipos de comprobante:', info.tiposCbte.length);
    console.log('📊 Conceptos:', info.conceptos.length);
    console.log('📊 Tipos de documento:', info.tiposDoc.length);
    console.log('📊 Monedas:', info.monedas.length);
    console.log('📊 Puntos de venta:', info.ptosVta.length);
    console.log('📊 Tipos de IVA:', info.tiposIva.length);
  } catch (error) {
    console.log('❌ Test 5 ERROR:', error.message);
  }

  console.log('\n🎉 Pruebas completadas');
}

// Ejecutar pruebas
runTests().catch(console.error);
