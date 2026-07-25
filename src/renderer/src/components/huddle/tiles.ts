export interface TileGrid {
  columns: number
  width: number
}

const RATIO = 16 / 9

// The stage lays people out the way that makes each of them biggest, rather
// than the way that happens to be square, so nobody ends up small while there
// is room beside them.
export function fitTiles(count: number, width: number, height: number, gap: number): TileGrid {
  if (count <= 0 || width <= 0 || height <= 0) return { columns: Math.max(1, count), width: 0 }
  let best: TileGrid = { columns: 1, width: 0 }
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns)
    const across = (width - gap * (columns - 1)) / columns
    const down = ((height - gap * (rows - 1)) / rows) * RATIO
    const size = Math.floor(Math.min(across, down))
    if (size > best.width) best = { columns, width: size }
  }
  return best
}
