import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BIRD,
  GROUND,
  PIPE,
  WORLD,
  flap,
  newFlappy,
  tick,
  type Flappy
} from './flappy'
import { Field, Overlay, Stat } from './GameStage'
import {
  BIRD_COLOR,
  BIRD_WING,
  GROUND_COLOR,
  PIPE_COLOR,
  PIPE_LIP,
  SKY,
  fitCanvas,
  roundRect
} from './paint'
import useGameLoop from './useGameLoop'

const LIP = { height: 12, out: 4 }

function bird(ctx: CanvasRenderingContext2D, y: number, vy: number): void {
  // The bird tips with what it is doing rather than staying level: a fall reads
  // as a fall, and a flap reads as one, without anything else being drawn.
  const tilt = Math.max(-0.5, Math.min(0.9, vy / 420))
  ctx.save()
  ctx.translate(BIRD.x, y)
  ctx.rotate(tilt)
  ctx.beginPath()
  ctx.arc(0, 0, BIRD.r, 0, Math.PI * 2)
  ctx.fillStyle = BIRD_COLOR
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-2, 1.5, BIRD.r * 0.55, BIRD.r * 0.4, -0.3, 0, Math.PI * 2)
  ctx.fillStyle = BIRD_WING
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(BIRD.r * 0.6, -1)
  ctx.lineTo(BIRD.r * 1.5, 1)
  ctx.lineTo(BIRD.r * 0.6, 3)
  ctx.closePath()
  ctx.fillStyle = BIRD_WING
  ctx.fill()
  ctx.beginPath()
  ctx.arc(BIRD.r * 0.35, -BIRD.r * 0.35, 1.6, 0, Math.PI * 2)
  ctx.fillStyle = '#2b2f45'
  ctx.fill()
  ctx.restore()
}

function pipe(ctx: CanvasRenderingContext2D, x: number, gap: number, floor: number): void {
  const top = gap - PIPE.gap / 2
  const bottom = gap + PIPE.gap / 2
  ctx.fillStyle = PIPE_COLOR
  roundRect(ctx, x, -12, PIPE.width, top + 12, 5)
  ctx.fill()
  roundRect(ctx, x, bottom, PIPE.width, floor - bottom + 12, 5)
  ctx.fill()
  ctx.fillStyle = PIPE_LIP
  roundRect(ctx, x - LIP.out, top - LIP.height, PIPE.width + LIP.out * 2, LIP.height, 4)
  ctx.fill()
  roundRect(ctx, x - LIP.out, bottom, PIPE.width + LIP.out * 2, LIP.height, 4)
  ctx.fill()
}

function paint(canvas: HTMLCanvasElement, game: Flappy): void {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const ctx = fitCanvas(canvas, width, height)
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)
  ctx.save()
  ctx.scale(width / WORLD.width, height / WORLD.height)
  const floor = WORLD.height - GROUND
  ctx.fillStyle = SKY
  ctx.fillRect(0, 0, WORLD.width, WORLD.height)
  for (const one of game.pipes) pipe(ctx, one.x, one.gap, floor)
  ctx.fillStyle = GROUND_COLOR
  ctx.fillRect(0, floor, WORLD.width, GROUND)
  bird(ctx, game.y, game.vy)
  ctx.restore()
}

type Phase = 'ready' | 'playing' | 'over'

export default function FlappyGame({ best, onScore }: { best: number; onScore: (score: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [game, setGame] = useState<Flappy>(() => newFlappy())
  const [phase, setPhase] = useState<Phase>('ready')
  const held = useRef(game)
  held.current = game

  const start = useCallback(() => {
    setGame(flap(newFlappy()))
    setPhase('playing')
  }, [])

  useGameLoop(
    useCallback(dt => {
      const next = tick(held.current, dt)
      held.current = next
      setGame(next)
      if (canvas.current) paint(canvas.current, next)
    }, []),
    phase === 'playing'
  )

  useEffect(() => {
    if (canvas.current) paint(canvas.current, game)
  }, [game])

  useEffect(() => {
    if (phase !== 'playing' || !game.over) return
    setPhase('over')
    if (game.score > 0) onScore(game.score)
  }, [phase, game.over, game.score, onScore])

  const press = () => {
    if (phase === 'playing') setGame(flap(held.current))
    else start()
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <Stat label="Pipes" value={String(game.score)} />
        <Stat label="Best" value={String(best)} />
      </div>
      <Field
        ratio={WORLD.width / WORLD.height}
        onKeyDown={name => {
          if (name === ' ' || name === 'ArrowUp' || name === 'Enter') press()
        }}
        onPress={press}
        overlay={
          phase === 'playing' ? null : phase === 'over' ? (
            <Overlay
              title="Game over"
              note={game.score === 1 ? '1 pipe' : `${game.score} pipes`}
              label="Play again"
              onStart={start}
            />
          ) : (
            <Overlay title="Flappy Bird" note="Space or click to flap" label="Play" onStart={start} />
          )
        }
      >
        <canvas ref={canvas} className="block w-full h-full" />
      </Field>
    </div>
  )
}
