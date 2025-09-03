#!/usr/bin/env node

/**
 * Script de Prueba - Generación de Factura PDF con Jimp + PDFKit
 * 
 * Este script genera un PDF real usando la misma estrategia que SmsProcessingFlow.ts:
 * - Jimp para renderizar texto a imagen PNG transparente
 * - Composición con plantilla MiFondo-pagado.jpg
 * - PDFKit para generar PDF final
 * - SIN necesidad de AFIP (emulación completa)
 */

const fs = require('fs');
const path = require('path');

// Simular datos de factura de ejemplo
const datosFactura = {
  emisor: {
    nombre: 'TODO-COMPUTACIÓN',
    cuit: '20123456789',
    domicilio: 'Montecaseros 1126, Ciudad de Mendoza',
    iibb: '0497605',
    inicio: '01/03/2004'
  },
  receptor: {
    nombre: 'Cliente Demo S.A.',
    cuit: '20300123456',
    condicionIva: 'RI',
    domicilio: 'Av. San Martín 123, Mendoza'
  },
  cbte: {
    tipo: '1',
    pto_vta: 1,
    numero: 12345,
    fecha: '20241201'
  },
  detalle: [
    {
      descripcion: 'Servicio de reparación de PC',
      cantidad: 1,
      precioUnitario: 1500,
      importe: 1500,
      alicuotaIva: 21
    },
    {
      descripcion: 'Instalación de software',
      cantidad: 2,
      precioUnitario: 250,
      importe: 500,
      alicuotaIva: 21
    }
  ],
  totales: {
    neto: 2000,
    iva: 420,
    total: 2420
  },
  afip: {
    cae: '12345678901234',
    cae_vto: '20250131',
    qr_url: 'https://www.afip.gob.ar/fe/qr/?p=eyJ2ZXIiOjEsImZjaGEiOiIyMDI0LTEyLTAxIiwiY3VpdCI6MjAxMjM0NTY3ODksInB0b1Z0YSI6MSwidGlwb0NtcCI6MSwibnJvQ21wIjoxMjM0NSwiaW1wb3J0ZSI6MjQyMC4wLCJtb25lZGEiOiJQRVMiLCJjdHoiOjEsInRpcG9Eb2NSZWMiOjk5LCJub3JvRG9jUmVjIjowLCJ0aXBvQ29kQXV0IjoiRSIsImNvZEF1dCI6MTIzNDU2Nzg5MDEyMzR9'
  },
  titulo: 'Factura A',
  fecha_larga: '01/12/2024',
  nro_formateado: '00012345'
};

// Función para verificar archivos necesarios
function verificarArchivos() {
  console.log('🔍 Verificando archivos necesarios...');
  
     const archivos = [
     'templates/MiFondo-pagado.jpg',
     'src/modules/facturacion/plantilla/MiFondo-pagado.jpg',
     'templates/factura_a.html'
   ];
  
  let todosExisten = true;
  
  archivos.forEach(archivo => {
    const existe = fs.existsSync(archivo);
    console.log(`${existe ? '✅' : '❌'} ${archivo}`);
    if (!existe) todosExisten = false;
  });
  
  return todosExisten;
}

