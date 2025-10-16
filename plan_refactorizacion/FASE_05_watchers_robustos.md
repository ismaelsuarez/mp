# Fase 5: Watchers Robustos a Prueba de Fallos

**Estado**: ⏳ PENDIENTE (después de Fase 4)

**Duración estimada**: 1 semana

**Rama**: `refactor/robust-watchers`

## Objetivo

Implementar watchers a prueba de fallos que: eviten archivos parciales, prevengan reprocesos, manejen backpressure con cola, y permitan restart seguro sin perder archivos.

## Principio Fundamental

> "0 reprocesos, 0 lecturas parciales, 0 archivos perdidos. Rename atómico, dedupe por hash, cola con límite."

## Problemas Comunes a Resolver

1. **Archivos parciales**: Leer antes de que termine de escribirse
2. **Reprocesos**: Procesar el mismo archivo múltiples veces
3. **Backpressure**: Demasiados archivos a la vez saturan el sistema
4. **Restart inseguro**: Perder archivos durante reinicio de watcher
5. **Archivos bloqueados**: No poder mover/procesar archivos en uso

## Tareas Detalladas

### 1. Instalar Dependencias

```bash
pnpm add chokidar p-limit p-queue
```

### 2. Safe Watcher con awaitWriteFinish

#### 2.1 packages/infra/src/watchers/SafeWatcher.ts

