import { describe, expect, it } from 'vitest'
import { boundary, gapOf, landing, landingAt, room, shift } from '../src/renderer/src/components/reorder'

// Three of one width and a wide one on the end, laid out with a gap of 10.
const boxes = [
  { left: 0, width: 90 },
  { left: 100, width: 90 },
  { left: 200, width: 90 },
  { left: 300, width: 180 }
]

describe('where a dragged one lands', () => {
  it('stays where it is until its leading edge is past the one beside it', () => {
    expect(landing(boxes, 0, 0)).toBe(0)
    expect(landing(boxes, 0, 54)).toBe(0)
    expect(landing(boxes, 0, 56)).toBe(1)
  })

  it('takes the same travel to pass the one beside it whichever way it is going', () => {
    expect(landing(boxes, 1, -54)).toBe(1)
    expect(landing(boxes, 1, -56)).toBe(0)
  })

  it('passes several at once on a long drag', () => {
    expect(landing(boxes, 0, 350)).toBe(3)
    expect(landing(boxes, 3, -300)).toBe(0)
  })

  it('does not go past either end of the row', () => {
    expect(landing(boxes, 0, -400)).toBe(0)
    expect(landing(boxes, 3, 400)).toBe(3)
  })

  // A wide one is not asked to travel its own width before it counts as having
  // passed a narrow one, which is what measuring from the middle would ask for.
  it('reads a wide one off its own edge rather than its middle', () => {
    expect(landing(boxes, 3, -60)).toBe(2)
  })
})

describe('where the pointer carrying one lands', () => {
  it('moves as the pointer crosses the gap it would drop into', () => {
    expect(landingAt(boxes, 0, 194)).toBe(0)
    expect(landingAt(boxes, 0, 196)).toBe(1)
    expect(landingAt(boxes, 3, 196)).toBe(3)
    expect(landingAt(boxes, 3, 194)).toBe(2)
  })

  // The pointer decides against the very place the line is drawn, so the two are
  // never in different halves of the list.
  it('stands the line where the pointer crossed', () => {
    expect(boundary(boxes, 0, landingAt(boxes, 0, 196))).toBe(195)
    expect(boundary(boxes, 3, landingAt(boxes, 3, 94))).toBe(95)
  })

  // A tall one stands over several of the rows beside it, and its own far edge
  // is a long way under the pointer carrying it. Read from the middle of that
  // box the line lands past the bottom of it while the pointer is still halfway
  // up, so nothing moves until the pointer is really through the gap.
  it('waits for the pointer rather than the middle of a tall one', () => {
    const tall = [
      { left: 0, width: 40 },
      { left: 50, width: 200 },
      { left: 260, width: 40 }
    ]
    expect(landingAt(tall, 0, 150)).toBe(0)
    expect(landingAt(tall, 0, 249)).toBe(0)
    expect(landingAt(tall, 0, 256)).toBe(1)
    expect(landingAt(tall, 2, 150)).toBe(2)
    expect(landingAt(tall, 2, 44)).toBe(1)
  })

  it('does not go past either end of the row', () => {
    expect(landingAt(boxes, 0, -400)).toBe(0)
    expect(landingAt(boxes, 3, 900)).toBe(3)
  })
})

describe('the room a dragged one leaves behind', () => {
  it('is its own width and the gap beside it', () => {
    expect(room(boxes, 0)).toBe(100)
    expect(room(boxes, 3)).toBe(190)
  })

  it('reads the gap off the one before it at the end of the row', () => {
    expect(room([boxes[0]!, boxes[1]!], 1)).toBe(100)
  })

  it('is its own width alone when there is nothing beside it', () => {
    expect(room([boxes[0]!], 0)).toBe(90)
  })
})

describe('where the line that says where it lands stands', () => {
  it('reads the row own gap off the boxes', () => {
    expect(gapOf(boxes)).toBe(10)
    expect(gapOf([boxes[0]!])).toBe(0)
  })

  it('sits in the middle of the gap it would drop into, whichever way it came', () => {
    expect(boundary(boxes, 0, 2)).toBe(295)
    expect(boundary(boxes, 3, 1)).toBe(95)
  })

  it('stands in front of the one that is not moving anywhere', () => {
    expect(boundary(boxes, 1, 1)).toBe(95)
  })

  // Half of the mark at its head stands above the line, and the list clips, so a
  // line on the very edge of it comes out with its top half gone.
  it('stands inside the padding at either end rather than on the edge of it', () => {
    const padded = [
      { left: 8, width: 90 },
      { left: 108, width: 90 }
    ]
    expect(boundary(padded, 1, 0)).toBe(4)
    expect(boundary(boxes, 2, 0)).toBe(0)
  })

  it('reaches for no box that is not there', () => {
    expect(boundary(boxes, 0, 9)).toBe(0)
  })
})

describe('how far the rest step aside', () => {
  it('moves back everything the held one has passed', () => {
    expect(shift(boxes, 0, 2, 1)).toBe(-100)
    expect(shift(boxes, 0, 2, 2)).toBe(-100)
  })

  it('moves forward everything a held one coming back has passed', () => {
    expect(shift(boxes, 3, 1, 2)).toBe(190)
    expect(shift(boxes, 3, 1, 1)).toBe(190)
  })

  it('leaves the held one and everything it has not reached where they are', () => {
    expect(shift(boxes, 0, 2, 0)).toBe(0)
    expect(shift(boxes, 0, 2, 3)).toBe(0)
    expect(shift(boxes, 0, 0, 1)).toBe(0)
  })
})
