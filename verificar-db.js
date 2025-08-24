/**
 * Script para verificar el estado de la base de datos y configuración AFIP
 * Ejecutar con: node verificar-db.js
 */

const path = require('path');
const fs = require('fs');

async function verificarDB() {
  console.log('🔍 Verificando estado de la base de datos...\n');

  try {
    // 1. Verificar si better-sqlite3 está disponible
    console.log('📋 1. Verificando better-sqlite3...');
    let Database = null;
    try {
      Database = require('better-sqlite3');
      console.log('✅ better-sqlite3 está disponible');
    } catch (error) {
      console.log('❌ better-sqlite3 NO está disponible:', error.message);
      console.log('💡 La aplicación usará el modo fallback (JSON)');
    }

    // 2. Verificar archivos de datos
    console.log('\n📋 2. Verificando archivos de datos...');
    
    // Buscar la ruta de userData (similar a como lo hace la app)
    const userData = process.env.APPDATA || process.env.HOME || process.env.USERPROFILE;
    const appUserData = path.join(userData, 'mp');
    const dbPath = path.join(appUserData, 'facturas.db');
    const fallbackPath = path.join(appUserData, 'facturas-fallback.json');
    
    console.log('📁 Ruta de userData:', appUserData);
    console.log('📁 Ruta de base de datos SQLite:', dbPath);
    console.log('📁 Ruta de archivo fallback JSON:', fallbackPath);
    
    // Verificar si existe la base de datos SQLite
    if (fs.existsSync(dbPath)) {
      console.log('✅ Base de datos SQLite existe');
      console.log('📊 Tamaño:', fs.statSync(dbPath).size, 'bytes');
    } else {
      console.log('❌ Base de datos SQLite NO existe');
    }
    
    // Verificar si existe el archivo fallback
    if (fs.existsSync(fallbackPath)) {
      console.log('✅ Archivo fallback JSON existe');
      console.log('📊 Tamaño:', fs.statSync(fallbackPath).size, 'bytes');
      
      // Leer contenido del fallback
      try {
        const fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
        console.log('📄 Contenido del fallback:');
        console.log('   - configuracion_afip:', fallbackData.configuracion_afip ? 'CONFIGURADO' : 'NO CONFIGURADO');
        console.log('   - facturas_afip:', fallbackData.facturas_afip ? fallbackData.facturas_afip.length : 0, 'registros');
        console.log('   - facturas_estado:', fallbackData.facturas_estado ? fallbackData.facturas_estado.length : 0, 'registros');
        
        if (fallbackData.configuracion_afip) {
          console.log('🔧 Configuración AFIP encontrada:');
          console.log('   - CUIT:', fallbackData.configuracion_afip.cuit);
          console.log('   - Punto de Venta:', fallbackData.configuracion_afip.pto_vta);
          console.log('   - Entorno:', fallbackData.configuracion_afip.entorno);
          console.log('   - Certificado:', fallbackData.configuracion_afip.cert_path);
          console.log('   - Clave:', fallbackData.configuracion_afip.key_path);
          
          // Verificar si los archivos de certificado existen
          if (fs.existsSync(fallbackData.configuracion_afip.cert_path)) {
            console.log('✅ Certificado existe');
          } else {
            console.log('❌ Certificado NO existe en:', fallbackData.configuracion_afip.cert_path);
          }
          
          if (fs.existsSync(fallbackData.configuracion_afip.key_path)) {
            console.log('✅ Clave privada existe');
          } else {
            console.log('❌ Clave privada NO existe en:', fallbackData.configuracion_afip.key_path);
          }
        }
      } catch (error) {
        console.log('❌ Error leyendo archivo fallback:', error.message);
      }
    } else {
      console.log('❌ Archivo fallback JSON NO existe');
    }

    // 3. Intentar conectar a la base de datos SQLite si está disponible
    if (Database && fs.existsSync(dbPath)) {
      console.log('\n📋 3. Probando conexión a SQLite...');
      try {
        const db = new Database(dbPath);
        console.log('✅ Conexión a SQLite exitosa');
        
        // Verificar tabla de configuración AFIP
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        console.log('📊 Tablas en la base de datos:', tables.map(t => t.name));
        
        if (tables.some(t => t.name === 'configuracion_afip')) {
          console.log('✅ Tabla configuracion_afip existe');
          
          const config = db.prepare('SELECT * FROM configuracion_afip ORDER BY id DESC LIMIT 1').get();
          if (config) {
            console.log('🔧 Configuración AFIP en SQLite:');
            console.log('   - CUIT:', config.cuit);
            console.log('   - Punto de Venta:', config.pto_vta);
            console.log('   - Entorno:', config.entorno);
            console.log('   - Certificado:', config.cert_path);
            console.log('   - Clave:', config.key_path);
          } else {
            console.log('❌ No hay configuración AFIP en SQLite');
          }
        } else {
          console.log('❌ Tabla configuracion_afip NO existe');
        }
        
        db.close();
      } catch (error) {
        console.log('❌ Error conectando a SQLite:', error.message);
      }
    }

    console.log('\n📋 4. Resumen:');
    if (Database && fs.existsSync(dbPath)) {
      console.log('✅ La aplicación debería usar SQLite');
    } else {
      console.log('⚠️  La aplicación usará modo fallback (JSON)');
    }

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

verificarDB().catch(console.error);
