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
import { GROUND_COLOR, SKY, bird, fitCanvas, pipe } from './paint'
import useGameLoop from './useGameLoop'

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
  bird(ctx, BIRD.x, game.y, game.vy)
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
