#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuración
const KEYWORDS = [
    'rustdesk',
    'RustDesk', 
    'control remoto',
    'remote desktop',
    'remote control',
    'RemoteService',
    'rustdeskManager',
    'serverSync',
    'remote_config',
    'ENCRYPTION_KEY',
    'REMOTE_ID_SERVER',
    'REMOTE_RELAY_SERVER'
];

// Keywords que son legítimas y deben ser ignoradas
const LEGITIMATE_KEYWORDS = [
    'AUTO_REMOTE_DIR',
    'AUTO_REMOTE_MS_INTERVAL', 
    'AUTO_REMOTE_ENABLED',
    'AUTO_REMOTE_WATCH',
    'LICENSE_ENCRYPTION_KEY'  // Para el sistema de licencias
];

const IGNORE_DIRS = [
    'node_modules',
    'dist', 
    'build',
    '.git',
    '.vscode',
    '.idea',
    'logs',
    'temp',
    'tmp'
];

const IGNORE_FILES = [
    'verificar_remoto.js',
    'CLEANUP_REMOTO.md',
    'package-lock.json',
    'yarn.lock'
];

const IGNORE_PATTERNS = [
    'chat/',           // Archivos de chat
    'docs/doc_control_remoto/',  // Documentación del control remoto
    'VERIFICACION_REMOTO.log',     // Reporte de verificación
    'scripts/setup-rustdesk-server.sh',  // Script de configuración del servidor
    'README_VERIFICACION_REMOTO.md'  // Documentación del script de verificación
];

const IGNORE_EXTENSIONS = [
    '.exe',
    '.dll',
    '.so',
    '.dylib',
    '.bin',
    '.log',
    '.tmp',
    '.cache'
];

// Función para verificar si un directorio debe ser ignorado
function shouldIgnoreDir(dirName) {
    return IGNORE_DIRS.includes(dirName) || dirName.startsWith('.');
}

// Función para verificar si un archivo debe ser ignorado
function shouldIgnoreFile(fileName, filePath) {
    const ext = path.extname(fileName).toLowerCase();
    
    // Verificar patrones de ignorado
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    for (const pattern of IGNORE_PATTERNS) {
        if (relativePath.includes(pattern)) {
            return true;
        }
    }
    
    return IGNORE_FILES.includes(fileName) || 
           IGNORE_EXTENSIONS.includes(ext) ||
           fileName.startsWith('.');
}

// Función para verificar si un archivo es de texto
function isTextFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const textExtensions = [
        '.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.txt', '.html', 
        '.css', '.scss', '.less', '.xml', '.yaml', '.yml', '.ini', 
        '.conf', '.config', '.env', '.sh', '.bat', '.ps1', '.py', 
        '.php', '.java', '.c', '.cpp', '.h', '.cs', '.vb', '.sql'
    ];
    
    return textExtensions.includes(ext) || ext === '';
}

// Función para buscar keywords en un archivo
function searchKeywordsInFile(filePath) {
    const results = [];
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            const lowerLine = line.toLowerCase();
            
            KEYWORDS.forEach(keyword => {
                if (lowerLine.includes(keyword.toLowerCase())) {
                    // Verificar si es una keyword legítima
                    const isLegitimate = LEGITIMATE_KEYWORDS.some(legit => 
                        line.includes(legit)
                    );
                    
                    if (!isLegitimate) {
                        results.push({
                            file: filePath,
                            line: lineNumber,
                            keyword: keyword,
                            text: line.trim()
                        });
                    }
                }
            });
        });
    } catch (error) {
        // Ignorar errores de lectura (archivos binarios, permisos, etc.)
    }
    
    return results;
}

