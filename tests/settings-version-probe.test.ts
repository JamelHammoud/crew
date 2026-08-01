// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import About from '../src/renderer/src/components/settings/About'
import { installLocalStorage } from './helpers/local-storage'

const storage = installLocalStorage()

function installBridge(version: string) {
  const appVersion = vi.fn().mockResolvedValue(version)
  window.crew = {
    appVersion,
    systemInfo: vi.fn().mockResolvedValue({
      version,
      platform: 'darwin',
      release: '25.5.0',
      arch: 'arm64'
    }),
    commandState: vi.fn().mockResolvedValue({ kind: 'off' }),
    keepAwake: vi.fn()
  } as unknown as CrewBridge
  return { appVersion }
}

describe('the version in the settings', () => {
  beforeEach(() => {
    storage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('says which Crew this is', async () => {
    const { appVersion } = installBridge('1.2.3')
    render(createElement(About))

    await waitFor(() => expect(appVersion).toHaveBeenCalledOnce())
    expect(await screen.findByText('Version')).toBeTruthy()
    expect(screen.getByText('1.2.3')).toBeTruthy()
  })

  // A row that says Version and nothing after it is worse than no row, so
  // nothing is drawn until there is a number to draw.
  it('draws no row while there is nothing to say', async () => {
    installBridge('')
    render(createElement(About))

    await waitFor(() => expect(screen.getByText('About')).toBeTruthy())
    expect(screen.queryByText('Version')).toBeNull()
  })
})
