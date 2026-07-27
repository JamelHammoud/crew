import { useCallback, useEffect, useRef, useState } from 'react'
import { paintFlappy } from './drawFlappy'
import { WORLD, flap, newFlappy, tick, type Flappy } from './flappy'
import { Field, Overlay, Stat } from './GameStage'
import useGameLoop from './useGameLoop'

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
      if (canvas.current) paintFlappy(canvas.current, next)
    }, []),
    phase === 'playing'
  )

  useEffect(() => {
    if (canvas.current) paintFlappy(canvas.current, game)
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
