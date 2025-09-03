#!/usr/bin/env node

/**
 * Script de Análisis - Examinar PDF de ejemplo para entender estructura y fuentes
 */

const fs = require('fs');
const path = require('path');

async function analizarEjemploFactura() {
  console.log('🔍 ANALIZANDO EJEMPLO DE FACTURA A\n');
  
  const ejemploPath = 'templates/ejemplos/factura_A/FA_0016-00009207.pdf';
  
  if (!fs.existsSync(ejemploPath)) {
    console.log('❌ No se encontró el archivo de ejemplo');
    return;
  }
  
  console.log('📁 ARCHIVO DE EJEMPLO:');
  console.log(`   Ruta: ${ejemploPath}`);
  
  // Obtener información del archivo
  const stats = fs.statSync(ejemploPath);
  console.log(`   Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`   Fecha: ${stats.mtime.toLocaleString()}`);
  
  console.log('\n📊 ANÁLISIS DEL PDF:');
  console.log('─────────────────────');
  
  // Intentar extraer información del PDF usando pdf-parse si está disponible
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(ejemploPath);
    const data = await pdfParse(dataBuffer);
    
    console.log(`   Páginas: ${data.numpages}`);
    console.log(`   Texto extraído: ${data.text.length} caracteres`);
    
    // Analizar el contenido del texto
    const lineas = data.text.split('\n').filter(line => line.trim().length > 0);
    console.log(`   Líneas de texto: ${lineas.length}`);
    
    console.log('\n📝 PRIMERAS LÍNEAS DEL CONTENIDO:');
    console.log('─────────────────────────────────────');
    lineas.slice(0, 20).forEach((linea, index) => {
      console.log(`   ${index + 1}: ${linea}`);
    });
    
    // Analizar patrones de texto
    console.log('\n🔍 PATRONES DETECTADOS:');
    console.log('───────────────────────');
    
    // Buscar números de factura
    const numerosFactura = data.text.match(/[A-Z]+\s*[0-9-]+/g);
    if (numerosFactura) {
      console.log(`   Números de factura: ${numerosFactura.slice(0, 5).join(', ')}`);
    }
    
    // Buscar fechas
    const fechas = data.text.match(/\d{2}\/\d{2}\/\d{4}/g);
    if (fechas) {
      console.log(`   Fechas: ${fechas.slice(0, 3).join(', ')}`);
    }
    
    // Buscar montos
    const montos = data.text.match(/\$\s*\d+[.,]\d+/g);
    if (montos) {
      console.log(`   Montos: ${montos.slice(0, 5).join(', ')}`);
    }
    
    // Buscar CUITs
    const cuits = data.text.match(/\d{2}-\d{8}-\d{1}/g);
    if (cuits) {
      console.log(`   CUITs: ${cuits.slice(0, 3).join(', ')}`);
    }
    
  } catch (error) {
    console.log(`   ⚠️ No se pudo analizar el contenido del PDF: ${error.message}`);
    console.log('   💡 Instalar pdf-parse: npm install pdf-parse');
  }
  
  console.log('\n🎯 RECOMENDACIONES:');
  console.log('───────────────────');
  console.log('1. Comparar el tamaño de texto del ejemplo con nuestro PDF generado');
  console.log('2. Verificar que las fuentes sean del tamaño correcto');
  console.log('3. Ajustar posicionamiento según la estructura del ejemplo');
  console.log('4. Usar el ejemplo como referencia visual para el formato final');
}

analizarEjemploFactura().catch(console.error);
