import { describe, expect, it } from 'vitest'
import {
  BIRD,
  GROUND,
  PIPE,
  WORLD,
  flap,
  newFlappy,
  tick,
  type Flappy
} from '../src/renderer/src/components/game/flappy'
import {
  COLS,
  KINDS,
  ROWS,
  cellAt,
  fall,
  fallMs,
  hardDrop,
  levelOf,
  moveBy,
  newTetris,
  nextKind,
  restY,
  shapeOf,
  softDrop,
  turn,
  type Kind,
  type Tetris
} from '../src/renderer/src/components/game/tetris'

// The rules of both games, played out without a canvas anywhere near them. A
// move is a function from one game to the next, which is the whole reason this
// can be checked at all.

// A deterministic bag, so a test knows which piece is coming.
const rand = (): number => 0

const withBoard = (game: Tetris, filled: (x: number, y: number) => Kind | null): Tetris => ({
  ...game,
  board: game.board.map((_, at) => filled(at % COLS, Math.floor(at / COLS)))
})

describe('tetris', () => {
  it('starts with a piece at the top and one more to come', () => {
    const game = newTetris(rand)
    expect(game.falling).not.toBeNull()
    expect(game.over).toBe(false)
    expect(KINDS).toContain(nextKind(game) as Kind)
  })

  it('moves sideways until it reaches the wall', () => {
    let game = newTetris(rand)
    for (let i = 0; i < COLS; i++) game = moveBy(game, -1)
    const at = game.falling?.x ?? 0
    expect(moveBy(game, -1).falling?.x).toBe(at)
    expect(at + Math.min(...(game.falling?.cells ?? []).map(([x]) => x))).toBe(0)
  })

  it('turns a piece inside its own box and turns it back after four', () => {
    const game = newTetris(rand)
    const first = JSON.stringify(game.falling?.cells)
    const round = turn(turn(turn(turn(game))))
    expect(JSON.stringify(round.falling?.cells)).toBe(first)
  })

  it('drops a piece to the floor and leaves it there', () => {
    const game = newTetris(rand)
    const kind = game.falling?.kind as Kind
    const dropped = hardDrop(game, rand)
    const bottom = dropped.board.slice((ROWS - 1) * COLS)
    expect(bottom.some(cell => cell === kind)).toBe(true)
    expect(dropped.falling?.y).toBe(0)
  })

  it('says where a piece would land', () => {
    const game = newTetris(rand)
    const rest = restY(game)
    expect(rest).toBeGreaterThan(game.falling?.y ?? 0)
    expect(restY(hardDrop(game, rand))).toBeGreaterThan(0)
  })

  // A row that fills up goes, everything above it comes down, and the score is
  // the level times what a row of that many is worth.
  it('clears a full row and pays for it', () => {
    const start = newTetris(rand)
    const piece = shapeOf('O')
    const game: Tetris = withBoard(
      { ...start, falling: { kind: 'O', size: piece.size, cells: piece.cells, x: 0, y: 0 } },
      (x, y) => (y === ROWS - 1 && x > 1 ? 'I' : null)
    )
    const landed = hardDrop(game, rand)
    expect(landed.lines).toBe(1)
    expect(landed.score).toBeGreaterThanOrEqual(100)
    expect(cellAt(landed.board, 0, ROWS - 1)).toBe('O')
    expect(cellAt(landed.board, 5, ROWS - 1)).toBeNull()
  })

  it('is over when the next piece has nowhere to stand', () => {
    const start = newTetris(rand)
    const game = withBoard(start, (_, y) => (y > 1 ? 'I' : null))
    const landed = hardDrop(game, rand)
    expect(landed.over).toBe(true)
    expect(landed.falling).toBeNull()
  })

  it('nothing moves once it is over', () => {
    const over: Tetris = { ...newTetris(rand), over: true }
    expect(moveBy(over, 1)).toBe(over)
    expect(turn(over)).toBe(over)
    expect(fall(over, rand)).toBe(over)
    expect(hardDrop(over, rand)).toBe(over)
  })

  it('gets quicker with every ten lines, and stops getting quicker', () => {
    const game = newTetris(rand)
    expect(levelOf(game)).toBe(1)
    expect(levelOf({ ...game, lines: 25 })).toBe(3)
    expect(fallMs({ ...game, lines: 25 })).toBeLessThan(fallMs(game))
    expect(fallMs({ ...game, lines: 900 })).toBeGreaterThanOrEqual(90)
  })

  it('puts a piece down when a soft drop runs out of room', () => {
    let game = newTetris(rand)
    for (let i = 0; i < ROWS + 2; i++) game = softDrop(game, rand)
    expect(game.board.some(cell => cell !== null)).toBe(true)
  })
})

const fly = (game: Flappy, seconds: number, flaps: number[] = []): Flappy => {
  let held = game
  const steps = Math.round(seconds * 60)
  for (let i = 0; i < steps; i++) {
    if (flaps.includes(i)) held = flap(held)
    held = tick(held, 1 / 60, rand)
  }
  return held
}

describe('flappy bird', () => {
  it('holds the bird up until it is flapped', () => {
    const game = newFlappy(rand)
    const waited = fly(game, 2)
    expect(waited.y).toBe(game.y)
    expect(waited.over).toBe(false)
  })

  it('falls once it has been flapped, and a flap sends it up', () => {
    const game = flap(newFlappy(rand))
    expect(fly(game, 0.1).y).toBeLessThan(game.y)
    const fallen = fly(game, 0.6)
    expect(flap(fallen).vy).toBeLessThan(fallen.vy)
  })

  it('ends on the ground', () => {
    const game = fly(flap(newFlappy(rand)), 4)
    expect(game.over).toBe(true)
    expect(game.y + BIRD.r).toBeLessThanOrEqual(WORLD.height - GROUND + 0.01)
  })

  // The ceiling is a wall rather than a way to die.
  it('stops at the ceiling rather than ending there', () => {
    const flaps = Array.from({ length: 40 }, (_, i) => i * 4)
    const game = fly(flap(newFlappy(rand)), 3, flaps)
    expect(game.y).toBeGreaterThanOrEqual(BIRD.r - 0.01)
    expect(game.pipes.length).toBeGreaterThan(0)
  })

  it('scores a pipe once it is behind the bird', () => {
    const start: Flappy = {
      ...newFlappy(rand),
      started: true,
      pipes: [{ x: BIRD.x - BIRD.r - PIPE.width + 1, gap: 160, passed: false }]
    }
    expect(start.score).toBe(0)
    const past = tick(start, 1 / 60, rand)
    expect(past.score).toBe(1)
    expect(tick(past, 1 / 60, rand).score).toBe(1)
  })

  it('ends on a pipe it flew into', () => {
    const start: Flappy = {
      ...newFlappy(rand),
      started: true,
      y: 40,
      pipes: [{ x: BIRD.x - PIPE.width / 2, gap: 240, passed: false }]
    }
    expect(tick(start, 1 / 60, rand).over).toBe(true)
  })

  it('lays down another pipe as the last one comes in', () => {
    const flown = fly(flap(newFlappy(rand)), 1.5, [0, 20, 40, 60, 80])
    expect(flown.pipes.length).toBeGreaterThanOrEqual(2)
    for (const pipe of flown.pipes) expect(pipe.gap).toBeGreaterThan(0)
  })

  it('nothing moves once it is over', () => {
    const over: Flappy = { ...newFlappy(rand), over: true }
    expect(tick(over, 1 / 60, rand)).toBe(over)
    expect(flap(over)).toBe(over)
  })
})
