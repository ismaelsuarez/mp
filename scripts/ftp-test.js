const fs = require('fs');
const path = require('path');

console.log('=== DIAGNÓSTICO FTP SERVER ===\n');

// Verificar configuración
try {
    const configPath = path.join(process.cwd(), 'config.json');
    let config = {};
    
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('✅ Configuración encontrada');
    } else {
        console.log('⚠️  No se encontró config.json, usando valores por defecto');
    }
    
    console.log('\n📋 CONFIGURACIÓN FTP SERVER:');
    console.log(`   Host: ${config.FTP_SRV_HOST || '0.0.0.0'}`);
    console.log(`   Puerto: ${config.FTP_SRV_PORT || '21'}`);
    console.log(`   Usuario: ${config.FTP_SRV_USER || 'user'}`);
    console.log(`   Contraseña: ${config.FTP_SRV_PASS ? '***' : 'pass'}`);
    console.log(`   Carpeta raíz: ${config.FTP_SRV_ROOT || 'C:\\tmp\\ftp_share'}`);
    console.log(`   Habilitado: ${config.FTP_SRV_ENABLED ? 'SÍ' : 'NO'}`);
    
    // Verificar carpeta raíz
    const rootPath = config.FTP_SRV_ROOT || 'C:\\tmp\\ftp_share';
    console.log(`\n📁 CARPETA RAÍZ: ${rootPath}`);
    
    if (fs.existsSync(rootPath)) {
        console.log('   ✅ Carpeta existe');
        const files = fs.readdirSync(rootPath);
        console.log(`   📄 Archivos en carpeta: ${files.length}`);
        files.forEach(file => {
            const filePath = path.join(rootPath, file);
            const stats = fs.statSync(filePath);
            console.log(`      - ${file} (${stats.size} bytes)`);
        });
    } else {
        console.log('   ❌ Carpeta NO existe');
        console.log('   🔧 Creando carpeta...');
        fs.mkdirSync(rootPath, { recursive: true });
        console.log('   ✅ Carpeta creada');
    }
    
    // Verificar permisos
    console.log('\n🔐 PERMISOS:');
    try {
        const testFile = path.join(rootPath, 'test.txt');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log('   ✅ Permisos de escritura OK');
    } catch (error) {
        console.log(`   ❌ Error de permisos: ${error.message}`);
    }
    
    // Verificar puerto
    console.log('\n🌐 PUERTO:');
    const { exec } = require('child_process');
    exec('netstat -an | findstr :21', (error, stdout) => {
        if (stdout.includes('LISTENING')) {
            console.log('   ✅ Puerto 21 está escuchando');
        } else {
            console.log('   ❌ Puerto 21 NO está escuchando');
        }
    });
    
} catch (error) {
    console.error('❌ Error en diagnóstico:', error.message);
}

console.log('\n=== FIN DE DIAGNÓSTICO ===');
