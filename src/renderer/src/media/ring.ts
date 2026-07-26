import { playStrikes, type Strike } from './strike'

export type Ring = { phrase: Strike[]; every: number; times: number }

export function ringLength(ring: Ring): number {
  const tail = Math.max(...ring.phrase.map(strike => strike.at + strike.length))
  return (ring.times - 1) * ring.every + tail
}

export function playRing(ring: Ring): () => void {
  const timers: ReturnType<typeof setTimeout>[] = []
  playStrikes(ring.phrase)
  for (let turn = 1; turn < ring.times; turn++) {
    timers.push(setTimeout(() => playStrikes(ring.phrase), turn * ring.every * 1000))
  }
  return () => {
    for (const timer of timers) clearTimeout(timer)
    timers.length = 0
  }
}
