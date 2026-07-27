import { useCallback, useEffect, useRef, useState } from 'react'
import { paintTetris } from './drawTetris'
import { Field, Overlay, Stat } from './GameStage'
import { BLOCKS, block, fitCanvas } from './paint'
import {
  COLS,
  ROWS,
  fall,
  fallMs,
  hardDrop,
  levelOf,
  moveBy,
  newTetris,
  nextKind,
  shapeOf,
  softDrop,
  turn,
  type Kind,
  type Tetris
} from './tetris'
import useGameLoop from './useGameLoop'

const SHOWN = 11
const NEXT_BOX = { width: SHOWN * 4, height: SHOWN * 2 }

// The piece after this one, drawn to its own bounds rather than to its box, so
// the short ones are not left sitting off to one side of an empty square.
function NextPiece({ kind }: { kind: Kind | null }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = fitCanvas(el, NEXT_BOX.width, NEXT_BOX.height)
    if (!ctx) return
    ctx.clearRect(0, 0, NEXT_BOX.width, NEXT_BOX.height)
    if (!kind) return
    const cells = shapeOf(kind).cells
    const xs = cells.map(([x]) => x)
    const ys = cells.map(([, y]) => y)
    const left = (NEXT_BOX.width - (Math.max(...xs) - Math.min(...xs) + 1) * SHOWN) / 2 - Math.min(...xs) * SHOWN
    const top = (NEXT_BOX.height - (Math.max(...ys) - Math.min(...ys) + 1) * SHOWN) / 2 - Math.min(...ys) * SHOWN
    for (const [x, y] of cells) block(ctx, left + x * SHOWN, top + y * SHOWN, SHOWN, BLOCKS[kind])
  }, [kind])

  return <canvas ref={canvas} className="block" style={NEXT_BOX} />
}

type Phase = 'ready' | 'playing' | 'over'

export default function TetrisGame({ best, onScore }: { best: number; onScore: (score: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [game, setGame] = useState<Tetris>(() => newTetris())
  const [phase, setPhase] = useState<Phase>('ready')
  const held = useRef(game)
  const since = useRef(0)
  held.current = game

  const start = useCallback(() => {
    setGame(newTetris())
    since.current = 0
    setPhase('playing')
  }, [])

  useGameLoop(
    useCallback(dt => {
      const now = held.current
      since.current += dt * 1000
      if (since.current >= fallMs(now)) {
        since.current = 0
        setGame(fall(now))
      }
      if (canvas.current) paintTetris(canvas.current, held.current)
    }, []),
    phase === 'playing'
  )

  // The last frame of a game that just ended still has to be painted, and the
  // loop has already stopped by then.
  useEffect(() => {
    if (canvas.current) paintTetris(canvas.current, game)
  }, [game])

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
    if (name === 'ArrowLeft') setGame(moveBy(held.current, -1))
    if (name === 'ArrowRight') setGame(moveBy(held.current, 1))
    if (name === 'ArrowUp') setGame(turn(held.current))
    if (name === 'ArrowDown') {
      since.current = 0
      setGame(softDrop(held.current))
    }
    if (name === ' ') {
      since.current = 0
      setGame(hardDrop(held.current))
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex items-stretch gap-1.5">
        <Stat label="Score" value={game.score.toLocaleString()} />
        <Stat label="Level" value={String(levelOf(game))} />
        <Stat label="Best" value={best.toLocaleString()} />
        <div className="shrink-0 px-2.5 py-1.5 rounded-field bg-fg/[0.05] flex flex-col items-center gap-0.5">
          <span className="text-xs font-medium text-fg-muted">Next</span>
          <NextPiece kind={phase === 'playing' ? nextKind(game) : null} />
        </div>
      </div>
      <Field
        ratio={COLS / ROWS}
        onKeyDown={key}
        onPress={() => {
          if (phase !== 'playing') start()
        }}
        overlay={
          phase === 'playing' ? null : phase === 'over' ? (
            <Overlay
              title="Game over"
              note={`${game.score.toLocaleString()} points`}
              label="Play again"
              onStart={start}
            />
          ) : (
            <Overlay title="Tetris" note="Arrows to move, space to drop" label="Play" onStart={start} />
          )
        }
      >
        <canvas ref={canvas} className="block w-full h-full" />
      </Field>
    </div>
  )
}
