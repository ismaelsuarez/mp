const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Script para limpiar credenciales de desarrollo antes de la entrega al cliente
 * Elimina la configuración almacenada en electron-store
 */

function cleanCredentials() {
    try {
        // Obtener la ruta de datos del usuario
        const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'MP Reports');
        
        console.log('🔍 Buscando configuración en:', userDataPath);
        
        if (fs.existsSync(userDataPath)) {
            console.log('📁 Carpeta encontrada, eliminando...');
            
            // Eliminar TODOS los archivos de configuración
            const files = ['settings.json', 'config.key'];
            files.forEach(file => {
                const filePath = path.join(userDataPath, file);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`✅ Eliminado: ${file}`);
                }
            });
            
            // Intentar eliminar la carpeta si está vacía
            try {
                const remainingFiles = fs.readdirSync(userDataPath);
                if (remainingFiles.length === 0) {
                    fs.rmdirSync(userDataPath);
                    console.log('✅ Carpeta vacía eliminada');
                } else {
                    console.log('⚠️  Carpeta no está vacía, archivos restantes:', remainingFiles);
                }
            } catch (e) {
                console.log('⚠️  No se pudo eliminar la carpeta:', e.message);
            }
            
        } else {
            console.log('ℹ️  No se encontró configuración para limpiar');
        }
        
        // También verificar si hay archivos de configuración en otras ubicaciones posibles
        const possiblePaths = [
            path.join(os.homedir(), 'AppData', 'Local', 'MP Reports'),
            path.join(os.homedir(), '.config', 'MP Reports'),
            path.join(process.cwd(), 'config.json'),
            path.join(process.cwd(), '.env'),
            // Ubicación de electron-store cuando se ejecuta desde Node.js
            path.join(os.homedir(), 'AppData', 'Roaming', 'electron-store-nodejs'),
            // Ubicación de electron-store para la aplicación Electron
            path.join(os.homedir(), 'AppData', 'Roaming', 'tc-mp'),
            path.join(os.homedir(), 'AppData', 'Roaming', 'com.todo.tc-mp')
        ];
        
        console.log('\n🔍 Verificando otras ubicaciones posibles...');
        possiblePaths.forEach(configPath => {
            if (fs.existsSync(configPath)) {
                try {
                    if (fs.statSync(configPath).isDirectory()) {
                        fs.rmSync(configPath, { recursive: true, force: true });
                        console.log(`✅ Eliminado directorio: ${configPath}`);
                    } else {
                        fs.unlinkSync(configPath);
                        console.log(`✅ Eliminado archivo: ${configPath}`);
                    }
                } catch (e) {
                    console.log(`⚠️  No se pudo eliminar: ${configPath} - ${e.message}`);
                }
            }
        });
        
        console.log('\n🎉 Limpieza completada. El cliente podrá configurar sus propias credenciales.');
        
    } catch (error) {
        console.error('❌ Error durante la limpieza:', error.message);
        process.exit(1);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    console.log('🧹 Iniciando limpieza de credenciales de desarrollo...\n');
    cleanCredentials();
}

module.exports = { cleanCredentials };
