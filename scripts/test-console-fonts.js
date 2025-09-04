const fs = require('fs');
const PDFDocument = require('pdfkit');

// Fuentes de consola de Windows a probar
const consoleFonts = [
  'Consolas',
  'Courier New',
  'Lucida Console',
  'Terminal',
  'Courier',
  'Courier-Bold'
];

async function testConsoleFont(fontName) {
  console.log(`🔤 Probando fuente de consola: ${fontName}`);
  
  try {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 0,
      font: fontName
    });
    
    const outputPath = `test-output/test-console-${fontName.toLowerCase().replace(/\s+/g, '-')}.pdf`;
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    
    // Agregar texto de prueba similar a la factura
    doc.fontSize(12);
    doc.text(`Prueba de fuente: ${fontName}`, 50, 50);
    
    // Título principal
    doc.fontSize(14);
    doc.text('FACTURA', 50, 80);
    
    // Número de comprobante
    doc.fontSize(12);
    doc.text('N° 0016 - 00009207', 50, 110);
    
    // Fecha
    doc.fontSize(10);
    doc.text('Fecha: 01/09/2025', 50, 140);
    
    // Información del cliente
    doc.text('Atendio: gonzalo', 50, 160);
    doc.text('Pago: MC DEBIT', 50, 180);
    doc.text('cliente@example.com', 50, 200);
    
    // Números para ver el espaciado monospace
    doc.fontSize(14);
    doc.text('1234567890', 50, 230);
    doc.text('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 50, 250);
    doc.text('abcdefghijklmnopqrstuvwxyz', 50, 270);
    
    // Texto específico de la factura
    doc.fontSize(10);
    doc.text('(053101) LEUCADE BUFE S. R. L.', 50, 300);
    doc.text('BANDERA DE LOS ANDES 2603 (G.CRUZ)', 50, 320);
    doc.text('30-71872876-9', 50, 340);
    doc.text('RESPONSABLE INSCRIPTO', 50, 360);
    
    doc.end();
    
    return new Promise((resolve) => {
      stream.on('finish', () => {
        console.log(`✅ PDF generado: ${outputPath}`);
        resolve(outputPath);
      });
    });
    
  } catch (error) {
    console.log(`❌ Error con ${fontName}: ${error.message}`);
    return null;
  }
}

async function testAllConsoleFonts() {
  console.log('🎯 PROBANDO FUENTES DE CONSOLA DE WINDOWS');
  console.log('==========================================');
  console.log('Estas son las fuentes más probables para tu factura original');
  
  const outputDir = 'test-output';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  const results = [];
  
  for (const font of consoleFonts) {
    const outputPath = await testConsoleFont(font);
    if (outputPath) {
      results.push({ font, outputPath, success: true });
    } else {
      results.push({ font, success: false });
    }
  }
  
  console.log('\n📊 RESUMEN DE PRUEBAS:');
  console.log('=======================');
  
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.font}: ${result.outputPath}`);
    } else {
      console.log(`❌ ${result.font}: No disponible`);
    }
  });
  
  console.log('\n🎯 INSTRUCCIONES:');
  console.log('==================');
  console.log('1. Abrir cada PDF generado');
  console.log('2. Comparar con la factura original');
  console.log('3. Identificar cuál coincide mejor');
  console.log('4. Cambiar la fuente en pdfRenderer.ts');
  
  console.log('\n🔧 CÓMO CAMBIAR LA FUENTE:');
  console.log('============================');
  console.log('En src/pdfRenderer.ts, línea ~313:');
  console.log('doc.font(bold ? \'Consolas\' : \'Consolas\'); // Para Consolas');
  console.log('doc.font(bold ? \'Courier New\' : \'Courier New\'); // Para Courier New');
  
  console.log('\n💡 RECOMENDACIÓN:');
  console.log('==================');
  console.log('Si la factura original usa fuente de consola,');
  console.log('probablemente sea Consolas o Courier New');
}

// Ejecutar las pruebas
testAllConsoleFonts();
