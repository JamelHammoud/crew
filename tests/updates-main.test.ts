import { EventEmitter } from 'node:events'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { AppUpdater } from 'electron-updater'
import { describe, expect, it, vi } from 'vitest'
import { Updates, type UpdatesHost } from '../src/main/updates'

class FakeUpdater extends EventEmitter {
  logger: unknown
  autoDownload = true
  autoInstallOnAppQuit = true
  quitAndInstall = vi.fn()
  checkForUpdates = vi.fn<() => Promise<unknown>>(() => Promise.resolve(null))
  downloadUpdate = vi.fn(() => Promise.resolve([]))
}

function setup(checkForUpdates?: () => Promise<unknown>): {
  updates: Updates
  updater: FakeUpdater
  host: UpdatesHost
  quitting: () => boolean
} {
  const updater = new FakeUpdater()
  if (checkForUpdates) updater.checkForUpdates.mockImplementation(checkForUpdates)
  let isQuitting = false
  const host: UpdatesHost = {
    windows: () => [],
    others: () => 0,
    settle: () => Promise.resolve(),
    prepareQuit: () => {
      isQuitting = true
    },
    cancelQuit: () => {
      isQuitting = false
    },
    log: path.join(mkdtempSync(path.join(tmpdir(), 'crew-update-')), 'updates.log')
  }
  const updates = new Updates(host, () => updater as unknown as AppUpdater)
  updates.start(true)
  return { updates, updater, host, quitting: () => isQuitting }
}

describe('the updater quit handoff', () => {
  it('handles a rejected background download promise', async () => {
    const caught = vi.fn(() => Promise.resolve())
    const { updates } = setup(() =>
      Promise.resolve({ downloadPromise: { catch: caught } })
    )

    await vi.waitFor(() => expect(caught).toHaveBeenCalledOnce())
    updates.close()
  })

  it('downloads in the background and waits for a press after it lands', async () => {
    const { updates, updater } = setup()

    expect(updater.autoDownload).toBe(true)
    updater.emit('update-available', { version: '0.2.0' })
    expect(updates.now()).toMatchObject({ stage: 'getting', version: '0.2.0' })

    updates.press()
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
    expect(updater.quitAndInstall).not.toHaveBeenCalled()

    updater.emit('download-progress', { percent: 42.4 })
    expect(updates.now().percent).toBe(42)
    updater.emit('update-downloaded', { version: '0.2.0' })
    expect(updates.now()).toMatchObject({ stage: 'ready', version: '0.2.0', percent: 100 })
    expect(updater.quitAndInstall).not.toHaveBeenCalled()

    updates.press()
    await vi.waitFor(() => expect(updater.quitAndInstall).toHaveBeenCalledOnce())
    updates.close()
  })

  it('lets Electron close the window before quitAndInstall emits before-quit', async () => {
    const { updates, updater, quitting } = setup()
    let closeWasAllowed = false
    updater.quitAndInstall.mockImplementation(() => {
      closeWasAllowed = quitting()
    })

    updater.emit('update-downloaded', { version: '0.2.0' })
    updates.press()
    await vi.waitFor(() => expect(updater.quitAndInstall).toHaveBeenCalledOnce())

    expect(closeWasAllowed).toBe(true)
    updates.close()
  })

  it('puts ordinary macOS close behavior back when installation fails', async () => {
    const { updates, updater, quitting } = setup()
    updater.quitAndInstall.mockImplementation(() => {
      updater.emit('error', new Error('install failed'))
    })

    updater.emit('update-downloaded', { version: '0.2.0' })
    updates.press()
    await vi.waitFor(() => expect(updater.quitAndInstall).toHaveBeenCalledOnce())

    expect(quitting()).toBe(false)
    expect(updates.now()).toMatchObject({ stage: 'ready', why: 'install' })
    updates.close()
  })

  it('does not enter quit state while another Crew holds the install', async () => {
    const { updates, updater, host, quitting } = setup()
    host.others = () => 1

    updater.emit('update-downloaded', { version: '0.2.0' })
    updates.press()
    await Promise.resolve()

    expect(updater.quitAndInstall).not.toHaveBeenCalled()
    expect(quitting()).toBe(false)
    expect(updates.now()).toMatchObject({ stage: 'ready', why: 'others' })
    updates.close()
  })
})
