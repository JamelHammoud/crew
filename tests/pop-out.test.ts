import { describe, expect, it } from 'vitest'
import { projectPlace } from '../src/shared/places'
import { popOutTarget, poppedKey } from '../src/shared/popOut'

const here = projectPlace('/one')
const there = projectPlace('/two')

describe('which crew a popped out thread opens on', () => {
  it('takes the crew it was told, whichever one the window asking is in', () => {
    expect(popOutTarget(here, there, [here, there])).toBe(there)
  })

  it('opens nothing on a crew that is not running', () => {
    expect(popOutTarget(here, projectPlace('/nowhere'), [here, there])).toBeNull()
    expect(popOutTarget(here, there, [here])).toBeNull()
  })

  it('takes the crew the window asking is in when it was told none', () => {
    expect(popOutTarget(here, undefined, [here, there])).toBe(here)
    expect(popOutTarget(here, null, [])).toBe(here)
    expect(popOutTarget(here, '', [here])).toBe(here)
  })

  it('opens nothing for a window looking at nothing', () => {
    expect(popOutTarget(null, undefined, [here])).toBeNull()
  })
})

describe('the window a thread was popped out into', () => {
  it('is one window per thread per crew, so two crews never collide', () => {
    expect(poppedKey(here, 'abc')).toBe(poppedKey(here, 'abc'))
    expect(poppedKey(here, 'abc')).not.toBe(poppedKey(there, 'abc'))
    expect(poppedKey(here, 'abc')).not.toBe(poppedKey(here, 'abd'))
  })

  it('cannot be read two ways by a folder with the separator in its name', () => {
    expect(poppedKey(projectPlace('/one'), 'two three')).not.toBe(poppedKey(projectPlace('/one two'), 'three'))
  })
})
