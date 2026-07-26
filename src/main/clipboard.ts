import { clipboard, nativeImage, type NativeImage } from 'electron'

const MAX_BYTES = 32 * 1024 * 1024

async function imageFrom(src: string): Promise<NativeImage | null> {
  if (/^data:image\//i.test(src)) return nativeImage.createFromDataURL(src)
  if (!/^https?:/i.test(src)) return null
  const response = await fetch(src)
  if (!response.ok) return null
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.byteLength > MAX_BYTES) return null
  return nativeImage.createFromBuffer(bytes)
}

export async function copyImage(src: string): Promise<boolean> {
  try {
    const image = await imageFrom(src)
    if (!image || image.isEmpty()) return false
    clipboard.writeImage(image)
    return true
  } catch {
    return false
  }
}
