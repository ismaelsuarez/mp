import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { renderRetencionPdf } from './retencionRenderer';
import { invoiceLayout } from '../../invoiceLayout.mendoza';

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
  const retencionTexto = fs.readFileSync(fullPath, 'utf8');
  const numero = (retencionTexto.match(/NUMERO:\s*([0-9\-]+)/i)?.[1] || 'SINNUM');

  // Nombre de salida y paths en raíz (sin subcarpetas)
  const pdfName = `B${numero}.pdf`;

  const ensureDir = (p: string) => { try { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); } catch {} };
  ensureDir(String(cfg.outLocal || '').trim());
  const outLocalPath = path.join(String(cfg.outLocal || '').trim(), pdfName);

  try {
    const baseLayout = invoiceLayout.retencion;
    await renderRetencionPdf({ layout: baseLayout, outputPath: outLocalPath, retencionTexto });

    // Copias a red
    const redTargets = [cfg.outRed1, cfg.outRed2].filter(Boolean) as string[];
    for (const dstRaw of redTargets) {
      const dst = String(dstRaw || '').trim();
      if (!dst) continue;
      ensureDir(dst);
      try { fs.copyFileSync(outLocalPath, path.join(dst, pdfName)); } catch {}
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


