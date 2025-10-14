import Store from 'electron-store';
import { sendReportEmail } from '@infra/email';
import { logError, logWarning, logInfo } from '@infra/logger';

interface ErrorGroup {
  count: number;
  firstSeen: number;
  lastSeen: number;
  messages: string[];
  notificationCount: number;
  lastNotification: number;
}

interface ErrorNotificationConfig {
  enabled: boolean;
  minErrorsBeforeNotify: number;
  minTimeBetweenNotifications: number; // en minutos
  maxNotificationsPerError: number;
  emailSubject: string;
}

const DEFAULT_CONFIG: ErrorNotificationConfig = {
  enabled: true,
  minErrorsBeforeNotify: 3,
  minTimeBetweenNotifications: 60, // 1 hora
  maxNotificationsPerError: 3,
  emailSubject: '🚨 Sistema MP - Alertas de Error'
};

class ErrorNotificationService {
  private store: Store<{ 
    errorGroups?: Record<string, ErrorGroup>;
    config?: ErrorNotificationConfig;
  }>;

  constructor() {
    this.store = new Store({ name: 'error-notifications' });
    this.ensureConfig();
  }

  private ensureConfig(): void {
    const config = this.store.get('config');
    if (!config) {
      this.store.set('config', DEFAULT_CONFIG);
    }
  }

  public getConfig(): ErrorNotificationConfig {
    return this.store.get('config') || DEFAULT_CONFIG;
  }

  public updateConfig(newConfig: Partial<ErrorNotificationConfig>): void {
    const currentConfig = this.getConfig();
    const updatedConfig = { ...currentConfig, ...newConfig };
    this.store.set('config', updatedConfig);
    logInfo('Configuración de notificaciones de error actualizada', { config: updatedConfig });
  }

  public recordError(errorType: string, message: string, meta?: any): void {
    const config = this.getConfig();
    if (!config.enabled) return;

    const errorKey = this.generateErrorKey(errorType, message);
    const now = Date.now();
    const errorGroups = this.store.get('errorGroups') || {};

    if (!errorGroups[errorKey]) {
      errorGroups[errorKey] = {
        count: 0,
        firstSeen: now,
        lastSeen: now,
        messages: [],
        notificationCount: 0,
        lastNotification: 0
      };
    }

    const group = errorGroups[errorKey];
    group.count++;
    group.lastSeen = now;
    
    // Agregar mensaje único (evitar duplicados)
    const messageWithMeta = meta ? `${message} | ${JSON.stringify(meta)}` : message;
    if (!group.messages.includes(messageWithMeta)) {
      group.messages.push(messageWithMeta);
    }

    this.store.set('errorGroups', errorGroups);

    // Verificar si debemos enviar notificación
    this.checkAndSendNotification(errorKey, group, config);
  }

  private generateErrorKey(errorType: string, message: string): string {
    // Crear una clave única basada en el tipo y el mensaje principal
    const cleanMessage = message.replace(/\d+/g, 'N').replace(/[^\w\s]/g, '');
    return `${errorType}:${cleanMessage}`;
  }

  private checkAndSendNotification(errorKey: string, group: ErrorGroup, config: ErrorNotificationConfig): void {
    const now = Date.now();
    const timeSinceLastNotification = now - group.lastNotification;
    const minTimeMs = config.minTimeBetweenNotifications * 60 * 1000;

    // Verificar condiciones para enviar notificación
    const shouldNotify = 
      group.count >= config.minErrorsBeforeNotify &&
      group.notificationCount < config.maxNotificationsPerError &&
      timeSinceLastNotification >= minTimeMs;

    if (shouldNotify) {
      this.sendErrorNotification(errorKey, group, config);
    }
  }

  private async sendErrorNotification(errorKey: string, group: ErrorGroup, config: ErrorNotificationConfig): Promise<void> {
    try {
      const notificationNumber = group.notificationCount + 1;
      const subject = this.generateEmailSubject(notificationNumber);
      const body = this.generateEmailBody(errorKey, group, notificationNumber);

      await sendReportEmail(subject, body, []);
      
      // Actualizar contador de notificaciones
      const errorGroups = this.store.get('errorGroups') || {};
      if (errorGroups[errorKey]) {
        errorGroups[errorKey].notificationCount = notificationNumber;
        errorGroups[errorKey].lastNotification = Date.now();
        this.store.set('errorGroups', errorGroups);
      }

      logInfo('Notificación de error enviada por email', { 
        errorKey, 
        notificationNumber, 
        errorCount: group.count 
      });

    } catch (error) {
      logError('Error al enviar notificación de error por email', { 
        error: String(error), 
        errorKey 
      });
    }
  }

  private generateEmailSubject(notificationNumber: number): string {
    const baseSubject = '🚨 Sistema MP - Alertas de Error';
    
    switch (notificationNumber) {
      case 1:
        return `${baseSubject} - Primer Aviso`;
      case 2:
        return `${baseSubject} - Segundo Aviso (Reiterado)`;
      case 3:
        return `${baseSubject} - Tercer Aviso (Crítico)`;
      default:
        return baseSubject;
    }
  }

