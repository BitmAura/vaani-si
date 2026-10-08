import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      // Cross-tree relative imports (packages -> apps) do not resolve under
      // this vitest setup; alias the server audio pipeline instead.
      '@server-pipeline': path.resolve(__dirname, 'apps/server/src/audio-pipeline.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    include: ['**/__tests__/**/*.test.ts', '**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
  },
});
