// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import About from '../src/renderer/src/components/settings/About'
import { installLocalStorage } from './helpers/local-storage'

const storage = installLocalStorage()

function installBridge() {
  const openExternal = vi.fn().mockResolvedValue(true)
  window.crew = {
    appVersion: vi.fn().mockResolvedValue('1.2.3'),
    systemInfo: vi.fn().mockResolvedValue({
      version: '1.2.3',
      platform: 'darwin',
      release: '25.5.0',
      arch: 'arm64'
    }),
    commandState: vi.fn().mockResolvedValue({ kind: 'off' }),
    keepAwake: vi.fn(),
    openExternal
  } as unknown as CrewBridge
  return { openExternal }
}

describe('who made it', () => {
  beforeEach(() => {
    storage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('names both of them on the About page', async () => {
    installBridge()
    render(createElement(About))

    await waitFor(() => expect(screen.getByText('About')).toBeTruthy())
    expect(screen.getByText('Jamel')).toBeTruthy()
    expect(screen.getByText('Ali')).toBeTruthy()
  })

  // A name is somebody's own page, so it opens where somebody's pages open
  // rather than in a tab of the app's.
  it('opens each name in the browser', async () => {
    const { openExternal } = installBridge()
    render(createElement(About))

    await waitFor(() => expect(screen.getByText('Jamel')).toBeTruthy())

    screen.getByText('Jamel').click()
    expect(openExternal).toHaveBeenCalledWith('https://github.com/JamelHammoud')

    screen.getByText('Ali').click()
    expect(openExternal).toHaveBeenCalledWith('https://github.com/alihammoud21')
  })
})
</content>
