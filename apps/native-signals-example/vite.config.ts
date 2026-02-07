import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: mode === 'development' ? {
      '@demo/components': path.resolve(dirname, '../../packages/demo-components/src/index.ts'),
      '@demo/components/counter': path.resolve(dirname, '../../packages/demo-components/src/counter.ts'),
      '@demo/components/list': path.resolve(dirname, '../../packages/demo-components/src/list.ts'),
      '@demo/components/todo-list': path.resolve(dirname, '../../packages/demo-components/src/todo-list.ts'),
      '@demo/components/data-table': path.resolve(dirname, '../../packages/demo-components/src/data-table.ts')
    } : undefined
  },
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
}));
