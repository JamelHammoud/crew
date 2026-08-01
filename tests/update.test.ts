import { describe, expect, it } from 'vitest'
import {
  mayInstall,
  NO_UPDATE,
  nextUpdate,
  pressDoes,
  updateStanding,
  worthChecking,
  type UpdateState,
  type UpdateWord
} from '../src/shared/update'

function walk(words: UpdateWord[], from: UpdateState = NO_UPDATE): UpdateState {
  return words.reduce(nextUpdate, from)
}

const found: UpdateWord = { word: 'found', version: '0.2.0' }

describe('what the app can say about a new Crew', () => {
  it('says nothing until a check finds one', () => {
    expect(updateStanding(NO_UPDATE)).toBe(false)
    expect(walk([{ word: 'nothing' }])).toEqual(NO_UPDATE)
  })

  it('stands the moment one is found, and names the version', () => {
    const state = walk([found])
    expect(state.stage).toBe('found')
    expect(state.version).toBe('0.2.0')
    expect(updateStanding(state)).toBe(true)
  })

  it('fills as the new Crew comes down, and never backwards', () => {
    const state = walk([found, { word: 'getting' }, { word: 'progress', percent: 62.4 }])
    expect(state.percent).toBe(62)
    expect(nextUpdate(state, { word: 'progress', percent: 3 }).percent).toBe(62)
  })

  it('ignores progress arriving before anybody asked', () => {
    expect(walk([found, { word: 'progress', percent: 40 }]).percent).toBe(0)
  })

  it('holds a percent inside the bar it is drawn in', () => {
    const going = walk([found, { word: 'getting' }])
    expect(nextUpdate(going, { word: 'progress', percent: 420 }).percent).toBe(100)
    expect(nextUpdate(going, { word: 'progress', percent: Number.NaN }).percent).toBe(0)
  })

  it('lands ready, and nothing about a check moves it', () => {
    const state = walk([found, { word: 'getting' }, { word: 'ready', version: '0.2.0' }])
    expect(state).toMatchObject({ stage: 'ready', version: '0.2.0', percent: 100, why: '' })
    expect(walk([{ word: 'error' }, { word: 'nothing' }, found], state)).toEqual(state)
  })

  it('says a newer one the moment a check finds it, and stands still otherwise', () => {
    const state = walk([found])
    expect(nextUpdate(state, found)).toBe(state)
    expect(nextUpdate(state, { word: 'found', version: '0.3.0' }).version).toBe('0.3.0')
  })

  // A pass that could not reach the internet is nothing to say. Only a download
  // somebody asked for and did not get is worth a word.
  it('keeps quiet about a check that failed', () => {
    expect(walk([{ word: 'error' }])).toEqual(NO_UPDATE)
    expect(walk([found, { word: 'error' }]).stage).toBe('found')
  })

  it('says so when a download somebody asked for did not arrive', () => {
    const state = walk([found, { word: 'getting' }, { word: 'progress', percent: 30 }, { word: 'error' }])
    expect(state.stage).toBe('failed')
    expect(state.percent).toBe(0)
    expect(state.version).toBe('0.2.0')
    expect(state.why).toBe('download')
  })

  it('never clears an update out from under a download', () => {
    const going = walk([found, { word: 'getting' }, { word: 'progress', percent: 30 }])
    expect(walk([{ word: 'nothing' }], going)).toEqual(going)
  })
})

describe('the one press', () => {
  it('is the whole of the update, read off where it has got to', () => {
    expect(pressDoes('none')).toBe('none')
    expect(pressDoes('found')).toBe('get')
    expect(pressDoes('getting')).toBe('none')
    expect(pressDoes('ready')).toBe('restart')
  })

  it('asks again after a failure rather than offering something new', () => {
    expect(pressDoes('failed')).toBe('get')
    const again = walk([found, { word: 'getting' }, { word: 'error' }, { word: 'getting' }])
    expect(again.stage).toBe('getting')
    expect(again.version).toBe('0.2.0')
  })
})

describe('an update that came down and did not go on', () => {
  const landed = walk([found, { word: 'getting' }, { word: 'ready', version: '0.2.0' }])

  it('says which of the two ways it did not happen', () => {
    const held = nextUpdate(landed, { word: 'stuck', why: 'others' })
    expect(held).toMatchObject({ why: 'others', version: '0.2.0' })
    expect(nextUpdate(landed, { word: 'stuck', why: 'install' }).why).toBe('install')
  })

  it('says it again when it is pressed again and held again', () => {
    const once = nextUpdate(landed, { word: 'stuck', why: 'others' })
    const twice = nextUpdate(once, { word: 'stuck', why: 'others' })
    expect(twice.told).toBe(once.told + 1)
  })

  it('is nothing to say before anything has landed', () => {
    for (const state of [NO_UPDATE, walk([found]), walk([found, { word: 'getting' }])]) {
      expect(nextUpdate(state, { word: 'stuck', why: 'install' })).toBe(state)
    }
  })

  // The bytes are here and the restart is still the only thing left to do, so
  // being held leaves the offer exactly where it was. Standing back down to a
  // stage that says an update is available read as the whole thing coming undone.
  it('leaves the restart standing, since the bytes are already here', () => {
    const held = nextUpdate(landed, { word: 'stuck', why: 'others' })
    expect(held.stage).toBe('ready')
    expect(held.percent).toBe(100)
    expect(pressDoes(held.stage)).toBe('restart')
  })

  it('is still nowhere to look again, held or not', () => {
    expect(worthChecking(nextUpdate(landed, { word: 'stuck', why: 'others' }).stage)).toBe(false)
  })
})

describe('when to look again, and when the app may be replaced', () => {
  it('keeps looking while the pill stands, so the release after this one lands too', () => {
    expect(worthChecking('none')).toBe(true)
    expect(worthChecking('found')).toBe(true)
    expect(worthChecking('failed')).toBe(true)
  })

  it('leaves a download in flight and one already down alone', () => {
    expect(worthChecking('getting')).toBe(false)
    expect(worthChecking('ready')).toBe(false)
  })

  // The installer replaces the whole app and force-kills every Crew it finds to
  // do it, and several Crews on one machine is ordinary here.
  it('waits for every other Crew on the machine', () => {
    expect(mayInstall(0)).toBe(true)
    expect(mayInstall(1)).toBe(false)
    expect(mayInstall(4)).toBe(false)
  })
})