// Función para generar imagen de texto con posicionamiento preciso (como en SmsProcessingFlow.ts)
async function generateTextImageWithPositioning(outputPath) {
  console.log('🎨 Generando imagen de texto con posicionamiento preciso...');
  
  try {
    // Verificar si Jimp está disponible
    let Jimp;
    try {
      Jimp = require('jimp');
    } catch (e) {
      console.log('⚠️ Jimp no está disponible');
      return null;
    }
    
         // Crear imagen transparente del tamaño REAL de la plantilla
     const image = new Jimp(2482, 3683, 0x00000000);
    
         // Cargar fuentes estándar de Jimp (las que sabemos que funcionan)
     const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);        // Texto normal
     const fontBold = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);    // Títulos
     const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_14_BLACK);   // Texto pequeño
    
         // POSICIONAMIENTO AJUSTADO para asegurar visibilidad en la imagen (2482x3683)
     
     // 1. TÍTULO - Centrado arriba (posición segura)
     const titulo = 'FACTURA A';
     const tituloWidth = Jimp.measureText(fontBold, titulo);
     const tituloX = (2482 - tituloWidth) / 2;
     image.print(fontBold, tituloX, 150, titulo);
     
     // 2. DATOS DEL CLIENTE - Izquierda (posiciones seguras)
     image.print(font, 300, 400, datosFactura.receptor.nombre);
     image.print(font, 300, 500, datosFactura.receptor.domicilio);
     image.print(font, 300, 600, datosFactura.receptor.cuit);
     image.print(font, 300, 700, datosFactura.receptor.condicionIva);
     
     // 3. DATOS DEL COMPROBANTE - Derecha (posiciones seguras)
     image.print(font, 1400, 400, datosFactura.cbte.tipo);
     image.print(font, 1400, 500, datosFactura.nro_formateado);
     image.print(font, 1400, 600, datosFactura.fecha_larga);
     image.print(font, 1400, 700, datosFactura.afip.cae);
     
     // 4. FILAS DE DETALLE - Posiciones centradas y seguras
     let yDetalle = 900; // Posición segura para empezar detalles
     datosFactura.detalle.forEach((item, index) => {
       // SOLO los datos, sin etiquetas - la plantilla ya tiene los campos
       image.print(font, 300, yDetalle, item.descripcion);
       image.print(font, 900, yDetalle, item.cantidad.toString());
       image.print(font, 1100, yDetalle, `$${item.precioUnitario.toLocaleString()}`);
       image.print(font, 1300, yDetalle, `${item.alicuotaIva}%`);
       image.print(font, 1500, yDetalle, `$${item.importe.toLocaleString()}`);
       
       yDetalle += 120; // Espaciado más generoso entre filas
     });
     
     // 6. TOTALES - Posiciones seguras y visibles
     const yTotales = yDetalle + 150;
     image.print(fontBold, 1500, yTotales, `$${datosFactura.totales.neto.toLocaleString()}`);
     image.print(fontBold, 1500, yTotales + 100, `$${datosFactura.totales.iva.toLocaleString()}`);
     image.print(fontBold, 1500, yTotales + 200, `$${datosFactura.totales.total.toLocaleString()}`);
     
     // 7. DATOS DE LA EMPRESA - Posiciones seguras abajo
     image.print(fontSmall, 300, 3000, `Ax Sistemas y Servicios S.A.`);
     image.print(fontSmall, 300, 3080, datosFactura.emisor.cuit);
     image.print(fontSmall, 300, 3160, datosFactura.emisor.iibb);
     image.print(fontSmall, 300, 3240, datosFactura.emisor.inicio);
    
         // Guardar imagen
     await image.writeAsync(outputPath);
     console.log(`✅ Imagen de texto con posicionamiento generada: ${outputPath}`);
     
     // DEBUG: Verificar que la imagen se creó correctamente
     if (fs.existsSync(outputPath)) {
       const stats = fs.statSync(outputPath);
       console.log(`   📏 Tamaño de imagen: ${(stats.size / 1024).toFixed(2)} KB`);
       console.log(`   🎯 Dimensiones: 2482x3683 píxeles`);
       console.log(`   ✅ Imagen guardada exitosamente`);
     } else {
       console.log(`   ❌ ERROR: La imagen no se guardó correctamente`);
     }
     
     return outputPath;
    
  } catch (error) {
    console.error('❌ Error generando imagen de texto:', error.message);
    return null;
  }
}

// Función para componer imagen con plantilla y generar PDF (como en SmsProcessingFlow.ts)
async function mergePdfWithImage(templateImagePath, textImagePath, outputPdfPath) {
  console.log('🔧 Componiendo imagen con plantilla y generando PDF...');
  
  try {
    // Verificar si Jimp y PDFKit están disponibles
    let Jimp, PDFDocument;
    try {
      Jimp = require('jimp');
      PDFDocument = require('pdfkit');
    } catch (e) {
      console.log('⚠️ Dependencias no disponibles');
      return null;
    }
    
    // Leer plantilla y imagen de texto
    const template = await Jimp.read(templateImagePath);
    const textImage = await Jimp.read(textImagePath);
    
         // Componer: superponer texto sobre plantilla
     console.log('   🔧 Componiendo imágenes...');
     template.composite(textImage, 0, 0);
     console.log('   ✅ Composición completada');
     
     // Guardar imagen combinada temporal
     const combinedImagePath = path.join(process.cwd(), 'test-output', `combined-${Date.now()}.png`);
     await template.writeAsync(combinedImagePath);
     console.log(`   💾 Imagen combinada guardada: ${combinedImagePath}`);
     
     // DEBUG: Verificar imagen combinada
     if (fs.existsSync(combinedImagePath)) {
       const stats = fs.statSync(combinedImagePath);
       console.log(`   📏 Imagen combinada: ${(stats.size / 1024).toFixed(2)} KB`);
     }
    
    console.log('📄 Generando PDF con PDFKit...');
    
    // Crear PDF
    const doc = new PDFDocument({ autoFirstPage: false });
    const writeStream = fs.createWriteStream(outputPdfPath);
    doc.pipe(writeStream);
    
    // Añadir página con la imagen combinada
    doc.addPage();
    doc.image(combinedImagePath, 0, 0, { 
      fit: [doc.page.width, doc.page.height] 
    });
    
    // Finalizar PDF
    doc.end();
    
    // Esperar a que se complete la escritura
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    // Limpiar imagen temporal
    if (fs.existsSync(combinedImagePath)) {
      fs.unlinkSync(combinedImagePath);
      console.log('🧹 Imagen temporal eliminada');
    }
    
    console.log(`✅ PDF generado: ${outputPdfPath}`);
    return outputPdfPath;
    
  } catch (error) {
    console.error('❌ Error generando PDF:', error.message);
    return null;
  }
}

