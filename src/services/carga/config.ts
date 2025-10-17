/**
 * Configuración para el sistema de Carga
 * (sin depender de .env, todo hardcoded como constantes)
 */

import { app } from 'electron';
import path from 'path';
import os from 'os';

// 🔥 Usar AppData\Roaming\tc-mp\carga\ como otros servicios
const getUserDataPath = () => {
  try {
    return app.getPath('userData');
  } catch {
    // Fallback: usar el HOME del usuario actual, no "Default"
    const home = os.homedir() || process.env.USERPROFILE || process.env.HOME;
    return path.join(home, 'AppData', 'Roaming', 'tc-mp');
  }
};

export const CARGA_SOURCE_DIR = 'C:\\tmp';                                       // watcher
export const CARGA_WORK_DIR   = path.join(getUserDataPath(), 'carga', 'work');  // donde se mueve el .txt para trabajar
export const CARGA_OK_DIR     = path.join(getUserDataPath(), 'carga', 'ok');    // archivar .txt exitosos
export const CARGA_ERR_DIR    = path.join(getUserDataPath(), 'carga', 'error'); // si falla algo
export const SUCCESS_MILLISECONDS = 2000;                                        // cartel OK
export const WINDOW_DIMENSIONS = { width: 900, height: 620 };                   // tamaño razonable

