/**
 * Script para generar clave privada con OpenSSL
 * NOTA: Esto es solo para pruebas. Para producción, usa AFIP Web.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  console.log('🔑 Generando clave privada con OpenSSL...');
  
  // Verificar si OpenSSL está instalado
  try {
    execSync('openssl version', { stdio: 'pipe' });
    console.log('✅ OpenSSL encontrado');
  } catch (error) {
    console.log('❌ OpenSSL no está instalado');
    console.log('💡 Instala OpenSSL desde: https://slproweb.com/products/Win32OpenSSL.html');
    return;
  }
  
  // Crear directorio si no existe
  const outputDir = 'C:\\arca';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const keyPath = path.join(outputDir, 'clave_privada.key');
  
  // Generar clave privada RSA de 2048 bits
  console.log('🔧 Generando clave RSA de 2048 bits...');
  execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: 'inherit' });
  
  console.log('✅ Clave privada generada en:', keyPath);
  console.log('📄 Contenido (primeras líneas):');
  
  const keyContent = fs.readFileSync(keyPath, 'utf8');
  console.log(keyContent.split('\n').slice(0, 5).join('\n'));
  console.log('...');
  
  console.log('\n💡 IMPORTANTE:');
  console.log('1. Esta clave es solo para pruebas');
  console.log('2. Para producción, usa AFIP Web');
  console.log('3. Actualiza la configuración con la nueva ruta');
  
} catch (error) {
  console.log('❌ Error:', error.message);
}
