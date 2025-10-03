/**
 * Script de limpieza automática de archivos .res antiguos
 * 
 * Función: Elimina archivos .res mayores a X días de las carpetas done/ y out/
 * Configuración: CLEANUP_RES_DAYS (por defecto 60 días)
 * 
 * Uso:
 *   - Manual: npm run cleanup:res
 *   - Automático: Ejecutado semanalmente por el sistema
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface CleanupResult {
  ok: boolean;
  deleted: number;
  totalSize: number;
  files: string[];
  error?: string;
}

interface CleanupOptions {
  daysToKeep?: number;
  dryRun?: boolean;
}

/**
 * Limpia archivos .res antiguos de las carpetas especificadas
 */
export async function cleanupOldResFiles(options: CleanupOptions = {}): Promise<CleanupResult> {
  const daysToKeep = options.daysToKeep || 60;
  const dryRun = options.dryRun || false;
  
  const result: CleanupResult = {
    ok: true,
    deleted: 0,
    totalSize: 0,
    files: []
  };

  try {
    const userData = app.getPath('userData');
    const facBase = path.join(userData, 'fac');
    
    // Solo limpiar done/ y out/ (NO processing/)
    const targetDirs = [
      path.join(facBase, 'done'),
      path.join(facBase, 'out')
    ];

    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000; // días a milisegundos
    const cutoffDate = now - maxAge;

    console.log(`[cleanup-res] Iniciando limpieza de archivos .res > ${daysToKeep} días`);
    console.log(`[cleanup-res] Fecha límite: ${new Date(cutoffDate).toISOString()}`);
    console.log(`[cleanup-res] Modo: ${dryRun ? 'DRY-RUN (simulación)' : 'ELIMINACIÓN REAL'}`);

    for (const dir of targetDirs) {
      if (!fs.existsSync(dir)) {
        console.log(`[cleanup-res] Directorio no existe: ${dir}`);
        continue;
      }

      let files: string[] = [];
      try {
        files = fs.readdirSync(dir);
      } catch (e) {
        console.error(`[cleanup-res] Error leyendo directorio ${dir}:`, e);
        continue;
      }

      for (const fileName of files) {
        if (!fileName.toLowerCase().endsWith('.res')) continue;

        const filePath = path.join(dir, fileName);
        
        try {
          const stats = fs.statSync(filePath);
          const fileAge = now - stats.mtimeMs;

          if (fileAge > maxAge) {
            const fileSize = stats.size;
            const fileDate = new Date(stats.mtime).toISOString().split('T')[0];
            
            console.log(`[cleanup-res] ${dryRun ? '[DRY-RUN]' : ''} Eliminando: ${fileName} (${fileDate}, ${fileSize} bytes)`);
            
            if (!dryRun) {
              fs.unlinkSync(filePath);
            }
            
            result.deleted++;
            result.totalSize += fileSize;
            result.files.push(fileName);
          }
        } catch (e) {
          console.error(`[cleanup-res] Error procesando ${fileName}:`, e);
        }
      }
    }

    const sizeMB = (result.totalSize / 1024 / 1024).toFixed(2);
    console.log(`[cleanup-res] Completado: ${result.deleted} archivos eliminados (${sizeMB} MB liberados)`);
    
    return result;
  } catch (e: any) {
    console.error('[cleanup-res] Error general:', e);
    return {
      ok: false,
      deleted: 0,
      totalSize: 0,
      files: [],
      error: String(e?.message || e)
    };
  }
}

/**
 * Ejecución standalone CLI (solo para desarrollo/scripts npm)
 * En producción (Electron build) se ejecuta vía IPC handler
 */
export async function runCleanupCLI(): Promise<void> {
  // Mock de app.getPath si no está en contexto Electron (CLI)
  if (!app || !app.getPath) {
    (global as any).app = {
      getPath: (name: string) => {
        if (name === 'userData') {
          return path.join(process.env.APPDATA || '', 'Tc-Mp');
        }
        return '';
      }
    };
  }
  
  const dryRun = process.argv.includes('--dry-run');
  const result = await cleanupOldResFiles({ dryRun });
  console.log('Resultado final:', result);
  process.exit(result.ok ? 0 : 1);
}

// Auto-ejecutar si se llama directamente (npm run cleanup:res)
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('cleanup-res')) {
  runCleanupCLI().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
}

