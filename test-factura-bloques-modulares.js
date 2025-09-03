#!/usr/bin/env node

/**
 * Script de Generación de Factura con BLOQUES MODULARES
 * Cada sección es un bloque independiente que se puede manipular
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

// BLOQUE 1: ENCABEZADO
function generarBloqueEncabezado(doc, posicion) {
  console.log('   📋 Generando BLOQUE ENCABEZADO...');
  
  const { x, y } = posicion;
  
  // Configurar fuente para encabezado
  doc.fontSize(16).font('Helvetica-Bold');
  
  // Posicionar elementos del encabezado - CASI TODO A LA DERECHA
  doc.text('A', x + 400, y);                    // Línea 1 - DERECHA
  doc.text('Nº', x + 400, y + 20);             // Línea 2 - DERECHA
  doc.text('FACTURA', x + 400, y + 40);        // Línea 3 - DERECHA
  
  // Datos del comprobante - DERECHA
  doc.fontSize(12).font('Helvetica');
  doc.text(`${datosFactura.cbte.numero}  ${datosFactura.cbte.numeroCompleto}-`, x + 400, y + 60);  // Línea 4 - DERECHA
  doc.text(datosFactura.cbte.fecha, x + 400, y + 80);                                              // Línea 5 - DERECHA
  doc.text(`Ref.Interna ${datosFactura.receptor.refInterna}`, x + 400, y + 100);                   // Línea 6 - DERECHA
  
  return y + 120; // Retornar la posición Y final del bloque
}

// BLOQUE 2: DATOS CLIENTE Y FACTURACIÓN
function generarBloqueDatosCliente(doc, posicion) {
  console.log('   👤 Generando BLOQUE DATOS CLIENTE...');
  
  const { x, y } = posicion;
  
  doc.fontSize(12).font('Helvetica');
  
  // Datos del cliente
  doc.text('Fecha:', x, y);              // Línea 7
  doc.text(`Atendio: ${datosFactura.receptor.atendio}`, x, y + 20);                        // Línea 8
  doc.text(`(${datosFactura.receptor.cuit.substring(0, 6)})${datosFactura.receptor.nombre}`, x, y + 40); // Línea 9
  doc.text(`Hora: ${datosFactura.cbte.hora}`, x, y + 60);                                 // Línea 10
  doc.text(datosFactura.receptor.domicilio, x, y + 80);                                    // Línea 11
  doc.text(datosFactura.receptor.cuit, x, y + 100);                                         // Línea 12
  doc.text(datosFactura.receptor.condicionIva, x, y + 120);                                 // Línea 13
  doc.text(`Pago:${datosFactura.cbte.formaPago}`, x, y + 140);                             // Línea 14
  doc.text('Mail:', x, y + 160);               // Línea 15
  doc.text(`Nota de Recepcion:${datosFactura.receptor.notaRecepcion}                    REMITO:`, x, y + 180); // Línea 16
  
  // Línea informativa
  doc.text('Factura emitida conforme a datos proporcionados por el cliente', x, y + 200); // Línea 17
  
  return y + 220; // Retornar la posición Y final del bloque
}

// BLOQUE 3: DETALLE DE FACTURACIÓN
function generarBloqueDetalle(doc, posicion) {
  console.log('   📝 Generando BLOQUE DETALLE...');
  
  const { x, y } = posicion;
  
  doc.fontSize(12).font('Helvetica');
  
  let yActual = y;
  
  // Generar cada línea de detalle - MÁS BAJO Y MÁS EXPANDIDO PARA CENTRAR
  datosFactura.detalle.forEach((item, index) => {
    // Formato EXACTO del original: "1  DESCRIPCIÓN                                    PRECIO   21.00%      IMPORTE"
    const descripcion = `${item.cantidad}  ${item.descripcion}`;
    const precio = item.precioUnitario.toFixed(3);
    const iva = `${item.alicuotaIva}.00%`;
    const importe = item.importe.toFixed(3);
    
    // Posicionar cada elemento - MÁS EXPANDIDO PARA CENTRAR CON EL FONDO
    doc.text(descripcion, x, yActual);                    // Cantidad + Descripción (izquierda)
    doc.text(precio, x + 200, yActual);                   // Precio Unitario (más centrado)
    doc.text(iva, x + 280, yActual);                      // IVA% (más centrado)
    doc.text(importe, x + 350, yActual);                  // Importe (más centrado)
    
    yActual += 30; // Más espaciado entre líneas
  });
  
  // Línea de pesos
  doc.text('SON PESOS: CIENTO CUARENTA Y NUEVE MIL TRESCIENTOS.-', x, yActual);
  yActual += 30;
  
  return yActual; // Retornar la posición Y final del bloque
}

// BLOQUE 4: TOTALES
function generarBloqueTotales(doc, posicion) {
  console.log('   💰 Generando BLOQUE TOTALES...');
  
  const { x, y } = posicion;
  
  doc.fontSize(14).font('Helvetica-Bold');
  
  let yActual = y;
  
  // Neto - Derecha (como en el original) - DENTRO DEL RECUADRO
  doc.text(`Neto ${datosFactura.detalle[0].alicuotaIva}%        ${datosFactura.totales.neto.toFixed(2)}`, x + 250, yActual);
  yActual += 20;
  
  // IVA - Derecha (como en el original) - DENTRO DEL RECUADRO
  doc.text(`IVA ${datosFactura.detalle[0].alicuotaIva}%         ${datosFactura.totales.iva.toFixed(2)}`, x + 250, yActual);
  yActual += 20;
  
  // CAE - Izquierda (como en el original) - DENTRO DEL RECUADRO
  doc.text(`CAE Nº ${datosFactura.afip.cae}`, x + 50, yActual);
  yActual += 20;
  
  // Fecha VTO - Izquierda (como en el original) - DENTRO DEL RECUADRO
  doc.text(`${datosFactura.afip.cae_vto}FECHA VTO.`, x + 50, yActual);
  yActual += 20;
  
  // TOTAL - Derecha (como en el original) - DENTRO DEL RECUADRO
  doc.text(`        ${datosFactura.totales.total.toFixed(2)}TOTAL`, x + 250, yActual);
  
  return yActual + 20; // Retornar la posición Y final del bloque
}

// BLOQUE 5: PIE DE PÁGINA
function generarBloquePiePagina(doc, posicion) {
  console.log('   🦶 Generando BLOQUE PIE DE PÁGINA...');
  
  const { x, y } = posicion;
  
  doc.fontSize(10).font('Helvetica');
  
  let yActual = y;
  
  // Textos del pie de página - ABAJO AL PIE DE LA PLANTILLA
  doc.text('Por la garantia ir a Montecaseros 1126,cdad-EXCEPTO notebook,tablet,impresoras comunicarse al 0800 de cada Marca', x, yActual);
  yActual += 25;
  doc.text('Garantia de reparacion:30 dias,no incluye software/configuraciones ni mantenimiento/limpieza', x, yActual);
  yActual += 25;
  doc.text('Cambios dentro de las 48hs -', x, yActual);
  yActual += 25;
  doc.text('Defensa del consumidor Mendoza:08002226678 o al 148 opcion 3', x, yActual);
  yActual += 25;
  doc.text('** GRACIAS POR SU COMPRA **', x, yActual);
  
  return yActual + 25; // Retornar la posición Y final del bloque
}

// Función principal para generar PDF con bloques modulares
async function generarPDFConBloques(outputPdfPath) {
  console.log('🎨 Generando PDF con BLOQUES MODULARES...');
  
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
    
    // 2. GENERAR BLOQUES MODULARES
    console.log('   📦 Generando bloques modulares...');
    
    // BLOQUE 1: ENCABEZADO (casi todo a la derecha)
    let yActual = generarBloqueEncabezado(doc, { x: 100, y: 60 });
    
    // BLOQUE 2: DATOS CLIENTE (izquierda)
    yActual = generarBloqueDatosCliente(doc, { x: 100, y: yActual });
    
    // BLOQUE 3: DETALLE (más bajo y expandido para centrar con el fondo)
    yActual = generarBloqueDetalle(doc, { x: 100, y: yActual + 50 }); // +50 para más bajo
    
    // BLOQUE 4: TOTALES (dentro del recuadro)
    yActual = generarBloqueTotales(doc, { x: 100, y: yActual });
    
    // BLOQUE 5: PIE DE PÁGINA (abajo al pie de la plantilla)
    yActual = generarBloquePiePagina(doc, { x: 150, y: yActual + 100 }); // +100 para más abajo
    
    // Finalizar PDF
    doc.end();
    
    // Esperar a que se complete la escritura
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    console.log(`✅ PDF con bloques modulares generado: ${outputPdfPath}`);
    return outputPdfPath;
    
  } catch (error) {
    console.error('❌ Error generando PDF:', error.message);
    return null;
  }
}

// Función principal
async function ejecutarPrueba() {
  console.log('🧪 INICIO DE PRUEBA - BLOQUES MODULARES\n');
  
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
    // Generar PDF con bloques modulares
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfPath = path.join(outDir, `FACTURA_BLOQUES_MODULARES_${timestamp}.pdf`);
    
    const pdfOK = await generarPDFConBloques(pdfPath);
    
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
    console.log('✅ PDF con bloques modulares generado');
    console.log('✅ Cada sección es un bloque independiente y manipulable');
    console.log(`📁 PDF disponible en: ${pdfPath}`);
    
    console.log('\n🔍 VERIFICAR RESULTADO:');
    console.log('1. Abre el PDF generado');
    console.log('2. Compara con MiFondo-pagado.jpg');
    console.log('3. Verifica que cada bloque esté bien posicionado');
    console.log('4. Confirma que el formato sea idéntico al original');
    
    console.log('\n📋 ESTRUCTURA DE BLOQUES:');
    console.log('   • BLOQUE 1: ENCABEZADO (x: 500, y: 60) - CASI TODO A LA DERECHA');
    console.log('   • BLOQUE 2: DATOS CLIENTE (x: 100, y: variable)');
    console.log('   • BLOQUE 3: DETALLE (x: 100, y: variable + 50) - MÁS BAJO Y EXPANDIDO');
    console.log('   • BLOQUE 4: TOTALES (x: 100, y: variable) - DENTRO DEL RECUADRO');
    console.log('   • BLOQUE 5: PIE DE PÁGINA (x: 150, y: variable + 100) - ABAJO AL PIE');
    
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
  generarPDFConBloques,
  generarBloqueEncabezado,
  generarBloqueDatosCliente,
  generarBloqueDetalle,
  generarBloqueTotales,
  generarBloquePiePagina
};
