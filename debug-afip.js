/**
 * Script de debug para AFIP
 * Ejecutar con: node debug-afip.js
 */

const Afip = require('@afipsdk/afip.js');
const path = require('path');
const fs = require('fs');

// Simular la base de datos
const dbPath = path.join(__dirname, 'facturas.db');

async function debugAfip() {
  console.log('🔍 Iniciando debug de AFIP...\n');

  try {
    // 1. Verificar si existe la base de datos
    console.log('📋 1. Verificando base de datos...');
    
    if (!fs.existsSync(dbPath)) {
      console.log('❌ Base de datos no encontrada en:', dbPath);
      console.log('💡 Asegúrate de haber configurado AFIP desde la interfaz de administración');
      return;
    }
    
    console.log('✅ Base de datos encontrada');

    // 2. Leer configuración de AFIP desde la base de datos
    console.log('\n📋 2. Leyendo configuración de AFIP...');
    
    const Database = require('better-sqlite3');
    const db = new Database(dbPath);
    
    const config = db.prepare('SELECT * FROM configuracion_afip ORDER BY id DESC LIMIT 1').get();
    
    if (!config) {
      console.log('❌ No se encontró configuración de AFIP en la base de datos');
      console.log('💡 Configura AFIP desde la interfaz de administración');
      db.close();
      return;
    }
    
    console.log('✅ Configuración encontrada:', {
      cuit: config.cuit,
      pto_vta: config.pto_vta,
      entorno: config.entorno,
      cert_path: config.cert_path,
      key_path: config.key_path
    });

    // 3. Verificar archivos de certificado
    console.log('\n📋 3. Verificando archivos de certificado...');
    
    if (!fs.existsSync(config.cert_path)) {
      console.log('❌ Certificado no encontrado en:', config.cert_path);
      db.close();
      return;
    }
    
    if (!fs.existsSync(config.key_path)) {
      console.log('❌ Clave privada no encontrada en:', config.key_path);
      db.close();
      return;
    }
    
    console.log('✅ Archivos de certificado encontrados');

    // 4. Crear instancia AFIP
    console.log('\n📋 4. Creando instancia AFIP...');
    
    const afip = new Afip({
      CUIT: config.cuit,
      cert: config.cert_path,
      key: config.key_path,
      production: config.entorno === 'produccion'
    });

    console.log('✅ Instancia AFIP creada');
    console.log('📊 Entorno:', config.entorno === 'produccion' ? 'PRODUCCIÓN' : 'HOMOLOGACIÓN');

    // 5. Probar estado del servidor primero
    console.log('\n📋 5. Probando estado del servidor...');
    try {
      const status = await afip.ElectronicBilling.getServerStatus();
      console.log('✅ Estado del servidor:', status);
    } catch (error) {
      console.log('❌ Error obteniendo estado del servidor:', error.message);
      console.log('💡 Esto puede indicar un problema de conectividad o autenticación');
    }

    // 6. Probar métodos de validación uno por uno
    console.log('\n📋 6. Probando métodos de validación...');

    // Test getVoucherTypes
    console.log('\n🔍 Probando getVoucherTypes...');
    try {
      const tiposCbte = await afip.ElectronicBilling.getVoucherTypes();
      console.log('✅ getVoucherTypes exitoso:', tiposCbte);
    } catch (error) {
      console.log('❌ Error en getVoucherTypes:', error.message);
      console.log('💡 Detalles del error:', error);
    }

    // Test getConceptTypes
    console.log('\n🔍 Probando getConceptTypes...');
    try {
      const conceptos = await afip.ElectronicBilling.getConceptTypes();
      console.log('✅ getConceptTypes exitoso:', conceptos);
    } catch (error) {
      console.log('❌ Error en getConceptTypes:', error.message);
      console.log('💡 Detalles del error:', error);
    }

    // Test getDocumentTypes
    console.log('\n🔍 Probando getDocumentTypes...');
    try {
      const tiposDoc = await afip.ElectronicBilling.getDocumentTypes();
      console.log('✅ getDocumentTypes exitoso:', tiposDoc);
    } catch (error) {
      console.log('❌ Error en getDocumentTypes:', error.message);
      console.log('💡 Detalles del error:', error);
    }

    // Test getCurrenciesTypes
    console.log('\n🔍 Probando getCurrenciesTypes...');
    try {
      const monedas = await afip.ElectronicBilling.getCurrenciesTypes();
      console.log('✅ getCurrenciesTypes exitoso:', monedas);
    } catch (error) {
      console.log('❌ Error en getCurrenciesTypes:', error.message);
      console.log('💡 Detalles del error:', error);
    }

    // Test getSalesPoints
    console.log('\n🔍 Probando getSalesPoints...');
    try {
      const ptosVta = await afip.ElectronicBilling.getSalesPoints();
      console.log('✅ getSalesPoints exitoso:', ptosVta);
    } catch (error) {
      console.log('❌ Error en getSalesPoints:', error.message);
      console.log('💡 Detalles del error:', error);
    }

    // 7. Probar obtener último autorizado
    console.log('\n📋 7. Probando getLastVoucher...');
    try {
      const last = await afip.ElectronicBilling.getLastVoucher(config.pto_vta, 11); // Factura C
      console.log('✅ getLastVoucher exitoso para PtoVta', config.pto_vta, 'TipoCbte 11:', last);
    } catch (error) {
      console.log('❌ Error en getLastVoucher:', error.message);
      console.log('💡 Detalles del error:', error);
    }

    db.close();

  } catch (error) {
    console.log('❌ Error general:', error.message);
    console.log('Stack:', error.stack);
  }
}

debugAfip().catch(console.error);
