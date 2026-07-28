import { describe, expect, it } from 'vitest'
import { claudeProvider } from '../src/runner/providers/claude'

describe('real claude cli', () => {
  it('says why it failed', async () => {
    const run = claudeProvider.start('hi', '/Users/jamel/Documents/Repositories/crew', { onStep: () => {} }, { model: 'does-not-exist-9000' })
    await expect(run.done).rejects.toThrow(/model/i)
  }, 120000)
})
