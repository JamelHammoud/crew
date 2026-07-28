import { useEffect, useRef } from 'react'
import useGameLoop from '../game/useGameLoop'
import { paintWarp } from './drawWarp'
import { makeStars, stepStars, viewOf, warpSpeed, type Star } from './warp'

const STARS = 460

// The flight the app opens on. It is drawn straight onto the canvas every
// frame, never held in state, the way the music's bars are: a render a frame
// would cost more than the picture is worth.
export default function Warp({ still }: { still: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const stars = useRef<Star[]>([])
  const age = useRef(0)

  useEffect(() => {
    stars.current = makeStars(STARS, Math.random)
  }, [])

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const size = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      el.width = Math.round(el.clientWidth * ratio)
      el.height = Math.round(el.clientHeight * ratio)
      el.getContext('2d')?.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    size()
    const watching = new ResizeObserver(size)
    watching.observe(el)
    return () => watching.disconnect()
  }, [])

  useGameLoop(dt => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    age.current += dt
    const speed = warpSpeed(age.current)
    stepStars(stars.current, speed, dt, Math.random)
    paintWarp(ctx, stars.current, viewOf(el.clientWidth, el.clientHeight), speed, dt, age.current)
  }, !still)

  return <canvas ref={canvas} aria-hidden className="absolute inset-0 w-full h-full" />
}
