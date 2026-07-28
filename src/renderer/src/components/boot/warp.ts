// The field the app opens on, as numbers. Nothing here draws anything or knows
// what a canvas is, the way a game's rules stand apart from its picture.
export type Star = { x: number; y: number; z: number; tint: number }

export type View = { width: number; height: number; reach: number }

// Where the far plane is, and how close a star gets before it is behind you.
export const DEPTH = 1
export const NEAR = 0.055

// Lightspeed, and the drift it settles into once the crew has arrived.
export const LIGHT = 2.1
export const DRIFT = 0.03

// How long the field holds at speed before it drops out of it, and how long the
// drop takes. The mark lands on the end of that, so the two are one movement.
export const HOLD = 0.38
export const SETTLE = 1.15

// How far behind itself a star is smeared. One frame's travel is a few pixels
// and reads as a dot however fast the field is going, so the trail is stretched
// past it: that stretch is the whole of what makes speed look like speed.
export const TRAIL = 3.4

export function warpSpeed(t: number): number {
  if (t <= HOLD) return LIGHT
  const u = Math.min((t - HOLD) / SETTLE, 1)
  return LIGHT + (DRIFT - LIGHT) * (1 - Math.pow(1 - u, 3))
}

// A star stands somewhere on a disc facing the viewer, and the disc is wider
// than the window, so the corners are as full as the middle.
function spawn(random: () => number, z: number): Star {
  const angle = random() * Math.PI * 2
  const reach = Math.sqrt(random())
  return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach, z, tint: random() }
}

export function makeStars(count: number, random: () => number): Star[] {
  const stars: Star[] = []
  for (let i = 0; i < count; i++) stars.push(spawn(random, NEAR + random() * (DEPTH - NEAR)))
  return stars
}

// One frame of travel. A star that has gone past comes back at the far plane,
// so the field never runs out however long the window is left open.
export function stepStars(stars: Star[], speed: number, dt: number, random: () => number): void {
  for (let i = 0; i < stars.length; i += 1) {
    const star = stars[i]
    star.z -= speed * dt
    if (star.z <= NEAR) stars[i] = spawn(random, DEPTH)
  }
}

export function viewOf(width: number, height: number): View {
  return { width, height, reach: Math.min(width, height) * 0.11 }
}

export function project(x: number, y: number, z: number, view: View): { x: number; y: number } {
  return { x: view.width / 2 + (x / z) * view.reach, y: view.height / 2 + (y / z) * view.reach }
}

// A star arrives out of the dark rather than switching on, and it is brightest
// once it is near. Both ends matter: without the first the far plane is a wall
// of dots blinking into being, and everything is the same star without the
// second.
export function brightness(z: number): number {
  const arriving = Math.min((DEPTH - z) / 0.3, 1)
  const near = 0.35 + 0.65 * (1 - z / DEPTH)
  return Math.max(0, arriving) * near
}
