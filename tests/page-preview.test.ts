import fsSync from 'node:fs'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Previews } from '../src/main/preview'
import { fileUrl } from '../src/shared/htmlPage'

const MODEL = '<html><body><canvas></canvas><script>draw()</script></body></html>'

let folder = ''
let previews: Previews

beforeEach(async () => {
  folder = await fs.mkdtemp(path.join(os.tmpdir(), 'crew-page-'))
  previews = new Previews()
})

afterEach(async () => {
  previews.clear()
  await fs.rm(folder, { recursive: true, force: true })
})

const copyOf = (url: string) => decodeURIComponent(url.slice('file://'.length))

describe('a page drawn from the words in hand', () => {
  it('stands in a copy of its own, so an edit typed in the text is on it', async () => {
    const wrote = path.join(folder, 'index.html')
    await fs.writeFile(wrote, '<p>On disk</p>', 'utf8')

    const url = await previews.show('one', wrote, '<p>Written just now</p>')

    expect(url).not.toBe(fileUrl(wrote))
    expect(await fs.readFile(copyOf(url!), 'utf8')).toContain('Written just now')
  })

  it('is handed the folder the page really lives in', async () => {
    const wrote = path.join(folder, 'index.html')

    const url = await previews.show('one', wrote, '<html><head></head></html>')

    expect(await fs.readFile(copyOf(url!), 'utf8')).toContain(`<base href="${fileUrl(folder)}/">`)
  })
})

describe('a page that is only partly in hand', () => {
  it('stands where it was written rather than in a copy of its own head', async () => {
    const wrote = path.join(folder, 'model.html')
    await fs.writeFile(wrote, MODEL, 'utf8')

    expect(await previews.show('one', wrote, null)).toBe(fileUrl(wrote))
  })

  it('needs no base, since the folder it stands in is its own', async () => {
    const wrote = path.join(folder, 'model.html')
    await fs.writeFile(wrote, MODEL, 'utf8')

    await previews.show('one', wrote, null)

    expect(await fs.readFile(wrote, 'utf8')).toBe(MODEL)
  })

  it('takes the copy it had away when the same page turns out to be too big', async () => {
    const wrote = path.join(folder, 'index.html')

    const url = await previews.show('one', wrote, '<p>a</p>')
    expect(fsSync.existsSync(copyOf(url!))).toBe(true)

    await previews.show('one', wrote, null)

    expect(fsSync.existsSync(copyOf(url!))).toBe(false)
  })

  it('has nothing to stand up for a page with no file behind it', async () => {
    expect(await previews.show('one', '', null)).toBeNull()
  })

  it('leaves the page another window is reading where it is', async () => {
    const wrote = path.join(folder, 'index.html')
    const other = await previews.show('two', wrote, '<p>a</p>')

    await previews.show('one', wrote, null)

    expect(fsSync.existsSync(copyOf(other!))).toBe(true)
  })
})
