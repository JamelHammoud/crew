import { playStrikes, type Strike } from './strike'

export type Ring = { phrase: Strike[]; every: number; levels: number[] }

export function ringLength(ring: Ring): number {
  const tail = Math.max(...ring.phrase.map(strike => strike.at + strike.length))
  return (ring.levels.length - 1) * ring.every + tail
}

export function playRing(ring: Ring): () => void {
  const timers: ReturnType<typeof setTimeout>[] = []
  ring.levels.forEach((level, turn) => {
    const phrase = ring.phrase.map(strike => ({ ...strike, gain: (strike.gain ?? 1) * level }))
    if (turn === 0) playStrikes(phrase)
    else timers.push(setTimeout(() => playStrikes(phrase), turn * ring.every * 1000))
  })
  return () => {
    for (const timer of timers) clearTimeout(timer)
    timers.length = 0
  }
}
