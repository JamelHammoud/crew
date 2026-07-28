import { useEffect, useRef } from 'react'
import useGameLoop from '../game/useGameLoop'
import { paintWarp } from './drawWarp'
import { makeNebula } from './nebula'
import { makeStars, stepStars, viewOf, warpSpeed, type Star } from './warp'

const STARS = 460

// The cloud is worked out once and then only ever drawn, so its detail costs
// nothing per frame. It is drawn stretched, which is why it is written smaller
// than the window: a nebula has no edge for an upscale to soften.
const CLOUD = { width: 520, height: 340 }

// Two of them, because the layers have to be able to move against each other.
// The first is drawn before anything else happens and the second on the frame
// after, so the flight starts on time rather than waiting on both.
const CLOUDS = 2

function drawNebula(): HTMLCanvasElement | null {
  const el = document.createElement('canvas')
  el.width = CLOUD.width
  el.height = CLOUD.height
  const ctx = el.getContext('2d')
  if (!ctx) return null
  const cloud = makeNebula(CLOUD.width, CLOUD.height, Math.floor(Math.random() * 100000))
  ctx.putImageData(new ImageData(cloud.pixels, cloud.width, cloud.height), 0, 0)
  return el
}

// The flight the app opens on. It is drawn straight onto the canvas every
// frame, never held in state, the way the music's bars are: a render a frame
// would cost more than the picture is worth.
export default function WarpField({ still }: { still: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const stars = useRef<Star[]>([])
  const clouds = useRef<HTMLCanvasElement[]>([])
  const age = useRef(0)
  const travel = useRef(0)

  useEffect(() => {
    stars.current = makeStars(STARS, Math.random)
    const first = drawNebula()
    clouds.current = first ? [first] : []
    let timer = 0
    const more = () => {
      const next = drawNebula()
      if (next) clouds.current = [...clouds.current, next]
      if (clouds.current.length < CLOUDS) timer = window.setTimeout(more, 0)
    }
    timer = window.setTimeout(more, 0)
    return () => clearTimeout(timer)
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
    travel.current += speed * dt
    stepStars(stars.current, speed, dt, Math.random)
    const view = viewOf(el.clientWidth, el.clientHeight)
    paintWarp(ctx, stars.current, view, speed, dt, age.current, travel.current, clouds.current)
  }, !still)

  return <canvas ref={canvas} aria-hidden className="absolute inset-0 w-full h-full" />
}
