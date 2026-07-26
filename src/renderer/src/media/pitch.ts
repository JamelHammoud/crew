const STEPS: Record<string, number> = {
  c: 0,
  cs: 1,
  d: 2,
  ds: 3,
  e: 4,
  f: 5,
  fs: 6,
  g: 7,
  gs: 8,
  a: 9,
  as: 10,
  b: 11
}

const NAME = /^([a-g]s?)(-?\d)$/

// A note by name, so a tune reads as notes rather than as a column of numbers.
// Anything that is not one comes back as nothing, and nothing is not played.
export function pitch(name: string): number {
  const found = NAME.exec(name)
  if (!found) return 0
  const step = STEPS[found[1]]
  if (step === undefined) return 0
  const midi = step + (Number(found[2]) + 1) * 12
  return 440 * 2 ** ((midi - 69) / 12)
}
