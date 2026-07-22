import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(import.meta.dirname, 'web'),
  base: './',
  build: {
    outDir: resolve(import.meta.dirname, '..', 'dist-desktop'),
    emptyOutDir: true,
    target: 'es2022'
  }
});
