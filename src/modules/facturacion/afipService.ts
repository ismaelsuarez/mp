import { DatosAFIP, Comprobante, TipoComprobante, ServerStatus, CertificadoInfo } from './types';
import { getDb } from '../../services/DbService';
import { AfipLogger } from './afip/AfipLogger';
import { CertificateValidator } from './afip/CertificateValidator';
import { AfipHelpers } from './afip/helpers';

// Carga diferida del SDK para evitar crash si falta
function loadAfip() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('afip.js');
  } catch (e) {
    throw new Error('SDK AFIP no instalado. Instala "afip.js" o indica el SDK a usar.');
  }
}

class AfipService {
  private afipInstance: any = null;
  private logger: AfipLogger;

  constructor() {
    this.logger = new AfipLogger();
  }

  /**
   * Obtiene una instancia de AFIP configurada
   */
  private async getAfipInstance(): Promise<any> {
    if (this.afipInstance) {
      return this.afipInstance;
    }

    const cfg = getDb().getAfipConfig();
    if (!cfg) {
      throw new Error('Falta configurar AFIP en Administración');
    }

    // Validar certificado antes de crear instancia
    const certInfo = CertificateValidator.validateCertificate(cfg.cert_path);
    if (!certInfo.valido) {
      throw new Error(`Certificado inválido: ${certInfo.error}`);
    }

    const Afip = loadAfip();
    this.afipInstance = new Afip({
      CUIT: Number(cfg.cuit),
      production: cfg.entorno === 'produccion',
      cert: cfg.cert_path,
      key: cfg.key_path
    });

    return this.afipInstance;
  }

  /**
   * Solicita CAE para un comprobante
   */
  async solicitarCAE(comprobante: Comprobante): Promise<DatosAFIP> {
    try {
      // Validar comprobante
      const errors = AfipHelpers.validateComprobante(comprobante);
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      const afip = await this.getAfipInstance();
      const cfg = getDb().getAfipConfig()!;
      
      const ptoVta = cfg.pto_vta || comprobante.puntoVenta;
      const tipoCbte = AfipHelpers.mapTipoCbte(comprobante.tipo);

      // Obtener último número autorizado
      this.logger.logRequest('getLastVoucher', { ptoVta, tipoCbte });
      const last = await afip.ElectronicBilling.getLastVoucher(ptoVta, tipoCbte);
      this.logger.logResponse('getLastVoucher', { last });
      
      const numero = Number(last) + 1;

      // Construir array de IVA
      const ivaArray = AfipHelpers.buildIvaArray(comprobante.items);

      // Construir request para AFIP
      const request = {
        CantReg: 1,
        PtoVta: ptoVta,
        CbteTipo: tipoCbte,
        Concepto: 1,
        DocTipo: 99,
        DocNro: 0,
        CbteDesde: numero,
        CbteHasta: numero,
        CbteFch: comprobante.fecha,
        ImpTotal: AfipHelpers.formatNumber(comprobante.totales.total),
        ImpTotConc: 0,
        ImpNeto: AfipHelpers.formatNumber(comprobante.totales.neto),
        ImpOpEx: 0,
        ImpIVA: AfipHelpers.formatNumber(comprobante.totales.iva),
        ImpTrib: 0,
        MonId: 'PES',
        MonCotiz: 1,
        Iva: ivaArray
      };

      // Log request
      this.logger.logRequest('createVoucher', request);

      // Solicitar CAE
      const response = await afip.ElectronicBilling.createVoucher(request);
      
      // Log response
      this.logger.logResponse('createVoucher', response);

      const cae: string = response.CAE;
      const caeVto: string = response.CAEFchVto;

      // Construir QR
      const qrData = AfipHelpers.buildQrUrl({
        cuit: Number(cfg.cuit),
        ptoVta,
        tipoCmp: tipoCbte,
        nroCmp: numero,
        importe: comprobante.totales.total,
        fecha: comprobante.fecha,
        cae
      });

      return { cae, vencimientoCAE: caeVto, qrData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError('solicitarCAE', error instanceof Error ? error : new Error(errorMessage), { comprobante });
      throw new Error(`Error solicitando CAE: ${errorMessage}`);
    }
  }

  /**
   * Verifica el estado de los servidores de AFIP
   */
  async checkServerStatus(): Promise<ServerStatus> {
    try {
      const afip = await this.getAfipInstance();
      
      this.logger.logRequest('getServerStatus', {});
      const status = await afip.ElectronicBilling.getServerStatus();
      this.logger.logResponse('getServerStatus', status);

      return {
        appserver: status.AppServer,
        dbserver: status.DbServer,
        authserver: status.AuthServer
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError('checkServerStatus', error instanceof Error ? error : new Error(errorMessage));
      throw new Error(`Error verificando estado de servidores: ${errorMessage}`);
    }
  }

  /**
   * Valida el certificado configurado
   */
  validarCertificado(): CertificadoInfo {
    try {
      const cfg = getDb().getAfipConfig();
      if (!cfg) {
        return {
          valido: false,
          fechaExpiracion: new Date(),
          diasRestantes: 0,
          error: 'No hay configuración AFIP'
        };
      }

      return CertificateValidator.validateCertificate(cfg.cert_path);

    } catch (error) {
      return {
        valido: false,
        fechaExpiracion: new Date(),
        diasRestantes: 0,
        error: `Error validando certificado: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Obtiene el último número autorizado para un punto de venta y tipo
   */
  async getUltimoAutorizado(puntoVenta: number, tipoComprobante: TipoComprobante): Promise<number> {
    try {
      const afip = await this.getAfipInstance();
      const tipoCbte = AfipHelpers.mapTipoCbte(tipoComprobante);

      this.logger.logRequest('getLastVoucher', { puntoVenta, tipoCbte });
      const last = await afip.ElectronicBilling.getLastVoucher(puntoVenta, tipoCbte);
      this.logger.logResponse('getLastVoucher', { last });

      return Number(last);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError('getUltimoAutorizado', error instanceof Error ? error : new Error(errorMessage), { puntoVenta, tipoComprobante });
      throw new Error(`Error obteniendo último autorizado: ${errorMessage}`);
    }
  }

  /**
   * Obtiene los logs de AFIP para una fecha específica
   */
  getLogs(date?: string) {
    return this.logger.getLogs(date);
  }

  /**
   * Limpia la instancia de AFIP (útil para testing)
   */
  clearInstance(): void {
    this.afipInstance = null;
  }
}

// Exportar instancia singleton
export const afipService = new AfipService();

// Exportar función legacy para compatibilidad
export async function solicitarCAE(comprobante: Comprobante): Promise<DatosAFIP> {
  return afipService.solicitarCAE(comprobante);
}


