import { useEffect, useRef, useState } from 'react'
import { useVoice, voiceAnalyser } from '../../state/voice'
import useGameLoop from '../game/useGameLoop'
import { drawOrb } from './drawOrb'
import { BANDS, bandsFrom, restingOrb, stepOrb } from './orb'

// How much of the box the orb sits in at rest. The rest is the room its own
// light and its overshoot need: pinned to its own edge, a swell is cut off flat
// and reads as a straight line across the side of a sphere.
const ROOM = 0.56

const stillness = (): boolean =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

export default function VoiceOrb({ className = '' }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState(0)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setSize(Math.floor(Math.min(el.clientWidth, el.clientHeight)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const face = useRef(restingOrb())
  const read = useRef<number[]>(new Array(BANDS).fill(0))
  const spectrum = useRef<Uint8Array>(new Uint8Array(1024))

  useGameLoop(dt => {
    const node = canvas.current
    const ctx = node?.getContext('2d')
    if (!node || !ctx || size <= 0) return
    const still = stillness()
    const analyser = voiceAnalyser()
    if (analyser) {
      if (spectrum.current.length !== analyser.frequencyBinCount) {
        spectrum.current = new Uint8Array(analyser.frequencyBinCount)
      }
      analyser.getByteFrequencyData(spectrum.current)
      bandsFrom(spectrum.current, analyser.context.sampleRate, read.current)
    } else {
      read.current.fill(0)
    }
    const { phase, progress } = useVoice.getState()
    // The mesh is the agent's voice and nothing else. Your own turn leaves the
    // orb in the one color the mark wears at rest, so who is talking is read
    // off it without a word anywhere saying so.
    const lit = phase === 'speaking' || phase === 'thinking' ? 1 : 0
    stepOrb(face.current, dt, read.current, lit, phase === 'waking' ? progress : 1, still)

    const dpr = Math.min(2, globalThis.devicePixelRatio || 1)
    if (node.width !== size * dpr) {
      node.width = size * dpr
      node.height = size * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const ink = getComputedStyle(node).color
    drawOrb(ctx, face.current, size, (size / 2) * ROOM, { ink, ring: ink })
  }, size > 0)

  return (
    <div ref={box} className={`relative ${className}`} aria-hidden>
      <canvas
        ref={canvas}
        style={{ width: size, height: size }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-fg"
      />
    </div>
  )
}
