// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createElement } from 'react'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { commandsIn } from '../src/shared/commands'
import { readMachineDirs } from '../src/main/files'
import {
  machineCandidates,
  machineDirQuery,
  machineToken,
  pathMenu,
  revealedBy,
  type MachineDir
} from '../src/shared/machinePath'
import { pathIndex, pathQuery, pathRuns } from '../src/shared/pathMention'

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

const ROOT = '/Users/jamel/Documents/Repositories/crew'

const FILES = ['AGENTS.md', 'src/main/index.ts', 'src/shared/files.ts', 'src/shared/pathMention.ts']

const HOME: MachineDir = {
  dir: '/Users/jamel',
  repoDir: null,
  entries: [
    { name: 'Documents', dir: true },
    { name: 'Downloads', dir: true },
    { name: '.zshrc', dir: false },
    { name: 'donate.pdf', dir: false },
    { name: 'notes.txt', dir: false }
  ]
}

const IN_PROJECT: MachineDir = {
  dir: `${ROOT}/src`,
  repoDir: 'src',
  entries: [
    { name: 'main', dir: true },
    { name: 'shared', dir: true }
  ]
}

const PROJECT_ROOT: MachineDir = {
  dir: ROOT,
  repoDir: '',
  entries: [
    { name: 'src', dir: true },
    { name: 'AGENTS.md', dir: false }
  ]
}

const DIRS: Record<string, MachineDir[]> = {
  '/Users/jamel': [HOME],
  [`${ROOT}/src`]: [IN_PROJECT],
  [ROOT]: [PROJECT_ROOT]
}

const index = pathIndex(FILES)
const chat = commandsIn('chat')
const offers = (dirs: MachineDir[], query: string): string[] =>
  machineCandidates(dirs, query, 10).map(match => match.path)

describe('what counts as a path on this machine', () => {
  it('names the folder a run is standing in', () => {
    expect(machineDirQuery('/Documents/Rep')).toBe('/Documents')
    expect(machineDirQuery('/Users/jamel/Do')).toBe('/Users/jamel')
    expect(machineDirQuery('/Users/jamel/')).toBe('/Users/jamel')
    expect(machineDirQuery('/Doc')).toBe('/')
    expect(machineDirQuery('~/Doc')).toBe('~')
  })

  it('asks the machine for nothing a project path would answer', () => {
    expect(machineDirQuery('src/shared')).toBeNull()
    expect(machineDirQuery('Documents')).toBeNull()
  })

  it('opens on a home path, which the box used to refuse outright', () => {
    expect(pathQuery('~/Documents/notes', 17, chat)).toBe('~/Documents/notes')
    expect(pathQuery('~Documents', 10, chat)).toBeNull()
  })
})

describe('what the menu offers off this machine', () => {
  it('takes what was typed as the head of a name', () => {
    expect(offers([HOME], '/Users/jamel/Do')).toEqual(['/Users/jamel/Documents', '/Users/jamel/Downloads'])
  })

  it('reads a trailing slash as opening the folder, folders first', () => {
    expect(offers([HOME], '/Users/jamel/')).toEqual([
      '/Users/jamel/Documents',
      '/Users/jamel/Downloads',
      '/Users/jamel/donate.pdf',
      '/Users/jamel/notes.txt'
    ])
  })

  it('keeps a dotfile out until a dot is typed', () => {
    expect(offers([HOME], '/Users/jamel/.')).toEqual(['/Users/jamel/.zshrc'])
  })

  it('still finds a name by its own letters', () => {
    expect(offers([HOME], '/Users/jamel/nts')).toEqual(['/Users/jamel/notes.txt'])
  })

  it('marks out the letters that landed in the name rather than in the folders', () => {
    const match = machineCandidates([HOME], '/Users/jamel/Doc', 10)[0]
    expect(match.path.slice(match.hits[0], match.hits[2] + 1)).toBe('Doc')
  })

  it('offers nothing for a folder this machine does not hold', () => {
    expect(offers([], '/nowhere/at/all')).toEqual([])
  })
})

