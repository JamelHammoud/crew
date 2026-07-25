const MAX_COLUMNS = 4

// Tiles fill the stage as close to square as they can, so nobody ends up in a
// letterbox while there is room beside them.
export function gridColumns(count: number): number {
  if (count <= 1) return 1
  return Math.min(MAX_COLUMNS, Math.ceil(Math.sqrt(count)))
}
