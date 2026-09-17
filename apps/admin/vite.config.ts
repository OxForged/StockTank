import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_ORIGIN = process.env.VITE_DEV_API_ORIGIN ?? 'http://localhost:4000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5181,
    strictPort: true,
    // Same-origin in dev so the httpOnly session cookie just works.
    proxy: {
      '/api': { target: API_ORIGIN, changeOrigin: true },
      '/health': { target: API_ORIGIN, changeOrigin: true },
      '/ready': { target: API_ORIGIN, changeOrigin: true },
      '/version': { target: API_ORIGIN, changeOrigin: true },
    },
  },
  preview: { port: 5181, strictPort: true },
  build: { sourcemap: true, target: 'es2022' },
});