describe('what gets written down', () => {
  it('writes the path the project holds when the folder is inside it', () => {
    expect(offers([IN_PROJECT], `${ROOT}/src/sh`)).toEqual(['src/shared'])
    expect(offers([PROJECT_ROOT], `${ROOT}/AG`)).toEqual(['AGENTS.md'])
  })

  it('writes the whole path when the folder is somewhere else', () => {
    expect(machineToken(HOME, 'notes.txt')).toBe('/Users/jamel/notes.txt')
    expect(machineToken({ ...HOME, dir: '/' }, 'Users')).toBe('/Users')
  })
})

describe('how the two lists stand together', () => {
  const menu = (query: string): string[] =>
    pathMenu(index, DIRS[machineDirQuery(query) ?? ''] ?? [], query, 10).map(match => match.path)

  it('holds what the project answers to above what the machine answers to', () => {
    expect(menu('/Users/jamel/Documents/Repositories/crew/src/')).toEqual(['src/main', 'src/shared'])
  })

  it('leaves a project path exactly as it was', () => {
    expect(menu('src/shared')).toEqual(['src/shared', 'src/shared/files.ts', 'src/shared/pathMention.ts'])
  })

  it('says the same thing once', () => {
    const shown = menu(`${ROOT}/`)
    expect(shown).toEqual([...new Set(shown)])
  })
})

describe('what is marked out in the box', () => {
  const known = new Set(revealedBy([HOME]))

  it('marks a path the menu has already read off this machine', () => {
    expect(pathRuns('open /Users/jamel/notes.txt now', index, known)).toEqual([
      { text: 'open ', path: false },
      { text: '/Users/jamel/notes.txt', path: true },
      { text: ' now', path: false }
    ])
  })

  it('marks a folder it has read, with the slash it was written with', () => {
    expect(pathRuns('/Users/jamel/Downloads/', index, known)).toEqual([
      { text: '/Users/jamel/Downloads/', path: true }
    ])
  })

  it('leaves a path nothing here has ever seen as plain words', () => {
    expect(pathRuns('/Users/someone/else.txt', index, known)).toEqual([
      { text: '/Users/someone/else.txt', path: false }
    ])
  })
})

describe('typing one into the composer', () => {
  const readDirs = async (query: string): Promise<MachineDir[]> => DIRS[query] ?? []
  window.crew = { listFiles: async () => FILES, readDirs } as unknown as typeof window.crew

  const boot = async () => {
    const { default: Chat } = await import('../src/renderer/src/views/Chat')
    const { useCrew } = await import('../src/renderer/src/state/store')
    useCrew.setState({
      connection: 'online',
      selfId: 'ali',
      selfName: 'ALI',
      place: `project:${ROOT}`,
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

  const type = (input: HTMLTextAreaElement, text: string) => {
    input.focus()
    fireEvent.change(input, { target: { value: text, selectionStart: text.length, selectionEnd: text.length } })
  }

  const shown = (): string[] =>
    [...document.querySelectorAll('[data-path]')].map(row => row.getAttribute('data-path') ?? '')

  it('opens on a folder off this machine', async () => {
    const input = await boot()
    type(input, '/Users/jamel/Do')
    await waitFor(() => expect(shown()).toEqual(['/Users/jamel/Documents', '/Users/jamel/Downloads']))
  })

  it('writes the whole path and walks into the folder it wrote', async () => {
    const input = await boot()
    type(input, '/Users/jamel/Down')
    await waitFor(() => expect(shown()).toEqual(['/Users/jamel/Downloads']))
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.value).toBe('/Users/jamel/Downloads/')
  })

  it('writes the path the project holds for a folder inside it', async () => {
    const input = await boot()
    type(input, `${ROOT}/src/sh`)
    await waitFor(() => expect(shown()).toEqual(['src/shared']))
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.value).toBe('src/shared/')
  })
})
