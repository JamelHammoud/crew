import type { ITheme } from '@xterm/xterm'
import type { Theme } from '../state/theme'

const DARK: ITheme = {
  background: '#141414',
  foreground: '#e8e8e8',
  cursor: '#ffffff',
  cursorAccent: '#141414',
  selectionBackground: 'rgba(255, 255, 255, 0.22)',
  black: '#565656',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#d4d4d4',
  brightBlack: '#767676',
  brightRed: '#fca5a5',
  brightGreen: '#86efac',
  brightYellow: '#fde047',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#ffffff'
}

const LIGHT: ITheme = {
  background: '#ffffff',
  foreground: '#1f1f1f',
  cursor: '#141414',
  cursorAccent: '#ffffff',
  selectionBackground: 'rgba(20, 20, 20, 0.16)',
  black: '#3f3f3f',
  red: '#c81e1e',
  green: '#15803d',
  yellow: '#a16207',
  blue: '#1d4ed8',
  magenta: '#7e22ce',
  cyan: '#0e7490',
  white: '#a3a3a3',
  brightBlack: '#767676',
  brightRed: '#dc2626',
  brightGreen: '#16a34a',
  brightYellow: '#ca8a04',
  brightBlue: '#2563eb',
  brightMagenta: '#9333ea',
  brightCyan: '#0891b2',
  brightWhite: '#141414'
}

export const terminalTheme = (theme: Theme): ITheme => (theme === 'light' ? LIGHT : DARK)

export const TERMINAL_FONT =
  '"Cascadia Mono", ui-monospace, "SF Mono", Menlo, monospace'
