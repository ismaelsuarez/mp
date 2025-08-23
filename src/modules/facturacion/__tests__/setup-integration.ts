import { config } from 'dotenv';
import Database from 'better-sqlite3';

// Cargar variables de entorno para tests de integración
config({ path: '.env.test' });

// Configuración específica para tests de integración
beforeAll(async () => {
  // Configurar timezone
  process.env.TZ = 'America/Argentina/Buenos_Aires';
  process.env.NODE_ENV = 'test';
  process.env.AFIP_ENTORNO = 'testing';
  
  // Configurar base de datos en memoria para integración
  process.env.DB_PATH = ':memory:';
  
  // Timeout más largo para tests de integración
  jest.setTimeout(60000);
  
  // Inicializar base de datos de prueba
  const db = new Database(':memory:');
  
  // Crear tablas necesarias para tests de integración
  db.exec(`
    CREATE TABLE IF NOT EXISTS afip_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cuit TEXT NOT NULL,
      cert_path TEXT NOT NULL,
      key_path TEXT NOT NULL,
      entorno TEXT NOT NULL DEFAULT 'testing',
      pto_vta INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS comprobantes_control (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pto_vta INTEGER NOT NULL,
      tipo_cbte INTEGER NOT NULL,
      nro_comprobante INTEGER NOT NULL,
      estado TEXT NOT NULL CHECK (estado IN ('PENDING', 'APPROVED', 'FAILED')),
      cae TEXT,
      cae_vencimiento TEXT,
      payload TEXT,
      error_msg TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(pto_vta, tipo_cbte, nro_comprobante)
    );
    
    CREATE TABLE IF NOT EXISTS facturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero INTEGER NOT NULL,
      pto_vta INTEGER NOT NULL,
      tipo_cbte INTEGER NOT NULL,
      cae TEXT,
      cae_vencimiento TEXT,
      fecha_emision TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Insertar configuración AFIP de prueba
  db.prepare(`
    INSERT OR REPLACE INTO afip_config (cuit, cert_path, key_path, entorno, pto_vta)
    VALUES (?, ?, ?, ?, ?)
  `).run('20123456789', './test-cert.crt', './test-key.key', 'testing', 1);
  
  db.close();
});

afterAll(async () => {
  // Limpiar después de tests de integración
});

// Mock de electron para tests de integración
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((path: string) => {
      if (path === 'userData') return './test-data';
      if (path === 'temp') return './test-temp';
      return './test-data';
    }),
    isPackaged: false
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn()
  }
}));

// Mock de fs para tests de integración
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(() => 'test-cert-content'),
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn()
}));
