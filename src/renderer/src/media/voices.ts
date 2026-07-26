import type { Strike } from './strike'

// The app is made of one sound: a bubble, struck and left to ring. Everything it
// ever says is that bubble in a different size, which is why a chime, a ringing
// call and a tune all come from this one file rather than from three.
export type Voice = Omit<Strike, 'hz' | 'at' | 'length'> & { hz?: number }

// A low one holding the chord, the one that carries the tune, and a small bright
// one over the top.
export const DEEP: Voice = {
  gain: 0.5,
  partials: [1, 2.04],
  bend: 0.72,
  bendTime: 0.055,
  tone: 1500,
  wet: 0.12,
  rasp: { hz: 620, q: 0.9, gain: 0.06, length: 0.008 }
}

export const TUNE: Voice = {
  gain: 0.62,
  partials: [1, 2.04, 4.1],
  bend: 0.86,
  bendTime: 0.025,
  detune: 4,
  tone: 2400,
  wet: 0.26,
  rasp: { hz: 1100, q: 0.9, gain: 0.07, length: 0.008 }
}

export const SPARK: Voice = {
  gain: 0.24,
  partials: [1, 3.02],
  bend: 0.9,
  bendTime: 0.02,
  tone: 5200,
  wet: 0.42,
  rasp: { hz: 2600, q: 1.2, gain: 0.07, length: 0.007 }
}

// The three that keep time. A drum carries its own pitch, because there is no
// note to write for it: what is written down for a drum is only when it lands.
// All three are the same bubble with the tuning taken out of it, a hard bend on
// the low one and nothing but grain on the high ones, so the kit is made of the
// app rather than borrowed from somewhere else.
export const KICK: Voice = {
  hz: 52,
  gain: 1.5,
  partials: [1],
  bend: 5.6,
  bendTime: 0.055,
  tone: 340,
  wet: 0.02
}

export const HAT: Voice = {
  hz: 6000,
  gain: 0.42,
  partials: [],
  wet: 0.1,
  rasp: { hz: 7600, q: 0.8, gain: 0.5, length: 0.022 }
}

export const SNAP: Voice = {
  hz: 232,
  gain: 0.8,
  partials: [1, 2.4],
  bend: 1.7,
  bendTime: 0.012,
  tone: 2800,
  wet: 0.3,
  rasp: { hz: 2200, q: 0.6, gain: 0.62, length: 0.055 }
}

export const bubble = (voice: Voice, hz: number, at: number, length: number, pan = 0): Strike => ({
  ...voice,
  hz,
  at,
  length,
  pan
})
