// The words a row says about a number.

export function clock(seconds: number): string {
  const whole = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const minutes = `${Math.floor(whole / 60) % 60}:${String(whole % 60).padStart(2, '0')}`
  const hours = Math.floor(whole / 3600)
  return hours ? `${hours}:${minutes.padStart(5, '0')}` : minutes
}

export function tracks(count: number): string {
  if (count === 0) return 'No tracks'
  return count === 1 ? '1 track' : `${count} tracks`
}

// How long a list runs. A clock reads as a place in something, so a length is
// said in words instead.
export function span(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))
  if (whole < 60) return `${whole} sec`
  return `${Math.round(whole / 60)} min`
}
