import { vi } from 'vitest'
import { rememberBoot } from '../../src/renderer/src/components/boot/seen'
import { installSessionStorage } from './local-storage'

// The flight happens once per window, and a test window is always a fresh one,
// so a suite that renders the app would sit in the mark and find nothing. The
// window that skips it is a dev one, and vitest resolves DEV off the NODE_ENV
// it was started with, so both halves have to be said here.
export function landed(): void {
  vi.stubEnv('DEV', true)
  installSessionStorage()
  rememberBoot()
}
