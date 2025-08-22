import fs from 'fs';
import { CertificadoInfo } from '../types';
import * as forge from 'node-forge';

export class CertificateValidator {
  static validateCertificate(certPath: string): CertificadoInfo {
    try {
      // Verificar que el archivo existe
      if (!fs.existsSync(certPath)) {
        return {
          valido: false,
          fechaExpiracion: new Date(),
          diasRestantes: 0,
          error: `Certificado no encontrado: ${certPath}`
        };
      }

      // Leer el certificado
      const certPem = fs.readFileSync(certPath, 'utf8');
      
      // Parsear el certificado
      const cert = forge.pki.certificateFromPem(certPem);
      
      // Obtener fecha de expiración
      const fechaExpiracion = cert.validity.notAfter;
      const ahora = new Date();
      const diasRestantes = Math.ceil((fechaExpiracion.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));

      // Validar que no esté expirado
      if (fechaExpiracion < ahora) {
        return {
          valido: false,
          fechaExpiracion,
          diasRestantes: 0,
          error: 'Certificado expirado'
        };
      }

      // Validar que no expire en menos de 30 días
      if (diasRestantes < 30) {
        return {
          valido: false,
          fechaExpiracion,
          diasRestantes,
          error: `Certificado expira en ${diasRestantes} días (mínimo 30 días requeridos)`
        };
      }

      return {
        valido: true,
        fechaExpiracion,
        diasRestantes
      };

    } catch (error) {
      return {
        valido: false,
        fechaExpiracion: new Date(),
        diasRestantes: 0,
        error: `Error validando certificado: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  static validateKeyFile(keyPath: string): boolean {
    try {
      if (!fs.existsSync(keyPath)) {
        return false;
      }

      const keyContent = fs.readFileSync(keyPath, 'utf8');
      
      // Verificar que sea una clave privada válida
      return keyContent.includes('-----BEGIN PRIVATE KEY-----') || 
             keyContent.includes('-----BEGIN RSA PRIVATE KEY-----');
    } catch {
      return false;
    }
  }

  static validateCertificatePair(certPath: string, keyPath: string): { certValid: boolean; keyValid: boolean; error?: string } {
    const certInfo = this.validateCertificate(certPath);
    const keyValid = this.validateKeyFile(keyPath);

    if (!certInfo.valido) {
      return {
        certValid: false,
        keyValid,
        error: certInfo.error
      };
    }

    if (!keyValid) {
      return {
        certValid: true,
        keyValid: false,
        error: 'Archivo de clave privada no válido o no encontrado'
      };
    }

    return {
      certValid: true,
      keyValid: true
    };
  }
}
