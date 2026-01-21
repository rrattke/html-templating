import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = fileURLToPath(new URL('.', import.meta.url));

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
  },
  optimizeDeps: {
    // Exclude workspace packages from pre-bundling to enable HMR
    exclude: ['@vanishing/framework', '@demo/components']
  }
});
