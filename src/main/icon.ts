import fs from 'node:fs'
import { app, nativeImage, type NativeImage } from 'electron'
import { cleanAppIcon, DEFAULT_APP_ICON, type AppIconId } from '../shared/appIcon'
import { wearsBlueprint } from './from-source'
import { DARK_ICON, DEV_DARK_ICON, DEV_LIGHT_ICON, LIGHT_ICON, SKIN_ICONS } from './icon-png'

export type IconTheme = 'dark' | 'light'

const cache = new Map<string, NativeImage>()

// The dock is dressed before any window has loaded, so the choice is remembered
// here as well as in the window that made it. Without this every launch wears the
// default for as long as the renderer takes to come up and say otherwise, which on
// a picture is a black tile flashing into a photograph on somebody's dock. It is
// handed the file it writes to rather than reaching for one, the way the pill's
// own spot is, and it is this machine's own: nothing about it is ever sent.
let file: string | null = null
let chosen: AppIconId = DEFAULT_APP_ICON

export function rememberIcon(where: string): AppIconId {
  file = where
  try {
    chosen = cleanAppIcon(JSON.parse(fs.readFileSync(where, 'utf8')))
  } catch {
    chosen = DEFAULT_APP_ICON
  }
  return chosen
}

export function keepIcon(icon: AppIconId): void {
  chosen = icon
  if (!file) return
  try {
    fs.writeFileSync(file, JSON.stringify(icon))
  } catch {
    // A choice that could not be written down is still the choice for this run.
  }
}

export function chosenIcon(): AppIconId {
  return chosen
}

// A picture somebody picked wins over everything, the blueprint included: picking
// an icon is picking what the app wears, and a run out of source would otherwise
// never show the choice. Only the default follows the theme, and only the default
// wears the blueprint, so a build run from source is never mistaken for the
// installed app sitting next to it in the dock.
function encoded(theme: IconTheme, icon: AppIconId): string {
  const picture = SKIN_ICONS[icon]
  if (picture) return picture
  if (wearsBlueprint(app.getAppPath(), process.env)) return theme === 'light' ? DEV_LIGHT_ICON : DEV_DARK_ICON
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
