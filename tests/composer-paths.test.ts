// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { commandsIn } from '../src/shared/commands'
import { pathCandidates, pathIndex, pathQuery, pathRuns, pathToken } from '../src/shared/pathMention'

afterEach(cleanup)

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false
})) as typeof window.matchMedia
Element.prototype.scrollIntoView = () => {}
if (typeof globalThis.CSS === 'undefined') {
  ;(globalThis as { CSS?: unknown }).CSS = {}
}

const FILES = [
  'AGENTS.md',
  'src/main/index.ts',
  'src/renderer/src/components/Composer.tsx',
  'src/renderer/src/components/MentionAutocomplete.tsx',
  'src/renderer/src/views/Chat.tsx',
  'src/shared/files.ts',
  'src/shared/pathMention.ts'
]

window.crew = { listFiles: async () => FILES } as unknown as typeof window.crew

const { default: Chat } = await import('../src/renderer/src/views/Chat')
const { useCrew } = await import('../src/renderer/src/state/store')

const chat = commandsIn('chat')
const index = pathIndex(FILES)
const paths = (query: string): string[] => pathCandidates(index, query, 10).map(match => match.path)

function boot() {
  useCrew.setState({
    connection: 'online',
    selfId: 'ali',
    selfName: 'ALI',
    place: 'project:/tmp/crew',
    members: [{ id: 'ali', name: 'ALI', connected: true }],
    agents: [],
    events: [],
    docs: {},
    threads: {},
    threadPrompts: {},
    threadDrafts: {},
    chatDraft: '',
    chatCommands: [],
    queues: {},
    steps: {},
    tokens: {},
    pending: {},
    openThreadId: null,
    docsTarget: null
  })
  render(createElement(Chat))
  return screen.getByPlaceholderText('Ask Crew') as HTMLTextAreaElement
}

function type(input: HTMLTextAreaElement, text: string) {
  input.focus()
  fireEvent.change(input, { target: { value: text, selectionStart: text.length, selectionEnd: text.length } })
}

describe('what counts as a path being typed', () => {
  it('leaves a slash to the commands while one still matches', () => {
    expect(pathQuery('/g', 2, chat)).toBeNull()
    expect(pathQuery('/', 1, chat)).toBeNull()
  })

  it('takes the slash over once no command answers to it', () => {
    expect(pathQuery('/Doc', 4, chat)).toBe('/Doc')
    expect(pathQuery('/src/shared', 11, chat)).toBe('/src/shared')
  })

  it('never competes with a command in a composer that offers none', () => {
    expect(pathQuery('/g', 2, [])).toBe('/g')
  })

  it('opens on a path in the middle of a sentence', () => {
    expect(pathQuery('look at src/rend', 16, chat)).toBe('src/rend')
  })

  it('opens on nothing that is only a word', () => {
    expect(pathQuery('Composer', 8, chat)).toBeNull()
    expect(pathQuery('look at the file', 16, chat)).toBeNull()
  })

  it('leaves a link and a mention alone', () => {
    expect(pathQuery('https://crew.dev/docs', 20, chat)).toBeNull()
    expect(pathQuery('@Bob/x', 6, chat)).toBeNull()
  })

  it('reads the run the caret is in rather than the end of the box', () => {
    expect(pathQuery('src/shared and tests/x', 10, chat)).toBe('src/shared')
  })
})

describe('what the menu offers', () => {
  it('puts the folder first and what is inside it under', () => {
    expect(paths('src/renderer/src/comp')[0]).toBe('src/renderer/src/components')
  })

  it('reads a trailing slash as opening the folder', () => {
    expect(paths('src/renderer/src/components/')).toEqual([
      'src/renderer/src/components/Composer.tsx',
      'src/renderer/src/components/MentionAutocomplete.tsx'
    ])
  })

  it('holds a folder above what is under it and what is under it above what is deeper', () => {
    expect(paths('src/rend').slice(0, 3)).toEqual(['src/renderer', 'src/renderer/src', 'src/renderer/src/components'])
  })

  it('takes a leading slash as the top of the project', () => {
    expect(paths('/src/shared')).toEqual(['src/shared', 'src/shared/files.ts', 'src/shared/pathMention.ts'])
  })

  it('still finds a file by the letters of its own name', () => {
    expect(paths('comp/Comp')[0]).toBe('src/renderer/src/components/Composer.tsx')
  })

  it('offers nothing at all for a run nothing here answers to', () => {
    expect(paths('zz/qq')).toEqual([])
  })
})

