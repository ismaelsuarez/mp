const ftp = require('basic-ftp');

console.log('=== PRUEBA DE CONEXIÓN FTP ===\n');

async function testFtpConnection() {
    const client = new ftp.Client();
    client.ftp.verbose = true; // Para ver los logs detallados
    
    try {
        console.log('🔌 Conectando al servidor FTP...');
        await client.access({
            host: '127.0.0.1',
            port: 21,
            user: 'user',
            password: 'pass'
        });
        
        console.log('✅ Conexión exitosa!');
        
        console.log('\n📁 Listando archivos en el directorio raíz:');
        const list = await client.list();
        console.log(`   Encontrados ${list.length} archivos/carpetas:`);
        list.forEach(item => {
            console.log(`   - ${item.name} (${item.type === 'd' ? 'carpeta' : 'archivo'})`);
        });
        
        console.log('\n📤 Probando subida de archivo...');
        const testContent = 'URI=\\\\correo\\Linksistema\\FOTOSWEB\\06\\test-image.jpg';
        const testFile = 'test-direccion.txt';
        
        // Crear archivo temporal
        const fs = require('fs');
        fs.writeFileSync(testFile, testContent);
        
        // Subir archivo
        await client.uploadFrom(testFile, 'direccion.txt');
        console.log('✅ Archivo subido exitosamente!');
        
        // Limpiar archivo temporal
        fs.unlinkSync(testFile);
        
        console.log('\n📋 Verificando archivo subido:');
        const updatedList = await client.list();
        const uploadedFile = updatedList.find(item => item.name === 'direccion.txt');
        if (uploadedFile) {
            console.log(`   ✅ Archivo encontrado: ${uploadedFile.name} (${uploadedFile.size} bytes)`);
        } else {
            console.log('   ❌ Archivo no encontrado');
        }
        
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
    } finally {
        client.close();
    }
}

testFtpConnection();
