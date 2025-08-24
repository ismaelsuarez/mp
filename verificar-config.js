/**
 * Script para verificar la configuración de AFIP
 */

const Database = require('better-sqlite3');
const path = require('path');

try {
  const userData = process.env.APPDATA || process.env.HOME || process.env.USERPROFILE;
  const appUserData = path.join(userData, 'mp');
  const dbPath = path.join(appUserData, 'facturas.db');
  
  console.log('📁 Ruta de la base de datos:', dbPath);
  
  const db = new Database(dbPath);
  
  // Verificar tablas
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('📊 Tablas en la base de datos:', tables.map(t => t.name));
  
  // Verificar configuración AFIP
  const config = db.prepare('SELECT * FROM configuracion_afip ORDER BY id DESC LIMIT 1').get();
  console.log('🔧 Configuración AFIP:', config);
  
  // Verificar empresa
  const empresa = db.prepare('SELECT * FROM empresa_config ORDER BY id DESC LIMIT 1').get();
  console.log('🏢 Configuración Empresa:', empresa);
  
  // Verificar parámetros
  const params = db.prepare('SELECT * FROM parametros_facturacion ORDER BY id DESC LIMIT 1').get();
  console.log('⚙️ Parámetros:', params);
  
  db.close();
  
} catch (error) {
  console.log('❌ Error:', error.message);
}
