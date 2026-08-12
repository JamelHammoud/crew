import { useEffect, useRef } from 'react'
import { BLOCKS, FIELD, GROUND_COLOR, SKY, bird, block, fitCanvas, pipe } from './paint'
import type { Kind } from './tetris'

// A still of the game, painted with the game's own shapes rather than drawn as
// an icon. A row in the list is a picture of the thing it opens.
const STACK: { x: number; y: number; kind: Kind }[] = [
  { x: 0, y: 2, kind: 'L' },
  { x: 1, y: 2, kind: 'L' },
  { x: 2, y: 2, kind: 'S' },
  { x: 3, y: 2, kind: 'S' },
  { x: 0, y: 3, kind: 'J' },
  { x: 1, y: 3, kind: 'J' },
  { x: 2, y: 3, kind: 'J' },
  { x: 3, y: 3, kind: 'O' },
  { x: 1, y: 0, kind: 'T' },
  { x: 0, y: 1, kind: 'T' },
  { x: 1, y: 1, kind: 'T' },
  { x: 2, y: 1, kind: 'T' }
]

const tetris = (ctx: CanvasRenderingContext2D, width: number, height: number): void => {
  ctx.fillStyle = FIELD
  ctx.fillRect(0, 0, width, height)
  const size = height / 4.6
  const left = (width - size * 4) / 2
  const top = (height - size * 4) / 2
  for (const one of STACK) block(ctx, left + one.x * size, top + one.y * size, size, BLOCKS[one.kind])
}

const flappy = (ctx: CanvasRenderingContext2D, width: number, height: number): void => {
  ctx.fillStyle = SKY
  ctx.fillRect(0, 0, width, height)
  const floor = height * 0.84
  pipe(ctx, width * 0.66, height * 0.4, floor, width * 0.24, height * 0.42)
  ctx.fillStyle = GROUND_COLOR
  ctx.fillRect(0, floor, width, height - floor)
  bird(ctx, width * 0.3, height * 0.46, -120, height * 0.14)
}

const DRAW: Record<string, (ctx: CanvasRenderingContext2D, width: number, height: number) => void> = {
  tetris,
  flappy
}

export function drawCover(gameId: string, ctx: CanvasRenderingContext2D, width: number, height: number): void {
  DRAW[gameId]?.(ctx, width, height)
}

export default function GameCover({
  gameId,
  width,
  height,
  className = ''
}: {
  gameId: string
  width: number
  height: number
  className?: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = fitCanvas(el, width, height)
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    drawCover(gameId, ctx, width, height)
  }, [gameId, width, height])

  return <canvas ref={canvas} style={{ width, height }} className={`block shrink-0 ${className}`} />
}
