import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export class QueueDB {
  private static instance: QueueDB | null = null;
  private _dbPath: string;
  private _db: any;

  private constructor() {
    const baseDir = path.join(app.getPath('userData'), 'queue');
    try { fs.mkdirSync(baseDir, { recursive: true }); } catch {}
    const dbPath = path.join(baseDir, 'contingency.db');
    this._dbPath = dbPath;

    // Carga perezosa de better-sqlite3
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = require('better-sqlite3');
    this._db = new Database(dbPath);
    this.applyPragmas();
    this.migrate();
  }

  public static getInstance(): QueueDB {
    if (!QueueDB.instance) QueueDB.instance = new QueueDB();
    return QueueDB.instance;
  }

  public get dbPath(): string { return this._dbPath; }
  public get driver(): any { return this._db; }

  private applyPragmas(): void {
    const exec = (sql: string) => { try { this._db.exec(sql); } catch {} };
    exec('PRAGMA foreign_keys=ON;');
    exec('PRAGMA journal_mode=WAL;');
    exec('PRAGMA synchronous=NORMAL;');
    exec('PRAGMA busy_timeout=5000;');
    exec('PRAGMA wal_autocheckpoint=1000;');
  }

  private migrate(): void {
    const sql = `
CREATE TABLE IF NOT EXISTS queue_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sha256 TEXT,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  state TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_error TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_sha ON queue_jobs(sha256) WHERE sha256 IS NOT NULL;

CREATE TABLE IF NOT EXISTS queue_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  event TEXT NOT NULL,
  payload TEXT,
  at INTEGER NOT NULL,
  FOREIGN KEY(job_id) REFERENCES queue_jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS queue_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS caja_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  level TEXT NOT NULL,
  icon TEXT NOT NULL,
  text TEXT NOT NULL,
  detail TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_caja_logs_timestamp ON caja_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_caja_logs_level ON caja_logs(level);`;
    try { this._db.exec(sql); } catch {}
  }
}

export function getQueueDB(): QueueDB { return QueueDB.getInstance(); }


