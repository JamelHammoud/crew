import { describe, expect, it } from 'vitest'
import { MESH_COLORS } from '../src/renderer/src/components/CrewMark'
import { drawOrb, withAlpha } from '../src/renderer/src/components/voice/drawOrb'
import {
  BANDS,
  bandsFrom,
  HARMONICS,
  ORB_BLOBS,
  orbRadius,
  orbReach,
  restingOrb,
  stepOrb
} from '../src/renderer/src/components/voice/orb'

const RATE = 48_000
const BINS = 1024

const spectrumAt = (hz: number, loudness: number): Uint8Array => {
  const spectrum = new Uint8Array(BINS)
  const width = RATE / 2 / BINS
  for (let bin = 0; bin < BINS; bin++) {
    const at = (bin + 0.5) * width
    if (at > hz / 2 && at < hz * 2) spectrum[bin] = loudness
  }
  return spectrum
}

const settle = (face: ReturnType<typeof restingOrb>, read: number[], lit: number, frames: number) => {
  for (let i = 0; i < frames; i++) stepOrb(face, 1 / 60, read, lit, 1)
}

const outline = (face: ReturnType<typeof restingOrb>, base = 100): number[] =>
  Array.from({ length: 120 }, (_, i) => orbRadius(face, (i / 120) * Math.PI * 2, base))

describe('reading a voice as a few numbers', () => {
  it('puts low sound in the low band and high sound in the high one', () => {
    const low = new Array(BANDS).fill(0)
    const high = new Array(BANDS).fill(0)
    bandsFrom(spectrumAt(110, 220), RATE, low)
    bandsFrom(spectrumAt(5000, 220), RATE, high)
    expect(low[0]).toBeGreaterThan(low[BANDS - 1])
    expect(high[BANDS - 1]).toBeGreaterThan(high[0])
  })

  it('is nothing at all on silence', () => {
    const read = new Array(BANDS).fill(0)
    expect(bandsFrom(new Uint8Array(BINS), RATE, read)).toBe(0)
    expect(read.every(band => band === 0)).toBe(true)
  })

  it('never reads past one, however loud', () => {
    const read = new Array(BANDS).fill(0)
    const level = bandsFrom(new Uint8Array(BINS).fill(255), RATE, read)
    expect(level).toBeLessThanOrEqual(1)
    expect(read.every(band => band <= 1)).toBe(true)
  })
})

describe('the shape the orb holds', () => {
  it('is a circle when there is nothing to hear', () => {
    const face = restingOrb()
    settle(face, new Array(BANDS).fill(0), 0, 120)
    const radii = outline(face)
    const spread = Math.max(...radii) - Math.min(...radii)
    expect(spread).toBeLessThan(0.5)
  })

  it('breathes rather than standing perfectly still', () => {
    const face = restingOrb()
    const quiet = new Array(BANDS).fill(0)
    settle(face, quiet, 0, 10)
    const first = orbRadius(face, 0, 100)
    settle(face, quiet, 0, 90)
    expect(Math.abs(orbRadius(face, 0, 100) - first)).toBeGreaterThan(0.2)
  })

  it('bends its edge to a voice rather than only growing', () => {
    const face = restingOrb()
    settle(face, [0.9, 0.7, 0.5, 0.4, 0.3], 1, 40)
    const radii = outline(face)
    const spread = Math.max(...radii) - Math.min(...radii)
    expect(spread).toBeGreaterThan(6)
  })

  it('swells with how loud the voice is', () => {
    const quiet = restingOrb()
    const loud = restingOrb()
    settle(quiet, new Array(BANDS).fill(0.05), 1, 60)
    settle(loud, new Array(BANDS).fill(1), 1, 60)
    expect(loud.swell).toBeGreaterThan(quiet.swell)
  })

  it('jumps to a syllable and falls away from it', () => {
    const face = restingOrb()
    const hit = new Array(BANDS).fill(1)
    stepOrb(face, 1 / 60, hit, 1, 1)
    const struck = face.bands[0]
    stepOrb(face, 1 / 60, new Array(BANDS).fill(0), 1, 1)
    const after = face.bands[0]
    expect(struck).toBeGreaterThan(0.4)
    expect(after).toBeGreaterThan(struck * 0.5)
    expect(after).toBeLessThan(struck)
  })

  it('never turns inside out, however loud everything is', () => {
    const face = restingOrb()
    settle(face, new Array(BANDS).fill(1), 1, 200)
    expect(Math.min(...outline(face))).toBeGreaterThan(0)
  })

  // The first harmonic would move the whole circle sideways rather than bend
  // its edge, so the orb would wander about the screen while it talked.
  it('never bends on the harmonic that would make it wander', () => {
    expect(HARMONICS).not.toContain(1)
    expect(HARMONICS).toHaveLength(BANDS)
  })

  it('stands still when the machine is asked to stand still', () => {
    const face = restingOrb()
    const before = outline(face)
    for (let i = 0; i < 60; i++) stepOrb(face, 1 / 60, new Array(BANDS).fill(1), 1, 1, true)
    expect(outline(face)).toEqual(before)
  })

  // Standing still is about motion. How far the download has got, and who is
  // talking, are things the screen is saying rather than things it is doing.
  it('still says how far it has got and who is talking while standing still', () => {
    const face = restingOrb()
    for (let i = 0; i < 60; i++) stepOrb(face, 1 / 60, new Array(BANDS).fill(1), 1, 0.5, true)
    expect(face.ring).toBeGreaterThan(0.4)
    expect(face.lit).toBeGreaterThan(0.9)
  })
})

