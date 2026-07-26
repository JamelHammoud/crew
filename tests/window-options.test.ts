import { describe, expect, it } from 'vitest'
import { createPanelOptions, createWindowOptions } from '../src/main/window-options'

describe('tray panel options', () => {
  // skipTaskbar turns the app into an accessory on macOS: the panel opens and
  // the icon leaves the dock, with no way back.
  it('never asks to be left out of the taskbar, which would empty the dock', () => {
    const options = createPanelOptions('preload.mjs', { width: 272, height: 64 })

    expect(options.skipTaskbar).toBeUndefined()
  })

  it('is a frameless window that opens hidden and is not dragged or resized', () => {
    const options = createPanelOptions('preload.mjs', { width: 272, height: 64 })

    expect(options).toMatchObject({
      width: 272,
      height: 64,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false
    })
  })
})

describe('window options', () => {
  it('uses an opaque resizable window on Windows', () => {
    const options = createWindowOptions('win32', 'preload.mjs')

    expect(options).toMatchObject({
      transparent: false,
      backgroundColor: '#141414',
      resizable: true,
      maximizable: true
    })
  })

  it('keeps the transparent window on macOS', () => {
    const options = createWindowOptions('darwin', 'preload.mjs')

    expect(options).toMatchObject({
      transparent: true,
      backgroundColor: '#00000000'
    })
  })
})