```typescript
import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import PQueue from 'p-queue';
import { logger, createLogger } from '../logger';
import { v4 as uuidv4 } from 'uuid';

export interface WatcherConfig {
  watchPath: string;
  processingPath: string;
  donePath: string;
  errorPath: string;
  pattern?: string | RegExp;
  concurrency?: number;
  awaitWriteFinish?: {
    stabilityThreshold: number;
    pollInterval: number;
  };
  dedupe?: {
    enabled: boolean;
    ttl: number; // milliseconds
  };
}

export interface ProcessorFunction {
  (filePath: string, correlationId: string): Promise<void>;
}

export class SafeWatcher {
  private watcher?: FSWatcher;
  private queue: PQueue;
  private config: Required<WatcherConfig>;
  private processor: ProcessorFunction;
  private processedHashes: Map<string, number>; // hash -> timestamp
  private isShuttingDown: boolean = false;
  
  constructor(
    config: WatcherConfig,
    processor: ProcessorFunction
  ) {
    this.config = {
      ...config,
      pattern: config.pattern || /\.fac$/,
      concurrency: config.concurrency || 2,
      awaitWriteFinish: config.awaitWriteFinish || {
        stabilityThreshold: 2000,
        pollInterval: 100
      },
      dedupe: config.dedupe || {
        enabled: true,
        ttl: 60000 // 1 minuto
      }
    };
    
    this.processor = processor;
    this.processedHashes = new Map();
    
    // Cola con límite de concurrencia
    this.queue = new PQueue({
      concurrency: this.config.concurrency,
      autoStart: true
    });
    
    // Limpiar hashes viejos periódicamente
    if (this.config.dedupe.enabled) {
      setInterval(() => this.cleanOldHashes(), 60000);
    }
  }
  
  /**
   * Iniciar watcher
   */
  async start(): Promise<void> {
    await this.ensureDirectories();
    
    logger.info('Starting watcher', {
      watchPath: this.config.watchPath,
      concurrency: this.config.concurrency
    });
    
    this.watcher = chokidar.watch(this.config.watchPath, {
      ignored: /(^|[\/\\])\../, // Ignorar archivos ocultos
      persistent: true,
      awaitWriteFinish: this.config.awaitWriteFinish,
      ignoreInitial: false // Procesar archivos existentes
    });
    
    this.watcher.on('add', (filePath) => this.onFileAdded(filePath));
    this.watcher.on('error', (error) => {
      logger.error('Watcher error', error);
    });
    
    logger.info('Watcher started successfully');
  }
  
  /**
   * Detener watcher de forma segura
   */
  async stop(): Promise<void> {
    this.isShuttingDown = true;
    
    logger.info('Stopping watcher...', {
      pendingJobs: this.queue.size + this.queue.pending
    });
    
    // Detener watcher (no aceptar más archivos)
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
    
    // Esperar a que termine la cola
    await this.queue.onIdle();
    
    logger.info('Watcher stopped');
    this.isShuttingDown = false;
  }
  
  /**
   * Reiniciar watcher
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }
  
  /**
   * Archivo detectado
   */
  private async onFileAdded(filePath: string): Promise<void> {
    // Verificar pattern
    const filename = path.basename(filePath);
    if (!this.matchesPattern(filename)) {
      return;
    }
    
    const correlationId = uuidv4();
    const log = createLogger(correlationId);
    
    log.info('File detected', { filePath });
    
    // Agregar a cola para procesamiento
    this.queue.add(async () => {
      await this.processFile(filePath, correlationId);
    }).catch((error) => {
      log.error('Failed to queue file', error, { filePath });
    });
  }
  
  /**
   * Procesar archivo
   */
  private async processFile(filePath: string, correlationId: string): Promise<void> {
    const log = createLogger(correlationId);
    const filename = path.basename(filePath);
    
    // Path de procesamiento (.processing/)
    const processingPath = path.join(this.config.processingPath, filename);
    
    try {
      // 1. Verificar que el archivo aún existe
      await fs.access(filePath);
      
      // 2. Calcular hash para dedupe
      if (this.config.dedupe.enabled) {
        const hash = await this.calculateHash(filePath);
        
        if (this.isDuplicate(hash)) {
          log.warn('Duplicate file detected, skipping', { filePath, hash });
          await this.moveToFolder(filePath, this.config.donePath, filename);
          return;
        }
        
        this.markAsProcessed(hash);
      }
      
      // 3. Mover a .processing/ (rename atómico)
      await this.moveToFolder(filePath, this.config.processingPath, filename);
      
      // 4. Procesar desde .processing/
      await this.processor(processingPath, correlationId);
      
      // 5. Mover a .done/
      await this.moveToFolder(processingPath, this.config.donePath, filename);
      
      log.info('File processed successfully', { filePath });
      
    } catch (error) {
      log.error('Error processing file', error as Error, { filePath });
      
      // Mover a .error/
      try {
        // Si está en .processing/, mover desde ahí
        const sourceFile = await fs.access(processingPath)
          .then(() => processingPath)
          .catch(() => filePath);
        
        await this.moveToFolder(sourceFile, this.config.errorPath, filename);
      } catch (moveError) {
        log.error('Failed to move file to error folder', moveError as Error);
      }
    }
  }
  
  /**
   * Calcular hash SHA256 del archivo
   */
  private async calculateHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }
  
  /**
   * Verificar si es duplicado
   */
  private isDuplicate(hash: string): boolean {
    const timestamp = this.processedHashes.get(hash);
    if (!timestamp) return false;
    
    // Si el hash es reciente (dentro del TTL), es duplicado
    const now = Date.now();
    return (now - timestamp) < this.config.dedupe.ttl;
  }
  
  /**
   * Marcar como procesado
   */
  private markAsProcessed(hash: string): void {
    this.processedHashes.set(hash, Date.now());
  }
  
  /**
   * Limpiar hashes viejos
   */
  private cleanOldHashes(): void {
    const now = Date.now();
    const ttl = this.config.dedupe.ttl;
    
    for (const [hash, timestamp] of this.processedHashes.entries()) {
      if (now - timestamp > ttl) {
        this.processedHashes.delete(hash);
      }
    }
  }
  
  /**
   * Mover archivo a carpeta (rename atómico)
   */
  private async moveToFolder(
    sourcePath: string,
    targetFolder: string,
    filename: string
  ): Promise<void> {
    const targetPath = path.join(targetFolder, filename);
    
    // Si el archivo ya existe en destino, agregar timestamp
    let finalTargetPath = targetPath;
    try {
      await fs.access(targetPath);
      const timestamp = Date.now();
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      finalTargetPath = path.join(targetFolder, `${base}_${timestamp}${ext}`);
    } catch {
      // No existe, usar path original
    }
    
    // Rename atómico
    await fs.rename(sourcePath, finalTargetPath);
  }
  
  /**
   * Verificar si filename coincide con pattern
   */
  private matchesPattern(filename: string): boolean {
    const pattern = this.config.pattern;
    
    if (typeof pattern === 'string') {
      return filename.includes(pattern);
    }
    
    if (pattern instanceof RegExp) {
      return pattern.test(filename);
    }
    
    return true;
  }
  
  /**
   * Asegurar que existen los directorios
   */
  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.config.watchPath, { recursive: true });
    await fs.mkdir(this.config.processingPath, { recursive: true });
    await fs.mkdir(this.config.donePath, { recursive: true });
    await fs.mkdir(this.config.errorPath, { recursive: true });
  }
  
  /**
   * Obtener estado del watcher
   */
  getStatus() {
    return {
      isRunning: !!this.watcher,
      queueSize: this.queue.size,
      pending: this.queue.pending,
      processedCount: this.processedHashes.size
    };
  }
}
```

