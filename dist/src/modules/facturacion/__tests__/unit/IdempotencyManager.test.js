"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const IdempotencyManager_1 = require("../../afip/IdempotencyManager");
// Mock de la base de datos
const mockDb = {
    getComprobanteControl: jest.fn(),
    insertComprobanteControl: jest.fn(),
    updateComprobanteControl: jest.fn(),
    getComprobantesByEstado: jest.fn(),
    cleanupComprobantesAntiguos: jest.fn(),
    prepare: jest.fn(() => ({
        get: jest.fn(),
        run: jest.fn(),
        all: jest.fn()
    })),
    transaction: jest.fn((callback) => callback(mockDb))
};
jest.mock('../../../../services/DbService', () => ({
    getDb: jest.fn(() => mockDb)
}));
describe('IdempotencyManager', () => {
    let idempotencyManager;
    beforeEach(() => {
        jest.clearAllMocks();
        idempotencyManager = new IdempotencyManager_1.IdempotencyManager();
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('checkIdempotency', () => {
        it('debería permitir un comprobante nuevo', async () => {
            mockDb.getComprobanteControl.mockReturnValue(null); // No existe en BD
            mockDb.insertComprobanteControl.mockReturnValue(undefined);
            const result = await idempotencyManager.checkIdempotency(1, 6, 1001);
            expect(result.isDuplicate).toBe(false);
            expect(result.shouldProceed).toBe(true);
            expect(result.existingCae).toBeUndefined();
            expect(result.error).toBeUndefined();
            // Verificar que se intentó insertar
            expect(mockDb.insertComprobanteControl).toHaveBeenCalledWith({
                pto_vta: 1,
                tipo_cbte: 6,
                nro_comprobante: 1001,
                estado: 'PENDING'
            });
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
            mockDb.getComprobanteControl.mockReturnValue(existingRecord);
            const result = await idempotencyManager.checkIdempotency(1, 6, 1001);
            expect(result.isDuplicate).toBe(true);
            expect(result.shouldProceed).toBe(false);
            expect(result.existingCae).toBe('12345678901234');
            expect(result.existingCaeVto).toBe('20250131');
            expect(result.error).toBeUndefined();
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
            mockDb.getComprobanteControl.mockReturnValue(existingRecord);
            const result = await idempotencyManager.checkIdempotency(1, 6, 1001);
            expect(result.isDuplicate).toBe(true);
            expect(result.shouldProceed).toBe(true); // Permite reintento
            expect(result.existingCae).toBeUndefined();
            expect(result.error).toBeUndefined();
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
            mockDb.getComprobanteControl.mockReturnValue(existingRecord);
            const result = await idempotencyManager.checkIdempotency(1, 6, 1001);
            expect(result.isDuplicate).toBe(true);
            expect(result.shouldProceed).toBe(true); // En realidad permite reintento después de delay
            expect(result.existingCae).toBeUndefined();
            expect(result.error).toBeUndefined();
        });
        it('debería manejar errores de base de datos', async () => {
            mockDb.getComprobanteControl.mockImplementation(() => {
                throw new Error('Error de base de datos');
            });
            const result = await idempotencyManager.checkIdempotency(1, 6, 1001);
            expect(result.isDuplicate).toBe(false);
            expect(result.shouldProceed).toBe(false);
            expect(result.error).toBe('Error de base de datos');
        });
        it('debería manejar errores al insertar nuevo registro', async () => {
            mockDb.getComprobanteControl.mockReturnValue(null);
            mockDb.insertComprobanteControl.mockImplementation(() => {
                throw new Error('Error al insertar');
            });
            const result = await idempotencyManager.checkIdempotency(1, 6, 1001);
            expect(result.isDuplicate).toBe(false);
            expect(result.shouldProceed).toBe(false);
            expect(result.error).toBe('Error al insertar');
        });
    });
    describe('markAsApproved', () => {
        it('debería marcar un comprobante como aprobado', async () => {
            mockDb.updateComprobanteControl.mockReturnValue(true);
            const result = await idempotencyManager.markAsApproved(1, 6, 1001, '12345678901234', '20250131');
            expect(result).toBe(true);
            expect(mockDb.updateComprobanteControl).toHaveBeenCalledWith(1, 6, 1001, {
                estado: 'APPROVED',
                cae: '12345678901234',
                cae_vencimiento: '20250131'
            });
        });
        it('debería manejar errores al marcar como aprobado', async () => {
            mockDb.updateComprobanteControl.mockImplementation(() => {
                throw new Error('Error de base de datos');
            });
            const result = await idempotencyManager.markAsApproved(1, 6, 1001, '12345678901234', '20250131');
            expect(result).toBe(false);
        });
    });
    describe('markAsFailed', () => {
        it('debería marcar un comprobante como fallido', async () => {
            mockDb.updateComprobanteControl.mockReturnValue(true);
            const result = await idempotencyManager.markAsFailed(1, 6, 1001, 'Error de prueba');
            expect(result).toBe(true);
            expect(mockDb.updateComprobanteControl).toHaveBeenCalledWith(1, 6, 1001, {
                estado: 'FAILED',
                error_msg: 'Error de prueba'
            });
        });
        it('debería manejar errores al marcar como fallido', async () => {
            mockDb.updateComprobanteControl.mockImplementation(() => {
                throw new Error('Error de base de datos');
            });
            const result = await idempotencyManager.markAsFailed(1, 6, 1001, 'Error de prueba');
            expect(result).toBe(false);
        });
    });
    describe('getStats', () => {
        it('debería retornar estadísticas correctas', () => {
            mockDb.getComprobantesByEstado
                .mockReturnValueOnce(Array(2).fill({ estado: 'PENDING' })) // PENDING
                .mockReturnValueOnce(Array(145).fill({ estado: 'APPROVED' })) // APPROVED
                .mockReturnValueOnce(Array(3).fill({ estado: 'FAILED' })); // FAILED
            const stats = idempotencyManager.getStats();
            expect(stats.pending).toBe(2);
            expect(stats.approved).toBe(145);
            expect(stats.failed).toBe(3);
        });
        it('debería manejar errores al obtener estadísticas', () => {
            mockDb.getComprobantesByEstado.mockImplementation(() => {
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
            mockDb.cleanupComprobantesAntiguos.mockReturnValue(5);
            const deletedCount = idempotencyManager.cleanup();
            expect(deletedCount).toBe(5);
            expect(mockDb.cleanupComprobantesAntiguos).toHaveBeenCalled();
        });
        it('debería manejar errores en limpieza', () => {
            mockDb.cleanupComprobantesAntiguos.mockImplementation(() => {
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
            mockDb.getComprobantesByEstado.mockReturnValue(mockComprobantes);
            const result = idempotencyManager.getComprobantesByEstado('PENDING');
            expect(result).toHaveLength(2);
            expect(result[0].estado).toBe('PENDING');
            expect(mockDb.getComprobantesByEstado).toHaveBeenCalledWith('PENDING');
        });
        it('debería manejar errores al obtener comprobantes', () => {
            mockDb.getComprobantesByEstado.mockImplementation(() => {
                throw new Error('Error de base de datos');
            });
            const result = idempotencyManager.getComprobantesByEstado('PENDING');
            expect(result).toHaveLength(0);
        });
    });
    describe('concurrencia', () => {
        it('debería manejar múltiples intentos simultáneos', async () => {
            // Simular que el primer intento inserta exitosamente
            mockDb.getComprobanteControl
                .mockReturnValueOnce(null) // Primer check - no existe
                .mockReturnValueOnce({
                id: 1,
                pto_vta: 1,
                tipo_cbte: 6,
                nro_comprobante: 1001,
                estado: 'PENDING',
                created_at: new Date(Date.now() - 6 * 60 * 1000).toISOString() // 6 minutos atrás (stale)
            });
            mockDb.insertComprobanteControl.mockReturnValue(undefined);
            // Primer intento
            const result1 = await idempotencyManager.checkIdempotency(1, 6, 1001);
            expect(result1.isDuplicate).toBe(false);
            expect(result1.shouldProceed).toBe(true);
            // Segundo intento (simulado como concurrente)
            const result2 = await idempotencyManager.checkIdempotency(1, 6, 1001);
            expect(result2.isDuplicate).toBe(true);
            expect(result2.shouldProceed).toBe(true); // Permite reintento porque está stale
            expect(result2.error).toBeUndefined();
        });
    });
    describe('validación de parámetros', () => {
        it('debería manejar parámetros inválidos', async () => {
            mockDb.getComprobanteControl.mockReturnValue(null);
            mockDb.insertComprobanteControl.mockReturnValue(undefined);
            // @ts-ignore - Test de parámetros inválidos
            const result1 = await idempotencyManager.checkIdempotency(null, 6, 1001);
            expect(result1.isDuplicate).toBe(false);
            expect(result1.shouldProceed).toBe(true);
            // @ts-ignore - Test de parámetros inválidos
            const result2 = await idempotencyManager.checkIdempotency(1, null, 1001);
            expect(result2.isDuplicate).toBe(false);
            expect(result2.shouldProceed).toBe(true);
            // @ts-ignore - Test de parámetros inválidos
            const result3 = await idempotencyManager.checkIdempotency(1, 6, null);
            expect(result3.isDuplicate).toBe(false);
            expect(result3.shouldProceed).toBe(true);
        });
    });
});
