export type MediaRange = { kind: 'whole' } | { kind: 'slice'; start: number; end: number } | { kind: 'unsatisfiable' }

const WHOLE: MediaRange = { kind: 'whole' }
const OFF_THE_END: MediaRange = { kind: 'unsatisfiable' }

const ONE_RANGE = /^bytes=(\d*)-(\d*)$/i

export function rangeOf(header: string | null | undefined, size: number): MediaRange {
  if (!header) return WHOLE
  const asked = ONE_RANGE.exec(header.trim())
  if (!asked) return WHOLE
  const [, from, to] = asked
  if (!from && !to) return WHOLE
  if (!from) {
    const last = Number(to)
    if (last <= 0 || size === 0) return OFF_THE_END
    return { kind: 'slice', start: Math.max(0, size - last), end: size - 1 }
  }
  const start = Number(from)
  if (start >= size) return OFF_THE_END
  const end = to ? Math.min(Number(to), size - 1) : size - 1
  if (end < start) return OFF_THE_END
  return { kind: 'slice', start, end }
}
