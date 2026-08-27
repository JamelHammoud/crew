// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../src/renderer/src/App'
import { useBrowser } from '../src/renderer/src/state/browser'
import { useCrew } from '../src/renderer/src/state/store'
import type { SessionEvent } from '../src/shared/events'
import type { PooledAgent } from '../src/shared/llm'
import { NO_UPDATE } from '../src/shared/update'
import { landed } from './helpers/boot'

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

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
landed()

const CLAUDE: PooledAgent = {
  id: 'ali/claude',
  label: 'Claude',
  provider: 'claude',
  ownerId: 'ali',
  ownerName: 'ALI',
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
}

const ASK = '@Claude the android build is failing on CI'
const FOLDER = '/Users/someone/Repositories/device-os'

const events: SessionEvent[] = [
  {
    id: 'thread-1-start',
    ts: 1,
    kind: 'thread.started',
    threadId: 'thread-1',
    agentId: CLAUDE.id,
    agentLabel: CLAUDE.label,
    title: ASK,
    byName: 'ALI'
  }
]

const online = {
  connection: 'online' as const,
  place: `project:${FOLDER}`,
  folder: FOLDER,
  joinLink: null,
  selfId: 'ali',
  selfName: 'ALI',
  members: [{ id: 'ali', name: 'ALI', connected: true }],
  agents: [CLAUDE],
  events,
  threads: {
    'thread-1': {
      id: 'thread-1',
      agentId: CLAUDE.id,
      agentLabel: CLAUDE.label,
      title: ASK,
      createdBy: 'ALI',
      status: 'open' as const,
      mode: 'build' as const
    }
  },
  threadPrompts: {},
  threadDrafts: {},
  threadCommands: {},
  queues: {},
  steps: {},
  tokens: {},
  pending: {}
}

const open = (ids: string[], focused: string | null): void => {
  useCrew.setState({ ...online, openThreadIds: ids, openThreadId: focused, chatColumn: false })
  render(createElement(App))
}

beforeEach(() => {
  document.title = 'Crew'
  window.crew = {
    warmTerminal: () => undefined,
    onUpdate: () => () => {},
    updateState: async () => NO_UPDATE
  } as unknown as CrewBridge
  useBrowser.setState({ open: false })
})

afterEach(cleanup)

describe('what a window says it is', () => {
  it('says the project and the page somebody is on', () => {
    open([], null)
    expect(document.title).toBe('device-os | Chat')
  })

  it('says the thread being read rather than the page it stands on', () => {
    open(['thread-1'], 'thread-1')
    expect(document.title).toBe('device-os | The android build is failing on CI')
  })

  it('follows somebody moving to another page', () => {
    open([], null)
    fireEvent.click(screen.getAllByRole('button', { name: /^Docs/ })[0])
    expect(document.title).toBe('device-os | Docs')
  })
})
