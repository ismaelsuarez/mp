"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacturaGenerator = void 0;
exports.getFacturaGenerator = getFacturaGenerator;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const dayjs_1 = __importDefault(require("dayjs"));
// CommonJS requires
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Handlebars = require('handlebars');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRCode = require('qrcode');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const puppeteer = require('puppeteer');
class FacturaGenerator {
    constructor() {
        // En build: app.getAppPath() apunta a carpeta de la app; templates se empaqueta en raíz
        const base = electron_1.app.getAppPath();
        this.templatesDir = path_1.default.join(base, 'templates');
    }
    resolveTemplate(tipo) {
        const map = {
            factura_a: 'factura_a.html',
            factura_b: 'factura_b.html',
            nota_credito: 'nota_credito.html',
            recibo: 'recibo.html',
            remito: 'remito.html'
        };
        const file = map[tipo] || map['factura_a'];
        const full = path_1.default.join(this.templatesDir, file);
        if (!fs_1.default.existsSync(full))
            throw new Error(`Plantilla no encontrada: ${full}`);
        return full;
    }
    async buildQrPngDataUrl(url) {
        if (!url)
            return undefined;
        const dataUrl = await QRCode.toDataURL(url, { width: 240 });
        return dataUrl;
    }
    async generarPdf(tipo, datos) {
        const tplPath = this.resolveTemplate(tipo);
        const tplSource = fs_1.default.readFileSync(tplPath, 'utf8');
        const template = Handlebars.compile(tplSource);
        const qrDataUrl = await this.buildQrPngDataUrl(datos.afip?.qr_url);
        const viewModel = {
            ...datos,
            fecha_larga: (0, dayjs_1.default)(datos.cbte.fecha, ['YYYY-MM-DD', 'YYYYMMDD']).format('DD/MM/YYYY'),
            nro_formateado: String(datos.cbte.numero).padStart(8, '0'),
            qr_data_url: qrDataUrl
        };
        const html = template(viewModel);
        const outDir = path_1.default.join(electron_1.app.getPath('documents'), 'facturas');
        try {
            fs_1.default.mkdirSync(outDir, { recursive: true });
        }
        catch { }
        const fileName = `${tipo.toUpperCase()}_${datos.cbte.pto_vta}-${String(datos.cbte.numero).padStart(8, '0')}.pdf`;
        const outPath = path_1.default.join(outDir, fileName);
        const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
        try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'load' });
            await page.pdf({ path: outPath, printBackground: true, format: 'A4', margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
        }
        finally {
            try {
                await browser.close();
            }
            catch { }
        }
        return outPath;
    }
}
exports.FacturaGenerator = FacturaGenerator;
let instance = null;
function getFacturaGenerator() { if (!instance)
    instance = new FacturaGenerator(); return instance; }
