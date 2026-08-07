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

function stand(off: string[]) {
  const editor = BlockNoteEditor.create({
    schema: docSchema as never,
    dictionary: docDictionary as never,
    disableExtensions: off,
    tables: { headers: true }
  }) as never as {
    document: Array<{ id: string }>
    updateBlock: (id: string, block: Record<string, unknown>) => void
    mount: (box: HTMLElement) => void
  }
  const box = document.createElement('div')
  document.body.append(box)
  editor.mount(box)
  return { editor, box }
}

const stale = (box: HTMLElement): string[] => {
  const out: string[] = []
  for (const el of box.querySelectorAll('*')) {
    for (const attr of el.attributes) if (attr.name.startsWith('data-prev')) out.push(attr.name)
  }
  return out
}

describe('doc block changes do not animate', () => {
  it('writes nothing about the block a line used to be', () => {
    const { editor, box } = stand(['previousBlockType'])
    const id = editor.document[0].id
    editor.updateBlock(id, { type: 'heading', props: { level: 1 } })
    expect(stale(box)).toEqual([])
    editor.updateBlock(id, { type: 'bulletListItem' })
    expect(stale(box)).toEqual([])
  })

  it('is the extension being off that does it', () => {
    const { editor, box } = stand([])
    editor.updateBlock(editor.document[0].id, { type: 'heading', props: { level: 1 } })
    expect(stale(box)).toContain('data-prev-type')
  })

  it('is off in the editor the docs are written in', async () => {
    const source = (await import('../src/renderer/src/components/DocEditor.tsx?raw')).default as string
    expect(source).toContain("disableExtensions: ['previousBlockType']")
  })

  it('leaves no style behind for a block a line used to be', async () => {
    const styles = (await import('../src/renderer/src/styles.css?raw')).default as string
    expect(styles).not.toContain('data-prev-level')
    expect(styles).not.toContain('data-prev-depth')
  })
})
