import { BIRD, SKY_HEIGHT, birdX, floor, skyWidth, type Flappy } from './flappy'
import { GROUND_COLOR, SKY, bird, fitCanvas, pipe } from './paint'

// The sky is as tall as it always is and as wide as the field, so the picture is
// scaled once, by its height, and everything inside it is drawn in world units.
// Scaling the two ways separately is what would turn the bird into an egg the
// moment the panel stopped being the shape the world was written at.
export function paintFlappy(canvas: HTMLCanvasElement, game: Flappy): void {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const ctx = fitCanvas(canvas, width, height)
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)
  const sky = skyWidth(width, height)
  ctx.save()
  ctx.scale(height / SKY_HEIGHT, height / SKY_HEIGHT)
  ctx.fillStyle = SKY
  ctx.fillRect(0, 0, sky, SKY_HEIGHT)
  for (const one of game.pipes) pipe(ctx, one.x, one.gap, floor)
  ctx.fillStyle = GROUND_COLOR
  ctx.fillRect(0, floor, sky, GROUND)
  bird(ctx, birdX(game.width), game.y, game.vy)
  ctx.restore()
}
