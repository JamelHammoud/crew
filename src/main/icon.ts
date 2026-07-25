import { nativeImage, type NativeImage } from 'electron'
import { DARK_ICON, LIGHT_ICON } from './icon-png'

export type IconTheme = 'dark' | 'light'

const cache = new Map<IconTheme, NativeImage>()

export function appIcon(theme: IconTheme): NativeImage {
  const held = cache.get(theme)
  if (held) return held
  const image = nativeImage.createFromBuffer(
    Buffer.from(theme === 'light' ? LIGHT_ICON : DARK_ICON, 'base64')
  )
  cache.set(theme, image)
  return image
}
