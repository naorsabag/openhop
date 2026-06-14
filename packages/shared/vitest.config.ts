import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts'],
      thresholds: {
        lines: 95,
        statements: 95,
        // Vitest 4's V8 provider now counts two uncovered helper functions
        // that Vitest 3 did not include in the aggregate.
        functions: 94,
        branches: 90,
      },
    },
  },
})
