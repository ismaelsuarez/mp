import { AfipService } from '../../../../sdk/afip.ts-main/src/services/afip.service';
import { Context, ICreateVoucherResult, IVoucher } from '../../../../sdk/afip.ts-main/src/types';
import { ServiceNamesEnum } from '../../../../sdk/afip.ts-main/src/soap/service-names.enum';
import { WsdlPathEnum } from '../../../../sdk/afip.ts-main/src/soap/wsdl-path.enum';
import { EndpointsEnum } from '../../../../sdk/afip.ts-main/src/enums';

// Tipos SOAP parciales necesarios para WSFECRED
type WsfeCredClient = any;

export type MipymeModoFin = 'ADC' | 'SCA';

/**
 * Servicio de Factura de Crédito MiPyME (WSFECRED / FCE)
 * Nota: Dependiendo de la implementación AFIP, puede convivir con WSFEv1.
 */
export class ElectronicBillingMiPymeService extends AfipService<WsfeCredClient> {
  constructor(context: Context) {
    // No hay enumeraciones en el SDK para WSFECRED, configuramos explícitamente.
    super(context, {
      url: EndpointsEnum.WSFEV1, // Algunos despliegues exponen el mismo endpoint con métodos FCE
      url_test: EndpointsEnum.WSFEV1_TEST,
      wsdl: WsdlPathEnum.WSFE,
      wsdl_test: WsdlPathEnum.WSFE_TEST,
      serviceName: ServiceNamesEnum.WSFE,
      v12: true,
    } as any);
  }

  /** Último comprobante FCE */
  async getLastVoucherMiPyme(ptoVta: number, cbteTipo: number) {
    const client = await this.getClient();
    const [output] = await client.FECompUltimoAutorizadoAsync({ PtoVta: ptoVta, CbteTipo: cbteTipo });
    return output.FECompUltimoAutorizadoResult;
  }

  /** Crea comprobante FCE. Requiere campo adicional ModoFin en Opcionales. */
  async createVoucherMiPyme(req: IVoucher & { ModoFin?: MipymeModoFin }): Promise<ICreateVoucherResult> {
    const client = await this.getClient();
    const opcionales = Array.isArray(req.Opcionales) ? [...req.Opcionales] : [];
    if (req.ModoFin) {
      // Id de opcional de ejemplo para modo de financiación FCE (debería mapearse según especificación)
      opcionales.push({ Id: '2101', Valor: req.ModoFin });
    }

    const [output] = await client.FECAESolicitarAsync({
      FeCAEReq: {
        FeCabReq: { CantReg: 1, PtoVta: req.PtoVta, CbteTipo: req.CbteTipo },
        FeDetReq: {
          FECAEDetRequest: [
            {
              ...req,
              Opcionales: opcionales.length ? { Opcional: opcionales } : undefined,
              Tributos: req.Tributos ? { Tributo: req.Tributos } : undefined,
              Iva: req.Iva ? { AlicIva: req.Iva } : undefined,
              CbtesAsoc: req.CbtesAsoc ? { CbteAsoc: req.CbtesAsoc } : undefined,
              Compradores: req.Compradores ? { Comprador: req.Compradores } : undefined,
            },
          ],
        },
      },
    });

    const { FECAESolicitarResult } = output;
    return {
      response: FECAESolicitarResult,
      cae: FECAESolicitarResult.FeDetResp?.FECAEDetResponse?.[0]?.CAE,
      caeFchVto: FECAESolicitarResult.FeDetResp?.FECAEDetResponse?.[0]?.CAEFchVto,
    };
  }
}


