import { describe, expect, it } from 'vitest'
import { crewToolCall } from '../src/renderer/src/components/crewTool'

describe('Crew API shell calls', () => {
  it.each([
    'curl -s http://127.0.0.1:2739/agents/spawn',
    'curl -s http://localhost:2739/code/agents/a1/say | jq .',
    "wget -qO- 'http://[::1]:2739/page?promptId=p1'",
    'python3 -c \'fetch("http://127.0.0.1:2739/code/tickets/2/decision")\'',
    'curl -s http://127.0.0.1:2739/memory/abc/forget'
  ])('hides an internal action wrapped as %s', detail => {
    expect(crewToolCall(detail)).toEqual({ kind: 'hidden' })
  })

  it.each([
    'curl -s https://example.com/code/agents/spawn',
    'curl -s http://127.0.0.1:2739/pages',
    'curl -s http://127.0.0.1:2739/files/design/board-1abc',
    'curl -s http://127.0.0.1:2739/a/b/design/board-1abc',
    'echo no-address-here'
  ])('leaves unrelated work visible for %s', detail => {
    expect(crewToolCall(detail)).toBeNull()
  })

  it('does not mistake the page being shown for the Crew action', () => {
    expect(
      crewToolCall(`curl -d '{"url":"http://localhost:5173/design/site-1abc"}' http://127.0.0.1:2739/6329c2/page`)
    ).toEqual({ kind: 'hidden' })
  })
})
