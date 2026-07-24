import { describe, expect, it } from 'vitest'
import { createWindowOptions } from '../src/main/window-options'

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
