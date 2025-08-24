/**
 * Script para verificar el formato del certificado
 */

const fs = require('fs');
const path = require('path');

try {
  const certPath = 'C:\\arca\\certificado.crt';
  const keyPath = 'C:\\arca\\key.pem';
  
  console.log('🔍 Verificando certificado...');
  console.log('📁 Ruta del certificado:', certPath);
  
  if (!fs.existsSync(certPath)) {
    console.log('❌ El archivo de certificado no existe');
    return;
  }
  
  const certContent = fs.readFileSync(certPath, 'utf8');
  console.log('📄 Contenido del certificado (primeras 200 caracteres):');
  console.log(certContent.substring(0, 200));
  console.log('...');
  
  // Verificar formato PEM
  if (certContent.includes('-----BEGIN CERTIFICATE-----')) {
    console.log('✅ El certificado tiene el formato PEM correcto');
  } else {
    console.log('❌ El certificado NO tiene el formato PEM correcto');
    console.log('💡 Debe comenzar con: -----BEGIN CERTIFICATE-----');
  }
  
  console.log('\n🔍 Verificando clave privada...');
  console.log('📁 Ruta de la clave:', keyPath);
  
  if (!fs.existsSync(keyPath)) {
    console.log('❌ El archivo de clave privada no existe');
    return;
  }
  
  const keyContent = fs.readFileSync(keyPath, 'utf8');
  console.log('📄 Contenido de la clave (primeras 200 caracteres):');
  console.log(keyContent.substring(0, 200));
  console.log('...');
  
  // Verificar formato PEM
  if (keyContent.includes('-----BEGIN PRIVATE KEY-----') || keyContent.includes('-----BEGIN RSA PRIVATE KEY-----')) {
    console.log('✅ La clave privada tiene el formato PEM correcto');
  } else {
    console.log('❌ La clave privada NO tiene el formato PEM correcto');
    console.log('💡 Debe comenzar con: -----BEGIN PRIVATE KEY----- o -----BEGIN RSA PRIVATE KEY-----');
  }
  
} catch (error) {
  console.log('❌ Error:', error.message);
}
