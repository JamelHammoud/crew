import { describe, expect, it, vi } from 'vitest'
import { recoverMissingPreload } from '../src/renderer/src/preloadRecovery'

class PreloadTarget extends EventTarget {
  location = { reload: vi.fn() }
}

describe('renderer preload recovery', () => {
  it('cancels a failed dynamic import and reloads the window', () => {
    const target = new PreloadTarget()
    const stop = recoverMissingPreload(target)
    const failed = new Event('vite:preloadError', { cancelable: true })

    target.dispatchEvent(failed)

    expect(failed.defaultPrevented).toBe(true)
    expect(target.location.reload).toHaveBeenCalledOnce()

    stop()
    target.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))
    expect(target.location.reload).toHaveBeenCalledOnce()
  })
})
