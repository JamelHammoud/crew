// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientMessage, ServerMessage } from '../src/shared/protocol'

const sockets: FakeSocket[] = []

class FakeSocket {
  sent: ClientMessage[] = []
  onMessage: (msg: ServerMessage) => void = () => {}
  onStatus: () => void = () => {}

  constructor() {
    sockets.push(this)
  }

  connect(): void {}
  send(msg: ClientMessage): void {
    this.sent.push(msg)
  }
  close(): void {}
}

vi.mock('../src/renderer/src/api/ws', () => ({ CrewSocket: FakeSocket }))
vi.mock('../src/renderer/src/media/sounds', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/renderer/src/media/sounds')>()
  return { ...actual, playSound: () => {} }
})

const { CHAT_KEY, useCrew } = await import('../src/renderer/src/state/store')

const socket = (): FakeSocket => sockets[0]

const refuse = (text: string, where?: string): void => socket().onMessage({ type: 'notice', text, unsent: true, where })

const picture = (id: string) => ({ id, name: 'shot.png', mime: 'image/png', size: 4, data: 'aaaa' })

describe('a message the host would not take', () => {
  beforeEach(() => {
    socket().sent = []
    useCrew.setState({
      chatDraft: '',
      chatCommands: [],
      threadDrafts: {},
      threadCommands: {},
      pending: {},
      agents: []
    })
  })

  it('puts the words, the chip and the files back in the chat', () => {
    useCrew.setState({ pending: { [CHAT_KEY]: [picture('one')] } })
    useCrew.getState().sendChat('rename the tabs', undefined, undefined, undefined, undefined, ['plan'])

    // The box is emptied on the way out, which is what makes this worth holding.
    expect(useCrew.getState().chatDraft).toBe('')
    expect(useCrew.getState().chatCommands).toEqual([])
    expect(useCrew.getState().pending[CHAT_KEY]).toEqual([])
    expect(socket().sent.some(m => m.type === 'chat.send')).toBe(true)

    refuse('Mention an agent with @ to say who should write the plan.')

    expect(useCrew.getState().chatDraft).toBe('rename the tabs')
    expect(useCrew.getState().chatCommands).toEqual(['plan'])
    expect(useCrew.getState().pending[CHAT_KEY]).toEqual([picture('one')])
  })

  it('puts a thread message back in that thread and nowhere else', () => {
    useCrew.getState().sendChat('@Flaky', 't1', undefined, undefined, undefined, ['fallback'])
    useCrew.getState().sendChat('carry on', 't2')

    refuse('Mention an agent with @ to say who takes over.', 't1')

    expect(useCrew.getState().threadDrafts.t1).toBe('@Flaky')
    expect(useCrew.getState().threadCommands.t1).toEqual(['fallback'])
    expect(useCrew.getState().threadDrafts.t2 ?? '').toBe('')
    expect(useCrew.getState().chatDraft).toBe('')
  })

  it('leaves a composer alone once something else has been typed in it', () => {
    useCrew.getState().sendChat('rename the tabs', undefined, undefined, undefined, undefined, ['plan'])
    useCrew.setState({ chatDraft: 'something else' })

    refuse('Mention an agent with @ to say who should write the plan.')

    expect(useCrew.getState().chatDraft).toBe('something else')
    expect(useCrew.getState().chatCommands).toEqual([])
  })

  it('holds nothing back when the message really went', () => {
    useCrew.getState().sendChat('@Bubbles have a look', undefined, undefined, undefined, ['a1'])
    socket().onMessage({ type: 'notice', text: ':tada: is already taken.' })

    expect(useCrew.getState().chatDraft).toBe('')
  })

  it('is handed back once, not again on the next refusal', () => {
    useCrew.getState().sendChat('rename the tabs', undefined, undefined, undefined, undefined, ['plan'])
    refuse('Mention an agent with @ to say who should write the plan.')
    expect(useCrew.getState().chatDraft).toBe('rename the tabs')

    useCrew.setState({ chatDraft: '', chatCommands: [] })
    refuse('Mention an agent with @ to say who should write the plan.')
    expect(useCrew.getState().chatDraft).toBe('')
  })
})
