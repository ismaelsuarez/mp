import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    globals: true,
    threads: false,
    hookTimeout: 30000,
    testTimeout: 60000,
  },
  resolve: {
    alias: {
      'src': __dirname + '/src',
    }
  }
});


