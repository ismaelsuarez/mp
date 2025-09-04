import fs from 'fs';
import layout from './invoiceLayout.mendoza';
import { generateInvoicePdf } from './pdfRenderer';
import type { InvoiceData } from './pdfRenderer';

(async () => {
  const data: InvoiceData = {
    empresa: { cuit: '30-70867343-5', pv: 16, numero: 9207 },
    cliente: {
      nombre: '(053101) LEUCADE BUFE S. R. L.',
      domicilio: 'BANDERA DE LOS ANDES 2603 (G.CRUZ)',
      cuitDni: '30-71872876-9',
      condicionIva: 'RESPONSABLE INSCRIPTO',
    },
    fecha: '2025-09-01',
    fechaHora: '2025-09-01 14:25',
    tipoComprobanteLetra: 'A',
    atendio: 'gonzalo',
    condicionPago: 'MC DEBIT',
    referenciaInterna: 'OT-5842',
    notaRecepcion: 'NR-1021',
    remito: 'R-00012345',
    email: 'cliente@example.com',
    observaciones: 'Entrega parcial. Garantía 6 meses.',

    items: [
      { descripcion: 'GRASA DISIP. GRIZZLY 0,3gr     SERVICIO', cantidad: 1, unitario: 6033.058, iva: 21, total: 6033.058 },
      { descripcion: 'MANTENIMIENTO DE EQUIPO', cantidad: 1, unitario: 24793.388, iva: 21, total: 24793.388 },
      { descripcion: 'REPARACION/MANTENIMIENTO DE MECANISMOS', cantidad: 1, unitario: 99173.554, iva: 21, total: 99173.554 },
      { descripcion: 'BONIFICACION 21%', cantidad: 1, unitario: -6611.57, iva: 21, total: -6611.57 },
    ],

    netoGravado: 123388.43,
    netoPorAlicuota: { '21': 123388.43, '10.5': 0, '27': 0 },
    ivaPorAlicuota: { '21': 25911.57, '10.5': 0, '27': 0 },
    ivaTotal: 25911.57,
    total: 149300.0,

    cae: '75355394213832',
    caeVto: '2025-09-11',
  };

  let qrDataUrl: string | undefined;
  try {
    qrDataUrl = fs.readFileSync('./qr_base64.txt', 'utf8').trim();
  } catch {
    // si no existe el archivo, seguimos sin QR
  }

  const outputDir = 'test-output';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const result = await generateInvoicePdf({
    bgPath: 'templates/MiFondo-pagado.jpg',
    outputPath: `${outputDir}/FA_0016-00009207.NEW.pdf`,
    data,
    qrDataUrl,
    config: layout,
  });

  console.log('PDF generado en:', result.outputPath);
})();


