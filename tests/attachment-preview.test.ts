import { strToU8, zipSync } from 'fflate'
import { beforeEach, describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { entriesOf, unpacks } from '../src/renderer/src/components/attachment/archive'
import { readText, TEXT_LIMIT } from '../src/renderer/src/components/attachment/bytes'
import { ROW_CAP, sheetsFrom } from '../src/renderer/src/components/attachment/sheet'
import { bothWays, viewFor } from '../src/renderer/src/components/attachment/view'
import { useBrowser } from '../src/renderer/src/state/browser'

const buffer = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer as ArrayBuffer

const words = (text: string): ArrayBuffer => buffer(new TextEncoder().encode(text))

describe('a sheet', () => {
  it('reads a csv into rows, header first', () => {
    const [sheet] = sheetsFrom(words('name,size\nreport,4\nnotes,9\n'), 'text/csv')

    expect(sheet!.rows).toEqual([
      ['name', 'size'],
      ['report', '4'],
      ['notes', '9']
    ])
    expect(sheet!.total).toBe(3)
  })

  // A comma inside quotes is part of what somebody wrote, not the next column.
  it('keeps a quoted comma inside its own cell', () => {
    const [sheet] = sheetsFrom(words('who,where\n"Ada, Lovelace",London\n'), 'text/csv')

    expect(sheet!.rows[1]).toEqual(['Ada, Lovelace', 'London'])
  })

  it('reads a tsv on tabs and leaves its commas alone', () => {
    const [sheet] = sheetsFrom(words('a,b\tc\n1,2\t3\n'), 'text/tab-separated-values')

    expect(sheet!.rows).toEqual([
      ['a,b', 'c'],
      ['1,2', '3']
    ])
  })

  it('draws the first few thousand rows and says how many there are', () => {
    const rows = Array.from({ length: ROW_CAP + 500 }, (_, at) => `row${at},${at}`)
    const [sheet] = sheetsFrom(words(`name,at\n${rows.join('\n')}\n`), 'text/csv')

    expect(sheet!.rows).toHaveLength(ROW_CAP)
    expect(sheet!.total).toBe(rows.length + 1)
  })

  it('reads every sheet in a workbook under its own name', () => {
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        ['a', 'b'],
        [1, 2]
      ]),
      'First'
    )
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['c'], ['three']]), 'Second')
    const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

    const sheets = sheetsFrom(bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    expect(sheets.map(one => one.name)).toEqual(['First', 'Second'])
    expect(sheets[0]!.rows).toEqual([
      ['a', 'b'],
      ['1', '2']
    ])
    expect(sheets[1]!.rows).toEqual([['c'], ['three']])
  })
})

// A file is read up to a point and no further, and the panel says so rather than
// showing the beginning as though it were the whole of it.
describe('the byte cap', () => {
  it('hands back the whole of a file that fits', () => {
    const read = readText(words('hello'), 16)

    expect(read).toEqual({ text: 'hello', partial: false })
  })

  it('cuts a longer one and says it was cut', () => {
    const read = readText(words('a'.repeat(50)), 16)

    expect(read.text).toBe('a'.repeat(16))
    expect(read.partial).toBe(true)
  })

  it('stops at two megabytes on its own', () => {
    expect(TEXT_LIMIT).toBe(2 * 1024 * 1024)
    expect(readText(words('a'.repeat(TEXT_LIMIT + 10))).partial).toBe(true)
  })

  // Cutting on a byte lands mid-letter wherever the words are not plain ascii,
  // and a broken letter at the end reads as a file that arrived damaged.
  it('leaves no broken letter at the cut', () => {
    const read = readText(words('née'.repeat(20)), 2)

    expect(read.text).toBe('n')
  })
})

describe('an archive', () => {
  const zip = (): ArrayBuffer =>
    buffer(
      zipSync({
        'notes.txt': strToU8('a'.repeat(120)),
        'src/main.ts': strToU8('b'.repeat(40))
      })
    )

  it('lists what is inside with the size each one really is', () => {
    const found = entriesOf(zip())

    expect(found.map(one => one.name).sort()).toEqual(['notes.txt', 'src/main.ts'])
    expect(found.find(one => one.name === 'notes.txt')!.size).toBe(120)
  })

  it('leaves the folders out of the list', () => {
    const found = entriesOf(buffer(zipSync({ 'inside/': strToU8(''), 'inside/one.txt': strToU8('x') })))

    expect(found.map(one => one.name)).toEqual(['inside/one.txt'])
  })

  // A tar or a 7z is not unpacked here, so nothing tries to read one.
  it('unpacks a zip and nothing else', () => {
    expect(unpacks('application/zip')).toBe(true)
    expect(unpacks('application/x-tar')).toBe(false)
    expect(unpacks('application/x-7z-compressed')).toBe(false)
  })
})

