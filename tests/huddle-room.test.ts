import { describe, expect, it } from 'vitest'
import { fitTiles } from '../src/renderer/src/components/huddle/tiles'
import { formatClock } from '../src/renderer/src/components/time'
import { emptyRoom, huddleTitle, politeToward, sharingPeer, type HuddlePeer } from '../src/shared/huddle'

const peer = (peerId: string, name: string, extra: Partial<HuddlePeer> = {}): HuddlePeer => ({
  peerId,
  memberId: `m-${peerId}`,
  name,
  muted: false,
  camera: false,
  sharing: false,
  joinedAt: 1,
  ...extra
})

describe('who gives way', () => {
  it('makes exactly one side of every pair the polite one', () => {
    expect(politeToward('a', 'b')).toBe(true)
    expect(politeToward('b', 'a')).toBe(false)
  })

  it('agrees on which side that is no matter who asks first', () => {
    const ids = ['peer-9f', 'peer-01', 'peer-zz', 'peer-4c']
    for (const self of ids) {
      for (const other of ids) {
        if (self === other) continue
        expect(politeToward(self, other)).toBe(!politeToward(other, self))
      }
    }
  })
})

describe('naming a call', () => {
  it('says who is on the other end', () => {
    const self = peer('me', 'Jamel')
    expect(huddleTitle({ peers: [self], startedAt: 1 }, 'me')).toBe('Waiting for others')
    expect(huddleTitle({ peers: [self, peer('a', 'Ali')], startedAt: 1 }, 'me')).toBe('Ali')
    expect(huddleTitle({ peers: [self, peer('a', 'Ali'), peer('b', 'Kim')], startedAt: 1 }, 'me')).toBe(
      'Ali and Kim'
    )
    expect(
      huddleTitle({ peers: [self, peer('a', 'Ali'), peer('b', 'Kim'), peer('c', 'Sam')], startedAt: 1 }, 'me')
    ).toBe('Ali and 2 others')
  })

  it('has nothing to say about an empty room', () => {
    expect(huddleTitle(emptyRoom(), 'me')).toBe('Waiting for others')
    expect(sharingPeer(emptyRoom())).toBeUndefined()
  })

  it('picks out whoever is sharing', () => {
    const room = { peers: [peer('a', 'Ali'), peer('b', 'Kim', { sharing: true })], startedAt: 1 }
    expect(sharingPeer(room)?.name).toBe('Kim')
  })
})

describe('laying out the stage', () => {
  const wide = { width: 1440, height: 720 }

  it('spreads people across a wide room and stacks them in a narrow one', () => {
    expect(fitTiles(2, wide.width, wide.height, 12).columns).toBe(2)
    expect(fitTiles(2, 600, 900, 12).columns).toBe(1)
    expect(fitTiles(4, wide.width, wide.height, 12).columns).toBe(2)
  })

  it('picks the arrangement that makes every tile biggest', () => {
    for (const count of [1, 2, 3, 4, 5, 6, 9, 12]) {
      const best = fitTiles(count, wide.width, wide.height, 12)
      for (let columns = 1; columns <= count; columns++) {
        const rows = Math.ceil(count / columns)
        const across = (wide.width - 12 * (columns - 1)) / columns
        const down = ((wide.height - 12 * (rows - 1)) / rows) * (16 / 9)
        expect(best.width).toBeGreaterThanOrEqual(Math.min(across, down) - 0.001)
      }
    }
  })

  it('keeps every tile inside the room it was given', () => {
    const grid = fitTiles(5, wide.width, wide.height, 12)
    const rows = Math.ceil(5 / grid.columns)
    expect(grid.width * grid.columns + 12 * (grid.columns - 1)).toBeLessThanOrEqual(wide.width + 0.001)
    expect((grid.width / (16 / 9)) * rows + 12 * (rows - 1)).toBeLessThanOrEqual(wide.height + 0.001)
  })

  it('falls back to a column per person before it has been measured', () => {
    expect(fitTiles(3, 0, 0, 12)).toEqual({ columns: 3, width: 0 })
  })
})

describe('the call timer', () => {
  it('counts up in minutes and seconds, then hours', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(9_000)).toBe('0:09')
    expect(formatClock(65_000)).toBe('1:05')
    expect(formatClock(3_725_000)).toBe('1:02:05')
  })
})