  private generateEmailBody(errorKey: string, group: ErrorGroup, notificationNumber: number): string {
    const timeRange = this.formatTimeRange(group.firstSeen, group.lastSeen);
    const notificationText = this.getNotificationText(notificationNumber);
    
    const body = `
🚨 **SISTEMA MP - REPORTE DE ERRORES**

${notificationText}

📊 **RESUMEN DEL ERROR:**
• **Tipo de Error:** ${errorKey.split(':')[0]}
• **Ocurrencias:** ${group.count} veces
• **Período:** ${timeRange}
• **Notificación:** ${notificationNumber} de 3

📋 **DETALLES DE LOS ERRORES:**
${group.messages.map((msg, index) => `${index + 1}. ${msg}`).join('\n')}

⏰ **INFORMACIÓN TEMPORAL:**
• **Primera ocurrencia:** ${new Date(group.firstSeen).toLocaleString()}
• **Última ocurrencia:** ${new Date(group.lastSeen).toLocaleString()}
• **Tiempo transcurrido:** ${this.formatDuration(group.lastSeen - group.firstSeen)}

🔧 **ACCIONES RECOMENDADAS:**
1. Revisar los logs del sistema en C:\\2_mp\\logs\\
2. Verificar la configuración de Mercado Pago
3. Comprobar la conectividad de red
4. Revisar el estado del servidor FTP

📞 **CONTACTO:**
Si el problema persiste después del tercer aviso, contacte al soporte técnico.

---
*Este es un mensaje automático del Sistema MP*
*Generado el: ${new Date().toLocaleString()}*
`;

    return body;
  }

  private getNotificationText(notificationNumber: number): string {
    switch (notificationNumber) {
      case 1:
        return "⚠️ **PRIMER AVISO:** Se han detectado errores recurrentes en el sistema que requieren atención.";
      case 2:
        return "🚨 **SEGUNDO AVISO:** Los errores persisten después del primer aviso. Se requiere intervención inmediata.";
      case 3:
        return "💥 **TERCER AVISO - CRÍTICO:** Los errores continúan ocurriendo. Este es el último aviso automático.";
      default:
        return "⚠️ Se han detectado errores en el sistema.";
    }
  }

  private formatTimeRange(firstSeen: number, lastSeen: number): string {
    const duration = lastSeen - firstSeen;
    if (duration < 60000) { // menos de 1 minuto
      return `${Math.round(duration / 1000)} segundos`;
    } else if (duration < 3600000) { // menos de 1 hora
      return `${Math.round(duration / 60000)} minutos`;
    } else if (duration < 86400000) { // menos de 1 día
      return `${Math.round(duration / 3600000)} horas`;
    } else {
      return `${Math.round(duration / 86400000)} días`;
    }
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} días, ${hours % 24} horas`;
    if (hours > 0) return `${hours} horas, ${minutes % 60} minutos`;
    if (minutes > 0) return `${minutes} minutos, ${seconds % 60} segundos`;
    return `${seconds} segundos`;
  }

  public getErrorSummary(): { totalErrors: number; activeGroups: number; notificationsSent: number } {
    const errorGroups = this.store.get('errorGroups') || {};
    const groups = Object.values(errorGroups);
    
    return {
      totalErrors: groups.reduce((sum, group) => sum + group.count, 0),
      activeGroups: groups.length,
      notificationsSent: groups.reduce((sum, group) => sum + group.notificationCount, 0)
    };
  }

  public clearOldErrors(maxAgeHours: number = 24): void {
    const errorGroups = this.store.get('errorGroups') || {};
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    
    const filteredGroups: Record<string, ErrorGroup> = {};
    let clearedCount = 0;

    for (const [key, group] of Object.entries(errorGroups)) {
      if (group.lastSeen > cutoffTime) {
        filteredGroups[key] = group;
      } else {
        clearedCount++;
      }
    }

    this.store.set('errorGroups', filteredGroups);
    
    if (clearedCount > 0) {
      logInfo('Errores antiguos limpiados', { 
        clearedCount, 
        remainingGroups: Object.keys(filteredGroups).length 
      });
    }
  }

  public resetNotifications(): void {
    this.store.delete('errorGroups');
    logInfo('Todas las notificaciones de error han sido reseteadas');
  }
}

// Instancia singleton
export const errorNotificationService = new ErrorNotificationService();

// Funciones de conveniencia para uso directo
export function recordError(errorType: string, message: string, meta?: any): void {
  errorNotificationService.recordError(errorType, message, meta);
}

export function getErrorNotificationConfig() {
  return errorNotificationService.getConfig();
}

export function updateErrorNotificationConfig(config: Partial<ErrorNotificationConfig>): void {
  errorNotificationService.updateConfig(config);
}

export function getErrorSummary() {
  return errorNotificationService.getErrorSummary();
}

export function clearOldErrors(hours: number = 24): void {
  errorNotificationService.clearOldErrors(hours);
}

export function resetErrorNotifications(): void {
  errorNotificationService.resetNotifications();
}
