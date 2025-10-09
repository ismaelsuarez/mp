import fs from 'fs';
import PDFDocument from 'pdfkit';

export type RetencionFonts = { regular?: string; bold?: string };

export async function renderRetencionPdf(args: {
  text: string;
  outputPath: string;
  bgPath?: string;
  fonts?: RetencionFonts;
}): Promise<void> {
  const { text, outputPath, bgPath, fonts } = args;
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

  try {
    doc.font('regular');
  } catch {
    // fallback a fuente por defecto si no se registró
  }
  doc.fontSize(10);

  const pageWidth = doc.page.width;
  const margin = 36;
  const x = margin + 4; // 40 como en la especificación
  const y = margin + 4;
  const width = pageWidth - (margin * 2) - 8; // pageWidth - 80 aprox

  doc.text(String(text || ''), x, y, { width, lineGap: 2 });
  doc.end();

  await new Promise<void>((res, rej) => {
    stream.on('finish', () => res());
    stream.on('error', (e) => rej(e));
  });
}


