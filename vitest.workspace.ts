import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    test: {
      name: 'integration',
      include: ['tests/**/*.integration.test.ts'],
      env: { NODE_ENV: 'test' },
      testTimeout: 60000,
      hookTimeout: 60000,
      poolOptions: { forks: { minForks: 1, maxForks: 2 } }
    }
  },
  {
    test: {
      name: 'unit',
      include: ['tests/**/*.test.ts'],
      exclude: ['tests/**/*.integration.test.ts'],
      env: { NODE_ENV: 'test' },
      testTimeout: 30000,
      hookTimeout: 30000
    }
  }
])
