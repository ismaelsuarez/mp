#!/usr/bin/env node

/**
 * Script de Prueba - Generación de Factura PDF HÍBRIDA
 * 
 * Este script usa la estrategia CORRECTA del informe técnico:
 * - PDFKit directamente para el texto (como en SmsProcessingFlow.ts)
 * - MiFondo-pagado.jpg como imagen de fondo
 * - SIN conversión de texto a imagen (que causa pérdida de texto)
 */

const fs = require('fs');
const path = require('path');

// Simular datos de factura de ejemplo (replicando estructura del PDF real)
const datosFactura = {
  emisor: {
    nombre: 'TODO-COMPUTACIÓN',
    cuit: '20123456789',
    domicilio: 'Montecaseros 1126, Ciudad de Mendoza',
    iibb: '0497605',
    inicio: '01/03/2004'
  },
  receptor: {
    nombre: 'LEUCADE BUFE S. R. L.',
    cuit: '30-71872876-9',
    condicionIva: 'RESPONSABLE INSCRIPTO',
    domicilio: 'BANDERA DE LOS ANDES 2603(G.CRUZ) Tel:2615154690',
    atendio: 'gonzalo',
    refInterna: '25090111361441',
    notaRecepcion: '123345',
    remito: ''
  },
  cbte: {
    tipo: 'A',
    numero: '0016',
    numeroCompleto: '00009207',
    fecha: '01/09/2025',
    hora: '11:37:48',
    formaPago: 'MC DEBIT   1'
  },
  detalle: [
    {
      descripcion: 'GRASA DISIP. GRIZZLY  0,3gr     SERVICIO',
      cantidad: 1,
      precioUnitario: 6033.058,
      importe: 6033.058,
      alicuotaIva: 21
    },
    {
      descripcion: 'MANTENIMIENTO DE EQUIPO',
      cantidad: 1,
      precioUnitario: 24793.388,
      importe: 24793.388,
      alicuotaIva: 21
    },
    {
      descripcion: 'REPARACION/MANTENIMIENTO DE MECANISMOS',
      cantidad: 1,
      precioUnitario: 99173.554,
      importe: 99173.554,
      alicuotaIva: 21
    }
  ],
  totales: {
    neto: 123388.43,
    iva: 25911.57,
    total: 149300.00
  },
  afip: {
    cae: '75355394213832',
    cae_vto: '11/09/2025'
  }
};

// Función para verificar archivos necesarios
function verificarArchivos() {
  console.log('🔍 Verificando archivos necesarios...');
  
  const archivos = [
    'templates/MiFondo-pagado.jpg',
    'src/modules/facturacion/plantilla/MiFondo-pagado.jpg'
  ];
  
  let todosExisten = true;
  
  archivos.forEach(archivo => {
    const existe = fs.existsSync(archivo);
    console.log(`${existe ? '✅' : '❌'} ${archivo}`);
    if (!existe) todosExisten = false;
  });
  
  return todosExisten;
}

