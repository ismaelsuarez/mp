import { Afip as BaseAfip } from '../../../sdk/afip.ts-main/src/afip';
import { ElectronicBillingService } from '../../../sdk/afip.ts-main/src/services/electronic-billing.service';
import { RegisterScopeThirteenService } from '../../../sdk/afip.ts-main/src/services/register-scope-thirteen.service';
import type { Context } from '../../../sdk/afip.ts-main/src/types';
import { ElectronicBillingMiPymeService } from './services/wsfecred';

export class Afip {
  private readonly _electronicBillingService: ElectronicBillingService;
  private readonly _registerScopeThirteenService: RegisterScopeThirteenService;
  private readonly _electronicBillingMiPymeService: ElectronicBillingMiPymeService;
  private readonly context: Context;

  constructor(context: Context) {
    // Mantener compatibilidad total con el SDK local y añadir extensiones
    this.context = context;
    this._electronicBillingService = new ElectronicBillingService(this.context);
    this._registerScopeThirteenService = new RegisterScopeThirteenService(this.context);
    this._electronicBillingMiPymeService = new ElectronicBillingMiPymeService(this.context);
  }

  get electronicBillingService(): ElectronicBillingService {
    return this._electronicBillingService;
  }

  get registerScopeThirteenService(): RegisterScopeThirteenService {
    return this._registerScopeThirteenService;
  }

  /** Servicio MiPyME (FCE) */
  get electronicBillingMiPymeService(): ElectronicBillingMiPymeService {
    return this._electronicBillingMiPymeService;
  }

  /** Acceso genérico si fuera requerido por extensiones futuras */
  static fromBase(context: Context): BaseAfip {
    return new BaseAfip(context);
  }
}

export type { Context } from '../../../sdk/afip.ts-main/src/types';

