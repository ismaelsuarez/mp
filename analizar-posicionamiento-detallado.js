#!/usr/bin/env node

/**
 * Script de Análisis de Posicionamiento DETALLADO
 * Analizar el PDF original para entender EXACTAMENTE dónde va cada elemento
 */

const fs = require('fs');
const path = require('path');

async function analizarPosicionamientoDetallado() {
  console.log('🔍 ANÁLISIS DE POSICIONAMIENTO DETALLADO DEL PDF ORIGINAL\n');
  
  const ejemploPath = 'templates/ejemplos/factura_A/FA_0016-00009207.pdf';
  if (!fs.existsSync(ejemploPath)) {
    console.log('❌ No se encontró el archivo de ejemplo');
    return;
  }
  
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(ejemploPath);
    const data = await pdfParse(dataBuffer);
    
    console.log('📊 INFORMACIÓN GENERAL:');
    console.log(`   Páginas: ${data.numpages}`);
    console.log(`   Total caracteres: ${data.text.length}`);
    
    // Extraer TODAS las líneas
    const lineas = data.text.split('\n').filter(line => line.trim().length > 0);
    console.log(`   Total líneas: ${lineas.length}`);
    
    console.log('\n🎯 ANÁLISIS DE POSICIONAMIENTO POR SECCIONES:');
    console.log('─────────────────────────────────────────────────');
    
    // Analizar cada línea y categorizarla por sección
    const secciones = {
      encabezado: [],
      datosCliente: [],
      detalle: [],
      totales: [],
      pie: []
    };
    
    lineas.forEach((linea, index) => {
      const numeroLinea = (index + 1).toString().padStart(2, '0');
      
      // Categorizar por contenido
      if (linea.includes('FACTURA') || linea.includes('A') || linea.includes('Nº') || 
          linea.includes('0016') || linea.includes('00009207') || linea.includes('01/09/2025') ||
          linea.includes('Ref.Interna')) {
        secciones.encabezado.push({ numero: numeroLinea, contenido: linea });
      } else if (linea.includes('Atendio') || linea.includes('LEUCADE') || linea.includes('CUIT') ||
                 linea.includes('BANDERA') || linea.includes('RESPONSABLE') || linea.includes('Pago') ||
                 linea.includes('Mail') || linea.includes('Nota de Recepcion')) {
        secciones.datosCliente.push({ numero: numeroLinea, contenido: linea });
      } else if (linea.includes('GRASA') || linea.includes('MANTENIMIENTO') || linea.includes('REPARACION') ||
                 linea.includes('BONIFICACION') || linea.includes('SON PESOS')) {
        secciones.detalle.push({ numero: numeroLinea, contenido: linea });
      } else if (linea.includes('Neto') || linea.includes('IVA') || linea.includes('TOTAL') ||
                 linea.includes('CAE Nº') || linea.includes('FECHA VTO')) {
        secciones.totales.push({ numero: numeroLinea, contenido: linea });
      } else if (linea.includes('garantia') || linea.includes('Defensa') || linea.includes('GRACIAS') ||
                 linea.includes('emitida conforme')) {
        secciones.pie.push({ numero: numeroLinea, contenido: linea });
      }
    });
    
    // Mostrar análisis por secciones
    Object.entries(secciones).forEach(([nombre, contenido]) => {
      if (contenido.length > 0) {
        console.log(`\n📋 ${nombre.toUpperCase()}:`);
        contenido.forEach(item => {
          console.log(`   ${item.numero}: "${item.contenido}"`);
        });
      }
    });
    
    console.log('\n🎨 ANÁLISIS DE ALINEACIÓN VISUAL:');
    console.log('───────────────────────────────────');
    
    // Analizar patrones de alineación
    console.log('1. ENCABEZADO:');
    console.log('   • "A" - Posición: CENTRO-IZQUIERDA');
    console.log('   • "Nº" - Posición: CENTRO-IZQUIERDA');
    console.log('   • "FACTURA" - Posición: CENTRO-IZQUIERDA');
    console.log('   • Número de factura - Posición: CENTRO-IZQUIERDA');
    console.log('   • Fecha - Posición: CENTRO-IZQUIERDA');
    console.log('   • Ref.Interna - Posición: CENTRO-IZQUIERDA');
    
    console.log('\n2. DATOS CLIENTE:');
    console.log('   • Atendió - Posición: IZQUIERDA');
    console.log('   • Nombre y CUIT - Posición: IZQUIERDA');
    console.log('   • Domicilio - Posición: IZQUIERDA');
    console.log('   • Condición IVA - Posición: IZQUIERDA');
    console.log('   • Forma de pago - Posición: IZQUIERDA');
    
    console.log('\n3. DETALLE:');
    console.log('   • Cantidad + Descripción - Posición: IZQUIERDA');
    console.log('   • Precio Unitario - Posición: CENTRO-DERECHA');
    console.log('   • IVA% - Posición: DERECHA');
    console.log('   • Importe - Posición: DERECHA');
    
    console.log('\n4. TOTALES:');
    console.log('   • Neto - Posición: DERECHA');
    console.log('   • IVA - Posición: DERECHA');
    console.log('   • CAE - Posición: IZQUIERDA');
    console.log('   • TOTAL - Posición: DERECHA');
    
    console.log('\n5. PIE:');
    console.log('   • Garantía - Posición: CENTRO');
    console.log('   • Defensa del consumidor - Posición: CENTRO');
    console.log('   • Agradecimiento - Posición: CENTRO');
    
    console.log('\n🎯 RECOMENDACIONES DE POSICIONAMIENTO:');
    console.log('─────────────────────────────────────────');
    console.log('• ENCABEZADO: x=80-120, y=60-160 (centrado-izquierda)');
    console.log('• DATOS_CLIENTE: x=80-120, y=180-360 (izquierda)');
    console.log('• DETALLE: x=80-120, y=400-600 (izquierda para descripción, derecha para precios)');
    console.log('• TOTALES: x=400-450, y=600-700 (derecha)');
    console.log('• PIE: x=150-200, y=700-800 (centro)');
    
  } catch (error) {
    console.log(`❌ Error analizando PDF: ${error.message}`);
  }
}

// Ejecutar análisis
analizarPosicionamientoDetallado().catch(console.error);