// Función para generar contenido de texto simple (no HTML)
function generarContenidoTexto() {
  console.log('📝 Generando contenido de texto simple...');
  
  const contenido = [
    `FACTURA A`,
    ``,
    `Cliente: ${datosFactura.receptor.nombre}`,
    `Domicilio: ${datosFactura.receptor.domicilio}`,
    `CUIT/DNI: ${datosFactura.receptor.cuit}`,
    `IVA: ${datosFactura.receptor.condicionIva}`,
    ``,
    `Comprobante:`,
    `Tipo: ${datosFactura.cbte.tipo}`,
    `Número: ${datosFactura.nro_formateado}`,
    `Fecha: ${datosFactura.fecha_larga}`,
    `CAE: ${datosFactura.afip.cae}`,
    `Vto: ${datosFactura.afip.cae_vto}`,
    ``,
    `Detalles:`,
    `Descripción                    Cant.  P.Unit.  IVA%   Importe`,
    `─────────────────────────────────────────────────────────────────`
  ];
  
  // Agregar filas de detalle
  datosFactura.detalle.forEach(item => {
    const desc = item.descripcion.padEnd(35);
    const cant = item.cantidad.toString().padStart(6);
    const precio = `$${item.precioUnitario.toLocaleString()}`.padStart(8);
    const iva = `${item.alicuotaIva}%`.padStart(6);
    const importe = `$${item.importe.toLocaleString()}`.padStart(10);
    
    contenido.push(`${desc}${cant}${precio}${iva}${importe}`);
  });
  
  contenido.push(
    `─────────────────────────────────────────────────────────────────`,
    ``,
    `Neto: $${datosFactura.totales.neto.toLocaleString()}`,
    `IVA: $${datosFactura.totales.iva.toLocaleString()}`,
    `Total: $${datosFactura.totales.total.toLocaleString()}`,
    ``,
    `QR AFIP disponible`
  );
  
  return contenido.join('\n');
}

// Función principal de prueba
async function ejecutarPrueba() {
  console.log('🧪 INICIO DE PRUEBA - GENERACIÓN DE FACTURA PDF CON JIMP + PDFKIT\n');
  
  // Verificar archivos
  const archivosOK = verificarArchivos();
  if (!archivosOK) {
    console.log('\n❌ Faltan archivos necesarios. Abortando prueba.');
    return;
  }
  
  // Crear directorio de salida
  const outDir = path.join(process.cwd(), 'test-output');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  try {
         // 1. Generar contenido de texto simple
     const contenidoTexto = generarContenidoTexto();
     console.log(`📏 Contenido generado: ${contenidoTexto.length} caracteres`);
     
     // 2. Generar imagen de texto con posicionamiento preciso
     const textImagePath = path.join(outDir, 'texto-posicionado.png');
     const textImageOK = await generateTextImageWithPositioning(textImagePath);
    
    if (!textImageOK) {
      console.log('\n❌ Error generando imagen de texto. Abortando prueba.');
      return;
    }
    
    // 3. Componer con plantilla y generar PDF
    const templatePath = 'templates/MiFondo-pagado.jpg';
         const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
     const pdfPath = path.join(outDir, `FACTURA_POSICIONADA_${timestamp}.pdf`);
    
    const pdfOK = await mergePdfWithImage(templatePath, textImagePath, pdfPath);
    
    if (!pdfOK) {
      console.log('\n❌ Error generando PDF. Abortando prueba.');
      return;
    }
    
    // 4. Limpiar imagen de texto temporal
    if (fs.existsSync(textImagePath)) {
      fs.unlinkSync(textImagePath);
      console.log('🧹 Imagen de texto temporal eliminada');
    }
    
    // 5. Abrir PDF automáticamente
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
    
    console.log('\n🎯 PRUEBA COMPLETADA EXITOSAMENTE');
    console.log('✅ Contenido de texto generado');
    console.log('✅ Imagen de texto creada con Jimp');
    console.log('✅ Composición con plantilla MiFondo-pagado.jpg');
    console.log('✅ PDF generado con PDFKit');
    console.log(`📁 PDF disponible en: ${pdfPath}`);
    
    console.log('\n🔍 VERIFICAR RESULTADO:');
    console.log('1. Abre el PDF generado');
    console.log('2. Confirma que MiFondo-pagado.jpg sea visible como fondo');
    console.log('3. Verifica que el texto se superponga correctamente');
    console.log('4. Confirma que no haya fondo blanco tapando la imagen');
    
  } catch (error) {
    console.error('\n❌ Error en la prueba:', error.message);
  }
}

// Ejecutar la prueba
if (require.main === module) {
  ejecutarPrueba().catch(console.error);
}

module.exports = {
  ejecutarPrueba,
  verificarArchivos,
  generateTextImageWithPositioning,
  mergePdfWithImage,
  generarContenidoTexto
};