### 3. Watcher Manager (Múltiples Watchers)

#### 3.1 packages/infra/src/watchers/WatcherManager.ts

```typescript
import { SafeWatcher, WatcherConfig, ProcessorFunction } from './SafeWatcher';
import { logger } from '../logger';

export class WatcherManager {
  private watchers: Map<string, SafeWatcher> = new Map();
  
  /**
   * Registrar un watcher
   */
  register(
    id: string,
    config: WatcherConfig,
    processor: ProcessorFunction
  ): void {
    if (this.watchers.has(id)) {
      throw new Error(`Watcher ${id} already registered`);
    }
    
    const watcher = new SafeWatcher(config, processor);
    this.watchers.set(id, watcher);
    
    logger.info('Watcher registered', { id, watchPath: config.watchPath });
  }
  
  /**
   * Iniciar watcher
   */
  async start(id: string): Promise<void> {
    const watcher = this.watchers.get(id);
    if (!watcher) {
      throw new Error(`Watcher ${id} not found`);
    }
    
    await watcher.start();
  }
  
  /**
   * Detener watcher
   */
  async stop(id: string): Promise<void> {
    const watcher = this.watchers.get(id);
    if (!watcher) {
      throw new Error(`Watcher ${id} not found`);
    }
    
    await watcher.stop();
  }
  
  /**
   * Reiniciar watcher
   */
  async restart(id: string): Promise<void> {
    const watcher = this.watchers.get(id);
    if (!watcher) {
      throw new Error(`Watcher ${id} not found`);
    }
    
    await watcher.restart();
  }
  
  /**
   * Iniciar todos los watchers
   */
  async startAll(): Promise<void> {
    const promises = Array.from(this.watchers.keys()).map((id) => this.start(id));
    await Promise.all(promises);
  }
  
  /**
   * Detener todos los watchers
   */
  async stopAll(): Promise<void> {
    const promises = Array.from(this.watchers.keys()).map((id) => this.stop(id));
    await Promise.all(promises);
  }
  
  /**
   * Obtener estado de todos los watchers
   */
  getStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [id, watcher] of this.watchers.entries()) {
      status[id] = watcher.getStatus();
    }
    
    return status;
  }
}

export const watcherManager = new WatcherManager();
```

### 4. Integración con Configuración (Fase 3)

```typescript
// src/main.ts

import { watcherManager } from '@infra/watchers';
import { configService } from '@infra/config';
import { processFactura } from './processors/facturaProcessor';

// Inicializar watchers desde configuración
async function initializeWatchers() {
  const pathsConfig = configService.get('paths');
  
  if (pathsConfig) {
    watcherManager.register('facturas', {
      watchPath: pathsConfig.watchFolder,
      processingPath: path.join(pathsConfig.watchFolder, '.processing'),
      donePath: pathsConfig.doneFolder,
      errorPath: pathsConfig.errorFolder,
      pattern: /\.fac$/,
      concurrency: 2
    }, processFactura);
    
    await watcherManager.start('facturas');
  }
}

// Reiniciar watchers cuando cambia config
ipcMain.on('config:changed', async () => {
  await watcherManager.stopAll();
  await initializeWatchers();
});
```

