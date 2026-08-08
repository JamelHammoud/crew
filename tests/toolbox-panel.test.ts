// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement, Fragment } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ToolBuilder from '../src/renderer/src/components/ToolBuilder'
import Toolbox from '../src/renderer/src/components/Toolbox'
import { useBrowser } from '../src/renderer/src/state/browser'
import { useHuddle } from '../src/renderer/src/state/huddle'
import { useMusic } from '../src/renderer/src/state/music'
import { useCrew } from '../src/renderer/src/state/store'
import { closeBuilder } from '../src/renderer/src/state/toolBuilder'
import type { PooledAgent } from '../src/shared/llm'
import type { ClientMessage } from '../src/shared/protocol'
import type { CrewTool } from '../src/shared/toolbox'

Element.prototype.getAnimations ??= () => []

const sent: ClientMessage[] = []
const asked: Array<{ text: string; aimedAt?: string[] }> = []
const tasks: Array<{ text: string; agentId?: string }> = []
const written: Array<{ page: string; text: string }> = []
const played: Array<{ trackId: string; playlistId: string | null }> = []
let copied: string[] = []

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

const shut: number[] = []

const toolbox = (
  tools: CrewTool[] = [],
  agents: PooledAgent[] = [],
  held: { docs?: Record<string, { title: string; text: string }>; boards?: Array<{ id: string; name: string }> } = {}
) => {
  useCrew.setState({
    tools,
    agents,
    docs: (held.docs ?? {}) as never,
    boards: (held.boards ?? []) as never,
    addTool: (name, mark, action) => sent.push({ type: 'tool.add', name, mark, action }),
    editTool: (toolId, name, mark, action) => sent.push({ type: 'tool.edit', toolId, name, mark, action }),
    removeTool: toolId => sent.push({ type: 'tool.remove', toolId }),
    sendChat: (text, _threadId, _boardId, _replyTo, aimedAt) => asked.push({ text, aimedAt }),
    addTodo: (text, agentId) => tasks.push({ text, agentId }),
    updateDoc: (page, text) => void written.push({ page, text })
  })
  // The card is raised from outside the toolbox, so both stand in the tree the
  // way they do in the app.
  return render(
    createElement(
      Fragment,
      null,
      createElement(Toolbox, { open: true, onClose: () => void shut.push(1) }),
      createElement(ToolBuilder)
    )
  )
}

