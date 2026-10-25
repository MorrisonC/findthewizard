import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: false,
    watch: {
      ignored: ['**/public/audio/**'],
    },
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    sourcemap: true,
  },
});
