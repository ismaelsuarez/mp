/**
 * Procesador de archivos a URIs (copiar archivos a múltiples destinos)
 */

import path from 'path';
import fs from 'fs/promises';
import fssync from 'fs';
// Sin diálogos: obedecemos la política seleccionada desde el renderer
// (skip/overwrite/next). Aquí solo respetamos 'skip' y 'overwrite'.

export type FileToProcess = { realPath: string; targetName: string };
export type WriteMode = 'overwrite' | 'skip';

/**
 * Crea un directorio de forma recursiva con mejor manejo de rutas UNC
 */
async function ensureDirRecursive(dir: string): Promise<void> {
  try {
    // Normalizar ruta (maneja \\ y barras)
    const normalized = path.normalize(dir);
    
    // Verificar si ya existe
    if (fssync.existsSync(normalized)) {
      return;
    }
    
    // Crear recursivamente
    await fs.mkdir(normalized, { recursive: true });
    console.log('[carga.processor] Directorio creado:', normalized);
  } catch (err: any) {
    // Si el error es que ya existe, ignorar
    if (err.code === 'EEXIST') {
      return;
    }
    throw new Error(`No se pudo crear el directorio ${dir}: ${err.message}`);
  }
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

/**
 * Copia cada archivo a todas las URIs especificadas
 * @param files - Array de archivos con sus nombres de destino
 * @param uris - Array de rutas destino (pueden ser locales o UNC)
 */
export async function processFilesToUris(files: FileToProcess[], uris: string[], mode: WriteMode = 'overwrite'): Promise<void> {
  const results: { file: string; uri: string; success: boolean; skipped?: boolean }[] = [];
  
  for (const file of files) {
    console.log('[carga.processor] Procesando archivo:', file.targetName);
    
    // Leer archivo una vez para copiar a todas las URIs
    const buf = await fs.readFile(file.realPath);
    console.log('[carga.processor] Archivo leído, tamaño:', buf.length, 'bytes');
    
    for (const uri of uris) {
      try {
        // Normalizar y respetar mayúsculas
        const destDir = path.normalize(uri);
        
        console.log('[carga.processor] Procesando URI:', destDir);
        
        // Crear directorio si no existe
        await ensureDirRecursive(destDir);
        
        // Ruta completa del archivo destino
        const destPath = path.join(destDir, file.targetName);
        
        // Política sin diálogos: si es skip y existe, omitir
        if (mode === 'skip' && await fileExists(destPath)) {
          console.log('[carga.processor] Omitido por política skip:', destPath);
          results.push({ file: file.targetName, uri: destDir, success: true, skipped: true });
          continue;
        }
        
        // Escribir archivo
        await fs.writeFile(destPath, buf);
        console.log('[carga.processor] ✅ Archivo copiado:', destPath);
        results.push({ file: file.targetName, uri: destDir, success: true });
        
      } catch (err: any) {
        console.error('[carga.processor] ❌ Error al procesar URI:', uri, err);
        results.push({ file: file.targetName, uri, success: false });
        
        // Mostrar error específico al usuario
        const errorMsg = err.code === 'EPERM' 
          ? `Sin permisos para escribir en:\n${uri}\n\nVerifique que:\n- La ruta es correcta\n- Tiene permisos de escritura\n- La carpeta compartida está accesible`
          : `Error al copiar a ${uri}:\n${err.message}`;
        
        throw new Error(errorMsg);
      }
    }
  }
  
  // Resumen
  const total = results.length;
  const successful = results.filter(r => r.success && !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log('[carga.processor] Resumen:', { total, successful, skipped, failed });
}

