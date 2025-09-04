const fs = require('fs');
const PDFDocument = require('pdfkit');

// Lista de fuentes a probar (en orden de probabilidad)
const fontsToTest = [
  'Helvetica',
  'Arial',
  'Times-Roman',
  'Times-Bold',
  'Courier',
  'Courier-Bold',
  'Symbol',
  'ZapfDingbats'
];

async function testFont(fontName) {
  console.log(`🔤 Probando fuente: ${fontName}`);
  
  const doc = new PDFDocument({ 
    size: 'A4', 
    margin: 0,
    font: fontName
  });
  
  const outputPath = `test-output/test-font-${fontName.toLowerCase()}.pdf`;
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);
  
  // Agregar texto de prueba
  doc.fontSize(12);
  doc.text(`Prueba de fuente: ${fontName}`, 50, 50);
  doc.fontSize(10);
  doc.text('FACTURA', 50, 80);
  doc.text('N° 0016 - 00009207', 50, 100);
  doc.text('Fecha: 01/09/2025', 50, 120);
  doc.text('Atendio: gonzalo', 50, 140);
  doc.text('Pago: MC DEBIT', 50, 160);
  doc.text('cliente@example.com', 50, 180);
  
  // Agregar números para ver el espaciado
  doc.fontSize(14);
  doc.text('1234567890', 50, 220);
  doc.text('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 50, 240);
  doc.text('abcdefghijklmnopqrstuvwxyz', 50, 260);
  
  doc.end();
  
  return new Promise((resolve) => {
    stream.on('finish', () => {
      console.log(`✅ PDF generado: ${outputPath}`);
      resolve(outputPath);
    });
  });
}

async function testAllFonts() {
  console.log('🎯 PROBANDO TODAS LAS FUENTES DISPONIBLES');
  console.log('==========================================');
  
  const outputDir = 'test-output';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  const results = [];
  
  for (const font of fontsToTest) {
    try {
      const outputPath = await testFont(font);
      results.push({ font, outputPath, success: true });
    } catch (error) {
      console.log(`❌ Error con ${font}: ${error.message}`);
      results.push({ font, success: false, error: error.message });
    }
  }
  
  console.log('\n📊 RESUMEN DE PRUEBAS:');
  console.log('=======================');
  
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.font}: ${result.outputPath}`);
    } else {
      console.log(`❌ ${result.font}: ${result.error}`);
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
  console.log('doc.font(bold ? \'Helvetica-Bold\' : \'Helvetica\');');
  console.log('Cambiar por la fuente que coincida mejor');
}

// Ejecutar las pruebas
testAllFonts();
