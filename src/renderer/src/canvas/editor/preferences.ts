import { atom, type Atom } from '../signals'
import { uniqueId } from '../store'
import type { TLColorMode, TLUserPreferences } from './types'

export const DEFAULT_USER_PREFERENCES = {
  name: '',
  locale: 'en',
  color: '#000000',
  edgeScrollSpeed: 1,
  edgeScrollFriction: 0.09,
  animationSpeed: 1,
  areKeyboardShortcutsEnabled: true,
  isSnapMode: false,
  isAlwaysSnap: false,
  isGridMode: false,
  isFocusMode: false,
  isWrapMode: false,
  isDynamicSizeMode: false,
  isPasteAtCursorMode: false,
  enhancedA11yMode: false,
  colorScheme: 'light' as TLUserPreferences['colorScheme'],
  inputMode: null as 'mouse' | 'trackpad' | null,
  isZoomDirectionInverted: false
}

export class UserPreferencesManager {
  private readonly preferences: Atom<TLUserPreferences>
  private readonly systemColorScheme: Atom<TLColorMode>
  private readonly write?: (next: TLUserPreferences) => void
  private stopWatchingSystem: (() => void) | null = null

  constructor(options?: { initial?: Partial<TLUserPreferences>; write?: (next: TLUserPreferences) => void }) {
    this.preferences = atom('editor.userPreferences', {
      id: uniqueId(),
      ...DEFAULT_USER_PREFERENCES,
      ...options?.initial
    } as TLUserPreferences)
    this.systemColorScheme = atom<TLColorMode>('editor.systemColorScheme', 'light')
    this.write = options?.write
    this.watchSystemColorScheme()
  }

  dispose(): void {
    this.stopWatchingSystem?.()
    this.stopWatchingSystem = null
  }

  getUserPreferences(): TLUserPreferences {
    return this.preferences.get()
  }

  updateUserPreferences(update: Partial<TLUserPreferences>): void {
    const next = { ...this.preferences.get(), ...update }
    this.preferences.set(next)
    this.write?.(next)
  }

  getColorScheme(): TLUserPreferences['colorScheme'] {
    return this.read('colorScheme')
  }

  getColorMode(): TLColorMode {
    return this.getIsDarkMode() ? 'dark' : 'light'
  }

  getIsDarkMode(): boolean {
    const scheme = this.getColorScheme()
    if (scheme === 'dark') return true
    if (scheme === 'light') return false
    return this.systemColorScheme.get() === 'dark'
  }

  getUserId(): string {
    return (this.preferences.get() as { id?: string }).id ?? ''
  }

  getName(): string {
    return String(this.read('name')).trim()
  }

  getLocale(): string {
    return this.read('locale')
  }

  getColor(): string {
    return this.read('color')
  }

  getAnimationSpeed(): number {
    return this.read('animationSpeed')
  }

  getEdgeScrollSpeed(): number {
    return this.read('edgeScrollSpeed')
  }

  getEdgeScrollFriction(): number {
    return this.read('edgeScrollFriction')
  }

  getAreKeyboardShortcutsEnabled(): boolean {
    return this.read('areKeyboardShortcutsEnabled')
  }

  getKeyboardShortcutsEnabled(): boolean {
    return this.getAreKeyboardShortcutsEnabled()
  }

  getIsSnapMode(): boolean {
    return this.read('isSnapMode')
  }

  getIsAlwaysSnap(): boolean {
    return this.read('isAlwaysSnap')
  }

  getIsGridMode(): boolean {
    return this.read('isGridMode')
  }

  getIsFocusMode(): boolean {
    return this.read('isFocusMode')
  }

  getIsWrapMode(): boolean {
    return this.read('isWrapMode')
  }

  getIsDynamicResizeMode(): boolean {
    return this.read('isDynamicSizeMode')
  }

  getIsPasteAtCursorMode(): boolean {
    return this.read('isPasteAtCursorMode')
  }

  getEnhancedA11yMode(): boolean {
    return this.read('enhancedA11yMode')
  }

  getInputMode(): 'mouse' | 'trackpad' | null {
    return this.read('inputMode')
  }

  getIsZoomDirectionInverted(): boolean {
    return this.read('isZoomDirectionInverted')
  }

  private read<Key extends keyof typeof DEFAULT_USER_PREFERENCES>(key: Key): (typeof DEFAULT_USER_PREFERENCES)[Key] {
    const value = (this.preferences.get() as Record<string, unknown>)[key]
    return (value ?? DEFAULT_USER_PREFERENCES[key]) as (typeof DEFAULT_USER_PREFERENCES)[Key]
  }

  private watchSystemColorScheme(): void {
    if (typeof matchMedia === 'undefined') return
    const query = matchMedia('(prefers-color-scheme: dark)')
    if (query.matches) this.systemColorScheme.set('dark')
    const change = (event: MediaQueryListEvent): void => {
      this.systemColorScheme.set(event.matches ? 'dark' : 'light')
    }
    query.addEventListener?.('change', change)
    this.stopWatchingSystem = () => {
      query.removeEventListener?.('change', change)
    }
  }
}
