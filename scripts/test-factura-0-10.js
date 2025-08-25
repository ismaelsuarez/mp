/**
 * Script para generar Factura C de $0.10 pesos en homologación AFIP
 * Usa el mismo afipService que el módulo de administración
 */

const { afipService } = require('../dist/src/modules/facturacion/afipService');
const { FacturacionService } = require('../dist/src/services/FacturacionService');
require('dotenv').config();

async function generarFacturaC() {
  console.log('🧪 GENERANDO FACTURA C DE $0.10 EN HOMOLOGACIÓN AFIP');
  console.log('=' .repeat(60));
  
  try {
    // 1. Verificar configuración desde .env
    console.log('📋 1. Verificando configuración desde .env...');
    
    const cuit = process.env.AFIP_CUIT_HOMOLOGACION;
    const ptoVta = process.env.AFIP_HOMOLOGACION_PTO_VTA;
    
    if (!cuit || !ptoVta) {
      console.log('❌ Faltan variables de entorno en .env:');
      console.log('   - AFIP_CUIT_HOMOLOGACION:', cuit ? '✅' : '❌');
      console.log('   - AFIP_HOMOLOGACION_PTO_VTA:', ptoVta ? '✅' : '❌');
      return;
    }
    
    console.log('✅ Configuración encontrada:');
    console.log('   - CUIT:', cuit);
    console.log('   - Punto de Venta:', ptoVta);

    // 2. Verificar estado del servidor AFIP
    console.log('\n📋 2. Verificando estado del servidor AFIP...');
    try {
      const status = await afipService.checkServerStatus();
      console.log('✅ Estado del servidor:', status);
    } catch (error) {
      console.log('❌ Error obteniendo estado del servidor:', error.message);
      return;
    }

    // 3. Validar certificado usando el mismo método que el módulo admin
    console.log('\n📋 3. Validando certificado...');
    try {
      const certInfo = afipService.validarCertificado();
      console.log('✅ Certificado válido');
      console.log('   - Expira:', certInfo.expira);
      console.log('   - Días restantes:', certInfo.diasRestantes);
    } catch (error) {
      console.log('❌ Error validando certificado:', error.message);
      return;
    }

    // 4. Generar factura usando FacturacionService
    console.log('\n📋 4. Generando Factura C de $0.10...');
    
    const facturacionService = new FacturacionService(afipService);
    
    const datosFactura = {
      pto_vta: parseInt(ptoVta),
      tipo_cbte: 11, // Factura C
      concepto: 1, // Productos
      doc_tipo: 99, // Consumidor Final
      mon_id: 'PES',
      fecha: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      cuit_emisor: cuit,
      cuit_receptor: '20300123456',
      razon_social_receptor: 'Cliente Demo S.A.',
      condicion_iva_receptor: 'RI',
      neto: 0.10,
      iva: 0.02,
      total: 0.12,
      detalle: [
        {
          descripcion: 'Servicio de prueba - Homologación AFIP',
          cantidad: 1,
          precioUnitario: 0.10,
          alicuotaIva: 21
        }
      ],
      empresa: { 
        nombre: 'TODO-COMPUTACIÓN', 
        cuit: cuit 
      },
      plantilla: 'factura_c'
    };
    
    console.log('📄 Datos de la factura:');
    console.log('   - Tipo: Factura C (11)');
    console.log('   - Cliente: Consumidor Final');
    console.log('   - Monto: $0.10 + IVA = $0.12');
    console.log('   - IVA: 21% sobre $0.10 = $0.02');

    // 5. Emitir factura
    console.log('\n📋 5. Emitiendo factura...');
    try {
      const resultado = await facturacionService.emitirFacturaYGenerarPdf(datosFactura);
      
      console.log('✅ RESULTADO DE LA FACTURACIÓN:');
      console.log('=' .repeat(60));
      console.log('🎉 ¡FACTURA GENERADA EXITOSAMENTE!');
      console.log('📊 Datos de la factura:');
      console.log(`   - CAE: ${resultado.cae}`);
      console.log(`   - Vencimiento CAE: ${resultado.fechaVencimientoCAE}`);
      console.log(`   - Número de comprobante: ${resultado.numeroComprobante}`);
      console.log(`   - Punto de venta: ${resultado.puntoVenta}`);
      console.log(`   - Tipo de comprobante: ${resultado.tipoComprobante}`);
      console.log(`   - PDF: ${resultado.pdf_path}`);
      
      // Guardar en archivo de log
      const logData = {
        fecha: new Date().toISOString(),
        resultado: resultado,
        datosFactura: datosFactura
      };
      
      const fs = require('fs');
      fs.writeFileSync('factura-0-10-resultado.json', JSON.stringify(logData, null, 2));
      console.log('💾 Resultado guardado en: factura-0-10-resultado.json');
      
    } catch (error) {
      console.log('❌ ERROR AL GENERAR FACTURA:');
      console.log('   - Mensaje:', error.message);
      console.log('   - Detalles:', error);
      
      // Guardar error en archivo
      const errorData = {
        fecha: new Date().toISOString(),
        error: {
          message: error.message,
          stack: error.stack
        },
        datosFactura: datosFactura
      };
      
      const fs = require('fs');
      fs.writeFileSync('factura-0-10-error.json', JSON.stringify(errorData, null, 2));
      console.log('💾 Error guardado en: factura-0-10-error.json');
    }
    
  } catch (error) {
    console.log('💥 ERROR CRÍTICO:');
    console.log('   - Mensaje:', error.message);
    console.log('   - Stack:', error.stack);
  }
  
  console.log('=' .repeat(60));
  console.log('🏁 PRUEBA FINALIZADA');
}

// Ejecutar la prueba
if (require.main === module) {
  generarFacturaC()
    .then(() => {
      console.log('✅ Script ejecutado correctamente');
      process.exit(0);
    })
    .catch((error) => {
      console.log('❌ Error ejecutando script:', error.message);
      process.exit(1);
    });
}

module.exports = { generarFacturaC };
