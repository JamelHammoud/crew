// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Toolbox from '../src/renderer/src/components/Toolbox'
import { useBrowser } from '../src/renderer/src/state/browser'
import { useCrew } from '../src/renderer/src/state/store'
import type { PooledAgent } from '../src/shared/llm'
import type { ClientMessage } from '../src/shared/protocol'
import type { CrewTool } from '../src/shared/toolbox'

Element.prototype.getAnimations ??= () => []

const sent: ClientMessage[] = []
const asked: Array<{ text: string; aimedAt?: string[] }> = []

const tool = (extra: Partial<CrewTool> = {}): CrewTool => ({
  id: 'tool-1',
  name: 'Figma',
  mark: 'globe',
  action: { kind: 'web', url: 'https://figma.com' },
  createdBy: 'Jamel',
  ts: 1,
  ...extra
})

const agent = (id: string, label: string): PooledAgent =>
  ({ id, label, provider: 'claude', ownerId: 'o', ownerName: 'Jamel', status: 'idle', runs: {} }) as PooledAgent

let switched = 0

const toolbox = (
  tools: CrewTool[] = [],
  agents: PooledAgent[] = [],
  written: { docs?: Record<string, { title: string; text: string }>; boards?: Array<{ id: string; name: string }> } = {}
) => {
  useCrew.setState({
    tools,
    agents,
    docs: (written.docs ?? {}) as never,
    boards: (written.boards ?? []) as never,
    addTool: (name, mark, action) => sent.push({ type: 'tool.add', name, mark, action }),
    editTool: (toolId, name, mark, action) => sent.push({ type: 'tool.edit', toolId, name, mark, action }),
    removeTool: toolId => sent.push({ type: 'tool.remove', toolId }),
    sendChat: (text, _threadId, _boardId, _replyTo, aimedAt) => asked.push({ text, aimedAt })
  })
  return render(createElement(Toolbox, { open: true, onClose: () => {}, onChat: () => void (switched += 1) }))
}

