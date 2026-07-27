import { GROUND, WORLD, BIRD, type Flappy } from './flappy'
import { GROUND_COLOR, SKY, bird, fitCanvas, pipe } from './paint'

// The world is a fixed size and the field is whatever the panel left over, so
// the whole picture is scaled once and everything inside it is drawn in world
// units.
export function paintFlappy(canvas: HTMLCanvasElement, game: Flappy): void {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const ctx = fitCanvas(canvas, width, height)
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)
  ctx.save()
  ctx.scale(width / WORLD.width, height / WORLD.height)
  const floor = WORLD.height - GROUND
  ctx.fillStyle = SKY
  ctx.fillRect(0, 0, WORLD.width, WORLD.height)
  for (const one of game.pipes) pipe(ctx, one.x, one.gap, floor)
  ctx.fillStyle = GROUND_COLOR
  ctx.fillRect(0, floor, WORLD.width, GROUND)
  bird(ctx, BIRD.x, game.y, game.vy)
  ctx.restore()
}
