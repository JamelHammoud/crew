// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_ICONS, appIconLabel, cleanAppIcon, DEFAULT_APP_ICON, PICTURE_ICONS } from '../src/shared/appIcon'
import { applyAppIcon, storedAppIcon } from '../src/renderer/src/state/appIcon'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear()
})

describe('the icons there are', () => {
  it('takes every one of them', () => {
    for (const icon of APP_ICONS) expect(cleanAppIcon(icon.id)).toBe(icon.id)
    expect(APP_ICONS).toHaveLength(6)
  })

  it('reads anything else as the default', () => {
    for (const junk of ['zebra', '', 'Default', 0, 7, {}, [], true, undefined, null]) {
      expect(cleanAppIcon(junk)).toBe(DEFAULT_APP_ICON)
    }
  })

  it('says each one once, by id and by name', () => {
    expect(new Set(APP_ICONS.map(icon => icon.id)).size).toBe(APP_ICONS.length)
    expect(new Set(APP_ICONS.map(icon => icon.label)).size).toBe(APP_ICONS.length)
    for (const icon of APP_ICONS) expect(appIconLabel(icon.id)).toBe(icon.label)
  })

  // Only the default is black and white, so it is the only one with a theme to
  // follow. A picture stands whatever the window wears.
  it('flips with the theme for the default alone', () => {
    const flipping = APP_ICONS.filter(icon => icon.flips)

    expect(flipping.map(icon => icon.id)).toEqual([DEFAULT_APP_ICON])
  })

  it('counts the pictures as everything but the default', () => {
    expect(PICTURE_ICONS).toEqual(APP_ICONS.filter(icon => icon.id !== DEFAULT_APP_ICON).map(icon => icon.id))
    expect(PICTURE_ICONS).not.toContain(DEFAULT_APP_ICON)
  })
})

describe('picking one', () => {
  beforeEach(() => {
    store.clear()
  })

  it('wears the default when nothing is stored', () => {
    expect(storedAppIcon()).toBe(DEFAULT_APP_ICON)
  })

  it('keeps whichever one is picked', () => {
    for (const icon of APP_ICONS) {
      applyAppIcon(icon.id)
      expect(storedAppIcon()).toBe(icon.id)
    }
  })

  it('reads an unknown stored value back as the default', () => {
    store.set('crew.appIcon', 'zebra')
    expect(storedAppIcon()).toBe(DEFAULT_APP_ICON)
  })
})
