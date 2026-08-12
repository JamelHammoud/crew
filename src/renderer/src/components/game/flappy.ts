// Birdie, as numbers. The sky is as tall as it always is and as wide as the
// room it is given, the way a side view is: a wide panel holds more runway ahead
// of the bird rather than a stretched picture of the same one, and a test can fly
// the whole thing without drawing any of it.

export const SKY_HEIGHT = 360
// What the sky is before anything has been measured, and what a still is drawn
// at.
export const SKY_WIDTH = 240
export const GROUND = 36
export const BIRD = { r: 9 }
export const PIPE = { width: 40, gap: 104, spacing: 132 }

const GRAVITY = 900
const FLAP = -270
const SPEED = 96
// A pipe's gap never opens right at the ceiling or right on the ground: there
// has to be somewhere to fly to.
const MARGIN = 40
// Narrower than the narrowest panel anyone can drag, so it never stands between
// the sky and the field. It is only here because a box measured at nothing would
// otherwise put the bird and the first pipe in the same place.
const NARROWEST = 120

// How wide the sky is for a field of a given shape. It is worked out from the
// height so the scale is the same both ways: a bird is a circle in a panel of
// any width, and a pipe is the same width as the bird is tall wherever it stands.
export const skyWidth = (width: number, height: number): number =>
  height > 0 ? Math.max(NARROWEST, (SKY_HEIGHT * width) / height) : SKY_WIDTH

// The bird stands a third of the way in, wherever the far edge is, so the room a
// wider panel buys is runway ahead of it rather than a longer wait behind.
export const birdX = (width: number): number => width * 0.3

export interface Pipe {
  x: number
  // The middle of the gap, measured from the top of the world.
  gap: number
  passed: boolean
}

export interface Flappy {
  // How wide the sky is right now. It rides on the game rather than standing as
  // a constant, because the field is whatever the panel left over and the panel
  // can be dragged.
  width: number
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

export const floor = SKY_HEIGHT - GROUND

const gapAt = (rand: Rand): number => MARGIN + rand() * (floor - MARGIN * 2)

export function newFlappy(width: number = SKY_WIDTH, rand: Rand = Math.random): Flappy {
  return {
    width,
    y: SKY_HEIGHT / 2 - GROUND / 2,
    vy: 0,
    pipes: [
      { x: width + 40, gap: gapAt(rand), passed: false },
      { x: width + 40 + PIPE.spacing, gap: gapAt(rand), passed: false }
    ],
    score: 0,
    started: false,
    over: false
  }
}

// The panel can be dragged while a round is running, so the sky takes the width
// it is given and the pipes keep the place they had in it.
export const widen = (game: Flappy, width: number): Flappy => (width === game.width ? game : { ...game, width })

export function flap(game: Flappy): Flappy {
  if (game.over) return game
  return { ...game, started: true, vy: FLAP }
}

// The ceiling is a wall rather than a way to die. Flying off the top of the
// screen ends nothing in the game this is: the pipes above still catch a bird
// that tries to go over them, which is what it is really being kept out of.
const hits = (game: Flappy): boolean => {
  if (game.y + BIRD.r >= floor) return true
  const x = birdX(game.width)
  return game.pipes.some(pipe => {
    const near = x + BIRD.r > pipe.x && x - BIRD.r < pipe.x + PIPE.width
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
  const behind = birdX(game.width) - BIRD.r
  const moved = game.pipes.map(pipe => ({ ...pipe, x: pipe.x - SPEED * dt }))
  const scored = moved.filter(pipe => !pipe.passed && pipe.x + PIPE.width < behind).length
  for (const pipe of moved) if (pipe.x + PIPE.width < behind) pipe.passed = true
  const kept = moved.filter(pipe => pipe.x + PIPE.width > -4)
  const last = kept[kept.length - 1]
  const pipes =
    last && last.x < game.width ? [...kept, { x: last.x + PIPE.spacing, gap: gapAt(rand), passed: false }] : kept
  const next: Flappy = { ...game, y, vy, pipes, score: game.score + scored }
  return hits(next) ? { ...next, over: true, y: Math.min(next.y, floor - BIRD.r) } : next
}
