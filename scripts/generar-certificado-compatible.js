/**
 * Script para generar certificado y clave privada compatibles para AFIP
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function generarCertificadoCompatible() {
  console.log('🔐 GENERANDO CERTIFICADO Y CLAVE PRIVADA COMPATIBLES PARA AFIP');
  console.log('=' .repeat(60));
  
  try {
    // Verificar si OpenSSL está instalado
    try {
      execSync('openssl version', { stdio: 'pipe' });
      console.log('✅ OpenSSL encontrado');
    } catch (error) {
      console.log('❌ OpenSSL no está instalado');
      console.log('💡 Instala OpenSSL desde: https://slproweb.com/products/Win32OpenSSL.html');
      return;
    }
    
    const certPath = 'C:\\arca\\certificado_afip_compatible.crt';
    const keyPath = 'C:\\arca\\clave_privada_afip_compatible.key';
    const csrPath = 'C:\\arca\\solicitud_firma.csr';
    const configPath = 'C:\\arca\\openssl.conf';
    
    // 1. Crear archivo de configuración OpenSSL
    console.log('📋 1. Creando configuración OpenSSL...');
    const opensslConfig = `
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = AR
ST = Buenos Aires
L = Buenos Aires
O = Empresa Test
OU = Facturación
CN = facturacion_test
emailAddress = test@empresa.com

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.afip.gov.ar
`;
    
    fs.writeFileSync(configPath, opensslConfig);
    console.log('✅ Configuración OpenSSL creada');
    
    // 2. Generar clave privada RSA de 2048 bits
    console.log('🔑 2. Generando clave privada RSA de 2048 bits...');
    execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: 'inherit' });
    console.log('✅ Clave privada generada');
    
    // 3. Generar solicitud de firma de certificado (CSR)
    console.log('📝 3. Generando solicitud de firma de certificado...');
    execSync(`openssl req -new -key "${keyPath}" -out "${csrPath}" -config "${configPath}"`, { stdio: 'inherit' });
    console.log('✅ Solicitud de firma generada');
    
    // 4. Generar certificado autofirmado (para pruebas)
    console.log('📜 4. Generando certificado autofirmado...');
    execSync(`openssl x509 -req -in "${csrPath}" -signkey "${keyPath}" -out "${certPath}" -days 365 -extensions v3_req -extfile "${configPath}"`, { stdio: 'inherit' });
    console.log('✅ Certificado autofirmado generado');
    
    // 5. Verificar que los archivos son compatibles
    console.log('🔍 5. Verificando compatibilidad...');
    try {
      execSync(`openssl x509 -in "${certPath}" -noout -text`, { stdio: 'pipe' });
      console.log('✅ Certificado válido');
    } catch (error) {
      console.log('❌ Error verificando certificado');
    }
    
    try {
      execSync(`openssl rsa -in "${keyPath}" -check -noout`, { stdio: 'pipe' });
      console.log('✅ Clave privada válida');
    } catch (error) {
      console.log('❌ Error verificando clave privada');
    }
    
    // 6. Verificar que el certificado y la clave son compatibles
    console.log('🔗 6. Verificando compatibilidad entre certificado y clave...');
    try {
      const modulusCert = execSync(`openssl x509 -in "${certPath}" -noout -modulus`, { encoding: 'utf8' });
      const modulusKey = execSync(`openssl rsa -in "${keyPath}" -noout -modulus`, { encoding: 'utf8' });
      
      if (modulusCert === modulusKey) {
        console.log('✅ Certificado y clave privada son compatibles');
      } else {
        console.log('❌ Certificado y clave privada NO son compatibles');
      }
    } catch (error) {
      console.log('❌ Error verificando compatibilidad');
    }
    
    // 7. Mostrar información del certificado
    console.log('📊 7. Información del certificado:');
    try {
      const certInfo = execSync(`openssl x509 -in "${certPath}" -noout -subject -issuer -dates`, { encoding: 'utf8' });
      console.log(certInfo);
    } catch (error) {
      console.log('❌ Error obteniendo información del certificado');
    }
    
    console.log('\n💡 CONFIGURACIÓN PARA .env:');
    console.log(`AFIP_CERT_PATH_HOMOLOGACION=${certPath}`);
    console.log(`AFIP_KEY_PATH_HOMOLOGACION=${keyPath}`);
    
    console.log('\n⚠️  IMPORTANTE:');
    console.log('1. Este es un certificado autofirmado para pruebas');
    console.log('2. Para producción, usa certificados oficiales de AFIP');
    console.log('3. Los archivos están en C:\\arca\\');
    
  } catch (error) {
    console.log('💥 ERROR:', error.message);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  generarCertificadoCompatible()
    .then(() => {
      console.log('✅ Script ejecutado correctamente');
      process.exit(0);
    })
    .catch((error) => {
      console.log('❌ Error ejecutando script:', error.message);
      process.exit(1);
    });
}

module.exports = { generarCertificadoCompatible };
