const fs = require('fs');
const pdfParse = require('pdf-parse');

async function analyzeFonts() {
  try {
    console.log('🔍 Analizando fuentes de la factura original...');
    
    // Leer la factura original
    const dataBuffer = fs.readFileSync('templates/ejemplos/factura_A/FA_0016-00009207.pdf');
    
    // Parsear el PDF
    const data = await pdfParse(dataBuffer);
    
    console.log('\n📊 INFORMACIÓN DEL PDF:');
    console.log('========================');
    console.log(`Páginas: ${data.numpages}`);
    console.log(`Versión: ${data.info.PDFFormatVersion}`);
    console.log(`Título: ${data.info.Title || 'No especificado'}`);
    console.log(`Autor: ${data.info.Author || 'No especificado'}`);
    console.log(`Creador: ${data.info.Creator || 'No especificado'}`);
    console.log(`Productor: ${data.info.Producer || 'No especificado'}`);
    
    // Buscar información de fuentes en el texto
    console.log('\n🔤 ANÁLISIS DE FUENTES:');
    console.log('========================');
    
    // Buscar patrones que indiquen fuentes
    const fontPatterns = [
      /font-family[:\s]+([^;,\n]+)/gi,
      /font[:\s]+([^;,\n]+)/gi,
      /family[:\s]+([^;,\n]+)/gi
    ];
    
    let fontsFound = [];
    fontPatterns.forEach(pattern => {
      const matches = data.text.match(pattern);
      if (matches) {
        fontsFound = fontsFound.concat(matches);
      }
    });
    
    if (fontsFound.length > 0) {
      console.log('Fuentes encontradas:');
      fontsFound.forEach(font => console.log(`  - ${font}`));
    } else {
      console.log('No se encontraron referencias directas a fuentes en el texto.');
    }
    
    // Analizar el contenido para inferir el tipo de fuente
    console.log('\n📝 ANÁLISIS DEL CONTENIDO:');
    console.log('============================');
    
    // Verificar si hay caracteres especiales que indiquen el tipo de fuente
    const hasSpecialChars = /[áéíóúñÁÉÍÓÚÑ]/.test(data.text);
    const hasAccents = /[àèìòùÀÈÌÒÙ]/.test(data.text);
    
    console.log(`Caracteres especiales españoles: ${hasSpecialChars ? 'SÍ' : 'NO'}`);
    console.log(`Acentos adicionales: ${hasAccents ? 'SÍ' : 'NO'}`);
    
    // Mostrar una muestra del texto para análisis visual
    console.log('\n📄 MUESTRA DEL TEXTO (primeras 500 caracteres):');
    console.log('=================================================');
    console.log(data.text.substring(0, 500));
    
    // Recomendaciones basadas en el análisis
    console.log('\n💡 RECOMENDACIONES DE FUENTES:');
    console.log('================================');
    
    if (hasSpecialChars) {
      console.log('✅ Usar fuente con soporte completo para español');
      console.log('   Recomendadas:');
      console.log('   - Arial (sans-serif)');
      console.log('   - Helvetica (sans-serif)');
      console.log('   - Roboto (sans-serif)');
      console.log('   - Open Sans (sans-serif)');
    } else {
      console.log('✅ Fuente estándar sin caracteres especiales');
      console.log('   Recomendadas:');
      console.log('   - Arial (sans-serif)');
      console.log('   - Helvetica (sans-serif)');
      console.log('   - Times New Roman (serif)');
    }
    
    console.log('\n🎯 PRÓXIMOS PASOS:');
    console.log('===================');
    console.log('1. Verificar si la fuente recomendada está disponible en el sistema');
    console.log('2. Implementar la fuente en el layout de la factura');
    console.log('3. Probar con diferentes tamaños y estilos');
    
  } catch (error) {
    console.error('❌ Error al analizar el PDF:', error.message);
  }
}

// Ejecutar el análisis
analyzeFonts();
