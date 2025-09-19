/**
 * SANDBOX – Prueba de Factura A (flujo completo) sin reportar a AFIP/ARCA
 *
 * IMPORTANTE:
 * - Este script NO llama a servicios externos (AFIP/ARCA). Mockea la emisión.
 * - Úsese sólo en desarrollo para validar PDF, .res, email/WhatsApp/impresión.
 * - No modifica lógica de producción.
 *
 * Uso:
 *   npx ts-node scripts/test-facturaA-sandbox.ts [ruta_fac_opcional]
 *   (por defecto usa tests/data/FA_prueba.fac)
 */

import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';

// Servicio AFIP/ARCA mockeado – mantiene la firma de emitirFacturaYGenerarPdf
function getMockAfipService() {
  return {
    /**
     * Emula emisión exitosa devolviendo datos ficticios (no realiza IO externo)
     */
    emitirFacturaYGenerarPdf: async (_params: any) => {
      // Mensaje claro en consola
      // eslint-disable-next-line no-console
      console.log('\n*** MODO SANDBOX: emitiendo CAE ficticio ***');
      await new Promise((r) => setTimeout(r, 150));
      return {
        cae: '00000000000000',
        caeVto: '2099-12-31',
        numero: 12345678, // número de comprobante ficticio
        cbteDesde: 12345678,
        cbteHasta: 12345678,
        qrDataUrl: 'QR_FAKE_DATA'
      };
    },
  };
}

async function main() {
  try {
    const repoRoot = path.resolve(__dirname, '..');
    const facArg = process.argv[2];
    const defaultFac = path.join(repoRoot, 'tests', 'data', 'FA_prueba.fac');
    const facPath = facArg ? path.resolve(facArg) : defaultFac;

    if (!fs.existsSync(facPath)) {
      throw new Error(`No se encontró el archivo .fac de prueba: ${facPath}. Crea uno en tests/data/FA_prueba.fac o pasa la ruta como argumento.`);
    }

    // Stub básico de electron.app para rutas userData en ambiente Node (ts-node)
    try {
      // Interceptar carga de módulos para SANDBOX
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Module = require('module');
      const appDataBase = process.env.APPDATA || path.join(process.env.HOME || process.cwd(), 'AppData', 'Roaming');
      const userData = path.join(appDataBase, 'Tc-Mp');
      try { fs.mkdirSync(path.join(userData, 'config'), { recursive: true }); } catch {}
      const originalLoad = Module._load;
      Module._load = function(request: string, parent: any, isMain: boolean) {
        // electron.app.getPath → %APPDATA%/Tc-Mp
        if (request === 'electron') {
          return { app: { getPath: (_: string) => userData } };
        }
        // Mock servicio AFIP → éxito ficticio
        if (/services[\\\/]FacturacionService$/.test(request) || request.endsWith('/services/FacturacionService')) {
          return { getFacturacionService: () => getMockAfipService() };
        }
        // Mock NTP → siempre válido
        if (/modules[\\\/]facturacion[\\\/]utils[\\\/]TimeValidator$/.test(request) || request.endsWith('/modules/facturacion/utils/TimeValidator')) {
          return { validateSystemTime: async () => ({ isValid: true, drift: 0, systemTime: new Date(), ntpTime: new Date() }), validateSystemTimeAndThrow: async () => undefined };
        }
        // No enviar impresión/email/FTP en SANDBOX
        if (/services[\\\/]PrintService$/.test(request) || request.endsWith('/services/PrintService')) {
          return { printPdf: async (filePath: string, printer?: string, copies?: number) => { console.log('[SANDBOX] printPdf omitido', { filePath, printer, copies }); } };
        }
        if (/services[\\\/]EmailService$/.test(request) || request.endsWith('/services/EmailService')) {
          return { sendReceiptEmail: async (to: string, pdf: string) => { console.log('[SANDBOX] email omitido', { to, pdf }); } };
        }
        if (/services[\\\/]FtpService$/.test(request) || request.endsWith('/services/FtpService')) {
          return { sendArbitraryFile: async (p: string) => { console.log('[SANDBOX] FTP omitido', { p }); }, sendFilesToWhatsappFtp: async (arr: string[]) => { console.log('[SANDBOX] WhatsApp FTP omitido', { files: arr }); } };
        }
        // eslint-disable-next-line prefer-rest-params
        return originalLoad.apply(this, arguments as any);
      };
    } catch {}

    // (Mocks adicionales aplicados en el hook de Module._load)

    const startedAt = Date.now();
    // eslint-disable-next-line no-console
    console.log('[SANDBOX] Iniciando prueba con .fac:', facPath);

    // Cargar facProcessor luego de stubs y ejecutar Factura (no envía impresión/email/FTP)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const facMod = require('../src/modules/facturacion/facProcessor');
    const out = await facMod.processFacturaFacFile(facPath);

    const tookMs = Date.now() - startedAt;
    // eslint-disable-next-line no-console
    console.log('\n[SANDBOX] Resultado processor:', out);
    if (out?.ok) {
      // eslint-disable-next-line no-console
      console.log('[SANDBOX] PDF generado:', out.pdfPath);
      // Estimar ruta de .res (junto al .fac / por convención de sufijo)
      try {
        const dir = path.dirname(facPath);
        const files = fs.readdirSync(dir).filter((n) => /\.res$/i.test(n));
        const recent = files
          .map((n) => ({ n, t: fs.statSync(path.join(dir, n)).mtimeMs }))
          .sort((a, b) => b.t - a.t)[0];
        if (recent) console.log('[SANDBOX] .res reciente:', path.join(dir, recent.n));
      } catch {}
    } else {
      // eslint-disable-next-line no-console
      console.log('[SANDBOX] Flujo no OK (esperado si faltan configs de email/ftp/impresión).');
    }

    // eslint-disable-next-line no-console
    console.log(`[SANDBOX] Finalizado en ${tookMs} ms – ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`);
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[SANDBOX] Error:', e?.message || e);
    process.exitCode = 1;
  }
}

void main();


