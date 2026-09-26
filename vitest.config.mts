import path from 'node:path';
import { defineConfig } from 'vitest/config';

const root = import.meta.dirname;

export default defineConfig({
  test: {
    include: ['engine/**/*.test.ts', 'contract/**/*.test.ts', 'lib/**/*.test.ts', 'app/**/*.test.ts'],
    testTimeout: 120_000,
  },
  resolve: {
    alias: {
      '@': root,
    },
  },
});
