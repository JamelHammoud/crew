const SAMPLE_MS = 90
const START_LEVEL = 0.028
const STOP_LEVEL = 0.014
const HOLD_MS = 550

interface Watched {
  analyser: AnalyserNode
  source: MediaStreamAudioSourceNode
  buffer: Float32Array
  loudUntil: number
  speaking: boolean
}

// A ring around whoever is talking. Levels are read straight off the audio
// graph, and a short hold keeps the ring steady through the gaps in a sentence.
export class SpeakingMonitor {
  private context: AudioContext | null = null
  private watched = new Map<string, Watched>()
  private timer: number | null = null

  constructor(private onChange: (speaking: string[]) => void) {}

  watch(peerId: string, stream: MediaStream): void {
    if (this.watched.has(peerId)) return
    if (stream.getAudioTracks().length === 0) return
    const context = this.open()
    if (!context) return
    try {
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.4
      source.connect(analyser)
      this.watched.set(peerId, {
        analyser,
        source,
        buffer: new Float32Array(analyser.fftSize),
        loudUntil: 0,
        speaking: false
      })
      this.start()
    } catch {
      return
    }
  }

  unwatch(peerId: string): void {
    const entry = this.watched.get(peerId)
    if (!entry) return
    entry.source.disconnect()
    entry.analyser.disconnect()
    this.watched.delete(peerId)
    if (this.watched.size === 0) this.stop()
  }

  close(): void {
    for (const peerId of [...this.watched.keys()]) this.unwatch(peerId)
    this.stop()
    void this.context?.close().catch(() => {})
    this.context = null
    this.onChange([])
  }

  private open(): AudioContext | null {
    if (this.context) return this.context
    const Ctor = globalThis.AudioContext
    if (!Ctor) return null
    this.context = new Ctor()
    return this.context
  }

  private start(): void {
    if (this.timer !== null) return
    this.timer = globalThis.setInterval(() => this.tick(), SAMPLE_MS)
  }

  private stop(): void {
    if (this.timer === null) return
    globalThis.clearInterval(this.timer)
    this.timer = null
  }

  private tick(): void {
    const now = Date.now()
    let changed = false
    for (const entry of this.watched.values()) {
      entry.analyser.getFloatTimeDomainData(entry.buffer)
      let sum = 0
      for (const sample of entry.buffer) sum += sample * sample
      const level = Math.sqrt(sum / entry.buffer.length)
      if (level > START_LEVEL) entry.loudUntil = now + HOLD_MS
      const speaking = level > START_LEVEL || (entry.speaking && (level > STOP_LEVEL || entry.loudUntil > now))
      if (speaking !== entry.speaking) {
        entry.speaking = speaking
        changed = true
      }
    }
    if (!changed) return
    this.onChange([...this.watched].filter(([, entry]) => entry.speaking).map(([peerId]) => peerId))
  }
}
