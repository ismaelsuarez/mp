// Mock de afip.js para tests unitarios
export const mockAfipInstance = {
  ElectronicBilling: {
    getVoucherTypes: jest.fn().mockResolvedValue([
      { Id: 1, Desc: 'Factura A' },
      { Id: 6, Desc: 'Factura B' },
      { Id: 11, Desc: 'Factura C' }
    ]),
    
    getConceptTypes: jest.fn().mockResolvedValue([
      { Id: 1, Desc: 'Productos' },
      { Id: 2, Desc: 'Servicios' },
      { Id: 3, Desc: 'Productos y Servicios' }
    ]),
    
    getDocumentTypes: jest.fn().mockResolvedValue([
      { Id: 80, Desc: 'CUIT' },
      { Id: 99, Desc: 'Consumidor Final' }
    ]),
    
    getCurrenciesTypes: jest.fn().mockResolvedValue([
      { Id: 'PES', Desc: 'Pesos Argentinos' },
      { Id: 'USD', Desc: 'Dólar Estadounidense' },
      { Id: 'EUR', Desc: 'Euro' }
    ]),
    
    getSalesPoints: jest.fn().mockResolvedValue([
      { Nro: 1, Desc: 'Punto de Venta 1' },
      { Nro: 2, Desc: 'Punto de Venta 2' }
    ]),
    
    getCurrencyQuotation: jest.fn().mockResolvedValue({
      MonId: 'USD',
      MonCotiz: 1000,
      FchCotiz: '20241219'
    }),
    
    getLastVoucher: jest.fn().mockResolvedValue(1000),
    
    createVoucher: jest.fn().mockResolvedValue({
      CAE: '12345678901234',
      CAEFchVto: '20250131',
      Resultado: 'A'
    }),
    
    getServerStatus: jest.fn().mockResolvedValue({
      AppServer: 'OK',
      DbServer: 'OK',
      AuthServer: 'OK'
    })
  },
  
  WSAA: {
    CreateTRA: jest.fn().mockResolvedValue('TRA_CONTENT'),
    SignTRA: jest.fn().mockResolvedValue('SIGNED_TRA'),
    CallWSAA: jest.fn().mockResolvedValue('TOKEN_CONTENT'),
    CreateTMP: jest.fn().mockResolvedValue('TMP_PATH')
  }
};

// Mock de respuesta AFIP exitosa
export const mockAfipResponse = {
  CAE: '12345678901234',
  CAEFchVto: '20250131',
  Resultado: 'A',
  Reproceso: 'N',
  FchProceso: '20241219',
  PuntoVenta: 1,
  CbteTipo: 6,
  CbteNro: 1001,
  CbteFch: '20241219',
  ImpTotal: 1210.00,
  ImpTotConc: 0.00,
  ImpNeto: 1000.00,
  ImpOpEx: 0.00,
  ImpIVA: 210.00,
  ImpTrib: 0.00,
  MonId: 'PES',
  MonCotiz: 1.00,
  Iva: [
    {
      Id: 5,
      Desc: '21%',
      BaseImp: 1000.00,
      Importe: 210.00
    }
  ]
};

// Mock de respuesta AFIP con error
export const mockAfipError = {
  Errors: [
    {
      Code: 1001,
      Msg: 'Error de validación'
    }
  ],
  Events: [],
  Resultado: 'R'
};

// Mock de TimeValidator
export const mockTimeValidator = {
  validateSystemTime: jest.fn().mockResolvedValue({
    isValid: true,
    drift: 1500,
    systemTime: new Date('2024-12-19T10:30:00.000Z'),
    ntpTime: new Date('2024-12-19T10:30:01.500Z'),
    duration: 245
  }),
  
  getStats: jest.fn().mockReturnValue({
    totalValidations: 150,
    averageDrift: 1200,
    lastValidation: {
      isValid: true,
      drift: 1500,
      timestamp: new Date()
    }
  }),
  
  getStatus: jest.fn().mockReturnValue({
    isConfigured: true,
    lastValidationTime: new Date(),
    isLastValidationValid: true,
    lastDrift: 1500
  })
};

