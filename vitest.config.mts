/// <reference types="vitest" />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  plugins: [angular({ jit: true, tsconfig: './tsconfig.spec.json' })],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    pool: 'forks',
    minWorkers: process.env['CI'] ? 1 : undefined,
    maxWorkers: process.env['CI'] ? 1 : undefined,
    server: {
      deps: {
        inline: [/@angular/, /@ionic/, /@testing-library/, /@analogjs/, /ionicons/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/app/**/*.ts', 'src/environments/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/test-setup.ts',
        'src/test-polyfills.ts',
        'src/mocks/**',
        'src/**/*.spec.ts',
        'src/**/*.routes.ts',
        'node_modules/**',
        'public/**',
        'www/**',
        'coverage/**',
        '.angular/**',
        '**/*.config.ts',
      ],
    },
  },
  define: {
    'import.meta.vitest': mode !== 'production',
  },
}));