beforeEach(() => {
  sent.length = 0
  asked.length = 0
  switched = 0
  useBrowser.setState({ tabs: [], activeTabId: null })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const build = () => fireEvent.click(screen.getByText('New tool'))
const name = (value: string) =>
  fireEvent.change(screen.getByPlaceholderText('What to call it'), { target: { value } })

// What a tool does is a screen of its own, reached from the row that says which
// kind is picked.
const does = (title: string) => {
  fireEvent.click(screen.getByText('What it does').parentElement!.querySelector('button')!)
  fireEvent.click(screen.getByText(title))
}

describe('the toolbox', () => {
  it('holds the built-in tools, every one of them live', () => {
    toolbox()

    for (const built of ['Huddle', 'Terminal', 'Files', 'Music'])
      expect(screen.getByText(built).closest('button')?.disabled).toBe(false)
  })

  it('ends on an empty slot that opens the builder, with no tools built yet', () => {
    toolbox()

    build()
    expect(screen.getByPlaceholderText('What to call it')).toBeTruthy()
  })

  it('opens the project files, and takes you to where they opened', () => {
    toolbox()
    fireEvent.click(screen.getByText('Files'))

    const tabs = useBrowser.getState().tabs
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toMatchObject({ kind: 'file', path: '', tree: true })
    expect(switched).toBe(1)
  })

  it('wears no label for what is still coming, and says it on hover instead', () => {
    vi.useFakeTimers()
    toolbox()

    expect(screen.queryByText('Coming soon')).toBeNull()

    hover('Music')
    expect(screen.getAllByText('Coming soon')).toHaveLength(1)

    unhover('Music')
    expect(screen.queryByText('Coming soon')).toBeNull()

    hover('Terminal')
    expect(screen.queryByText('Coming soon')).toBeNull()
  })

  it('opens a terminal, and takes you to where it opened', () => {
    toolbox()
    fireEvent.click(screen.getByText('Terminal'))

    const tabs = useBrowser.getState().tabs
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toMatchObject({ kind: 'terminal', command: null })
    expect(switched).toBe(1)
  })

  it('runs a built tool: a page opens in the side panel, a command opens a terminal', () => {
    toolbox([tool(), tool({ id: 'tool-2', name: 'Dev', mark: 'terminal', action: { kind: 'terminal', command: 'yarn dev' } })])

    fireEvent.click(screen.getByText('Figma'))
    expect(useBrowser.getState().tabs[0]).toMatchObject({ kind: 'web', url: 'https://figma.com' })

    cleanup()
    toolbox([tool({ id: 'tool-2', name: 'Dev', mark: 'terminal', action: { kind: 'terminal', command: 'yarn dev' } })])
    fireEvent.click(screen.getByText('Dev'))
    expect(useBrowser.getState().tabs.at(-1)).toMatchObject({ kind: 'terminal', command: 'yarn dev' })
  })

  it('opens a file, and hands a command written over several lines to the shell a line at a time', () => {
    toolbox([
      tool({ id: 'tool-3', name: 'Notes', mark: 'doc', action: { kind: 'file', path: 'docs/notes.md' } }),
      tool({ id: 'tool-4', name: 'Ship', mark: 'terminal', action: { kind: 'terminal', command: 'yarn build\nyarn dist' } })
    ])

    fireEvent.click(screen.getByText('Notes'))
    expect(useBrowser.getState().tabs.at(-1)).toMatchObject({ kind: 'file', path: 'docs/notes.md' })

    fireEvent.click(screen.getByText('Ship'))
    expect(useBrowser.getState().tabs.at(-1)).toMatchObject({ kind: 'terminal', command: 'yarn build\ryarn dist' })
  })

  it('asks the agent a tool names, and takes you to the chat rather than the panel', () => {
    toolbox([tool({ id: 'tool-5', name: 'Tests', mark: 'chat', action: { kind: 'prompt', text: 'Run the tests', agentId: 'a2' } })], [
      agent('a1', 'Fable'),
      agent('a2', 'Bubbles')
    ])

    fireEvent.click(screen.getByText('Tests'))
    expect(asked).toEqual([{ text: '@Bubbles Run the tests', aimedAt: ['a2'] }])
    expect(useBrowser.getState().tabs).toHaveLength(0)
    expect(switched).toBe(0)
  })

  it('asks whoever is here when the agent a tool names has gone', () => {
    toolbox([tool({ id: 'tool-6', name: 'Tests', mark: 'chat', action: { kind: 'prompt', text: 'Run the tests', agentId: 'gone' } })], [
      agent('a1', 'Fable')
    ])

    fireEvent.click(screen.getByText('Tests'))
    expect(asked).toEqual([{ text: '@Fable Run the tests', aimedAt: ['a1'] }])
  })

  it('builds a tool from the form and sends it to the crew', () => {
    toolbox()
    build()

    name('Staging')
    fireEvent.click(screen.getByLabelText('Choose a mark'))
    fireEvent.click(screen.getByLabelText('cloud'))
    fireEvent.change(screen.getByPlaceholderText('figma.com'), { target: { value: 'crew.dev' } })
    fireEvent.click(screen.getByText('Add to toolbox'))

    expect(sent).toEqual([
      { type: 'tool.add', name: 'Staging', mark: 'cloud', action: { kind: 'web', url: 'crew.dev' } }
    ])
    // Saving puts the grid back.
    expect(screen.getByText('Huddle')).toBeTruthy()
  })

  it('marks a tool with an emoji', () => {
    toolbox()
    build()

    name('Staging')
    fireEvent.click(screen.getByLabelText('Choose a mark'))
    fireEvent.click(screen.getByText('Emoji'))
    fireEvent.change(screen.getByPlaceholderText('Search emoji'), { target: { value: 'rocket' } })
    fireEvent.click(screen.getByLabelText('Use :rocket:'))
    fireEvent.change(screen.getByPlaceholderText('figma.com'), { target: { value: 'crew.dev' } })
    fireEvent.click(screen.getByText('Add to toolbox'))

    expect(sent).toEqual([
      { type: 'tool.add', name: 'Staging', mark: '🚀', action: { kind: 'web', url: 'crew.dev' } }
    ])
  })

  it('builds a page that opens in your own browser', () => {
    toolbox()
    build()

    name('Docs')
    fireEvent.change(screen.getByPlaceholderText('figma.com'), { target: { value: 'crew.dev' } })
    fireEvent.click(screen.getByText('Your browser'))
    fireEvent.click(screen.getByText('Add to toolbox'))

    expect(sent).toEqual([
      { type: 'tool.add', name: 'Docs', mark: 'star', action: { kind: 'web', url: 'crew.dev', external: true } }
    ])
  })

  it('builds a tool that opens a file', () => {
    toolbox()
    build()

    name('Notes')
    fireEvent.click(screen.getByText('Open a file'))
    fireEvent.change(screen.getByPlaceholderText('src/renderer/src/App.tsx'), { target: { value: 'docs/notes.md' } })
    fireEvent.click(screen.getByText('Add to toolbox'))

    expect(sent).toEqual([
      { type: 'tool.add', name: 'Notes', mark: 'star', action: { kind: 'file', path: 'docs/notes.md' } }
    ])
  })

  it('builds a tool that asks an agent, and asks anyone until one is picked', () => {
    toolbox([], [agent('a1', 'Fable'), agent('a2', 'Bubbles')])
    build()

    name('Tests')
    fireEvent.click(screen.getByText('Ask an agent'))
    fireEvent.change(screen.getByPlaceholderText('Run the tests and fix what fails'), {
      target: { value: 'Run the tests' }
    })
    fireEvent.click(screen.getByText('Add to toolbox'))

    expect(sent).toEqual([
      { type: 'tool.add', name: 'Tests', mark: 'star', action: { kind: 'prompt', text: 'Run the tests' } }
    ])

    sent.length = 0
    build()
    name('Tests')
    fireEvent.click(screen.getByText('Ask an agent'))
    fireEvent.click(screen.getByText('Bubbles'))
    fireEvent.change(screen.getByPlaceholderText('Run the tests and fix what fails'), {
      target: { value: 'Run the tests' }
    })
    fireEvent.click(screen.getByText('Add to toolbox'))

    expect(sent).toEqual([
      {
        type: 'tool.add',
        name: 'Tests',
        mark: 'star',
        action: { kind: 'prompt', text: 'Run the tests', agentId: 'a2' }
      }
    ])
  })

  it('will not build a tool with nothing to press or nowhere to go', () => {
    toolbox()
    build()
    const save = screen.getByText('Add to toolbox').closest('button')
    expect(save?.disabled).toBe(true)

    name('Nowhere')
    expect(save?.disabled).toBe(true)

    // A command is optional, so naming it is enough once it runs one.
    fireEvent.click(screen.getByText('Run a command'))
    expect(save?.disabled).toBe(false)

    // A file with no path and an ask with nothing in it are not tools.
    fireEvent.click(screen.getByText('Open a file'))
    expect(save?.disabled).toBe(true)
    fireEvent.click(screen.getByText('Ask an agent'))
    expect(save?.disabled).toBe(true)
  })

  it('edits and removes a tool that is already there', () => {
    toolbox([tool()])
    fireEvent.click(screen.getByLabelText('Edit Figma'))

    const field = screen.getByPlaceholderText('What to call it') as HTMLInputElement
    expect(field.value).toBe('Figma')
    fireEvent.change(field, { target: { value: 'Design' } })
    fireEvent.click(screen.getByText('Save'))
    expect(sent).toEqual([
      { type: 'tool.edit', toolId: 'tool-1', name: 'Design', mark: 'globe', action: { kind: 'web', url: 'https://figma.com' } }
    ])

    sent.length = 0
    fireEvent.click(screen.getByLabelText('Edit Figma'))
    fireEvent.click(screen.getByLabelText('Remove tool'))
    expect(sent).toEqual([{ type: 'tool.remove', toolId: 'tool-1' }])
  })
})
