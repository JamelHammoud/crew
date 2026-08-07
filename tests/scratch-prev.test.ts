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
const { docSchema, docDictionary } = await import('../src/renderer/src/components/doc/docSchema')
const { docEmoji } = await import('../src/renderer/src/components/doc/docEmoji')

function stand(off: string[]) {
  const editor = BlockNoteEditor.create({
    schema: docSchema as never,
    dictionary: docDictionary as never,
    extensions: [docEmoji] as never,
    disableExtensions: off,
    tables: { headers: true }
  })
  const box = document.createElement('div')
  document.body.append(box)
  editor.mount(box)
  return { editor: editor as never as Record<string, never>, box }
}

function marks(box: HTMLElement) {
  const out: string[] = []
  for (const el of box.querySelectorAll('*')) {
    for (const a of el.attributes) if (a.name.startsWith('data-prev')) out.push(`${a.name}=${a.value}`)
  }
  return out
}

describe('scratch', () => {
  it('shows what a block change writes', () => {
    for (const off of [[] as string[], ['previousBlockType']]) {
      const { editor, box } = stand(off)
      const e = editor as never as {
        document: Array<{ id: string; type: string }>
        updateBlock: (id: string, b: Record<string, unknown>) => void
      }
      const id = e.document[0].id
      e.updateBlock(id, { type: 'heading', props: { level: 1 } })
      console.log(JSON.stringify(off), 'after heading:', JSON.stringify(marks(box)))
      e.updateBlock(id, { type: 'bulletListItem' })
      console.log(JSON.stringify(off), 'after bullet:', JSON.stringify(marks(box)))
    }
    expect(true).toBe(true)
  })
})
