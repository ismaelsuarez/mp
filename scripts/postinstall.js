#!/usr/bin/env node
/**
 * Post-install script para PNPM
 * 
 * PNPM 10+ bloquea scripts de build por seguridad.
 * Este script ejecuta manualmente los builds de módulos nativos críticos.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CRITICAL_MODULES = [
  'electron',
  'better-sqlite3',
  'argon2'
];

console.log('[postinstall] Verificando módulos nativos críticos...');

for (const moduleName of CRITICAL_MODULES) {
  try {
    // Buscar el módulo en node_modules/.pnpm
    const pnpmDir = path.join(__dirname, '..', 'node_modules', '.pnpm');
    
    if (!fs.existsSync(pnpmDir)) {
      console.warn(`[postinstall] Directorio .pnpm no encontrado, saltando ${moduleName}`);
      continue;
    }
    
    // Buscar directorios que coincidan con el módulo
    const entries = fs.readdirSync(pnpmDir);
    const moduleEntry = entries.find(e => e.startsWith(`${moduleName}@`));
    
    if (!moduleEntry) {
      console.warn(`[postinstall] Módulo ${moduleName} no encontrado en .pnpm`);
      continue;
    }
    
    const installScript = path.join(
      pnpmDir,
      moduleEntry,
      'node_modules',
      moduleName,
      'install.js'
    );
    
    if (fs.existsSync(installScript)) {
      console.log(`[postinstall] Ejecutando install script para ${moduleName}...`);
      execSync(`node "${installScript}"`, { stdio: 'inherit' });
      console.log(`[postinstall] ✅ ${moduleName} instalado correctamente`);
    } else {
      console.log(`[postinstall] ℹ ${moduleName} no requiere install script`);
    }
  } catch (error) {
    console.error(`[postinstall] ❌ Error con ${moduleName}:`, error.message);
  }
}

console.log('[postinstall] Finalizado');

