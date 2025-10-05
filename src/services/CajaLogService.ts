/**
 * Servicio centralizado para enviar logs al modo Caja
 * Cada proceso tiene su propio tipo de mensaje con formato claro
 * 
 * IMPORTANTE: Optimizado para funcionar tanto en desarrollo como en producción empaquetada
 * PERSISTENCIA: Los logs se guardan en SQLite y se mantienen por 24 horas
 */

import { BrowserWindow, app } from 'electron';
import { getCajaLogStore } from './CajaLogStore';

export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'process';

export interface LogMessage {
  level: LogLevel; // Nivel del mensaje
  icon: string; // Emoji o icono
  text: string; // Texto principal
  detail?: string; // Detalle adicional (opcional)
}

/**
 * Envía un mensaje al visor de logs de Caja
 * Compatible con desarrollo y empaquetado (electron-builder)
 * Ahora también persiste el log en SQLite
 */
function sendToFrontend(message: LogMessage) {
  try {
    // 1️⃣ Persistir en DB (siempre, incluso si el frontend no está listo)
    try {
      if (app && app.isReady()) {
        const store = getCajaLogStore();
        store.insert(message);
      }
    } catch (errDb) {
      // No romper si falla la DB, solo logear
      console.error('[CajaLog] Error persisting to DB:', errDb);
    }

    // 2️⃣ Enviar al frontend (si está disponible)
    // Verificar que la app esté lista (crítico para empaquetado)
    if (!app || !app.isReady()) {
      console.log('[CajaLog] App not ready yet:', message);
      return;
    }

    const win = BrowserWindow.getAllWindows()?.[0];
    if (win && !win.isDestroyed()) {
      win.webContents.send('caja-log', message);
    }
  } catch (error) {
    // Si falla, logear en consola como fallback (no rompe el flujo)
    console.log('[CajaLog]', message.text, message.detail || '');
  }
}

/**
 * Log de inicio de procesamiento de facturación
 */
export function logFacturaInicio(tipo: string, archivo: string) {
  sendToFrontend({
    level: 'process',
    icon: '📄',
    text: `Procesando ${tipo}`,
    detail: archivo
  });
}

/**
 * Log de factura emitida con éxito
 */
export function logFacturaEmitida(tipo: string, numero: string | number, cae: string, vencimiento?: string, total?: number) {
  const numeroFormateado = typeof numero === 'number' ? String(numero).padStart(8, '0') : numero;
  let detalle = `CAE: ${cae}`;
  if (vencimiento) detalle += ` | Vto: ${vencimiento}`;
  if (total !== undefined) detalle += ` | Total: $${total.toFixed(2)}`;
  
  sendToFrontend({
    level: 'success',
    icon: '✅',
    text: `${tipo} N° ${numeroFormateado}`,
    detail: detalle
  });
}

/**
 * Log de observaciones AFIP/ARCA
 */
export function logAfipObservaciones(observaciones: Array<{ Code: number; Msg: string }>) {
  if (!observaciones || observaciones.length === 0) return;
  
  for (const obs of observaciones) {
    sendToFrontend({
      level: 'warning',
      icon: '⚠️',
      text: `AFIP Obs ${obs.Code}`,
      detail: obs.Msg
    });
  }
}

/**
 * Log de error AFIP/ARCA
 */
export function logAfipError(mensaje: string, detalle?: string) {
  sendToFrontend({
    level: 'error',
    icon: '❌',
    text: `AFIP Error: ${mensaje}`,
    detail: detalle
  });
}

/**
 * Log de impresión
 */
export function logImpresion(copias: number, impresora?: string) {
  sendToFrontend({
    level: 'success',
    icon: '🖨️',
    text: `Impresión OK`,
    detail: `${copias} copia${copias > 1 ? 's' : ''}${impresora ? ` → ${impresora}` : ''}`
  });
}

/**
 * Log de error de impresión
 */
export function logImpresionError(error: string) {
  sendToFrontend({
    level: 'error',
    icon: '❌',
    text: 'Impresión falló',
    detail: error
  });
}

