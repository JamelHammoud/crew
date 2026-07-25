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

let room: ConvolverNode | null = null

export function reverb(ctx: AudioContext): ConvolverNode | null {
  if (room) return room
  if (!ctx.createConvolver) return null
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
  room = ctx.createConvolver()
  room.buffer = tail
  room.connect(ctx.destination)
  return room
}
