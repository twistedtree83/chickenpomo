import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the build under https://<user>.github.io/chickenpomo/,
// so all asset URLs must be prefixed with that path. Asset references in
// source go through import.meta.env.BASE_URL, which Vite swaps to this value.
export default defineConfig({
  base: '/chickenpomo/',
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['srv1470348', '.ts.net'],
  },
  preview: {
    host: true,
    allowedHosts: ['srv1470348', '.ts.net'],
  },
});
