const Database = require('better-sqlite3');
const path = require('path');

const userData = process.env.APPDATA || process.env.HOME || process.env.USERPROFILE;
const appUserData = path.join(userData, 'mp');
const dbPath = path.join(appUserData, 'facturas.db');

console.log('Checking database:', dbPath);

try {
  const db = new Database(dbPath);
  
  const config = db.prepare('SELECT * FROM configuracion_afip ORDER BY id DESC LIMIT 1').get();
  console.log('AFIP Config:', config);
  
  db.close();
} catch (error) {
  console.log('Error:', error.message);
}
