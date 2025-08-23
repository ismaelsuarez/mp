import { IdempotencyManager } from '../../afip/IdempotencyManager';
import { mockDatabase } from '../fixtures/mocks';

// Mock de la base de datos
jest.mock('../../../services/DbService', () => ({
  getDb: jest.fn(() => mockDatabase)
}));

describe('IdempotencyManager', () => {
  let idempotencyManager: IdempotencyManager;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { ...mockDatabase };
    idempotencyManager = new IdempotencyManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkIdempotency', () => {
    it('debería permitir un comprobante nuevo', async () => {
      mockDb.prepare().get.mockReturnValue(null); // No existe en BD

      const result = await idempotencyManager.checkIdempotency(1, 6, 1001);

      expect(result.isDuplicate).toBe(false);
      expect(result.shouldProceed).toBe(true);
      expect(result.existingCae).toBeNull();
      expect(result.error).toBeNull();
      
      // Verificar que se intentó insertar
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO comprobantes_control')
      );
    });

    it('debería detectar un duplicado exitoso y retornar CAE existente', async () => {
      const existingRecord = {
        id: 1,
        pto_vta: 1,
        tipo_cbte: 6,
        nro_comprobante: 1001,
        estado: 'APPROVED',
        cae: '12345678901234',
        cae_vencimiento: '20250131',
        created_at: '2024-12-19T10:30:00.000Z'
      };

      mockDb.prepare().get.mockReturnValue(existingRecord);

      const result = await idempotencyManager.checkIdempotency(1, 6, 1001);

      expect(result.isDuplicate).toBe(true);
      expect(result.shouldProceed).toBe(false);
      expect(result.existingCae).toBe('12345678901234');
      expect(result.existingCaeVto).toBe('20250131');
      expect(result.error).toBeNull();
    });

    it('debería detectar un duplicado fallido y permitir reintento', async () => {
      const existingRecord = {
        id: 1,
        pto_vta: 1,
        tipo_cbte: 6,
        nro_comprobante: 1001,
        estado: 'FAILED',
        error_msg: 'Error anterior',
        created_at: '2024-12-19T10:30:00.000Z'
      };

      mockDb.prepare().get.mockReturnValue(existingRecord);

      const result = await idempotencyManager.checkIdempotency(1, 6, 1001);

      expect(result.isDuplicate).toBe(true);
      expect(result.shouldProceed).toBe(true); // Permite reintento
      expect(result.existingCae).toBeNull();
      expect(result.error).toBeNull();
    });

    it('debería detectar un duplicado pendiente y bloquear', async () => {
      const existingRecord = {
        id: 1,
        pto_vta: 1,
        tipo_cbte: 6,
        nro_comprobante: 1001,
        estado: 'PENDING',
        created_at: '2024-12-19T10:30:00.000Z'
      };

      mockDb.prepare().get.mockReturnValue(existingRecord);

      const result = await idempotencyManager.checkIdempotency(1, 6, 1001);

      expect(result.isDuplicate).toBe(true);
      expect(result.shouldProceed).toBe(false); // Bloquea
      expect(result.existingCae).toBeNull();
      expect(result.error).toBe('Comprobante en proceso');
    });

    it('debería manejar errores de base de datos', async () => {
      mockDb.prepare().get.mockImplementation(() => {
        throw new Error('Error de base de datos');
      });

      const result = await idempotencyManager.checkIdempotency(1, 6, 1001);

      expect(result.isDuplicate).toBe(false);
      expect(result.shouldProceed).toBe(false);
      expect(result.error).toBe('Error verificando idempotencia: Error de base de datos');
    });

    it('debería manejar errores al insertar nuevo registro', async () => {
      mockDb.prepare().get.mockReturnValue(null);
      mockDb.prepare().run.mockImplementation(() => {
        throw new Error('Error al insertar');
      });

      const result = await idempotencyManager.checkIdempotency(1, 6, 1001);

      expect(result.isDuplicate).toBe(false);
      expect(result.shouldProceed).toBe(false);
      expect(result.error).toBe('Error registrando comprobante: Error al insertar');
    });
  });

  describe('markAsApproved', () => {
    it('debería marcar un comprobante como aprobado', async () => {
      mockDb.prepare().run.mockReturnValue({ changes: 1 });

      const result = await idempotencyManager.markAsApproved(1, 6, 1001, '12345678901234', '20250131');

      expect(result).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE comprobantes_control')
      );
    });

    it('debería manejar errores al marcar como aprobado', async () => {
      mockDb.prepare().run.mockImplementation(() => {
        throw new Error('Error de base de datos');
      });

      const result = await idempotencyManager.markAsApproved(1, 6, 1001, '12345678901234', '20250131');

      expect(result).toBe(false);
    });
  });

  describe('markAsFailed', () => {
    it('debería marcar un comprobante como fallido', async () => {
      mockDb.prepare().run.mockReturnValue({ changes: 1 });

      const result = await idempotencyManager.markAsFailed(1, 6, 1001, 'Error de prueba');

      expect(result).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE comprobantes_control')
      );
    });

    it('debería manejar errores al marcar como fallido', async () => {
      mockDb.prepare().run.mockImplementation(() => {
        throw new Error('Error de base de datos');
      });

      const result = await idempotencyManager.markAsFailed(1, 6, 1001, 'Error de prueba');

      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('debería retornar estadísticas correctas', () => {
      mockDb.prepare().get
        .mockReturnValueOnce({ count: 2 }) // PENDING
        .mockReturnValueOnce({ count: 145 }) // APPROVED
        .mockReturnValueOnce({ count: 3 }); // FAILED

      const stats = idempotencyManager.getStats();

      expect(stats.pending).toBe(2);
      expect(stats.approved).toBe(145);
      expect(stats.failed).toBe(3);
    });

    it('debería manejar errores al obtener estadísticas', () => {
      mockDb.prepare().get.mockImplementation(() => {
        throw new Error('Error de base de datos');
      });

      const stats = idempotencyManager.getStats();

      expect(stats.pending).toBe(0);
      expect(stats.approved).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('debería limpiar registros antiguos', () => {
      mockDb.prepare().run.mockReturnValue({ changes: 5 });

      const deletedCount = idempotencyManager.cleanup();

      expect(deletedCount).toBe(5);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM comprobantes_control')
      );
    });

    it('debería manejar errores en limpieza', () => {
      mockDb.prepare().run.mockImplementation(() => {
        throw new Error('Error de base de datos');
      });

      const deletedCount = idempotencyManager.cleanup();

      expect(deletedCount).toBe(0);
    });
  });

  describe('getComprobantesByEstado', () => {
    it('debería retornar comprobantes por estado', () => {
      const mockComprobantes = [
        { id: 1, pto_vta: 1, tipo_cbte: 6, nro_comprobante: 1001, estado: 'PENDING' },
        { id: 2, pto_vta: 1, tipo_cbte: 6, nro_comprobante: 1002, estado: 'PENDING' }
      ];

      mockDb.prepare().all.mockReturnValue(mockComprobantes);

      const result = idempotencyManager.getComprobantesByEstado('PENDING');

      expect(result).toHaveLength(2);
      expect(result[0].estado).toBe('PENDING');
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM comprobantes_control')
      );
    });

    it('debería manejar errores al obtener comprobantes', () => {
      mockDb.prepare().all.mockImplementation(() => {
        throw new Error('Error de base de datos');
      });

      const result = idempotencyManager.getComprobantesByEstado('PENDING');

      expect(result).toHaveLength(0);
    });
  });

  describe('concurrencia', () => {
    it('debería manejar múltiples intentos simultáneos', async () => {
      // Simular que el primer intento inserta exitosamente
      mockDb.prepare().get
        .mockReturnValueOnce(null) // Primer check - no existe
        .mockReturnValueOnce({ // Segundo check - ya existe (PENDING)
          id: 1,
          pto_vta: 1,
          tipo_cbte: 6,
          nro_comprobante: 1001,
          estado: 'PENDING',
          created_at: new Date().toISOString()
        });

      // Primer intento
      const result1 = await idempotencyManager.checkIdempotency(1, 6, 1001);
      expect(result1.isDuplicate).toBe(false);
      expect(result1.shouldProceed).toBe(true);

      // Segundo intento (simulado como concurrente)
      const result2 = await idempotencyManager.checkIdempotency(1, 6, 1001);
      expect(result2.isDuplicate).toBe(true);
      expect(result2.shouldProceed).toBe(false);
      expect(result2.error).toBe('Comprobante en proceso');
    });
  });

  describe('validación de parámetros', () => {
    it('debería validar parámetros requeridos', async () => {
      // @ts-ignore - Test de parámetros inválidos
      await expect(idempotencyManager.checkIdempotency(null, 6, 1001))
        .rejects.toThrow();

      // @ts-ignore - Test de parámetros inválidos
      await expect(idempotencyManager.checkIdempotency(1, null, 1001))
        .rejects.toThrow();

      // @ts-ignore - Test de parámetros inválidos
      await expect(idempotencyManager.checkIdempotency(1, 6, null))
        .rejects.toThrow();
    });
  });
});
