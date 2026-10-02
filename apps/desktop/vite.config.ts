import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@meghai/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts')
    }
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4820',
        changeOrigin: true
      }
    }
  }
});
