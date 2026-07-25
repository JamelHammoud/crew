import { describe, expect, it } from 'vitest'
import { gridColumns } from '../src/renderer/src/components/huddle/tiles'
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
  it('keeps tiles as square as the count allows', () => {
    expect(gridColumns(0)).toBe(1)
    expect(gridColumns(1)).toBe(1)
    expect(gridColumns(2)).toBe(2)
    expect(gridColumns(4)).toBe(2)
    expect(gridColumns(5)).toBe(3)
    expect(gridColumns(9)).toBe(3)
    expect(gridColumns(12)).toBe(4)
  })

  it('stops widening past four across', () => {
    expect(gridColumns(30)).toBe(4)
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
