export function rng(seed = ''): () => number {
  let x = 0
  let y = 0
  let z = 0
  let w = 0

  function next(): number {
    const t = x ^ (x << 11)
    x = y
    y = z
    z = w
    w ^= ((w >>> 19) ^ t ^ (t >>> 8)) >>> 0
    return (w / 0x100000000) * 2
  }

  for (let k = 0; k < seed.length + 64; k++) {
    x ^= seed.charCodeAt(k) | 0
    next()
  }

  return next
}

export function modulate(value: number, rangeA: number[], rangeB: number[], clamp = false): number {
  const [fromLow, fromHigh] = rangeA
  const [v0, v1] = rangeB
  const result = v0 + ((value - fromLow) / (fromHigh - fromLow)) * (v1 - v0)
  if (!clamp) return result
  return v0 < v1 ? Math.max(Math.min(result, v1), v0) : Math.max(Math.min(result, v0), v1)
}
