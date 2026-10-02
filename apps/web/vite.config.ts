import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@meghai/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      '@meghai/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
    },
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:4820',
        changeOrigin: true,
      },
      '/events': {
        target: 'http://localhost:4820',
        changeOrigin: true,
      },
    },
  },
});
