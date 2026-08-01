export type Box = { left: number; width: number }

const end = (box: Box) => box.left + box.width
const middle = (box: Box) => box.left + box.width / 2

// The room one leaves behind when it is lifted out of the row: its own width and
// the gap beside it, read off the row itself rather than from the class that set
// the gap, so nothing here has to be told the number twice.
export function room(boxes: Box[], from: number): number {
  const held = boxes[from]
  if (!held) return 0
  const after = boxes[from + 1]
  const before = boxes[from - 1]
  const gap = after ? after.left - end(held) : before ? held.left - end(before) : 0
  return held.width + gap
}

// Where one dragged dx from its own slot would land. The leading edge is what
// decides it rather than the middle: measured from the middle, a wide one has to
// travel its own width as well as the gap before it passes the narrow one beside
// it, which reads as a row that will not take what is being dragged into it.
export function landing(boxes: Box[], from: number, dx: number): number {
  const held = boxes[from]
  if (!held) return from
  let to = from
  boxes.forEach((box, index) => {
    if (index > from && end(held) + dx > middle(box)) to = Math.max(to, index)
    if (index < from && held.left + dx < middle(box)) to = Math.min(to, index)
  })
  return to
}

// The room the row leaves between one and the next, read off the boxes rather
// than off the class that set it. Every gap in a row is the same width, so the
// first one that is really a gap answers for all of them.
export function gapOf(boxes: Box[]): number {
  for (let index = 1; index < boxes.length; index++) {
    const gap = boxes[index].left - end(boxes[index - 1])
    if (gap > 0) return gap
  }
  return 0
}

// Where the line that says where it lands stands. It is the middle of the gap
// the held one would drop into, so it belongs to neither of the two it sits
// between: drawn on the edge of one of them it reads as a rule under a row.
export function boundary(boxes: Box[], from: number, to: number): number {
  const box = boxes[to]
  if (!box) return 0
  const half = gapOf(boxes) / 2
  return to > from ? end(box) + half : box.left - half
}

// How far the one standing at index steps aside while from is on its way to to.
// Everything the held one has passed moves back by the room it left behind, and
// every gap is the same width, so one number covers all of them.
export function shift(boxes: Box[], from: number, to: number, index: number): number {
  if (index > from && index <= to) return -room(boxes, from)
  if (index < from && index >= to) return room(boxes, from)
  return 0
}
