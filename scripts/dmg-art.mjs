import { readFileSync, writeFileSync } from 'node:fs'
import zlib from 'node:zlib'

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const PER_METRE = dpi => Math.round(dpi / 0.0254)

function physical(dpi) {
  const body = Buffer.alloc(9)
  body.writeUInt32BE(PER_METRE(dpi), 0)
  body.writeUInt32BE(PER_METRE(dpi), 4)
  body.writeUInt8(1, 8)
  const chunk = Buffer.alloc(body.length + 12)
  chunk.writeUInt32BE(body.length, 0)
  chunk.write('pHYs', 4, 'ascii')
  body.copy(chunk, 8)
  chunk.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from('pHYs'), body])) >>> 0, body.length + 8)
  return chunk
}

export function tagDpi(file, dpi) {
  const png = readFileSync(file)
  if (!png.subarray(0, 8).equals(SIGNATURE)) throw new Error(`${file} is not a png`)
  const pieces = [png.subarray(0, 8)]
  let at = 8
  let placed = false
  while (at < png.length) {
    const length = png.readUInt32BE(at)
    const kind = png.toString('ascii', at + 4, at + 8)
    if (kind !== 'pHYs') {
      pieces.push(png.subarray(at, at + 12 + length))
      if (kind === 'IHDR' && !placed) {
        pieces.push(physical(dpi))
        placed = true
      }
    }
    at += 12 + length
  }
  writeFileSync(file, Buffer.concat(pieces))
}
