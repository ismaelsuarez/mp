import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { AfipLogEntry } from '../types';
import dayjs from 'dayjs';

export class AfipLogger {
  private logDir: string;

  constructor() {
    const userData = app.getPath('userData');
    this.logDir = path.join(userData, 'logs', 'afip');
    this.ensureLogDir();
  }

  private ensureLogDir(): void {
    try {
      fs.mkdirSync(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Error creando directorio de logs AFIP:', error);
    }
  }

  private getLogFilePath(): string {
    const today = dayjs().format('YYYYMMDD');
    return path.join(this.logDir, `${today}.log`);
  }

  log(entry: Omit<AfipLogEntry, 'timestamp'>): void {
    const logEntry: AfipLogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    const logFile = this.getLogFilePath();

    try {
      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      console.error('Error escribiendo log AFIP:', error);
    }
  }

  logRequest(operation: string, request: any): void {
    this.log({
      operation,
      request: this.sanitizeData(request)
    });
  }

  logResponse(operation: string, response: any): void {
    this.log({
      operation,
      response: this.sanitizeData(response)
    });
  }

  logError(operation: string, error: Error, request?: any): void {
    this.log({
      operation,
      error: error.message,
      stack: error.stack,
      request: request ? this.sanitizeData(request) : undefined
    });
  }

  private sanitizeData(data: any): any {
    if (!data) return data;
    
    // Crear una copia para no modificar el original
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remover datos sensibles si existen
    if (sanitized.cert) sanitized.cert = '[REDACTED]';
    if (sanitized.key) sanitized.key = '[REDACTED]';
    if (sanitized.token) sanitized.token = '[REDACTED]';
    if (sanitized.sign) sanitized.sign = '[REDACTED]';
    
    return sanitized;
  }

  getLogs(date?: string): AfipLogEntry[] {
    const targetDate = date || dayjs().format('YYYYMMDD');
    const logFile = path.join(this.logDir, `${targetDate}.log`);
    
    try {
      if (!fs.existsSync(logFile)) return [];
      
      const content = fs.readFileSync(logFile, 'utf8');
      return content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    } catch (error) {
      console.error('Error leyendo logs AFIP:', error);
      return [];
    }
  }
}
