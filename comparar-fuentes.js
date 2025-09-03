#!/usr/bin/env node

/**
 * Script de Comparación - Analizar diferencias en tamaños de fuente
 */

const fs = require('fs');
const path = require('path');

async function compararFuentes() {
  console.log('🔍 COMPARANDO TAMAÑOS DE FUENTE\n');
  
  // Analizar nuestro PDF generado más reciente
  const testOutputDir = 'test-output';
  const archivos = fs.readdirSync(testOutputDir)
    .filter(file => file.endsWith('.pdf'))
    .sort()
    .reverse();
  
  if (archivos.length === 0) {
    console.log('❌ No se encontraron PDFs generados para comparar');
    return;
  }
  
  // Buscar específicamente el PDF híbrido más reciente
  const pdfHibrido = archivos.find(file => file.includes('HIBRIDA'));
  const nuestroPDF = pdfHibrido || archivos[0];
  
  console.log(`🎯 Analizando: ${nuestroPDF}`);
  const ejemploPDF = 'templates/ejemplos/factura_A/FA_0016-00009207.pdf';
  
  console.log('📊 ARCHIVOS A COMPARAR:');
  console.log('─────────────────────────');
  console.log(`   Nuestro PDF: ${nuestroPDF}`);
  console.log(`   Ejemplo: ${ejemploPDF}`);
  
  console.log('\n📏 ANÁLISIS DE TAMAÑOS:');
  console.log('─────────────────────────');
  
  try {
    // Analizar nuestro PDF
    const pdfParse = require('pdf-parse');
    const nuestroBuffer = fs.readFileSync(path.join(testOutputDir, nuestroPDF));
    const nuestroData = await pdfParse(nuestroBuffer);
    
    const ejemploBuffer = fs.readFileSync(ejemploPDF);
    const ejemploData = await pdfParse(ejemploBuffer);
    
    console.log('   NUESTRO PDF:');
    console.log(`     Páginas: ${nuestroData.numpages}`);
    console.log(`     Caracteres: ${nuestroData.text.length}`);
    console.log(`     Líneas: ${nuestroData.text.split('\n').filter(l => l.trim().length > 0).length}`);
    
    console.log('\n   EJEMPLO:');
    console.log(`     Páginas: ${ejemploData.numpages}`);
    console.log(`     Caracteres: ${ejemploData.text.length}`);
    console.log(`     Líneas: ${ejemploData.text.split('\n').filter(l => l.trim().length > 0).length}`);
    
    // Comparar contenido
    console.log('\n🔍 COMPARACIÓN DE CONTENIDO:');
    console.log('──────────────────────────────');
    
    const nuestroTexto = nuestroData.text;
    const ejemploTexto = ejemploData.text;
    
    // Buscar patrones similares
    const patrones = [
      { nombre: 'Números de factura', regex: /[A-Z]+\s*[0-9-]+/g },
      { nombre: 'Fechas', regex: /\d{2}\/\d{2}\/\d{4}/g },
      { nombre: 'Montos', regex: /\$\s*\d+[.,]\d+/g },
      { nombre: 'CUITs', regex: /\d{2}-\d{8}-\d{1}/g }
    ];
    
    patrones.forEach(patron => {
      const nuestros = nuestroTexto.match(patron.regex) || [];
      const ejemplos = ejemploTexto.match(patron.regex) || [];
      
      console.log(`   ${patron.nombre}:`);
      console.log(`     Nuestro: ${nuestros.slice(0, 3).join(', ')}`);
      console.log(`     Ejemplo: ${ejemplos.slice(0, 3).join(', ')}`);
    });
    
    // Análisis de densidad de texto
    console.log('\n📊 ANÁLISIS DE DENSIDAD:');
    console.log('─────────────────────────');
    
    const densidadNuestro = nuestroData.text.length / (nuestroData.numpages || 1);
    const densidadEjemplo = ejemploData.text.length / (ejemploData.numpages || 1);
    
    console.log(`   Densidad de texto (caracteres/página):`);
    console.log(`     Nuestro: ${densidadNuestro.toFixed(0)}`);
    console.log(`     Ejemplo: ${densidadEjemplo.toFixed(0)}`);
    
    if (densidadNuestro > densidadEjemplo * 1.5) {
      console.log('   ⚠️ Nuestro PDF tiene MUCHO MÁS texto (fuentes muy pequeñas)');
    } else if (densidadNuestro < densidadEjemplo * 0.7) {
      console.log('   ⚠️ Nuestro PDF tiene MUY POCO texto (fuentes muy grandes)');
    } else {
      console.log('   ✅ Densidad de texto similar (fuentes del tamaño correcto)');
    }
    
  } catch (error) {
    console.log(`   ❌ Error analizando PDFs: ${error.message}`);
  }
  
  console.log('\n🎯 RECOMENDACIONES:');
  console.log('───────────────────');
  console.log('1. Si las fuentes son muy pequeñas: Aumentar tamaño');
  console.log('2. Si las fuentes son muy grandes: Reducir tamaño');
  console.log('3. Comparar visualmente ambos PDFs lado a lado');
  console.log('4. Ajustar posicionamiento según el ejemplo');
}

compararFuentes().catch(console.error);
