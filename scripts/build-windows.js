#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando build para Windows...\n');

// Verificar que estamos en Windows
if (process.platform !== 'win32') {
  console.error('❌ Este script está diseñado para Windows');
  process.exit(1);
}

// Verificar que existe el icono
const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
if (!fs.existsSync(iconPath)) {
  console.error('❌ No se encontró build/icon.ico');
  console.log('💡 Asegúrate de que el icono esté en build/icon.ico');
  process.exit(1);
}

try {
  // Paso 1: Compilar TypeScript
  console.log('📝 Compilando TypeScript...');
  execSync('npm run build:ts', { stdio: 'inherit' });
  console.log('✅ TypeScript compilado correctamente\n');

  // Paso 2: Verificar que dist existe y tiene contenido
  const distPath = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(distPath)) {
    console.error('❌ No se encontró el directorio dist/');
    process.exit(1);
  }

  // Paso 3: Generar ejecutables con electron-builder
  console.log('🔨 Generando ejecutables con electron-builder...');
  console.log('📋 Configuración:');
  console.log('   - Sin compresión agresiva (store)');
  console.log('   - Sin ASAR');
  console.log('   - Instalador NSIS + Portable (x64)');
  console.log('   - Instalación para todos los usuarios');
  console.log('   - Opción de cambiar directorio\n');

  execSync('electron-builder -w', { stdio: 'inherit' });

  // Paso 4: Verificar archivos generados
  console.log('\n📁 Verificando archivos generados...');
  const distFiles = fs.readdirSync(distPath);
  const exeFiles = distFiles.filter(file => file.endsWith('.exe'));
  
  if (exeFiles.length === 0) {
    console.error('❌ No se encontraron archivos .exe en dist/');
    process.exit(1);
  }

  console.log('✅ Archivos generados:');
  exeFiles.forEach(file => {
    const filePath = path.join(distPath, file);
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`   📄 ${file} (${sizeMB} MB)`);
  });

  console.log('\n🎉 Build completado exitosamente!');
  console.log('📂 Los ejecutables están en: dist/');
  console.log('\n📋 Próximos pasos:');
  console.log('   1. Probar el instalador NSIS');
  console.log('   2. Probar el ejecutable portable');
  console.log('   3. Verificar que la aplicación funciona correctamente');

} catch (error) {
  console.error('\n❌ Error durante el build:', error.message);
  console.log('\n💡 Soluciones comunes:');
  console.log('   - Ejecutar como administrador');
  console.log('   - Desactivar temporalmente el antivirus');
  console.log('   - Verificar que todas las dependencias estén instaladas');
  process.exit(1);
}
