module.exports = {
  // Configuración básica
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).ts',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Configuración de TypeScript
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      diagnostics: {
        ignoreCodes: [1343]
      },
      astTransformers: {
        before: [
          {
            path: 'ts-jest/dist/transformers/path-mapping',
            options: { tsconfig: 'tsconfig.json' }
          }
        ]
      }
    }]
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  
  // Configuración de cobertura
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['html', 'json', 'text', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // Archivos a incluir/excluir de cobertura
  collectCoverageFrom: [
    'src/modules/facturacion/**/*.ts',
    '!src/modules/facturacion/**/*.d.ts',
    '!src/modules/facturacion/__tests__/**',
    '!src/modules/facturacion/**/index.ts',
    '!src/modules/facturacion/afipService.ts',
    '!src/modules/facturacion/afip/AfipLogger.ts',
    '!src/modules/facturacion/afip/config.ts',
    '!src/modules/facturacion/afip/CertificateValidator.ts',
    '!src/modules/facturacion/afip/CAEValidator.ts',
    '!src/modules/facturacion/afip/helpers.ts',
    '!src/modules/facturacion/afip/validateCAE.ts',
    '!src/modules/facturacion/provincia/**/*.ts',
    '!src/modules/facturacion/utils/TimeScheduler.ts'
  ],
  
  // Setup y teardown
  setupFilesAfterEnv: ['<rootDir>/src/modules/facturacion/__tests__/setup.ts'],
  
  // Variables de entorno para tests
  setupFiles: ['<rootDir>/src/modules/facturacion/__tests__/env-setup.ts'],
  
  // Configuración de mocks
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Timeout para tests
  testTimeout: 30000,
  
  // Configuración para tests de integración
  testSequencer: '<rootDir>/src/modules/facturacion/__tests__/test-sequencer.js',
  
  // Configuración para tests de homologación
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/modules/facturacion/__tests__/unit/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/modules/facturacion/__tests__/setup.ts']
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/src/modules/facturacion/__tests__/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/modules/facturacion/__tests__/setup-integration.ts'],
      testTimeout: 60000
    },
    {
      displayName: 'homologacion',
      testMatch: ['<rootDir>/src/modules/facturacion/__tests__/homologacion/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/modules/facturacion/__tests__/setup-homologacion.ts'],
      testTimeout: 120000
    }
  ],
  
  // Configuración de reportes
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/html-report',
        filename: 'report.html',
        expand: true
      }
    ]
  ],
  
  // Configuración de verbose
  verbose: true,
  
  // Configuración de cache
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // Configuración de clearMocks
  clearMocks: true,
  restoreMocks: true,
  
  // Configuración de globals
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      diagnostics: {
        ignoreCodes: [1343]
      }
    }
  }
};
