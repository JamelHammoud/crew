import { unzipSync } from 'fflate'

export interface ArchiveEntry {
  name: string
  size: number
}

export const unpacks = (mime: string): boolean => mime === 'application/zip'

export function entriesOf(bytes: ArrayBuffer): ArchiveEntry[] {
  const found: ArchiveEntry[] = []
  unzipSync(new Uint8Array(bytes), {
    filter: file => {
      if (!file.name.endsWith('/')) found.push({ name: file.name, size: file.originalSize })
      return false
    }
  })
  return found
}
