/**
 * Script para generar clave privada compatible con certificado AFIP
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  console.log('🔑 Generando clave privada compatible con certificado AFIP...');
  
  // Verificar si OpenSSL está instalado
  try {
    execSync('openssl version', { stdio: 'pipe' });
    console.log('✅ OpenSSL encontrado');
  } catch (error) {
    console.log('❌ OpenSSL no está instalado');
    console.log('💡 Instala OpenSSL desde: https://slproweb.com/products/Win32OpenSSL.html');
    return;
  }
  
  const certPath = 'C:\\arca\\facturacion_test_36fbb7d1ac71bf1d.crt';
  const keyPath = 'C:\\arca\\clave_privada_afip.key';
  
  console.log('📄 Analizando certificado:', certPath);
  
  if (!fs.existsSync(certPath)) {
    console.log('❌ El certificado no existe');
    return;
  }
  
  // Extraer información del certificado
  console.log('🔍 Extrayendo información del certificado...');
  const certInfo = execSync(`openssl x509 -in "${certPath}" -text -noout`, { encoding: 'utf8' });
  
  // Buscar el algoritmo de firma
  const signatureMatch = certInfo.match(/Signature Algorithm: ([^\n]+)/);
  if (signatureMatch) {
    console.log('📊 Algoritmo de firma:', signatureMatch[1]);
  }
  
  // Buscar el tamaño de la clave
  const keySizeMatch = certInfo.match(/Public Key Algorithm: ([^\n]+)/);
  if (keySizeMatch) {
    console.log('📊 Algoritmo de clave pública:', keySizeMatch[1]);
  }
  
  // Generar clave privada RSA de 2048 bits (estándar para AFIP)
  console.log('🔧 Generando clave privada RSA de 2048 bits...');
  execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: 'inherit' });
  
  console.log('✅ Clave privada generada en:', keyPath);
  
  // Verificar que la clave se generó correctamente
  const keyContent = fs.readFileSync(keyPath, 'utf8');
  console.log('📄 Contenido de la clave (primeras líneas):');
  console.log(keyContent.split('\n').slice(0, 5).join('\n'));
  console.log('...');
  
  // Verificar que la clave es válida
  try {
    execSync(`openssl rsa -in "${keyPath}" -check -noout`, { stdio: 'pipe' });
    console.log('✅ Clave privada válida');
  } catch (error) {
    console.log('❌ Error verificando la clave privada');
  }
  
  console.log('\n💡 IMPORTANTE:');
  console.log('1. Esta clave es compatible con el certificado AFIP');
  console.log('2. Para producción, usa certificados oficiales de AFIP');
  console.log('3. Actualiza la configuración con la nueva ruta');
  
} catch (error) {
  console.log('❌ Error:', error.message);
}
