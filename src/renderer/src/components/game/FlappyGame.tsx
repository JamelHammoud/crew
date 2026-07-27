import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { paintFlappy } from './drawFlappy'
import { WORLD, flap, newFlappy, tick, type Flappy } from './flappy'
import { Field, Overlay } from './GameStage'
import useGameLoop from './useGameLoop'

type Phase = 'ready' | 'playing' | 'over'

export default function FlappyGame({
  onScore,
  onLive,
  children
}: {
  onScore: (score: number) => void
  // What the header says while a game is running, the way it does in the other
  // game.
  onLive: (score: number | null) => void
  // What stands under the field while nobody is playing, the way it does in the
  // other game.
  children: ReactNode
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [game, setGame] = useState<Flappy>(() => newFlappy())
  const [phase, setPhase] = useState<Phase>('ready')
  // What the game really is right now. A flap between two frames has to land on
  // the game the next frame reads, or the frame overwrites it with the state it
  // started from and the flap is simply lost.
  const held = useRef(game)
  const put = useCallback((next: Flappy) => {
    held.current = next
    setGame(next)
  }, [])

  const start = useCallback(() => {
    put(flap(newFlappy()))
    setPhase('playing')
  }, [put])

  useGameLoop(
    useCallback(
      dt => {
        const next = tick(held.current, dt)
        put(next)
        if (canvas.current) paintFlappy(canvas.current, next)
      },
      [put]
    ),
    phase === 'playing'
  )

  useEffect(() => {
    if (canvas.current) paintFlappy(canvas.current, game)
  }, [game])

  useEffect(() => {
    onLive(phase === 'playing' ? game.score : null)
  }, [phase, game.score, onLive])

  useEffect(() => {
    if (phase !== 'playing' || !game.over) return
    setPhase('over')
    if (game.score > 0) onScore(game.score)
  }, [phase, game.over, game.score, onScore])

  const press = () => {
    if (phase === 'playing') put(flap(held.current))
    else start()
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
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
      {phase !== 'playing' && children}
    </div>
  )
}
