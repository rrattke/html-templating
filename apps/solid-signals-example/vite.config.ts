import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'bin',
    emptyOutDir: true,
    sourcemap: true
  }
});
