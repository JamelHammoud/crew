import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environmentMatchGlobs: [
      ['**/design-image-paste.test.ts', 'jsdom'],
      ['**/personal-chat-probe.test.ts', 'jsdom'],
      ['**/mail-security.test.ts', 'jsdom'],
      ['**/mail-contact-mark.test.tsx', 'jsdom'],
      ['**/mail-view-probe.test.tsx', 'jsdom'],
      ['**/sticky-editor-probe.test.ts', 'jsdom'],
      ['**/stickies-library-probe.test.ts', 'jsdom'],
      ['**/subagent-message-probe.test.ts', 'jsdom']
    ],
    env: { NODE_ENV: 'test' },
    testTimeout: 60000,
    hookTimeout: 60000,
    poolOptions: { forks: { minForks: 1, maxForks: 4 } }
  }
})
