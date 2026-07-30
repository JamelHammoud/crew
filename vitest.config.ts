import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: { NODE_ENV: 'test' },
    transformMode: { ssr: [/tests\/pdf-[\w-]+\.test\.ts$/] },
    testTimeout: 30000,
    hookTimeout: 30000
  }
})
