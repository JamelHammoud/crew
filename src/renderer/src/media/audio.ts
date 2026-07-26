let shared: AudioContext | null = null

export function context(): AudioContext | null {
  const Ctor = globalThis.AudioContext
  if (!Ctor) return null
  if (!shared) shared = new Ctor()
  if (shared.state === 'suspended') void shared.resume().catch(() => {})
  return shared
}

let noise: AudioBuffer | null = null

export function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise) return noise
  const frames = Math.floor(ctx.sampleRate * 0.4)
  noise = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
  return noise
}

let tailBuffer: AudioBuffer | null = null

function impulse(ctx: AudioContext): AudioBuffer {
  if (tailBuffer) return tailBuffer
  const frames = Math.floor(ctx.sampleRate * 0.55)
  const tail = ctx.createBuffer(2, frames, ctx.sampleRate)
  let energy = 0
  for (let channel = 0; channel < 2; channel++) {
    const data = tail.getChannelData(channel)
    let held = 0
    for (let i = 0; i < frames; i++) {
      held = held * 0.62 + (Math.random() * 2 - 1) * 0.38
      data[i] = held * (1 - i / frames) ** 3.2
      energy += data[i] * data[i]
    }
  }
  const scale = energy > 0 ? 1 / Math.sqrt(energy / 2) : 1
  for (let channel = 0; channel < 2; channel++) {
    const data = tail.getChannelData(channel)
    for (let i = 0; i < frames; i++) data[i] *= scale
  }
  tailBuffer = tail
  return tail
}

// A room of one's own, hung off whatever it is handed. Anything with a volume of
// its own needs its own, or the wet half of every note walks past the control
// and out to the speakers at full strength.
export function convolver(ctx: AudioContext, out: AudioNode): ConvolverNode | null {
  if (!ctx.createConvolver) return null
  const node = ctx.createConvolver()
  node.buffer = impulse(ctx)
  node.connect(out)
  return node
}

let room: ConvolverNode | null = null

export function reverb(ctx: AudioContext): ConvolverNode | null {
  if (!room) room = convolver(ctx, ctx.destination)
  return room
}
