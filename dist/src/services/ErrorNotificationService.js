"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorNotificationService = void 0;
exports.recordError = recordError;
exports.getErrorNotificationConfig = getErrorNotificationConfig;
exports.updateErrorNotificationConfig = updateErrorNotificationConfig;
exports.getErrorSummary = getErrorSummary;
exports.clearOldErrors = clearOldErrors;
exports.resetErrorNotifications = resetErrorNotifications;
const electron_store_1 = __importDefault(require("electron-store"));
const EmailService_1 = require("./EmailService");
const LogService_1 = require("./LogService");
const DEFAULT_CONFIG = {
    enabled: true,
    minErrorsBeforeNotify: 3,
    minTimeBetweenNotifications: 60, // 1 hora
    maxNotificationsPerError: 3,
    emailSubject: '🚨 Sistema MP - Alertas de Error'
};
class ErrorNotificationService {
    constructor() {
        this.store = new electron_store_1.default({ name: 'error-notifications' });
        this.ensureConfig();
    }
    ensureConfig() {
        const config = this.store.get('config');
        if (!config) {
            this.store.set('config', DEFAULT_CONFIG);
        }
    }
    getConfig() {
        return this.store.get('config') || DEFAULT_CONFIG;
    }
    updateConfig(newConfig) {
        const currentConfig = this.getConfig();
        const updatedConfig = { ...currentConfig, ...newConfig };
        this.store.set('config', updatedConfig);
        (0, LogService_1.logInfo)('Configuración de notificaciones de error actualizada', { config: updatedConfig });
    }
    recordError(errorType, message, meta) {
        const config = this.getConfig();
        if (!config.enabled)
            return;
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
    generateErrorKey(errorType, message) {
        // Crear una clave única basada en el tipo y el mensaje principal
        const cleanMessage = message.replace(/\d+/g, 'N').replace(/[^\w\s]/g, '');
        return `${errorType}:${cleanMessage}`;
    }
    checkAndSendNotification(errorKey, group, config) {
        const now = Date.now();
        const timeSinceLastNotification = now - group.lastNotification;
        const minTimeMs = config.minTimeBetweenNotifications * 60 * 1000;
        // Verificar condiciones para enviar notificación
        const shouldNotify = group.count >= config.minErrorsBeforeNotify &&
            group.notificationCount < config.maxNotificationsPerError &&
            timeSinceLastNotification >= minTimeMs;
        if (shouldNotify) {
            this.sendErrorNotification(errorKey, group, config);
        }
    }
    async sendErrorNotification(errorKey, group, config) {
        try {
            const notificationNumber = group.notificationCount + 1;
            const subject = this.generateEmailSubject(notificationNumber);
            const body = this.generateEmailBody(errorKey, group, notificationNumber);
            await (0, EmailService_1.sendReportEmail)(subject, body, []);
            // Actualizar contador de notificaciones
            const errorGroups = this.store.get('errorGroups') || {};
            if (errorGroups[errorKey]) {
                errorGroups[errorKey].notificationCount = notificationNumber;
                errorGroups[errorKey].lastNotification = Date.now();
                this.store.set('errorGroups', errorGroups);
            }
            (0, LogService_1.logInfo)('Notificación de error enviada por email', {
                errorKey,
                notificationNumber,
                errorCount: group.count
            });
        }
        catch (error) {
            (0, LogService_1.logError)('Error al enviar notificación de error por email', {
                error: String(error),
                errorKey
            });
        }
    }
    generateEmailSubject(notificationNumber) {
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
    generateEmailBody(errorKey, group, notificationNumber) {
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
    getNotificationText(notificationNumber) {
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
    formatTimeRange(firstSeen, lastSeen) {
        const duration = lastSeen - firstSeen;
        if (duration < 60000) { // menos de 1 minuto
            return `${Math.round(duration / 1000)} segundos`;
        }
        else if (duration < 3600000) { // menos de 1 hora
            return `${Math.round(duration / 60000)} minutos`;
        }
        else if (duration < 86400000) { // menos de 1 día
            return `${Math.round(duration / 3600000)} horas`;
        }
        else {
            return `${Math.round(duration / 86400000)} días`;
        }
    }
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0)
            return `${days} días, ${hours % 24} horas`;
        if (hours > 0)
            return `${hours} horas, ${minutes % 60} minutos`;
        if (minutes > 0)
            return `${minutes} minutos, ${seconds % 60} segundos`;
        return `${seconds} segundos`;
    }
    getErrorSummary() {
        const errorGroups = this.store.get('errorGroups') || {};
        const groups = Object.values(errorGroups);
        return {
            totalErrors: groups.reduce((sum, group) => sum + group.count, 0),
            activeGroups: groups.length,
            notificationsSent: groups.reduce((sum, group) => sum + group.notificationCount, 0)
        };
    }
    clearOldErrors(maxAgeHours = 24) {
        const errorGroups = this.store.get('errorGroups') || {};
        const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
        const filteredGroups = {};
        let clearedCount = 0;
        for (const [key, group] of Object.entries(errorGroups)) {
            if (group.lastSeen > cutoffTime) {
                filteredGroups[key] = group;
            }
            else {
                clearedCount++;
            }
        }
        this.store.set('errorGroups', filteredGroups);
        if (clearedCount > 0) {
            (0, LogService_1.logInfo)('Errores antiguos limpiados', {
                clearedCount,
                remainingGroups: Object.keys(filteredGroups).length
            });
        }
    }
    resetNotifications() {
        this.store.delete('errorGroups');
        (0, LogService_1.logInfo)('Todas las notificaciones de error han sido reseteadas');
    }
}
// Instancia singleton
exports.errorNotificationService = new ErrorNotificationService();
// Funciones de conveniencia para uso directo
function recordError(errorType, message, meta) {
    exports.errorNotificationService.recordError(errorType, message, meta);
}
function getErrorNotificationConfig() {
    return exports.errorNotificationService.getConfig();
}
function updateErrorNotificationConfig(config) {
    exports.errorNotificationService.updateConfig(config);
}
function getErrorSummary() {
    return exports.errorNotificationService.getErrorSummary();
}
function clearOldErrors(hours = 24) {
    exports.errorNotificationService.clearOldErrors(hours);
}
function resetErrorNotifications() {
    exports.errorNotificationService.resetNotifications();
}
