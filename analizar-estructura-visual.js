#!/usr/bin/env node

/**
 * Script de Análisis de Estructura Visual - Analizar el PDF original
 * para replicar EXACTAMENTE el posicionamiento y estructura
 */

const fs = require('fs');
const path = require('path');

async function analizarEstructuraVisual() {
  console.log('🔍 ANÁLISIS DE ESTRUCTURA VISUAL DEL PDF ORIGINAL\n');
  
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
    
    console.log('\n🎯 ANÁLISIS DE POSICIONAMIENTO VISUAL:');
    console.log('─────────────────────────────────────────');
    
    // Analizar cada línea para entender su posición relativa
    lineas.forEach((linea, index) => {
      const numeroLinea = (index + 1).toString().padStart(2, '0');
      
      // Analizar el contenido para determinar su tipo y posición
      let tipo = 'TEXTO';
      let posicionEstimada = 'IZQUIERDA';
      
      if (linea.includes('FACTURA') || linea.includes('A') || linea.includes('Nº')) {
        tipo = 'ENCABEZADO';
        posicionEstimada = 'CENTRO-IZQUIERDA';
      } else if (linea.includes('CUIT') || linea.includes('RESPONSABLE') || linea.includes('BANDERA')) {
        tipo = 'DATOS_CLIENTE';
        posicionEstimada = 'IZQUIERDA';
      } else if (linea.includes('GRASA') || linea.includes('MANTENIMIENTO') || linea.includes('REPARACION')) {
        tipo = 'DETALLE';
        posicionEstimada = 'IZQUIERDA';
      } else if (linea.includes('Neto') || linea.includes('IVA') || linea.includes('TOTAL')) {
        tipo = 'TOTALES';
        posicionEstimada = 'DERECHA';
      } else if (linea.includes('garantia') || linea.includes('Defensa') || linea.includes('GRACIAS')) {
        tipo = 'PIE';
        posicionEstimada = 'CENTRO';
      }
      
      console.log(`${numeroLinea}: [${tipo.padEnd(12)}] [${posicionEstimada.padEnd(15)}] "${linea}"`);
    });
    
    console.log('\n📋 RESUMEN DE ESTRUCTURA:');
    console.log('───────────────────────────');
    
    // Contar tipos de contenido
    const tipos = {
      ENCABEZADO: 0,
      DATOS_CLIENTE: 0,
      DETALLE: 0,
      TOTALES: 0,
      PIE: 0,
      TEXTO: 0
    };
    
    lineas.forEach(linea => {
      if (linea.includes('FACTURA') || linea.includes('A') || linea.includes('Nº')) {
        tipos.ENCABEZADO++;
      } else if (linea.includes('CUIT') || linea.includes('RESPONSABLE') || linea.includes('BANDERA')) {
        tipos.DATOS_CLIENTE++;
      } else if (linea.includes('GRASA') || linea.includes('MANTENIMIENTO') || linea.includes('REPARACION')) {
        tipos.DETALLE++;
      } else if (linea.includes('Neto') || linea.includes('IVA') || linea.includes('TOTAL')) {
        tipos.TOTALES++;
      } else if (linea.includes('garantia') || linea.includes('Defensa') || linea.includes('GRACIAS')) {
        tipos.PIE++;
      } else {
        tipos.TEXTO++;
      }
    });
    
    Object.entries(tipos).forEach(([tipo, cantidad]) => {
      if (cantidad > 0) {
        console.log(`   • ${tipo.padEnd(15)}: ${cantidad} líneas`);
      }
    });
    
    console.log('\n🎨 RECOMENDACIONES DE POSICIONAMIENTO:');
    console.log('─────────────────────────────────────────');
    console.log('1. ENCABEZADO: Centrado-izquierda (x: 80-120, y: 50-150)');
    console.log('2. DATOS_CLIENTE: Izquierda (x: 50-80, y: 180-350)');
    console.log('3. DETALLE: Izquierda (x: 50-80, y: 400-600)');
    console.log('4. TOTALES: Derecha (x: 400-450, y: 600-700)');
    console.log('5. PIE: Centro (x: 100-200, y: 700-800)');
    
  } catch (error) {
    console.log(`❌ Error analizando PDF: ${error.message}`);
  }
}

// Ejecutar análisis
analizarEstructuraVisual().catch(console.error);
