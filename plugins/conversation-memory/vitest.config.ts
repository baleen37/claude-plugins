import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', 'dist', '.git'],
    testTimeout: 15000,
    hookTimeout: 15000,
    poolOptions: {
      threads: {
        maxThreads: 4,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.config.ts',
        'scripts/**',
        'tests/**',
        'src/cli/**', // CLI entry points execute immediately, difficult to test
        '**/test-*.ts', // Test utility files
        'coverage/**', // Coverage output directory
      ],
    },
  },
  resolve: {
    alias: {
      '@': '/Users/jito.hello/dev/wooto/claude-plugins',
    },
  },
})