// Función para generar PDF HÍBRIDO (PDFKit + imagen de fondo)
async function generarPDFHibrido(outputPdfPath) {
  console.log('🎨 Generando PDF híbrido con PDFKit + imagen de fondo...');
  
  try {
    const PDFDocument = require('pdfkit');
    
    // Crear PDF
    const doc = new PDFDocument({ 
      autoFirstPage: false,
      size: [595.28, 841.89] // A4 estándar
    });
    
    const writeStream = fs.createWriteStream(outputPdfPath);
    doc.pipe(writeStream);
    
    // Añadir página
    doc.addPage();
    
    // 1. AGREGAR IMAGEN DE FONDO (MiFondo-pagado.jpg)
    console.log('   🖼️ Agregando imagen de fondo...');
    doc.image('templates/MiFondo-pagado.jpg', 0, 0, {
      fit: [doc.page.width, doc.page.height]
    });
    
    // 2. AGREGAR TEXTO DIRECTO CON PDFKIT (replicando EXACTAMENTE la estructura del ejemplo)
    console.log('   📝 Agregando texto directo...');
    
    // Configurar fuentes
    doc.fontSize(16).font('Helvetica-Bold');
    
    // ENCABEZADO - Replicando líneas 1-6 del ejemplo
    doc.text('A', 50, 50);
    doc.text('Nº', 50, 70);
    doc.text('FACTURA', 50, 90);
    doc.text(`${datosFactura.cbte.numero}  ${datosFactura.cbte.numeroCompleto}-`, 50, 110);
    doc.text(datosFactura.cbte.fecha, 50, 130);
    doc.text(`Ref.Interna ${datosFactura.receptor.refInterna}`, 50, 150);
    
    // DATOS CLIENTE - Replicando líneas 7-17 del ejemplo
    doc.fontSize(12).font('Helvetica');
    doc.text('Fecha:', 50, 180);
    doc.text(`Atendio: ${datosFactura.receptor.atendio}`, 50, 200);
    doc.text(`(${datosFactura.receptor.cuit.substring(0, 6)})${datosFactura.receptor.nombre}`, 50, 220);
    doc.text(`Hora: ${datosFactura.cbte.hora}`, 50, 240);
    doc.text(datosFactura.receptor.domicilio, 50, 260);
    doc.text(datosFactura.receptor.cuit, 50, 280);
    doc.text(datosFactura.receptor.condicionIva, 50, 300);
    doc.text(`Pago:${datosFactura.cbte.formaPago}`, 50, 320);
    doc.text('Mail:', 50, 340);
    doc.text(`Nota de Recepcion:${datosFactura.receptor.notaRecepcion}                    REMITO:`, 50, 360);
    
    // LÍNEA INFORMATIVA
    doc.text('Factura emitida conforme a datos proporcionados por el cliente', 50, 380);
    
    // FILAS DE DETALLE - Replicando líneas 18-22 del ejemplo
    let yDetalle = 420;
    datosFactura.detalle.forEach((item, index) => {
      // Formato: "1  DESCRIPCIÓN                                    PRECIO   21.00%      IMPORTE"
      const lineaDetalle = `${item.cantidad}  ${item.descripcion.padEnd(50)}                     ${item.precioUnitario.toFixed(3)}   ${item.alicuotaIva}.00%     ${item.importe.toFixed(3)}`;
      doc.text(lineaDetalle, 50, yDetalle);
      yDetalle += 25;
    });
    
    // LÍNEA DE PESOS
    doc.text('SON PESOS: CIENTO CUARENTA Y NUEVE MIL TRESCIENTOS.-', 50, yDetalle);
    yDetalle += 25;
    
    // TOTALES - Replicando líneas 23-27 del ejemplo
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text(`Neto ${datosFactura.detalle[0].alicuotaIva}%        ${datosFactura.totales.neto.toFixed(2)}`, 50, yDetalle);
    doc.text(`IVA ${datosFactura.detalle[0].alicuotaIva}%         ${datosFactura.totales.iva.toFixed(2)}`, 50, yDetalle + 20);
    doc.text(`CAE Nº ${datosFactura.afip.cae}`, 50, yDetalle + 40);
    doc.text(`${datosFactura.afip.cae_vto}FECHA VTO.`, 50, yDetalle + 60);
    doc.text(`        ${datosFactura.totales.total.toFixed(2)}TOTAL`, 50, yDetalle + 80);
    
    // PIE - Replicando líneas 28-32 del ejemplo
    doc.fontSize(10).font('Helvetica');
    doc.text('Por la garantia ir a Montecaseros 1126,cdad-EXCEPTO notebook,tablet,impresoras comunicarse al 0800 de cada Marca', 50, yDetalle + 120);
    doc.text('Garantia de reparacion:30 dias,no incluye software/configuraciones ni mantenimiento/limpieza', 50, yDetalle + 140);
    doc.text('Cambios dentro de las 48hs -', 50, yDetalle + 160);
    doc.text('Defensa del consumidor Mendoza:08002226678 o al 148 opcion 3', 50, yDetalle + 180);
    doc.text('** GRACIAS POR SU COMPRA **', 50, yDetalle + 200);
    
    // Finalizar PDF
    doc.end();
    
    // Esperar a que se complete la escritura
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    console.log(`✅ PDF híbrido generado: ${outputPdfPath}`);
    return outputPdfPath;
    
  } catch (error) {
    console.error('❌ Error generando PDF híbrido:', error.message);
    return null;
  }
}

// Función principal de prueba
async function ejecutarPrueba() {
  console.log('🧪 INICIO DE PRUEBA - GENERACIÓN DE FACTURA PDF HÍBRIDA\n');
  
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
    // Generar PDF híbrido
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfPath = path.join(outDir, `FACTURA_HIBRIDA_${timestamp}.pdf`);
    
    const pdfOK = await generarPDFHibrido(pdfPath);
    
    if (!pdfOK) {
      console.log('\n❌ Error generando PDF híbrido. Abortando prueba.');
      return;
    }
    
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
    
    console.log('\n🎯 PRUEBA COMPLETADA EXITOSAMENTE');
    console.log('✅ PDF híbrido generado con PDFKit');
    console.log('✅ MiFondo-pagado.jpg como imagen de fondo');
    console.log('✅ Texto directo (extraíble) con PDFKit');
    console.log(`📁 PDF disponible en: ${pdfPath}`);
    
    console.log('\n🔍 VERIFICAR RESULTADO:');
    console.log('1. Abre el PDF generado');
    console.log('2. Confirma que MiFondo-pagado.jpg sea visible como fondo');
    console.log('3. Verifica que el texto sea legible y extraíble');
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
  generarPDFHibrido
};
