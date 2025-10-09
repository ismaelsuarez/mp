import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import type { RetencionLayout } from '../../invoiceLayout.mendoza';
import { app } from 'electron';

type Args = { layout: RetencionLayout; outputPath: string; retencionTexto: string };

export async function renderRetencionPdf({ layout, outputPath, retencionTexto }: Args): Promise<void> {
	const doc = new PDFDocument({ size: 'A4', margin: 36 });
	const stream = fs.createWriteStream(outputPath);
	doc.pipe(stream);

	function resolveAsset(p?: string): string | undefined {
		if (!p || typeof p !== 'string') return undefined;
		const candidates: string[] = [];
		try { if (path.isAbsolute(p)) candidates.push(p); } catch {}
		try { candidates.push(path.join(process.cwd(), p)); } catch {}
		try { candidates.push(path.join(app.getAppPath(), p)); } catch {}
		try { candidates.push(path.join(process.resourcesPath || app.getAppPath(), p)); } catch {}
		// Intentos adicionales por convenciones de empaquetado
		try {
			const baseName = path.basename(p);
			if (baseName) {
				try { candidates.push(path.join(app.getAppPath(), 'src', 'modules', 'fonts', baseName)); } catch {}
				try { candidates.push(path.join(process.cwd(), 'src', 'modules', 'fonts', baseName)); } catch {}
				try { candidates.push(path.join(app.getAppPath(), 'templates', baseName)); } catch {}
				try { candidates.push(path.join(process.cwd(), 'templates', baseName)); } catch {}
			}
		} catch {}
		for (const c of candidates) { try { if (c && fs.existsSync(c)) return c; } catch {} }
		return undefined;
	}

	// Fondo a página completa
	try {
		const bgResolved = resolveAsset(layout.background);
		if (bgResolved && fs.existsSync(bgResolved)) {
			const { width, height } = doc.page;
			doc.image(bgResolved, 0, 0, { width, height });
		}
	} catch {}

	// Fuentes
	try {
		// 1) Intentar fuentes desde config/pdf.config.json (userData o cwd)
		let pdfCfgPath: string | undefined;
		try { pdfCfgPath = path.join(app.getPath('userData'), 'config', 'pdf.config.json'); } catch {}
		if (!pdfCfgPath || !fs.existsSync(pdfCfgPath)) {
			const alt = path.join(process.cwd(), 'config', 'pdf.config.json');
			if (fs.existsSync(alt)) pdfCfgPath = alt;
		}
		let regFromCfg: string | undefined;
		let boldFromCfg: string | undefined;
		if (pdfCfgPath && fs.existsSync(pdfCfgPath)) {
			try {
				const cfgRaw = fs.readFileSync(pdfCfgPath, 'utf8');
				const cfg = JSON.parse(cfgRaw || '{}');
				regFromCfg = resolveAsset(cfg.fontRegular);
				boldFromCfg = resolveAsset(cfg.fontBold);
			} catch {}
		}
		const reg = resolveAsset(regFromCfg || layout.fonts?.regular);
		const bold = resolveAsset(boldFromCfg || layout.fonts?.bold);
		if (reg && fs.existsSync(reg)) doc.registerFont('regular', reg);
		if (bold && fs.existsSync(bold)) doc.registerFont('bold', bold);
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
    // Respetar alineaciones del .txt: no wrap, ni trimming a la izquierda
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


