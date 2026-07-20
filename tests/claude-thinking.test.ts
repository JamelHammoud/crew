import { describe, expect, it } from 'vitest'
import { parseClaudeLine } from '../src/runner/providers/claude'
import { fileChanges } from '../src/runner/providers/detail'
import { parseKimiLine } from '../src/runner/providers/kimi'

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

describe('claude file changes', () => {
  it('computes counts and a diff for Edit', () => {
    const [change] = fileChanges('Edit', {
      file_path: '/repo/src/a.ts',
      old_string: 'one\ntwo',
      new_string: 'one\ntwo\nthree'
    })!
    expect(change.path).toBe('/repo/src/a.ts')
    expect(change.added).toBe(3)
    expect(change.removed).toBe(2)
    expect(change.diff).toBe('- one\n- two\n+ one\n+ two\n+ three')
  })

  it('counts Write content as added lines', () => {
    const [change] = fileChanges('Write', { file_path: '/repo/b.ts', content: 'a\nb\nc' })!
    expect(change.added).toBe(3)
    expect(change.removed).toBe(0)
    expect(change.diff).toBe('+ a\n+ b\n+ c')
  })

  it('sums MultiEdit edits', () => {
    const [change] = fileChanges('MultiEdit', {
      file_path: '/repo/c.ts',
      edits: [
        { old_string: 'x', new_string: 'y\nz' },
        { old_string: 'p\nq', new_string: 'r' }
      ]
    })!
    expect(change.added).toBe(3)
    expect(change.removed).toBe(3)
  })

  it('returns nothing for read-only tools', () => {
    expect(fileChanges('Read', { file_path: '/repo/a.ts' })).toBeUndefined()
    expect(fileChanges('Bash', { command: 'ls' })).toBeUndefined()
  })

  it('attaches files to Edit tool activities', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: '/r/a.ts', old_string: 'a', new_string: 'b' } }
        ]
      }
    })
    const [out] = parseClaudeLine(line)
    expect(out.activity?.files).toEqual([{ path: '/r/a.ts', added: 1, removed: 1, diff: '- a\n+ b' }])
  })

  it('handles snake_case edit shapes from other CLIs', () => {
    const [change] = fileChanges('str_replace', { path: '/r/d.ts', old_str: 'x\ny', new_str: 'z' })!
    expect(change.added).toBe(1)
    expect(change.removed).toBe(2)
    expect(change.diff).toBe('- x\n- y\n+ z')
  })

  it('attaches files to kimi tool calls', () => {
    const line = JSON.stringify({
      role: 'assistant',
      tool_calls: [
        {
          id: 'c1',
          function: {
            name: 'edit_file',
            arguments: JSON.stringify({ file_path: '/r/e.ts', old_string: 'one', new_string: 'one\ntwo' })
          }
        }
      ]
    })
    const [out] = parseKimiLine(line)
    expect(out.activity?.files).toEqual([{ path: '/r/e.ts', added: 2, removed: 1, diff: '- one\n+ one\n+ two' }])
  })

  it('attaches files to kimi write calls', () => {
    const line = JSON.stringify({
      role: 'assistant',
      tool_calls: [
        {
          id: 'c2',
          function: { name: 'write_file', arguments: JSON.stringify({ path: '/r/f.ts', content: 'a\nb' }) }
        }
      ]
    })
    const [out] = parseKimiLine(line)
    expect(out.activity?.files).toEqual([{ path: '/r/f.ts', added: 2, removed: 0, diff: '+ a\n+ b' }])
  })
})
