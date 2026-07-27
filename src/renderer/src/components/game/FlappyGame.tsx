import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { paintFlappy } from './drawFlappy'
import { flap, newFlappy, skyWidth, tick, widen, type Flappy } from './flappy'
import { Field, Overlay, type Box } from './GameStage'
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
  // The board, which stands on the overlay over the field rather than under it:
  // under it, the field changes size the moment a game starts.
  children: ReactNode
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [game, setGame] = useState<Flappy>(() => newFlappy())
  const [phase, setPhase] = useState<Phase>('ready')
  const [box, setBox] = useState<Box>({ width: 0, height: 0 })
  // The sky is as wide as the field is, so the picture is never stretched and a
  // wider panel is more runway rather than a bigger bird.
  const sky = skyWidth(box.width, box.height)
  // What the game really is right now. A flap between two frames has to land on
  // the game the next frame reads, or the frame overwrites it with the state it
  // started from and the flap is simply lost.
  const held = useRef(game)
  const put = useCallback((next: Flappy) => {
    held.current = next
    setGame(next)
  }, [])

  const start = useCallback(() => {
    put(flap(newFlappy(sky)))
    setPhase('playing')
  }, [put, sky])

  // The panel can be dragged mid-round, and the round carries on in the sky it
  // now has rather than in the one it started in.
  useEffect(() => {
    put(widen(held.current, sky))
  }, [sky, put])

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
  }, [game, width])

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
    <Field
      onKeyDown={name => {
        if (name === ' ' || name === 'ArrowUp' || name === 'Enter') press()
      }}
      onSize={setWidth}
      onPress={press}
      overlay={
        phase === 'playing' ? null : phase === 'over' ? (
          <Overlay
            title="Game over"
            note={game.score === 1 ? '1 pipe' : `${game.score} pipes`}
            label="Play again"
            onStart={start}
          >
            {children}
          </Overlay>
        ) : (
          <Overlay note="Space or click to flap" label="Play" onStart={start}>
            {children}
          </Overlay>
        )
      }
    >
      <canvas ref={canvas} className="block w-full h-full" />
    </Field>
  )
}