describe('what gets written down', () => {
  it('takes the slash with a folder and stops at a file', () => {
    expect(pathToken({ path: 'src/shared', dir: true })).toBe('src/shared/')
    expect(pathToken({ path: 'src/shared/files.ts', dir: false })).toBe('src/shared/files.ts')
  })
})

describe('what is marked out in the box', () => {
  it('marks a path this project really holds', () => {
    expect(pathRuns('look at src/shared/files.ts now', index)).toEqual([
      { text: 'look at ', path: false },
      { text: 'src/shared/files.ts', path: true },
      { text: ' now', path: false }
    ])
  })

  it('marks nothing that only looks like one', () => {
    expect(pathRuns('look at src/shared/nothing.ts', index)).toEqual([
      { text: 'look at src/shared/nothing.ts', path: false }
    ])
  })

  it('leaves the punctuation after a path to the sentence', () => {
    expect(pathRuns('in src/shared/files.ts, near the top', index)).toEqual([
      { text: 'in ', path: false },
      { text: 'src/shared/files.ts', path: true },
      { text: ', near the top', path: false }
    ])
  })

  it('keeps a line number with the path it is on', () => {
    expect(pathRuns('src/shared/files.ts:12', index)).toEqual([{ text: 'src/shared/files.ts:12', path: true }])
  })

  it('marks a folder written the way a folder is written', () => {
    expect(pathRuns('under src/shared/ somewhere', index)).toEqual([
      { text: 'under ', path: false },
      { text: 'src/shared/', path: true },
      { text: ' somewhere', path: false }
    ])
  })
})

const row = (path: string): HTMLElement | null => document.querySelector(`[data-path="${path}"]`)

const rows = (): string[] =>
  [...document.querySelectorAll('[data-path]')].map(node => node.getAttribute('data-path') ?? '')

describe('picking a path in the composer', () => {
  it('writes the whole path and leaves the caret past it', async () => {
    const input = boot()
    type(input, 'look at src/shared/fi')
    await waitFor(() => expect(row('src/shared/files.ts')).toBeTruthy())
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(input.value).toBe('look at src/shared/files.ts ')
    expect(input.selectionStart).toBe(input.value.length)
  })

  it('writes what was clicked rather than what was highlighted', async () => {
    const input = boot()
    type(input, 'src/renderer/src/components/')
    await waitFor(() => expect(row('src/renderer/src/components/MentionAutocomplete.tsx')).toBeTruthy())
    fireEvent.click(row('src/renderer/src/components/MentionAutocomplete.tsx') as HTMLElement)
    expect(input.value).toBe('src/renderer/src/components/MentionAutocomplete.tsx ')
  })

  it('carries on inside a folder rather than ending on it', async () => {
    const input = boot()
    type(input, 'src/rend')
    await waitFor(() => expect(rows()[0]).toBe('src/renderer'))
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(input.value).toBe('src/renderer/')
    expect(input.selectionStart).toBe(input.value.length)
    expect(rows()[0]).toBe('src/renderer/src')
  })

  it('says nothing about files while a command still answers to the slash', async () => {
    const input = boot()
    type(input, '/g')
    await waitFor(() => expect(screen.getByText('/goal')).toBeTruthy())
    expect(rows()).toEqual([])
  })

  it('marks the path it wrote in the box it was written in', async () => {
    const input = boot()
    type(input, 'read src/shared/files.ts')
    await waitFor(() => {
      const marked = screen.getByText('src/shared/files.ts', { selector: 'span' })
      expect(marked.className).toContain('bg-fg/10')
    })
  })
})
