import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@meghai/shared-types': path.resolve(__dirname, 'packages/shared-types/src/index.ts'),
      '@meghai/security': path.resolve(__dirname, 'packages/security/src/index.ts'),
      '@meghai/permissions': path.resolve(__dirname, 'packages/permissions/src/index.ts'),
      '@meghai/risk-engine': path.resolve(__dirname, 'packages/risk-engine/src/index.ts'),
      '@meghai/verification': path.resolve(__dirname, 'packages/verification/src/index.ts'),
      '@meghai/tool-registry': path.resolve(__dirname, 'packages/tool-registry/src/index.ts'),
      '@meghai/tool-runtime': path.resolve(__dirname, 'packages/tool-runtime/src/index.ts'),
      '@meghai/database': path.resolve(__dirname, 'packages/database/src/index.ts'),
      '@meghai/events': path.resolve(__dirname, 'packages/events/src/index.ts'),
      '@meghai/ai-core': path.resolve(__dirname, 'packages/ai-core/src/index.ts'),
      '@meghai/model-router': path.resolve(__dirname, 'packages/model-router/src/index.ts'),
      '@meghai/memory': path.resolve(__dirname, 'packages/memory/src/index.ts'),
      '@meghai/windows': path.resolve(__dirname, 'packages/windows/src/index.ts')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'packages/**/*.test.ts', 'apps/**/*.test.ts']
  }
});
