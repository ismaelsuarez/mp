/*
  Script: scripts/inspect_sqlite.ts
  Objetivo: inspeccionar la base SQLite usada por la app sin modificar estado.
  Salida: ruta absoluta del .db, PRAGMAs clave, tamaño y existencia de -wal/-shm.
  Notas: reusa el singleton de DbService si está habilitado; si no, intenta abrir
         el archivo en modo read-only para consultar PRAGMAs.
*/

/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    // Cargar DbService (commonjs transpiled)
    let dbSvc: any = null;
    let dbPath: string | undefined;
    try {
      const mod = require('../dist/src/services/DbService.js');
      const getDb: any = mod?.getDb || (require('../src/services/DbService') as any)?.getDb;
      if (getDb) {
        try { dbSvc = getDb(); } catch {}
      }
    } catch {}
    // Intentar resolver ruta desde servicio si está disponible
    dbPath = (dbSvc as any)?.dbPath;
    // Fallback: deducir ruta desde variables de entorno (Windows)
    if (!dbPath) {
      try {
        const electron = require('electron');
        const userData = electron?.app?.getPath?.('userData');
        if (userData) dbPath = path.join(userData, 'facturas.db');
      } catch {}
    }
    if (!dbPath) {
      const candidates: string[] = [];
      const baseApp = process.env.APPDATA || process.env.LOCALAPPDATA || process.cwd();
      candidates.push(path.join(String(baseApp), 'Tc-Mp', 'facturas.db'));
      candidates.push(path.join(String(baseApp), 'tc-mp', 'facturas.db'));
      for (const c of candidates) { if (fs.existsSync(c)) { dbPath = c; break; } }
      if (!dbPath) {
        // último recurso: buscar en working dir
        const wd = process.cwd();
        const tryPath = path.join(wd, 'facturas.db');
        if (fs.existsSync(tryPath)) dbPath = tryPath;
      }
    }

    if (!dbPath) {
      // No es fatal: emitimos reporte parcial
      const report = {
        dbPath: null as any,
        exists: false,
        sizeBytes: 0,
        walFile: null as any,
        shmFile: null as any,
        pragmas: null as any,
        warning: 'No se pudo resolver la ruta al archivo SQLite',
      };
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
      return;
    }

    // Resolver driver actual: reusar conexión si existe, de lo contrario abrir temporal en RO
    let driver: any = (dbSvc as any)?.db || null;
    let Database: any = null;
    let warning: string | undefined;
    if (!driver) {
      try { Database = require('better-sqlite3'); } catch (e) { /* ignore */ }
      if (Database) {
        try {
          // Abrir en modo read-only (no altera estado)
          driver = new Database(dbPath, { readonly: true, fileMustExist: true });
        } catch (e) {
          // Módulo compilado contra ABI distinto (Electron vs Node). Reporte parcial.
          warning = `PRAGMAs no disponibles: ${(e as any)?.message || e}`;
          driver = null;
        }
      } else {
        warning = 'PRAGMAs no disponibles: better-sqlite3 no cargó en este entorno';
      }
    }

    // Helper para PRAGMA
    const pragma = (name: string): any => {
      try {
        // better-sqlite3: PRAGMA devuelven una fila con la columna homónima
        const row = driver.prepare(`PRAGMA ${name}`).get();
        const key = Object.keys(row || {})[0];
        return key ? row[key] : row;
      } catch {
        return undefined;
      }
    };

    // Consultar PRAGMAs clave
    const p_journal = driver ? pragma('journal_mode') : null;
    const p_sync = driver ? pragma('synchronous') : null;
    const p_fk = driver ? pragma('foreign_keys') : null;
    const p_busy = driver ? pragma('busy_timeout') : null;
    const p_wal_auto = driver ? pragma('wal_autocheckpoint') : null;
    const p_page = driver ? pragma('page_size') : null;
    const p_locking = driver ? pragma('locking_mode') : null;

    // Tamaños y archivos -wal/-shm
    const size = (() => { try { return fs.statSync(dbPath).size; } catch { return 0; } })();
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    const hasWal = fs.existsSync(walPath);
    const hasShm = fs.existsSync(shmPath);

    const report = {
      dbPath: path.resolve(dbPath),
      exists: fs.existsSync(dbPath),
      sizeBytes: size,
      walFile: hasWal ? walPath : null,
      shmFile: hasShm ? shmPath : null,
      pragmas: driver ? {
        journal_mode: p_journal,
        synchronous: p_sync,
        foreign_keys: p_fk,
        busy_timeout: p_busy,
        wal_autocheckpoint: p_wal_auto,
        page_size: p_page,
        locking_mode: p_locking,
      } : null,
      warning,
    };

    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('inspect_sqlite ERROR:', (err as any)?.message || err);
    process.exit(1);
  }
}

main();


