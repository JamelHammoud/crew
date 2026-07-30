import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const html = fs.readFileSync(path.resolve(__dirname, '../src/renderer/index.html'), 'utf8')

const policy = (): Map<string, string[]> => {
  const found = html.match(/http-equiv="Content-Security-Policy"\s*\n?\s*content="([^"]+)"/)
  if (!found) throw new Error('no content security policy')
  const held = new Map<string, string[]>()
  for (const part of found[1].split(';')) {
    const words = part.trim().split(/\s+/)
    if (words[0]) held.set(words[0], words.slice(1))
  }
  return held
}

describe('renderer content security policy', () => {
  it('lets media come from a file being added and from the host', () => {
    const media = policy().get('media-src')
    expect(media).toBeDefined()
    expect(media).toContain('blob:')
    expect(media).toContain('http:')
    expect(media).toContain('https:')
  })

  // A file not yet sent is read from a blob of its own, which pdfjs and the
  // sheet reader fetch rather than point a tag at. Left out here the read is
  // refused and the preview draws nothing, with the reason in the console.
  it('lets a file waiting in the composer be read', () => {
    const reach = policy().get('connect-src')
    expect(reach).toContain('blob:')
    expect(reach).toContain('data:')
  })

  it('names every directive that carries something the app loads', () => {
    const held = policy()
    for (const name of ['default-src', 'style-src', 'connect-src', 'img-src', 'media-src', 'font-src']) {
      expect(held.has(name)).toBe(true)
    }
  })
})
