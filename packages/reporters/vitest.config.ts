import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    extensions: ['.ts', '.js', '.mjs', '.cjs', '.json'],
  },
})
