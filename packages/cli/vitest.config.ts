import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**'],
      exclude: ['src/**/*.test.ts'],
      // CLI commander actions are exercised via subprocess in #13. The text
      // threshold locks in today's helper coverage; raise as full command
      // tests land.
      thresholds: {
        lines: 25,
        statements: 25,
        functions: 30,
        branches: 60,
      },
    },
  },
})
