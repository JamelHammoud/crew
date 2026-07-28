import { describe, expect, it } from 'vitest'
import { makeCliProvider } from '../src/runner/providers/cli'
import { parseClaudeLine, claudeArgs } from '../src/runner/providers/claude'

describe('real claude cli', () => {
  it('says why it failed', async () => {
    const provider = makeCliProvider({
      name: 'claude',
      label: 'Claude',
      command: 'claude',
      args: (p, get) => claudeArgs(p, k => (k === 'model' ? 'does-not-exist-9000' : get(k))),
      parser: parseClaudeLine,
      streamInput: true
    })
    const run = provider.start('hi', '/Users/jamel/Documents/Repositories/crew', { onStep: () => {} })
    await run.done.then(
      ok => expect.fail(`resolved: ${JSON.stringify(ok)}`),
      err => console.log('REASON >>>', err.message)
    )
  }, 120000)
})
