import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import type { AgentStep } from '../src/shared/llm'

type EarEars = { onStart: () => void; onEnd: (audio: Float32Array | null) => void }
type MouthEars = { onReady: () => void; onSaying: (text: string) => void; onQuiet: () => void }

const caught: { ear: EarEars | null; mouth: MouthEars | null } = { ear: null, mouth: null }

const spoken: string[] = []
let talking = false
let pending = false

vi.mock('../src/renderer/src/media/voice/ear', () => ({
  VoiceEar: class {
    analyser = null
    constructor(ears: EarEars) {
      caught.ear = ears
    }
    open() {
      return Promise.resolve(null)
    }
    close() {}
    mute() {}
    guarded() {}
  }
}))

vi.mock('../src/renderer/src/media/voice/mouth', () => ({
  VoiceMouth: class {
    analyser = null
    constructor(ears: MouthEars) {
      caught.mouth = ears
    }
    load() {
      caught.mouth?.onReady()
    }
    open() {
      pending = true
      talking = false
    }
    push(text: string) {
      spoken.push(text)
      talking = true
    }
    seal() {}
    stop() {
      pending = false
      talking = false
    }
    get speaking() {
      return pending || talking
    }
    get talking() {
      return talking
    }
  }
}))

vi.mock('../src/renderer/src/media/voice/listener', () => ({
  VoiceListener: class {
    constructor(private readonly ears: { onReady: () => void }) {}
    load() {
      this.ears.onReady()
    }
    hear() {
      return Promise.resolve(heard)
    }
    forget() {}
  }
}))

let heard: { text: string } | null = null

const AGENT = { id: 'agent-1', status: 'online' }
const ASKED = 'what is in this project'

const crew = {
  agents: [AGENT],
  selfName: 'Ali',
  events: [] as SessionEvent[],
  steps: {} as Record<string, AgentStep[]>,
  sendChat: vi.fn()
}

let watchers: Array<(state: typeof crew) => void> = []

vi.mock('../src/renderer/src/state/store', () => ({
  useCrew: {
    getState: () => crew,
    subscribe: (fn: (state: typeof crew) => void) => {
      watchers.push(fn)
      return () => {
        watchers = watchers.filter(held => held !== fn)
      }
    }
  }
}))

vi.mock('../src/renderer/src/media/sounds', () => ({ hushChat: () => {}, playSound: () => {} }))

const push = () => {
  for (const watcher of watchers) watcher(crew)
}

const started = (promptId: string, text: string): SessionEvent =>
  ({
    kind: 'agent.start',
    promptId,
    threadId: 'thread-1',
    agentId: AGENT.id,
    byName: crew.selfName,
    promptText: text
  }) as unknown as SessionEvent

const ended = (promptId: string, text: string): SessionEvent =>
  ({ kind: 'agent.end', promptId, ok: true, text }) as unknown as SessionEvent

async function conversation() {
  const { useVoice } = await import('../src/renderer/src/state/voice')
  await useVoice.getState().start(AGENT.id)
  return useVoice
}

describe('somebody making a noise while the agent is working', () => {
  beforeEach(() => {
    vi.resetModules()
    caught.ear = null
    caught.mouth = null
    spoken.length = 0
    talking = false
    pending = false
    heard = null
    watchers = []
    crew.events = []
    crew.steps = {}
    crew.sendChat = vi.fn()
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {}
    })
  })

  // The whole wait for an answer used to read as the agent talking, so a cough
  // in it threw the question away and the answer arrived with nothing to say it.
  it('still speaks the answer after a cough while it was thinking', async () => {
    const useVoice = await conversation()
    heard = { text: ASKED }
    caught.ear!.onStart()
    caught.ear!.onEnd(new Float32Array(16))
    await vi.waitFor(() => expect(useVoice.getState().phase).toBe('thinking'))

    crew.events = [started('run-1', ASKED)]
    push()

    caught.ear!.onStart()
    caught.ear!.onEnd(null)
    expect(useVoice.getState().phase).toBe('thinking')

    crew.steps['run-1'] = [{ kind: 'text', text: 'It is a chat app.' } as AgentStep]
    crew.events = [started('run-1', ASKED), ended('run-1', 'It is a chat app.')]
    push()

    expect(spoken.join('')).toContain('It is a chat app.')
  })

  it('goes quiet the moment somebody talks over an answer being spoken', async () => {
    const useVoice = await conversation()
    heard = { text: ASKED }
    caught.ear!.onStart()
    caught.ear!.onEnd(new Float32Array(16))
    await vi.waitFor(() => expect(useVoice.getState().phase).toBe('thinking'))

    crew.steps['run-1'] = [{ kind: 'text', text: 'It is a chat app.' } as AgentStep]
    crew.events = [started('run-1', ASKED), ended('run-1', 'It is a chat app.')]
    push()
    expect(talking).toBe(true)

    caught.ear!.onStart()
    expect(talking).toBe(false)
    expect(useVoice.getState().phase).toBe('hearing')
  })
})
