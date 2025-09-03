#!/usr/bin/env node

/**
 * Script de Posicionamiento Experimental - Generar múltiples versiones
 * para encontrar el alineamiento perfecto con MiFondo-pagado.jpg
 */

const fs = require('fs');
const path = require('path');

// Datos de factura (mismos que el script híbrido)
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

// Configuraciones de posicionamiento a probar
const configuracionesPosicion = [
  {
    nombre: 'POSICIÓN_ORIGINAL',
    descripcion: 'Posición actual del script híbrido',
    encabezado: { x: 50, yInicio: 50, espaciado: 20 },
    datosCliente: { x: 50, yInicio: 180, espaciado: 20 },
    detalle: { x: 50, yInicio: 420, espaciado: 25 },
    totales: { x: 50, yInicio: 0, espaciado: 20 } // Se calcula dinámicamente
  },
  {
    nombre: 'POSICIÓN_CENTRADA',
    descripcion: 'Posición centrada en la página',
    encabezado: { x: 150, yInicio: 80, espaciado: 25 },
    datosCliente: { x: 150, yInicio: 220, espaciado: 25 },
    detalle: { x: 150, yInicio: 450, espaciado: 30 },
    totales: { x: 150, yInicio: 0, espaciado: 25 }
  },
  {
    nombre: 'POSICIÓN_DERECHA',
    descripcion: 'Posición hacia la derecha',
    encabezado: { x: 250, yInicio: 60, espaciado: 22 },
    datosCliente: { x: 250, yInicio: 200, espaciado: 22 },
    detalle: { x: 250, yInicio: 430, espaciado: 27 },
    totales: { x: 250, yInicio: 0, espaciado: 22 }
  },
  {
    nombre: 'POSICIÓN_IZQUIERDA',
    descripcion: 'Posición hacia la izquierda',
    encabezado: { x: 30, yInicio: 70, espaciado: 18 },
    datosCliente: { x: 30, yInicio: 190, espaciado: 18 },
    detalle: { x: 30, yInicio: 410, espaciado: 23 },
    totales: { x: 30, yInicio: 0, espaciado: 18 }
  }
];

