import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  openSidebarItem,
  openSidebarItemWindow,
  sidebarItemOpensWindow
} from '../src/renderer/src/components/sidebar/sidebarItemAction'
import { SIDEBAR_ITEMS } from '../src/renderer/src/components/sidebar/sidebarItems'

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window')
})

describe('Stickies in More', () => {
  it('stands directly below Toolbox', () => {
    const labels = SIDEBAR_ITEMS.map(item => item.label)

    expect(labels.indexOf('Stickies')).toBe(labels.indexOf('Toolbox') + 1)
  })

  it('always opens its own window from the row and its window action', () => {
    const openStickies = vi.fn(() => Promise.resolve(true))
    Object.assign(globalThis, { window: { crew: { openStickies } } })
    const onTab = vi.fn()
    const onToolbox = vi.fn()

    expect(sidebarItemOpensWindow('stickies')).toBe(true)
    openSidebarItem('stickies', onTab, onToolbox)
    openSidebarItemWindow('stickies')

    expect(openStickies).toHaveBeenCalledTimes(2)
    expect(onTab).not.toHaveBeenCalled()
    expect(onToolbox).not.toHaveBeenCalled()
  })
})
