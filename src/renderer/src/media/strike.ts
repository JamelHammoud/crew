import { context, noiseBuffer, reverb } from './audio'

export type Rasp = { hz: number; q: number; gain: number; length: number }

export type Strike = {
  hz: number
  at: number
  length: number
  gain?: number
  partials?: number[]
  bend?: number
  bendTime?: number
  detune?: number
  tone?: number
  wet?: number
  pan?: number
  rasp?: Rasp
}

const GAIN = 0.07
const ATTACK = 0.004

export function playStrikes(strikes: Strike[]): void {
  try {
    const ctx = context()
    if (!ctx) return
    for (const strike of strikes) strike_(ctx, strike)
  } catch {
    return
  }
}

function strike_(ctx: AudioContext, s: Strike): void {
  const start = ctx.currentTime + s.at
  const bus = ctx.createGain()
  bus.gain.value = (s.gain ?? 1) * GAIN

  const panner = ctx.createStereoPanner?.()
  if (panner) {
    panner.pan.value = s.pan ?? 0
    bus.connect(panner)
    panner.connect(ctx.destination)
  } else {
    bus.connect(ctx.destination)
  }

  const room = s.wet ? reverb(ctx) : null
  if (room) {
    const send = ctx.createGain()
    send.gain.value = s.wet ?? 0
    bus.connect(send)
    send.connect(room)
  }

  const body = ctx.createBiquadFilter()
  body.type = 'lowpass'
  body.Q.value = 0.6
  body.frequency.setValueAtTime(s.tone ?? s.hz * 6, start)
  body.frequency.exponentialRampToValueAtTime(Math.max(240, s.hz * 1.6), start + s.length)
  body.connect(bus)

  const detune = s.detune ?? 0
  const partials = s.partials ?? [1, 2.7]
  partials.forEach((ratio, i) => {
    const hz = s.hz * ratio
    const life = s.length / (1 + i * 0.85)
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = 'sine'
    osc.detune.value = i % 2 === 0 ? detune : -detune
    osc.frequency.setValueAtTime(hz * (s.bend ?? 1), start)
    osc.frequency.exponentialRampToValueAtTime(hz, start + (s.bendTime ?? 0.02))
    env.gain.setValueAtTime(0, start)
    env.gain.linearRampToValueAtTime(1 / (1 + i * 1.7), start + ATTACK)
    env.gain.exponentialRampToValueAtTime(0.0001, start + life)
    osc.connect(env)
    env.connect(body)
    osc.start(start)
    osc.stop(start + life + 0.02)
  })

  if (s.rasp) scrape(ctx, s.rasp, bus, start)
}

function scrape(ctx: AudioContext, rasp: Rasp, bus: GainNode, start: number): void {
  const source = ctx.createBufferSource()
  const band = ctx.createBiquadFilter()
  const env = ctx.createGain()
  source.buffer = noiseBuffer(ctx)
  band.type = 'bandpass'
  band.frequency.value = rasp.hz
  band.Q.value = rasp.q
  env.gain.setValueAtTime(0, start)
  env.gain.linearRampToValueAtTime(rasp.gain, start + 0.001)
  env.gain.exponentialRampToValueAtTime(0.0001, start + rasp.length)
  source.connect(band)
  band.connect(env)
  env.connect(bus)
  source.start(start)
  source.stop(start + rasp.length + 0.02)
}
