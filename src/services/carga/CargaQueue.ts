/**
 * Cola FIFO para procesar múltiples archivos carga*.txt de forma secuencial
 */

import { openCargaWindow } from './cargaWindow';
import { parseCargaTxt } from './CargaParser';
import fs from 'fs/promises';
import { CARGA_ERR_DIR, CARGA_WORK_DIR } from './config';
import { ensureDir } from './fsUtils';
import path from 'path';

type QueueItem = { txtPath: string; filename: string };

const q: QueueItem[] = [];
let busy = false;
const processing = new Set<string>(); // 🔥 Evitar duplicados

/**
 * Encola un archivo carga*.txt para procesar
 */
export async function enqueueCarga(txtPath: string, filename: string): Promise<void> {
  // Evitar encolar si ya está en procesamiento o en la cola
  const key = filename.toLowerCase();
  if (processing.has(key)) {
    console.log('[carga] Ya está en procesamiento, ignorando:', { filename });
    return;
  }
  if (q.find(item => item.filename.toLowerCase() === key)) {
    console.log('[carga] Ya está en cola, ignorando:', { filename });
    return;
  }
  
  console.log('[carga] Encolando', { txtPath, filename });
  q.push({ txtPath, filename });
  if (!busy) processQueue();
}

/**
 * Procesa la cola de forma secuencial (uno por vez)
 */
async function processQueue() {
  busy = true;
  while (q.length > 0) {
    const item = q.shift();
    if (!item) break;
    
    const { txtPath, filename } = item;
    const key = filename.toLowerCase();
    
    // Marcar como en procesamiento
    processing.add(key);
    
    try {
      console.log('[carga] Procesando', { txtPath, filename });
      
      // Esperar a que el archivo esté estable (FTP puede estar escribiendo)
      await waitForStableFile(txtPath);
      
      // Mover a carpeta de trabajo
      await ensureDir(CARGA_WORK_DIR);
      const workPath = path.join(CARGA_WORK_DIR, filename);
      
      try {
        await fs.rename(txtPath, workPath);
      } catch (err: any) {
        // Si el archivo ya no existe, puede ser que ya se movió
        if (err.code === 'ENOENT') {
          console.warn('[carga] Archivo ya no existe (posiblemente ya movido)', { txtPath });
          processing.delete(key);
          continue;
        }
        throw err;
      }
      
      // Parsear contenido
      const parsed = await parseCargaTxt(workPath);
      
      console.log('[carga] Archivo parseado exitosamente:', { filename, parsed });
      
      // Abrir ventana y esperar que el usuario procese/cancele
      await openCargaWindow({ txtPath: workPath, parsed, filename });
      
      console.log('[carga] Ventana cerrada', { filename });
    } catch (err: any) {
      console.error('[carga] Error al procesar', { txtPath, error: err?.message || String(err) });
      
      // Mover a carpeta de error (opcional)
      try {
        await ensureDir(CARGA_ERR_DIR);
        const errPath = path.join(CARGA_ERR_DIR, filename);
        await fs.rename(txtPath, errPath).catch(() => {
          // Si ya está en cargas_work, mover desde ahí
          const workPath = path.join(CARGA_WORK_DIR, filename);
          return fs.rename(workPath, errPath);
        });
        console.log('[carga] Movido a error', { filename });
      } catch {}
    } finally {
      // Remover de procesamiento
      processing.delete(key);
    }
  }
  busy = false;
}

/**
 * Espera a que el archivo esté estable (tamaño no cambie durante 300ms)
 */
async function waitForStableFile(filePath: string, maxAttempts = 10): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const stat1 = await fs.stat(filePath);
      await new Promise(r => setTimeout(r, 300));
      const stat2 = await fs.stat(filePath);
      
      if (stat1.size === stat2.size && stat1.mtimeMs === stat2.mtimeMs) {
        return; // Archivo estable
      }
    } catch (err: any) {
      if (err.code === 'ENOENT') throw new Error('Archivo desapareció');
      // Otro error, reintentar
    }
  }
  throw new Error('Archivo no se estabilizó después de múltiples intentos');
}

