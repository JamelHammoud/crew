import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { paintTetris } from './drawTetris'
import { Field, Overlay, type Box } from './GameStage'
import { fall, fallMs, hardDrop, moveBy, newTetris, softDrop, turn, type Tetris } from './tetris'
import useGameLoop from './useGameLoop'

type Phase = 'ready' | 'playing' | 'over'

export default function TetrisGame({
  onScore,
  onLive,
  children
}: {
  onScore: (score: number) => void
  // What the header says while a game is running, and nothing at all when one
  // is not: the score belongs on the one line the panel already has.
  onLive: (score: number | null) => void
  // The board, which stands on the overlay over the field rather than under it:
  // under it, the field changes size the moment a game starts.
  children: ReactNode
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [game, setGame] = useState<Tetris>(() => newTetris())
  const [phase, setPhase] = useState<Phase>('ready')
  const [box, setBox] = useState<Box>({ width: 0, height: 0 })
  const since = useRef(0)
  // What the game really is right now. A key pressed between two frames has to
  // land on the game the next frame reads, or the frame overwrites it with the
  // state it started from and the press is simply lost.
  const held = useRef(game)
  const put = useCallback((next: Tetris) => {
    held.current = next
    setGame(next)
  }, [])

  const start = useCallback(() => {
    put(newTetris())
    since.current = 0
    setPhase('playing')
  }, [put])

  useGameLoop(
    useCallback(
      dt => {
        const now = held.current
        since.current += dt * 1000
        const next = since.current >= fallMs(now) ? fall(now) : now
        if (next !== now) {
          since.current = 0
          put(next)
        }
        if (canvas.current) paintTetris(canvas.current, next)
      },
      [put]
    ),
    phase === 'playing'
  )

  // The last frame of a game that just ended still has to be painted, and the
  // loop has already stopped by then.
  useEffect(() => {
    if (canvas.current) paintTetris(canvas.current, game)
  }, [game, box])

  useEffect(() => {
    onLive(phase === 'playing' ? game.score : null)
  }, [phase, game.score, onLive])

  useEffect(() => {
    if (phase !== 'playing' || !game.over) return
    setPhase('over')
    if (game.score > 0) onScore(game.score)
  }, [phase, game.over, game.score, onScore])

  const key = (name: string) => {
    if (phase !== 'playing') {
      if (name === ' ' || name === 'Enter') start()
      return
    }
    if (name === 'ArrowLeft') put(moveBy(held.current, -1))
    if (name === 'ArrowRight') put(moveBy(held.current, 1))
    if (name === 'ArrowUp') put(turn(held.current))
    if (name === 'ArrowDown') {
      since.current = 0
      put(softDrop(held.current))
    }
    if (name === ' ') {
      since.current = 0
      put(hardDrop(held.current))
    }
  }

  return (
    <Field
      onKeyDown={key}
      onSize={setBox}
      onPress={() => {
        if (phase !== 'playing') start()
      }}
      overlay={
        phase === 'playing' ? null : phase === 'over' ? (
          <Overlay title="Game over" note={`${game.score.toLocaleString()} points`} label="Play again" onStart={start}>
            {children}
          </Overlay>
        ) : (
          <Overlay note="Arrows to move, space to drop" label="Play" onStart={start}>
            {children}
          </Overlay>
        )
      }
    >
      <canvas ref={canvas} className="block w-full h-full" />
    </Field>
  )
}