describe('the mesh the agent lights', () => {
  it('comes up while the agent talks and goes down while it listens', () => {
    const face = restingOrb()
    settle(face, new Array(BANDS).fill(0.5), 1, 60)
    expect(face.lit).toBeGreaterThan(0.9)
    settle(face, new Array(BANDS).fill(0.5), 0, 60)
    expect(face.lit).toBeLessThan(0.1)
  })

  it('invents no palette of its own', () => {
    expect(ORB_BLOBS.map(blob => blob.color)).toEqual([...MESH_COLORS])
  })

  it('stands every blob inside the orb rather than off the side of it', () => {
    for (const blob of ORB_BLOBS) {
      expect(Math.hypot(blob.x, blob.y) + blob.reach).toBeLessThan(1)
    }
  })
})

// The light the orb throws is the orb's own outline, blurred. Painted wider
// than the canvas it is cut off flat at all four sides, which reads as a grey
// square standing behind a sphere.
describe('the light the orb throws', () => {
  const painted = (face: ReturnType<typeof restingOrb>, size: number, base: number) => {
    const points: number[] = []
    let blur = 0
    const ctx = {
      filter: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      lineCap: '',
      globalAlpha: 1,
      globalCompositeOperation: '',
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      beginPath: () => {},
      closePath: () => {},
      clip: () => {},
      stroke: () => {},
      arc: () => {},
      fillRect: () => {},
      createRadialGradient: () => ({ addColorStop: () => {} }),
      moveTo: (x: number, y: number) => points.push(Math.hypot(x, y)),
      quadraticCurveTo: (x: number, y: number, toX: number, toY: number) => {
        points.push(Math.hypot(x, y), Math.hypot(toX, toY))
      },
      fill: () => {
        blur = Number(/blur\(([\d.]+)px\)/.exec(String(ctx.filter))?.[1] ?? 0)
      }
    }
    const before = points.length
    drawOrb(ctx as unknown as CanvasRenderingContext2D, face, size, base, { ink: '#ffffff', ring: '#ffffff' })
    return { furthest: Math.max(...points.slice(before)), blur }
  }

  it('stands inside the box it is drawn in, quiet or loud', () => {
    const size = 340
    const base = (size / 2) * 0.56
    for (const level of [0, 0.5, 1]) {
      const face = restingOrb()
      settle(face, new Array(BANDS).fill(level), 1, 90)
      const { furthest, blur } = painted(face, size, base)
      expect(furthest + blur * 2).toBeLessThanOrEqual(size / 2)
    }
  })

  it('stands outside the orb rather than under it', () => {
    const face = restingOrb()
    settle(face, new Array(BANDS).fill(0.4), 1, 90)
    const base = 95
    const { furthest, blur } = painted(face, 340, base)
    expect(furthest).toBeGreaterThan(orbReach(face, base))
    expect(blur).toBeGreaterThan(0)
  })
})

describe('a color the app already holds, at an opacity', () => {
  it('reads the app palette', () => {
    expect(withAlpha('#2dd4ff', 0.5)).toBe('rgba(45, 212, 255, 0.5)')
    expect(withAlpha('#fff', 1)).toBe('rgba(255, 255, 255, 1)')
  })

  it('reads what the browser hands back for a css color', () => {
    expect(withAlpha('rgb(10, 20, 30)', 0.25)).toBe('rgba(10, 20, 30, 0.25)')
    expect(withAlpha('rgba(10, 20, 30, 0.9)', 0.25)).toBe('rgba(10, 20, 30, 0.25)')
  })
})
