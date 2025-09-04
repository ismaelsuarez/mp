const fs = require('fs');
const { generateInvoicePdf } = require('../dist/src/pdfRenderer');
const layout = require('../dist/src/invoiceLayout.mendoza').default;

async function testFonts() {
  console.log('🔤 Probando fuentes de la factura...');
  
  const data = {
    empresa: { 
      nombre: 'TODO-COMPUTACIÓN',
      domicilio: 'AV. SAN MARTÍN 1234, MENDOZA',
      cuit: '30-70867343-5',
      condicionIva: 'RESPONSABLE INSCRIPTO',
      inscripcion: 'IVA',
      pv: 16, 
      numero: 9207 
    },
    cliente: {
      nombre: '(053101) LEUCADE BUFE S. R. L.',
      domicilio: 'BANDERA DE LOS ANDES 2603 (G.CRUZ)',
      cuitDni: '30-71872876-9',
      condicionIva: 'RESPONSABLE INSCRIPTO',
    },
    fecha: '2025-09-01',
    hora: '15:30',
    tipoComprobanteLetra: 'B',
    atendio: 'Atendio: gonzalo',
    condicionPago: 'Pago: MC DEBIT',
    referenciaInterna: 'Ref.Interna 25090111361441',
    notaRecepcion: 'Nota de Recepcion:123345',
    remito: 'R-00012345',
    email: 'cliente@example.com',
    observaciones: 'Factura emitida conforme a datos proporcionados por el cliente',

    moneda: 'PES',
    cotizacion: 1.0,
    formaPago: 'TARJETA DE CRÉDITO',

    items: [
      { descripcion: 'GRASA DISIP. GRIZZLY 0,3gr     SERVICIO', cantidad: 1, unitario: 6033.058, iva: 21, total: 6033.058 },
      { descripcion: 'MANTENIMIENTO DE EQUIPO', cantidad: 1, unitario: 24793.388, iva: 21, total: 24793.388 },
    ],

    netoGravado: 30826.45,
    netoPorAlicuota: { '21': 30826.45, '10.5': 0, '27': 0 },
    ivaPorAlicuota: { '21': 6473.55, '10.5': 0, '27': 0 },
    ivaTotal: 6473.55,
    total: 37300.0,

    cae: '75355394213832',
    caeVto: '2025-09-11',
  };

  const outputDir = 'test-output';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  try {
    const result = await generateInvoicePdf({
      bgPath: 'templates/MiFondo-pagado.jpg',
      outputPath: `${outputDir}/test-fonts.pdf`,
      data,
      config: layout,
    });

    console.log('✅ PDF generado exitosamente con fuente Helvetica');
    console.log('📁 Archivo:', result.outputPath);
    console.log('\n🎯 Verificar que la fuente sea Helvetica (sans-serif)');
    console.log('🔍 Comparar con la factura original');
    
  } catch (error) {
    console.error('❌ Error al generar PDF:', error.message);
  }
}

// Ejecutar la prueba
testFonts();
