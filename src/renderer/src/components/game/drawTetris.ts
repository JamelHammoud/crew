import { BLOCKS, GHOST, LINE, block, fitCanvas, outline } from './paint'
import { COLS, ROWS, restY, type Tetris } from './tetris'

export function paintTetris(canvas: HTMLCanvasElement, game: Tetris): void {
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
