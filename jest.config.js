module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  
  // Configuración de TypeScript - CORREGIDA
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  
  // Configuración de cobertura
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['html', 'json', 'text', 'lcov'],
  
  // Archivos a incluir en cobertura
  collectCoverageFrom: [
    'src/modules/facturacion/**/*.ts',
    '!src/modules/facturacion/**/*.d.ts',
    '!src/modules/facturacion/__tests__/**'
  ],
  
  // Setup
  setupFilesAfterEnv: ['<rootDir>/src/modules/facturacion/__tests__/setup.ts'],
  
  // Timeout
  testTimeout: 30000,
  
  // Reportes
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/html-report',
        filename: 'report.html'
      }
    ]
  ]
};
