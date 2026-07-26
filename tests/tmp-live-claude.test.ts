import { describe, expect, it } from 'vitest'
import { claudeProvider } from '../src/runner/providers/claude'
import type { RunStep } from '../src/shared/llm'

describe('live claude', () => {
  it('streams real thinking', async () => {
    const steps: RunStep[] = []
    const run = claudeProvider.start(
      'Think hard about whether 91 is prime, reason it out fully, then answer in one word.',
      '/tmp/crew-think-probe',
      { onStep: step => steps.push({ ...step, ts: Date.now() } as RunStep) },
      { model: 'opus', opusModel: 'claude-opus-5', effort: 'high' }
    )
    await run.done

    const thinking = steps.filter(s => s.kind === 'thinking')
    const running = thinking.filter(s => s.status === 'running' && s.text)
    console.log('thinking steps:', thinking.length, 'with text:', running.length)
    console.log('ids:', [...new Set(thinking.map(s => s.id))].join(','))
    console.log('joined:', running.map(s => s.text).join(''))
    expect(running.length).toBeGreaterThan(0)
    expect(running.map(s => s.text).join('').length).toBeGreaterThan(40)
  }, 240000)
})