describe('what a file is drawn as', () => {
  it('sends each kind to its own view', () => {
    expect(viewFor('image/png')).toBe('image')
    expect(viewFor('video/mp4')).toBe('video')
    expect(viewFor('audio/mpeg')).toBe('audio')
    expect(viewFor('application/pdf')).toBe('pdf')
    expect(viewFor('text/csv')).toBe('sheet')
    expect(viewFor('application/vnd.ms-excel')).toBe('sheet')
    expect(viewFor('application/zip')).toBe('archive')
  })

  it('draws a docx as writing and everything else written as its own contents', () => {
    expect(viewFor('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('writing')
    expect(viewFor('application/msword')).toBe('text')
    expect(viewFor('application/rtf')).toBe('text')
  })

  // An archive nothing here can open is the file itself and the way to open it
  // on the machine, rather than an empty box.
  it('shows a tar, a rar and a 7z as the file they are', () => {
    expect(viewFor('application/x-tar')).toBe('file')
    expect(viewFor('application/vnd.rar')).toBe('file')
    expect(viewFor('application/x-7z-compressed')).toBe('file')
  })

  // A file nobody can name still has something in it.
  it('falls back to the contents rather than to nothing', () => {
    expect(viewFor('text/plain')).toBe('text')
    expect(viewFor('application/json')).toBe('text')
    expect(viewFor('application/octet-stream')).toBe('text')
    expect(viewFor('')).toBe('text')
  })

  // A page and a vector are handed over as text, so the type is text on both and
  // the name is the only thing that says which.
  it('reads a page and a vector off the name', () => {
    expect(viewFor('text/plain', 'hello.html')).toBe('page')
    expect(viewFor('text/plain', 'one.htm')).toBe('page')
    expect(viewFor('text/plain', 'INDEX.XHTML')).toBe('page')
    expect(viewFor('text/plain', 'logo.svg')).toBe('vector')
    expect(viewFor('text/plain', 'notes.txt')).toBe('text')
    expect(viewFor('text/plain', 'html')).toBe('text')
  })

  // A name only decides it where the type has nothing left to say.
  it('lets a type that knows what it is win over the name', () => {
    expect(viewFor('image/png', 'shot.html')).toBe('image')
    expect(viewFor('application/pdf', 'paper.svg')).toBe('pdf')
  })

  it('offers both ways of reading anything written to be looked at', () => {
    expect(bothWays('text/plain', 'hello.html')).toBe(true)
    expect(bothWays('text/plain', 'logo.svg')).toBe(true)
    expect(bothWays('text/markdown', 'notes.md')).toBe(true)
    expect(bothWays('text/plain', 'notes.txt')).toBe(false)
    expect(bothWays('application/pdf', 'paper.pdf')).toBe(false)
    expect(bothWays('image/png', 'shot.png')).toBe(false)
  })
})

describe('opening one in the panel', () => {
  beforeEach(() => useBrowser.setState({ tabs: [], activeTabId: null, open: false }))

  const open = (): void =>
    useBrowser.getState().openAttachment('http://host/attachments/one.csv', 'one.csv', 'text/csv', 320)

  it('stands the panel up on the file it was handed', () => {
    open()

    const { tabs, open: standing } = useBrowser.getState()
    expect(tabs).toHaveLength(1)
    expect(standing).toBe(true)
    expect(tabs[0]).toMatchObject({
      kind: 'attachment',
      initialUrl: 'http://host/attachments/one.csv',
      title: 'one.csv',
      mime: 'text/csv',
      size: 320
    })
  })

  // The same file asked for twice is the tab that is already open.
  it('brings the one that is open to the front rather than opening a second', () => {
    open()
    const first = useBrowser.getState().tabs[0]!
    useBrowser.getState().openUrl('https://example.com')

    open()

    expect(useBrowser.getState().tabs).toHaveLength(2)
    expect(useBrowser.getState().activeTabId).toBe(first.id)
  })

  // A file written to be looked at is looked at, and the words are one press
  // away rather than the other way round.
  it('opens on the page a file is written to be', () => {
    useBrowser.getState().openAttachment('http://host/attachments/one.html', 'one.html', 'text/plain', 400)

    expect(useBrowser.getState().tabs[0]!.preview).toBe(true)
  })

  it('opens another file beside it', () => {
    open()
    useBrowser.getState().openAttachment('http://host/attachments/two.pdf', 'two.pdf', 'application/pdf', 90)

    expect(useBrowser.getState().tabs.map(t => t.title)).toEqual(['one.csv', 'two.pdf'])
  })
})
