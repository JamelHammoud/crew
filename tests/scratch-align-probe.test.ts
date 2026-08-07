// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false
})) as typeof window.matchMedia

const { BlockNoteEditor } = await import('@blocknote/core')
const { docSchema } = await import('../src/renderer/src/components/doc/docSchema')

const editor = () => BlockNoteEditor.create({ schema: docSchema as never }) as never as {
  document: any[]
  replaceBlocks: (a: unknown[], b: unknown[]) => void
  blocksToMarkdownLossy: (blocks: unknown[]) => string
  tryParseMarkdownToBlocks: (markdown: string) => unknown[]
}

const cell = (text: unknown, props: Record<string, unknown> = {}) => ({
  type: 'tableCell',
  content: typeof text === 'string' ? [{ type: 'text', text, styles: {} }] : text,
  props: { colspan: 1, rowspan: 1, backgroundColor: 'default', textColor: 'default', textAlignment: 'left', ...props }
})

const trip = (rows: unknown[], extra: Record<string, unknown> = { headerRows: 1 }) => {
  const one = editor()
  one.replaceBlocks(one.document, [
    { type: 'table', content: { type: 'tableContent', ...extra, rows } } as never
  ])
  const md = one.blocksToMarkdownLossy(one.document)
  const back = editor()
  back.replaceBlocks(back.document, back.tryParseMarkdownToBlocks(md))
  return { md, out: back.document[0]?.content, before: one.document[0].content }
}

