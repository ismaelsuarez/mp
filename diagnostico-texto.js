#!/usr/bin/env node

/**
 * Script de Diagnóstico - Verificar renderizado de texto en imagen
 */

const fs = require('fs');
const path = require('path');

async function diagnosticarTexto() {
  console.log('🔍 DIAGNÓSTICO DE RENDERIZADO DE TEXTO\n');
  
  try {
    const Jimp = require('jimp');
    
    // Crear una imagen de prueba más pequeña para debug
    console.log('🎨 Creando imagen de prueba...');
    const image = new Jimp(800, 600, 0xFFFFFFFF); // Fondo blanco para ver el texto
    
    // Cargar fuentes
    const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
    const fontBold = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
    
    // Renderizar texto de prueba
    console.log('📝 Renderizando texto de prueba...');
    image.print(font, 50, 50, 'Texto de prueba normal');
    image.print(fontBold, 50, 100, 'TEXTO EN NEGRITA');
    image.print(font, 50, 150, 'Cliente: Cliente Demo S.A.');
    image.print(font, 50, 200, 'CUIT: 20300123456');
    
    // Guardar imagen de prueba
    const testPath = 'test-output/debug-texto.png';
    await image.writeAsync(testPath);
    console.log(`✅ Imagen de prueba guardada: ${testPath}`);
    
    // Verificar que la imagen se creó
    if (fs.existsSync(testPath)) {
      const stats = fs.statSync(testPath);
      console.log(`   Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log('   ✅ Imagen creada exitosamente');
    } else {
      console.log('   ❌ Error: Imagen no se creó');
    }
    
    // Ahora probar con la resolución real
    console.log('\n🎨 Probando con resolución real (2482x3683)...');
    const imageReal = new Jimp(2482, 3683, 0x00000000); // Transparente
    
    // Renderizar texto en posiciones específicas
    imageReal.print(font, 100, 100, 'FACTURA A');
    imageReal.print(font, 200, 300, 'Cliente Demo S.A.');
    imageReal.print(font, 200, 400, 'CUIT: 20300123456');
    
    // Guardar imagen real
    const realPath = 'test-output/debug-texto-real.png';
    await imageReal.writeAsync(realPath);
    console.log(`✅ Imagen real guardada: ${realPath}`);
    
    if (fs.existsSync(realPath)) {
      const stats = fs.statSync(realPath);
      console.log(`   Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log('   ✅ Imagen real creada exitosamente');
    }
    
    console.log('\n🎯 DIAGNÓSTICO COMPLETADO');
    console.log('───────────────────────────');
    console.log('1. Verifica las imágenes de debug generadas');
    console.log('2. Si las imágenes de debug tienen texto, el problema está en el PDF');
    console.log('3. Si las imágenes de debug NO tienen texto, el problema está en Jimp');
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error.message);
  }
}

diagnosticarTexto().catch(console.error);
