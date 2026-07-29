export const EAR_PROCESSOR = 'crew-ear'

// Every sample, rather than whatever a poll happens to catch. An analyser hands
// back the last window it holds and nothing about the gaps between reads, which
// is fine for a ring around whoever is talking and useless for keeping the words
// themselves. The worklet gathers a block at a time so the main thread is woken
// a few dozen times a second instead of four hundred.
export const EAR_BLOCK = 2048

export const EAR_SOURCE = `
class CrewEar extends AudioWorkletProcessor {
  constructor() {
    super()
    this.held = new Float32Array(${EAR_BLOCK})
    this.at = 0
  }
  process(inputs) {
    const input = inputs[0] && inputs[0][0]
    if (!input) return true
    for (let i = 0; i < input.length; i++) {
      this.held[this.at++] = input[i]
      if (this.at === this.held.length) {
        this.port.postMessage(this.held)
        this.held = new Float32Array(${EAR_BLOCK})
        this.at = 0
      }
    }
    return true
  }
}
registerProcessor('${EAR_PROCESSOR}', CrewEar)
`

const loaded = new WeakSet<AudioContext>()

// Added once per context and kept, because everything that listens on this
// machine hears through the same one: the voice conversation and a dictation.
export async function loadEarWorklet(ctx: AudioContext): Promise<boolean> {
  if (loaded.has(ctx)) return true
  if (!ctx.audioWorklet) return false
  const url = URL.createObjectURL(new Blob([EAR_SOURCE], { type: 'application/javascript' }))
  try {
    await ctx.audioWorklet.addModule(url)
    loaded.add(ctx)
    return true
  } catch {
    return false
  } finally {
    URL.revokeObjectURL(url)
  }
}
