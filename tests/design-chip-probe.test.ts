import { describe, expect, it } from 'vitest'
import type { AgentStep } from '../src/shared/llm'
import type { SessionEvent } from '../src/shared/events'
import { buildThread } from '../src/renderer/src/components/thread'

const run: SessionEvent = {
  id: 'run',
  ts: 1,
  kind: 'agent.start',
  promptId: 'prompt',
  agentId: 'agent',
  agentLabel: 'Bubbles',
  promptText: 'draw it',
  byName: 'Jamel',
  threadId: 'thread'
}

const step = (id: string, detail: string): AgentStep => ({
  id,
  ts: 2,
  kind: 'tool',
  status: 'done',
  name: 'Bash',
  detail
})

describe('design API work in a thread', () => {
  it('turns local board reads and edits into design primitives', () => {
    const steps = {
      prompt: [
        step('read', 'curl -s http://127.0.0.1:59206/6329c2/design/landing-1abc'),
        step(
          'edit',
          `curl -s -X POST http://localhost:59206/6329c2/design/landing-1abc/ops -H 'content-type: application/json'`
        ),
        step(
          'direct-pipe',
          'curl -s http://127.0.0.1:2739/design/untitled-4lus | python3 -c \'import json,sys\''
        ),
        step('quoted-query', "wget -qO- 'http://[::1]:2739/design/other-2abc?fresh=1'")
      ]
    }

    expect(buildThread([run], steps, 'jamel').map(item => item.design)).toEqual([
      { boardId: 'landing-1abc', action: 'read' },
      { boardId: 'landing-1abc', action: 'edit' },
      { boardId: 'untitled-4lus', action: 'read' },
      { boardId: 'other-2abc', action: 'read' }
    ])
  })

  it('leaves external and unrelated curl calls as shell steps', () => {
    const steps = {
      prompt: [
        step('external', 'curl -s https://example.com/6329c2/design/landing-1abc'),
        step('other', 'curl -s http://127.0.0.1:59206/6329c2/files/landing-1abc'),
        step('nested', 'curl -s http://127.0.0.1:59206/a/b/design/landing-1abc'),
        step('near-miss', 'curl -s http://127.0.0.1:59206/design/landing-1abc/export')
      ]
    }

    const items = buildThread([run], steps, 'jamel')
    expect(items.map(item => item.kind)).toEqual(['tool', 'tool', 'tool', 'tool'])
    expect(items.map(item => item.detail)).toEqual(steps.prompt.map(item => item.detail))
  })
})
