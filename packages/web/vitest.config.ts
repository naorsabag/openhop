import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**'],
      exclude: [
        'src/**/*.test.ts',
        'src/main.tsx',
        'src/lib/analytics.ts',
        'src/types.ts',
        'src/globals.d.ts',
      ],
      // Web is canvas/React Flow-heavy; component tests are deferred. These
      // thresholds lock the Vitest 4 V8-provider baseline.
      thresholds: {
        lines: 22,
        statements: 22,
        functions: 16,
        branches: 19,
      },
    },
  },
})
