/// <reference types="vitest/config" />
import { copyFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * GitHub Pages serves static files with no rewrite, so a direct load of /u/<handle> or
 * /shared/... would 404. Serving the app itself as the 404 page makes those paths work and
 * keeps the shared URL in the address bar — no redirect, nothing to restore.
 */
const appAs404 = () => ({
  name: 'app-as-404',
  closeBundle() {
    const dist = fileURLToPath(new URL('./dist', import.meta.url));
    copyFileSync(`${dist}/index.html`, `${dist}/404.html`);
  },
});

export default defineConfig({
  // GitHub Pages serves the app from /my-world/, see .github/workflows/deploy.yml
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), appAs404()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@use "@/styles/helpers" as *;\n',
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 3001,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 3001,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
