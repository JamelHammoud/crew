// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import StepGroup from '../src/renderer/src/components/StepGroup'
import StepRow from '../src/renderer/src/components/StepRow'
import { describeStep, stepBlocks, type ThreadItem } from '../src/renderer/src/components/thread'
import { toolAction } from '../src/renderer/src/components/toolActions'
import { useBrowser } from '../src/renderer/src/state/browser'
import type { PathLocation } from '../src/shared/files'
import type { AgentStep } from '../src/shared/llm'

if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => []
}

const REPO = new Set(['src/app.ts', 'src/panel.ts'])
let copied = ''

beforeEach(() => {
  copied = ''
  useBrowser.setState({ tabs: [], activeTabId: null })
  window.crew = {
    readFile: async (path: string) => ({ kind: 'missing', path }),
    locatePath: async (path: string): Promise<PathLocation> => ({ kind: 'repo', path, exists: REPO.has(path) }),
    revealFile: async () => undefined,
    openExternal: async () => undefined
  } as unknown as CrewBridge
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        copied = text
      }
    }
  })
})

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

const mark = (container: HTMLElement): SVGElement | null => container.querySelector('svg')

describe('step rows', () => {
  it('wears a mark of its own and says what it did', () => {
    const { container } = render(createElement(StepRow, { item: item({ name: 'Bash', detail: 'yarn test' }) }))
    expect(screen.getByText('Ran')).not.toBeNull()
    expect(screen.getByText('yarn test')).not.toBeNull()
    expect(mark(container)?.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(mark(container)?.getAttribute('stroke-width')).toBe('1.5')
    expect(mark(container)?.getAttribute('fill')).toBe('none')
  })

  it('gives every tool a mark of its own', () => {
    const drawn = (name: string): string => {
      cleanup()
      const { container } = render(createElement(StepRow, { item: item({ name }) }))
      return mark(container)?.innerHTML ?? ''
    }
    const marks = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebSearch', 'TodoWrite'].map(drawn)
    expect(marks.every(Boolean)).toBe(true)
    expect(new Set(marks).size).toBe(marks.length)
  })

  it('lights the mark up and speaks in the present while the step is live', () => {
    const { container } = render(
      createElement(StepRow, { item: item({ name: 'Bash', detail: 'yarn test', streaming: true }) })
    )
    expect(screen.getByText('Running')).not.toBeNull()
    expect(mark(container)?.getAttribute('class')).toContain('pulse-soft')
    cleanup()
    const done = render(createElement(StepRow, { item: item({ name: 'Bash', detail: 'yarn test' }) }))
    expect(mark(done.container)?.getAttribute('class')).not.toContain('pulse-soft')
  })

  it('opens what a row points at instead of unfolding it', async () => {
    const { container } = render(createElement(StepRow, { item: item({ name: 'Read', detail: 'src/app.ts' }) }))
    await waitFor(() => expect(screen.getByText('src/app.ts')).not.toBeNull())
    expect(container.querySelectorAll('button').length).toBe(1)
    fireEvent.click(container.querySelector('button') as HTMLButtonElement)
    expect(useBrowser.getState().tabs[0].path).toBe('src/app.ts')
  })

  it('opens a page an agent read', () => {
    const { container } = render(
      createElement(StepRow, { item: item({ name: 'WebFetch', detail: 'https://crew.dev/docs' }) })
    )
    fireEvent.click(container.querySelector('button') as HTMLButtonElement)
    const tab = useBrowser.getState().tabs[0]
    expect(tab.kind).toBe('web')
    expect(tab.url).toBe('https://crew.dev/docs')
  })

  it('leaves a row with nothing more to show alone', () => {
    const { container } = render(
      createElement(StepRow, { item: item({ name: 'WebSearch', detail: 'pooling llms' }) })
    )
    fireEvent.click(container.querySelector('button') as HTMLButtonElement)
    expect(useBrowser.getState().tabs.length).toBe(0)
    expect(container.querySelectorAll('svg').length).toBe(1)
  })

  it('opens a command into something you can read and copy', () => {
    const command = 'yarn vitest run tests/tool-actions-probe.test.ts'
    const { container } = render(createElement(StepRow, { item: item({ name: 'Bash', detail: command }) }))
    fireEvent.click(container.querySelector('button') as HTMLButtonElement)
    expect(screen.getByText('$')).not.toBeNull()
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(2)
    fireEvent.click(buttons[1])
    return waitFor(() => expect(copied).toBe(command))
  })

  it('opens an edit into the lines that went and the lines that arrived', async () => {
    const diff = ['- const one = 1', '+ const one = 2'].join('\n')
    const { container } = render(
      createElement(StepRow, {
        item: item({ name: 'Edit', files: [{ path: 'src/app.ts', added: 1, removed: 1, diff }] })
      })
    )
    fireEvent.click(container.querySelector('button') as HTMLButtonElement)
    await waitFor(() => expect(screen.getByText('const one = 1')).not.toBeNull())
    expect(screen.getByText('const one = 2')).not.toBeNull()
    expect(screen.getByText('−')).not.toBeNull()
    expect(screen.getByText('+')).not.toBeNull()
    fireEvent.click(container.querySelectorAll('button')[1])
    await waitFor(() => expect(copied).toBe('const one = 2'))
  })

  it('sits closer to the step above it than to a message', () => {
    const { container } = render(createElement(StepRow, { item: item({ name: 'Read' }), linked: true }))
    expect(container.firstElementChild?.className).toContain('-mt-3')
    cleanup()
    const alone = render(createElement(StepRow, { item: item({ name: 'Read' }) }))
    expect(alone.container.firstElementChild?.className).not.toContain('-mt-3')
  })
})

describe('runs of the same tool', () => {
  const tool = (name: string, key: string, patch: Partial<ThreadItem> = {}): ThreadItem =>
    item({ name, key, promptId: 'p1', ...patch })

  it('folds a long run into one line and leaves a pair where it is', () => {
    const run = ['a', 'b', 'c'].map(key => tool('Edit', key))
    expect(stepBlocks(run).length).toBe(1)
    expect(stepBlocks(run)[0].items.length).toBe(3)
    expect(stepBlocks(['a', 'b'].map(key => tool('Edit', key))).length).toBe(2)
  })

  it('only folds the same tool from the same run together', () => {
    const mixed = [tool('Edit', 'a'), tool('Read', 'b'), tool('Edit', 'c'), tool('Edit', 'd')]
    expect(stepBlocks(mixed).length).toBe(4)
    const other = [tool('Edit', 'a'), tool('Edit', 'b'), tool('Edit', 'c', { promptId: 'p2' })]
    expect(stepBlocks(other).map(block => block.items.length)).toEqual([1, 1, 1])
  })

  it('says how many lines the whole run touched and opens onto every step', () => {
    const items = [
      tool('Edit', 'a', { files: [{ path: 'src/app.ts', added: 6, removed: 3 }] }),
      tool('Edit', 'b', { files: [{ path: 'src/panel.ts', added: 7, removed: 11 }] }),
      tool('Edit', 'c', { files: [{ path: 'src/other.ts', added: 2, removed: 0 }] })
    ]
    const { container } = render(createElement(StepGroup, { items }))
    expect(screen.getByText('Edited files')).not.toBeNull()
    expect(screen.getByText('+15')).not.toBeNull()
    expect(screen.getByText('−14')).not.toBeNull()
    expect(screen.queryByText('src/panel.ts')).toBeNull()
    fireEvent.click(container.querySelector('button') as HTMLButtonElement)
    expect(screen.getAllByText('Edited').length).toBe(3)
  })
})
