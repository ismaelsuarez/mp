/**
 * Utilidades de sistema de archivos para Carga
 */

import fs from 'fs/promises';

/**
 * Crea un directorio de forma recursiva si no existe
 */
export async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err: any) {
    // Si el directorio ya existe, no es un error
    if (err.code !== 'EEXIST') throw err;
  }
}

