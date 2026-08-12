import { BLOCKS, GHOST, LINE, WELL, block, fitCanvas, outline, roundRect } from './paint'
import { COLS, ROWS, restY, type Tetris } from './tetris'

// The field is the whole of the room the panel leaves and this board is one
// shape whatever that room is, so the well keeps a surround of its own. Run edge
// to edge it stops being a well and becomes the field.
const surround = (width: number, height: number): number => Math.min(24, Math.round(Math.min(width, height) * 0.05))

export function paintTetris(canvas: HTMLCanvasElement, game: Tetris): void {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const ctx = fitCanvas(canvas, width, height)
  if (!ctx) return
  const pad = surround(width, height)
  const size = Math.min((width - pad * 2) / COLS, (height - pad * 2) / ROWS)
  const left = (width - size * COLS) / 2
  const top = (height - size * ROWS) / 2
  ctx.clearRect(0, 0, width, height)

  // Sunk into the field rather than left to be guessed from where the grid
  // happens to stop, and everything the game draws is clipped to it, so a stack
  // that reaches the top corner is cut by the well rather than standing outside
  // it.
  ctx.save()
  roundRect(ctx, left, top, size * COLS, size * ROWS, Math.min(14, size * 0.4))
  ctx.clip()
  ctx.fillStyle = WELL
  ctx.fillRect(left, top, size * COLS, size * ROWS)

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
  if (piece) {
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
  ctx.restore()
}
