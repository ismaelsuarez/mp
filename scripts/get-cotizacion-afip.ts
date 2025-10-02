#!/usr/bin/env tsx
/**
 * Script para consultar cotización de AFIP/ARCA ANTES de generar .fac
 * 
 * Uso:
 *   npm run cotizacion -- --moneda DOL
 *   npm run cotizacion -- --moneda DOL --fecha 20251002 --cancela-misma-moneda S
 *   npm run cotizacion -- --moneda EUR
 * 
 * Retorna JSON con:
 *   - cotizOficial: Cotización que AFIP va a usar
 *   - fechaCotiz: Fecha de la cotización
 *   - rangoTolerado: [min, max] para validar si una cotización custom es aceptable
 */

// Mock completo de Electron ANTES de cualquier import
const path = require('path');
const os = require('os');
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id: string) {
  if (id === 'electron') {
    return {
      app: {
        getPath: (name: string) => {
          if (name === 'userData') return path.join(os.tmpdir(), 'mp-cli');
          if (name === 'logs') return path.join(os.tmpdir(), 'mp-cli', 'logs');
          if (name === 'documents') return path.join(os.homedir(), 'Documents');
          return os.tmpdir();
        },
        getAppPath: () => process.cwd(),
      },
      ipcRenderer: {},
      ipcMain: {},
      BrowserWindow: class {},
    };
  }
  return originalRequire.apply(this, arguments as any);
};

import { AfipService } from '../src/modules/facturacion/afipService';

interface CotizacionResult {
  moneda: string;
  cotizOficial: number;
  fechaCotiz: string;
  fechaSolicitada?: string;
  canMisMonExt: 'S' | 'N';
  diaHabilAnterior?: string;
  rangoTolerado: {
    min: number;
    max: number;
    minPercent: number;
    maxPercent: number;
  };
  recomendacion: string;
}

async function getCotizacionAfip(options: {
  moneda: 'DOL' | 'EUR';
  fecha?: string; // YYYYMMDD (fecha del comprobante)
  canMisMonExt?: 'S' | 'N';
}): Promise<CotizacionResult> {
  const { moneda, fecha, canMisMonExt = 'N' } = options;
  
  // Instanciar servicio AFIP
  const afipService = new AfipService();
  
  // Obtener instancia de AFIP autenticada
  const afip = await (afipService as any).getAfipInstance();
  
  // Determinar qué fecha usar
  let fechaCotizAConsultar: string | undefined;
  let diaHabilAnterior: string | undefined;
  
  if (canMisMonExt === 'S' && fecha) {
    // Si cancela en misma moneda, usar día hábil anterior
    const prevDiaHabil = (yyyymmdd: string): string => {
      const y = Number(yyyymmdd.slice(0,4));
      const m = Number(yyyymmdd.slice(4,6))-1;
      const d = Number(yyyymmdd.slice(6,8));
      const dt = new Date(Date.UTC(y,m,d));
      do { dt.setUTCDate(dt.getUTCDate()-1); } while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6);
      const mm = String(dt.getUTCMonth()+1).padStart(2,'0');
      const dd = String(dt.getUTCDate()).padStart(2,'0');
      return `${dt.getUTCFullYear()}${mm}${dd}`;
    };
    
    diaHabilAnterior = prevDiaHabil(fecha);
    fechaCotizAConsultar = diaHabilAnterior;
  }
  // Si NO cancela en misma moneda o no hay fecha, usar cotización de HOY
  
  // Consultar cotización a AFIP
  const { valor, fecha: fechaResp } = await (afipService as any).getCotizacion(
    afip, 
    moneda, 
    fechaCotizAConsultar
  );
  
  // Calcular rango tolerado (política del sistema)
  const maxUpPercent = 80;   // +80% por arriba
  const maxDownPercent = 5;  // -5% por debajo
  
  const upper = Number((valor * (1 + maxUpPercent / 100)).toFixed(6));
  const lower = Number((valor * (1 - maxDownPercent / 100)).toFixed(6));
  
  // Recomendación para el .fac
  const recomendacion = canMisMonExt === 'S'
    ? `Para CANCELA_MISMA_MONEDA:S → Usar EXACTAMENTE ${valor} (cotización del día hábil anterior)`
    : `Para CANCELA_MISMA_MONEDA:N → Puede usar entre ${lower.toFixed(2)} y ${upper.toFixed(2)} (tolerancia flexible)`;
  
  return {
    moneda,
    cotizOficial: valor,
    fechaCotiz: fechaResp || 'HOY',
    fechaSolicitada: fecha,
    canMisMonExt,
    diaHabilAnterior,
    rangoTolerado: {
      min: lower,
      max: upper,
      minPercent: -maxDownPercent,
      maxPercent: maxUpPercent
    },
    recomendacion
  };
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let moneda: 'DOL' | 'EUR' = 'DOL';
  let fecha: string | undefined;
  let canMisMonExt: 'S' | 'N' = 'N';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--moneda' && args[i + 1]) {
      const m = args[i + 1].toUpperCase();
      if (m === 'DOL' || m === 'EUR') moneda = m;
      i++;
    }
    if (args[i] === '--fecha' && args[i + 1]) {
      fecha = args[i + 1].replace(/-/g, '');
      i++;
    }
    if (args[i] === '--cancela-misma-moneda' && args[i + 1]) {
      const c = args[i + 1].toUpperCase();
      if (c === 'S' || c === 'N') canMisMonExt = c as 'S' | 'N';
      i++;
    }
  }
  
  try {
    console.log('🔄 Consultando cotización a AFIP/ARCA...\n');
    
    const result = await getCotizacionAfip({ moneda, fecha, canMisMonExt });
    
    console.log('✅ COTIZACIÓN AFIP/ARCA\n');
    console.log(`Moneda:                  ${result.moneda}`);
    console.log(`Cotización Oficial:      ${result.cotizOficial.toFixed(2)}`);
    console.log(`Fecha Cotización:        ${result.fechaCotiz}`);
    if (result.fechaSolicitada) {
      console.log(`Fecha Comprobante:       ${result.fechaSolicitada}`);
    }
    console.log(`Cancela en misma moneda: ${result.canMisMonExt}`);
    if (result.diaHabilAnterior) {
      console.log(`Día hábil anterior:      ${result.diaHabilAnterior}`);
    }
    console.log('\n📊 RANGO TOLERADO (para CanMisMonExt=N):');
    console.log(`  Mínimo: ${result.rangoTolerado.min.toFixed(2)} (${result.rangoTolerado.minPercent}%)`);
    console.log(`  Máximo: ${result.rangoTolerado.max.toFixed(2)} (+${result.rangoTolerado.maxPercent}%)`);
    console.log('\n💡 RECOMENDACIÓN:');
    console.log(`  ${result.recomendacion}`);
    console.log('\n📝 PARA TU ARCHIVO .FAC:');
    console.log(`  COTIZADOL:${result.cotizOficial.toFixed(2)}`);
    if (canMisMonExt === 'S') {
      console.log(`  CANCELA_MISMA_MONEDA:S`);
    }
    
    // JSON para procesamiento automático
    console.log('\n📄 JSON (para scripts):');
    console.log(JSON.stringify(result, null, 2));
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    console.error('\nUso:');
    console.error('  npm run cotizacion -- --moneda DOL');
    console.error('  npm run cotizacion -- --moneda DOL --fecha 20251002 --cancela-misma-moneda S');
    console.error('  npm run cotizacion -- --moneda EUR');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
}

export { getCotizacionAfip };

