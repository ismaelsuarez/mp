import crypto from 'crypto';
import { getQueueDB } from './QueueDB';

/**
 * Interfaz para el almacén de colas
 */
export interface QueueStore {
  /**
   * Agrega un job a la cola
   * @param job - Job a agregar
   * @returns ID del job agregado
   */
  enqueue(job: { type: string; payload: any; sha256?: string; delayMs?: number }): number;
  
  /**
   * Obtiene el siguiente job disponible
   * @param types - Tipos de jobs a buscar (opcional)
   * @returns Job disponible o null
   */
  getNext(types?: string[]): { id: number; type: string; payload: any } | null;
  
  /**
   * Marca un job como completado exitosamente
   * @param id - ID del job
   */
  ack(id: number): void;
  
  /**
   * Marca un job como fallido y lo reencola
   * @param id - ID del job
   * @param reason - Razón del fallo
   * @param requeueDelayMs - Delay antes de reintentar
   */
  nack(id: number, reason?: string, requeueDelayMs?: number): void;
  
  /**
   * Pausa el procesamiento de la cola
   */
  pause(): void;
  
  /**
   * Reanuda el procesamiento de la cola
   */
  resume(): void;
  
  /**
   * Obtiene estadísticas de la cola
   */
  getStats(): { enqueued: number; processing: number; paused: boolean };
}

/**
 * Implementación de QueueStore usando SQLite
 * Migrado desde src/services/queue/SqliteQueueStore.ts
 * 
 * @infra/database/queue - Cola SQLite con idempotencia
 */
export class SqliteQueueStore implements QueueStore {
  private db = getQueueDB().driver; // Driver de better-sqlite3

  /**
   * Timestamp actual en milisegundos
   */
  private now(): number { return Date.now(); }
  
  /**
   * Convierte un objeto a JSON string
   */
  private toJson(v: any): string { try { return JSON.stringify(v); } catch { return 'null'; } }
  
  /**
   * Calcula el hash SHA256 de un objeto
   */
  private sha256Of(obj: any): string {
    try { return crypto.createHash('sha256').update(this.toJson(obj)).digest('hex'); } catch { return ''; }
  }

  /**
   * Agrega un job a la cola con idempotencia por SHA256
   */
  enqueue(job: { type: string; payload: any; sha256?: string; delayMs?: number }): number {
    const now = this.now();
    const availableAt = now + (Number(job.delayMs || 0));
    const sha = job.sha256 || this.sha256Of(job.payload);
    // Idempotencia por sha (si se provee o calculado)
    if (sha) {
      const found = this.db.prepare('SELECT id FROM queue_jobs WHERE sha256 = ? LIMIT 1').get(sha);
      if (found && found.id) return Number(found.id);
    }
    const info = this.db.prepare(`
      INSERT INTO queue_jobs (sha256, type, payload, state, attempts, available_at, created_at, updated_at)
      VALUES (@sha, @type, @payload, 'ENQUEUED', 0, @available_at, @now, @now)
    `).run({ sha, type: String(job.type), payload: this.toJson(job.payload), available_at: availableAt, now });
    const id = Number(info.lastInsertRowid || 0);
    this.db.prepare('INSERT INTO queue_audit (job_id, event, payload, at) VALUES (?, ?, ?, ?)')
      .run(id, 'enqueue', this.toJson(job.payload), now);
    return id;
  }

  /**
   * Obtiene el siguiente job disponible y lo marca como PROCESSING
   */
  getNext(types?: string[]): { id: number; type: string; payload: any } | null {
    const now = this.now();
    let row: any;
    if (Array.isArray(types) && types.length > 0) {
      const placeholders = types.map(() => '?').join(',');
      row = this.db.prepare(`
        SELECT id, type, payload FROM queue_jobs
        WHERE state IN ('NEW','ENQUEUED','RETRY')
          AND available_at <= ?
          AND type IN (${placeholders})
        ORDER BY available_at ASC, id ASC
        LIMIT 1
      `).get(now, ...types);
    } else {
      row = this.db.prepare(`
        SELECT id, type, payload FROM queue_jobs
        WHERE state IN ('NEW','ENQUEUED','RETRY')
          AND available_at <= ?
        ORDER BY available_at ASC, id ASC
        LIMIT 1
      `).get(now);
    }
    if (!row) return null;
    const res = this.db.prepare(`
      UPDATE queue_jobs SET state='PROCESSING', updated_at=@now
      WHERE id=@id AND state IN ('NEW','ENQUEUED','RETRY')
    `).run({ id: row.id, now });
    if (!res.changes) return null;
    try { row.payload = JSON.parse(String(row.payload || 'null')); } catch { row.payload = null; }
    this.db.prepare('INSERT INTO queue_audit (job_id, event, payload, at) VALUES (?, ?, ?, ?)')
      .run(row.id, 'pop', null, now);
    return { id: Number(row.id), type: String(row.type), payload: row.payload };
  }

  /**
   * Marca un job como completado exitosamente y lo elimina
   */
  ack(id: number): void {
    const now = this.now();
    // Registrar ACK antes de borrar el job para evitar violación de FK
    try {
      this.db.prepare('INSERT INTO queue_audit (job_id, event, payload, at) VALUES (?, ?, ?, ?)')
        .run(id, 'ack', null, now);
    } catch {}
    this.db.prepare('DELETE FROM queue_jobs WHERE id=?').run(id);
  }

  /**
   * Marca un job como fallido y lo reencola para reintentar
   */
  nack(id: number, reason?: string, requeueDelayMs?: number): void {
    const now = this.now();
    const delay = Math.max(0, Number(requeueDelayMs || 0));
    const availableAt = now + delay;
    this.db.prepare(`
      UPDATE queue_jobs
      SET last_error=@err, attempts=attempts+1, state='RETRY', available_at=@avail, updated_at=@now
      WHERE id=@id
    `).run({ id, err: reason || null, avail: availableAt, now });
    this.db.prepare('INSERT INTO queue_audit (job_id, event, payload, at) VALUES (?, ?, ?, ?)')
      .run(id, 'retry', reason || null, now);
  }

  /**
   * Pausa el procesamiento de la cola
   */
  pause(): void {
    this.db.prepare('INSERT INTO queue_settings (key, value) VALUES ("ws_circuit_state","DOWN") ON CONFLICT(key) DO UPDATE SET value=excluded.value').run();
  }

  /**
   * Reanuda el procesamiento de la cola
   */
  resume(): void {
    this.db.prepare('INSERT INTO queue_settings (key, value) VALUES ("ws_circuit_state","UP") ON CONFLICT(key) DO UPDATE SET value=excluded.value').run();
  }

  /**
   * Obtiene estadísticas de la cola
   */
  getStats(): { enqueued: number; processing: number; paused: boolean } {
    const enq = this.db.prepare("SELECT COUNT(*) as c FROM queue_jobs WHERE state IN ('NEW','ENQUEUED','RETRY')").get()?.c || 0;
    const proc = this.db.prepare("SELECT COUNT(*) as c FROM queue_jobs WHERE state='PROCESSING'").get()?.c || 0;
    const row = this.db.prepare("SELECT value FROM queue_settings WHERE key='ws_circuit_state'").get();
    const paused = String(row?.value || 'UP') !== 'UP';
    return { enqueued: Number(enq), processing: Number(proc), paused };
  }
}

/**
 * Obtiene una instancia del almacén de colas
 */
export function getQueueStore(): QueueStore { 
  return new SqliteQueueStore(); 
}

