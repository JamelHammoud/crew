import type { ListenIn, ListenOut } from './listen.worker'

export interface ListenerEars {
  onFetching: (file: string, loaded: number, total: number) => void
  onReady: () => void
  onFailed: (message: string) => void
}

// Whisper, asked one utterance at a time. What comes back is only ever handed
// on if it is still the utterance being waited for: somebody who talks again
// while the last one is being read has changed their mind, and the older answer
// is a sentence from before that.
export class VoiceListener {
  private worker: Worker | null = null
  private next = 0
  private waiting = new Map<number, (text: string) => void>()

  constructor(private readonly ears: ListenerEars) {}

  load(): void {
    this.hire()?.postMessage({ type: 'load' } satisfies ListenIn)
  }

  hear(audio: Float32Array): Promise<string> {
    const worker = this.hire()
    if (!worker) return Promise.resolve('')
    const id = ++this.next
    return new Promise<string>(resolve => {
      this.waiting.set(id, resolve)
      worker.postMessage({ type: 'hear', id, audio } satisfies ListenIn, [audio.buffer])
    })
  }

  // Everything still in flight comes back as nothing, so no caller is left
  // holding a promise that will never settle.
  forget(): void {
    for (const resolve of this.waiting.values()) resolve('')
    this.waiting.clear()
  }

  close(): void {
    this.forget()
    this.worker?.terminate()
    this.worker = null
  }

  private hire(): Worker | null {
    if (this.worker) return this.worker
    if (typeof Worker === 'undefined') return null
    const worker = new Worker(new URL('./listen.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<ListenOut>) => this.heard(event.data)
    this.worker = worker
    return worker
  }

  private heard(message: ListenOut): void {
    if (message.type === 'fetching') return this.ears.onFetching(message.file, message.loaded, message.total)
    if (message.type === 'ready') return this.ears.onReady()
    if (message.type === 'failed') {
      if (message.id !== undefined) this.settle(message.id, '')
      else this.ears.onFailed(message.message)
      return
    }
    this.settle(message.id, message.text)
  }

  private settle(id: number, text: string): void {
    const resolve = this.waiting.get(id)
    if (!resolve) return
    this.waiting.delete(id)
    resolve(text)
  }
}
