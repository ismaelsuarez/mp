/**
 * Script de prueba para verificar el nuevo comportamiento del modo imagen
 * cuando IMAGE_WINDOW_SEPARATE está habilitado
 */

const fs = require('fs');
const path = require('path');

console.log('=== PRUEBA: Modo Imagen - IMAGE_WINDOW_SEPARATE ===\n');

// Configuración de prueba
const controlDir = 'C:\\tmp';
const controlFile = 'direccion.txt';
const controlPath = path.join(controlDir, controlFile);

// Crear carpeta si no existe
if (!fs.existsSync(controlDir)) {
    try {
        fs.mkdirSync(controlDir, { recursive: true });
        console.log(`✅ Carpeta creada: ${controlDir}`);
    } catch (error) {
        console.error(`❌ Error creando carpeta: ${error.message}`);
        process.exit(1);
    }
}

// Función para crear archivo de control
function createControlFile(content) {
    try {
        fs.writeFileSync(controlPath, content, 'utf8');
        console.log(`✅ Archivo de control creado: ${controlPath}`);
        console.log(`   Contenido: ${content}`);
        return true;
    } catch (error) {
        console.error(`❌ Error creando archivo: ${error.message}`);
        return false;
    }
}

// Función para limpiar archivo de control
function cleanupControlFile() {
    try {
        if (fs.existsSync(controlPath)) {
            fs.unlinkSync(controlPath);
            console.log(`✅ Archivo de control eliminado`);
        }
    } catch (error) {
        console.error(`❌ Error eliminando archivo: ${error.message}`);
    }
}

// Casos de prueba
const testCases = [
    {
        name: 'Prueba 1: VENTANA=nueva sin IMAGE_WINDOW_SEPARATE',
        content: 'URI=C:\\Windows\\System32\\oobe\\images\\background.bmp@VENTANA=nueva@INFO=Prueba Nueva Ventana',
        expected: 'Debería abrir en ventana nueva'
    },
    {
        name: 'Prueba 2: VENTANA=comun sin IMAGE_WINDOW_SEPARATE',
        content: 'URI=C:\\Windows\\System32\\oobe\\images\\background.bmp@VENTANA=comun@INFO=Prueba Ventana Comun',
        expected: 'Debería abrir en ventana principal'
    },
    {
        name: 'Prueba 3: VENTANA=comun CON IMAGE_WINDOW_SEPARATE habilitado',
        content: 'URI=C:\\Windows\\System32\\oobe\\images\\background.bmp@VENTANA=comun@INFO=Prueba Forzado Nueva',
        expected: 'Debería forzar ventana separada y REUTILIZAR la misma ventana para nuevas direccion.txt'
    },
    {
        name: 'Prueba 4: Sin VENTANA especificada',
        content: 'URI=C:\\Windows\\System32\\oobe\\images\\background.bmp@INFO=Prueba Sin Especificar',
        expected: 'Debería usar modo comun por defecto'
    },
    {
        name: 'Prueba 5: VENTANA=nueva CON IMAGE_WINDOW_SEPARATE habilitado',
        content: 'URI=C:\\Windows\\System32\\oobe\\images\\background.bmp@VENTANA=nueva@INFO=Prueba Nueva + Forzado',
        expected: 'Debería usar ventana separada y REUTILIZAR la misma ventana para nuevas direccion.txt'
    }
];

console.log('📋 Casos de prueba preparados:\n');

testCases.forEach((testCase, index) => {
    console.log(`${index + 1}. ${testCase.name}`);
    console.log(`   Contenido: ${testCase.content}`);
    console.log(`   Esperado: ${testCase.expected}`);
    console.log('');
});

console.log('🚀 Instrucciones para probar:\n');
console.log('1. Abre la aplicación MP');
console.log('2. Ve a Configuración → Modo Imagen');
console.log('3. Para cada caso de prueba:');
console.log('   a) Configura IMAGE_WINDOW_SEPARATE según corresponda');
console.log('   b) Guarda la configuración');
console.log('   c) Ejecuta este script para crear el archivo de control');
console.log('   d) Observa el comportamiento de la ventana');
console.log('   e) Verifica que el archivo de control se elimine automáticamente');
console.log('');

console.log('📝 Notas importantes:');
console.log('- El archivo de control se elimina automáticamente después de procesarlo');
console.log('- Si IMAGE_WINDOW_SEPARATE está habilitado, siempre usa modo comun');
console.log('- Esto permite que el cajero tenga abierto tanto modo caja como modo imagen');
console.log('- La ventana va al frente automáticamente sin interrumpir otros programas');
console.log('');

// Crear el primer archivo de control para empezar
console.log('🎯 Creando primer archivo de control para prueba...\n');
if (createControlFile(testCases[0].content)) {
    console.log('✅ Listo para probar!');
    console.log('   - Abre la aplicación MP');
    console.log('   - Ve a Configuración → Modo Imagen');
    console.log('   - Deshabilita IMAGE_WINDOW_SEPARATE');
    console.log('   - Guarda configuración');
    console.log('   - Observa que se abre una ventana nueva');
    console.log('   - El archivo de control se eliminará automáticamente');
} else {
    console.log('❌ Error preparando la prueba');
}

console.log('\n=== FIN DE PRUEBA ===');
