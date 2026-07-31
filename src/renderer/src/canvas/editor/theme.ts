import { atom, type Atom } from '../signals'
import type { TLTheme, TLThemes } from './types'

const names = ['black', 'grey', 'light-violet', 'violet', 'blue', 'light-blue', 'yellow', 'orange', 'green', 'light-green', 'light-red', 'red', 'white']

function palette(dark: boolean): TLTheme['colors']['light'] {
  const values = dark
    ? ['#f5f5f5', '#a3a3a3', '#c4b5fd', '#8b5cf6', '#60a5fa', '#7dd3fc', '#facc15', '#fb923c', '#22c55e', '#86efac', '#fca5a5', '#ef4444', '#ffffff']
    : ['#1f1f1f', '#6b7280', '#a78bfa', '#7c3aed', '#2563eb', '#38bdf8', '#eab308', '#ea580c', '#16a34a', '#4ade80', '#f87171', '#dc2626', '#ffffff']
  const result: TLTheme['colors']['light'] = { selectionStroke: dark ? '#ffffff' : '#2f80ed' }
  for (let i = 0; i < names.length; i++) result[names[i]] = { solid: values[i] }
  return result
}

export const defaultTheme: TLTheme = {
  colors: { light: palette(false), dark: palette(true) },
  fontSize: 14,
  lineHeight: 1.35,
  strokeWidth: 2
}

export class ThemeManager {
  private readonly themes: TLThemes
  private readonly current: Atom<string>

  constructor(themes?: Partial<TLThemes>, initial = 'default') {
    this.themes = { default: defaultTheme, ...themes }
    this.current = atom('editor.theme', this.themes[initial] ? initial : 'default')
  }

  getCurrentThemeId(): string {
    return this.current.get()
  }

  getCurrentTheme(): TLTheme {
    return this.themes[this.current.get()] ?? defaultTheme
  }

  setCurrentTheme(id: string): void {
    if (this.themes[id]) this.current.set(id)
  }
}
