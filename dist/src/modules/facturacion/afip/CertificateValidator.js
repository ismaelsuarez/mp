"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateValidator = void 0;
const fs_1 = __importDefault(require("fs"));
const forge = __importStar(require("node-forge"));
class CertificateValidator {
    static validateCertificate(certPath) {
        try {
            // Verificar que el archivo existe
            if (!fs_1.default.existsSync(certPath)) {
                return {
                    valido: false,
                    fechaExpiracion: new Date(),
                    diasRestantes: 0,
                    error: `Certificado no encontrado: ${certPath}`
                };
            }
            // Leer el certificado
            const certPem = fs_1.default.readFileSync(certPath, 'utf8');
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
        }
        catch (error) {
            return {
                valido: false,
                fechaExpiracion: new Date(),
                diasRestantes: 0,
                error: `Error validando certificado: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    static validateKeyFile(keyPath) {
        try {
            if (!fs_1.default.existsSync(keyPath)) {
                return false;
            }
            const keyContent = fs_1.default.readFileSync(keyPath, 'utf8');
            // Verificar que sea una clave privada válida
            return keyContent.includes('-----BEGIN PRIVATE KEY-----') ||
                keyContent.includes('-----BEGIN RSA PRIVATE KEY-----');
        }
        catch {
            return false;
        }
    }
    static validateCertificatePair(certPath, keyPath) {
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
exports.CertificateValidator = CertificateValidator;
