import fs from 'fs';
import PDFDocument from 'pdfkit';

export type RetencionFonts = { regular?: string; bold?: string };

type RenderArgs = {
  retencionTexto: string;
  outputPath: string;
  bgPath?: string;
  fonts?: RetencionFonts;
  box?: { x: number; y: number; width: number; lineGap?: number };
};

export async function renderRetencionPdf(args: RenderArgs): Promise<void> {
  const { retencionTexto, outputPath, bgPath, fonts, box } = args;
  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // Background a página completa
  try {
    if (bgPath && fs.existsSync(bgPath)) {
      const { width, height } = doc.page;
      doc.image(bgPath, 0, 0, { width, height });
    }
  } catch {}

  // Registrar fuentes monospace si existen
  try {
    if (fonts?.regular && fs.existsSync(fonts.regular)) {
      doc.registerFont('regular', fonts.regular);
    }
    if (fonts?.bold && fs.existsSync(fonts.bold)) {
      doc.registerFont('bold', fonts.bold);
    }
  } catch {}

  try { doc.font('regular'); } catch {}
  doc.fontSize(10);

  // Caja controlada (similar a Remitos)
  const x = box?.x ?? 60;
  const y = box?.y ?? 110;
  const width = box?.width ?? (doc.page.width - 120);
  const lineGap = box?.lineGap ?? 1.6;

  doc.text(String(retencionTexto || ''), x, y, { width, lineGap });
  doc.end();

  await new Promise<void>((res, rej) => {
    stream.on('finish', () => res());
    stream.on('error', (e) => rej(e));
  });
}


