export interface Size {
  w: number
  h: number
}

export interface Box extends Size {
  x: number
  y: number
}

const LIFT = 12
const EDGE = 12
const TOOLBAR = 84

// The bar hangs under what it is asking about, and never leaves the stage. A
// selection taller than the viewport, or standing at the bottom of it, has its
// own bottom edge off screen, and a bar pinned to that edge is drawn where
// nobody can see it.
export function askAnchor(target: Box | null, stage: Size, bar: Size): { x: number; y: number } {
  const floor = Math.max(EDGE, Math.round(stage.h - TOOLBAR - bar.h))
  if (!target) return { x: Math.max(EDGE, Math.round((stage.w - bar.w) / 2)), y: floor }
  const under = Math.round(target.y + target.h + LIFT)
  const above = Math.round(target.y - bar.h - LIFT)
  const y = under <= floor ? under : above >= EDGE ? above : floor
  const right = Math.max(EDGE, Math.round(stage.w - bar.w - EDGE))
  return { x: Math.min(Math.max(Math.round(target.x), EDGE), right), y: Math.min(Math.max(y, EDGE), floor) }
}
