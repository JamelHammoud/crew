import { rememberBoot } from '../../src/renderer/src/components/boot/seen'
import { installSessionStorage } from './local-storage'

// The flight happens once per window, and a test window is always a fresh one,
// so a suite that renders the app would sit in the mark and find nothing.
export function landed(): void {
  installSessionStorage()
  rememberBoot()
}
