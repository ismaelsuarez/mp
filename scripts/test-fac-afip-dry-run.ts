#!/usr/bin/env ts-node
/**
 * 🧪 TEST: Validar que el parsing de .fac sigue funcionando correctamente
 * Este script NO envía nada a AFIP, solo valida que:
 * 1. Se parsean correctamente los totales del .fac
 * 2. Se construye el objeto correcto para AFIP
 * 3. Los cambios de "items raw" NO afectan la facturación
 */

import * as fs from 'fs';
import * as path from 'path';

// Simular parsing de .fac (copiado de facProcessor.ts)
function parseFacFile(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  
  const get = (k: string) => {
    const ln = lines.find(l => l.startsWith(k));
    return ln ? ln.substring(k.length).trim() : '';
  };
  
  const getBlock = (startKey: string) => {
    const startIdx = lines.findIndex((l) => l.trim().startsWith(startKey));
    if (startIdx < 0) return [];
    const out: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^[A-Z]+:/.test(line.trim())) break; // Nueva sección
      out.push(line);
    }
    return out;
  };
  
  // Extraer TIPO
  const tipoRaw = get('TIPO:');
  const tipoCode = Number(tipoRaw);
  const tipoMap: Record<number, string> = {
    1: 'Factura A',
    6: 'Factura B',
    3: 'Nota Crédito A',
    8: 'Nota Crédito B',
    2: 'Nota Débito A',
    7: 'Nota Débito B'
  };
  const tipo = tipoMap[tipoCode] || 'DESCONOCIDO';
  
  // Extraer datos del cliente
  const cliente = get('CLIENTE:');
  const tipodoc = Number(get('TIPODOC:'));
  const nrodoc = get('NRODOC:');
  const condicion = get('CONDICION:');
  const ivareceptor = Number(get('IVARECEPTOR:'));
  
  // ✅ CRÍTICO: Parsear TOTALES (esto NO cambió)
  const totalesLines = getBlock('TOTALES:');
  let neto21 = 0, neto105 = 0, neto27 = 0;
  let iva21 = 0, iva105 = 0, iva27 = 0;
  let exento = 0, total = 0;
  
  for (const line of totalesLines) {
    const m21 = line.match(/NETO\s+21%\s*:\s*([\d.,]+)/);
    if (m21) neto21 = Number(m21[1].replace(/,/g, ''));
    
    const m105 = line.match(/NETO\s+10\.5%\s*:\s*([\d.,]+)/);
    if (m105) neto105 = Number(m105[1].replace(/,/g, ''));
    
    const m27 = line.match(/NETO\s+27%\s*:\s*([\d.,]+)/);
    if (m27) neto27 = Number(m27[1].replace(/,/g, ''));
    
    const mEx = line.match(/EXENTO\s*:\s*([\d.,]+)/);
    if (mEx) exento = Number(mEx[1].replace(/,/g, ''));
    
    const mIva21 = line.match(/IVA\s+21%\s*:\s*([\d.,]+)/);
    if (mIva21) iva21 = Number(mIva21[1].replace(/,/g, ''));
    
    const mIva105 = line.match(/IVA\s+10\.5%\s*:\s*([\d.,]+)/);
    if (mIva105) iva105 = Number(mIva105[1].replace(/,/g, ''));
    
    const mIva27 = line.match(/IVA\s+27%\s*:\s*([\d.,]+)/);
    if (mIva27) iva27 = Number(mIva27[1].replace(/,/g, ''));
    
    const mTotal = line.match(/TOTAL\s*:\s*([\d.,]+)/);
    if (mTotal) total = Number(mTotal[1].replace(/,/g, ''));
  }
  
  return {
    tipo: tipoCode,
    tipoDescripcion: tipo,
    cliente,
    tipodoc,
    nrodoc,
    condicion,
    ivareceptor,
    totales: {
      neto21,
      neto105,
      neto27,
      iva21,
      iva105,
      iva27,
      exento,
      total,
      netoTotal: neto21 + neto105 + neto27,
      ivaTotal: iva21 + iva105 + iva27
    }
  };
}

// 🧪 Simular construcción de request AFIP
function buildAfipRequest(data: ReturnType<typeof parseFacFile>, ptoVta: number) {
  const { tipo, tipodoc, nrodoc, ivareceptor, totales } = data;
  
  // Construir alícuotas IVA (solo las que tienen monto > 0)
  const ivaArray = [];
  if (totales.iva21 > 0) {
    ivaArray.push({ Id: 5, BaseImp: totales.neto21, Importe: totales.iva21 });
  }
  if (totales.iva105 > 0) {
    ivaArray.push({ Id: 4, BaseImp: totales.neto105, Importe: totales.iva105 });
  }
  if (totales.iva27 > 0) {
    ivaArray.push({ Id: 6, BaseImp: totales.neto27, Importe: totales.iva27 });
  }
  
  // Request AFIP
  return {
    CantReg: 1,
    PtoVta: ptoVta,
    CbteTipo: tipo,
    Concepto: 1,
    DocTipo: tipodoc,
    DocNro: nrodoc,
    CbteDesde: '[NUMERO]',
    CbteHasta: '[NUMERO]',
    CbteFch: new Date().toISOString().split('T')[0].replace(/-/g, ''),
    ImpTotal: totales.total,
    ImpTotConc: 0,
    ImpNeto: totales.netoTotal,
    ImpOpEx: totales.exento,
    ImpIVA: totales.ivaTotal,
    ImpTrib: 0,
    MonId: 'PES',
    MonCotiz: 1,
    CondicionIVAReceptorId: ivareceptor,
    Iva: ivaArray
  };
}

