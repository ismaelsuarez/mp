import { logInfo, logError } from '@infra/logger';
import path from 'path';
import fs from 'fs';

let ftpServer: any | null = null;

type FtpServerConfig = {
  enabled?: boolean;
  host?: string; // 0.0.0.0
  port?: number; // 2121
  user?: string;
  pass?: string;
  root?: string; // C:\tmp\ftp_share
  pasv_host?: string; // IP anunciada para PASV (LAN o pública)
  pasv_min?: number;  // rango PASV inferior
  pasv_max?: number;  // rango PASV superior
};

export async function startFtpServer(cfg: FtpServerConfig): Promise<boolean> {
  try {
    const { host = '0.0.0.0', port = 2121, user = 'user', pass = 'pass' } = cfg || {};
    const pasvHost = (cfg?.pasv_host as string) || '';
    const pasvMin = Number.isFinite(cfg?.pasv_min as number) ? (cfg?.pasv_min as number) : 50000;
    const pasvMax = Number.isFinite(cfg?.pasv_max as number) ? (cfg?.pasv_max as number) : 50100;
    let root = (cfg?.root as string) || path.join('C:', 'tmp', 'ftp_share');
    // Normalizar ruta de Windows y asegurar absoluta
    try {
      const raw = String(root || '').trim();
      let normalized = raw.replace(/\//g, path.sep);
      if (/^[A-Za-z][\\/]/.test(normalized) && !/^[A-Za-z]:[\\/]/.test(normalized)) {
        normalized = normalized[0] + ':' + normalized.slice(1);
      }
      if (!path.isAbsolute(normalized)) {
        normalized = path.resolve(normalized);
      }
      // Crear si no existe
      fs.mkdirSync(normalized, { recursive: true });
      root = normalized;
    } catch (e: any) {
      logError('FTP root normalization failed', { message: e?.message || String(e) });
    }
    if (ftpServer) {
      await stopFtpServer();
    }
    // Lazy import con fallback: primero intenta "@trinket/ftp-srv", si no existe usa "ftp-srv"
    let FtpSrvCtor: any;
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - paquete opcional
      const mod = await import('@trinket/ftp-srv');
      FtpSrvCtor = (mod as any).FtpSrv || (mod as any).default;
    } catch (_e) {
      const mod = await import('ftp-srv');
      FtpSrvCtor = (mod as any).default || (mod as any).FtpSrv;
    }

    const options: any = {
      url: `ftp://${host}:${port}`,
      pasv_min: pasvMin,
      pasv_max: pasvMax,
      anonymous: false
    };
    if (pasvHost && typeof pasvHost === 'string') {
      (options as any).pasv_url = pasvHost; // FTP PASV URL anunciada
    }
    ftpServer = new FtpSrvCtor(options);

    ftpServer.on('login', ({ username, password }: any, resolve: any, reject: any) => {
      try {
        if (String(username) === String(user) && String(password) === String(pass)) {
          logInfo('FTP login OK', { username });
          return resolve({ root });
        }
        // No exponer la contraseña; mostrar usuario (y IP si está disponible por otros logs)
        try { console.warn('[ftp] login reject user=', username); } catch {}
        logError('FTP login reject', { username });
        return reject(new Error('Invalid credentials'));
      } catch (e: any) {
        logError('FTP login error', { message: e?.message || String(e) });
        return reject(new Error('Login error'));
      }
    });

    ftpServer.on('client-error', (_client: any, ctx: any, err: any) => {
      logError('FTP client error', { ctx, message: String(err?.message || err) });
    });
    ftpServer.on('server-error', (err: any) => {
      logError('FTP server error', { message: String(err?.message || err) });
    });
    ftpServer.on('connection', () => logInfo('FTP connection')); 

    await ftpServer.listen();
    logInfo('FTP server started', { host, port, root, pasvHost: pasvHost || undefined, pasvRange: `${pasvMin}-${pasvMax}` });
    return true;
  } catch (e: any) {
    logError('Failed to start FTP server', { message: e?.message || String(e) });
    ftpServer = null;
    return false;
  }
}

export async function stopFtpServer(): Promise<boolean> {
  try {
    if (ftpServer && typeof ftpServer.close === 'function') {
      await ftpServer.close();
      logInfo('FTP server stopped');
    }
  } catch (e: any) {
    logError('Failed to stop FTP server', { message: e?.message || String(e) });
    return false;
  } finally {
    ftpServer = null;
  }
  return true;
}

export function isFtpServerRunning(): boolean {
  return !!ftpServer;
}


