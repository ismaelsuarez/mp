/**
 * Script de prueba para generar Factura C en homologación AFIP
 * Genera una factura con ítem de servicio por $0.10 pesos
 */

const { AFIPService } = require('./src/modules/facturacion/afip/AFIPService');
const { FacturaService } = require('./src/modules/facturacion/FacturaService');
require('dotenv').config();

async function testFacturaHomologacion() {
  console.log('🧪 INICIANDO PRUEBA DE FACTURACIÓN EN HOMOLOGACIÓN AFIP');
  console.log('=' .repeat(60));
  
  try {
    // 1. Inicializar servicios
    console.log('📋 Inicializando servicios AFIP...');
    const afipService = new AFIPService();
    const facturaService = new FacturaService(afipService);
    
    // 2. Verificar configuración
    console.log('🔍 Verificando configuración de homologación...');
    const config = afipService.getConfiguracion();
    console.log('✅ Entorno configurado:', config.entorno);
    console.log('✅ CUIT:', config.cuit);
    console.log('✅ Punto de Venta:', config.puntoVenta);
    
    // 3. Verificar conexión con AFIP
    console.log('🌐 Verificando conexión con AFIP...');
    const serverStatus = await afipService.verificarServidor();
    console.log('✅ Estado del servidor AFIP:', serverStatus);
    
    // 4. Generar datos de prueba
    const datosFactura = {
      tipoComprobante: 'C', // Factura C
      concepto: 1, // Productos
      tipoDoc: 99, // Consumidor Final
      nroDoc: 0, // Sin documento para Consumidor Final
      fechaServicioDesde: new Date().toISOString().split('T')[0],
      fechaServicioHasta: new Date().toISOString().split('T')[0],
      fechaVtoPago: new Date().toISOString().split('T')[0],
      monId: 'PES', // Pesos Argentinos
      monCotiz: 1,
      items: [
        {
          descripcion: 'Servicio de prueba - Homologación AFIP',
          qty: 1,
          precioUnit: 0.10,
          bonif: 0,
          iva: {
            id: 5, // 21% IVA
            baseImp: 0.10,
            importe: 0.02
          },
          subtotal: 0.10
        }
      ],
      impTotal: 0.12, // $0.10 + $0.02 IVA
      impTotConc: 0.10,
      impNeto: 0.10,
      impOpEx: 0,
      impIVA: 0.02,
      impTrib: 0,
      fecha: new Date().toISOString().split('T')[0]
    };
    
    console.log('📄 Datos de la factura de prueba:');
    console.log('   - Tipo: Factura C');
    console.log('   - Cliente: Consumidor Final');
    console.log('   - Monto: $0.10 + IVA = $0.12');
    console.log('   - Concepto: Servicio de prueba');
    
    // 5. Generar factura
    console.log('🔄 Generando factura en AFIP...');
    const resultado = await facturaService.generarFactura(datosFactura);
    
    // 6. Mostrar resultados
    console.log('✅ RESULTADO DE LA PRUEBA:');
    console.log('=' .repeat(60));
    
    if (resultado.success) {
      console.log('🎉 ¡FACTURA GENERADA EXITOSAMENTE!');
      console.log('📊 Datos de la factura:');
      console.log(`   - CAE: ${resultado.data.cae}`);
      console.log(`   - Vencimiento CAE: ${resultado.data.fechaVencimientoCAE}`);
      console.log(`   - Número de comprobante: ${resultado.data.numeroComprobante}`);
      console.log(`   - Punto de venta: ${resultado.data.puntoVenta}`);
      console.log(`   - Tipo de comprobante: ${resultado.data.tipoComprobante}`);
      
      // Guardar factura en base de datos local
      console.log('💾 Guardando factura en base de datos local...');
      const facturaGuardada = await facturaService.guardarFactura(resultado.data);
      console.log('✅ Factura guardada con ID:', facturaGuardada.id);
      
    } else {
      console.log('❌ ERROR AL GENERAR FACTURA:');
      console.log('   - Código:', resultado.error?.codigo);
      console.log('   - Mensaje:', resultado.error?.mensaje);
      console.log('   - Detalles:', resultado.error?.detalles);
    }
    
    // 7. Verificar estado del servicio
    console.log('🔍 Verificando estado del servicio AFIP...');
    const estadoServicio = await afipService.obtenerEstadoServicio();
    console.log('📊 Estado del servicio:', estadoServicio);
    
  } catch (error) {
    console.log('💥 ERROR CRÍTICO EN LA PRUEBA:');
    console.log('   - Mensaje:', error.message);
    console.log('   - Stack:', error.stack);
  }
  
  console.log('=' .repeat(60));
  console.log('🏁 PRUEBA FINALIZADA');
}

// Ejecutar la prueba
if (require.main === module) {
  testFacturaHomologacion()
    .then(() => {
      console.log('✅ Script ejecutado correctamente');
      process.exit(0);
    })
    .catch((error) => {
      console.log('❌ Error ejecutando script:', error.message);
      process.exit(1);
    });
}

module.exports = { testFacturaHomologacion };
