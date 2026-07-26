// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import StepRow from '../src/renderer/src/components/StepRow'
import { describeStep, type ThreadItem } from '../src/renderer/src/components/thread'
import { toolAction } from '../src/renderer/src/components/toolActions'
import type { AgentStep } from '../src/shared/llm'

if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => []
}

afterEach(() => cleanup())

const item = (patch: Partial<ThreadItem>): ThreadItem => ({
  key: 'p1:s1',
  ts: 0,
  kind: 'tool',
  author: 'Claude',
  self: false,
  text: '',
  streaming: false,
  ...patch
})

const step = (patch: Partial<AgentStep>): AgentStep => ({
  id: 's1',
  kind: 'tool',
  status: 'running',
  ts: 0,
  ...patch
})

describe('tool names', () => {
  it('says what happened in plain words instead of the tool name', () => {
    expect(toolAction('Read').done).toBe('Read')
    expect(toolAction('Bash').done).toBe('Ran')
    expect(toolAction('Edit').done).toBe('Edited')
    expect(toolAction('Grep').done).toBe('Searched')
    expect(toolAction('Glob').done).toBe('Found files')
    expect(toolAction('WebSearch').done).toBe('Searched the web')
    expect(toolAction('TodoWrite').done).toBe('Planned')
  })

  it('reads as happening while the step is live', () => {
    expect(toolAction('Read').run).toBe('Reading')
    expect(toolAction('Bash').run).toBe('Running')
    expect(toolAction('WebSearch').run).toBe('Searching the web')
  })

  it('lands the same whichever cli named the tool', () => {
    const same = (...names: string[]) => {
      const [first, ...rest] = names.map(name => toolAction(name))
      for (const other of rest) expect(other).toBe(first)
    }
    same('Read', 'read_file', 'ReadFile', 'view_file')
    same('Bash', 'Shell', 'command_execution', 'local_shell')
    same('Edit', 'file_change', 'StrReplaceFile', 'apply_patch', 'MultiEdit')
    same('Write', 'WriteFile', 'create_file')
    same('WebSearch', 'web_search', 'search_web')
    same('WebFetch', 'fetch_url', 'FetchURL')
    same('TodoWrite', 'Todo', 'SetTodoList', 'update_plan')
  })

  it('gives a subagent the agent mark whatever the tool was called', () => {
    const agent = toolAction('Task', true)
    expect(agent.done).toBe('Asked an agent')
    expect(toolAction('anything_at_all', true)).toBe(agent)
    expect(toolAction('Agent')).toBe(agent)
  })

  it('names an mcp tool after the tool, not the plumbing', () => {
    expect(toolAction('mcp__figma__get_design_context').done).toBe('Get design context')
    expect(toolAction('figma.get_screenshot').done).toBe('Get screenshot')
    expect(toolAction('mcp__figma__get_design_context').icon).toBe(toolAction('figma.get_screenshot').icon)
  })

  it('reads a tool nobody has heard of as words', () => {
    expect(toolAction('generate_diagram').done).toBe('Generate diagram')
    expect(toolAction('SomeNewTool').done).toBe('Some new tool')
    expect(toolAction(undefined).done).toBe('Working')
  })

  it('says the same thing in the status bar as in the thread', () => {
    expect(describeStep(step({ name: 'WebSearch' }))).toBe('Searching the web')
    expect(describeStep(step({ kind: 'subagent', name: 'Task' }))).toBe('Asking an agent')
    expect(describeStep(step({ name: 'Bash', status: 'done' }))).toBe('Thinking')
  })
})

describe('step rows', () => {
  it('wears a mark of its own and says what it did', () => {
    render(createElement(StepRow, { item: item({ name: 'Bash', detail: 'yarn test' }) }))
    expect(screen.getByText('Ran')).not.toBeNull()
    expect(screen.getByText('yarn test')).not.toBeNull()
    expect(document.querySelectorAll('svg').length).toBeGreaterThan(0)
    expect(document.querySelector('[role="status"]')).toBeNull()
  })

  it('spins while the step is still going and speaks in the present', () => {
    render(createElement(StepRow, { item: item({ name: 'Bash', detail: 'yarn test', streaming: true }) }))
    expect(screen.getByText('Running')).not.toBeNull()
    expect(document.querySelector('[role="status"]')).not.toBeNull()
  })

  it('draws a thread up to the step above it and nothing when it stands alone', () => {
    const { container } = render(createElement(StepRow, { item: item({ name: 'Read' }), linked: true }))
    expect(container.querySelector('span[aria-hidden]')).not.toBeNull()
    cleanup()
    const alone = render(createElement(StepRow, { item: item({ name: 'Read' }) }))
    expect(alone.container.querySelector('span[aria-hidden]')).toBeNull()
  })
})