// Función recursiva para escanear directorios
function scanDirectory(dirPath, results = []) {
    try {
        const items = fs.readdirSync(dirPath);
        
        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                if (!shouldIgnoreDir(item)) {
                    scanDirectory(fullPath, results);
                }
            } else if (stat.isFile()) {
                if (!shouldIgnoreFile(item, fullPath) && isTextFile(fullPath)) {
                    const fileResults = searchKeywordsInFile(fullPath);
                    results.push(...fileResults);
                }
            }
        }
    } catch (error) {
        console.error(`Error escaneando directorio ${dirPath}:`, error.message);
    }
    
    return results;
}

// Función principal
function main() {
    console.log('🔍 Iniciando verificación de referencias a RustDesk y control remoto...\n');
    
    const startTime = Date.now();
    const projectRoot = process.cwd();
    
    console.log(`📁 Escaneando proyecto en: ${projectRoot}`);
    console.log(`🔎 Buscando keywords: ${KEYWORDS.join(', ')}`);
    console.log(`✅ Ignorando keywords legítimas: ${LEGITIMATE_KEYWORDS.join(', ')}`);
    console.log(`🚫 Ignorando directorios: ${IGNORE_DIRS.join(', ')}\n`);
    
    // Escanear el proyecto
    const results = scanDirectory(projectRoot);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    // Generar reporte
    const reportPath = path.join(projectRoot, 'VERIFICACION_REMOTO.log');
    let reportContent = '';
    
    reportContent += '='.repeat(80) + '\n';
    reportContent += 'VERIFICACIÓN DE REFERENCIAS A RUSTDESK Y CONTROL REMOTO\n';
    reportContent += '='.repeat(80) + '\n\n';
    
    reportContent += `Fecha y hora: ${new Date().toLocaleString()}\n`;
    reportContent += `Directorio escaneado: ${projectRoot}\n`;
    reportContent += `Tiempo de escaneo: ${duration} segundos\n`;
    reportContent += `Archivos escaneados: ${results.length > 0 ? 'Múltiples' : 'Ninguno con referencias'}\n\n`;
    
    if (results.length === 0) {
        reportContent += '✅ VERIFICACIÓN COMPLETA: No se encontraron referencias a RustDesk o control remoto.\n\n';
        reportContent += 'El proyecto está completamente limpio de referencias al módulo de control remoto.\n';
        console.log('✅ VERIFICACIÓN COMPLETA: No se encontraron referencias a RustDesk o control remoto.');
    } else {
        reportContent += `⚠️  SE ENCONTRARON ${results.length} REFERENCIAS:\n\n`;
        
        // Agrupar por archivo
        const groupedResults = {};
        results.forEach(result => {
            if (!groupedResults[result.file]) {
                groupedResults[result.file] = [];
            }
            groupedResults[result.file].push(result);
        });
        
        Object.keys(groupedResults).sort().forEach(file => {
            const fileResults = groupedResults[file];
            const relativePath = path.relative(projectRoot, file);
            
            reportContent += `📄 ${relativePath}\n`;
            reportContent += '-'.repeat(relativePath.length + 4) + '\n';
            
            fileResults.forEach(result => {
                reportContent += `  Línea ${result.line}: "${result.keyword}"\n`;
                reportContent += `    ${result.text}\n\n`;
            });
        });
        
        console.log(`⚠️  Se encontraron ${results.length} referencias. Revisa el reporte: VERIFICACION_REMOTO.log`);
    }
    
    reportContent += '\n' + '='.repeat(80) + '\n';
    reportContent += 'FIN DEL REPORTE\n';
    reportContent += '='.repeat(80) + '\n';
    
    // Escribir reporte
    try {
        fs.writeFileSync(reportPath, reportContent, 'utf8');
        console.log(`📋 Reporte generado: ${reportPath}`);
    } catch (error) {
        console.error('❌ Error escribiendo reporte:', error.message);
    }
    
    console.log(`\n⏱️  Tiempo total: ${duration} segundos`);
    
    // Retornar código de salida
    process.exit(results.length === 0 ? 0 : 1);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main();
}

module.exports = { main, scanDirectory, searchKeywordsInFile };