describe('what else a table loses', () => {
  it('0. the exact markdown of a two by two with a header row', () => {
    const { md } = trip([{ cells: [cell('a'), cell('b')] }, { cells: [cell('c'), cell('d')] }])
    console.log('MD 2x2 ---', JSON.stringify(md))
    expect(md).toBe('| a          | b          |\n| ---------- | ---------- |\n| c          | d          |\n')
  })

  it('1. column alignment', () => {
    const { md, out } = trip([
      { cells: [cell('a', { textAlignment: 'center' }), cell('b', { textAlignment: 'right' })] },
      { cells: [cell('c', { textAlignment: 'center' }), cell('d', { textAlignment: 'right' })] }
    ])
    console.log('ALIGN MD ---', JSON.stringify(md))
    console.log('ALIGN OUT ---', JSON.stringify(out.rows[0].cells.map((c: any) => c.props?.textAlignment)))
    console.log('ALIGN OUT ROW2 ---', JSON.stringify(out.rows[1].cells.map((c: any) => c.props?.textAlignment)))
    expect(md).toContain(':')
  })

  it('1b. does BlockNote read alignment back off a delimiter row it did not write', () => {
    const back = editor()
    const md = '| a | b | c |\n|:---|---:|:---:|\n| d | e | f |\n'
    back.replaceBlocks(back.document, back.tryParseMarkdownToBlocks(md))
    const out = back.document[0].content
    console.log('READ ALIGN ---', JSON.stringify(out.rows.map((r: any) => r.cells.map((c: any) => c.props?.textAlignment))))
    expect(out.rows[0].cells.map((c: any) => c.props?.textAlignment)).toEqual(['left', 'right', 'center'])
  })

  it('2. cell background colour and text colour', () => {
    const { md, out } = trip([
      { cells: [cell('a', { backgroundColor: 'red', textColor: 'blue' }), cell('b')] },
      { cells: [cell('c'), cell('d')] }
    ])
    console.log('COLOUR MD ---', JSON.stringify(md))
    console.log('COLOUR OUT ---', JSON.stringify(out.rows[0].cells[0].props))
    expect(out.rows[0].cells[0].props.backgroundColor).toBe('red')
  })

  it('3. merged cells', () => {
    const { md, out, before } = trip([
      { cells: [cell('a', { colspan: 2 })] },
      { cells: [cell('c'), cell('d')] }
    ])
    console.log('MERGE BEFORE ---', JSON.stringify(before.rows.map((r: any) => r.cells.map((c: any) => [c.content?.[0]?.text, c.props?.colspan, c.props?.rowspan]))))
    console.log('MERGE MD ---', JSON.stringify(md))
    console.log('MERGE OUT ---', JSON.stringify(out?.rows.map((r: any) => r.cells.map((c: any) => [c.content?.[0]?.text, c.props?.colspan, c.props?.rowspan]))))
    expect(out.rows[0].cells[0].props.colspan).toBe(2)
  })

  it('3b. rowspan', () => {
    const { md, out } = trip([
      { cells: [cell('a', { rowspan: 2 }), cell('b')] },
      { cells: [cell('d')] }
    ])
    console.log('ROWSPAN MD ---', JSON.stringify(md))
    console.log('ROWSPAN OUT ---', JSON.stringify(out?.rows.map((r: any) => r.cells.map((c: any) => [c.content?.[0]?.text, c.props?.colspan, c.props?.rowspan]))))
    expect(out.rows[0].cells[0].props.rowspan).toBe(2)
  })

  it('4. rich text inside a cell', () => {
    const { md, out } = trip([
      {
        cells: [
          cell([
            { type: 'text', text: 'bold', styles: { bold: true } },
            { type: 'text', text: ' ', styles: {} },
            { type: 'text', text: 'ital', styles: { italic: true } },
            { type: 'text', text: ' ', styles: {} },
            { type: 'text', text: 'code', styles: { code: true } },
            { type: 'text', text: ' ', styles: {} },
            { type: 'link', href: 'https://example.com', content: [{ type: 'text', text: 'link', styles: {} }] }
          ]),
          cell('b')
        ]
      },
      { cells: [cell('c'), cell('d')] }
    ])
    console.log('RICH MD ---', JSON.stringify(md))
    console.log('RICH OUT ---', JSON.stringify(out?.rows[0].cells[0].content))
    expect(JSON.stringify(out.rows[0].cells[0].content)).toContain('example.com')
  })

  it('4b. rich text in a body cell too', () => {
    const { md, out } = trip([
      { cells: [cell('a'), cell('b')] },
      {
        cells: [
          cell([
            { type: 'text', text: 'bold', styles: { bold: true } },
            { type: 'text', text: ' and ', styles: {} },
            { type: 'link', href: 'https://example.com', content: [{ type: 'text', text: 'link', styles: {} }] }
          ]),
          cell('d')
        ]
      }
    ])
    console.log('RICH BODY MD ---', JSON.stringify(md))
    console.log('RICH BODY OUT ---', JSON.stringify(out?.rows[1].cells[0].content))
    expect(JSON.stringify(out.rows[1].cells[0].content)).toContain('example.com')
  })

  it('5. a hard line break in a cell', () => {
    const { md, out } = trip([
      { cells: [cell('a'), cell('b')] },
      { cells: [cell('one\ntwo'), cell('d')] }
    ])
    console.log('BREAK MD ---', JSON.stringify(md))
    console.log('BREAK OUT ---', JSON.stringify(out?.rows.map((r: any) => r.cells.map((c: any) => c.content))))
    expect(JSON.stringify(out.rows[1].cells[0].content)).toContain('one\\ntwo')
  })

  it('5b. a cell holding a <br>, which is how gfm writes one', () => {
    const back = editor()
    const md = '| a | b |\n| --- | --- |\n| one<br>two | d |\n'
    back.replaceBlocks(back.document, back.tryParseMarkdownToBlocks(md))
    const out = back.document[0]?.content
    console.log('BR OUT ---', JSON.stringify(back.document))
    expect(out?.rows?.[1]?.cells?.[0]?.content).toBeTruthy()
  })

  it('6. a pipe inside a cell', () => {
    const { md, out } = trip([
      { cells: [cell('a'), cell('b')] },
      { cells: [cell('one | two'), cell('d')] }
    ])
    console.log('PIPE MD ---', JSON.stringify(md))
    console.log('PIPE OUT ---', JSON.stringify(out?.rows.map((r: any) => r.cells.map((c: any) => c.content?.[0]?.text))))
    expect(out.rows[1].cells.length).toBe(2)
  })

  it('7. an empty cell', () => {
    const { md, out } = trip([
      { cells: [cell('a'), cell('b')] },
      { cells: [cell(''), cell('d')] }
    ])
    console.log('EMPTY MD ---', JSON.stringify(md))
    console.log('EMPTY OUT ---', JSON.stringify(out?.rows.map((r: any) => r.cells.map((c: any) => c.content))))
    expect(out.rows[1].cells.length).toBe(2)
  })

  it('8. a table with no header row at all', () => {
    const { md, out } = trip(
      [{ cells: [cell('a'), cell('b')] }, { cells: [cell('c'), cell('d')] }],
      {}
    )
    console.log('NOHEAD MD ---', JSON.stringify(md))
    console.log('NOHEAD OUT ---', JSON.stringify(out))
    expect(out?.headerRows).toBeUndefined()
  })

  it('9. the block own textColor prop', () => {
    const one = editor()
    one.replaceBlocks(one.document, [
      {
        type: 'table',
        props: { textColor: 'red' },
        content: { type: 'tableContent', headerRows: 1, rows: [{ cells: [cell('a'), cell('b')] }, { cells: [cell('c'), cell('d')] }] }
      } as never
    ])
    const md = one.blocksToMarkdownLossy(one.document)
    const back = editor()
    back.replaceBlocks(back.document, back.tryParseMarkdownToBlocks(md))
    console.log('BLOCKPROPS ---', JSON.stringify(back.document[0].props))
    expect(back.document[0].props.textColor).toBe('red')
  })
})
