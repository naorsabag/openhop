import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**'],
      // index.ts is the bootstrap (Fastify.listen at module load); not unit-testable.
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      // Vitest 4's V8 provider accounts for uncovered branches/functions more
      // strictly than Vitest 3. Keep the gate at the current measured baseline.
      thresholds: {
        lines: 84,
        statements: 84,
        functions: 87,
        branches: 65,
      },
    },
  },
})
