import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import dayjs from 'dayjs';
// CommonJS requires
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Handlebars = require('handlebars');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRCode = require('qrcode');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const puppeteer = require('puppeteer');

export type PlantillaTipo = 'factura_a' | 'factura_b' | 'nota_credito' | 'recibo' | 'remito';

export type DatosFactura = {
  emisor: { nombre: string; cuit: string; domicilio?: string; iibb?: string; inicio?: string; logoPath?: string };
  receptor: { nombre?: string; cuit?: string; condicionIva?: string; domicilio?: string };
  cbte: { tipo: string; pto_vta: number; numero: number; fecha: string };
  detalle: Array<{ descripcion: string; cantidad: number; precioUnitario: number; importe: number; alicuotaIva?: number }>;
  totales: { neto: number; iva: number; total: number };
  afip?: { cae?: string; cae_vto?: string; qr_url?: string };
  backgroundPath?: string; // Imagen de fondo opcional (e.g., MiFondo-pagado.jpg)
};

export class FacturaGenerator {
  private templatesDir: string;

  constructor() {
    // En build: app.getAppPath() apunta a carpeta de la app; templates se empaqueta en raíz
    const base = app.getAppPath();
    this.templatesDir = path.join(base, 'templates');
  }

  private resolveTemplate(tipo: PlantillaTipo): string {
    const map: Record<PlantillaTipo, string> = {
      factura_a: 'factura_a.html',
      factura_b: 'factura_b.html',
      nota_credito: 'nota_credito.html',
      recibo: 'recibo.html',
      remito: 'remito.html'
    };
    const primary = path.join(this.templatesDir, map[tipo] || map['factura_a']);
    if (fs.existsSync(primary)) return primary;
    // Fallback a factura A si no existe la plantilla específica
    const fallback = path.join(this.templatesDir, map['factura_a']);
    if (fs.existsSync(fallback)) return fallback;
    throw new Error(`Plantilla no encontrada: ${primary}`);
  }

  private async buildQrPngDataUrl(url?: string): Promise<string | undefined> {
    if (!url) return undefined;
    const dataUrl = await QRCode.toDataURL(url, { width: 240 });
    return dataUrl;
  }

  async generarPdf(tipo: PlantillaTipo, datos: DatosFactura): Promise<string> {
    const tplPath = this.resolveTemplate(tipo);
    const tplSource = fs.readFileSync(tplPath, 'utf8');
    const template = Handlebars.compile(tplSource);

    const qrDataUrl = await this.buildQrPngDataUrl(datos.afip?.qr_url);
    // Resolver imagen de fondo si no se pasó explícita
    let backgroundPath = datos.backgroundPath;
    if (!backgroundPath) {
      const overrides = [
        path.join(app.getAppPath(), 'src', 'modules', 'facturacion', 'plantilla', 'MiFondo-pagado.jpg'),
        path.join(this.templatesDir, 'MiFondo-pagado.jpg')
      ];
      for (const p of overrides) { if (fs.existsSync(p)) { backgroundPath = p; break; } }
    }
    const isNC = datos.cbte.tipo === '3' || datos.cbte.tipo === '8' || datos.cbte.tipo === '13';
    const isNB = datos.cbte.tipo === '2' || datos.cbte.tipo === '7' || datos.cbte.tipo === '12';
    const titulo = isNC ? 'Nota de Crédito ' + (['3','8','13'].includes(datos.cbte.tipo) ? (datos.cbte.tipo === '3' ? 'A' : datos.cbte.tipo === '8' ? 'B' : 'C') : '')
                  : isNB ? 'Nota de Débito ' + (['2','7','12'].includes(datos.cbte.tipo) ? (datos.cbte.tipo === '2' ? 'A' : datos.cbte.tipo === '7' ? 'B' : 'C') : '')
                  : (datos.cbte.tipo === '1' ? 'Factura A' : datos.cbte.tipo === '6' ? 'Factura B' : datos.cbte.tipo === '11' ? 'Factura C' : 'Factura');
    const viewModel = {
      ...datos,
      titulo,
      fecha_larga: dayjs(datos.cbte.fecha, ['YYYY-MM-DD','YYYYMMDD']).format('DD/MM/YYYY'),
      nro_formateado: String(datos.cbte.numero).padStart(8, '0'),
      qr_data_url: qrDataUrl,
      backgroundPath
    };
    const html = template(viewModel);

    const outDir = path.join(app.getPath('documents'), 'facturas');
    try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
    const fileName = `${tipo.toUpperCase()}_${datos.cbte.pto_vta}-${String(datos.cbte.numero).padStart(8, '0')}.pdf`;
    const outPath = path.join(outDir, fileName);

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const hasBg = !!backgroundPath;
      await page.pdf({
        path: outPath,
        printBackground: true,
        format: 'A4',
        margin: hasBg ? { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' } : { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' }
      });
    } finally {
      try { await browser.close(); } catch {}
    }
    return outPath;
  }
}

let instance: FacturaGenerator | null = null;
export function getFacturaGenerator(): FacturaGenerator { if (!instance) instance = new FacturaGenerator(); return instance; }


