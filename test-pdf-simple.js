#!/usr/bin/env node

/**
 * Script de Prueba - Generar PDF simple solo con texto
 */

const fs = require('fs');
const path = require('path');

async function generarPDFSimple() {
  console.log('🧪 GENERANDO PDF SIMPLE SOLO CON TEXTO\n');
  
  try {
    const PDFDocument = require('pdfkit');
    
    // Crear directorio de salida
    const outDir = 'test-output';
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    
    // Crear PDF simple
    console.log('📄 Creando PDF simple...');
    const doc = new PDFDocument({ autoFirstPage: false });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfPath = path.join(outDir, `PDF_SIMPLE_${timestamp}.pdf`);
    const writeStream = fs.createWriteStream(pdfPath);
    
    doc.pipe(writeStream);
    
    // Añadir página
    doc.addPage();
    
    // Agregar texto simple
    doc.fontSize(16).text('FACTURA A', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text('Cliente: Cliente Demo S.A.');
    doc.text('Domicilio: Av. San Martín 123, Mendoza');
    doc.text('CUIT: 20300123456');
    doc.text('IVA: RI');
    doc.moveDown();
    doc.fontSize(14).text('Detalles:', { underline: true });
    doc.fontSize(12).text('1 - Servicio de reparación de PC - $1,500');
    doc.text('2 - Instalación de software - $500');
    doc.moveDown();
    doc.fontSize(14).text('Total: $2,420', { align: 'right' });
    
    // Finalizar PDF
    doc.end();
    
    // Esperar a que se complete la escritura
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    console.log(`✅ PDF simple generado: ${pdfPath}`);
    
    // Verificar que se creó
    if (fs.existsSync(pdfPath)) {
      const stats = fs.statSync(pdfPath);
      console.log(`   Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log('   ✅ PDF creado exitosamente');
      
      // Abrir PDF automáticamente
      try {
        const { exec } = require('child_process');
        if (process.platform === 'win32') {
          exec(`start "" "${pdfPath}"`);
        } else if (process.platform === 'darwin') {
          exec(`open "${pdfPath}"`);
        } else {
          exec(`xdg-open "${pdfPath}"`);
        }
        console.log('🔍 PDF abierto automáticamente');
      } catch (e) {
        console.log('ℹ️ Abre manualmente el PDF generado');
      }
    }
    
  } catch (error) {
    console.error('❌ Error generando PDF simple:', error.message);
  }
}

generarPDFSimple().catch(console.error);
