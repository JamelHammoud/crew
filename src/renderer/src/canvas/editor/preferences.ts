import { atom, type Atom } from '../signals'
import type { TLColorMode, TLUserPreferences } from './types'

export class UserPreferencesManager {
  private readonly preferences: Atom<TLUserPreferences>
  private readonly write?: (next: TLUserPreferences) => void

  constructor(options?: {
    initial?: Partial<TLUserPreferences>
    write?: (next: TLUserPreferences) => void
  }) {
    this.preferences = atom('editor.userPreferences', {
      colorScheme: options?.initial?.colorScheme ?? 'light',
      isSnapMode: options?.initial?.isSnapMode ?? false,
      ...options?.initial
    })
    this.write = options?.write
  }

  getUserPreferences(): TLUserPreferences {
    return this.preferences.get()
  }

  updateUserPreferences(update: Partial<TLUserPreferences>): void {
    const next = { ...this.preferences.get(), ...update }
    this.preferences.set(next)
    this.write?.(next)
  }

  getColorMode(): TLColorMode {
    const scheme = this.preferences.get().colorScheme
    if (scheme !== 'system') return scheme
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
  }
}
