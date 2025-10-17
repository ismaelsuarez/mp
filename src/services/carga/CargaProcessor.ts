/**
 * Procesador de archivos a URIs (copiar archivos a múltiples destinos)
 */

import path from 'path';
import fs from 'fs/promises';
import { ensureDir } from './fsUtils';

export type FileToProcess = { realPath: string; targetName: string };

/**
 * Copia cada archivo a todas las URIs especificadas
 * @param files - Array de archivos con sus nombres de destino
 * @param uris - Array de rutas destino (pueden ser locales o UNC)
 */
export async function processFilesToUris(files: FileToProcess[], uris: string[]): Promise<void> {
  for (const file of files) {
    // Leer archivo una vez para copiar a todas las URIs
    const buf = await fs.readFile(file.realPath);
    
    for (const uri of uris) {
      // Respetar mayúsculas tal como vienen en el .txt
      const destDir = uri;
      
      // Crear directorio si no existe (soporte para rutas locales y UNC)
      await ensureDir(destDir);
      
      // Escribir archivo con el nombre de destino
      const destPath = path.join(destDir, file.targetName);
      await fs.writeFile(destPath, buf);
    }
  }
}

