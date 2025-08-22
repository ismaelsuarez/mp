import { getDb, ComprobanteControl } from '../../../services/DbService';
import { AfipLogger } from './AfipLogger';

export interface IdempotencyResult {
  isDuplicate: boolean;
  existingCae?: string;
  existingCaeVto?: string;
  shouldProceed: boolean;
  error?: string;
}

export class IdempotencyManager {
  private logger: AfipLogger;
  private db = getDb();

  constructor() {
    this.logger = new AfipLogger();
  }

  /**
   * Verifica si un comprobante ya existe y maneja la idempotencia
   */
  async checkIdempotency(
    ptoVta: number, 
    tipoCbte: number, 
    nroComprobante: number,
    payload?: any
  ): Promise<IdempotencyResult> {
    try {
      this.logger.logRequest('checkIdempotency', { ptoVta, tipoCbte, nroComprobante });

      // Buscar comprobante existente
      const existing = this.db.getComprobanteControl(ptoVta, tipoCbte, nroComprobante);

      if (!existing) {
        // No existe, crear registro PENDING
        try {
          this.db.insertComprobanteControl({
            pto_vta: ptoVta,
            tipo_cbte: tipoCbte,
            nro_comprobante: nroComprobante,
            estado: 'PENDING',
            payload: payload ? JSON.stringify(payload) : undefined
          });

          this.logger.logResponse('checkIdempotency', { 
            isDuplicate: false, 
            shouldProceed: true,
            action: 'created_pending'
          });

          return {
            isDuplicate: false,
            shouldProceed: true
          };
        } catch (error) {
          // Error al insertar (probablemente duplicado por concurrencia)
          const duplicateError = error instanceof Error ? error.message : String(error);
          if (duplicateError.includes('UNIQUE constraint failed')) {
            // Reintentar lectura después de un breve delay
            await this.delay(100);
            return this.checkIdempotency(ptoVta, tipoCbte, nroComprobante, payload);
          }
          throw error;
        }
      }

      // Comprobante existe, verificar estado
      switch (existing.estado) {
        case 'APPROVED':
          this.logger.logResponse('checkIdempotency', { 
            isDuplicate: true, 
            shouldProceed: false,
            action: 'return_existing_cae',
            cae: existing.cae
          });

          return {
            isDuplicate: true,
            existingCae: existing.cae,
            existingCaeVto: existing.cae_vencimiento,
            shouldProceed: false
          };

        case 'FAILED':
          // Permitir reintento si falló
          this.logger.logResponse('checkIdempotency', { 
            isDuplicate: true, 
            shouldProceed: true,
            action: 'retry_failed',
            previousError: existing.error_msg
          });

          return {
            isDuplicate: true,
            shouldProceed: true
          };

        case 'PENDING':
          // Verificar si está "colgado" (más de 5 minutos)
          const created = new Date(existing.created_at || '');
          const now = new Date();
          const minutesDiff = (now.getTime() - created.getTime()) / (1000 * 60);

          if (minutesDiff > 5) {
            // PENDING por más de 5 minutos, considerar como "colgado" y permitir reintento
            this.logger.logRequest('checkIdempotency', { 
              action: 'stale_pending',
              minutesDiff,
              existingId: existing.id
            });

            return {
              isDuplicate: true,
              shouldProceed: true
            };
          }

          // PENDING reciente, esperar un poco y reintentar
          this.logger.logRequest('checkIdempotency', { 
            action: 'wait_pending',
            minutesDiff,
            existingId: existing.id
          });

          await this.delay(1000);
          return this.checkIdempotency(ptoVta, tipoCbte, nroComprobante, payload);

        default:
          throw new Error(`Estado de comprobante inválido: ${existing.estado}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError('checkIdempotency', error instanceof Error ? error : new Error(errorMessage), {
        ptoVta, tipoCbte, nroComprobante
      });

      return {
        isDuplicate: false,
        shouldProceed: false,
        error: errorMessage
      };
    }
  }

  /**
   * Marca un comprobante como exitoso (APPROVED)
   */
  async markAsApproved(
    ptoVta: number, 
    tipoCbte: number, 
    nroComprobante: number,
    cae: string,
    caeVto: string
  ): Promise<boolean> {
    try {
      this.logger.logRequest('markAsApproved', { ptoVta, tipoCbte, nroComprobante, cae });

      const success = this.db.updateComprobanteControl(ptoVta, tipoCbte, nroComprobante, {
        estado: 'APPROVED',
        cae,
        cae_vencimiento: caeVto
      });

      this.logger.logResponse('markAsApproved', { success });
      return success;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError('markAsApproved', error instanceof Error ? error : new Error(errorMessage), {
        ptoVta, tipoCbte, nroComprobante, cae
      });
      return false;
    }
  }

  /**
   * Marca un comprobante como fallido (FAILED)
   */
  async markAsFailed(
    ptoVta: number, 
    tipoCbte: number, 
    nroComprobante: number,
    errorMsg: string
  ): Promise<boolean> {
    try {
      this.logger.logRequest('markAsFailed', { ptoVta, tipoCbte, nroComprobante, errorMsg });

      const success = this.db.updateComprobanteControl(ptoVta, tipoCbte, nroComprobante, {
        estado: 'FAILED',
        error_msg: errorMsg
      });

      this.logger.logResponse('markAsFailed', { success });
      return success;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError('markAsFailed', error instanceof Error ? error : new Error(errorMessage), {
        ptoVta, tipoCbte, nroComprobante, errorMsg
      });
      return false;
    }
  }

  /**
   * Obtiene estadísticas de comprobantes
   */
  getStats(): { pending: number; approved: number; failed: number } {
    try {
      const pending = this.db.getComprobantesByEstado('PENDING').length;
      const approved = this.db.getComprobantesByEstado('APPROVED').length;
      const failed = this.db.getComprobantesByEstado('FAILED').length;

      return { pending, approved, failed };
    } catch (error) {
      this.logger.logError('getStats', error instanceof Error ? error : new Error(String(error)));
      return { pending: 0, approved: 0, failed: 0 };
    }
  }

  /**
   * Limpia comprobantes antiguos
   */
  cleanup(): number {
    try {
      const cleaned = this.db.cleanupComprobantesAntiguos();
      this.logger.logRequest('cleanup', { cleaned });
      return cleaned;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError('cleanup', error instanceof Error ? error : new Error(errorMessage));
      return 0;
    }
  }

  /**
   * Obtiene comprobantes por estado para debugging
   */
  getComprobantesByEstado(estado: 'PENDING' | 'APPROVED' | 'FAILED'): ComprobanteControl[] {
    try {
      return this.db.getComprobantesByEstado(estado);
    } catch (error) {
      this.logger.logError('getComprobantesByEstado', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Delay helper para manejo de concurrencia
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
