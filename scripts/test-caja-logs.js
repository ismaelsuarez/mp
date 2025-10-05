/**
 * Script de prueba para verificar persistencia de logs de Caja
 * Ejecutar: node scripts/test-caja-logs.js
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Simular el entorno de Electron para obtener userData
let userDataPath;
if (process.platform === 'win32') {
  userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'tc-mp');
} else if (process.platform === 'darwin') {
  userDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'tc-mp');
} else {
  userDataPath = path.join(os.homedir(), '.config', 'tc-mp');
}

const dbPath = path.join(userDataPath, 'queue', 'contingency.db');

console.log('📍 Verificando base de datos de logs...');
console.log('   Ruta:', dbPath);
console.log('   Existe:', fs.existsSync(dbPath) ? '✅ SÍ' : '❌ NO');

if (!fs.existsSync(dbPath)) {
  console.log('\n❌ La base de datos no existe aún.');
  console.log('💡 Solución: Iniciá la aplicación al menos una vez para crear la DB.');
  process.exit(0);
}

const Database = require('better-sqlite3');
const db = new Database(dbPath, { readonly: true });

try {
  // Verificar que existe la tabla caja_logs
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='caja_logs'").all();
  
  if (tables.length === 0) {
    console.log('\n❌ La tabla caja_logs NO existe en la DB.');
    console.log('💡 Solución: Reiniciá la aplicación para ejecutar la migración.');
    process.exit(1);
  }
  
  console.log('\n✅ Tabla caja_logs encontrada\n');
  
  // Contar logs totales
  const total = db.prepare('SELECT COUNT(*) as count FROM caja_logs').get().count;
  console.log(`📊 Total de logs en DB: ${total}`);
  
  // Contar logs de las últimas 24h
  const last24h = db.prepare(
    'SELECT COUNT(*) as count FROM caja_logs WHERE timestamp >= ?'
  ).get(Date.now() - 24 * 60 * 60 * 1000).count;
  console.log(`📊 Logs últimas 24h: ${last24h}`);
  
  // Contar por nivel
  const byLevel = db.prepare('SELECT level, COUNT(*) as count FROM caja_logs GROUP BY level').all();
  console.log('\n📊 Logs por nivel:');
  for (const row of byLevel) {
    console.log(`   ${row.level}: ${row.count}`);
  }
  
  // Mostrar últimos 5 logs
  const recent = db.prepare(`
    SELECT timestamp, level, icon, text, detail 
    FROM caja_logs 
    ORDER BY timestamp DESC 
    LIMIT 5
  `).all();
  
  if (recent.length > 0) {
    console.log('\n📜 Últimos 5 logs:');
    for (const log of recent) {
      const date = new Date(log.timestamp);
      const time = date.toLocaleTimeString('es-AR');
      console.log(`   [${time}] ${log.icon} ${log.text}${log.detail ? ' | ' + log.detail : ''}`);
    }
  } else {
    console.log('\n⚠️  No hay logs en la base de datos aún.');
  }
  
  console.log('\n✅ Verificación completa');
  
} catch (error) {
  console.error('\n❌ Error al consultar la DB:', error.message);
} finally {
  db.close();
}

