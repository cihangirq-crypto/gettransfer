import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['e2e/**', 'dist/**', 'node_modules/**'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})