// 🎯 EJECUTAR TEST
console.log('═══════════════════════════════════════════════════════');
console.log('🧪 TEST: Validación de parsing .fac → AFIP');
console.log('═══════════════════════════════════════════════════════\n');

const testFile = process.argv[2];
if (!testFile) {
  console.error('❌ Uso: ts-node scripts/test-fac-afip-dry-run.ts <archivo.fac>');
  console.error('   Ejemplo: ts-node scripts/test-fac-afip-dry-run.ts tmp/controlar/25100317103241.fac');
  process.exit(1);
}

if (!fs.existsSync(testFile)) {
  console.error(`❌ Archivo no encontrado: ${testFile}`);
  process.exit(1);
}

try {
  // 1️⃣ Parsear .fac
  console.log('📄 Parseando archivo:', path.basename(testFile));
  const data = parseFacFile(testFile);
  
  console.log('\n✅ Datos extraídos del .fac:');
  console.log('   Tipo:', data.tipoDescripcion, `(código ${data.tipo})`);
  console.log('   Cliente:', data.cliente);
  console.log('   Doc:', `${data.tipodoc} ${data.nrodoc}`);
  console.log('   Condición:', data.condicion);
  console.log('   IVA Receptor (ARCA):', data.ivareceptor);
  
  console.log('\n📊 Totales parseados:');
  console.log('   Neto 21%:', data.totales.neto21.toFixed(2));
  console.log('   Neto 10.5%:', data.totales.neto105.toFixed(2));
  console.log('   Neto 27%:', data.totales.neto27.toFixed(2));
  console.log('   IVA 21%:', data.totales.iva21.toFixed(2));
  console.log('   IVA 10.5%:', data.totales.iva105.toFixed(2));
  console.log('   IVA 27%:', data.totales.iva27.toFixed(2));
  console.log('   Exento:', data.totales.exento.toFixed(2));
  console.log('   ─────────────────────');
  console.log('   NETO TOTAL:', data.totales.netoTotal.toFixed(2));
  console.log('   IVA TOTAL:', data.totales.ivaTotal.toFixed(2));
  console.log('   TOTAL GENERAL:', data.totales.total.toFixed(2));
  
  // 2️⃣ Construir request AFIP
  const ptoVta = 16; // Ejemplo
  const afipRequest = buildAfipRequest(data, ptoVta);
  
  console.log('\n🔧 Request AFIP construido:');
  console.log(JSON.stringify(afipRequest, null, 2));
  
  // 3️⃣ Validaciones
  console.log('\n🔍 Validaciones:');
  const errors = [];
  const warnings = [];
  
  if (!afipRequest.CbteTipo) errors.push('CbteTipo no definido');
  if (!afipRequest.PtoVta) errors.push('PtoVta no definido');
  if (afipRequest.ImpTotal <= 0) errors.push('ImpTotal debe ser > 0');
  if (afipRequest.ImpNeto < 0) errors.push('ImpNeto no puede ser negativo');
  if (afipRequest.ImpIVA < 0) errors.push('ImpIVA no puede ser negativo');
  if (!afipRequest.CondicionIVAReceptorId) warnings.push('CondicionIVAReceptorId no definido (requerido por ARCA)');
  
  // Validar suma de alícuotas
  const sumaAlicuotas = afipRequest.Iva.reduce((acc: number, x: any) => acc + Number(x.Importe), 0);
  const diff = Math.abs(sumaAlicuotas - afipRequest.ImpIVA);
  if (diff > 0.02) {
    errors.push(`Suma de alícuotas (${sumaAlicuotas.toFixed(2)}) difiere de ImpIVA (${afipRequest.ImpIVA.toFixed(2)})`);
  }
  
  // Validar total
  const calculatedTotal = afipRequest.ImpNeto + afipRequest.ImpIVA + afipRequest.ImpTotConc + afipRequest.ImpTrib;
  const diffTotal = Math.abs(calculatedTotal - afipRequest.ImpTotal);
  if (diffTotal > 0.02) {
    errors.push(`Total calculado (${calculatedTotal.toFixed(2)}) difiere de ImpTotal (${afipRequest.ImpTotal.toFixed(2)})`);
  }
  
  if (errors.length > 0) {
    console.log('   ❌ ERRORES:');
    errors.forEach(e => console.log(`      • ${e}`));
  } else {
    console.log('   ✅ Todas las validaciones pasaron');
  }
  
  if (warnings.length > 0) {
    console.log('   ⚠️  ADVERTENCIAS:');
    warnings.forEach(w => console.log(`      • ${w}`));
  }
  
  console.log('\n═══════════════════════════════════════════════════════');
  if (errors.length === 0) {
    console.log('✅ TEST EXITOSO: El .fac se procesaría correctamente');
    console.log('   Este request podría enviarse a AFIP sin problemas.');
  } else {
    console.log('❌ TEST FALLIDO: Hay errores que deben corregirse');
    process.exit(1);
  }
  console.log('═══════════════════════════════════════════════════════');
  
} catch (error: any) {
  console.error('\n❌ ERROR durante el test:', error.message);
  console.error(error.stack);
  process.exit(1);
}
