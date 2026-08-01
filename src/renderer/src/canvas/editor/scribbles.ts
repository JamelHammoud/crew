import { Vec } from '../math'
import { uniqueId } from '../store'
import type { VecLike } from './types'

export interface TLScribble {
  id: string
  points: VecLike[]
  size: number
  color: string
  opacity: number
  state: 'starting' | 'paused' | 'active' | 'stopping' | 'complete'
  delay: number
  shrink: number
  taper: boolean
}

export interface ScribbleItem {
  id: string
  scribble: TLScribble
  timeoutMs: number
  delayRemaining: number
  prev: VecLike | null
  next: VecLike | null
}

interface ScribbleHost {
  updateInstanceState(update: { scribbles: TLScribble[] }): unknown
  getInstanceState(): { scribbles?: TLScribble[] }
}

const START_LENGTH = 8
const STOP_DELAY_MS = 200

export class ScribbleManager {
  private readonly items: ScribbleItem[] = []

  constructor(private readonly host: ScribbleHost) {}

  addScribble(scribble: Partial<TLScribble>, id = uniqueId()): ScribbleItem {
    const item: ScribbleItem = {
      id,
      scribble: {
        id,
        size: 20,
        color: 'accent',
        opacity: 0.8,
        delay: 0,
        points: [],
        shrink: 0.1,
        taper: true,
        ...scribble,
        state: 'starting'
      },
      timeoutMs: 0,
      delayRemaining: scribble.delay ?? 0,
      prev: null,
      next: null
    }
    this.items.push(item)
    return item
  }

  addPoint(id: string, x: number, y: number, z = 0.5): ScribbleItem | undefined {
    const item = this.items.find(candidate => candidate.id === id)
    if (!item) return undefined
    const point = { x, y, z }
    if (!item.prev || Vec.Dist(item.prev, point) >= 1) item.next = point
    return item
  }

  complete(id: string): ScribbleItem | undefined {
    const item = this.items.find(candidate => candidate.id === id)
    if (!item) return undefined
    if (item.scribble.state === 'starting' || item.scribble.state === 'active') {
      item.scribble.state = 'complete'
    }
    return item
  }

  stop(id: string): ScribbleItem | undefined {
    const item = this.items.find(candidate => candidate.id === id)
    if (!item) return undefined
    item.delayRemaining = Math.min(item.delayRemaining, STOP_DELAY_MS)
    item.scribble.state = 'stopping'
    return item
  }

  reset(): void {
    this.items.length = 0
    this.host.updateInstanceState({ scribbles: [] })
  }

  tick(elapsed: number): void {
    if (this.items.length === 0 && (this.host.getInstanceState().scribbles?.length ?? 0) === 0) return
    for (const item of this.items) this.tickItem(item, elapsed)
    for (let at = this.items.length - 1; at >= 0; at--) {
      if (this.items[at].scribble.points.length === 0) this.items.splice(at, 1)
    }
    this.host.updateInstanceState({
      scribbles: this.items
        .filter(item => item.scribble.points.length > 0)
        .map(item => ({ ...item.scribble, points: [...item.scribble.points] }))
    })
  }

  private tickItem(item: ScribbleItem, elapsed: number): void {
    const { scribble } = item

    if (scribble.state === 'starting') {
      if (item.next && item.next !== item.prev) {
        item.prev = item.next
        scribble.points.push(item.next)
      }
      if (scribble.points.length > START_LENGTH) scribble.state = 'active'
      return
    }

    if (item.delayRemaining > 0) item.delayRemaining = Math.max(0, item.delayRemaining - elapsed)
    item.timeoutMs += elapsed
    if (item.timeoutMs >= 16) item.timeoutMs = 0

    const { delayRemaining, timeoutMs, prev, next } = item

    if (scribble.state === 'active') {
      if (next && next !== prev) {
        item.prev = next
        scribble.points.push(next)
        if (delayRemaining === 0 && scribble.points.length > START_LENGTH) scribble.points.shift()
        return
      }
      if (timeoutMs !== 0) return
      if (scribble.points.length > 1) scribble.points.shift()
      else item.delayRemaining = scribble.delay
      return
    }

    if (scribble.state === 'stopping') {
      if (delayRemaining !== 0 || timeoutMs !== 0) return
      if (scribble.points.length <= 1) {
        scribble.points.length = 0
        return
      }
      if (scribble.shrink) scribble.size = Math.max(1, scribble.size * (1 - scribble.shrink))
      scribble.points.shift()
    }
  }
}
