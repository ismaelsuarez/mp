import fs from 'fs';
import PDFDocument from 'pdfkit';
import type { RetencionLayout } from '../../invoiceLayout.mendoza';

type Args = { layout: RetencionLayout; outputPath: string; retencionTexto: string };

export async function renderRetencionPdf({ layout, outputPath, retencionTexto }: Args): Promise<void> {
	const doc = new PDFDocument({ size: 'A4', margin: 36 });
	const stream = fs.createWriteStream(outputPath);
	doc.pipe(stream);

	// Fondo a página completa
	try {
		const bg = layout.background;
		if (bg && fs.existsSync(bg)) {
			const { width, height } = doc.page;
			doc.image(bg, 0, 0, { width, height });
		}
	} catch {}

	// Fuentes
	try {
		if (layout.fonts?.regular && fs.existsSync(layout.fonts.regular)) doc.registerFont('regular', layout.fonts.regular);
		if (layout.fonts?.bold && fs.existsSync(layout.fonts.bold)) doc.registerFont('bold', layout.fonts.bold);
	} catch {}

	try { doc.font('regular'); } catch {}
	const body = layout.blocks.body;
	doc.fontSize(body.fontSize ?? 10);

	// Caja controlada
  const x = body.x;
  const yStart = body.y;
  const lineGap = body.lineGap ?? 1.6;

  const content = String(retencionTexto || '').replace(/\r\n?/g, '\n');
  const lines = content.split('\n');
  const baseLineHeight = doc.currentLineHeight();
  const bottomLimit = doc.page.height - 36; // mantener margen inferior de 36

  let y = yStart;
  for (const rawLine of lines) {
    const line = rawLine.replace(/[\t ]+$/g, '');
    // Dibujar cada línea sin word-wrap
    doc.text(line, x, y, { lineBreak: false });
    y += baseLineHeight + lineGap;
    if (y + baseLineHeight > bottomLimit) {
      doc.addPage({ size: 'A4', margin: 36 });
      // Redibujar fondo en nuevas páginas si existe
      try {
        const bg = layout.background;
        if (bg && fs.existsSync(bg)) {
          const { width, height } = doc.page;
          doc.image(bg, 0, 0, { width, height });
        }
      } catch {}
      y = yStart;
    }
  }
	doc.end();

	await new Promise<void>((res, rej) => {
		stream.on('finish', () => res());
		stream.on('error', (e) => rej(e));
	});
}


