import dayjs from 'dayjs';
import { Comprobante } from '../types';

export type ArcaValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Validador mínimo para reglas ARCA (WSBFEv1) sin comunicación SOAP.
 * - Ventana de fecha: +/- 5 días y sin exceder mes de presentación
 * - Clase de comprobante vs condición IVA receptor
 * - Moneda: deja warning si no es 'PES' (validación estricta requiere BFEGetCotizacion)
 */
export function validateArcaRules(comprobante: Comprobante): ArcaValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1) Fecha: formato YYYYMMDD y ventana +/- 5 días
  if (!/^\d{8}$/.test(comprobante.fecha)) {
    errors.push('Fecha de comprobante inválida. Formato esperado YYYYMMDD');
  } else {
    const f = dayjs(comprobante.fecha, 'YYYYMMDD');
    if (!f.isValid()) {
      errors.push('Fecha de comprobante no válida');
    } else {
      const hoy = dayjs();
      const diff = Math.abs(hoy.startOf('day').diff(f.startOf('day'), 'day'));
      if (diff > 5) {
        errors.push('Fecha fuera de ventana permitida (+/- 5 días) según ARCA');
      }
      // Mes de presentación: la fecha no puede exceder el mes actual
      if (f.month() !== hoy.month() && f.isAfter(hoy)) {
        errors.push('Fecha no puede exceder el mes de presentación');
      }
    }
  }

  // 2) Clase A/B vs condición IVA receptor (basado en anexo ARCA)
  if (comprobante.cliente) {
    const cond = (comprobante.cliente.condicionIva || 'CF');
    const clase = String(comprobante.tipo).toUpperCase();
    const claseEsperada = inferClaseComprobanteFromCondIva(cond);
    if (claseEsperada && claseEsperada !== clase) {
      errors.push(`Clase de comprobante incompatible con condición IVA receptor (${cond}). Esperada: ${claseEsperada}`);
    }
  }

  // 3) Moneda y cotización
  const mon = (comprobante.monId || 'PES');
  if (mon !== 'PES') {
    warnings.push(`Moneda ${mon}: ARCA exige cotización estricta (BFEGetCotizacion)`);
  }

  return { isValid: errors.length === 0, errors, warnings };
}

function inferClaseComprobanteFromCondIva(cond: string): 'A' | 'B' | null {
  // Tabla aproximada desde el anexo del manual ARCA
  switch (cond) {
    case 'RI': // Responsable Inscripto
    case 'MT': // Monotributo
    case 'EX': // Sujeto Exento → suele emitir B, pero en anexo aparece mapeo específico
    case 'CF': // Consumidor Final → B
      break;
  }
  // Mapeo conservador:
  if (cond === 'RI' || cond === 'MT' || cond === '13' || cond === '16') return 'A';
  if (cond === 'CF' || cond === 'EX' || cond === '7' || cond === '8' || cond === '9' || cond === '10' || cond === '15') return 'B';
  return null;
}


