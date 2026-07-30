import { app, nativeImage, type NativeImage } from 'electron'
import type { AppIconId } from '../shared/appIcon'
import { wearsBlueprint } from './from-source'
import { DARK_ICON, DEV_DARK_ICON, DEV_LIGHT_ICON, LIGHT_ICON, SKIN_ICONS } from './icon-png'

export type IconTheme = 'dark' | 'light'

const cache = new Map<string, NativeImage>()

// A picture somebody picked wins over everything, the blueprint included: picking
// an icon is picking what the app wears, and a run out of source would otherwise
// never show the choice. Only the default follows the theme, and only the default
// wears the blueprint, so a build run from source is never mistaken for the
// installed app sitting next to it in the dock.
function encoded(theme: IconTheme, icon: AppIconId): string {
  const picture = SKIN_ICONS[icon]
  if (picture) return picture
  if (wearsBlueprint(app.getAppPath(), process.env))
    return theme === 'light' ? DEV_LIGHT_ICON : DEV_DARK_ICON
  return theme === 'light' ? LIGHT_ICON : DARK_ICON
}

export function appIcon(theme: IconTheme, icon: AppIconId): NativeImage {
  const key = `${icon}:${theme}`
  const held = cache.get(key)
  if (held) return held
  const image = nativeImage.createFromBuffer(Buffer.from(encoded(theme, icon), 'base64'))
  cache.set(key, image)
  return image
}
