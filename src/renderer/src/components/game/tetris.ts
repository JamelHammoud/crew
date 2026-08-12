// Tetris, as numbers. Nothing here draws or listens: a move is a function from
// one game to the next, so the whole of it can be played out in a test without a
// canvas anywhere near it.

export const COLS = 10
export const ROWS = 20

export type Kind = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z'

export const KINDS: readonly Kind[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z']

export type Cell = [number, number]

// Each piece is drawn in a box of its own size, which is what the turn happens
// in: a square box is the only place a rotation lands where the eye expects it.
const SHAPES: Record<Kind, { size: number; cells: Cell[] }> = {
  I: {
    size: 4,
    cells: [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1]
    ]
  },
  J: {
    size: 3,
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1]
    ]
  },
  L: {
    size: 3,
    cells: [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1]
    ]
  },
  O: {
    size: 2,
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1]
    ]
  },
  S: {
    size: 3,
    cells: [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1]
    ]
  },
  T: {
    size: 3,
    cells: [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1]
    ]
  },
  Z: {
    size: 3,
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1]
    ]
  }
}

export const shapeOf = (kind: Kind): { size: number; cells: Cell[] } => ({
  size: SHAPES[kind].size,
  cells: SHAPES[kind].cells.map(([x, y]) => [x, y] as Cell)
})

export interface Falling {
  kind: Kind
  size: number
  cells: Cell[]
  x: number
  y: number
}

export interface Tetris {
  board: (Kind | null)[]
  falling: Falling | null
  // What is left of the bag. A bag holds one of each piece shuffled, so a run
  // of four S pieces cannot happen and neither can a drought of the long one.
  bag: Kind[]
  score: number
  lines: number
  over: boolean
}

export type Rand = () => number

const LINE_SCORE = [0, 100, 300, 500, 800]

export const cellAt = (board: (Kind | null)[], x: number, y: number): Kind | null =>
  x < 0 || x >= COLS || y < 0 || y >= ROWS ? null : board[y * COLS + x]

const shuffled = (rand: Rand): Kind[] => {
  const bag = [...KINDS]
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

// The bag is topped up as it is drawn from rather than once it is empty, so the
// piece after this one is always something the panel can show.
const drawn = (bag: Kind[], rand: Rand): { kind: Kind; bag: Kind[] } => {
  const held = bag.length > 0 ? bag : shuffled(rand)
  const rest = held.slice(1)
  return { kind: held[0], bag: rest.length > 0 ? rest : shuffled(rand) }
}

const spawned = (kind: Kind): Falling => {
  const shape = SHAPES[kind]
  return {
    kind,
    size: shape.size,
    cells: shape.cells.map(([x, y]) => [x, y] as Cell),
    x: Math.floor((COLS - shape.size) / 2),
    y: 0
  }
}

const fits = (board: (Kind | null)[], piece: Falling): boolean =>
  piece.cells.every(([cx, cy]) => {
    const x = piece.x + cx
    const y = piece.y + cy
    if (x < 0 || x >= COLS || y >= ROWS) return false
    return y < 0 || board[y * COLS + x] === null
  })

// The next piece comes in at the top, and a game where there is no room left for
// it is over. Nothing else ends it.
const nextPiece = (game: Tetris, rand: Rand): Tetris => {
  const { kind, bag } = drawn(game.bag, rand)
  const falling = spawned(kind)
  if (!fits(game.board, falling)) return { ...game, bag, falling: null, over: true }
  return { ...game, bag, falling }
}

export function newTetris(rand: Rand = Math.random): Tetris {
  const empty: Tetris = {
    board: Array<Kind | null>(COLS * ROWS).fill(null),
    falling: null,
    bag: [],
    score: 0,
    lines: 0,
    over: false
  }
  return nextPiece(empty, rand)
}

export const nextKind = (game: Tetris): Kind | null => game.bag[0] ?? null

// Ten lines to the level, and the fall gets quicker with every one of them. It
// stops getting quicker well before it becomes unplayable.
export const levelOf = (game: Tetris): number => Math.floor(game.lines / 10) + 1

export const fallMs = (game: Tetris): number => Math.max(90, 800 - (levelOf(game) - 1) * 70)

const cleared = (game: Tetris): Tetris => {
  const rows: (Kind | null)[][] = []
  let full = 0
  for (let y = 0; y < ROWS; y++) {
    const row = game.board.slice(y * COLS, y * COLS + COLS)
    if (row.every(cell => cell !== null)) full++
    else rows.push(row)
  }
  if (full === 0) return game
  const board = [...Array.from({ length: full }, () => Array<Kind | null>(COLS).fill(null)), ...rows].flat()
  const lines = game.lines + full
  return { ...game, board, lines, score: game.score + LINE_SCORE[full] * levelOf(game) }
}

const landed = (game: Tetris, rand: Rand): Tetris => {
  const piece = game.falling
  if (!piece) return game
  const board = [...game.board]
  for (const [cx, cy] of piece.cells) {
    const y = piece.y + cy
    if (y >= 0) board[y * COLS + piece.x + cx] = piece.kind
  }
  return nextPiece(cleared({ ...game, board, falling: null }), rand)
}

const moved = (piece: Falling, dx: number, dy: number): Falling => ({
  ...piece,
  x: piece.x + dx,
  y: piece.y + dy
})

export function moveBy(game: Tetris, dx: number): Tetris {
  if (!game.falling || game.over) return game
  const next = moved(game.falling, dx, 0)
  return fits(game.board, next) ? { ...game, falling: next } : game
}

// A turn that would land in the wall is tried a step either side of where it
// asked to be, which is what lets a piece stood against the edge still turn.
const KICKS = [0, -1, 1, -2, 2]

export function turn(game: Tetris): Tetris {
  const piece = game.falling
  if (!piece || game.over) return game
  const turned: Falling = {
    ...piece,
    cells: piece.cells.map(([x, y]) => [piece.size - 1 - y, x] as Cell)
  }
  for (const kick of KICKS) {
    const tried = moved(turned, kick, 0)
    if (fits(game.board, tried)) return { ...game, falling: tried }
  }
  return game
}

// One step of gravity. A piece that cannot fall any further is put down where it
// stands, which is also what a soft drop does when it runs out of room.
export function fall(game: Tetris, rand: Rand = Math.random): Tetris {
  if (!game.falling || game.over) return game
  const next = moved(game.falling, 0, 1)
  if (fits(game.board, next)) return { ...game, falling: next }
  return landed(game, rand)
}

export function softDrop(game: Tetris, rand: Rand = Math.random): Tetris {
  if (!game.falling || game.over) return game
  const next = moved(game.falling, 0, 1)
  if (!fits(game.board, next)) return landed(game, rand)
  return { ...game, falling: next, score: game.score + 1 }
}

export function restY(game: Tetris): number {
  const piece = game.falling
  if (!piece) return 0
  let y = piece.y
  while (fits(game.board, { ...piece, y: y + 1 })) y++
  return y
}

export function hardDrop(game: Tetris, rand: Rand = Math.random): Tetris {
  const piece = game.falling
  if (!piece || game.over) return game
  const y = restY(game)
  return landed({ ...game, falling: { ...piece, y }, score: game.score + (y - piece.y) * 2 }, rand)
}
