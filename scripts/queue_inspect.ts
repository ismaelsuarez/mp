/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';

function main() {
  try {
    let dbPath: string | undefined;
    try {
      const electron = require('electron');
      const baseDir = path.join(electron.app.getPath('userData'), 'queue');
      dbPath = path.join(baseDir, 'contingency.db');
    } catch {}
    if (!dbPath) {
      throw new Error('No se pudo resolver userData/queue/contingency.db');
    }

    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true, fileMustExist: false });

    const pragma = (name: string): any => {
      try { const row = db.prepare(`PRAGMA ${name}`).get(); const key = Object.keys(row||{})[0]; return key? row[key]: row; } catch { return null; }
    };

    const size = (() => { try { return fs.statSync(dbPath).size; } catch { return 0; } })();
    const wal = fs.existsSync(dbPath + '-wal') ? (dbPath + '-wal') : null;
    const shm = fs.existsSync(dbPath + '-shm') ? (dbPath + '-shm') : null;

    const out = {
      dbPath: path.resolve(dbPath),
      exists: fs.existsSync(dbPath),
      sizeBytes: size,
      walFile: wal,
      shmFile: shm,
      pragmas: {
        journal_mode: pragma('journal_mode'),
        synchronous: pragma('synchronous'),
        foreign_keys: pragma('foreign_keys'),
        busy_timeout: pragma('busy_timeout'),
        wal_autocheckpoint: pragma('wal_autocheckpoint'),
        page_size: pragma('page_size'),
        locking_mode: pragma('locking_mode'),
      }
    };
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('queue_inspect ERROR:', (e as any)?.message || e);
    process.exit(1);
  }
}

main();


