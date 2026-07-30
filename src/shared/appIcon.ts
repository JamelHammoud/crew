// What the app wears in the dock. The mark is the same three discs at the same
// size in every one of them, so the tile behind it is the whole of what changes.

export type AppIconId = 'default' | 'bit' | 'sakura' | 'space' | 'gradient' | 'terminal'

export interface AppIconDef {
  id: AppIconId
  label: string
  // The default is black and white and follows the theme picked in the app. A
  // picture does not: somebody chose it, so it stands whatever the window wears.
  flips: boolean
}

export const APP_ICONS: AppIconDef[] = [
  { id: 'default', label: 'Default', flips: true },
  { id: 'bit', label: '8-bit', flips: false },
  { id: 'sakura', label: 'Sakura', flips: false },
  { id: 'space', label: 'Space', flips: false },
  { id: 'gradient', label: 'Gradient', flips: false },
  { id: 'terminal', label: 'Terminal', flips: false }
]

export const DEFAULT_APP_ICON: AppIconId = 'default'

export const PICTURE_ICONS = APP_ICONS.filter(icon => !icon.flips).map(icon => icon.id)

export function cleanAppIcon(value: unknown): AppIconId {
  return APP_ICONS.some(icon => icon.id === value) ? (value as AppIconId) : DEFAULT_APP_ICON
}

export function appIconLabel(id: AppIconId): string {
  return APP_ICONS.find(icon => icon.id === id)?.label ?? 'Default'
}
