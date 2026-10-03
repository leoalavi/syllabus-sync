import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  root: projectRoot,
  plugins: [tsconfigPaths({ root: projectRoot }), react()],
  resolve: {
    alias: [{ find: /^@\/(.*)/, replacement: path.join(projectRoot, '$1') }],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}', 'app/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        '**/node_modules/**',
        '**/.next/**',
        '**/dist/**',

        // Tests and generated output
        'tests/**',
        'coverage/**',

        // Types and config files
        '**/*.d.ts',
        '**/*.config.{ts,js,mjs}',
        '**/types/**',

        // Public assets and scripts
        'public/**',
        'scripts/**',
        'data/**',
        'locales/**',

        // Specific files you already excluded
        'sentry.*.config.ts',
        'app/api/_lib/versioning.ts',
        'app/api/_lib/middleware.ts',

        // ✅ Exclude heavy UI from global coverage
        'components/**',
        'features/**/components/**',
      ],
      thresholds: {
        statements: 50,
        branches: 39,
        functions: 50,
        lines: 50,
      },
    },
  },
});
