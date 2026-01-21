import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  esbuild: {
    target: 'es2022',
    keepNames: true
  },
  build: {
    lib: {
      entry: {
        index: path.resolve(dirname, 'src/index.ts'),
        reactive: path.resolve(dirname, 'src/reactive.ts'),
        runtime: path.resolve(dirname, 'src/runtime.ts'),
        template: path.resolve(dirname, 'src/template.ts'),
        wc: path.resolve(dirname, 'src/wc.ts')
      },
      formats: ['es']
    },
    outDir: 'lib',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js'
      }
    }
  },
  plugins: [
    dts({
      tsconfigPath: path.resolve(dirname, 'tsconfig.json'),
      outDir: 'lib',
      insertTypesEntry: true,
      exclude: ['**/*.spec.ts', '**/*.test.ts'],
      rollupTypes: false
    })
  ]
});
