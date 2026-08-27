import { describe, expect, it } from 'vitest'
import { joinPlace, projectPlace } from '../src/shared/places'
import { placeTitle } from '../src/renderer/src/views/home/place'
import { CREW, PERSONAL_NAME, PERSONAL_PLACE, SHOWING_LIMIT, windowName } from '../src/shared/windowName'

describe('what a window is called', () => {
  it('says the project and then what the window is standing on', () => {
    expect(windowName('device-os', 'Chat')).toBe('device-os | Chat')
  })

  it('is the project on its own when there is nothing to say beside it', () => {
    expect(windowName('device-os', '')).toBe('device-os')
  })

  it('falls back to Crew on the way in, where there is no project yet', () => {
    expect(windowName('', '')).toBe(CREW)
  })

  it('cuts a long line short so the project stays readable', () => {
    const long = 'I have the android build failing on CI and I cannot work out which commit did it'
    const name = windowName('device-os', long)
    expect(name.startsWith('device-os | I have the android build')).toBe(true)
    expect(name.endsWith('…')).toBe(true)
    expect(name.length).toBeLessThanOrEqual('device-os | '.length + SHOWING_LIMIT + 1)
  })

  it('never carries a newline out of a message into the title bar', () => {
    expect(windowName('device-os', ' I have\n  the build ')).toBe('device-os | I have the build')
  })
})

describe('what a place is called', () => {
  const folder = '/Users/someone/Repositories/device-os'
  const link = 'crew://192.0.2.10:2739/abc123'

  it('is the folder a project stands in', () => {
    expect(placeTitle(projectPlace(folder), folder, null, {})).toBe('device-os')
  })

  it('is the name somebody gave it wherever they gave it one', () => {
    const key = projectPlace(folder)
    expect(placeTitle(key, folder, null, { [key]: 'Device' })).toBe('Device')
  })

  it('is the address a crew was joined at rather than the folder work happens in', () => {
    const key = joinPlace(link)
    expect(placeTitle(key, folder, link, {})).toBe('192.0.2.10:2739')
  })

  it('leaves a shared project on its own folder rather than on the link it is shared by', () => {
    expect(placeTitle(projectPlace(folder), folder, link, {})).toBe('device-os')
  })

  it('names the chat that belongs to this machine rather than to a crew', () => {
    expect(placeTitle(PERSONAL_PLACE, '', null, {})).toBe(PERSONAL_NAME)
  })
})
