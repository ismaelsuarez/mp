/**
 * Script para probar AFIP con datos de homologación
 * Ejecutar con: node test-afip-homologacion.js
 */

const Afip = require('@afipsdk/afip.js');
const path = require('path');
const fs = require('fs');

async function testAfipHomologacion() {
  console.log('🧪 Probando AFIP con datos de homologación...\n');

  try {
    // 1. Verificar configuración
    console.log('📋 1. Verificando configuración...');
    
    const userData = process.env.APPDATA || process.env.HOME || process.env.USERPROFILE;
    const appUserData = path.join(userData, 'mp');
    const dbPath = path.join(appUserData, 'facturas.db');
    
    if (!fs.existsSync(dbPath)) {
      console.log('❌ Base de datos no encontrada. Ejecuta primero: node inicializar-db.js');
      return;
    }
    
    // Leer configuración desde la base de datos
    const Database = require('better-sqlite3');
    const db = new Database(dbPath);
    const config = db.prepare('SELECT * FROM configuracion_afip ORDER BY id DESC LIMIT 1').get();
    db.close();
    
    if (!config) {
      console.log('❌ No hay configuración AFIP. Configura desde la interfaz de administración.');
      return;
    }
    
    console.log('✅ Configuración encontrada:');
    console.log('   - CUIT:', config.cuit);
    console.log('   - Punto de Venta:', config.pto_vta);
    console.log('   - Entorno:', config.entorno);
    console.log('   - Certificado:', config.cert_path);
    console.log('   - Clave:', config.key_path);

    // 2. Verificar archivos de certificado
    console.log('\n📋 2. Verificando archivos de certificado...');
    
    if (!fs.existsSync(config.cert_path)) {
      console.log('❌ Certificado no encontrado en:', config.cert_path);
      return;
    }
    
    if (!fs.existsSync(config.key_path)) {
      console.log('❌ Clave privada no encontrada en:', config.key_path);
      return;
    }
    
    console.log('✅ Archivos de certificado encontrados');

    // 3. Crear instancia AFIP
    console.log('\n📋 3. Creando instancia AFIP...');
    
    const afip = new Afip({
      CUIT: config.cuit,
      cert: config.cert_path,
      key: config.key_path,
      production: config.entorno === 'produccion'
    });

    console.log('✅ Instancia AFIP creada');
    console.log('📊 Entorno:', config.entorno === 'produccion' ? 'PRODUCCIÓN' : 'HOMOLOGACIÓN');

    // 4. Probar estado del servidor
    console.log('\n📋 4. Probando estado del servidor...');
    try {
      const status = await afip.ElectronicBilling.getServerStatus();
      console.log('✅ Estado del servidor:', status);
    } catch (error) {
      console.log('❌ Error obteniendo estado del servidor:', error.message);
      console.log('💡 Esto indica un problema de conectividad o autenticación básica');
      return;
    }

    // 5. Probar métodos de validación uno por uno con más detalle
    console.log('\n📋 5. Probando métodos de validación...');

    // Test getVoucherTypes
    console.log('\n🔍 Probando getVoucherTypes...');
    try {
      const tiposCbte = await afip.ElectronicBilling.getVoucherTypes();
      console.log('✅ getVoucherTypes exitoso');
      console.log('📊 Tipos disponibles:', tiposCbte.length);
      tiposCbte.slice(0, 5).forEach(tipo => {
        console.log(`   - ${tipo.Id}: ${tipo.Desc}`);
      });
      if (tiposCbte.length > 5) {
        console.log(`   ... y ${tiposCbte.length - 5} más`);
      }
    } catch (error) {
      console.log('❌ Error en getVoucherTypes:', error.message);
      console.log('💡 Detalles del error:', error);
    }

    // Test getConceptTypes
    console.log('\n🔍 Probando getConceptTypes...');
    try {
      const conceptos = await afip.ElectronicBilling.getConceptTypes();
      console.log('✅ getConceptTypes exitoso');
      console.log('📊 Conceptos disponibles:', conceptos.length);
      conceptos.forEach(concepto => {
        console.log(`   - ${concepto.Id}: ${concepto.Desc}`);
      });
    } catch (error) {
      console.log('❌ Error en getConceptTypes:', error.message);
      console.log('💡 Detalles del error:', error);
    }

    // Test getDocumentTypes
    console.log('\n🔍 Probando getDocumentTypes...');
    try {
      const tiposDoc = await afip.ElectronicBilling.getDocumentTypes();
      console.log('✅ getDocumentTypes exitoso');
      console.log('📊 Tipos de documento disponibles:', tiposDoc.length);
      tiposDoc.slice(0, 5).forEach(tipo => {
        console.log(`   - ${tipo.Id}: ${tipo.Desc}`);
      });
      if (tiposDoc.length > 5) {
        console.log(`   ... y ${tiposDoc.length - 5} más`);
      }
    } catch (error) {
      console.log('❌ Error en getDocumentTypes:', error.message);
      console.log('💡 Detalles del error:', error);
    }

    // Test getCurrenciesTypes
    console.log('\n🔍 Probando getCurrenciesTypes...');
    try {
      const monedas = await afip.ElectronicBilling.getCurrenciesTypes();
      console.log('✅ getCurrenciesTypes exitoso');
      console.log('📊 Monedas disponibles:', monedas.length);
      monedas.slice(0, 5).forEach(moneda => {
        console.log(`   - ${moneda.Id}: ${moneda.Desc}`);
      });
      if (monedas.length > 5) {
        console.log(`   ... y ${monedas.length - 5} más`);
      }
    } catch (error) {
      console.log('❌ Error en getCurrenciesTypes:', error.message);
      console.log('💡 Detalles del error:', error);
    }

    // Test getSalesPoints
    console.log('\n🔍 Probando getSalesPoints...');
    try {
      const ptosVta = await afip.ElectronicBilling.getSalesPoints();
      console.log('✅ getSalesPoints exitoso');
      console.log('📊 Puntos de venta disponibles:', ptosVta.length);
      ptosVta.forEach(pto => {
        console.log(`   - ${pto.Nro}: ${pto.Desc}`);
      });
      
      // Verificar si el punto de venta configurado está disponible
      const ptoConfigurado = ptosVta.find(pto => pto.Nro === config.pto_vta);
      if (ptoConfigurado) {
        console.log(`✅ Punto de venta ${config.pto_vta} está habilitado`);
      } else {
        console.log(`❌ Punto de venta ${config.pto_vta} NO está habilitado`);
        console.log('💡 Este es probablemente el problema principal');
      }
    } catch (error) {
      console.log('❌ Error en getSalesPoints:', error.message);
      console.log('💡 Detalles del error:', error);
    }

    // 6. Probar obtener último autorizado
    console.log('\n📋 6. Probando getLastVoucher...');
    try {
      const last = await afip.ElectronicBilling.getLastVoucher(config.pto_vta, 11); // Factura C
      console.log('✅ getLastVoucher exitoso para PtoVta', config.pto_vta, 'TipoCbte 11:', last);
    } catch (error) {
      console.log('❌ Error en getLastVoucher:', error.message);
      console.log('💡 Detalles del error:', error);
    }

    console.log('\n📋 7. Resumen y recomendaciones:');
    console.log('💡 Si todos los métodos fallan con 400, el problema es:');
    console.log('   1. Punto de venta no habilitado en AFIP');
    console.log('   2. CUIT no habilitado para facturación electrónica');
    console.log('   3. Certificado sin permisos para el servicio');
    console.log('   4. Entorno incorrecto (homologación vs producción)');
    console.log('\n🔧 Pasos para solucionar:');
    console.log('   1. Ir a AFIP Web y verificar habilitaciones');
    console.log('   2. Verificar que el punto de venta esté habilitado');
    console.log('   3. Verificar que el CUIT tenga permisos de facturación');
    console.log('   4. Verificar que el certificado sea para el entorno correcto');

  } catch (error) {
    console.log('❌ Error general:', error.message);
    console.log('Stack:', error.stack);
  }
}

testAfipHomologacion().catch(console.error);
