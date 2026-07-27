// The words a row says about a number.

export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function tracks(count: number): string {
  if (count === 0) return 'Nothing in it yet'
  return count === 1 ? '1 track' : `${count} tracks`
}
