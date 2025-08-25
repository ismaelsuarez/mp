/**
 * Script para inicializar manualmente la base de datos
 * Ejecutar con: node inicializar-db.js
 */

const path = require('path');
const fs = require('fs');

async function inicializarDB() {
  console.log('🔧 Inicializando base de datos...\n');

  try {
    // 1. Verificar better-sqlite3
    console.log('📋 1. Verificando better-sqlite3...');
    let Database = null;
    try {
      Database = require('better-sqlite3');
      console.log('✅ better-sqlite3 está disponible');
    } catch (error) {
      console.log('❌ better-sqlite3 NO está disponible:', error.message);
      return;
    }

    // 2. Crear directorio de datos
    console.log('\n📋 2. Creando directorio de datos...');
    const userData = process.env.APPDATA || process.env.HOME || process.env.USERPROFILE;
    const appUserData = path.join(userData, 'mp');
    
    if (!fs.existsSync(appUserData)) {
      fs.mkdirSync(appUserData, { recursive: true });
      console.log('✅ Directorio creado:', appUserData);
    } else {
      console.log('✅ Directorio ya existe:', appUserData);
    }

    // 3. Crear base de datos SQLite
    console.log('\n📋 3. Creando base de datos SQLite...');
    const dbPath = path.join(appUserData, 'facturas.db');
    
    if (fs.existsSync(dbPath)) {
      console.log('⚠️  Base de datos ya existe, se eliminará y recreará');
      fs.unlinkSync(dbPath);
    }
    
    const db = new Database(dbPath);
    console.log('✅ Base de datos creada:', dbPath);

    // 4. Crear tablas
    console.log('\n📋 4. Creando tablas...');
    
    // Tabla de configuración AFIP
    db.exec(`CREATE TABLE IF NOT EXISTS configuracion_afip (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cuit TEXT NOT NULL,
      pto_vta INTEGER NOT NULL,
      cert_path TEXT NOT NULL,
      key_path TEXT NOT NULL,
      entorno TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('✅ Tabla configuracion_afip creada');

    // Tabla de facturas AFIP
    db.exec(`CREATE TABLE IF NOT EXISTS facturas_afip (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero INTEGER NOT NULL,
      pto_vta INTEGER NOT NULL,
      tipo_cbte INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      cuit_emisor TEXT NOT NULL,
      cuit_receptor TEXT,
      razon_social_receptor TEXT,
      condicion_iva_receptor TEXT,
      neto REAL NOT NULL,
      iva REAL NOT NULL,
      total REAL NOT NULL,
      cae TEXT NOT NULL,
      cae_vencimiento TEXT NOT NULL,
      qr_url TEXT NOT NULL,
      pdf_path TEXT NOT NULL,
      provincia TEXT,
      provincia_estado TEXT,
      provincia_servicio TEXT,
      provincia_numero TEXT,
      provincia_codigo TEXT,
      provincia_respuesta TEXT,
      provincia_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('✅ Tabla facturas_afip creada');

    // Tabla de estado de facturas
    db.exec(`CREATE TABLE IF NOT EXISTS facturas_estado (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero INTEGER NOT NULL,
      pto_vta INTEGER NOT NULL,
      tipo_cbte INTEGER NOT NULL,
      estado TEXT NOT NULL,
      error_msg TEXT,
      payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('✅ Tabla facturas_estado creada');

    // Tabla de control de idempotencia
    db.exec(`CREATE TABLE IF NOT EXISTS comprobantes_control (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pto_vta INTEGER NOT NULL,
      tipo_cbte INTEGER NOT NULL,
      nro_comprobante INTEGER NOT NULL,
      estado TEXT NOT NULL,
      cae TEXT,
      cae_vencimiento TEXT,
      payload TEXT,
      error_msg TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(pto_vta, tipo_cbte, nro_comprobante)
    )`);
    console.log('✅ Tabla comprobantes_control creada');

    // Tabla de configuración de empresa
    db.exec(`CREATE TABLE IF NOT EXISTS empresa_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      razon_social TEXT NOT NULL,
      cuit TEXT NOT NULL,
      domicilio TEXT,
      condicion_iva TEXT NOT NULL,
      logo_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('✅ Tabla empresa_config creada');

    // Tabla de parámetros de facturación
    db.exec(`CREATE TABLE IF NOT EXISTS parametros_facturacion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo_defecto TEXT NOT NULL,
      pto_vta INTEGER NOT NULL,
      numeracion TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('✅ Tabla parametros_facturacion creada');

    // 5. Insertar datos de ejemplo (opcional)
    console.log('\n📋 5. Insertando datos de ejemplo...');
    
    // Configuración de empresa de ejemplo
    db.prepare(`INSERT INTO empresa_config (razon_social, cuit, domicilio, condicion_iva) 
                VALUES (?, ?, ?, ?)`).run(
      'EMPRESA EJEMPLO S.A.',
      '20345678901',
      'Av. Ejemplo 123, CABA',
      'RI'
    );
    console.log('✅ Datos de empresa insertados');

    // Parámetros de facturación de ejemplo
    db.prepare(`INSERT INTO parametros_facturacion (tipo_defecto, pto_vta, numeracion) 
                VALUES (?, ?, ?)`).run('FA', 1, 'A-0001-00000001');
    console.log('✅ Parámetros de facturación insertados');

    // 6. Verificar tablas creadas
    console.log('\n📋 6. Verificando tablas creadas...');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('📊 Tablas en la base de datos:');
    tables.forEach(table => {
      console.log('   -', table.name);
    });

    // 7. Verificar datos insertados
    console.log('\n📋 7. Verificando datos insertados...');
    const empresa = db.prepare('SELECT * FROM empresa_config ORDER BY id DESC LIMIT 1').get();
    if (empresa) {
      console.log('✅ Empresa configurada:', empresa.razon_social);
    }

    const params = db.prepare('SELECT * FROM parametros_facturacion ORDER BY id DESC LIMIT 1').get();
    if (params) {
      console.log('✅ Parámetros configurados:', params.tipo_defecto, 'PtoVta:', params.pto_vta);
    }

    db.close();
    console.log('\n✅ Base de datos inicializada correctamente');
    console.log('💡 Ahora puedes configurar AFIP desde la interfaz de administración');

  } catch (error) {
    console.log('❌ Error inicializando base de datos:', error.message);
    console.log('Stack:', error.stack);
  }
}

inicializarDB().catch(console.error);
