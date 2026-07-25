import { app, nativeImage, type NativeImage } from 'electron'
import { DARK_ICON, DEV_DARK_ICON, DEV_LIGHT_ICON, LIGHT_ICON } from './icon-png'

export type IconTheme = 'dark' | 'light'

const cache = new Map<IconTheme, NativeImage>()

// Not app.isPackaged: that only asks whether the binary is still called
// Electron, and `yarn dev` renames it to Crew, so a run from source claims to
// be packaged. A packaged app loads from inside the bundle's resources, and
// nothing run from source does.
export function fromSource(appPath: string): boolean {
  return !/[\\/][Rr]esources[\\/]app(\.asar)?$/.test(appPath)
}

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
