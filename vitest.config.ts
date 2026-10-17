import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@vanni/database': path.resolve(__dirname, 'packages/database/src/index.ts'),
      '@vanni/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@vanni/billing': path.resolve(__dirname, 'packages/billing/src/index.ts'),
      '@vanni/auth': path.resolve(__dirname, 'packages/auth/src/index.ts'),
      '@vanni/providers': path.resolve(__dirname, 'packages/providers/src/index.ts'),
      '@vanni/provider-sdk': path.resolve(__dirname, 'packages/provider-sdk/src/index.ts'),
      '@vanni/voice-engine': path.resolve(__dirname, 'packages/voice-engine/src/index.ts'),
      '@vanni/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
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
