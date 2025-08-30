/*
 * Gestiona el ciclo de vida de la instancia de Afip con caché de TA.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const loadAfip = () => require('@afipsdk/afip.js');

export type AfipSdkCtor = new (opts: { CUIT: number; production: boolean; cert: string; key: string }) => any;

export class AfipInstanceManager {
  private afipInstance: any | null = null;
  private taExpirationTime: number | null = null;
  private readonly taRefreshThresholdMs = 9 * 60 * 60 * 1000; // 9 horas
  private creatingPromise: Promise<any> | null = null;

  constructor(private readonly optsProvider: () => { cuit: number; production: boolean; cert: string; key: string }) {}

  /** Limpia la instancia y fuerza relogin WSAA en próximo uso */
  clearCache(): void {
    this.afipInstance = null;
    this.taExpirationTime = null;
  }

  /** Devuelve instancia válida; renueva si no existe o TA expiró/próximo a expirar. Thread-safe. */
  async getInstance(): Promise<any> {
    const now = Date.now();
    if (this.afipInstance && this.taExpirationTime && now < this.taExpirationTime) {
      return this.afipInstance;
    }

    if (this.creatingPromise) return this.creatingPromise;

    this.creatingPromise = (async () => {
      const Afip: AfipSdkCtor = loadAfip();
      const { cuit, production, cert, key } = this.optsProvider();
      // Crear nueva instancia
      const instance = new Afip({ CUIT: cuit, production, cert, key });
      // Trigger de autenticación temprana (opcional): una llamada barata
      try {
        await instance.ElectronicBilling.getServerStatus();
      } catch {}
      // Estimación de expiración de TA: ~10 hs; refrescamos a las 9 hs
      this.afipInstance = instance;
      this.taExpirationTime = Date.now() + this.taRefreshThresholdMs;
      this.creatingPromise = null;
      return instance;
    })();

    return this.creatingPromise;
  }
}


