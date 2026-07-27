// Flappy Bird, as numbers. The world is a fixed size and the panel scales it, so
// the game plays the same in a narrow side panel as in a wide one, and a test can
// fly the whole thing without drawing any of it.

export const WORLD = { width: 240, height: 360 }
export const GROUND = 36
export const BIRD = { x: 76, r: 9 }
export const PIPE = { width: 40, gap: 104, spacing: 132 }

const GRAVITY = 900
const FLAP = -270
const SPEED = 96
// A pipe's gap never opens right at the ceiling or right on the ground: there
// has to be somewhere to fly to.
const MARGIN = 40

export interface Pipe {
  x: number
  // The middle of the gap, measured from the top of the world.
  gap: number
  passed: boolean
}

export interface Flappy {
  y: number
  vy: number
  pipes: Pipe[]
  score: number
  // A game that has not been flapped yet holds the bird up rather than dropping
  // it before anyone has touched a key.
  started: boolean
  over: boolean
}

export type Rand = () => number

const floor = WORLD.height - GROUND

const gapAt = (rand: Rand): number => MARGIN + rand() * (floor - MARGIN * 2)

export function newFlappy(rand: Rand = Math.random): Flappy {
  return {
    y: WORLD.height / 2 - GROUND / 2,
    vy: 0,
    pipes: [
      { x: WORLD.width + 40, gap: gapAt(rand), passed: false },
      { x: WORLD.width + 40 + PIPE.spacing, gap: gapAt(rand), passed: false }
    ],
    score: 0,
    started: false,
    over: false
  }
}

export function flap(game: Flappy): Flappy {
  if (game.over) return game
  return { ...game, started: true, vy: FLAP }
}

// The ceiling is a wall rather than a way to die. Flying off the top of the
// screen ends nothing in the game this is: the pipes above still catch a bird
// that tries to go over them, which is what it is really being kept out of.
const hits = (game: Flappy): boolean => {
  if (game.y + BIRD.r >= floor) return true
  return game.pipes.some(pipe => {
    const near = BIRD.x + BIRD.r > pipe.x && BIRD.x - BIRD.r < pipe.x + PIPE.width
    if (!near) return false
    return game.y - BIRD.r < pipe.gap - PIPE.gap / 2 || game.y + BIRD.r > pipe.gap + PIPE.gap / 2
  })
}

// One frame. The step is handed in rather than read off a clock, so a slow frame
// moves the world by what it was really worth and a test can step it exactly.
export function tick(game: Flappy, dt: number, rand: Rand = Math.random): Flappy {
  if (game.over) return game
  if (!game.started) return game
  const fell = game.vy + GRAVITY * dt
  const rose = game.y + fell * dt
  const y = Math.max(rose, BIRD.r)
  const vy = y > rose ? 0 : fell
  const moved = game.pipes.map(pipe => ({ ...pipe, x: pipe.x - SPEED * dt }))
  const scored = moved.filter(pipe => !pipe.passed && pipe.x + PIPE.width < BIRD.x - BIRD.r).length
  for (const pipe of moved) if (pipe.x + PIPE.width < BIRD.x - BIRD.r) pipe.passed = true
  const kept = moved.filter(pipe => pipe.x + PIPE.width > -4)
  const last = kept[kept.length - 1]
  const pipes =
    last && last.x < WORLD.width
      ? [...kept, { x: last.x + PIPE.spacing, gap: gapAt(rand), passed: false }]
      : kept
  const next: Flappy = { ...game, y, vy, pipes, score: game.score + scored }
  return hits(next) ? { ...next, over: true, y: Math.min(next.y, floor - BIRD.r) } : next
}
