"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
// Cargar variables de entorno para tests
(0, dotenv_1.config)({ path: '.env.test' });
// Configuración global para tests
beforeAll(() => {
    // Configurar timezone para tests
    process.env.TZ = 'America/Argentina/Buenos_Aires';
    // Configurar variables de entorno para tests
    process.env.NODE_ENV = 'test';
    process.env.AFIP_ENTORNO = 'testing';
    // Configurar timeouts más cortos para tests unitarios
    jest.setTimeout(10000);
});
afterAll(() => {
    // Limpiar después de todos los tests
});
// Mock global de console para evitar logs en tests
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
// Mock de electron para tests
jest.mock('electron', () => ({
    app: {
        getPath: jest.fn((path) => {
            if (path === 'userData')
                return './test-data';
            if (path === 'temp')
                return './test-temp';
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
// Mock de fs para evitar operaciones de archivo en tests
jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn()
}));
// Mock de path para tests
jest.mock('path', () => ({
    ...jest.requireActual('path'),
    join: jest.fn((...args) => args.join('/')),
    resolve: jest.fn((...args) => args.join('/'))
}));
