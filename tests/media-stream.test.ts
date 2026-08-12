import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { Media, mediaResponse } from '../src/main/media-file'
import { rangeOf } from '../src/main/media-range'
import { tmpDir } from './helpers/session'

const BYTES = Uint8Array.from({ length: 512 }, (_, at) => at % 251)

function put(name = 'clip.mp4'): { media: Media; url: string; file: string } {
  const file = path.join(tmpDir('media'), name)
  writeFileSync(file, BYTES)
  const media = new Media()
  return { media, url: media.url(file), file }
}

const bytesOf = async (answer: Response): Promise<Uint8Array> => new Uint8Array(await answer.arrayBuffer())

describe('the url a file is played from', () => {
  it('says nothing about where the file is', () => {
    const { url, file } = put()

    expect(url.startsWith('crew-media://m/')).toBe(true)
    expect(url).not.toContain(file)
    expect(url).not.toContain('clip.mp4')
  })

  it('is the same url for the same file twice', () => {
    const { media, url, file } = put()

    expect(media.url(file)).toBe(url)
  })

  it('is a different url for a different file', () => {
    const { media, url } = put()
    const other = path.join(tmpDir('media'), 'other.mp4')
    writeFileSync(other, BYTES)

    expect(media.url(other)).not.toBe(url)
  })
})

describe('what the handler answers', () => {
  it('hands over the whole file when nothing was asked for', async () => {
    const { url } = put()

    const answer = await mediaResponse(url, null)

    expect(answer.status).toBe(200)
    expect(answer.headers.get('Accept-Ranges')).toBe('bytes')
    expect(answer.headers.get('Content-Length')).toBe('512')
    expect(answer.headers.get('Content-Type')).toBe('video/mp4')
    expect(answer.headers.get('Content-Range')).toBeNull()
    expect(await bytesOf(answer)).toEqual(BYTES)
  })

  it('hands back exactly the bytes a range asked for', async () => {
    const { url } = put()

    const answer = await mediaResponse(url, 'bytes=10-19')

    expect(answer.status).toBe(206)
    expect(answer.headers.get('Content-Range')).toBe('bytes 10-19/512')
    expect(answer.headers.get('Content-Length')).toBe('10')
    expect(answer.headers.get('Accept-Ranges')).toBe('bytes')
    expect(await bytesOf(answer)).toEqual(BYTES.slice(10, 20))
  })

  it('runs an open ended range to the end of the file', async () => {
    const { url } = put()

    const answer = await mediaResponse(url, 'bytes=100-')

    expect(answer.status).toBe(206)
    expect(answer.headers.get('Content-Range')).toBe('bytes 100-511/512')
    expect(answer.headers.get('Content-Length')).toBe('412')
    expect(await bytesOf(answer)).toEqual(BYTES.slice(100))
  })

  it('gives the last hundred bytes for a suffix', async () => {
    const { url } = put()

    const answer = await mediaResponse(url, 'bytes=-100')

    expect(answer.status).toBe(206)
    expect(answer.headers.get('Content-Range')).toBe('bytes 412-511/512')
    expect(answer.headers.get('Content-Length')).toBe('100')
    expect(await bytesOf(answer)).toEqual(BYTES.slice(412))
  })

  it('holds a range that ends past the file to the last byte there is', async () => {
    const { url } = put()

    const answer = await mediaResponse(url, 'bytes=500-9000')

    expect(answer.status).toBe(206)
    expect(answer.headers.get('Content-Range')).toBe('bytes 500-511/512')
    expect(await bytesOf(answer)).toEqual(BYTES.slice(500))
  })

  it('turns away a range that starts past the end', async () => {
    const { url } = put()

    const answer = await mediaResponse(url, 'bytes=900-1000')

    expect(answer.status).toBe(416)
    expect(answer.headers.get('Content-Range')).toBe('bytes */512')
    expect(await bytesOf(answer)).toEqual(new Uint8Array())
  })

  it('reads a header it cannot make sense of as no range at all', async () => {
    const { url } = put()

    for (const junk of ['bytes=abc-def', 'rows=0-10', 'bytes 0-10', '']) {
      const answer = await mediaResponse(url, junk)

      expect(answer.status).toBe(200)
      expect(answer.headers.get('Content-Length')).toBe('512')
      expect(await bytesOf(answer)).toEqual(BYTES)
    }
  })

  it('names a track by what it is rather than by plain bytes', async () => {
    const { url } = put('theme.mp3')

    expect((await mediaResponse(url, null)).headers.get('Content-Type')).toBe('audio/mpeg')
  })

  it('has nothing to say for a key nobody handed out', async () => {
    const answer = await mediaResponse('crew-media://m/2f9a1c00-0000-4000-8000-000000000000', null)

    expect(answer.status).toBe(404)
  })

  it('has nothing to say once the window that opened it has gone', async () => {
    const { media, url } = put()
    media.clear()

    expect((await mediaResponse(url, null)).status).toBe(404)
  })

  it('has nothing to say for a file that has been deleted since', async () => {
    const media = new Media()
    const url = media.url(path.join(tmpDir('media'), 'gone.mp4'))

    expect((await mediaResponse(url, null)).status).toBe(404)
  })
})

describe('rangeOf', () => {
  it('reads the three ways a range is written', () => {
    expect(rangeOf('bytes=0-9', 512)).toEqual({ kind: 'slice', start: 0, end: 9 })
    expect(rangeOf('bytes=100-', 512)).toEqual({ kind: 'slice', start: 100, end: 511 })
    expect(rangeOf('bytes=-100', 512)).toEqual({ kind: 'slice', start: 412, end: 511 })
  })

  it('asks for the whole of a file smaller than the suffix', () => {
    expect(rangeOf('bytes=-900', 512)).toEqual({ kind: 'slice', start: 0, end: 511 })
  })

  it('answers nothing at all for an empty file', () => {
    expect(rangeOf('bytes=0-', 0)).toEqual({ kind: 'unsatisfiable' })
    expect(rangeOf('bytes=-10', 0)).toEqual({ kind: 'unsatisfiable' })
    expect(rangeOf(null, 0)).toEqual({ kind: 'whole' })
  })

  it('turns away a range that cannot be met', () => {
    expect(rangeOf('bytes=512-', 512)).toEqual({ kind: 'unsatisfiable' })
    expect(rangeOf('bytes=20-10', 512)).toEqual({ kind: 'unsatisfiable' })
    expect(rangeOf('bytes=-0', 512)).toEqual({ kind: 'unsatisfiable' })
  })

  it('falls back to the whole file for anything it cannot read', () => {
    expect(rangeOf(null, 512)).toEqual({ kind: 'whole' })
    expect(rangeOf('bytes=0-10,20-30', 512)).toEqual({ kind: 'whole' })
    expect(rangeOf('bytes=-', 512)).toEqual({ kind: 'whole' })
    expect(rangeOf('nonsense', 512)).toEqual({ kind: 'whole' })
  })
})
