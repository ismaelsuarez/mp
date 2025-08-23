import { config } from 'dotenv';

// Cargar variables de entorno para tests de homologación
config({ path: '.env.homologacion' });

// Configuración específica para tests de homologación
beforeAll(async () => {
  // Configurar timezone
  process.env.TZ = 'America/Argentina/Buenos_Aires';
  process.env.NODE_ENV = 'homologacion';
  process.env.AFIP_ENTORNO = 'homologacion';
  
  // Timeout muy largo para tests de homologación (pueden ser lentos)
  jest.setTimeout(120000);
  
  // Verificar que existan las credenciales de homologación
  const requiredEnvVars = [
    'AFIP_CUIT_HOMOLOGACION',
    'AFIP_CERT_PATH_HOMOLOGACION',
    'AFIP_KEY_PATH_HOMOLOGACION'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(`⚠️  Variables de entorno faltantes para homologación: ${missingVars.join(', ')}`);
    console.warn('Los tests de homologación pueden fallar sin estas variables.');
  }
  
  // Configurar base de datos para homologación
  process.env.DB_PATH = './test-homologacion.db';
  
  // Configurar logging detallado para homologación
  process.env.LOG_LEVEL = 'debug';
  process.env.LOG_TO_FILE = 'true';
});

afterAll(async () => {
  // Limpiar archivos de test de homologación
  const fs = require('fs');
  const path = require('path');
  
  try {
    if (fs.existsSync('./test-homologacion.db')) {
      fs.unlinkSync('./test-homologacion.db');
    }
  } catch (error) {
    console.warn('No se pudo limpiar archivo de test de homologación:', error);
  }
});

// Mock de electron para tests de homologación
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((path: string) => {
      if (path === 'userData') return './test-homologacion-data';
      if (path === 'temp') return './test-homologacion-temp';
      return './test-homologacion-data';
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

// No mockear fs para homologación - necesitamos acceso real a certificados
// No mockear afip.js para homologación - necesitamos comunicación real con AFIP
