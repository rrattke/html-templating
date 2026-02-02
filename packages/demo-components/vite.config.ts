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
        counter: path.resolve(dirname, 'src/counter.ts'),
        list: path.resolve(dirname, 'src/list.ts'),
        'todo-list': path.resolve(dirname, 'src/todo-list.ts'),
        'data-table': path.resolve(dirname, 'src/data-table.ts')
      },
      formats: ['es']
    },
    outDir: 'lib',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      external: ['@vanishing/framework', '@vanishing/framework/template', '@vanishing/framework/wc', '@vanishing/framework/reactive'],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
        assetFileNames: '[name][extname]'
      }
    }
  },
  plugins: [
    dts({
      tsconfigPath: path.resolve(dirname, 'tsconfig.json'),
      outDir: 'lib',
      insertTypesEntry: true,
      rollupTypes: false
    })
  ]
});
