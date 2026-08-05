import { randomUUID } from 'node:crypto'
import { createReadStream, promises as fs } from 'node:fs'
import { Readable } from 'node:stream'
import { mediaType } from '../shared/files'
import type { MediaHost } from './files'
import { rangeOf } from './media-range'

export const MEDIA_SCHEME = 'crew-media'

const PLAIN_BYTES = 'application/octet-stream'

// The key says nothing about where the file is, so the only files this can ever
// hand over are ones the app really opened for somebody. A url anything could
// build out of a path would be a way to read the whole disk, and the side panel
// holds a real browser.
const opened = new Map<string, string>()

const urlFor = (key: string): string => `${MEDIA_SCHEME}://m/${key}`

// A file a window is playing, the way a page it is reading belongs to the window
// that stood it up. The same file asked for twice keeps the url it already had:
// one that changed on every render would have the video tag fetch again and lose
// where somebody had got to.
export class Media implements MediaHost {
  private keys = new Map<string, string>()

  url(absolute: string): string {
    const held = this.keys.get(absolute)
    if (held) return urlFor(held)
    const key = randomUUID()
    this.keys.set(absolute, key)
    opened.set(key, absolute)
    return urlFor(key)
  }

  clear(): void {
    for (const key of this.keys.values()) opened.delete(key)
    this.keys.clear()
  }
}

function keyOf(url: string): string {
  const withoutQuery = url.split(/[?#]/)[0] ?? ''
  return withoutQuery.split('/').pop() ?? ''
}

const nothingThere = (): Response => new Response(null, { status: 404 })

// Never the whole file: these run to hundreds of megabytes, and what a scrubber
// asks for is a few seconds in the middle of one.
function slice(absolute: string, start: number, end: number): ReadableStream<Uint8Array> {
  return Readable.toWeb(createReadStream(absolute, { start, end })) as unknown as ReadableStream<Uint8Array>
}

export async function mediaResponse(url: string, range: string | null): Promise<Response> {
  const absolute = opened.get(keyOf(url))
  if (!absolute) return nothingThere()
  const stat = await fs.stat(absolute).catch(() => null)
  if (!stat || !stat.isFile()) return nothingThere()
  const size = stat.size
  const asked = rangeOf(range, size)
  if (asked.kind === 'unsatisfiable') {
    return new Response(null, {
      status: 416,
      headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes */${size}` }
    })
  }
  const start = asked.kind === 'slice' ? asked.start : 0
  const end = asked.kind === 'slice' ? asked.end : size - 1
  const length = size === 0 ? 0 : end - start + 1
  const headers: Record<string, string> = {
    'Accept-Ranges': 'bytes',
    'Content-Length': String(length),
    'Content-Type': mediaType(absolute)?.type ?? PLAIN_BYTES
  }
  if (asked.kind === 'slice') headers['Content-Range'] = `bytes ${start}-${end}/${size}`
  return new Response(length === 0 ? null : slice(absolute, start, end), {
    status: asked.kind === 'slice' ? 206 : 200,
    headers
  })
}
