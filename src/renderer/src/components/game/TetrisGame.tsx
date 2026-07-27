import { useCallback, useEffect, useRef, useState } from 'react'
import { Field, Overlay, Stat } from './GameStage'
import { BLOCKS, GHOST, LINE, block, fitCanvas, outline } from './paint'
import {
  COLS,
  ROWS,
  fallMs,
  hardDrop,
  levelOf,
  moveBy,
  newTetris,
  nextKind,
  restY,
  softDrop,
  fall,
  turn,
  type Tetris
} from './tetris'
import useGameLoop from './useGameLoop'

function paint(canvas: HTMLCanvasElement, game: Tetris): void {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const ctx = fitCanvas(canvas, width, height)
  if (!ctx) return
  const size = Math.min(width / COLS, height / ROWS)
  const left = (width - size * COLS) / 2
  const top = (height - size * ROWS) / 2
  ctx.clearRect(0, 0, width, height)

  ctx.strokeStyle = LINE
  ctx.lineWidth = 1
  for (let x = 1; x < COLS; x++) {
    ctx.beginPath()
    ctx.moveTo(left + x * size, top)
    ctx.lineTo(left + x * size, top + ROWS * size)
    ctx.stroke()
  }
  for (let y = 1; y < ROWS; y++) {
    ctx.beginPath()
    ctx.moveTo(left, top + y * size)
    ctx.lineTo(left + COLS * size, top + y * size)
    ctx.stroke()
  }

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const kind = game.board[y * COLS + x]
      if (kind) block(ctx, left + x * size, top + y * size, size, BLOCKS[kind])
    }
  }

  const piece = game.falling
  if (!piece) return
  // Where the piece would land, drawn as an outline. Without it a stack four
  // deep is guesswork in a panel this narrow.
  const rest = restY(game)
  for (const [cx, cy] of piece.cells) {
    const y = rest + cy
    if (y >= 0) outline(ctx, left + (piece.x + cx) * size, top + y * size, size, GHOST)
  }
  for (const [cx, cy] of piece.cells) {
    const y = piece.y + cy
    if (y >= 0) block(ctx, left + (piece.x + cx) * size, top + y * size, size, BLOCKS[piece.kind])
  }
}

export default function TetrisGame({ best, onScore }: { best: number; onScore: (score: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [game, setGame] = useState<Tetris>(() => newTetris())
  const [playing, setPlaying] = useState(false)
  const held = useRef(game)
  const since = useRef(0)
  held.current = game

  const start = useCallback(() => {
    setGame(newTetris())
    since.current = 0
    setPlaying(true)
  }, [])

  useGameLoop(
    useCallback(
      dt => {
        const now = held.current
        since.current += dt * 1000
        if (since.current >= fallMs(now)) {
          since.current = 0
          setGame(fall(now))
        }
        if (canvas.current) paint(canvas.current, held.current)
      },
      []
    ),
    playing && !game.over
  )

  // The last frame of a game that just ended still has to be painted, and the
  // loop has already stopped by then.
  useEffect(() => {
    if (canvas.current) paint(canvas.current, game)
  }, [game])

  useEffect(() => {
    if (!game.over || !playing) return
    setPlaying(false)
    if (game.score > 0) onScore(game.score)
  }, [game.over, game.score, playing, onScore])

  const key = (name: string) => {
    if (!playing) {
      if (name === ' ' || name === 'Enter') start()
      return
    }
    if (name === 'ArrowLeft') setGame(moveBy(held.current, -1))
    if (name === 'ArrowRight') setGame(moveBy(held.current, 1))
    if (name === 'ArrowUp' || name === 'x' || name === 'X') setGame(turn(held.current))
    if (name === 'ArrowDown') {
      since.current = 0
      setGame(softDrop(held.current))
    }
    if (name === ' ') {
      since.current = 0
      setGame(hardDrop(held.current))
    }
  }

  const next = nextKind(game)

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Stat label="Score" value={game.score.toLocaleString()} />
        <Stat label="Lines" value={String(game.lines)} />
        <Stat label="Level" value={String(levelOf(game))} />
        <Stat label="Best" value={best.toLocaleString()} />
      </div>
      <Field
        ratio={COLS / ROWS}
        onKeyDown={key}
        onPress={() => {
          if (!playing) start()
        }}
        overlay={
          playing ? null : game.score > 0 ? (
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
      {playing && next && (
        <p className="text-center text-xs text-fg-muted">
          Next <span className="font-semibold text-fg">{next}</span>
        </p>
      )}
    </div>
  )
}