// Función para generar PDF con configuración específica
async function generarPDFConConfiguracion(config, outputPdfPath) {
  console.log(`🎨 Generando PDF con configuración: ${config.nombre}`);
  console.log(`   📝 ${config.descripcion}`);
  
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
    doc.image('templates/MiFondo-pagado.jpg', 0, 0, {
      fit: [doc.page.width, doc.page.height]
    });
    
    // 2. AGREGAR TEXTO CON CONFIGURACIÓN ESPECÍFICA
    doc.fontSize(16).font('Helvetica-Bold');
    
    // ENCABEZADO
    let y = config.encabezado.yInicio;
    doc.text('A', config.encabezado.x, y);
    y += config.encabezado.espaciado;
    doc.text('Nº', config.encabezado.x, y);
    y += config.encabezado.espaciado;
    doc.text('FACTURA', config.encabezado.x, y);
    y += config.encabezado.espaciado;
    doc.text(`${datosFactura.cbte.numero}  ${datosFactura.cbte.numeroCompleto}-`, config.encabezado.x, y);
    y += config.encabezado.espaciado;
    doc.text(datosFactura.cbte.fecha, config.encabezado.x, y);
    y += config.encabezado.espaciado;
    doc.text(`Ref.Interna ${datosFactura.receptor.refInterna}`, config.encabezado.x, y);
    
    // DATOS CLIENTE
    doc.fontSize(12).font('Helvetica');
    y = config.datosCliente.yInicio;
    doc.text('Fecha:', config.datosCliente.x, y);
    y += config.datosCliente.espaciado;
    doc.text(`Atendio: ${datosFactura.receptor.atendio}`, config.datosCliente.x, y);
    y += config.datosCliente.espaciado;
    doc.text(`(${datosFactura.receptor.cuit.substring(0, 6)})${datosFactura.receptor.nombre}`, config.datosCliente.x, y);
    y += config.datosCliente.espaciado;
    doc.text(`Hora: ${datosFactura.cbte.hora}`, config.datosCliente.x, y);
    y += config.datosCliente.espaciado;
    doc.text(datosFactura.receptor.domicilio, config.datosCliente.x, y);
    y += config.datosCliente.espaciado;
    doc.text(datosFactura.receptor.cuit, config.datosCliente.x, y);
    y += config.datosCliente.espaciado;
    doc.text(datosFactura.receptor.condicionIva, config.datosCliente.x, y);
    y += config.datosCliente.espaciado;
    doc.text(`Pago:${datosFactura.cbte.formaPago}`, config.datosCliente.x, y);
    y += config.datosCliente.espaciado;
    doc.text('Mail:', config.datosCliente.x, y);
    y += config.datosCliente.espaciado;
    doc.text(`Nota de Recepcion:${datosFactura.receptor.notaRecepcion}                    REMITO:`, config.datosCliente.x, y);
    
    // LÍNEA INFORMATIVA
    y += config.datosCliente.espaciado;
    doc.text('Factura emitida conforme a datos proporcionados por el cliente', config.datosCliente.x, y);
    
    // FILAS DE DETALLE
    y = config.detalle.yInicio;
    datosFactura.detalle.forEach((item, index) => {
      const lineaDetalle = `${item.cantidad}  ${item.descripcion.padEnd(50)}                     ${item.precioUnitario.toFixed(3)}   ${item.alicuotaIva}.00%     ${item.importe.toFixed(3)}`;
      doc.text(lineaDetalle, config.detalle.x, y);
      y += config.detalle.espaciado;
    });
    
    // LÍNEA DE PESOS
    doc.text('SON PESOS: CIENTO CUARENTA Y NUEVE MIL TRESCIENTOS.-', config.detalle.x, y);
    y += config.detalle.espaciado;
    
    // TOTALES
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text(`Neto ${datosFactura.detalle[0].alicuotaIva}%        ${datosFactura.totales.neto.toFixed(2)}`, config.totales.x, y);
    y += config.totales.espaciado;
    doc.text(`IVA ${datosFactura.detalle[0].alicuotaIva}%         ${datosFactura.totales.iva.toFixed(2)}`, config.totales.x, y);
    y += config.totales.espaciado;
    doc.text(`CAE Nº ${datosFactura.afip.cae}`, config.totales.x, y);
    y += config.totales.espaciado;
    doc.text(`${datosFactura.afip.cae_vto}FECHA VTO.`, config.totales.x, y);
    y += config.totales.espaciado;
    doc.text(`        ${datosFactura.totales.total.toFixed(2)}TOTAL`, config.totales.x, y);
    
    // PIE
    doc.fontSize(10).font('Helvetica');
    y += config.totales.espaciado * 2;
    doc.text('Por la garantia ir a Montecaseros 1126,cdad-EXCEPTO notebook,tablet,impresoras comunicarse al 0800 de cada Marca', config.totales.x, y);
    y += config.totales.espaciado;
    doc.text('Garantia de reparacion:30 dias,no incluye software/configuraciones ni mantenimiento/limpieza', config.totales.x, y);
    y += config.totales.espaciado;
    doc.text('Cambios dentro de las 48hs -', config.totales.x, y);
    y += config.totales.espaciado;
    doc.text('Defensa del consumidor Mendoza:08002226678 o al 148 opcion 3', config.totales.x, y);
    y += config.totales.espaciado;
    doc.text('** GRACIAS POR SU COMPRA **', config.totales.x, y);
    
    // Finalizar PDF
    doc.end();
    
    // Esperar a que se complete la escritura
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    console.log(`   ✅ PDF generado: ${path.basename(outputPdfPath)}`);
    return outputPdfPath;
    
  } catch (error) {
    console.error(`   ❌ Error generando PDF: ${error.message}`);
    return null;
  }
}

// Función principal
async function ejecutarPruebasPosicionamiento() {
  console.log('🧪 INICIO DE PRUEBAS DE POSICIONAMIENTO EXPERIMENTAL\n');
  
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
  
  console.log('🎯 Generando múltiples versiones con diferentes posiciones...\n');
  
  // Generar PDF para cada configuración
  for (const config of configuracionesPosicion) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfPath = path.join(outDir, `FACTURA_${config.nombre}_${timestamp}.pdf`);
    
    await generarPDFConConfiguracion(config, pdfPath);
    console.log(''); // Línea en blanco para separar
  }
  
  console.log('🎉 PRUEBAS DE POSICIONAMIENTO COMPLETADAS');
  console.log('📁 Todos los PDFs están en: test-output/');
  console.log('\n🔍 INSTRUCCIONES PARA EVALUAR:');
  console.log('1. Abre cada PDF generado');
  console.log('2. Compara con MiFondo-pagado.jpg');
  console.log('3. Identifica cuál tiene mejor alineación');
  console.log('4. Nota las coordenadas que funcionan mejor');
  console.log('\n📋 CONFIGURACIONES GENERADAS:');
  configuracionesPosicion.forEach(config => {
    console.log(`   • ${config.nombre}: ${config.descripcion}`);
  });
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  ejecutarPruebasPosicionamiento().catch(console.error);
}

module.exports = {
  ejecutarPruebasPosicionamiento,
  generarPDFConConfiguracion,
  configuracionesPosicion
};
