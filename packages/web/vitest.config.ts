import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/main.tsx', 'src/types.ts', 'src/globals.d.ts'],
      // Web is canvas/PIXI-heavy; component tests are deferred. The threshold
      // locks in today's baseline (~19% lines via lib/flow-layout.ts coverage)
      // — raise it as more components/hooks get tested.
      thresholds: {
        lines: 18,
        statements: 18,
        functions: 50,
        branches: 60,
      },
    },
  },
})
