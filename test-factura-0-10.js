/**
 * Script para generar Factura C de $0.10 pesos en homologación AFIP
 * Basado en el script existente de prueba
 */

const Afip = require('@afipsdk/afip.js');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

async function generarFacturaC() {
  console.log('🧪 GENERANDO FACTURA C DE $0.10 EN HOMOLOGACIÓN AFIP');
  console.log('=' .repeat(60));
  
  try {
    // 1. Verificar configuración desde .env
    console.log('📋 1. Verificando configuración desde .env...');
    
    const cuit = process.env.AFIP_CUIT_HOMOLOGACION;
    const ptoVta = process.env.AFIP_HOMOLOGACION_PTO_VTA;
    const certPath = process.env.AFIP_CERT_PATH_HOMOLOGACION;
    const keyPath = process.env.AFIP_KEY_PATH_HOMOLOGACION || 'C:\\arca\\clave_privada_afip.key';
    
    if (!cuit || !ptoVta || !certPath || !keyPath) {
      console.log('❌ Faltan variables de entorno en .env:');
      console.log('   - AFIP_CUIT_HOMOLOGACION:', cuit ? '✅' : '❌');
      console.log('   - AFIP_HOMOLOGACION_PTO_VTA:', ptoVta ? '✅' : '❌');
      console.log('   - AFIP_CERT_PATH_HOMOLOGACION:', certPath ? '✅' : '❌');
      console.log('   - AFIP_KEY_PATH_HOMOLOGACION:', keyPath ? '✅' : '❌');
      return;
    }
    
    console.log('✅ Configuración encontrada:');
    console.log('   - CUIT:', cuit);
    console.log('   - Punto de Venta:', ptoVta);
    console.log('   - Certificado:', certPath);
    console.log('   - Clave:', keyPath);

    // 2. Verificar archivos de certificado
    console.log('\n📋 2. Verificando archivos de certificado...');
    
    if (!fs.existsSync(certPath)) {
      console.log('❌ Certificado no encontrado en:', certPath);
      return;
    }
    
    if (!fs.existsSync(keyPath)) {
      console.log('❌ Clave privada no encontrada en:', keyPath);
      return;
    }
    
    console.log('✅ Archivos de certificado encontrados');

    // 3. Crear instancia AFIP
    console.log('\n📋 3. Creando instancia AFIP...');
    
    const afip = new Afip({
      CUIT: parseInt(cuit),
      cert: certPath,
      key: keyPath,
      production: false // Homologación
    });

    console.log('✅ Instancia AFIP creada para HOMOLOGACIÓN');

    // 4. Verificar estado del servidor
    console.log('\n📋 4. Verificando estado del servidor AFIP...');
    try {
      const status = await afip.ElectronicBilling.getServerStatus();
      console.log('✅ Estado del servidor:', status);
    } catch (error) {
      console.log('❌ Error obteniendo estado del servidor:', error.message);
      return;
    }

    // 5. Obtener último número de comprobante
    console.log('\n📋 5. Obteniendo último número de comprobante...');
    try {
      const ultimoComprobante = await afip.ElectronicBilling.getLastVoucher(parseInt(ptoVta), 11); // 11 = Factura C
      const numeroComprobante = ultimoComprobante + 1;
      console.log('✅ Último comprobante:', ultimoComprobante);
      console.log('✅ Nuevo número de comprobante:', numeroComprobante);
    } catch (error) {
      console.log('❌ Error obteniendo último comprobante:', error.message);
      console.log('💡 Asumiendo número 1 para primera factura');
    }

    // 6. Generar factura C
    console.log('\n📋 6. Generando Factura C de $0.10...');
    
    const datosFactura = {
      CantReg: 1,
      PtoVta: parseInt(ptoVta),
      CbteTipo: 11, // Factura C
      Concepto: 1, // Productos
      DocTipo: 99, // Consumidor Final
      DocNro: 0, // Sin documento para Consumidor Final
      CbteDesde: 1, // Número de comprobante
      CbteHasta: 1,
      CbteFch: parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, '')),
      ImpTotal: 0.12, // $0.10 + $0.02 IVA
      ImpTotConc: 0.10, // Neto gravado
      ImpNeto: 0.10,
      ImpOpEx: 0,
      ImpIVA: 0.02, // IVA 21%
      ImpTrib: 0,
      FchServDesde: parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, '')),
      FchServHasta: parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, '')),
      FchVtoPago: parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, '')),
      MonId: 'PES',
      MonCotiz: 1,
      Iva: [
        {
          Id: 5, // 21% IVA
          BaseImp: 0.10,
          Importe: 0.02
        }
      ],
      Tributos: [],
      Opcionales: []
    };
    
    console.log('📄 Datos de la factura:');
    console.log('   - Tipo: Factura C (11)');
    console.log('   - Cliente: Consumidor Final');
    console.log('   - Monto: $0.10 + IVA = $0.12');
    console.log('   - IVA: 21% sobre $0.10 = $0.02');

    // 7. Solicitar CAE
    console.log('\n📋 7. Solicitando CAE a AFIP...');
    try {
      const resultado = await afip.ElectronicBilling.createVoucher(datosFactura);
      
      console.log('✅ RESULTADO DE LA FACTURACIÓN:');
      console.log('=' .repeat(60));
      console.log('🎉 ¡FACTURA GENERADA EXITOSAMENTE!');
      console.log('📊 Datos de la factura:');
      console.log(`   - CAE: ${resultado.CAE}`);
      console.log(`   - Vencimiento CAE: ${resultado.CAEFchVto}`);
      console.log(`   - Número de comprobante: ${resultado.CbteDesde}`);
      console.log(`   - Punto de venta: ${resultado.PtoVta}`);
      console.log(`   - Tipo de comprobante: ${resultado.CbteTipo}`);
      console.log(`   - Fecha: ${resultado.CbteFch}`);
      
      // Guardar en archivo de log
      const logData = {
        fecha: new Date().toISOString(),
        resultado: resultado,
        datosFactura: datosFactura
      };
      
      fs.writeFileSync('factura-0-10-resultado.json', JSON.stringify(logData, null, 2));
      console.log('💾 Resultado guardado en: factura-0-10-resultado.json');
      
    } catch (error) {
      console.log('❌ ERROR AL GENERAR FACTURA:');
      console.log('   - Mensaje:', error.message);
      console.log('   - Código:', error.code);
      console.log('   - Detalles:', error);
      
      // Guardar error en archivo
      const errorData = {
        fecha: new Date().toISOString(),
        error: {
          message: error.message,
          code: error.code,
          stack: error.stack
        },
        datosFactura: datosFactura
      };
      
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
