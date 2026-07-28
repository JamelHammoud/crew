import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpeakIn, SpeakOut } from '../src/renderer/src/media/voice/speak.worker'

// kokoro's own splitter, held to the one rule that matters here: it is closed
// once, and the second close throws. The model is a sentence per push.
vi.mock('kokoro-js', () => {
  class TextSplitterStream {
    private sentences: string[] = []
    private closed = false
    private wake: (() => void) | null = null

    push(...parts: string[]): void {
      if (this.closed) throw new Error('Stream is already closed.')
      for (const part of parts) if (part.trim()) this.sentences.push(part.trim())
      this.wake?.()
      this.wake = null
    }

    close(): void {
      if (this.closed) throw new Error('Stream is already closed.')
      this.closed = true
      this.wake?.()
      this.wake = null
    }

    async *[Symbol.asyncIterator](): AsyncGenerator<string> {
      for (;;) {
        if (this.sentences.length > 0) yield this.sentences.shift()!
        else if (this.closed) break
        else await new Promise<void>(resolve => (this.wake = resolve))
      }
    }
  }

  class KokoroTTS {
    static async from_pretrained(): Promise<KokoroTTS> {
      return new KokoroTTS()
    }
    async *stream(stream: TextSplitterStream): AsyncGenerator<{ text: string; audio: { audio: Float32Array } }> {
      for await (const text of stream) yield { text, audio: { audio: new Float32Array([0.5]) } }
    }
  }

  return { KokoroTTS, TextSplitterStream }
})

const said: SpeakOut[] = []
let hear: (message: MessageEvent<SpeakIn>) => void

const say = (message: SpeakIn): void => hear({ data: message } as MessageEvent<SpeakIn>)

// The model answers on a promise chain of its own, so a turn is given a few
// passes of the loop to reach the other end before it is read.
const settle = async (): Promise<void> => {
  for (let pass = 0; pass < 12; pass++) await new Promise(resolve => setTimeout(resolve, 0))
}

const spoken = (): string[] => said.filter(out => out.type === 'said').map(out => (out as { text: string }).text)

describe('the speak worker', () => {
  beforeEach(async () => {
    said.length = 0
    vi.resetModules()
    const self = { set onmessage(handler: (message: MessageEvent<SpeakIn>) => void) { hear = handler } }
    vi.stubGlobal('self', self)
    vi.stubGlobal('postMessage', (message: SpeakOut) => said.push(message))
    await import('../src/renderer/src/media/voice/speak.worker')
  })

  afterEach(() => vi.unstubAllGlobals())

  it('opens the next turn after the last one was closed', async () => {
    say({ type: 'open', turn: 1, voice: 'af_heart' })
    say({ type: 'push', turn: 1, text: 'The first thing.' })
    say({ type: 'close', turn: 1 })
    await settle()

    say({ type: 'open', turn: 2, voice: 'af_heart' })
    say({ type: 'push', turn: 2, text: 'The second thing.' })
    say({ type: 'close', turn: 2 })
    await settle()

    expect(spoken()).toEqual(['The first thing.', 'The second thing.'])
    expect(said.filter(out => out.type === 'failed')).toEqual([])
  })

  it('is stopped after a turn was closed without throwing', async () => {
    say({ type: 'open', turn: 1, voice: 'af_heart' })
    say({ type: 'push', turn: 1, text: 'Something.' })
    say({ type: 'close', turn: 1 })
    await settle()

    expect(() => say({ type: 'stop' })).not.toThrow()
    expect(() => say({ type: 'stop' })).not.toThrow()

    say({ type: 'open', turn: 2, voice: 'af_heart' })
    say({ type: 'push', turn: 2, text: 'After the stop.' })
    say({ type: 'close', turn: 2 })
    await settle()

    expect(spoken()).toEqual(['Something.', 'After the stop.'])
  })

  it('drops what the turn before it was still saying', async () => {
    say({ type: 'open', turn: 1, voice: 'af_heart' })
    say({ type: 'push', turn: 1, text: 'The old turn.' })
    say({ type: 'open', turn: 2, voice: 'af_heart' })
    say({ type: 'push', turn: 2, text: 'The new turn.' })
    say({ type: 'close', turn: 2 })
    await settle()

    expect(spoken()).toEqual(['The new turn.'])
    expect(said.filter(out => out.type === 'done')).toEqual([{ type: 'done', turn: 2 }])
  })
})
