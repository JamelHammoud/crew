// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { nodeDefaults } from '../src/shared/designNode'
import { fakeBoard, type FakeShape } from './helpers/design-editor'

const { actionRows, searchActions } = await import('../src/renderer/src/design/actionSearch')
const { busyAgents } = await import('../src/renderer/src/design/busyAgents')

const node = (id: string): FakeShape => ({
  id,
  type: 'design-node',
  parentId: 'page:main',
  props: { ...nodeDefaults() }
})

function rowsFor(...selected: string[]) {
  const made = fakeBoard([node('shape:a'), node('shape:b')])
  made.select(...selected)
  return actionRows({ editor: made.editor, point: null, ask: () => {}, rename: () => {} })
}

const names = (groups: { rows: { label: string }[] }[]) => groups.flatMap(g => g.rows.map(r => r.label))

describe('actions palette', () => {
  it('suggests what is worth doing before anything is typed', () => {
    const groups = searchActions(rowsFor('shape:a', 'shape:b'), '')
    expect(groups[0].section).toBe('Suggestions')
    expect(groups[0].rows.map(row => row.label)).toContain('Ask an agent')
    expect(groups[0].rows.map(row => row.label)).toContain('Group selection')
  })

  it('keeps the rest of the list under the suggestions rather than hiding it', () => {
    const groups = searchActions(rowsFor('shape:a'), '')
    const sections = groups.map(group => group.section)
    expect(sections).toContain('Suggestions')
    expect(sections).toContain('Actions')
    expect(sections).toContain('Tools')
    expect(names(groups)).toContain('Rectangle')
  })

  it('shows a suggestion once, not twice', () => {
    const groups = searchActions(rowsFor('shape:a', 'shape:b'), '')
    const shown = names(groups)
    expect(shown.filter(label => label === 'Ask an agent')).toHaveLength(1)
  })

  it('searches tools and actions from the one field', () => {
    const groups = searchActions(rowsFor('shape:a'), 'rect')
    expect(names(groups)).toEqual(['Rectangle'])
    const front = searchActions(rowsFor('shape:a'), 'front')
    expect(names(front)).toContain('Bring to front')
  })

  it('puts what starts with the query ahead of what merely holds it', () => {
    const groups = searchActions(rowsFor('shape:a'), 'fr')
    const shown = names(groups)
    expect(shown[0]).toBe('Frame selection')
  })

  it('finds an action by what it does, not only by its name', () => {
    expect(names(searchActions(rowsFor('shape:a', 'shape:b'), 'crop'))).toContain('Use as mask')
    expect(names(searchActions(rowsFor('shape:a'), 'ai'))).toContain('Ask an agent')
  })

  it('says nothing matches rather than showing a stale list', () => {
    expect(searchActions(rowsFor('shape:a'), 'qqzz')).toEqual([])
  })

  it('leaves out an action the selection cannot do', () => {
    expect(names(searchActions(rowsFor(), 'delete'))).toEqual([])
    expect(names(searchActions(rowsFor('shape:a'), 'delete'))).toEqual(['Delete'])
  })

  it('runs the row it is handed', () => {
    const made = fakeBoard([node('shape:a')])
    made.select('shape:a')
    const rows = actionRows({ editor: made.editor, point: null, ask: () => {}, rename: () => {} })
    rows.find(row => row.id === 'to-front')!.run()
    expect(made.calls).toContain('bringToFront(shape:a)')
  })
})

describe('agents at work on a board', () => {
  const labels = { 'agent:bubbles': 'Bubbles' }

  it('names the agent whose thread on this board is still running', () => {
    const threads = [{ id: 'thread:1', boardId: 'board:a', agentId: 'agent:bubbles' }]
    expect(busyAgents('board:a', threads, { 'thread:1': 'prompt:1' }, labels)).toEqual([
      { id: 'agent:bubbles', label: 'Bubbles' }
    ])
  })

  it('lets go the moment the run ends', () => {
    const threads = [{ id: 'thread:1', boardId: 'board:a', agentId: 'agent:bubbles' }]
    expect(busyAgents('board:a', threads, {}, labels)).toEqual([])
  })

  it('leaves out a run on another board', () => {
    const threads = [{ id: 'thread:1', boardId: 'board:b', agentId: 'agent:bubbles' }]
    expect(busyAgents('board:a', threads, { 'thread:1': 'prompt:1' }, labels)).toEqual([])
  })

  it('counts an agent once however many threads it is running', () => {
    const threads = [
      { id: 'thread:1', boardId: 'board:a', agentId: 'agent:bubbles' },
      { id: 'thread:2', boardId: 'board:a', agentId: 'agent:bubbles' }
    ]
    expect(busyAgents('board:a', threads, { 'thread:1': 'p1', 'thread:2': 'p2' }, labels)).toHaveLength(1)
  })

  it('falls back to the name the thread carries when the agent is not in the pool', () => {
    const threads = [{ id: 'thread:1', boardId: 'board:a', agentId: 'agent:gone', agentLabel: 'Kimi' }]
    expect(busyAgents('board:a', threads, { 'thread:1': 'p1' }, {})).toEqual([
      { id: 'agent:gone', label: 'Kimi' }
    ])
  })
})
