import { describe, expect, it } from 'vitest'
import { boundary, gapOf, landing, room, shift } from '../src/renderer/src/components/reorder'

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
