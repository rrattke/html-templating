import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // Only run .spec.ts files as tests, exclude .test.ts utility files
    include: ['**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/*.test.ts']
  }
});