/**
 * Log de email enviado
 */
export function logEmailEnviado(destinatario: string, asunto?: string) {
  sendToFrontend({
    level: 'success',
    icon: '📧',
    text: 'Email enviado OK',
    detail: `${destinatario}${asunto ? ` (${asunto})` : ''}`
  });
}

/**
 * Log de error de email
 */
export function logEmailError(error: string) {
  sendToFrontend({
    level: 'error',
    icon: '❌',
    text: 'Email falló',
    detail: error
  });
}

/**
 * Log de WhatsApp enviado
 */
export function logWhatsappEnviado(telefono: string) {
  sendToFrontend({
    level: 'success',
    icon: '📱',
    text: 'WhatsApp enviado OK',
    detail: telefono
  });
}

/**
 * Log de error de WhatsApp
 */
export function logWhatsappError(error: string) {
  sendToFrontend({
    level: 'error',
    icon: '❌',
    text: 'WhatsApp falló',
    detail: error
  });
}

/**
 * Log de FTP/RES enviado
 */
export function logResEnviado(archivo: string) {
  sendToFrontend({
    level: 'success',
    icon: '📤',
    text: 'RES enviado OK',
    detail: archivo
  });
}

/**
 * Log de error de FTP/RES
 */
export function logResError(error: string) {
  sendToFrontend({
    level: 'error',
    icon: '❌',
    text: 'RES falló',
    detail: error
  });
}

/**
 * Log de contingencia
 */
export function logContingenciaInicio(archivo: string, intentos: number) {
  sendToFrontend({
    level: 'info',
    icon: '🔄',
    text: `Contingencia (intento ${intentos})`,
    detail: archivo
  });
}

/**
 * Log de contingencia exitosa
 */
export function logContingenciaExito(archivo: string) {
  sendToFrontend({
    level: 'success',
    icon: '✅',
    text: 'Contingencia OK',
    detail: archivo
  });
}

/**
 * Log de error de contingencia
 */
export function logContingenciaError(archivo: string, error: string, permanente: boolean = false) {
  sendToFrontend({
    level: permanente ? 'error' : 'warning',
    icon: permanente ? '💀' : '⏳',
    text: permanente ? 'Contingencia error permanente' : 'Contingencia reintentando',
    detail: `${archivo}: ${error}`
  });
}

/**
 * Log genérico de información
 */
export function logInfo(mensaje: string, detalle?: string) {
  sendToFrontend({
    level: 'info',
    icon: 'ℹ️',
    text: mensaje,
    detail: detalle
  });
}

/**
 * Log genérico de éxito
 */
export function logSuccess(mensaje: string, detalle?: string) {
  sendToFrontend({
    level: 'success',
    icon: '✅',
    text: mensaje,
    detail: detalle
  });
}

/**
 * Log genérico de error
 */
export function logError(mensaje: string, detalle?: string) {
  sendToFrontend({
    level: 'error',
    icon: '❌',
    text: mensaje,
    detail: detalle
  });
}

/**
 * Objeto singleton para acceso conveniente a todas las funciones de logging
 */
export const cajaLog = {
  // Logs específicos
  logFacturaInicio,
  logFacturaEmitida,
  logAfipObservaciones,
  logAfipError,
  logImpresion,
  logImpresionError,
  logEmailEnviado,
  logEmailError,
  logWhatsappEnviado,
  logWhatsappError,
  logResEnviado,
  logResError,
  logContingenciaInicio,
  logContingenciaExito,
  logContingenciaError,
  
  // Logs genéricos
  info: logInfo,
  success: logSuccess,
  error: logError,
  warn: (mensaje: string, detalle?: string) => {
    sendToFrontend({ level: 'warning', icon: '⚠️', text: mensaje, detail: detalle });
  },
  process: (mensaje: string, detalle?: string) => {
    sendToFrontend({ level: 'process', icon: '🔄', text: mensaje, detail: detalle });
  }
};

