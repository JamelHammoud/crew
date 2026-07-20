import { describe, it, expect } from 'vitest'
import { parseCodexLine } from '../src/runner/providers/codex'
const p = (o: any) => parseCodexLine(JSON.stringify(o))

describe('parseCodexLine', () => {
  it('ignores non-JSON and thread.started', () => {
    expect(parseCodexLine('not json')).toEqual([])
    expect(p({ type: 'thread.started', thread_id: 'x' })).toEqual([])
  })
  it('emits text only on completion (no dup with append-merge)', () => {
    expect(p({ type: 'item.updated', item: { id: 'i1', type: 'agent_message', text: 'partial' } })).toEqual([])
    expect(p({ type: 'item.completed', item: { id: 'i1', type: 'agent_message', text: 'hello' } })).toEqual([{ text: 'hello' }])
  })
  it('emits reasoning as thinking', () => {
    expect(p({ type: 'item.completed', item: { id: 'i2', type: 'reasoning', text: 'hmm' } })).toEqual([{ thinking: 'hmm' }])
  })
  it('streams shell start then finish with same id', () => {
    const a = p({ type: 'item.started', item: { id: 'i3', type: 'command_execution', command: 'echo hi' } })
    expect(a).toEqual([{ activity: { id: 'i3', kind: 'tool', name: 'Shell', status: 'started', detail: 'echo hi' } }])
    const b = p({ type: 'item.completed', item: { id: 'i3', type: 'command_execution', command: 'echo hi', exit_code: 0 } })
    expect(b[0].activity!.status).toBe('finished')
    expect(b[0].activity!.id).toBe('i3')
  })
  it('handles file_change as array and as object map', () => {
    expect(p({ type: 'item.started', item: { id: 'i4', type: 'file_change', changes: [{ path: 'a.ts' }, { path: 'b.ts' }] } })[0].activity!.detail).toBe('a.ts, b.ts')
    expect(p({ type: 'item.started', item: { id: 'i5', type: 'file_change', changes: { 'c.ts': 'update' } } })[0].activity!.detail).toBe('c.ts')
  })
  it('names mcp tools and web search', () => {
    expect(p({ type: 'item.started', item: { id: 'i6', type: 'mcp_tool_call', server: 'figma', tool: 'get' } })[0].activity!.name).toBe('figma.get')
    expect(p({ type: 'item.started', item: { id: 'i7', type: 'web_search', query: 'cats' } })[0].activity!.detail).toBe('cats')
  })
  it('reports tokens from turn.completed', () => {
    expect(p({ type: 'turn.completed', usage: { output_tokens: 42 } })).toEqual([{ tokens: 42 }])
  })
  it('surfaces the real usage-limit error, not the startup warning', () => {
    const warn = p({ type: 'item.completed', item: { id: 'item_0', type: 'error', message: 'Under-development features enabled' } })
    expect(warn).toEqual([{ error: 'Under-development features enabled' }])
    const real = p({ type: 'error', message: "You've hit your usage limit." })
    expect(real).toEqual([{ error: "You've hit your usage limit." }])
    expect(p({ type: 'turn.failed', error: { message: 'boom' } })).toEqual([{ error: 'boom' }])
  })
  it('survives malformed items', () => {
    expect(p({ type: 'item.started', item: null })).toEqual([])
    expect(p({ type: 'item.started', item: { type: 'command_execution' } })).toEqual([])
  })
})
