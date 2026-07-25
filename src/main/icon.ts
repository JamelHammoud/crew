import { app, nativeImage, type NativeImage } from 'electron'
import { fromSource } from './from-source'
import { DARK_ICON, DEV_DARK_ICON, DEV_LIGHT_ICON, LIGHT_ICON } from './icon-png'

export type IconTheme = 'dark' | 'light'

const cache = new Map<IconTheme, NativeImage>()

// A build run from source wears the blueprint, so it is never mistaken for the
// installed app sitting next to it in the dock.
function encoded(theme: IconTheme): string {
  if (fromSource(app.getAppPath())) return theme === 'light' ? DEV_LIGHT_ICON : DEV_DARK_ICON
  return theme === 'light' ? LIGHT_ICON : DARK_ICON
}

export function appIcon(theme: IconTheme): NativeImage {
  const held = cache.get(theme)
  if (held) return held
  const image = nativeImage.createFromBuffer(Buffer.from(encoded(theme), 'base64'))
  cache.set(theme, image)
  return image
}
