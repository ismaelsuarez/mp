#!/usr/bin/env node

/**
 * Script de Diagnóstico - Verificar fuentes disponibles en Jimp
 */

const Jimp = require('jimp');

async function verificarFuentes() {
  console.log('🔍 VERIFICANDO FUENTES DISPONIBLES EN JIMP\n');
  
  // Lista de fuentes que vamos a probar
  const fuentes = [
    'FONT_SANS_8_BLACK',
    'FONT_SANS_10_BLACK', 
    'FONT_SANS_12_BLACK',
    'FONT_SANS_14_BLACK',
    'FONT_SANS_16_BLACK',
    'FONT_SANS_20_BLACK',
    'FONT_SANS_24_BLACK',
    'FONT_SANS_32_BLACK',
    'FONT_SANS_64_BLACK',
    'FONT_SANS_128_BLACK'
  ];
  
  console.log('📋 FUENTES DISPONIBLES:');
  console.log('─────────────────────────');
  
  for (const nombreFuente of fuentes) {
    try {
      if (Jimp[nombreFuente]) {
        const font = await Jimp.loadFont(Jimp[nombreFuente]);
        console.log(`✅ ${nombreFuente} - DISPONIBLE`);
      } else {
        console.log(`❌ ${nombreFuente} - NO EXISTE`);
      }
    } catch (error) {
      console.log(`⚠️ ${nombreFuente} - ERROR: ${error.message}`);
    }
  }
  
  console.log('\n🎯 RECOMENDACIÓN:');
  console.log('Usar las fuentes marcadas como DISPONIBLE para evitar errores.');
}

verificarFuentes().catch(console.error);
