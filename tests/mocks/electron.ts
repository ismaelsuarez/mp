/**
 * Mock de Electron para tests
 * 
 * Permite ejecutar tests sin inicializar Electron completo.
 * Este mock proporciona stubs de las APIs más comunes de Electron.
 * 
 * @see https://www.electronjs.org/docs/latest/api/app
 */

import path from 'path';
import os from 'os';

/**
 * Mock del módulo `app` de Electron
 * 
 * Proporciona implementaciones básicas de los métodos más usados:
 * - getPath(): Retorna paths temporales para tests
 * - getVersion(): Versión mock
 * - getName(): Nombre mock
 * - etc.
 */
const mockApp = {
  /**
   * Retorna paths del sistema para tests
   * Todos los paths apuntan a directorios temporales
   */
  getPath: (name: 'home' | 'appData' | 'userData' | 'temp' | 'exe' | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | 'logs' | 'pepperFlashSystemPlugin') => {
    const baseDir = path.join(os.tmpdir(), 'tc-mp-test');
    
    switch (name) {
      case 'userData':
        return path.join(baseDir, 'userdata');
      case 'temp':
        return os.tmpdir();
      case 'home':
        return os.homedir();
      case 'appData':
        return path.join(baseDir, 'appdata');
      case 'logs':
        return path.join(baseDir, 'logs');
      case 'desktop':
        return path.join(os.homedir(), 'Desktop');
      case 'documents':
        return path.join(os.homedir(), 'Documents');
      case 'downloads':
        return path.join(os.homedir(), 'Downloads');
      default:
        return path.join(baseDir, name);
    }
  },

  /**
   * Versión mock de la aplicación
   */
  getVersion: () => '1.0.0-test',

  /**
   * Nombre mock de la aplicación
   */
  getName: () => 'tc-mp-test',

  /**
   * Siempre retorna true en tests
   */
  isReady: () => true,

  /**
   * Retorna inmediatamente (ya está "ready")
   */
  whenReady: () => Promise.resolve(),

  /**
   * Mock de quit (no hace nada en tests)
   */
  quit: () => {
    // En tests, no queremos cerrar el proceso
  },

  /**
   * Mock de exit (cierra el proceso de test si es necesario)
   */
  exit: (code: number = 0) => {
    if (code !== 0) {
      process.exit(code);
    }
  },

  /**
   * Mock de on() para event listeners
   */
  on: (event: string, callback: (...args: any[]) => void) => {
    // No implementado en mock, pero necesario para algunos tests
    return mockApp;
  },

  /**
   * Mock de once() para event listeners
   */
  once: (event: string, callback: (...args: any[]) => void) => {
    // No implementado en mock, pero necesario para algunos tests
    return mockApp;
  },
};

/**
 * Mock del módulo `BrowserWindow` de Electron
 * 
 * Proporciona una implementación básica para tests que requieren ventanas
 */
class MockBrowserWindow {
  webContents = {
    send: () => {},
    on: () => {},
  };
  
  loadURL = () => Promise.resolve();
  loadFile = () => Promise.resolve();
  close = () => {};
  show = () => {};
  hide = () => {};
  destroy = () => {};
  
  on = () => this;
  once = () => this;
}

/**
 * Mock del módulo `ipcMain` de Electron
 * 
 * Proporciona implementaciones básicas de IPC para tests
 */
const mockIpcMain = {
  handle: (channel: string, handler: (...args: any[]) => any) => {
    // En tests, registramos el handler pero no lo ejecutamos automáticamente
  },
  on: (channel: string, handler: (...args: any[]) => void) => {
    // En tests, registramos el listener pero no lo ejecutamos automáticamente
  },
  once: (channel: string, handler: (...args: any[]) => void) => {
    // En tests, registramos el listener pero no lo ejecutamos automáticamente
  },
  removeHandler: (channel: string) => {
    // En tests, no necesitamos limpiar handlers
  },
};

/**
 * Mock del módulo `ipcRenderer` de Electron
 * 
 * Proporciona implementaciones básicas de IPC para renderer
 */
const mockIpcRenderer = {
  invoke: async (channel: string, ...args: any[]) => {
    // En tests, retornamos una promesa vacía
    return Promise.resolve(undefined);
  },
  send: (channel: string, ...args: any[]) => {
    // En tests, no enviamos nada
  },
  on: (channel: string, handler: (...args: any[]) => void) => {
    // En tests, registramos el listener pero no lo ejecutamos
  },
};

/**
 * Exports del mock de Electron
 * 
 * Todos los módulos principales de Electron están mockeados aquí
 */
export const app = mockApp;
export const BrowserWindow = MockBrowserWindow;
export const ipcMain = mockIpcMain;
export const ipcRenderer = mockIpcRenderer;

/**
 * Export default para compatibilidad con diferentes estilos de import
 */
export default {
  app: mockApp,
  BrowserWindow: MockBrowserWindow,
  ipcMain: mockIpcMain,
  ipcRenderer: mockIpcRenderer,
};