// Mock de IdempotencyManager
export const mockIdempotencyManager = {
  checkIdempotency: jest.fn().mockResolvedValue({
    isDuplicate: false,
    shouldProceed: true,
    existingCae: null,
    existingCaeVto: null,
    error: null
  }),
  
  markAsApproved: jest.fn().mockResolvedValue(true),
  markAsFailed: jest.fn().mockResolvedValue(true),
  
  getStats: jest.fn().mockReturnValue({
    pending: 2,
    approved: 145,
    failed: 3
  }),
  
  cleanup: jest.fn().mockReturnValue(5),
  
  getComprobantesByEstado: jest.fn().mockReturnValue([])
};

// Mock de ResilienceWrapper
export const mockResilienceWrapper = {
  execute: jest.fn().mockImplementation(async (operation, name) => {
    return await operation();
  }),
  
  getStats: jest.fn().mockReturnValue({
    totalRequests: 150,
    successCount: 147,
    failureCount: 3,
    successRate: 0.98,
    averageResponseTime: 245
  }),
  
  getCircuitBreakerState: jest.fn().mockReturnValue('CLOSED'),
  
  getCircuitBreakerStats: jest.fn().mockReturnValue({
    state: 'CLOSED',
    failureCount: 0,
    successCount: 147,
    threshold: 5,
    timeout: 60000
  }),
  
  forceCloseCircuitBreaker: jest.fn(),
  forceOpenCircuitBreaker: jest.fn(),
  resetStats: jest.fn(),
  getTimeUntilNextAttempt: jest.fn().mockReturnValue(0),
  isReadyForHalfOpen: jest.fn().mockReturnValue(false)
};

// Mock de CAEValidator
export const mockCAEValidator = {
  validateBeforeOperation: jest.fn(),
  validateBeforeOperationByComprobante: jest.fn(),
  getCAEStatusFromFactura: jest.fn().mockReturnValue({
    isValid: true,
    isExpired: false,
    daysUntilExpiration: 30
  }),
  getCAEStatusFromComprobante: jest.fn().mockReturnValue({
    isValid: true,
    isExpired: false,
    daysUntilExpiration: 30
  }),
  findFacturasWithExpiringCAE: jest.fn().mockReturnValue([]),
  findFacturasWithExpiredCAE: jest.fn().mockReturnValue([])
};

// Mock de ProvinciaManager
export const mockProvinciaManager = {
  procesarComprobante: jest.fn().mockResolvedValue({
    afip: {
      success: true,
      cae: '12345678901234',
      vencimiento: '20250131'
    },
    provincial: {
      success: true,
      servicio: 'ATM',
      numero: 'ATM123456'
    },
    estado: 'AFIP_OK_PROV_OK'
  }),
  
  getConfiguracion: jest.fn().mockReturnValue({
    mendoza: {
      enabled: true,
      service: 'ATMService',
      endpoint: 'https://atm.mendoza.gov.ar/ws'
    }
  }),
  
  actualizarConfiguracion: jest.fn(),
  getEstadisticas: jest.fn().mockResolvedValue({
    totalProcesados: 50,
    exitosos: 48,
    fallidos: 2
  })
};

// Mock de Database
export const mockDatabase = {
  prepare: jest.fn().mockReturnValue({
    run: jest.fn().mockReturnValue({ lastInsertRowid: 1 }),
    get: jest.fn().mockReturnValue(null),
    all: jest.fn().mockReturnValue([])
  }),
  
  exec: jest.fn(),
  close: jest.fn()
};

// Mock de ntp-client
export const mockNtpClient = {
  getNetworkTime: jest.fn().mockImplementation((server, port, callback) => {
    setTimeout(() => {
      callback(null, new Date('2024-12-19T10:30:01.500Z'));
    }, 100);
  })
};