beforeEach(() => {
  closeBuilder()
  shut.length = 0
  sent.length = 0
  asked.length = 0
  tasks.length = 0
  written.length = 0
  played.length = 0
  copied = []
  useBrowser.setState({ tabs: [], activeTabId: null, open: false })
  useMusic.setState({ uploads: [], playlists: [], put: (trackId, playlistId = null) => void played.push({ trackId, playlistId }) })
  useHuddle.setState({ joined: false })
  Object.assign(navigator, { clipboard: { writeText: (text: string) => void copied.push(text) } })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const build = () => fireEvent.click(screen.getByText('New tool'))
const name = (value: string) =>
  fireEvent.change(screen.getByPlaceholderText('What to call it'), { target: { value } })

const pick = (control: string, option: string | RegExp) => {
  fireEvent.click(screen.getByRole('button', { name: control }))
  fireEvent.click(screen.getByRole('button', { name: option }))
}

// What a tool does is picked off the pill that says which kind it is, the way a
// schedule picks its own.
const does = (title: string) => pick('What it does', new RegExp(`^${title}$`))

// The card is its own surface, so a name in it is asked for there rather than
// against the grid standing behind it.
const card = () => within(screen.getByRole('dialog'))

describe('the toolbox', () => {
  // The toolbox is the crew's own tools and nothing else. What the app can open
  // by itself is in the side panel, which is the one place it is listed.
  it('holds what the crew built and none of the app it stands in', () => {
    toolbox([tool()])

    expect(screen.getByText('Figma')).toBeTruthy()
    for (const built of ['Huddle', 'Review', 'Terminal', 'Files', 'Music', 'Games'])
      expect(screen.queryByText(built)).toBeNull()
  })

  it('stands on three columns', () => {
    toolbox([tool()])

    const grids = [...document.body.querySelectorAll('.grid')]
    expect(grids).toHaveLength(1)
    for (const grid of grids) expect(grid.className).toContain('grid-cols-3')
  })

  it('ends on an empty slot that opens the builder, with no tools built yet', () => {
    toolbox()

    build()
    expect(screen.getByPlaceholderText('What to call it')).toBeTruthy()
  })

  // A popover is drawn above a dialog, so the toolbox goes as the card arrives
  // rather than standing on top of the thing it just opened.
  it('puts the toolbox away as the card opens', () => {
    toolbox([tool()])

    build()
    expect(shut).toHaveLength(1)

    fireEvent.click(screen.getByLabelText('Edit Figma'))
    expect(shut).toHaveLength(2)
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

  it('asks the agent a tool names, and opens nothing in the panel for it', () => {
    toolbox([tool({ id: 'tool-5', name: 'Tests', mark: 'chat', action: { kind: 'prompt', text: 'Run the tests', agentId: 'a2' } })], [
      agent('a1', 'Fable'),
      agent('a2', 'Bubbles')
    ])

    fireEvent.click(screen.getByText('Tests'))
    expect(asked).toEqual([{ text: '@Bubbles Run the tests', aimedAt: ['a2'] }])
    expect(useBrowser.getState().tabs).toHaveLength(0)
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
    // Saving puts the card away.
    expect(screen.queryByPlaceholderText('What to call it')).toBeNull()
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
    pick('Where it opens', 'Your browser')
    fireEvent.click(screen.getByText('Add to toolbox'))

    expect(sent).toEqual([
      { type: 'tool.add', name: 'Docs', mark: 'star', action: { kind: 'web', url: 'crew.dev', external: true } }
    ])
  })

  it('builds a tool that opens a file', () => {
    toolbox()
    build()

    name('Notes')
    does('Open a file')
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
    does('Start a thread')
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
    does('Start a thread')
    pick('Ask who', 'Bubbles')
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

  it('leaves the pet on the row it stands in rather than at the top of it', () => {
    toolbox([], [agent('a1', 'Fable')])
    build()
    does('Start a thread')
    fireEvent.click(screen.getByRole('button', { name: 'Ask who' }))

    const row = screen.getByText('Fable').closest('button')!
    expect(row.className).toContain('items-center')
    for (const mark of row.querySelectorAll('span, svg'))
      expect(mark.getAttribute('class') ?? '').not.toMatch(/\bself-/)
  })

  it('will not build a tool with nothing to press or nowhere to go', () => {
    toolbox()
    build()
    // Picking what a tool does is a screen of its own, so the footer it comes
    // back to is a new one and has to be asked for again.
    const save = () => screen.getByText('Add to toolbox').closest('button')
    expect(save()?.disabled).toBe(true)

    name('Nowhere')
    expect(save()?.disabled).toBe(true)

    // A command is optional, so naming it is enough once it runs one.
    does('Run a command')
    expect(save()?.disabled).toBe(false)

    // A file with no path and an ask with nothing in it are not tools.
    does('Open a file')
    expect(save()?.disabled).toBe(true)
    does('Start a thread')
    expect(save()?.disabled).toBe(true)
  })

  it('builds a tool that opens a doc, and one that opens a board', () => {
    toolbox([], [], {
      docs: { notes: { title: 'Notes', text: '' } },
      boards: [{ id: 'b1', name: 'Onboarding' }]
    })
    build()

    name('Notes')
    does('Open a doc')
    pick('Which doc', 'Notes')
    fireEvent.click(screen.getByText('Add to toolbox'))

    expect(sent).toEqual([
      { type: 'tool.add', name: 'Notes', mark: 'star', action: { kind: 'doc', page: 'notes' } }
    ])

    sent.length = 0
    build()
    name('Board')
    does('Open a board')
    pick('Which board', 'Onboarding')
    fireEvent.click(screen.getByText('Add to toolbox'))

    expect(sent).toEqual([
      { type: 'tool.add', name: 'Board', mark: 'star', action: { kind: 'board', boardId: 'b1' } }
    ])
  })

  it('builds a tool that copies something, and leaves the toolbox open to say so', () => {
    toolbox()
    build()

    name('Join link')
    does('Copy something')
    fireEvent.change(screen.getByPlaceholderText('The bit everyone keeps looking up'), {
      target: { value: 'crew://join/abc' }
    })
    fireEvent.click(screen.getByText('Add to toolbox'))

    expect(sent).toEqual([
      { type: 'tool.add', name: 'Join link', mark: 'star', action: { kind: 'copy', text: 'crew://join/abc' } }
    ])

    cleanup()
    toolbox([tool({ id: 'tool-7', name: 'Join link', mark: 'copy', action: { kind: 'copy', text: 'crew://join/abc' } })])

    fireEvent.click(screen.getByText('Join link'))
    expect(copied).toEqual(['crew://join/abc'])
    expect(screen.getByText('Copied')).toBeTruthy()
  })

  it('says something in the chat, adds a task, and writes a line in a doc', () => {
    toolbox(
      [
        tool({ id: 's', name: 'Heads up', mark: 'chat', action: { kind: 'say', text: 'Pushing now' } }),
        tool({ id: 't', name: 'Overnight', mark: 'checklist', action: { kind: 'todo', text: 'Read what came in', agentId: 'a1' } }),
        tool({ id: 'n', name: 'Log it', mark: 'pencil', action: { kind: 'note', page: 'journal', text: 'Shipped' } })
      ],
      [],
      { docs: { journal: { title: 'Journal', text: 'Monday\n' } } }
    )

    fireEvent.click(screen.getByText('Heads up'))
    expect(asked).toEqual([{ text: 'Pushing now', aimedAt: undefined }])
    expect(screen.getByText('Sent')).toBeTruthy()

    fireEvent.click(screen.getByText('Overnight'))
    expect(tasks).toEqual([{ text: 'Read what came in', agentId: 'a1' }])
    expect(screen.getByText('Added')).toBeTruthy()

    // A line lands at the end of what is already there, with the page kept.
    fireEvent.click(screen.getByText('Log it'))
    expect(written).toEqual([{ page: 'journal', text: 'Monday\n\nShipped' }])
    expect(screen.getByText('Written')).toBeTruthy()
    // Everything here leaves you where you were.
    expect(useBrowser.getState().tabs).toHaveLength(0)
  })

  it('puts a list on for everyone, from the top and carrying the list', () => {
    toolbox([
      tool({ id: 'm', name: 'Focus', mark: 'music', action: { kind: 'music', playlistId: 'set-ambient-lofi' } }),
      tool({ id: 't', name: 'That one', mark: 'play', action: { kind: 'music', trackId: 'slow-morning' } })
    ])

    // A list plays from the top and carries the list with it.
    fireEvent.click(screen.getByText('Focus'))
    expect(played).toEqual([{ trackId: 'slow-morning', playlistId: 'set-ambient-lofi' }])
    expect(screen.getByText('Playing')).toBeTruthy()

    // A track named on its own belongs to no list.
    fireEvent.click(screen.getByText('That one'))
    expect(played[1]).toEqual({ trackId: 'slow-morning', playlistId: null })
  })

  it('runs a chain in the order it was built, and a pair that name each other stops', () => {
    const dev = tool({ id: 'd', name: 'Dev', mark: 'terminal', action: { kind: 'terminal', command: 'yarn dev' } })
    const link = tool({ id: 'l', name: 'Link', mark: 'copy', action: { kind: 'copy', text: 'crew://join' } })
    toolbox([
      dev,
      link,
      tool({ id: 'c', name: 'Start the day', mark: 'sun', action: { kind: 'chain', toolIds: ['l', 'd'] } })
    ])

    fireEvent.click(screen.getByText('Start the day'))
    expect(copied).toEqual(['crew://join'])
    expect(useBrowser.getState().tabs).toHaveLength(1)
    expect(useBrowser.getState().tabs[0]).toMatchObject({ kind: 'terminal', command: 'yarn dev' })
    // A chain that opens something opens the panel it opened in.
    expect(useBrowser.getState().open).toBe(true)

    cleanup()
    useBrowser.setState({ tabs: [], activeTabId: null, open: false })
    toolbox([
      dev,
      tool({ id: 'one', name: 'One', mark: 'group', action: { kind: 'chain', toolIds: ['two'] } }),
      tool({ id: 'two', name: 'Two', mark: 'group', action: { kind: 'chain', toolIds: ['one', 'd'] } })
    ])
    fireEvent.click(screen.getByText('One'))
    expect(useBrowser.getState().tabs).toHaveLength(1)
  })

  it('asks for a blank before it runs, and drops what was typed into every place it is named', () => {
    toolbox([
      tool({ id: 'q', name: 'Search', mark: 'search', action: { kind: 'web', url: 'https://crew.dev/search?q={what}' } })
    ])

    fireEvent.click(screen.getByText('Search'))
    expect(useBrowser.getState().tabs).toHaveLength(0)
    expect(screen.getByText('what')).toBeTruthy()

    const blank = screen.getByText('what').parentElement!.querySelector('input') as HTMLInputElement
    fireEvent.change(blank, { target: { value: 'pooling llms' } })
    fireEvent.click(screen.getByText('Go'))

    // What is typed goes into an address as a query rather than as it stands.
    expect(useBrowser.getState().tabs[0]).toMatchObject({
      kind: 'web',
      url: 'https://crew.dev/search?q=pooling%20llms'
    })
  })

  it('asks a chain for its blanks once, and leaves a shell variable alone', () => {
    toolbox([
      tool({ id: 'a', name: 'Branch', mark: 'terminal', action: { kind: 'terminal', command: 'git checkout {branch}' } }),
      tool({ id: 'b', name: 'Tell', mark: 'chat', action: { kind: 'say', text: 'On {branch} now, from ${PWD}' } }),
      tool({ id: 'c', name: 'Switch', mark: 'group', action: { kind: 'chain', toolIds: ['a', 'b'] } })
    ])

    fireEvent.click(screen.getByText('Switch'))
    const blanks = screen.getAllByText('branch')
    expect(blanks).toHaveLength(1)

    fireEvent.change(blanks[0].parentElement!.querySelector('input') as HTMLInputElement, {
      target: { value: 'ship-it' }
    })
    fireEvent.click(screen.getByText('Go'))

    expect(useBrowser.getState().tabs[0]).toMatchObject({ command: 'git checkout ship-it' })
    expect(asked).toEqual([{ text: 'On ship-it now, from ${PWD}', aimedAt: undefined }])
  })

  it('builds a tool that plays a list, and one that runs the tools already built', () => {
    toolbox([tool({ id: 'tool-1', name: 'Figma' }), tool({ id: 'tool-2', name: 'Dev', mark: 'terminal' })])
    build()

    name('Focus')
    does('Put music on')
    pick('What to play', /^Crew/)
    fireEvent.click(screen.getByText('Add to toolbox'))

    expect(sent).toEqual([
      { type: 'tool.add', name: 'Focus', mark: 'star', action: { kind: 'music', playlistId: 'set-ambient-lofi' } }
    ])

    sent.length = 0
    build()
    name('Start the day')
    does('Do several things')
    fireEvent.click(card().getByText('Dev'))
    fireEvent.click(card().getByText('Figma'))
    fireEvent.click(screen.getByText('Add to toolbox'))

    expect(sent).toEqual([
      { type: 'tool.add', name: 'Start the day', mark: 'star', action: { kind: 'chain', toolIds: ['tool-2', 'tool-1'] } }
    ])
  })

  it('builds a terminal with nothing else to say, and will not build the rest empty', () => {
    toolbox()
    build()

    const save = () => screen.getByText('Add to toolbox').closest('button')
    name('Shell')
    does('Run a command')
    expect(save()?.disabled).toBe(false)
    fireEvent.click(save() as HTMLButtonElement)
    expect(sent).toEqual([{ type: 'tool.add', name: 'Shell', mark: 'star', action: { kind: 'terminal', command: '' } }])

    build()
    name('Nothing')
    does('Say something')
    expect(save()?.disabled).toBe(true)
    does('Add a task')
    expect(save()?.disabled).toBe(true)
    does('Write in a doc')
    expect(save()?.disabled).toBe(true)
    does('Do several things')
    expect(save()?.disabled).toBe(true)
  })

  it('keeps a chain from naming the tool being built', () => {
    toolbox([tool({ id: 'tool-1', name: 'Figma' })])
    fireEvent.click(screen.getByLabelText('Edit Figma'))
    does('Do several things')

    expect(card().queryByText('Figma')).toBeNull()
    expect(card().getByText('Build a tool or two first')).toBeTruthy()
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
    fireEvent.click(screen.getByText('Remove'))
    expect(sent).toEqual([{ type: 'tool.remove', toolId: 'tool-1' }])
  })
})
