/**
 * Store para persistencia de logs del Modo Caja en SQLite
 * Los logs se mantienen por 24 horas para revisión histórica
 */

import { getQueueDB } from './queue/QueueDB';
import type { LogMessage } from './CajaLogService';

export interface PersistedLogMessage extends LogMessage {
  // id: ID autogenerado por SQLite
  id?: number;
  // timestamp: milisegundos desde epoch (para ordenamiento y filtrado)
  timestamp: number;
}

export class CajaLogStore {
  private db = getQueueDB().driver;

  /**
   * Guarda un log en la base de datos
   */
  insert(log: LogMessage): number {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO caja_logs (timestamp, level, icon, text, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    try {
      const result = stmt.run(now, log.level, log.icon, log.text, log.detail || null, now);
      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('[CajaLogStore] Error inserting log:', error);
      return -1;
    }
  }

  /**
   * Obtiene logs desde un timestamp específico
   * @param sinceMs Timestamp desde el cual recuperar logs (default: últimas 24h)
   * @param limit Cantidad máxima de logs a retornar (default: 1000)
   */
  getLogsSince(sinceMs?: number, limit: number = 1000): PersistedLogMessage[] {
    const since = sinceMs || (Date.now() - 24 * 60 * 60 * 1000); // 24h por defecto
    
    const stmt = this.db.prepare(`
      SELECT id, timestamp, level, icon, text, detail
      FROM caja_logs
      WHERE timestamp >= ?
      ORDER BY timestamp ASC
      LIMIT ?
    `);
    
    try {
      return stmt.all(since, limit) as PersistedLogMessage[];
    } catch (error) {
      console.error('[CajaLogStore] Error fetching logs:', error);
      return [];
    }
  }

  /**
   * Obtiene los últimos N logs
   */
  getRecentLogs(limit: number = 100): PersistedLogMessage[] {
    const stmt = this.db.prepare(`
      SELECT id, timestamp, level, icon, text, detail
      FROM caja_logs
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    
    try {
      const logs = stmt.all(limit) as PersistedLogMessage[];
      return logs.reverse(); // Revertir para que queden en orden ascendente
    } catch (error) {
      console.error('[CajaLogStore] Error fetching recent logs:', error);
      return [];
    }
  }

  /**
   * Elimina logs más antiguos que el timestamp especificado
   * @param olderThanMs Timestamp límite (logs más antiguos serán eliminados)
   */
  deleteOlderThan(olderThanMs: number): number {
    const stmt = this.db.prepare(`
      DELETE FROM caja_logs
      WHERE timestamp < ?
    `);
    
    try {
      const result = stmt.run(olderThanMs);
      return result.changes;
    } catch (error) {
      console.error('[CajaLogStore] Error deleting old logs:', error);
      return 0;
    }
  }

  /**
   * Limpieza automática de logs antiguos (>24h)
   */
  cleanupOldLogs(): number {
    const threshold = Date.now() - 24 * 60 * 60 * 1000; // 24 horas
    const deleted = this.deleteOlderThan(threshold);
    if (deleted > 0) {
      try {
        console.log(`[CajaLogStore] Limpieza automática: ${deleted} logs antiguos eliminados`);
      } catch {}
    }
    return deleted;
  }

  /**
   * Obtiene estadísticas de logs
   */
  getStats(): { total: number; last24h: number; byLevel: Record<string, number> } {
    try {
      const total = this.db.prepare('SELECT COUNT(*) as count FROM caja_logs').get().count;
      const last24h = this.db.prepare(
        'SELECT COUNT(*) as count FROM caja_logs WHERE timestamp >= ?'
      ).get(Date.now() - 24 * 60 * 60 * 1000).count;
      
      const byLevelRows = this.db.prepare(
        'SELECT level, COUNT(*) as count FROM caja_logs GROUP BY level'
      ).all();
      
      const byLevel: Record<string, number> = {};
      for (const row of byLevelRows) {
        byLevel[row.level] = row.count;
      }
      
      return { total, last24h, byLevel };
    } catch (error) {
      console.error('[CajaLogStore] Error getting stats:', error);
      return { total: 0, last24h: 0, byLevel: {} };
    }
  }
}

// Singleton
let storeInstance: CajaLogStore | null = null;

export function getCajaLogStore(): CajaLogStore {
  if (!storeInstance) {
    storeInstance = new CajaLogStore();
  }
  return storeInstance;
}

