import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: { NODE_ENV: 'test' },
    testTimeout: 60000,
    hookTimeout: 60000,
    poolOptions: { forks: { minForks: 1, maxForks: 4 } }
  }
})
