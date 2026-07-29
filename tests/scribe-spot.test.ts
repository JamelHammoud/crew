import { describe, expect, it } from 'vitest'
import { grown, hold, middle, restSpot, spotFrom } from '../src/main/scribe-spot'

// Where the pill stands. None of this touches a window, which is the whole point
// of the placing being numbers: a screen that has been unplugged and a drag that
// ran off the edge of one are both answered here.

const SCREEN = { x: 0, y: 0, width: 1440, height: 860 }
const SECOND = { x: 1440, y: 0, width: 1920, height: 1080 }
const PILL = { width: 216, height: 56 }

describe('where the pill rests', () => {
  it('stands at the bottom middle of the screen', () => {
    const spot = restSpot(SCREEN, PILL)
    expect(spot.x).toBe(612)
    expect(spot.y).toBe(708)
  })

  it('rests inside the screen it is given', () => {
    const spot = restSpot(SECOND, PILL)
    expect(spot.x).toBeGreaterThanOrEqual(SECOND.x)
    expect(spot.y + PILL.height).toBeLessThanOrEqual(SECOND.y + SECOND.height)
  })

  it('clears the bottom of the screen', () => {
    expect(restSpot(SCREEN, PILL).y + PILL.height).toBeLessThan(SCREEN.height)
  })
})

describe('holding a spot on a real screen', () => {
  it('leaves one that is already inside where it is', () => {
    expect(hold({ x: 400, y: 300 }, PILL, SCREEN)).toEqual({ x: 400, y: 300 })
  })

  it('brings one dragged off the right back on', () => {
    const spot = hold({ x: 5000, y: 300 }, PILL, SCREEN)
    expect(spot.x + PILL.width).toBeLessThanOrEqual(SCREEN.width)
  })

  it('brings one dragged off the top back on', () => {
    expect(hold({ x: 400, y: -400 }, PILL, SCREEN).y).toBeGreaterThanOrEqual(SCREEN.y)
  })

  // A monitor that has been unplugged since the pill was left on it would put it
  // somewhere nobody can see. It comes back onto whatever screen is really here.
  it('brings one back from a screen that has gone', () => {
    const spot = hold({ x: 2200, y: 900 }, PILL, SCREEN)
    expect(spot.x).toBeLessThan(SCREEN.width)
    expect(spot.y).toBeLessThan(SCREEN.height)
  })

  it('holds it inside the screen it was dragged onto', () => {
    const spot = hold({ x: 3300, y: 200 }, PILL, SECOND)
    expect(spot.x).toBeGreaterThanOrEqual(SECOND.x)
    expect(spot.x + PILL.width).toBeLessThanOrEqual(SECOND.x + SECOND.width)
  })
})

describe('growing a line', () => {
  // The two buttons have to stay under the pointer already on the way to them,
  // which is what the bottom edge standing still buys.
  it('keeps the bottom edge where it was', () => {
    const box = { x: 400, y: 300, width: 216, height: 56 }
    expect(grown(box, 96, SCREEN)).toEqual({ x: 400, y: 260 })
  })

  it('keeps the left edge where it was', () => {
    const box = { x: 400, y: 300, width: 216, height: 56 }
    expect(grown(box, 96, SCREEN).x).toBe(400)
  })

  it('stays on the screen when it grows against the top of it', () => {
    const box = { x: 400, y: 10, width: 216, height: 56 }
    expect(grown(box, 140, SCREEN).y).toBeGreaterThanOrEqual(SCREEN.y)
  })
})

describe('reading a spot back', () => {
  it('takes a pair of numbers', () => {
    expect(spotFrom({ x: 10.4, y: 20.6 })).toEqual({ x: 10, y: 21 })
  })

  it('is nothing when nobody has moved it', () => {
    expect(spotFrom(null)).toBeNull()
    expect(spotFrom({})).toBeNull()
    expect(spotFrom({ x: 10 })).toBeNull()
    expect(spotFrom({ x: 'left', y: 20 })).toBeNull()
    expect(spotFrom({ x: Number.NaN, y: 20 })).toBeNull()
  })
})

describe('the middle of a box', () => {
  it('is what says which screen it is mostly over', () => {
    expect(middle({ x: 400, y: 300, width: 216, height: 56 })).toEqual({ x: 508, y: 328 })
  })
})
