import { describe, expect, it } from 'vitest'
import { parseClaudeLine } from '../src/runner/providers/claude'

const streamEvent = (event: unknown): string => JSON.stringify({ type: 'stream_event', event })

describe('claude thinking stream', () => {
  it('parses thinking block start, deltas, and stop', () => {
    expect(
      parseClaudeLine(streamEvent({ type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } }))
    ).toEqual([{ thinkingStart: { index: 0 } }])
    expect(
      parseClaudeLine(streamEvent({ type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'step one' } }))
    ).toEqual([{ thinkingDelta: { index: 0, text: 'step one' } }])
    expect(parseClaudeLine(streamEvent({ type: 'content_block_stop', index: 0 }))).toEqual([
      { thinkingStop: { index: 0 } }
    ])
  })

  it('ignores text deltas and non-thinking block starts', () => {
    expect(
      parseClaudeLine(streamEvent({ type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } }))
    ).toEqual([])
    expect(
      parseClaudeLine(streamEvent({ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'hi' } }))
    ).toEqual([])
  })

  it('still parses complete thinking blocks from assistant messages', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'thinking', thinking: 'full reasoning' }] }
    })
    expect(parseClaudeLine(line)).toEqual([{ thinking: 'full reasoning' }])
  })
})
