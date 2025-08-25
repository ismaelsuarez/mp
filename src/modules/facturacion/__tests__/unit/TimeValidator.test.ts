// Mock de ntp-client
const mockNtpClient = {
  getNetworkTime: jest.fn()
};

jest.mock('ntp-client', () => mockNtpClient);

import { TimeValidator } from '../../utils/TimeValidator';

describe('TimeValidator', () => {
  let timeValidator: TimeValidator;

  beforeEach(() => {
    timeValidator = new TimeValidator();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateSystemTime', () => {
    it('debería validar tiempo sincronizado correctamente', async () => {
      const result = await timeValidator.validateSystemTime();

      expect(result.isValid).toBe(true);
      expect(result.drift).toBeGreaterThanOrEqual(0);
      expect(result.systemTime).toBeInstanceOf(Date);
      expect(result.ntpTime).toBeInstanceOf(Date);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('debería detectar drift excesivo', async () => {
      // Mock de tiempo local con drift de 65 segundos
      const mockSystemTime = new Date('2024-12-19T10:30:00.000Z');
      const mockNtpTime = new Date('2024-12-19T10:31:05.000Z'); // 65 segundos de diferencia
      
      jest.spyOn(Date, 'now').mockReturnValue(mockSystemTime.getTime());
      mockNtpClient.getNetworkTime.mockImplementation((server, port, callback) => {
        setTimeout(() => {
          callback(null, mockNtpTime);
        }, 100);
      });

      const result = await timeValidator.validateSystemTime();

      expect(result.isValid).toBe(false);
      expect(result.drift).toBeGreaterThan(60000); // Más de 60 segundos
      expect(result.error).toContain('Drift de tiempo detectado');
    });

    it('debería manejar errores de NTP', async () => {
      mockNtpClient.getNetworkTime.mockImplementation((server, port, callback) => {
        setTimeout(() => {
          callback(new Error('Timeout'), null);
        }, 100);
      });

      const result = await timeValidator.validateSystemTime();

      expect(result.isValid).toBe(true); // No bloquea por errores de NTP
      expect(result.warning).toContain('No se pudo validar con NTP');
      expect(result.drift).toBe(0);
    });

    it('debería usar configuración personalizada', async () => {
      const customConfig = {
        server: 'time.google.com',
        port: 123,
        allowedDrift: 30000, // 30 segundos
        timeout: 3000
      };

      const validator = new TimeValidator(customConfig);
      const result = await validator.validateSystemTime();

      expect(result.isValid).toBe(true);
      expect(mockNtpClient.getNetworkTime).toHaveBeenCalledWith('time.google.com', 123, expect.any(Function));
    });

    it('debería manejar timeout de NTP', async () => {
      mockNtpClient.getNetworkTime.mockImplementation((server, port, callback) => {
        // No llamar callback - simular timeout
      });

      const result = await timeValidator.validateSystemTime();

      expect(result.isValid).toBe(true);
      expect(result.warning).toContain('No se pudo validar con NTP');
    });

    it('debería actualizar estadísticas correctamente', async () => {
      const initialStats = timeValidator.getStats();
      
      await timeValidator.validateSystemTime();
      
      const updatedStats = timeValidator.getStats();
      
      expect(updatedStats.totalValidations).toBe(initialStats.totalValidations + 1);
      expect(updatedStats.lastValidation).toBeDefined();
    });
  });

  describe('validateAndThrow', () => {
    it('debería no lanzar error si el tiempo está sincronizado', async () => {
      await expect(timeValidator.validateAndThrow()).resolves.not.toThrow();
    });

    it('debería lanzar error si hay drift excesivo', async () => {
      // Mock de tiempo local con drift de 65 segundos
      const mockSystemTime = new Date('2024-12-19T10:30:00.000Z');
      const mockNtpTime = new Date('2024-12-19T10:31:05.000Z');
      
      jest.spyOn(Date, 'now').mockReturnValue(mockSystemTime.getTime());
      mockNtpClient.getNetworkTime.mockImplementation((server, port, callback) => {
        setTimeout(() => {
          callback(null, mockNtpTime);
        }, 100);
      });

      await expect(timeValidator.validateAndThrow()).rejects.toThrow('Drift de tiempo detectado');
    });

    it('debería no lanzar error si NTP falla', async () => {
      mockNtpClient.getNetworkTime.mockImplementation((server, port, callback) => {
        setTimeout(() => {
          callback(new Error('NTP Error'), null);
        }, 100);
      });

      await expect(timeValidator.validateAndThrow()).resolves.not.toThrow();
    });
  });

  describe('getStats', () => {
    it('debería retornar estadísticas iniciales', () => {
      const stats = timeValidator.getStats();

      expect(stats.totalValidations).toBe(0);
      expect(stats.averageDrift).toBe(0);
      expect(stats.lastValidation).toBeNull();
      expect(stats.config).toBeDefined();
    });

    it('debería actualizar estadísticas después de validaciones', async () => {
      await timeValidator.validateSystemTime();
      
      const stats = timeValidator.getStats();
      
      expect(stats.totalValidations).toBe(1);
      expect(stats.lastValidation).toBeDefined();
      expect(stats.lastValidation?.isValid).toBe(true);
    });

    it('debería calcular promedio de drift correctamente', async () => {
      // Primera validación con drift de 1000ms
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-12-19T10:30:00.000Z').getTime());
      mockNtpClient.getNetworkTime.mockImplementation((server, port, callback) => {
        setTimeout(() => {
          callback(null, new Date('2024-12-19T10:30:01.000Z'));
        }, 100);
      });
      
      await timeValidator.validateSystemTime();

      // Segunda validación con drift de 2000ms
      mockNtpClient.getNetworkTime.mockImplementation((server, port, callback) => {
        setTimeout(() => {
          callback(null, new Date('2024-12-19T10:30:02.000Z'));
        }, 100);
      });
      
      await timeValidator.validateSystemTime();

      const stats = timeValidator.getStats();
      
      expect(stats.totalValidations).toBe(2);
      expect(stats.averageDrift).toBe(1500); // Promedio de 1000 y 2000
    });
  });

  describe('getStatus', () => {
    it('debería retornar estado inicial', () => {
      const status = timeValidator.getStatus();

      expect(status.isConfigured).toBe(true);
      expect(status.lastValidationTime).toBeNull();
      expect(status.isLastValidationValid).toBe(false);
      expect(status.lastDrift).toBe(0);
    });

    it('debería actualizar estado después de validación exitosa', async () => {
      await timeValidator.validateSystemTime();
      
      const status = timeValidator.getStatus();
      
      expect(status.lastValidationTime).toBeDefined();
      expect(status.isLastValidationValid).toBe(true);
      expect(status.lastDrift).toBeGreaterThan(0);
    });

    it('debería actualizar estado después de validación fallida', async () => {
      // Mock de drift excesivo
      const mockSystemTime = new Date('2024-12-19T10:30:00.000Z');
      const mockNtpTime = new Date('2024-12-19T10:31:05.000Z');
      
      jest.spyOn(Date, 'now').mockReturnValue(mockSystemTime.getTime());
      mockNtpClient.getNetworkTime.mockImplementation((server, port, callback) => {
        setTimeout(() => {
          callback(null, mockNtpTime);
        }, 100);
      });

      await timeValidator.validateSystemTime();
      
      const status = timeValidator.getStatus();
      
      expect(status.lastValidationTime).toBeDefined();
      expect(status.isLastValidationValid).toBe(false);
      expect(status.lastDrift).toBeGreaterThan(60000);
    });
  });

  describe('configuración', () => {
    it('debería usar configuración por defecto', () => {
      const validator = new TimeValidator();
      const config = validator.getStats().config;

      expect(config.server).toBe('pool.ntp.org');
      expect(config.port).toBe(123);
      expect(config.allowedDrift).toBe(60000);
      expect(config.timeout).toBe(5000);
    });

    it('debería usar configuración personalizada', () => {
      const customConfig = {
        server: 'time.google.com',
        port: 456,
        allowedDrift: 30000,
        timeout: 2000
      };

      const validator = new TimeValidator(customConfig);
      const config = validator.getStats().config;

      expect(config.server).toBe('time.google.com');
      expect(config.port).toBe(456);
      expect(config.allowedDrift).toBe(30000);
      expect(config.timeout).toBe(2000);
    });

    it('debería usar variables de entorno', () => {
      process.env.NTP_SERVER = 'time.cloudflare.com';
      process.env.NTP_PORT = '789';
      process.env.NTP_ALLOWED_DRIFT = '45000';
      process.env.NTP_TIMEOUT = '4000';

      const validator = new TimeValidator();
      const config = validator.getStats().config;

      expect(config.server).toBe('time.cloudflare.com');
      expect(config.port).toBe(789);
      expect(config.allowedDrift).toBe(45000);
      expect(config.timeout).toBe(4000);
    });
  });

  describe('manejo de errores', () => {
    it('debería manejar errores de callback de NTP', async () => {
      mockNtpClient.getNetworkTime.mockImplementation((server, port, callback) => {
        setTimeout(() => {
          callback('Error string', null);
        }, 100);
      });

      const result = await timeValidator.validateSystemTime();

      expect(result.isValid).toBe(true);
      expect(result.warning).toContain('No se pudo validar con NTP');
    });

    it('debería manejar errores de tipo Error', async () => {
      mockNtpClient.getNetworkTime.mockImplementation((server, port, callback) => {
        setTimeout(() => {
          callback(new Error('NTP Server Error'), null);
        }, 100);
      });

      const result = await timeValidator.validateSystemTime();

      expect(result.isValid).toBe(true);
      expect(result.warning).toContain('No se pudo validar con NTP');
    });
  });
});
