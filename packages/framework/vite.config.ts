import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(dirname, 'src/index.ts'),
      formats: ['es']
    },
    outDir: 'lib',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2020',
    rollupOptions: {
      output: {
        entryFileNames: 'index.js'
      }
    }
  },
  plugins: [
    dts({
      tsconfigPath: path.resolve(dirname, 'tsconfig.json'),
      outDir: 'lib',
      insertTypesEntry: true
    })
  ]
});
