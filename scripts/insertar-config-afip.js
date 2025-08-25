/**
 * Script para insertar manualmente configuración de AFIP
 */

const Database = require('better-sqlite3');
const path = require('path');

try {
  const userData = process.env.APPDATA || process.env.HOME || process.env.USERPROFILE;
  const appUserData = path.join(userData, 'mp');
  const dbPath = path.join(appUserData, 'facturas.db');
  
  console.log('📁 Ruta de la base de datos:', dbPath);
  
  const db = new Database(dbPath);
  
  // Configuración de ejemplo (reemplazar con tus datos reales)
  const config = {
    cuit: '20317470747', // Reemplazar con tu CUIT
    pto_vta: 2, // Reemplazar con tu punto de venta
    cert_path: 'C:\\arca\\facturacion_test_36fbb7d1ac71bf1d.crt', // Reemplazar con ruta real
    key_path: 'C:\\arca\\key.key', // Reemplazar con ruta real
    entorno: 'homologacion' // o 'produccion'
  };
  
  console.log('🔧 Insertando configuración:', config);
  
  // Limpiar configuración anterior
  db.prepare('DELETE FROM configuracion_afip').run();
  
  // Insertar nueva configuración
  const result = db.prepare(`
    INSERT INTO configuracion_afip (cuit, pto_vta, cert_path, key_path, entorno) 
    VALUES (?, ?, ?, ?, ?)
  `).run(config.cuit, config.pto_vta, config.cert_path, config.key_path, config.entorno);
  
  console.log('✅ Configuración insertada. ID:', result.lastInsertRowid);
  
  // Verificar que se insertó correctamente
  const inserted = db.prepare('SELECT * FROM configuracion_afip ORDER BY id DESC LIMIT 1').get();
  console.log('📋 Configuración guardada:', inserted);
  
  db.close();
  
  console.log('\n💡 Ahora puedes ejecutar: node test-afip-homologacion.js');
  
} catch (error) {
  console.log('❌ Error:', error.message);
}
