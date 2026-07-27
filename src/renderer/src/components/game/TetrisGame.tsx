import { useCallback, useEffect, useRef, useState } from 'react'
import { paintTetris } from './drawTetris'
import { Field, Overlay, Score } from './GameStage'
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

const SHOWN = 9
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
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <Score value={game.score} unit="points" best={best}>
        <span>Level</span>
        <span className="text-sm font-medium text-fg-secondary tabular-nums">{levelOf(game)}</span>
        <span className="px-1.5 text-fg-faint">·</span>
      </Score>
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
      {/* The piece after this one, on the line under the field rather than over
          the board: a chip floating in the corner of a Tetris field covers the
          rows that decide the game. */}
      <div className="shrink-0 h-[18px] flex items-center justify-center gap-2">
        {phase === 'playing' && (
          <>
            <span className="text-xs text-fg-muted">Next</span>
            <NextPiece kind={nextKind(game)} />
          </>
        )}
      </div>
    </div>
  )
}
