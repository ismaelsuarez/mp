#!/usr/bin/env node

/**
 * Script de Generación de Factura con Posicionamiento PERFECTO
 * Basado en el análisis detallado del PDF original
 */

const fs = require('fs');
const path = require('path');

// Datos de factura (replicando EXACTAMENTE el PDF original)
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

// Función para generar PDF con posicionamiento PERFECTO
async function generarPDFPosicionamientoPerfecto(outputPdfPath) {
  console.log('🎨 Generando PDF con posicionamiento PERFECTO del original...');
  
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
    
    // 1. AGREGAR IMAGEN DE FONDO
    console.log('   🖼️ Agregando imagen de fondo...');
    doc.image('templates/MiFondo-pagado.jpg', 0, 0, {
      fit: [doc.page.width, doc.page.height]
    });
    
    // 2. AGREGAR TEXTO CON POSICIONAMIENTO PERFECTO (basado en análisis detallado)
    console.log('   📝 Agregando texto con posicionamiento perfecto...');
    
    // ENCABEZADO - Centrado-izquierda (x: 80-120, y: 60-160)
    doc.fontSize(16).font('Helvetica-Bold');
    doc.text('A', 100, 60);                    // Línea 1
    doc.text('Nº', 100, 80);                   // Línea 2
    doc.text('FACTURA', 100, 100);             // Línea 3
    
    // DATOS DEL COMPROBANTE - Centrado-izquierda
    doc.fontSize(12).font('Helvetica');
    doc.text(`${datosFactura.cbte.numero}  ${datosFactura.cbte.numeroCompleto}-`, 100, 120); // Línea 4
    doc.text(datosFactura.cbte.fecha, 100, 140);                                           // Línea 5
    doc.text(`Ref.Interna ${datosFactura.receptor.refInterna}`, 100, 160);                  // Línea 6
    
    // DATOS CLIENTE - Izquierda (x: 80-120, y: 180-360)
    doc.text('Fecha:', 100, 180);              // Línea 7
    doc.text(`Atendio: ${datosFactura.receptor.atendio}`, 100, 200);                        // Línea 8
    doc.text(`(${datosFactura.receptor.cuit.substring(0, 6)})${datosFactura.receptor.nombre}`, 100, 220); // Línea 9
    doc.text(`Hora: ${datosFactura.cbte.hora}`, 100, 240);                                 // Línea 10
    doc.text(datosFactura.receptor.domicilio, 100, 260);                                    // Línea 11
    doc.text(datosFactura.receptor.cuit, 100, 280);                                         // Línea 12
    doc.text(datosFactura.receptor.condicionIva, 100, 300);                                 // Línea 13
    doc.text(`Pago:${datosFactura.cbte.formaPago}`, 100, 320);                             // Línea 14
    doc.text('Mail:', 100, 340);               // Línea 15
    doc.text(`Nota de Recepcion:${datosFactura.receptor.notaRecepcion}                    REMITO:`, 100, 360); // Línea 16
    
    // LÍNEA INFORMATIVA
    doc.text('Factura emitida conforme a datos proporcionados por el cliente', 100, 380); // Línea 17
    
    // FILAS DE DETALLE - Formato PERFECTO del original
    let yDetalle = 400;
    datosFactura.detalle.forEach((item, index) => {
      // Formato EXACTO del original: "1  DESCRIPCIÓN                                    PRECIO   21.00%      IMPORTE"
      const descripcion = `${item.cantidad}  ${item.descripcion}`;
      const precio = item.precioUnitario.toFixed(3);
      const iva = `${item.alicuotaIva}.00%`;
      const importe = item.importe.toFixed(3);
      
      // Posicionar cada elemento en su lugar exacto
      doc.text(descripcion, 100, yDetalle);                    // Cantidad + Descripción (izquierda)
      doc.text(precio, 350, yDetalle);                         // Precio Unitario (centro-derecha)
      doc.text(iva, 420, yDetalle);                            // IVA% (derecha)
      doc.text(importe, 480, yDetalle);                        // Importe (derecha)
      
      yDetalle += 25;
    });
    
    // LÍNEA DE PESOS
    doc.text('SON PESOS: CIENTO CUARENTA Y NUEVE MIL TRESCIENTOS.-', 100, yDetalle);
    yDetalle += 25;
    
    // TOTALES - Posicionamiento PERFECTO del original
    doc.fontSize(14).font('Helvetica-Bold');
    
    // Neto - Derecha (como en el original)
    doc.text(`Neto ${datosFactura.detalle[0].alicuotaIva}%        ${datosFactura.totales.neto.toFixed(2)}`, 400, yDetalle);
    yDetalle += 20;
    
    // IVA - Derecha (como en el original)
    doc.text(`IVA ${datosFactura.detalle[0].alicuotaIva}%         ${datosFactura.totales.iva.toFixed(2)}`, 400, yDetalle);
    yDetalle += 20;
    
    // CAE - Izquierda (como en el original)
    doc.text(`CAE Nº ${datosFactura.afip.cae}`, 100, yDetalle);
    yDetalle += 20;
    
    // Fecha VTO - Izquierda (como en el original)
    doc.text(`${datosFactura.afip.cae_vto}FECHA VTO.`, 100, yDetalle);
    yDetalle += 20;
    
    // TOTAL - Derecha (como en el original)
    doc.text(`        ${datosFactura.totales.total.toFixed(2)}TOTAL`, 400, yDetalle);
    
    // PIE - Centro (x: 150-200, y: 700-800)
    doc.fontSize(10).font('Helvetica');
    yDetalle += 40;
    doc.text('Por la garantia ir a Montecaseros 1126,cdad-EXCEPTO notebook,tablet,impresoras comunicarse al 0800 de cada Marca', 150, yDetalle);
    yDetalle += 20;
    doc.text('Garantia de reparacion:30 dias,no incluye software/configuraciones ni mantenimiento/limpieza', 150, yDetalle);
    yDetalle += 20;
    doc.text('Cambios dentro de las 48hs -', 150, yDetalle);
    yDetalle += 20;
    doc.text('Defensa del consumidor Mendoza:08002226678 o al 148 opcion 3', 150, yDetalle);
    yDetalle += 20;
    doc.text('** GRACIAS POR SU COMPRA **', 150, yDetalle);
    
    // Finalizar PDF
    doc.end();
    
    // Esperar a que se complete la escritura
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    console.log(`✅ PDF con posicionamiento perfecto generado: ${outputPdfPath}`);
    return outputPdfPath;
    
  } catch (error) {
    console.error('❌ Error generando PDF:', error.message);
    return null;
  }
}

