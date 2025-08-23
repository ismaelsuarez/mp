import { afipService } from '../../afipService';
import { comprobanteHomologacion } from '../fixtures/comprobantes';
import fs from 'fs';
import path from 'path';

// Tests de homologación - requieren certificados reales de AFIP
describe('AFIP Homologación', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    // Guardar variables de entorno originales
    originalEnv = { ...process.env };
    
    // Verificar que existan las credenciales de homologación
    const requiredVars = [
      'AFIP_CUIT_HOMOLOGACION',
      'AFIP_CERT_PATH_HOMOLOGACION',
      'AFIP_KEY_PATH_HOMOLOGACION'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.warn(`⚠️  Variables de entorno faltantes para homologación: ${missingVars.join(', ')}`);
      console.warn('Los tests de homologación se saltarán.');
    }

    // Verificar que existan los archivos de certificados
    const certPath = process.env.AFIP_CERT_PATH_HOMOLOGACION;
    const keyPath = process.env.AFIP_KEY_PATH_HOMOLOGACION;

    if (certPath && !fs.existsSync(certPath)) {
      console.warn(`⚠️  Archivo de certificado no encontrado: ${certPath}`);
    }

    if (keyPath && !fs.existsSync(keyPath)) {
      console.warn(`⚠️  Archivo de clave privada no encontrado: ${keyPath}`);
    }
  });

  afterAll(() => {
    // Restaurar variables de entorno originales
    process.env = originalEnv;
  });

  describe('Configuración de Homologación', () => {
    it('debería tener credenciales de homologación configuradas', () => {
      expect(process.env.AFIP_CUIT_HOMOLOGACION).toBeDefined();
      expect(process.env.AFIP_CERT_PATH_HOMOLOGACION).toBeDefined();
      expect(process.env.AFIP_KEY_PATH_HOMOLOGACION).toBeDefined();
    });

    it('debería tener archivos de certificados válidos', () => {
      const certPath = process.env.AFIP_CERT_PATH_HOMOLOGACION;
      const keyPath = process.env.AFIP_KEY_PATH_HOMOLOGACION;

      if (certPath) {
        expect(fs.existsSync(certPath)).toBe(true);
        expect(fs.statSync(certPath).size).toBeGreaterThan(0);
      }

      if (keyPath) {
        expect(fs.existsSync(keyPath)).toBe(true);
        expect(fs.statSync(keyPath).size).toBeGreaterThan(0);
      }
    });
  });

  describe('Emisión de Comprobante Válido', () => {
    it('debería emitir comprobante válido y recibir CAE', async () => {
      // Solo ejecutar si hay credenciales configuradas
      if (!process.env.AFIP_CUIT_HOMOLOGACION) {
        console.log('⏭️  Saltando test - no hay credenciales de homologación');
        return;
      }

      const result = await afipService.solicitarCAE(comprobanteHomologacion);

      expect(result).toHaveProperty('cae');
      expect(result).toHaveProperty('vencimientoCAE');
      expect(result).toHaveProperty('qrData');
      
      expect(result.cae).toBeTruthy();
      expect(result.cae.length).toBeGreaterThan(0);
      expect(result.vencimientoCAE).toBeTruthy();
      expect(result.qrData).toContain('https://www.afip.gob.ar/fe/qr/');

      console.log(`✅ CAE obtenido: ${result.cae}`);
      console.log(`✅ Vencimiento: ${result.vencimientoCAE}`);
    }, 60000); // Timeout de 60 segundos para homologación
  });

  describe('Control de Duplicados', () => {
    it('debería retornar CAE existente para comprobante duplicado', async () => {
      if (!process.env.AFIP_CUIT_HOMOLOGACION) {
        console.log('⏭️  Saltando test - no hay credenciales de homologación');
        return;
      }

      // Primera emisión
      const comprobante1 = { ...comprobanteHomologacion };
      const result1 = await afipService.solicitarCAE(comprobante1);

      expect(result1.cae).toBeTruthy();

      // Segunda emisión del mismo comprobante (debería retornar CAE existente)
      const comprobante2 = { ...comprobanteHomologacion };
      const result2 = await afipService.solicitarCAE(comprobante2);

      expect(result2.cae).toBe(result1.cae);
      expect(result2.vencimientoCAE).toBe(result1.vencimientoCAE);

      console.log(`✅ Duplicado detectado - CAE retornado: ${result2.cae}`);
    }, 120000); // Timeout de 2 minutos para este test
  });

  describe('Validación de Parámetros Inválidos', () => {
    it('debería rechazar comprobante con tipo inválido', async () => {
      if (!process.env.AFIP_CUIT_HOMOLOGACION) {
        console.log('⏭️  Saltando test - no hay credenciales de homologación');
        return;
      }

      const comprobanteInvalido = {
        ...comprobanteHomologacion,
        tipo: 'FACTURA_INVALIDA' as any
      };

      await expect(afipService.solicitarCAE(comprobanteInvalido))
        .rejects.toThrow();

      console.log('✅ Rechazo de parámetros inválidos funcionando correctamente');
    }, 30000);

    it('debería rechazar comprobante con punto de venta inválido', async () => {
      if (!process.env.AFIP_CUIT_HOMOLOGACION) {
        console.log('⏭️  Saltando test - no hay credenciales de homologación');
        return;
      }

      const comprobanteInvalido = {
        ...comprobanteHomologacion,
        puntoVenta: 999 // Punto de venta inválido
      };

      await expect(afipService.solicitarCAE(comprobanteInvalido))
        .rejects.toThrow();

      console.log('✅ Rechazo de punto de venta inválido funcionando correctamente');
    }, 30000);
  });

  describe('Validación de Tiempo NTP', () => {
    it('debería validar sincronización de tiempo antes de emisión', async () => {
      if (!process.env.AFIP_CUIT_HOMOLOGACION) {
        console.log('⏭️  Saltando test - no hay credenciales de homologación');
        return;
      }

      // Forzar validación de tiempo
      const timeValidation = await afipService.forceTimeValidation();

      expect(timeValidation.isValid).toBe(true);
      expect(timeValidation.drift).toBeLessThan(60000); // Menos de 60 segundos
      expect(timeValidation.systemTime).toBeInstanceOf(Date);
      expect(timeValidation.ntpTime).toBeInstanceOf(Date);

      console.log(`✅ Drift de tiempo: ${timeValidation.drift}ms`);
      console.log(`✅ Tiempo del sistema: ${timeValidation.systemTime.toISOString()}`);
      console.log(`✅ Tiempo NTP: ${timeValidation.ntpTime.toISOString()}`);
    }, 30000);
  });

  describe('Estado de Servidores AFIP', () => {
    it('debería verificar estado de servidores de homologación', async () => {
      if (!process.env.AFIP_CUIT_HOMOLOGACION) {
        console.log('⏭️  Saltando test - no hay credenciales de homologación');
        return;
      }

      const status = await afipService.checkServerStatus();

      expect(status).toHaveProperty('appserver');
      expect(status).toHaveProperty('dbserver');
      expect(status).toHaveProperty('authserver');

      console.log(`✅ Estado AppServer: ${status.appserver}`);
      console.log(`✅ Estado DbServer: ${status.dbserver}`);
      console.log(`✅ Estado AuthServer: ${status.authserver}`);
    }, 30000);
  });

  describe('Validación de Certificado', () => {
    it('debería validar certificado de homologación', () => {
      if (!process.env.AFIP_CUIT_HOMOLOGACION) {
        console.log('⏭️  Saltando test - no hay credenciales de homologación');
        return;
      }

      const certInfo = afipService.validarCertificado();

      expect(certInfo).toHaveProperty('valido');
      expect(certInfo).toHaveProperty('fechaExpiracion');
      expect(certInfo).toHaveProperty('diasRestantes');

      console.log(`✅ Certificado válido: ${certInfo.valido}`);
      console.log(`✅ Fecha de expiración: ${certInfo.fechaExpiracion}`);
      console.log(`✅ Días restantes: ${certInfo.diasRestantes}`);

      if (certInfo.valido) {
        expect(certInfo.diasRestantes).toBeGreaterThan(0);
      }
    });
  });

  describe('Último Número Autorizado', () => {
    it('debería obtener último número autorizado de homologación', async () => {
      if (!process.env.AFIP_CUIT_HOMOLOGACION) {
        console.log('⏭️  Saltando test - no hay credenciales de homologación');
        return;
      }

      const ultimo = await afipService.getUltimoAutorizado(1, 'FACTURA_B');

      expect(typeof ultimo).toBe('number');
      expect(ultimo).toBeGreaterThanOrEqual(0);

      console.log(`✅ Último número autorizado: ${ultimo}`);
    }, 30000);
  });

  describe('Estadísticas de Homologación', () => {
    it('debería obtener estadísticas de idempotencia', () => {
      const stats = afipService.getIdempotencyStats();

      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('approved');
      expect(stats).toHaveProperty('failed');

      console.log(`✅ Comprobantes pendientes: ${stats.pending}`);
      console.log(`✅ Comprobantes aprobados: ${stats.approved}`);
      console.log(`✅ Comprobantes fallidos: ${stats.failed}`);
    });

    it('debería obtener estadísticas de validación de tiempo', () => {
      const stats = afipService.getTimeValidationStats();

      expect(stats).toHaveProperty('totalValidations');
      expect(stats).toHaveProperty('averageDrift');
      expect(stats).toHaveProperty('lastValidation');

      console.log(`✅ Total validaciones: ${stats.totalValidations}`);
      console.log(`✅ Drift promedio: ${stats.averageDrift}ms`);
      console.log(`✅ Última validación: ${stats.lastValidation ? 'Realizada' : 'No realizada'}`);
    });
  });

  describe('Limpieza de Datos', () => {
    it('debería limpiar comprobantes antiguos', () => {
      const deletedCount = afipService.cleanupIdempotency();

      expect(typeof deletedCount).toBe('number');
      expect(deletedCount).toBeGreaterThanOrEqual(0);

      console.log(`✅ Comprobantes eliminados: ${deletedCount}`);
    });
  });

  describe('Logs de Homologación', () => {
    it('debería generar logs estructurados', () => {
      const logs = afipService.getLogs();

      expect(Array.isArray(logs)).toBe(true);

      // Verificar que los logs tengan estructura JSON
      if (logs.length > 0) {
        const firstLog = logs[0];
        expect(firstLog).toHaveProperty('timestamp');
        expect(firstLog).toHaveProperty('operation');
      }

      console.log(`✅ Total de logs: ${logs.length}`);
    });
  });
});
