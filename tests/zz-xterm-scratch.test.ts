// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

describe('xterm under jsdom', () => {
  it('opens', async () => {
    const { Terminal } = await import('@xterm/xterm')
    const term = new Terminal({ cols: 80, rows: 24 })
    const host = document.createElement('div')
    document.body.appendChild(host)
    term.open(host)
    term.write('hello')
    expect(host.querySelector('.xterm')).not.toBeNull()
    term.dispose()
  })
})
