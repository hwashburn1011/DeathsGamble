import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
// `base` is set to '/DeathsGamble/' so GitHub Pages (project site) serves
// asset URLs correctly under https://hwashburn1011.github.io/DeathsGamble/
export default defineConfig({
  plugins: [react()],
  base: '/DeathsGamble/',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});