// Función principal
async function ejecutarPrueba() {
  console.log('🧪 INICIO DE PRUEBA - POSICIONAMIENTO PERFECTO\n');
  
  // Verificar archivos
  if (!fs.existsSync('templates/MiFondo-pagado.jpg')) {
    console.log('❌ No se encontró MiFondo-pagado.jpg');
    return;
  }
  
  // Crear directorio de salida
  const outDir = path.join(process.cwd(), 'test-output');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  try {
    // Generar PDF con posicionamiento perfecto
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfPath = path.join(outDir, `FACTURA_POSICIONAMIENTO_PERFECTO_${timestamp}.pdf`);
    
    const pdfOK = await generarPDFPosicionamientoPerfecto(pdfPath);
    
    if (!pdfOK) {
      console.log('\n❌ Error generando PDF. Abortando prueba.');
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
    console.log('✅ PDF con posicionamiento perfecto generado');
    console.log('✅ Basado en análisis detallado del PDF original');
    console.log(`📁 PDF disponible en: ${pdfPath}`);
    
    console.log('\n🔍 VERIFICAR RESULTADO:');
    console.log('1. Abre el PDF generado');
    console.log('2. Compara con MiFondo-pagado.jpg');
    console.log('3. Verifica que el texto esté PERFECTAMENTE alineado con los campos');
    console.log('4. Confirma que el posicionamiento sea IDÉNTICO al original');
    
  } catch (error) {
    console.error('\n❌ Error en la prueba:', error.message);
  }
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  ejecutarPrueba().catch(console.error);
}

module.exports = {
  ejecutarPrueba,
  generarPDFPosicionamientoPerfecto
};
