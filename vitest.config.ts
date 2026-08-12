import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: { NODE_ENV: 'test' },
    testTimeout: 30000,
    hookTimeout: 30000,
    poolOptions: { forks: { minForks: 1, maxForks: 4 } }
  }
})