### 5. Procesadores con Manejo de Errores

```typescript
// src/processors/facturaProcessor.ts

import { logger, createLogger } from '@infra/logger';
import { AppError } from '@infra/errors';

export async function processFactura(
  filePath: string,
  correlationId: string
): Promise<void> {
  const log = createLogger(correlationId);
  
  log.info('Processing factura', { filePath });
  
  try {
    // 1. Leer archivo
    const content = await fs.readFile(filePath, 'utf-8');
    
    // 2. Parsear
    const factura = parseFactura(content);
    
    // 3. Validar
    validateFactura(factura);
    
    // 4. Procesar con AFIP
    const cae = await afipService.procesarFactura(factura);
    
    // 5. Generar PDF
    const pdfPath = await pdfService.generateFacturaPdf(factura, cae);
    
    // 6. Enviar por email (opcional)
    if (factura.email) {
      await emailService.sendFactura(factura.email, pdfPath);
    }
    
    log.info('Factura processed successfully', { cae });
    
  } catch (error) {
    log.error('Error processing factura', error as Error);
    throw error; // Re-throw para que SafeWatcher lo maneje
  }
}
```

### 6. Testing de Watchers

```typescript
// packages/infra/src/watchers/__tests__/SafeWatcher.test.ts

import { SafeWatcher } from '../SafeWatcher';
import fs from 'fs/promises';
import path from 'path';

describe('SafeWatcher', () => {
  let watcher: SafeWatcher;
  let testDir: string;
  let processed: string[] = [];
  
  beforeEach(async () => {
    testDir = path.join(__dirname, '__fixtures__', 'test-watch');
    await fs.mkdir(testDir, { recursive: true });
    
    processed = [];
    
    watcher = new SafeWatcher({
      watchPath: path.join(testDir, 'watch'),
      processingPath: path.join(testDir, '.processing'),
      donePath: path.join(testDir, '.done'),
      errorPath: path.join(testDir, '.error'),
      pattern: /\.txt$/
    }, async (filePath, correlationId) => {
      processed.push(filePath);
    });
  });
  
  afterEach(async () => {
    await watcher.stop();
    await fs.rm(testDir, { recursive: true, force: true });
  });
  
  it('should process new file', async () => {
    await watcher.start();
    
    // Crear archivo
    const testFile = path.join(testDir, 'watch', 'test.txt');
    await fs.writeFile(testFile, 'test content');
    
    // Esperar procesamiento
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    expect(processed).toHaveLength(1);
    
    // Verificar que está en .done
    const doneFile = path.join(testDir, '.done', 'test.txt');
    const exists = await fs.access(doneFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });
  
  it('should not process duplicates', async () => {
    // TODO: Test de deduplicación
  });
  
  it('should handle backpressure with concurrency limit', async () => {
    // TODO: Test de cola con límite
  });
  
  it('should move failed files to error folder', async () => {
    // TODO: Test de manejo de errores
  });
});
```

## Checklist de Aceptación

- [ ] SafeWatcher implementado con awaitWriteFinish
- [ ] Rename atómico a .processing/ antes de procesar
- [ ] Dedupe por hash con TTL
- [ ] Cola con límite de concurrencia (p-queue)
- [ ] Restart seguro sin perder archivos
- [ ] WatcherManager para múltiples watchers
- [ ] Integración con ConfigService (Fase 3)
- [ ] Carpetas .processing/, .done/, .error/ funcionando
- [ ] Tests de watchers pasando
- [ ] 0 reprocesos observados
- [ ] 0 lecturas parciales observadas
- [ ] **Funcionalidad sin cambios**

## Métricas de Éxito

- **Reprocesos**: 0
- **Archivos parciales leídos**: 0
- **Archivos perdidos en restart**: 0
- **Tiempo promedio de procesamiento**: Sin degradación
- **Throughput**: Al menos igual que antes

## Próxima Fase

**[Fase 6: Optimización](./FASE_06_optimizacion.md)** - Bundle, Next.js, Electron optimizados.

---

**Última actualización**: Octubre 2025

