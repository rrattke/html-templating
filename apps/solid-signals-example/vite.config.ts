import { defineConfig } from 'vite';

export default defineConfig({
  esbuild: {
    target: 'es2022',
    keepNames: true
  },
  build: {
    outDir: 'bin',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    minify: false
  }
});
