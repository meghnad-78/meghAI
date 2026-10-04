import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@meghai\/(.*)$/,
        replacement: path.resolve(__dirname, 'packages/$1/src/index.ts')
      }
    ]
  },
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 20000,
    include: ['tests/**/*.test.ts', 'packages/**/*.test.ts', 'apps/**/*.test.ts']
  }
});
