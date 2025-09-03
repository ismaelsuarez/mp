#!/usr/bin/env node

/**
 * Script de Análisis Detallado - Extraer TODAS las líneas del PDF de ejemplo
 */

const fs = require('fs');
const path = require('path');

async function analizarEjemploDetallado() {
  console.log('🔍 ANÁLISIS DETALLADO DEL PDF DE EJEMPLO\n');
  
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
    
    console.log('\n📝 TODAS LAS LÍNEAS DEL PDF:');
    console.log('─────────────────────────────────────');
    lineas.forEach((linea, index) => {
      console.log(`${(index + 1).toString().padStart(2, '0')}: "${linea}"`);
    });
    
    console.log('\n🎯 ANÁLISIS DE ESTRUCTURA:');
    console.log('─────────────────────────────');
    
    // Analizar estructura por secciones
    const secciones = {
      'ENCABEZADO': lineas.slice(0, 6),
      'DATOS_CLIENTE': lineas.slice(6, 16),
      'DETALLES': lineas.slice(16, 23),
      'TOTALES': lineas.slice(23, 26),
      'PIE': lineas.slice(26)
    };
    
    Object.entries(secciones).forEach(([nombre, contenido]) => {
      console.log(`\n${nombre}:`);
      contenido.forEach((linea, index) => {
        console.log(`  ${linea}`);
      });
    });
    
    console.log('\n🔍 PATRONES IDENTIFICADOS:');
    console.log('───────────────────────────');
    
    // Buscar patrones específicos
    const patrones = [
      { nombre: 'Número de factura', regex: /FACTURA\s*(\d+)/, ejemplo: 'FACTURA 0016' },
      { nombre: 'Fecha', regex: /(\d{2}\/\d{2}\/\d{4})/, ejemplo: '01/09/2025' },
      { nombre: 'CUIT', regex: /(\d{2}-\d{8}-\d{1})/, ejemplo: '30-71872876-9' },
      { nombre: 'Condición IVA', regex: /(RESPONSABLE INSCRIPTO)/, ejemplo: 'RESPONSABLE INSCRIPTO' },
      { nombre: 'Forma de pago', regex: /Pago:\s*([^,]+)/, ejemplo: 'MC DEBIT' },
      { nombre: 'Monto total', regex: /(\d+\.\d{3})/, ejemplo: '99173.554' }
    ];
    
    patrones.forEach(patron => {
      const match = data.text.match(patron.regex);
      if (match) {
        console.log(`   ✅ ${patron.nombre}: "${match[1] || match[0]}"`);
      } else {
        console.log(`   ❌ ${patron.nombre}: No encontrado`);
      }
    });
    
  } catch (error) {
    console.log(`❌ Error analizando PDF: ${error.message}`);
  }
}

analizarEjemploDetallado().catch(console.error);
