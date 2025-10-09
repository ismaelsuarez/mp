import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { renderRetencionPdf } from './retencionRenderer';

function getUserDataConfigPath(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'config', 'retencion.config.json');
  } catch {
    return null;
  }
}

function readRetencionCfg(): { outLocal?: string; outRed1?: string; outRed2?: string } {
  try {
    const pUser = getUserDataConfigPath();
    const pCwd = path.join(process.cwd(), 'config', 'retencion.config.json');
    const p = (pUser && fs.existsSync(pUser)) ? pUser : pCwd;
    const raw = fs.readFileSync(p, 'utf8');
    const j = JSON.parse(raw || '{}');
    return { outLocal: j.outLocal || '', outRed1: j.outRed1 || '', outRed2: j.outRed2 || '' };
  } catch {
    return { outLocal: '', outRed1: '', outRed2: '' };
  }
}

function assertDirConfigured(dir: string | undefined, message: string): void {
  const v = String(dir || '').trim();
  if (!v) throw new Error(message);
}

function tryPath(primary: string, fallback: string): string {
  try { if (fs.existsSync(primary)) return primary; } catch {}
  try { if (fs.existsSync(fallback)) return fallback; } catch {}
  return fallback;
}

export async function processRetencionTxt(fullPath: string): Promise<void> {
  const cfg = readRetencionCfg();
  assertDirConfigured(cfg.outLocal, 'Ruta Local (retenciones) es obligatoria');

  // Leer texto crudo (utf8)
  const raw = fs.readFileSync(fullPath, 'utf8');
  const numero = (raw.match(/NUMERO:\s*([0-9\-]+)/i)?.[1] || 'SINNUM');
  const yyyymm = dayjs().format('YYYYMM');

  const outBase = path.join(cfg.outLocal as string, 'Retenciones', `F${yyyymm}`);
  fs.mkdirSync(outBase, { recursive: true });

  const pdfName = `RET_${numero}.pdf`;
  const outLocalPath = path.join(outBase, pdfName);

  try {
    await renderRetencionPdf({
      text: raw,
      outputPath: outLocalPath,
      bgPath: tryPath(path.join(process.cwd(), 'templates', 'FirmaDa.jpg'), path.join(process.cwd(), 'public', 'Noimage.jpg')),
      fonts: {
        regular: path.join(process.cwd(), 'src', 'modules', 'fonts', 'CONSOLA.TTF'),
        bold: path.join(process.cwd(), 'src', 'modules', 'fonts', 'CONSOLAB.TTF'),
      },
    });

    // Copias a red
    for (const dstRaw of [cfg.outRed1, cfg.outRed2]) {
      const dst = String(dstRaw || '').trim();
      if (!dst) continue;
      const dstDir = path.join(dst, 'Retenciones', `F${yyyymm}`);
      try { fs.mkdirSync(dstDir, { recursive: true }); } catch {}
      try { fs.copyFileSync(outLocalPath, path.join(dstDir, pdfName)); } catch {}
    }

    // Borrar el .txt original si todo salió bien
    try { fs.unlinkSync(fullPath); } catch {}
  } catch (e) {
    // Si falla, mover a errores/ con timestamp
    try {
      const baseDir = path.dirname(fullPath);
      const errDir = path.join(baseDir, 'errores');
      fs.mkdirSync(errDir, { recursive: true });
      const ts = dayjs().format('YYYYMMDD_HHmmss');
      const base = path.basename(fullPath);
      const target = path.join(errDir, `${ts}_${base}`);
      fs.renameSync(fullPath, target);
    } catch {}
    throw e;
  }
}


