import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts',
      'packages/**/*.test.ts'
    ],
    exclude: [
      'node_modules',
      'dist',
      'coverage',
      'build',
      'sdk/**/*.test.ts' // SDK AFIP usa Jest, no Vitest
    ],
    globals: true,
    threads: false,
    hookTimeout: 30000,
    testTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules',
        'dist',
        'coverage',
        'tests',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        '**/__tests__/**',
        '**/__mocks__/**',
        'scripts/**'
      ],
      include: [
        'src/**/*.ts',
        'packages/**/*.ts',
        'apps/**/*.ts'
      ],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80
    }
  },
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './packages/core/src'),
      '@infra': path.resolve(__dirname, './packages/infra/src'),
      '@shared': path.resolve(__dirname, './packages/shared/src'),
      '@electron': path.resolve(__dirname, './apps/electron/src'),
      'afip-local': path.resolve(__dirname, './sdk/afip.ts-main/src'),
      'src': path.resolve(__dirname, './src'),
      // Mock de Electron para tests (no requiere Electron runtime)
      'electron': path.resolve(__dirname, './tests/mocks/electron.ts')
    }
  }
});
